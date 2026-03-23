package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// GetBillingHistory 获取充值账单记录，支持 keyword 和 status 筛选
// 普通用户查自己的，管理员查所有
func GetBillingHistory(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	keyword := c.Query("keyword")
	status := c.Query("status")

	var (
		topups []*model.TopUp
		total  int64
		err    error
	)

	userId := c.GetInt("id")
	role := c.GetInt("role")
	if role >= common.RoleAdminUser {
		topups, total, err = model.GetAllBillingRecords(status, keyword, pageInfo)
	} else {
		topups, total, err = model.GetBillingRecords(userId, status, keyword, pageInfo)
	}

	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(topups)
	common.ApiSuccess(c, pageInfo)
}
