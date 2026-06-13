import { type ColumnDef } from '@tanstack/react-table'
import { Loader2, Stamp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatCurrencyFromUSD } from '@/lib/currency'
import { formatTimestampToDate } from '@/lib/format'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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

const noCommaFmt = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  useGrouping: false,
})

const PAYMENT_NAMES: Record<string, string> = {
  stripe: 'Stripe',
  alipay: 'Alipay',
  wxpay: 'WeChat Pay',
  waffo: 'Waffo',
  waffo_pancake: 'Waffo Pancake',
}

function TradeNoCell({ tradeNo }: { tradeNo: string }) {
  const { copyToClipboard } = useCopyToClipboard()
  return (
    <button
      type='button'
      onClick={() => copyToClipboard(tradeNo)}
      className='hover:bg-muted -mx-1 cursor-pointer rounded px-1 font-mono transition-colors'
      aria-label={`Copy ${tradeNo}`}
    >
      {tradeNo}
    </button>
  )
}

function UserIdCell({ userId }: { userId: number }) {
  const { copyToClipboard } = useCopyToClipboard()
  return (
    <button
      type='button'
      onClick={() => copyToClipboard(String(userId))}
      className='hover:bg-muted -mx-1 cursor-pointer rounded px-1 tabular-nums transition-colors'
      aria-label={`Copy user ID ${userId}`}
    >
      {userId}
    </button>
  )
}

interface UseBillingColumnsOptions {
  onRequestComplete: (tradeNo: string) => void
  completing: boolean
}

export function useBillingColumns({
  onRequestComplete,
  completing,
}: UseBillingColumnsOptions): ColumnDef<BillingRecord>[] {
  const { t } = useTranslation()

  return [
    {
      accessorKey: 'trade_no',
      header: t('Order No.'),
      size: 200,
      cell: ({ row }) => <TradeNoCell tradeNo={row.original.trade_no} />,
      meta: { label: t('Order No.') },
    },
    {
      accessorKey: 'user_id',
      header: t('User ID'),
      size: 70,
      cell: ({ row }) => <UserIdCell userId={row.original.user_id} />,
      meta: { label: t('User ID') },
    },
    {
      accessorKey: 'payment_method',
      header: t('Payment Method'),
      size: 110,
      cell: ({ row }) => {
        const name =
          PAYMENT_NAMES[row.original.payment_method] ||
          row.original.payment_method
        return <span>{t(name)}</span>
      },
      meta: { label: t('Payment Method') },
    },
    {
      accessorKey: 'money',
      header: t('Payment Amount'),
      size: 100,
      cell: ({ row }) => (
        <span className='font-medium tabular-nums text-red-600'>
          ¥{noCommaFmt.format(row.original.money)}
        </span>
      ),
      meta: { label: t('Payment Amount') },
    },
    {
      accessorKey: 'amount',
      header: t('Recharge Quota'),
      size: 100,
      cell: ({ row }) => {
        const r = row.original
        // Subscription orders (SUB* trade_no) don't issue quota — they bill
        // the subscription fee directly and quota is granted via subscription
        // lifecycle, so amount=0 here is "N/A" not "zero".
        if (r.trade_no.startsWith('SUB')) {
          return <span className='text-muted-foreground'>—</span>
        }
        return (
          <span className='font-medium tabular-nums'>
            {formatCurrencyFromUSD(r.amount, {
              digitsLarge: 2,
              digitsSmall: 2,
              abbreviate: false,
            }).replace(/,/g, '')}
          </span>
        )
      },
      meta: { label: t('Recharge Quota') },
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      size: 100,
      cell: ({ row }) => {
        const cfg = STATUS_STYLES[row.original.status] || STATUS_STYLES.pending
        return (
          <StatusBadge
            label={t(cfg.labelKey)}
            variant={cfg.variant}
            showDot
            copyable={false}
          />
        )
      },
      meta: { label: t('Status') },
    },
    {
      accessorKey: 'create_time',
      header: t('Created'),
      size: 170,
      cell: ({ row }) => (
        <span className='text-muted-foreground tabular-nums'>
          {formatTimestampToDate(row.original.create_time)}
        </span>
      ),
      meta: { label: t('Created') },
    },
    {
      accessorKey: 'complete_time',
      header: t('Completed At'),
      size: 170,
      cell: ({ row }) => (
        <span className='text-muted-foreground tabular-nums'>
          {formatTimestampToDate(row.original.complete_time)}
        </span>
      ),
      meta: { label: t('Completed At') },
    },
    {
      id: 'actions',
      header: '',
      size: 50,
      cell: ({ row }) => {
        if (row.original.status !== 'pending') return null
        return (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => onRequestComplete(row.original.trade_no)}
                  disabled={completing}
                  className='h-7 w-7 p-0'
                  aria-label={t('Complete Order')}
                >
                  {completing ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <Stamp className='h-4 w-4' />
                  )}
                </Button>
              }
            />
            <TooltipContent>{t('Complete Order')}</TooltipContent>
          </Tooltip>
        )
      },
      enableSorting: false,
      enableHiding: false,
      meta: { label: t('Actions') },
    },
  ]
}
