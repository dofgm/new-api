package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

type RedemptionSetting struct {
	// 单账号最大兑换次数，0 = 不限制
	MaxRedemptionsPerUser int `json:"max_redemptions_per_user"`
}

// 默认配置：0 表示不限制
var redemptionSetting = RedemptionSetting{
	MaxRedemptionsPerUser: 0,
}

func init() {
	config.GlobalConfig.Register("redemption_setting", &redemptionSetting)
}

func GetRedemptionSetting() *RedemptionSetting {
	return &redemptionSetting
}
