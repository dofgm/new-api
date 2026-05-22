import { useState } from 'react'
import {
  type ColumnDef,
  type PaginationState,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DataTablePage } from '@/components/data-table'
import { useBillingColumns } from './billing-columns'
import type { BillingRecord } from '../types'

interface BillingTableProps {
  records: BillingRecord[]
  loading: boolean
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onCompleteOrder: (tradeNo: string) => Promise<boolean>
  completing: boolean
}

export function BillingTable({
  records,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  onCompleteOrder,
  completing,
}: BillingTableProps) {
  const { t } = useTranslation()
  const [confirmTradeNo, setConfirmTradeNo] = useState<string | null>(null)

  const columns = useBillingColumns({
    onRequestComplete: (tradeNo) => setConfirmTradeNo(tradeNo),
    completing,
  })

  const pagination: PaginationState = {
    pageIndex: page - 1,
    pageSize,
  }

  const table = useReactTable({
    data: records,
    columns,
    state: { pagination },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(pagination) : updater
      if (next.pageIndex !== pagination.pageIndex) {
        onPageChange(next.pageIndex + 1)
      }
      if (next.pageSize !== pagination.pageSize) {
        onPageSizeChange(next.pageSize)
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    enableRowSelection: false,
  })

  const handleConfirm = async () => {
    if (!confirmTradeNo) return
    const ok = await onCompleteOrder(confirmTradeNo)
    if (ok) setConfirmTradeNo(null)
  }

  return (
    <>
      <DataTablePage
        table={table}
        columns={columns as ColumnDef<BillingRecord>[]}
        isLoading={loading}
        emptyTitle={t('No billing records found')}
        emptyDescription={t('Try adjusting your filters')}
        toolbarProps={null}
        skeletonKeyPrefix='admin-billing-skeleton'
      />

      <AlertDialog
        open={!!confirmTradeNo}
        onOpenChange={(open) => !open && setConfirmTradeNo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Complete Order')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Are you sure you want to manually complete this order? The user will be credited with the corresponding quota.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completing}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={completing}>
              {completing ? (
                <span className='flex items-center'>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  {t('Processing...')}
                </span>
              ) : (
                t('Confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
