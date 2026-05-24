// CUSTOM: 管理员订阅延期/期限修改 endpoint（避免改上游 controller/subscription.go）
// 配套：model/subscription_admin_custom.go + router/api-router.go PATCH 路由

package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type adminUpdateSubscriptionEndTimeRequest struct {
	EndTime int64 `json:"end_time"`
}

// AdminUpdateUserSubscriptionEndTime PATCH /api/subscription/admin/user_subscriptions/:id/end_time
// body: { "end_time": <unix_seconds> }
func AdminUpdateUserSubscriptionEndTime(c *gin.Context) {
	subId, _ := strconv.Atoi(c.Param("id"))
	if subId <= 0 {
		common.ApiErrorMsg(c, "无效的订阅ID")
		return
	}
	var req adminUpdateSubscriptionEndTimeRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.EndTime <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.AdminUpdateUserSubscriptionEndTime(subId, req.EndTime); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
