// CUSTOM: admin 订阅期限修改 API（避免改上游 api.ts）
// 配套：components/dialogs/extend-end-time-dialog.tsx

import { api } from '@/lib/api'
import type { ApiResponse } from './types'

export async function updateUserSubscriptionEndTime(
  subId: number,
  endTime: number
): Promise<ApiResponse<unknown>> {
  const res = await api.patch(
    `/api/subscription/admin/user_subscriptions/${subId}/end_time`,
    { end_time: endTime }
  )
  return res.data
}
