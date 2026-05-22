import { api } from '@/lib/api'
import type {
  ApiResponse,
  BillingFilter,
  BillingListResponse,
  CompleteOrderRequest,
} from './types'

export function isApiSuccess(response: ApiResponse): boolean {
  return response.success === true || response.message === 'success'
}

export async function getAdminBillingHistory(
  filter: BillingFilter,
  page: number,
  pageSize: number
): Promise<ApiResponse<BillingListResponse>> {
  const params = new URLSearchParams({
    p: String(page),
    page_size: String(pageSize),
  })
  if (filter.status) params.append('status', filter.status)
  if (filter.start_time) params.append('start_time', String(filter.start_time))
  if (filter.end_time) params.append('end_time', String(filter.end_time))
  if (filter.user_id) params.append('user_id', String(filter.user_id))
  if (filter.keyword) params.append('keyword', filter.keyword)
  const res = await api.get(`/api/billing-history/?${params.toString()}`)
  return res.data
}

// Reuse upstream POST /api/user/topup/complete to avoid duplicating the
// admin manual-complete endpoint. If upstream changes its path one day we
// only need to patch one line here.
export async function completeOrder(
  req: CompleteOrderRequest
): Promise<ApiResponse> {
  const res = await api.post('/api/user/topup/complete', req)
  return res.data
}
