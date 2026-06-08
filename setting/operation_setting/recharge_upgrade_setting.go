package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// RechargeUpgradeSetting 充值累计自动升级分组配置。
// 当用户累计实付金额(money)达到阈值时,自动将其从来源分组升级到目标分组。
// 仅"只升不降",且只升级 from_group 中的用户,避免误降已是高级分组的用户。
type RechargeUpgradeSetting struct {
	// Enabled 是否启用充值累计自动升级
	Enabled bool `json:"enabled"`
	// Threshold 累计实付金额阈值(与充值展示币种一致,目前为人民币元)
	Threshold float64 `json:"threshold"`
	// TargetGroup 达标后升级到的目标分组
	TargetGroup string `json:"target_group"`
	// FromGroup 仅升级当前处于该分组的用户(防止误降),默认 default
	FromGroup string `json:"from_group"`
}

// 默认配置:关闭,阈值 10 元,从 default 升级。目标分组留空(必须后台填写)。
var rechargeUpgradeSetting = RechargeUpgradeSetting{
	Enabled:     false,
	Threshold:   10,
	TargetGroup: "",
	FromGroup:   "default",
}

func init() {
	config.GlobalConfig.Register("recharge_upgrade_setting", &rechargeUpgradeSetting)
}

func GetRechargeUpgradeSetting() *RechargeUpgradeSetting {
	return &rechargeUpgradeSetting
}
