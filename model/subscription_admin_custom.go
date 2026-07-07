// CUSTOM: 管理员订阅延期/期限修改（避免改上游 model/subscription.go）
// 配套：controller/admin_subscription_custom.go + router/api-router.go PATCH 路由

package model

import (
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const adminExtendMaxFutureSeconds = 10 * 365 * 24 * 3600

// AdminUpdateUserSubscriptionEndTime 修改某条 active 用户订阅的 end_time。
// 仅 active 可改；新时间必须 > now 且 > start_time；上限 start+10y。
// 不动 next_reset_time / amount_total / upgrade_group。
func AdminUpdateUserSubscriptionEndTime(subId int, newEndTime int64) error {
	if subId <= 0 {
		return errors.New("invalid subscription id")
	}
	if newEndTime <= 0 {
		return errors.New("invalid end_time")
	}
	now := GetDBTimestamp()
	if newEndTime <= now {
		return errors.New("end_time must be in the future; use invalidate to expire immediately")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var sub UserSubscription
		if err := lockForUpdate(tx).
			Where("id = ?", subId).First(&sub).Error; err != nil {
			return err
		}
		if sub.Status != "active" {
			return errors.New("only active subscriptions can be modified")
		}
		if newEndTime <= sub.StartTime {
			return errors.New("end_time must be after start_time")
		}
		if newEndTime > sub.StartTime+adminExtendMaxFutureSeconds {
			return errors.New("end_time exceeds 10-year safety cap")
		}
		old := sub.EndTime
		if err := tx.Model(&sub).Updates(map[string]interface{}{
			"end_time":   newEndTime,
			"updated_at": common.GetTimestamp(),
		}).Error; err != nil {
			return err
		}
		common.SysLog(fmt.Sprintf(
			"admin updated subscription end_time: sub_id=%d user_id=%d %s -> %s",
			sub.Id, sub.UserId,
			time.Unix(old, 0).Format(time.RFC3339),
			time.Unix(newEndTime, 0).Format(time.RFC3339),
		))
		return nil
	})
}
