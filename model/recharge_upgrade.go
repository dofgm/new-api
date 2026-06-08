package model

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// rechargeUpgradeProviders 计入累计升级判定的支付网关白名单。
// 仅这两个网关以人民币(money 字段)结算,币种统一,累计求和才有意义。
// Stripe/Creem/Waffo 等以美元结算的网关被排除,避免混币种污染累计值。
// 注意:易支付(epay)未来即便接入微信,provider 仍是 epay、币种仍是人民币,
// 因此无需修改此白名单。
var rechargeUpgradeProviders = []string{
	PaymentProviderEpay,
	PaymentProviderXunhu,
}

// SumUserRechargeMoney 统计用户在白名单支付网关下、成功订单的累计实付金额(money)之和。
// 用于充值累计自动升级分组的阈值判定。订阅购买走 subscription_orders 表,天然不计入。
func SumUserRechargeMoney(userId int) (float64, error) {
	var total float64
	err := DB.Model(&TopUp{}).
		Where("user_id = ? AND status = ? AND payment_provider IN ?",
			userId, common.TopUpStatusSuccess, rechargeUpgradeProviders).
		Select("COALESCE(SUM(money), 0)").
		Scan(&total).Error
	return total, err
}

// TryUpgradeUserGroupByRecharge 在一次充值成功后尝试按累计实付金额升级用户分组。
//
// 规则(见 MEMBERSHIP_BILLING_PLAN.md 模块 A):
//   - 仅在功能开启且目标分组已配置时生效;
//   - 累计实付金额(白名单网关 money 之和) >= 阈值才升级;
//   - 仅升级当前处于 FromGroup(默认 default) 的用户,防止误降高级用户;
//   - 只升不降:目标分组与来源分组不同才执行。
//
// 该函数对升级失败保持"软失败":仅记录日志,不影响充值主流程(额度已到账)。
// userId 必须是已成功充值的用户。
func TryUpgradeUserGroupByRecharge(userId int) {
	setting := operation_setting.GetRechargeUpgradeSetting()
	if !setting.Enabled {
		return
	}
	targetGroup := strings.TrimSpace(setting.TargetGroup)
	fromGroup := strings.TrimSpace(setting.FromGroup)
	if targetGroup == "" {
		// 未配置目标分组,视为未启用,避免把用户升到空分组
		return
	}
	if fromGroup == "" {
		fromGroup = "default"
	}
	if targetGroup == fromGroup {
		// 目标与来源相同,无意义
		return
	}

	total, err := SumUserRechargeMoney(userId)
	if err != nil {
		common.SysError("recharge upgrade: failed to sum user recharge money: " + err.Error())
		return
	}
	if total < setting.Threshold {
		return
	}

	// 仅当用户当前正处于 fromGroup 时才升级(条件更新,天然防并发误降)。
	// 用一条带 group 条件的 UPDATE 保证幂等:已经升过组的用户不会被重复处理。
	// WHERE 子句用 commonGroupCol(已含数据库专属引号);Update 列名用裸 "group",
	// 由 GORM 负责按数据库方言加引号(与 subscription.go 的升降组写法一致)。
	result := DB.Model(&User{}).
		Where("id = ? AND "+commonGroupCol+" = ?", userId, fromGroup).
		Update("group", targetGroup)
	if result.Error != nil {
		common.SysError("recharge upgrade: failed to update user group: " + result.Error.Error())
		return
	}
	if result.RowsAffected == 0 {
		// 用户不在 fromGroup(可能已被升过、或本就是别的组),不处理
		return
	}

	// 同步缓存,避免旧分组残留
	if err := UpdateUserGroupCache(userId, targetGroup); err != nil {
		common.SysError("recharge upgrade: failed to update user group cache: " + err.Error())
	}
	common.SysLog(fmt.Sprintf(
		"recharge upgrade: user %d upgraded from %s to %s (cumulative recharge %.2f >= threshold %.2f)",
		userId, fromGroup, targetGroup, total, setting.Threshold))
}
