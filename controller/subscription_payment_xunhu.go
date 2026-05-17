package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

type SubscriptionXunhuPayRequest struct {
	PlanId int `json:"plan_id"`
}

func SubscriptionRequestXunhuPay(c *gin.Context) {
	ctx := c.Request.Context()
	if !requirePaymentCompliance(c) {
		return
	}
	if !isXunhuTopUpEnabled() {
		common.ApiErrorMsg(c, "虎皮椒支付未启用")
		return
	}

	var req SubscriptionXunhuPayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorMsg(c, "套餐未启用")
		return
	}
	if plan.PriceAmount < 0.01 {
		common.ApiErrorMsg(c, "套餐金额过低")
		return
	}

	userId := c.GetInt("id")
	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userId, plan.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			common.ApiErrorMsg(c, "已达到该套餐购买上限")
			return
		}
	}

	tradeNo := fmt.Sprintf("XHSUB%dN%s%d", userId, common.GetRandomString(4), time.Now().Unix())
	if len(tradeNo) > 32 {
		tradeNo = tradeNo[:32]
	}

	order := &model.SubscriptionOrder{
		UserId:          userId,
		PlanId:          plan.Id,
		Money:           plan.PriceAmount,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodWxpay,
		PaymentProvider: model.PaymentProviderXunhu,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		logger.LogError(ctx, fmt.Sprintf("虎皮椒 创建订阅订单失败 user_id=%d trade_no=%s plan_id=%d error=%q", userId, tradeNo, plan.Id, err.Error()))
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}

	callBackAddress := service.GetCallbackAddress()
	notifyUrl := strings.TrimRight(callBackAddress, "/") + "/api/subscription/xunhu/notify"
	returnUrl := paymentReturnPath("/console/topup?show_history=true")
	title := fmt.Sprintf("订阅 %s", plan.Title)

	params := buildXunhuPayParams(setting.XunhuAppId, tradeNo, title, plan.PriceAmount, notifyUrl, returnUrl, "")
	params["hash"] = generateXunhuHash(params, setting.XunhuAppSecret)

	payResp, raw, err := callXunhuPayWithRetry(params)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("虎皮椒 订阅拉起支付失败 user_id=%d trade_no=%s error=%q raw=%q", userId, tradeNo, err.Error(), string(raw)))
		_ = model.ExpireSubscriptionOrder(tradeNo, model.PaymentProviderXunhu)
		common.ApiErrorMsg(c, "拉起支付失败")
		return
	}
	if payResp.Errcode != 0 {
		logger.LogWarn(ctx, fmt.Sprintf("虎皮椒 订阅下单业务失败 user_id=%d trade_no=%s errcode=%d errmsg=%q raw=%q", userId, tradeNo, payResp.Errcode, payResp.Errmsg, string(raw)))
		_ = model.ExpireSubscriptionOrder(tradeNo, model.PaymentProviderXunhu)
		msg := payResp.Errmsg
		if msg == "" {
			msg = "拉起支付失败"
		}
		common.ApiErrorMsg(c, msg)
		return
	}

	logger.LogInfo(ctx, fmt.Sprintf("虎皮椒 订阅订单创建成功 user_id=%d trade_no=%s plan_id=%d money=%.2f order_id=%s", userId, tradeNo, plan.Id, plan.PriceAmount, payResp.orderIdString()))

	isMobile := isXunhuMobileUA(c.Request.UserAgent())
	respData := gin.H{
		"trade_no":       tradeNo,
		"amount":         plan.PriceAmount,
		"plan_id":        plan.Id,
		"order_id":       payResp.orderIdString(),
		"expire_seconds": setting.XunhuOrderExpire,
	}
	if isMobile && payResp.Url != "" {
		respData["type"] = "redirect"
		respData["url"] = payResp.Url
	} else if payResp.UrlQrcode != "" {
		respData["type"] = "qrcode"
		respData["qrcode_url"] = payResp.UrlQrcode
		if payResp.Url != "" {
			respData["url"] = payResp.Url
		}
	} else if payResp.Url != "" {
		respData["type"] = "redirect"
		respData["url"] = payResp.Url
	} else {
		logger.LogWarn(ctx, fmt.Sprintf("虎皮椒 订阅下单成功但无支付链接 user_id=%d trade_no=%s raw=%q", userId, tradeNo, string(raw)))
		common.ApiErrorMsg(c, "拉起支付失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": respData})
}

func SubscriptionXunhuNotify(c *gin.Context) {
	ctx := c.Request.Context()
	if !isXunhuWebhookEnabled() {
		logger.LogWarn(ctx, fmt.Sprintf("虎皮椒 订阅 webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	if err := c.Request.ParseForm(); err != nil {
		logger.LogError(ctx, fmt.Sprintf("虎皮椒 订阅 webhook 表单解析失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	params := make(map[string]string)
	for k := range c.Request.PostForm {
		params[k] = c.Request.PostForm.Get(k)
	}
	logger.LogInfo(ctx, fmt.Sprintf("虎皮椒 订阅 webhook 收到请求 path=%q client_ip=%s params=%q", c.Request.RequestURI, c.ClientIP(), common.GetJsonString(params)))

	if len(params) == 0 {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	if !setting.XunhuTestMode && !verifyXunhuHash(params, setting.XunhuAppSecret) {
		logger.LogWarn(ctx, fmt.Sprintf("虎皮椒 订阅 webhook 验签失败 path=%q client_ip=%s params=%q", c.Request.RequestURI, c.ClientIP(), common.GetJsonString(params)))
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	tradeNo := params["trade_order_id"]
	status := params["status"]
	if tradeNo == "" {
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}
	if status != "OD" {
		logger.LogInfo(ctx, fmt.Sprintf("虎皮椒 订阅 webhook 忽略非付款事件 trade_no=%s status=%s", tradeNo, status))
		_, _ = c.Writer.Write([]byte("success"))
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	if err := model.CompleteSubscriptionOrder(tradeNo, common.GetJsonString(params), model.PaymentProviderXunhu, model.PaymentMethodWxpay); err != nil {
		if errors.Is(err, model.ErrSubscriptionOrderNotFound) {
			logger.LogWarn(ctx, fmt.Sprintf("虎皮椒 订阅 webhook 订单不存在 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		} else {
			logger.LogError(ctx, fmt.Sprintf("虎皮椒 订阅完成订单失败 trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), err.Error()))
		}
		_, _ = c.Writer.Write([]byte("fail"))
		return
	}

	logger.LogInfo(ctx, fmt.Sprintf("虎皮椒 订阅订单完成 trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
	_, _ = c.Writer.Write([]byte("success"))
}
