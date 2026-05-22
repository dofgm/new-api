import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/format'
import type { BillingStats } from '../types'

interface BillingStatsCardProps {
  stats: BillingStats
  loading?: boolean
}

export function BillingStatsCard({ stats, loading }: BillingStatsCardProps) {
  const { t } = useTranslation()
  const successRate =
    stats.total_count > 0
      ? Math.round((stats.success_count / stats.total_count) * 100)
      : 0

  const items = [
    {
      label: t('Success Revenue'),
      value: formatNumber(stats.success_money),
      hint: t('Money from successful orders'),
    },
    {
      label: t('Quota Issued'),
      value: formatNumber(stats.success_amount),
      hint: t('Credited from successful orders'),
    },
    {
      label: t('Total Orders'),
      value: formatNumber(stats.total_count),
      hint: t('All statuses in current filter'),
    },
    {
      label: t('Success Rate'),
      value: `${successRate}%`,
      hint: t('Successful over total'),
    },
  ]

  return (
    <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className='p-4'>
            <div className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
              {item.label}
            </div>
            <div className='mt-2 text-2xl font-semibold'>
              {loading ? <Skeleton className='h-7 w-24' /> : item.value}
            </div>
            <div className='text-muted-foreground mt-1 text-xs'>{item.hint}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
