package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// GetBillingHistory 获取充值账单记录，支持 keyword、status、start_time、end_time 筛选
// 普通用户查自己的，管理员查所有
func GetBillingHistory(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	keyword := c.Query("keyword")
	status := c.Query("status")
	startTime, _ := strconv.ParseInt(c.Query("start_time"), 10, 64)
	endTime, _ := strconv.ParseInt(c.Query("end_time"), 10, 64)

	var (
		topups []*model.TopUp
		total  int64
		err    error
	)

	userId := c.GetInt("id")
	role := c.GetInt("role")
	if role >= common.RoleAdminUser {
		topups, total, err = model.GetAllBillingRecords(status, keyword, startTime, endTime, pageInfo)
	} else {
		topups, total, err = model.GetBillingRecords(userId, status, keyword, startTime, endTime, pageInfo)
	}

	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(topups)
	common.ApiSuccess(c, pageInfo)
}
