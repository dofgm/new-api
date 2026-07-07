// CUSTOM: AdminUpdateUserSubscriptionEndTime 单测（合并守卫，防止覆写行被误删）

package model

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupAdminSubscriptionTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false

	// Save original DB to restore after test
	origDB := DB
	origLogDB := LOG_DB

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)

	DB = db
	LOG_DB = db

	require.NoError(t, db.AutoMigrate(&UserSubscription{}))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
		DB = origDB
		LOG_DB = origLogDB
	})
	return db
}

func createTestActiveSubscription(t *testing.T, db *gorm.DB, start, end int64) *UserSubscription {
	t.Helper()
	sub := &UserSubscription{
		UserId:    100,
		PlanId:    1,
		StartTime: start,
		EndTime:   end,
		Status:    "active",
		Source:    "order",
	}
	require.NoError(t, db.Create(sub).Error)
	return sub
}

func TestAdminUpdateUserSubscriptionEndTime_HappyPath(t *testing.T) {
	db := setupAdminSubscriptionTestDB(t)
	now := time.Now().Unix()
	sub := createTestActiveSubscription(t, db, now-3600, now+86400)

	newEnd := now + 86400*30
	require.NoError(t, AdminUpdateUserSubscriptionEndTime(sub.Id, newEnd))

	var got UserSubscription
	require.NoError(t, db.Where("id = ?", sub.Id).First(&got).Error)
	require.Equal(t, newEnd, got.EndTime)
	require.Equal(t, "active", got.Status)
}

func TestAdminUpdateUserSubscriptionEndTime_RejectsPastTime(t *testing.T) {
	db := setupAdminSubscriptionTestDB(t)
	now := time.Now().Unix()
	sub := createTestActiveSubscription(t, db, now-3600, now+86400)

	err := AdminUpdateUserSubscriptionEndTime(sub.Id, now-100)
	require.Error(t, err)
	require.Contains(t, err.Error(), "future")
}

func TestAdminUpdateUserSubscriptionEndTime_RejectsExpired(t *testing.T) {
	db := setupAdminSubscriptionTestDB(t)
	now := time.Now().Unix()
	sub := &UserSubscription{
		UserId: 100, PlanId: 1,
		StartTime: now - 86400*30, EndTime: now - 100,
		Status: "expired", Source: "order",
	}
	require.NoError(t, db.Create(sub).Error)

	err := AdminUpdateUserSubscriptionEndTime(sub.Id, now+86400*30)
	require.Error(t, err)
	require.Contains(t, err.Error(), "active")
}

func TestAdminUpdateUserSubscriptionEndTime_RejectsCancelled(t *testing.T) {
	db := setupAdminSubscriptionTestDB(t)
	now := time.Now().Unix()
	sub := &UserSubscription{
		UserId: 100, PlanId: 1,
		StartTime: now - 86400, EndTime: now - 100,
		Status: "cancelled", Source: "order",
	}
	require.NoError(t, db.Create(sub).Error)

	err := AdminUpdateUserSubscriptionEndTime(sub.Id, now+86400*30)
	require.Error(t, err)
	require.Contains(t, err.Error(), "active")
}

func TestAdminUpdateUserSubscriptionEndTime_RejectsBeforeStart(t *testing.T) {
	db := setupAdminSubscriptionTestDB(t)
	now := time.Now().Unix()
	futureStart := now + 86400
	sub := createTestActiveSubscription(t, db, futureStart, futureStart+86400*30)

	err := AdminUpdateUserSubscriptionEndTime(sub.Id, futureStart-100)
	require.Error(t, err)
}

func TestAdminUpdateUserSubscriptionEndTime_RejectsBeyond10YearCap(t *testing.T) {
	db := setupAdminSubscriptionTestDB(t)
	now := time.Now().Unix()
	sub := createTestActiveSubscription(t, db, now-3600, now+86400)

	beyondCap := sub.StartTime + adminExtendMaxFutureSeconds + 86400
	err := AdminUpdateUserSubscriptionEndTime(sub.Id, beyondCap)
	require.Error(t, err)
	require.Contains(t, err.Error(), "10-year")
}

func TestAdminUpdateUserSubscriptionEndTime_RejectsInvalidArgs(t *testing.T) {
	_ = setupAdminSubscriptionTestDB(t)
	require.Error(t, AdminUpdateUserSubscriptionEndTime(0, time.Now().Unix()+86400))
	require.Error(t, AdminUpdateUserSubscriptionEndTime(1, 0))
	require.Error(t, AdminUpdateUserSubscriptionEndTime(1, -1))
}

func TestAdminUpdateUserSubscriptionEndTime_NonExistent(t *testing.T) {
	_ = setupAdminSubscriptionTestDB(t)
	err := AdminUpdateUserSubscriptionEndTime(99999, time.Now().Unix()+86400)
	require.Error(t, err)
}
