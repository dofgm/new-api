import { useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from '@/lib/dayjs'
import { formatNumber } from '@/lib/format'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
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
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import type { BillingRecord, BillingStatus } from '../types'

const STATUS_STYLES: Record<
  BillingStatus,
  {
    variant: 'success' | 'warning' | 'danger' | 'neutral'
    labelKey: string
  }
> = {
  success: { variant: 'success', labelKey: 'Success' },
  pending: { variant: 'warning', labelKey: 'Pending' },
  failed: { variant: 'danger', labelKey: 'Failed' },
  expired: { variant: 'neutral', labelKey: 'Expired' },
}

const PAYMENT_NAMES: Record<string, string> = {
  stripe: 'Stripe',
  alipay: 'Alipay',
  wxpay: 'WeChat Pay',
  waffo: 'Waffo',
  waffo_pancake: 'Waffo Pancake',
}

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
  const { copyToClipboard, copiedText } = useCopyToClipboard({ notify: false })

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleConfirm = async () => {
    if (!confirmTradeNo) return
    const ok = await onCompleteOrder(confirmTradeNo)
    if (ok) setConfirmTradeNo(null)
  }

  return (
    <>
      <div className='space-y-3'>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className='rounded-lg border p-3 sm:p-4'>
              <Skeleton className='h-5 w-48' />
              <Skeleton className='mt-2 h-4 w-32' />
              <div className='mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4'>
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className='h-4 w-full' />
                ))}
              </div>
            </div>
          ))
        ) : records.length === 0 ? (
          <div className='text-muted-foreground flex h-[320px] flex-col items-center justify-center text-center'>
            <p className='text-sm font-medium'>
              {t('No billing records found')}
            </p>
            <p className='mt-1 text-xs'>{t('Try adjusting your filters')}</p>
          </div>
        ) : (
          records.map((record) => {
            const statusCfg =
              STATUS_STYLES[record.status] || STATUS_STYLES.pending
            const paymentName =
              PAYMENT_NAMES[record.payment_method] || record.payment_method
            return (
              <div
                key={record.id}
                className='hover:bg-muted/50 rounded-lg border p-3 transition-colors sm:p-4'
              >
                <div className='flex items-start justify-between gap-2'>
                  <div className='flex-1 space-y-1'>
                    <div className='flex min-w-0 flex-wrap items-center gap-2'>
                      <code className='text-foreground truncate font-mono text-sm'>
                        {record.trade_no}
                      </code>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-5 w-5 p-0'
                        onClick={() => copyToClipboard(record.trade_no)}
                      >
                        {copiedText === record.trade_no ? (
                          <Check className='h-3 w-3' />
                        ) : (
                          <Copy className='h-3 w-3' />
                        )}
                      </Button>
                      <StatusBadge
                        label={`${t('User ID')}: ${record.user_id}`}
                        variant='neutral'
                        size='sm'
                        copyText={String(record.user_id)}
                      />
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      {dayjs
                        .unix(record.create_time)
                        .format('YYYY-MM-DD HH:mm:ss')}
                    </div>
                  </div>
                  <StatusBadge
                    label={t(statusCfg.labelKey)}
                    variant={statusCfg.variant}
                    showDot
                    copyable={false}
                  />
                </div>

                <div className='mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:grid-cols-4 sm:gap-4'>
                  <div className='space-y-1'>
                    <div className='text-muted-foreground text-xs'>
                      {t('Payment Method')}
                    </div>
                    <div className='text-sm font-medium'>{t(paymentName)}</div>
                  </div>
                  <div className='space-y-1'>
                    <div className='text-muted-foreground text-xs'>
                      {t('Payment')}
                    </div>
                    <div className='text-sm font-semibold text-red-600'>
                      {formatNumber(record.money)}
                    </div>
                  </div>
                  <div className='space-y-1'>
                    <div className='text-muted-foreground text-xs'>
                      {t('Quota')}
                    </div>
                    <div className='text-sm font-semibold'>
                      {formatNumber(record.amount)}
                    </div>
                  </div>
                  {record.status === 'pending' ? (
                    <div className='flex items-end'>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => setConfirmTradeNo(record.trade_no)}
                        disabled={completing}
                      >
                        {t('Complete Order')}
                      </Button>
                    </div>
                  ) : record.complete_time ? (
                    <div className='space-y-1'>
                      <div className='text-muted-foreground text-xs'>
                        {t('Completed At')}
                      </div>
                      <div className='text-xs font-medium'>
                        {dayjs
                          .unix(record.complete_time)
                          .format('MM-DD HH:mm')}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </div>

      {!loading && total > 0 && (
        <div className='mt-4 flex flex-col items-center gap-3 border-t pt-4 sm:flex-row sm:justify-between'>
          <div className='text-muted-foreground text-xs sm:text-sm'>
            {t('Showing')} {(page - 1) * pageSize + 1}-
            {Math.min(page * pageSize, total)} {t('of')} {total}
          </div>
          <div className='flex items-center gap-3'>
            <Select
              items={[
                { value: '10', label: t('10 / page') },
                { value: '20', label: t('20 / page') },
                { value: '50', label: t('50 / page') },
                { value: '100', label: t('100 / page') },
              ]}
              value={pageSize.toString()}
              onValueChange={(v) =>
                v !== null && onPageSizeChange(parseInt(v, 10))
              }
            >
              <SelectTrigger className='h-9 w-[100px]'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  <SelectItem value='10'>{t('10 / page')}</SelectItem>
                  <SelectItem value='20'>{t('20 / page')}</SelectItem>
                  <SelectItem value='50'>{t('50 / page')}</SelectItem>
                  <SelectItem value='100'>{t('100 / page')}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              variant='outline'
              size='sm'
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className='h-9 w-9 p-0'
            >
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <div className='text-muted-foreground flex items-center gap-1 text-sm'>
              <span className='font-medium'>{page}</span>
              <span>/</span>
              <span>{totalPages}</span>
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className='h-9 w-9 p-0'
            >
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
        </div>
      )}

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
