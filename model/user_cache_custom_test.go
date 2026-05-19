package model

import "testing"

// TestUserBaseGetSettingForcesRecordIpLog 防止合并上游时
// UserBase.GetSetting 里的 CUSTOM 行被误删。
//
// 业务规则：record_ip_log 在我们的部署里强制开启，用户无法关闭。
// 实现方式：UserBase.GetSetting 反序列化后强制覆写为 true。
// 单测保证：无论 DB 里存的是什么，读出来一定是 true。
func TestUserBaseGetSettingForcesRecordIpLog(t *testing.T) {
	cases := []struct {
		name    string
		setting string
	}{
		{"empty setting (new user)", ""},
		{"empty JSON object", `{}`},
		{"user explicitly false", `{"record_ip_log":false}`},
		{"user explicitly true", `{"record_ip_log":true}`},
		{"setting without record_ip_log key", `{"language":"zh"}`},
		{"malformed JSON falls through to defaults", `{not json`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ub := &UserBase{Setting: tc.setting}
			got := ub.GetSetting()
			if !got.RecordIpLog {
				t.Errorf("expected RecordIpLog=true for setting=%q, got false", tc.setting)
			}
		})
	}
}
