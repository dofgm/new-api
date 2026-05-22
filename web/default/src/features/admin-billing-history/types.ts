// ============================================================================
// Admin Billing History Type Definitions
// Decoupled from wallet/types.ts on purpose: this is a custom admin-only view
// and should not depend on upstream types that may change.
// ============================================================================

export type BillingStatus = 'success' | 'pending' | 'failed' | 'expired'

export interface BillingRecord {
  id: number
  user_id: number
  amount: number
  money: number
  trade_no: string
  payment_method: string
  payment_provider?: string
  create_time: number
  complete_time?: number
  status: BillingStatus
}

export interface BillingStats {
  success_money: number
  success_amount: number
  total_count: number
  success_count: number
}

export interface BillingFilter {
  status?: BillingStatus | ''
  start_time?: number
  end_time?: number
  user_id?: number
  keyword?: string
}

export interface BillingListResponse {
  items: BillingRecord[]
  total: number
  page: number
  page_size: number
  stats: BillingStats
}

export interface ApiResponse<T = unknown> {
  success?: boolean
  message?: string
  data?: T
}

export interface CompleteOrderRequest {
  trade_no: string
}
