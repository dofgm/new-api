package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// AdminListBillingHistory 管理员账单历史查询。
// GET /api/billing-history?status=&start_time=&end_time=&user_id=&keyword=&p=&page_size=
//
// 与上游 GetAllTopUps 独立：上游接口只支持 keyword 模糊，本接口为 admin 视图
// 提供完整的 status / time-range / user-id / keyword 组合 filter + 聚合统计。
func AdminListBillingHistory(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)

	filter := model.BillingFilter{
		Status:  c.Query("status"),
		Keyword: c.Query("keyword"),
	}
	if v := c.Query("user_id"); v != "" {
		if id, err := strconv.Atoi(v); err == nil && id > 0 {
			filter.UserId = id
		}
	}
	if v := c.Query("start_time"); v != "" {
		if t, err := strconv.ParseInt(v, 10, 64); err == nil && t > 0 {
			filter.StartTime = t
		}
	}
	if v := c.Query("end_time"); v != "" {
		if t, err := strconv.ParseInt(v, 10, 64); err == nil && t > 0 {
			filter.EndTime = t
		}
	}

	topups, total, stats, err := model.GetAdminBillingHistory(filter, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, gin.H{
		"items":     topups,
		"total":     total,
		"page":      pageInfo.GetPage(),
		"page_size": pageInfo.GetPageSize(),
		"stats":     stats,
	})
}
