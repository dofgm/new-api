package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// BillingFilter 管理员账单历史查询条件，零值字段不参与 WHERE。
type BillingFilter struct {
	Status    string // success / pending / failed / expired / "" (全部)
	StartTime int64  // 起始时间（unix 秒），0 = 不限
	EndTime   int64  // 结束时间（unix 秒），0 = 不限
	UserId    int    // 用户 ID，0 = 不限
	Keyword   string // trade_no LIKE 模糊匹配
}

// BillingStats 账单聚合统计。SuccessMoney/SuccessAmount/SuccessCount
// 是在当前 filter + status=success 条件下聚合；TotalCount 是 filter 命中的全状态笔数。
type BillingStats struct {
	SuccessMoney  float64 `json:"success_money"`
	SuccessAmount int64   `json:"success_amount"`
	TotalCount    int64   `json:"total_count"`
	SuccessCount  int64   `json:"success_count"`
}

// 防 DoS：与 model/topup.go 中 searchTopUpCountHardLimit 思路一致。
const adminBillingHistoryCountHardLimit = 100000

// GetAdminBillingHistory 管理员账单历史查询，独立于上游 GetAllTopUps，
// 提供完整的 status / time-range / user-id / keyword 组合 filter，并返回聚合统计。
func GetAdminBillingHistory(filter BillingFilter, pageInfo *common.PageInfo) ([]*TopUp, int64, *BillingStats, error) {
	if pageInfo == nil {
		return nil, 0, nil, errors.New("pageInfo is nil")
	}

	var likePattern string
	if filter.Keyword != "" {
		p, err := sanitizeLikePattern(filter.Keyword)
		if err != nil {
			return nil, 0, nil, err
		}
		likePattern = p
	}

	applyFilter := func(q *gorm.DB) *gorm.DB {
		if filter.UserId > 0 {
			q = q.Where("user_id = ?", filter.UserId)
		}
		if filter.Status != "" {
			q = q.Where("status = ?", filter.Status)
		}
		if filter.StartTime > 0 {
			q = q.Where("create_time >= ?", filter.StartTime)
		}
		if filter.EndTime > 0 {
			q = q.Where("create_time <= ?", filter.EndTime)
		}
		if likePattern != "" {
			q = q.Where("trade_no LIKE ? ESCAPE '!'", likePattern)
		}
		return q
	}

	var total int64
	if err := applyFilter(DB.Model(&TopUp{})).Limit(adminBillingHistoryCountHardLimit).Count(&total).Error; err != nil {
		common.SysError("admin billing count failed: " + err.Error())
		return nil, 0, nil, errors.New("查询账单失败")
	}

	var topups []*TopUp
	if err := applyFilter(DB.Model(&TopUp{})).
		Order("id desc").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&topups).Error; err != nil {
		common.SysError("admin billing find failed: " + err.Error())
		return nil, 0, nil, errors.New("查询账单失败")
	}

	stats := &BillingStats{TotalCount: total}

	// 当用户筛选了非 success 的具体状态时，成功统计为 0（filter 没命中任何 success）
	if filter.Status == "" || filter.Status == common.TopUpStatusSuccess {
		successQuery := applyFilter(DB.Model(&TopUp{}))
		if filter.Status == "" {
			successQuery = successQuery.Where("status = ?", common.TopUpStatusSuccess)
		}
		type aggResult struct {
			Money  float64
			Amount int64
			Cnt    int64
		}
		var agg aggResult
		if err := successQuery.
			Select("COALESCE(SUM(money), 0) AS money, COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS cnt").
			Scan(&agg).Error; err != nil {
			common.SysError("admin billing sum failed: " + err.Error())
			return nil, 0, nil, errors.New("统计账单失败")
		}
		stats.SuccessMoney = agg.Money
		stats.SuccessAmount = agg.Amount
		stats.SuccessCount = agg.Cnt
	}

	return topups, total, stats, nil
}
