package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupRedemptionTestUser(t *testing.T) int {
	t.Helper()
	affCode, _ := common.GenerateKey()
	user := &User{
		Username:    "redeemtest",
		DisplayName: "Redeem Test",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Quota:       100000,
		AffCode:     affCode[:16],
	}
	require.NoError(t, DB.Create(user).Error)
	return user.Id
}

func createRedemptionCode(t *testing.T, name string, quota int) string {
	t.Helper()
	key, err := common.GenerateKey()
	require.NoError(t, err)
	r := &Redemption{
		UserId: 1,
		Key:    key,
		Status: common.RedemptionCodeStatusEnabled,
		Name:   name,
		Quota:  quota,
	}
	require.NoError(t, DB.Create(r).Error)
	return key
}

func TestCountSuccessRedemptionsByUser(t *testing.T) {
	truncateTables(t)

	userId := setupRedemptionTestUser(t)

	// Initially should be 0
	count, err := CountSuccessRedemptionsByUser(userId)
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)

	// Add some used redemptions for this user
	for i := 0; i < 3; i++ {
		key, _ := common.GenerateKey()
		r := &Redemption{
			UserId:     1,
			Key:        key,
			Status:     common.RedemptionCodeStatusUsed,
			Name:       "used",
			Quota:      100,
			UsedUserId: userId,
		}
		require.NoError(t, DB.Create(r).Error)
	}

	// Add an unused redemption (should not count)
	unusedKey, _ := common.GenerateKey()
	r := &Redemption{
		UserId: 1,
		Key:    unusedKey,
		Status: common.RedemptionCodeStatusEnabled,
		Name:   "unused",
		Quota:  100,
	}
	require.NoError(t, DB.Create(r).Error)

	count, err = CountSuccessRedemptionsByUser(userId)
	require.NoError(t, err)
	assert.Equal(t, int64(3), count)
}

func TestRedeemWithLimit(t *testing.T) {
	truncateTables(t)

	userId := setupRedemptionTestUser(t)

	// Set limit to 2
	operation_setting.GetRedemptionSetting().MaxRedemptionsPerUser = 2
	t.Cleanup(func() {
		operation_setting.GetRedemptionSetting().MaxRedemptionsPerUser = 0
	})

	// First redemption should succeed
	key1 := createRedemptionCode(t, "code1", 100)
	quota, err := Redeem(key1, userId)
	require.NoError(t, err)
	assert.Equal(t, 100, quota)

	// Second redemption should succeed
	key2 := createRedemptionCode(t, "code2", 200)
	quota, err = Redeem(key2, userId)
	require.NoError(t, err)
	assert.Equal(t, 200, quota)

	// Third redemption should fail with limit exceeded
	key3 := createRedemptionCode(t, "code3", 300)
	_, err = Redeem(key3, userId)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrRedeemLimitExceeded)
}

func TestRedeemWithNoLimit(t *testing.T) {
	truncateTables(t)

	userId := setupRedemptionTestUser(t)

	// Set limit to 0 (unlimited)
	operation_setting.GetRedemptionSetting().MaxRedemptionsPerUser = 0

	// All redemptions should succeed
	for i := 0; i < 5; i++ {
		key := createRedemptionCode(t, "code", 100)
		quota, err := Redeem(key, userId)
		require.NoError(t, err)
		assert.Equal(t, 100, quota)
	}
}

func TestRedeemLimitDoesNotAffectOtherUsers(t *testing.T) {
	truncateTables(t)

	user1 := setupRedemptionTestUser(t)

	// Create second user
	affCode2, _ := common.GenerateKey()
	user2 := &User{
		Username:    "redeemtest2",
		DisplayName: "Redeem Test 2",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Quota:       100000,
		AffCode:     affCode2[:16],
	}
	require.NoError(t, DB.Create(user2).Error)

	// Set limit to 1
	operation_setting.GetRedemptionSetting().MaxRedemptionsPerUser = 1
	t.Cleanup(func() {
		operation_setting.GetRedemptionSetting().MaxRedemptionsPerUser = 0
	})

	// User1 redeems once
	key1 := createRedemptionCode(t, "code1", 100)
	_, err := Redeem(key1, user1)
	require.NoError(t, err)

	// User1 is now at limit
	key2 := createRedemptionCode(t, "code2", 100)
	_, err = Redeem(key2, user1)
	assert.ErrorIs(t, err, ErrRedeemLimitExceeded)

	// User2 should still be able to redeem
	key3 := createRedemptionCode(t, "code3", 100)
	quota, err := Redeem(key3, user2.Id)
	require.NoError(t, err)
	assert.Equal(t, 100, quota)
}
