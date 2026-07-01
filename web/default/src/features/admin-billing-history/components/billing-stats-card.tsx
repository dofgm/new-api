import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrencyFromUSD } from '@/lib/currency'
import { CARD_ITEM_VARIANTS, CARD_STAGGER_VARIANTS } from '@/lib/motion'

import type { BillingStats } from '../types'

type Formatter = (value: number) => string

function CountUp({ value, format }: { value: number; format: Formatter }) {
  const motionValue = useMotionValue(0)
  const display = useTransform(motionValue, (latest) => format(latest))

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 0.8,
      ease: 'easeOut',
    })
    return () => controls.stop()
  }, [motionValue, value])

  return <motion.span>{display}</motion.span>
}

interface BillingStatsCardProps {
  stats: BillingStats
  loading?: boolean
}

// No thousands separator — short admin billing values don't need it
const noCommaFmt = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  useGrouping: false,
})
const formatRMB: Formatter = (v) => `¥${noCommaFmt.format(v)}`
const formatUSD: Formatter = (v) =>
  formatCurrencyFromUSD(v, {
    digitsLarge: 2,
    digitsSmall: 2,
    abbreviate: false,
  }).replace(/,/g, '')
const formatCount: Formatter = (v) => Math.round(v).toString()

export function BillingStatsCard({ stats, loading }: BillingStatsCardProps) {
  const { t } = useTranslation()

  // Only show skeleton on first load (all zeros = no data fetched yet)
  const showSkeleton =
    loading &&
    stats.success_money === 0 &&
    stats.success_amount === 0 &&
    stats.total_count === 0

  const items = [
    {
      label: t('Success Revenue'),
      value: stats.success_money,
      format: formatRMB,
    },
    {
      label: t('Quota Issued'),
      value: stats.success_amount,
      format: formatUSD,
    },
    {
      label: t('Total Orders'),
      value: stats.total_count,
      format: formatCount,
    },
  ]

  return (
    <motion.div
      className='grid grid-cols-1 gap-3 sm:grid-cols-3'
      initial='initial'
      animate='animate'
      variants={CARD_STAGGER_VARIANTS}
    >
      {items.map((item) => (
        <motion.div key={item.label} variants={CARD_ITEM_VARIANTS}>
          <Card>
            <CardContent className='flex items-center justify-between gap-3 p-3'>
              <div className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                {item.label}
              </div>
              <div className='text-lg font-semibold tabular-nums'>
                {showSkeleton ? (
                  <Skeleton className='h-5 w-20' />
                ) : (
                  <CountUp value={item.value} format={item.format} />
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  )
}
