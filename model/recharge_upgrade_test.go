package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createUpgradeTestUser(t *testing.T, group string) int {
	t.Helper()
	affCode, _ := common.GenerateKey()
	user := &User{
		Username:    "upgradetest_" + affCode[:8],
		DisplayName: "Upgrade Test",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Quota:       100000,
		Group:       group,
		AffCode:     affCode[:16],
	}
	require.NoError(t, DB.Create(user).Error)
	return user.Id
}

func createTopUpRecord(t *testing.T, userId int, money float64, provider, status string) {
	t.Helper()
	tradeNo, _ := common.GenerateKey()
	r := &TopUp{
		UserId:          userId,
		Amount:          int64(money),
		Money:           money,
		TradeNo:         tradeNo,
		PaymentProvider: provider,
		Status:          status,
		CreateTime:      common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(r).Error)
}

func getUserGroup(t *testing.T, userId int) string {
	t.Helper()
	var user User
	require.NoError(t, DB.Where("id = ?", userId).First(&user).Error)
	return user.Group
}

func setRechargeUpgrade(t *testing.T, enabled bool, threshold float64, target, from string) {
	t.Helper()
	s := operation_setting.GetRechargeUpgradeSetting()
	orig := *s
	s.Enabled = enabled
	s.Threshold = threshold
	s.TargetGroup = target
	s.FromGroup = from
	t.Cleanup(func() {
		*operation_setting.GetRechargeUpgradeSetting() = orig
	})
}

func TestSumUserRechargeMoney(t *testing.T) {
	truncateTables(t)
	userId := createUpgradeTestUser(t, "default")

	// epay + xunhu success should count
	createTopUpRecord(t, userId, 5.0, PaymentProviderEpay, common.TopUpStatusSuccess)
	createTopUpRecord(t, userId, 6.0, PaymentProviderXunhu, common.TopUpStatusSuccess)
	// pending should NOT count
	createTopUpRecord(t, userId, 100.0, PaymentProviderEpay, common.TopUpStatusPending)
	// stripe (USD) should NOT count
	createTopUpRecord(t, userId, 50.0, PaymentProviderStripe, common.TopUpStatusSuccess)

	total, err := SumUserRechargeMoney(userId)
	require.NoError(t, err)
	assert.InDelta(t, 11.0, total, 0.001)
}

func TestUpgradeWhenThresholdReached(t *testing.T) {
	truncateTables(t)
	userId := createUpgradeTestUser(t, "default")
	setRechargeUpgrade(t, true, 10, "vip", "default")

	// Cumulative 11 >= 10 -> should upgrade
	createTopUpRecord(t, userId, 5.0, PaymentProviderEpay, common.TopUpStatusSuccess)
	createTopUpRecord(t, userId, 6.0, PaymentProviderXunhu, common.TopUpStatusSuccess)

	TryUpgradeUserGroupByRecharge(userId)
	assert.Equal(t, "vip", getUserGroup(t, userId))
}

func TestNoUpgradeBelowThreshold(t *testing.T) {
	truncateTables(t)
	userId := createUpgradeTestUser(t, "default")
	setRechargeUpgrade(t, true, 10, "vip", "default")

	// Cumulative 8 < 10 -> should NOT upgrade
	createTopUpRecord(t, userId, 8.0, PaymentProviderEpay, common.TopUpStatusSuccess)

	TryUpgradeUserGroupByRecharge(userId)
	assert.Equal(t, "default", getUserGroup(t, userId))
}

func TestNoUpgradeWhenDisabled(t *testing.T) {
	truncateTables(t)
	userId := createUpgradeTestUser(t, "default")
	setRechargeUpgrade(t, false, 10, "vip", "default")

	createTopUpRecord(t, userId, 100.0, PaymentProviderEpay, common.TopUpStatusSuccess)

	TryUpgradeUserGroupByRecharge(userId)
	assert.Equal(t, "default", getUserGroup(t, userId))
}

func TestNoUpgradeWhenTargetGroupEmpty(t *testing.T) {
	truncateTables(t)
	userId := createUpgradeTestUser(t, "default")
	setRechargeUpgrade(t, true, 10, "", "default")

	createTopUpRecord(t, userId, 100.0, PaymentProviderEpay, common.TopUpStatusSuccess)

	TryUpgradeUserGroupByRecharge(userId)
	assert.Equal(t, "default", getUserGroup(t, userId))
}

func TestNoUpgradeForNonFromGroupUser(t *testing.T) {
	truncateTables(t)
	// User already in "premium" group, fromGroup is "default" -> must not be touched
	userId := createUpgradeTestUser(t, "premium")
	setRechargeUpgrade(t, true, 10, "vip", "default")

	createTopUpRecord(t, userId, 100.0, PaymentProviderEpay, common.TopUpStatusSuccess)

	TryUpgradeUserGroupByRecharge(userId)
	assert.Equal(t, "premium", getUserGroup(t, userId))
}

func TestUpgradeOnlyCountsWhitelistProviders(t *testing.T) {
	truncateTables(t)
	userId := createUpgradeTestUser(t, "default")
	setRechargeUpgrade(t, true, 10, "vip", "default")

	// Only stripe (USD) recharge, 50 -> not in whitelist, cumulative RMB = 0
	createTopUpRecord(t, userId, 50.0, PaymentProviderStripe, common.TopUpStatusSuccess)

	TryUpgradeUserGroupByRecharge(userId)
	assert.Equal(t, "default", getUserGroup(t, userId))
}

func TestUpgradeIsIdempotent(t *testing.T) {
	truncateTables(t)
	userId := createUpgradeTestUser(t, "default")
	setRechargeUpgrade(t, true, 10, "vip", "default")

	createTopUpRecord(t, userId, 20.0, PaymentProviderEpay, common.TopUpStatusSuccess)

	// First call upgrades
	TryUpgradeUserGroupByRecharge(userId)
	assert.Equal(t, "vip", getUserGroup(t, userId))

	// Manually move user to a different group to verify second call won't re-upgrade
	require.NoError(t, DB.Model(&User{}).Where("id = ?", userId).Update("group", "vip").Error)
	// Second call: user is no longer in "default", so no change
	TryUpgradeUserGroupByRecharge(userId)
	assert.Equal(t, "vip", getUserGroup(t, userId))
}
