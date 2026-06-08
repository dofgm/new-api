package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func createTestPlan(t *testing.T, upgradeGroup string, totalAmount int64) int {
	t.Helper()
	plan := &SubscriptionPlan{
		Title:         "Test Plan " + upgradeGroup,
		PriceAmount:   9.9,
		Currency:      "CNY",
		DurationUnit:  "day",
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   totalAmount,
		UpgradeGroup:  upgradeGroup,
	}
	require.NoError(t, DB.Create(plan).Error)
	return plan.Id
}

func createTestSubscription(t *testing.T, userId, planId int, upgradeGroup string, amountTotal, amountUsed int64) int {
	t.Helper()
	now := common.GetTimestamp()
	sub := &UserSubscription{
		UserId:       userId,
		PlanId:       planId,
		AmountTotal:  amountTotal,
		AmountUsed:   amountUsed,
		StartTime:    now - 3600,
		EndTime:      now + 86400, // expires tomorrow
		Status:       "active",
		Source:       "admin",
		UpgradeGroup: upgradeGroup,
	}
	require.NoError(t, DB.Create(sub).Error)
	return sub.Id
}

// ---------------------------------------------------------------------------
// Test: PreConsumeUserSubscription with usingGroup filtering
// ---------------------------------------------------------------------------

func TestPreConsumeUserSubscription_GroupMatch(t *testing.T) {
	truncateTables(t)

	userId := createUpgradeTestUser(t, "GPT_Month")
	planId := createTestPlan(t, "GPT_Month", 100000)
	createTestSubscription(t, userId, planId, "GPT_Month", 100000, 0)

	// Using GPT_Month key → should match the subscription
	res, err := PreConsumeUserSubscription("req-match-1", userId, "gpt-4o", 0, 100, "GPT_Month")
	require.NoError(t, err)
	assert.Equal(t, int64(100), res.PreConsumed)
	assert.Equal(t, int64(100000), res.AmountTotal)
	assert.Equal(t, int64(0), res.AmountUsedBefore)
	assert.Equal(t, int64(100), res.AmountUsedAfter)
}

func TestPreConsumeUserSubscription_GroupMismatch(t *testing.T) {
	truncateTables(t)

	userId := createUpgradeTestUser(t, "GPT_Month")
	planId := createTestPlan(t, "GPT_Month", 100000)
	createTestSubscription(t, userId, planId, "GPT_Month", 100000, 0)

	// Using Claude_Aws key → should NOT match GPT_Month subscription
	res, err := PreConsumeUserSubscription("req-mismatch-1", userId, "claude-3", 0, 100, "Claude_Aws")
	assert.Error(t, err)
	assert.Nil(t, res)
	assert.Contains(t, err.Error(), "no active subscription")
}

func TestPreConsumeUserSubscription_MultipleSubscriptions(t *testing.T) {
	truncateTables(t)

	userId := createUpgradeTestUser(t, "GPT_Month")
	gptPlanId := createTestPlan(t, "GPT_Month", 50000)
	claudePlanId := createTestPlan(t, "Claude_Aws", 80000)
	createTestSubscription(t, userId, gptPlanId, "GPT_Month", 50000, 0)
	createTestSubscription(t, userId, claudePlanId, "Claude_Aws", 80000, 0)

	// GPT key → matches GPT subscription
	res1, err := PreConsumeUserSubscription("req-multi-gpt", userId, "gpt-4o", 0, 200, "GPT_Month")
	require.NoError(t, err)
	assert.Equal(t, int64(200), res1.PreConsumed)
	assert.Equal(t, int64(50000), res1.AmountTotal)

	// Claude key → matches Claude subscription
	res2, err := PreConsumeUserSubscription("req-multi-claude", userId, "claude-3", 0, 300, "Claude_Aws")
	require.NoError(t, err)
	assert.Equal(t, int64(300), res2.PreConsumed)
	assert.Equal(t, int64(80000), res2.AmountTotal)
}

func TestPreConsumeUserSubscription_InsufficientQuota(t *testing.T) {
	truncateTables(t)

	userId := createUpgradeTestUser(t, "GPT_Month")
	planId := createTestPlan(t, "GPT_Month", 1000)
	createTestSubscription(t, userId, planId, "GPT_Month", 1000, 900)

	// Remaining = 100, requesting 200 → insufficient
	res, err := PreConsumeUserSubscription("req-insuf-1", userId, "gpt-4o", 0, 200, "GPT_Month")
	assert.Error(t, err)
	assert.Nil(t, res)
	assert.Contains(t, err.Error(), "insufficient")
}

func TestPreConsumeUserSubscription_NoSubscription(t *testing.T) {
	truncateTables(t)

	userId := createUpgradeTestUser(t, "default")

	// No subscription at all → should fail
	res, err := PreConsumeUserSubscription("req-nosub-1", userId, "gpt-4o", 0, 100, "GPT_Month")
	assert.Error(t, err)
	assert.Nil(t, res)
	assert.Contains(t, err.Error(), "no active subscription")
}

func TestPreConsumeUserSubscription_EmptyGroupFallback(t *testing.T) {
	truncateTables(t)

	userId := createUpgradeTestUser(t, "default")
	planId := createTestPlan(t, "GPT_Month", 100000)
	createTestSubscription(t, userId, planId, "GPT_Month", 100000, 0)

	// Empty usingGroup → no filtering, matches any subscription (backward compat)
	res, err := PreConsumeUserSubscription("req-empty-group", userId, "gpt-4o", 0, 100, "")
	require.NoError(t, err)
	assert.Equal(t, int64(100), res.PreConsumed)
}

func TestPreConsumeUserSubscription_UpgradeGroupEmpty(t *testing.T) {
	truncateTables(t)

	userId := createUpgradeTestUser(t, "default")
	// Old subscription without upgrade_group set
	planId := createTestPlan(t, "", 100000)
	createTestSubscription(t, userId, planId, "", 100000, 0)

	// UsingGroup = "GPT_Month" → won't match subscription with empty upgrade_group
	res, err := PreConsumeUserSubscription("req-old-sub", userId, "gpt-4o", 0, 100, "GPT_Month")
	assert.Error(t, err)
	assert.Nil(t, res)
	assert.Contains(t, err.Error(), "no active subscription")
}

func TestPreConsumeUserSubscription_Idempotent(t *testing.T) {
	truncateTables(t)

	userId := createUpgradeTestUser(t, "GPT_Month")
	planId := createTestPlan(t, "GPT_Month", 100000)
	createTestSubscription(t, userId, planId, "GPT_Month", 100000, 0)

	// First call
	res1, err := PreConsumeUserSubscription("req-idem-1", userId, "gpt-4o", 0, 500, "GPT_Month")
	require.NoError(t, err)
	assert.Equal(t, int64(500), res1.PreConsumed)

	// Same requestId → should be idempotent, return same result without double-charging
	res2, err := PreConsumeUserSubscription("req-idem-1", userId, "gpt-4o", 0, 500, "GPT_Month")
	require.NoError(t, err)
	assert.Equal(t, int64(500), res2.PreConsumed)
	assert.Equal(t, res1.UserSubscriptionId, res2.UserSubscriptionId)
}

func TestHasActiveUserSubscription_Unaffected(t *testing.T) {
	truncateTables(t)

	userId := createUpgradeTestUser(t, "GPT_Month")
	planId := createTestPlan(t, "GPT_Month", 100000)
	createTestSubscription(t, userId, planId, "GPT_Month", 100000, 0)

	// HasActiveUserSubscription (no group filter) should still work
	has, err := HasActiveUserSubscription(userId)
	require.NoError(t, err)
	assert.True(t, has)

	// Even if using a non-matching group, the user still "has" a subscription
	// (the group filtering only happens at PreConsume level)
	has2, err := HasActiveUserSubscription(userId)
	require.NoError(t, err)
	assert.True(t, has2)
}

func TestPreConsumeUserSubscription_FallbackToWalletScenario(t *testing.T) {
	truncateTables(t)

	userId := createUpgradeTestUser(t, "GPT_Month")
	planId := createTestPlan(t, "GPT_Month", 100000)
	createTestSubscription(t, userId, planId, "GPT_Month", 100000, 0)

	// Simulate: user uses Claude_Aws key → PreConsume fails → caller should fallback to wallet
	_, err := PreConsumeUserSubscription(
		fmt.Sprintf("req-fallback-%d", common.GetTimestamp()),
		userId, "claude-3", 0, 100, "Claude_Aws",
	)
	// This error is what billing_session.go catches to trigger tryWallet()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no active subscription")
}
