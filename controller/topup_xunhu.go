package controller

import (
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type XunhuPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

// xunhuPayResponse 虎皮椒下单接口响应。
// OpenId 实际是订单 ID（历史 bug：字段名叫 openid 但值是订单号）。
// 虎皮椒返回的可能是数字（int）也可能是字符串，用 any 避免 unmarshal 失败。
type xunhuPayResponse struct {
	OpenId    any    `json:"openid"`
	UrlQrcode string `json:"url_qrcode"`
	Url       string `json:"url"`
	Errcode   int    `json:"errcode"`
	Errmsg    string `json:"errmsg"`
	Hash      string `json:"hash"`
}

func (r *xunhuPayResponse) orderIdString() string {
	if r == nil || r.OpenId == nil {
		return ""
	}
	return fmt.Sprintf("%v", r.OpenId)
}

var xunhuHttpClient = &http.Client{Timeout: 15 * time.Second}

// errXunhuParseFailed 标记响应解析失败 — 不重试（说明虎皮椒返回了不可解析的数据，重试也是同样结果）。
var errXunhuParseFailed = errors.New("parse response failed")

// xunhuRetryBackoffs 重试间隔。第一次立即调，后续按这个序列延迟。
var xunhuRetryBackoffs = []time.Duration{0, 300 * time.Millisecond, 1 * time.Second}

// generateXunhuHash 按虎皮椒签名规则生成 MD5 hash。
// 排除 hash 字段和空值，按 key ASCII 排序，拼接 key=value&... 末尾追加 secret，再 MD5 小写。
func generateXunhuHash(params map[string]string, secret string) string {
	keys := make([]string, 0, len(params))
	for k, v := range params {
		if k == "hash" || v == "" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var sb strings.Builder
	for i, k := range keys {
		if i > 0 {
			sb.WriteByte('&')
		}
		sb.WriteString(k)
		sb.WriteByte('=')
		sb.WriteString(params[k])
	}
	sb.WriteString(secret)
	sum := md5.Sum([]byte(sb.String()))
	return hex.EncodeToString(sum[:])
}

func verifyXunhuHash(params map[string]string, secret string) bool {
	receivedHash := params["hash"]
	if receivedHash == "" {
		return false
	}
	expected := generateXunhuHash(params, secret)
	return strings.EqualFold(receivedHash, expected)
}

// isXunhuMobileUA 检测是否为手机/微信内置浏览器 UA，决定走 url 跳转或 url_qrcode 弹窗。
func isXunhuMobileUA(ua string) bool {
	if ua == "" {
		return false
	}
	lower := strings.ToLower(ua)
	mobileKeywords := []string{
		"iphone", "ipod", "ipad",
		"android",
		"micromessenger",
		"mobile",
		"phone",
	}
	for _, kw := range mobileKeywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}

// xunhuTitlePctRe 用于剥离 title 中的 % 字符（虎皮椒不允许）。
var xunhuTitlePctRe = regexp.MustCompile(`%`)

// sanitizeXunhuTitle 限制 title ≤ 127 字节、移除 % 字符。
func sanitizeXunhuTitle(title string) string {
	clean := xunhuTitlePctRe.ReplaceAllString(title, "")
	if len(clean) <= 127 {
		return clean
	}
	// 按字节截断，但避免切断 UTF-8 字符
	for i := 127; i > 0; i-- {
		if (clean[i] & 0xC0) != 0x80 {
			return clean[:i]
		}
	}
	return clean[:127]
}

// formatXunhuTotalFee 把金额按虎皮椒规则格式化：整数不带小数（"1" 而不是 "1.00"），
// 非整数最多保留 2 位小数并剥离尾部 0（"1.5"，"99.99"）。
func formatXunhuTotalFee(money float64) string {
	d := decimal.NewFromFloat(money).Round(2)
	s := d.StringFixed(2)
	s = strings.TrimRight(s, "0")
	s = strings.TrimRight(s, ".")
	if s == "" || s == "-" {
		return "0"
	}
	return s
}

func getXunhuMinTopup() int64 {
	minTopup := setting.XunhuMinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		minTopup = minTopup * int(common.QuotaPerUnit)
	}
	return int64(minTopup)
}

// buildXunhuPayParams 构造下单参数（不含 hash）。trade_order_id ≤ 32 字符；total_fee 已格式化。
func buildXunhuPayParams(appId, tradeNo, title string, money float64, notifyUrl, returnUrl, attach string) map[string]string {
	params := map[string]string{
		"version":        "1.1",
		"appid":          appId,
		"trade_order_id": tradeNo,
		"total_fee":      formatXunhuTotalFee(money),
		"title":          sanitizeXunhuTitle(title),
		"time":           strconv.FormatInt(time.Now().Unix(), 10),
		"notify_url":     notifyUrl,
		"nonce_str":      common.GetRandomString(16),
		"type":           "WAP",
		"wap_url":        notifyUrl,
		"wap_name":       sanitizeXunhuTitle(title),
	}
	if returnUrl != "" {
		params["return_url"] = returnUrl
	}
	if attach != "" {
		params["attach"] = attach
	}
	return params
}

// callXunhuPay 调用虎皮椒下单接口。
func callXunhuPay(params map[string]string) (*xunhuPayResponse, []byte, error) {
	form := url.Values{}
	for k, v := range params {
		form.Set(k, v)
	}
	req, err := http.NewRequest(http.MethodPost, setting.XunhuApiUrl, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := xunhuHttpClient.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, err
	}
	var payResp xunhuPayResponse
	if err := common.Unmarshal(body, &payResp); err != nil {
		return nil, body, fmt.Errorf("%w: %v", errXunhuParseFailed, err)
	}
	return &payResp, body, nil
}

// callXunhuPayWithRetry 在网络/IO 错误上重试最多 len(xunhuRetryBackoffs) 次。
// 解析错误（errXunhuParseFailed）和请求构造错误不重试。
func callXunhuPayWithRetry(params map[string]string) (*xunhuPayResponse, []byte, error) {
	var lastResp *xunhuPayResponse
	var lastBody []byte
	var lastErr error
	for i, backoff := range xunhuRetryBackoffs {
		if i > 0 && backoff > 0 {
			time.Sleep(backoff)
		}
		resp, body, err := callXunhuPay(params)
		if err == nil {
			return resp, body, nil
		}
		lastResp, lastBody, lastErr = resp, body, err
		if errors.Is(err, errXunhuParseFailed) {
			return resp, body, err
		}
	}
	return lastResp, lastBody, lastErr
}

// RunXunhuOrderCleanup 周期清理 Xunhu 过期 pending 订单（充值 + 订阅）。
// 给 webhook 回调留 60s 缓冲，避免误杀正在被回调的订单。
func RunXunhuOrderCleanup(intervalSeconds int) {
	if intervalSeconds < 30 {
		intervalSeconds = 60
	}
	for {
		time.Sleep(time.Duration(intervalSeconds) * time.Second)
		expire := setting.XunhuOrderExpire
		if expire <= 0 {
			continue
		}
		cutoff := time.Now().Unix() - int64(expire) - 60
		if n, err := model.ExpirePendingTopUpsByProviderBefore(model.PaymentProviderXunhu, cutoff); err != nil {
			common.SysError(fmt.Sprintf("虎皮椒 pending 充值订单清理失败 error=%q", err.Error()))
		} else if n > 0 {
			common.SysLog(fmt.Sprintf("虎皮椒 pending 充值订单清理 expired=%d cutoff=%d", n, cutoff))
		}
		if n, err := model.ExpirePendingSubscriptionOrdersByProviderBefore(model.PaymentProviderXunhu, cutoff); err != nil {
			common.SysError(fmt.Sprintf("虎皮椒 pending 订阅订单清理失败 error=%q", err.Error()))
		} else if n > 0 {
			common.SysLog(fmt.Sprintf("虎皮椒 pending 订阅订单清理 expired=%d cutoff=%d", n, cutoff))
		}
	}
}

func RequestXunhuAmount(c *gin.Context) {
	var req XunhuPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < getXunhuMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getXunhuMinTopup())})
		return
	}
	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

func RequestXunhuPay(c *gin.Context) {
	ctx := c.Request.Context()
	if !isXunhuTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "虎皮椒支付未启用"})
		return
	}

	var req XunhuPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < getXunhuMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getXunhuMinTopup())})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	// trade_no ≤ 32 字符，只允许 [A-Za-z0-9_\-*]。"XHUUSR{id}NO{6 rand}{unix}" 形如 26 字符
	tradeNo := fmt.Sprintf("XHUUSR%dNO%s%d", id, common.GetRandomString(6), time.Now().Unix())
	if len(tradeNo) > 32 {
		tradeNo = tradeNo[:32]
	}

	// Token 模式下归一化 Amount，避免回调时双重放大
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = int64(float64(req.Amount) / common.QuotaPerUnit)
		if amount < 1 {
			amount = 1
		}
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodWxpay,
		PaymentProvider: model.PaymentProviderXunhu,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(ctx, fmt.Sprintf("虎皮椒 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	callBackAddress := service.GetCallbackAddress()
	notifyUrl := strings.TrimRight(callBackAddress, "/") + "/api/xunhu/webhook"
	returnUrl := paymentReturnPath("/console/topup?show_history=true")
	title := fmt.Sprintf("充值 %d", req.Amount)

	params := buildXunhuPayParams(setting.XunhuAppId, tradeNo, title, payMoney, notifyUrl, returnUrl, "")
	params["hash"] = generateXunhuHash(params, setting.XunhuAppSecret)

	payResp, raw, err := callXunhuPayWithRetry(params)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("虎皮椒 拉起支付失败 user_id=%d trade_no=%s error=%q raw=%q", id, tradeNo, err.Error(), string(raw)))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}
	if payResp.Errcode != 0 {
		logger.LogWarn(ctx, fmt.Sprintf("虎皮椒 下单业务失败 user_id=%d trade_no=%s errcode=%d errmsg=%q raw=%q", id, tradeNo, payResp.Errcode, payResp.Errmsg, string(raw)))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		msg := payResp.Errmsg
		if msg == "" {
			msg = "拉起支付失败"
		}
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": msg})
		return
	}

	logger.LogInfo(ctx, fmt.Sprintf("虎皮椒 充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f order_id=%s", id, tradeNo, req.Amount, payMoney, payResp.orderIdString()))

	// 根据 UA 决定返回 url 还是 url_qrcode；前端依据 type 渲染
	isMobile := isXunhuMobileUA(c.Request.UserAgent())
	respData := gin.H{
		"trade_no":       tradeNo,
		"amount":         payMoney,
		"order_id":       payResp.orderIdString(),
		"expire_seconds": setting.XunhuOrderExpire,
	}
	if isMobile && payResp.Url != "" {
		respData["type"] = "redirect"
		respData["url"] = payResp.Url
	} else if payResp.UrlQrcode != "" {
		respData["type"] = "qrcode"
		// 注意：url_qrcode 已经是渲染好的二维码图片 URL，前端直接 <img src> 显示
		respData["qrcode_url"] = payResp.UrlQrcode
		// 同时附带 url 作为「新 tab 打开支付页」的备用入口
		if payResp.Url != "" {
			respData["url"] = payResp.Url
		}
	} else if payResp.Url != "" {
		respData["type"] = "redirect"
		respData["url"] = payResp.Url
	} else {
		logger.LogWarn(ctx, fmt.Sprintf("虎皮椒 下单成功但无支付链接 user_id=%d trade_no=%s raw=%q", id, tradeNo, string(raw)))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": respData})
}

func XunhuWebhook(c *gin.Context) {
	ctx := c.Request.Context()
	if !isXunhuWebhookEnabled() {
		logger.LogWarn(ctx, fmt.Sprintf("虎皮椒 webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	if err := c.Request.ParseForm(); err != nil {
		logger.LogError(ctx, fmt.Sprintf("虎皮椒 webhook 表单解析失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	params := make(map[string]string)
	for k := range c.Request.PostForm {
		params[k] = c.Request.PostForm.Get(k)
	}
	logger.LogInfo(ctx, fmt.Sprintf("虎皮椒 webhook 收到请求 path=%q client_ip=%s params=%q", c.Request.RequestURI, c.ClientIP(), common.GetJsonString(params)))

	if len(params) == 0 {
		logger.LogWarn(ctx, fmt.Sprintf("虎皮椒 webhook 参数为空 path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	if !setting.XunhuTestMode && !verifyXunhuHash(params, setting.XunhuAppSecret) {
		logger.LogWarn(ctx, fmt.Sprintf("虎皮椒 webhook 验签失败 path=%q client_ip=%s params=%q", c.Request.RequestURI, c.ClientIP(), common.GetJsonString(params)))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	tradeNo := params["trade_order_id"]
	status := params["status"]
	if tradeNo == "" {
		logger.LogWarn(ctx, fmt.Sprintf("虎皮椒 webhook 缺少订单号 client_ip=%s params=%q", c.ClientIP(), common.GetJsonString(params)))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	if status != "OD" {
		// 非付款事件（退款 / 退款中 / 退款失败）暂不处理，回 success 让虎皮椒停止重试
		logger.LogInfo(ctx, fmt.Sprintf("虎皮椒 webhook 忽略非付款事件 trade_no=%s status=%s client_ip=%s", tradeNo, status, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("success"))
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		logger.LogWarn(ctx, fmt.Sprintf("虎皮椒 webhook 订单不存在 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	if topUp.PaymentProvider != model.PaymentProviderXunhu {
		logger.LogWarn(ctx, fmt.Sprintf("虎皮椒 webhook 订单网关不匹配 trade_no=%s provider=%s client_ip=%s", tradeNo, topUp.PaymentProvider, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	if topUp.Status == common.TopUpStatusSuccess {
		// 幂等
		logger.LogInfo(ctx, fmt.Sprintf("虎皮椒 webhook 订单已成功，幂等返回 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("success"))
		return
	}
	if topUp.Status != common.TopUpStatusPending {
		logger.LogWarn(ctx, fmt.Sprintf("虎皮椒 webhook 订单状态非 pending trade_no=%s status=%s client_ip=%s", tradeNo, topUp.Status, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	topUp.Status = common.TopUpStatusSuccess
	topUp.CompleteTime = time.Now().Unix()
	if err := topUp.Update(); err != nil {
		logger.LogError(ctx, fmt.Sprintf("虎皮椒 webhook 更新订单失败 trade_no=%s error=%q", tradeNo, err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	dAmount := decimal.NewFromInt(topUp.Amount)
	dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
	quotaToAdd := int(dAmount.Mul(dQuotaPerUnit).IntPart())
	if quotaToAdd > 0 {
		if err := model.IncreaseUserQuota(topUp.UserId, quotaToAdd, true); err != nil {
			logger.LogError(ctx, fmt.Sprintf("虎皮椒 webhook 更新用户额度失败 trade_no=%s user_id=%d quota_to_add=%d error=%q", tradeNo, topUp.UserId, quotaToAdd, err.Error()))
			_, _ = c.Writer.Write([]byte("fail"))
			return
		}
	}

	logger.LogInfo(ctx, fmt.Sprintf("虎皮椒 充值成功 trade_no=%s user_id=%d quota_to_add=%d money=%.2f client_ip=%s", tradeNo, topUp.UserId, quotaToAdd, topUp.Money, c.ClientIP()))
	model.RecordTopupLog(topUp.UserId, fmt.Sprintf("使用虎皮椒充值成功，充值额度: %d，支付金额：%.2f", quotaToAdd, topUp.Money), c.ClientIP(), topUp.PaymentMethod, model.PaymentProviderXunhu)
	// 充值累计自动升级分组(软失败,不影响充值结果)
	model.TryUpgradeUserGroupByRecharge(topUp.UserId)

	// 必须返回字面量字符串 success，否则虎皮椒会重试 6 次
	_, _ = c.Writer.Write([]byte("success"))
}

func GetXunhuOrderStatus(c *gin.Context) {
	tradeNo := c.Query("trade_no")
	if tradeNo == "" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	id := c.GetInt("id")

	// 先查充值订单
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp != nil && topUp.PaymentProvider == model.PaymentProviderXunhu {
		if topUp.UserId != id {
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "订单不存在"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"message": "success",
			"data": gin.H{
				"trade_no": topUp.TradeNo,
				"status":   topUp.Status,
				"amount":   topUp.Amount,
				"money":    topUp.Money,
			},
		})
		return
	}

	// 再查订阅订单
	subOrder := model.GetSubscriptionOrderByTradeNo(tradeNo)
	if subOrder != nil && subOrder.PaymentProvider == model.PaymentProviderXunhu {
		if subOrder.UserId != id {
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "订单不存在"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"message": "success",
			"data": gin.H{
				"trade_no": subOrder.TradeNo,
				"status":   subOrder.Status,
				"amount":   0,
				"money":    subOrder.Money,
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "error", "data": "订单不存在"})
}
