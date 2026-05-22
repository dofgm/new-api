import { useCallback, useEffect, useState } from 'react'
import i18next from 'i18next'
import { toast } from 'sonner'
import {
  completeOrder,
  getAdminBillingHistory,
  isApiSuccess,
} from '../api'
import type { BillingFilter, BillingRecord, BillingStats } from '../types'

const EMPTY_STATS: BillingStats = {
  success_money: 0,
  success_amount: 0,
  total_count: 0,
  success_count: 0,
}

export interface UseAdminBillingOptions {
  initialPage?: number
  initialPageSize?: number
}

export function useAdminBilling(options: UseAdminBillingOptions = {}) {
  const { initialPage = 1, initialPageSize = 10 } = options

  const [records, setRecords] = useState<BillingRecord[]>([])
  const [stats, setStats] = useState<BillingStats>(EMPTY_STATS)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [filter, setFilter] = useState<BillingFilter>({})
  const [loading, setLoading] = useState(false)
  const [completing, setCompleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAdminBillingHistory(filter, page, pageSize)
      if (isApiSuccess(res) && res.data) {
        setRecords(res.data.items || [])
        setStats(res.data.stats || EMPTY_STATS)
        setTotal(res.data.total || 0)
      } else {
        toast.error(res.message || i18next.t('Failed to load billing history'))
        setRecords([])
        setStats(EMPTY_STATS)
        setTotal(0)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch admin billing history:', error)
      toast.error(i18next.t('Failed to load billing history'))
      setRecords([])
      setStats(EMPTY_STATS)
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filter, page, pageSize])

  const handleCompleteOrder = useCallback(
    async (tradeNo: string) => {
      setCompleting(true)
      try {
        const res = await completeOrder({ trade_no: tradeNo })
        if (isApiSuccess(res)) {
          toast.success(i18next.t('Order completed successfully'))
          await fetchData()
          return true
        }
        toast.error(res.message || i18next.t('Failed to complete order'))
        return false
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to complete order:', error)
        toast.error(i18next.t('Failed to complete order'))
        return false
      } finally {
        setCompleting(false)
      }
    },
    [fetchData]
  )

  const applyFilter = useCallback((newFilter: BillingFilter) => {
    setFilter(newFilter)
    setPage(1)
  }, [])

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize)
    setPage(1)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    records,
    stats,
    total,
    page,
    pageSize,
    filter,
    loading,
    completing,
    applyFilter,
    handlePageChange,
    handlePageSizeChange,
    handleCompleteOrder,
    refresh: fetchData,
  }
}
