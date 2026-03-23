package model

import "github.com/QuantumNous/new-api/common"

// BillingStats 账单统计数据
type BillingStats struct {
	TotalMoney   float64 `json:"total_money"`   // 充值总额（成功）
	TotalCount   int64   `json:"total_count"`   // 充值次数（成功）
	TotalAmount  int64   `json:"total_amount"`  // 充值额度总和（成功）
	TodayMoney   float64 `json:"today_money"`   // 今日充值额（成功）
}

// buildBillingQuery 构建账单查询条件
func buildBillingQuery(query interface{ Where(query interface{}, args ...interface{}) interface{ Where(query interface{}, args ...interface{}) interface{} } }, status string, keyword string, startTime int64, endTime int64) {
}

// GetBillingRecords 获取用户的账单记录（支持状态筛选、关键词搜索和时间范围）
func GetBillingRecords(userId int, status string, keyword string, startTime int64, endTime int64, pageInfo *common.PageInfo) (topups []*TopUp, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&TopUp{}).Where("user_id = ?", userId)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if keyword != "" {
		query = query.Where("trade_no LIKE ?", "%"+keyword+"%")
	}
	if startTime > 0 {
		query = query.Where("create_time >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("create_time <= ?", endTime)
	}

	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return topups, total, nil
}

// GetAllBillingRecords 管理员获取全平台账单记录（支持状态筛选、关键词搜索和时间范围）
func GetAllBillingRecords(status string, keyword string, startTime int64, endTime int64, pageInfo *common.PageInfo) (topups []*TopUp, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&TopUp{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if keyword != "" {
		query = query.Where("trade_no LIKE ?", "%"+keyword+"%")
	}
	if startTime > 0 {
		query = query.Where("create_time >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("create_time <= ?", endTime)
	}

	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return topups, total, nil
}

// GetBillingStats 获取用户的账单统计（只统计 success 状态）
func GetBillingStats(userId int, startTime int64, endTime int64) (*BillingStats, error) {
	stats := &BillingStats{}

	query := DB.Model(&TopUp{}).Where("user_id = ? AND status = ?", userId, common.TopUpStatusSuccess)
	if startTime > 0 {
		query = query.Where("create_time >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("create_time <= ?", endTime)
	}

	// 充值总额、次数、额度
	var result struct {
		TotalMoney  float64
		TotalCount  int64
		TotalAmount int64
	}
	err := query.Select("COALESCE(SUM(money), 0) as total_money, COUNT(*) as total_count, COALESCE(SUM(amount), 0) as total_amount").Scan(&result).Error
	if err != nil {
		return nil, err
	}
	stats.TotalMoney = result.TotalMoney
	stats.TotalCount = result.TotalCount
	stats.TotalAmount = result.TotalAmount

	// 今日充值额
	now := common.GetTimestamp()
	todayStart := now - (now % 86400) // 当天 00:00:00 UTC
	var todayMoney float64
	err = DB.Model(&TopUp{}).Where("user_id = ? AND status = ? AND create_time >= ?", userId, common.TopUpStatusSuccess, todayStart).
		Select("COALESCE(SUM(money), 0)").Scan(&todayMoney).Error
	if err != nil {
		return nil, err
	}
	stats.TodayMoney = todayMoney

	return stats, nil
}

// GetAllBillingStats 管理员获取全平台账单统计（只统计 success 状态）
func GetAllBillingStats(startTime int64, endTime int64) (*BillingStats, error) {
	stats := &BillingStats{}

	query := DB.Model(&TopUp{}).Where("status = ?", common.TopUpStatusSuccess)
	if startTime > 0 {
		query = query.Where("create_time >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("create_time <= ?", endTime)
	}

	var result struct {
		TotalMoney  float64
		TotalCount  int64
		TotalAmount int64
	}
	err := query.Select("COALESCE(SUM(money), 0) as total_money, COUNT(*) as total_count, COALESCE(SUM(amount), 0) as total_amount").Scan(&result).Error
	if err != nil {
		return nil, err
	}
	stats.TotalMoney = result.TotalMoney
	stats.TotalCount = result.TotalCount
	stats.TotalAmount = result.TotalAmount

	now := common.GetTimestamp()
	todayStart := now - (now % 86400)
	var todayMoney float64
	err = DB.Model(&TopUp{}).Where("status = ? AND create_time >= ?", common.TopUpStatusSuccess, todayStart).
		Select("COALESCE(SUM(money), 0)").Scan(&todayMoney).Error
	if err != nil {
		return nil, err
	}
	stats.TodayMoney = todayMoney

	return stats, nil
}
