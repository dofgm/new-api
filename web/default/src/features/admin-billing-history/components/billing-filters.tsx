import { useEffect, useId, useState } from 'react'
import { Search } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import type { BillingFilter, BillingStatus } from '../types'

type StatusFilterValue = 'all' | BillingStatus

type PresetKey = 'today' | 'yesterday' | '7d' | '30d' | 'all'

const STATUS_VALUES: Array<{ value: StatusFilterValue; labelKey: string }> = [
  { value: 'success', labelKey: 'Success' },
  { value: 'pending', labelKey: 'Pending' },
  { value: 'failed', labelKey: 'Failed' },
  { value: 'expired', labelKey: 'Expired' },
  { value: 'all', labelKey: 'All Status' },
]

const TIME_PRESETS: Array<{ key: PresetKey; labelKey: string }> = [
  { key: 'today', labelKey: 'Today' },
  { key: 'yesterday', labelKey: 'Yesterday' },
  { key: '7d', labelKey: 'Last 7 days' },
  { key: '30d', labelKey: 'Last 30 days' },
  { key: 'all', labelKey: 'All time' },
]

function computePreset(key: PresetKey): { start?: Date; end?: Date } {
  const now = dayjs()
  switch (key) {
    case 'today':
      return {
        start: now.startOf('day').toDate(),
        end: now.endOf('day').toDate(),
      }
    case 'yesterday': {
      const y = now.subtract(1, 'day')
      return { start: y.startOf('day').toDate(), end: y.endOf('day').toDate() }
    }
    case '7d':
      return {
        start: now.subtract(7, 'day').startOf('day').toDate(),
        end: now.endOf('day').toDate(),
      }
    case '30d':
      return {
        start: now.subtract(30, 'day').startOf('day').toDate(),
        end: now.endOf('day').toDate(),
      }
    case 'all':
    default:
      return {}
  }
}

/**
 * Segmented control — same visual style as the dashboard time-range selector
 * (see dashboard/components/users/user-charts.tsx).
 */
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>
  value: T | null
  onChange: (value: T) => void
}) {
  // Unique per-instance layoutId so multiple segmented controls on the
  // same page don't fight for the same motion target.
  const layoutId = useId()
  return (
    <div className='flex h-9 shrink-0 items-center gap-1 rounded-lg border p-0.5'>
      {options.map((opt) => (
        <button
          key={opt.value}
          type='button'
          onClick={() => onChange(opt.value)}
          className={cn(
            'relative flex h-full items-center rounded-md px-3 text-xs font-medium transition-colors',
            value === opt.value
              ? 'text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {value === opt.value && (
            <motion.div
              layoutId={layoutId}
              className='bg-primary absolute inset-0 rounded-md shadow-sm'
              transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            />
          )}
          <span className='relative z-10'>{opt.label}</span>
        </button>
      ))}
    </div>
  )
}

interface BillingFiltersProps {
  onChange: (filter: BillingFilter) => void
}

export function BillingFilters({ onChange }: BillingFiltersProps) {
  const { t } = useTranslation()
  const [activePreset, setActivePreset] = useState<PresetKey | null>('all')
  const [start, setStart] = useState<Date | undefined>(undefined)
  const [end, setEnd] = useState<Date | undefined>(undefined)
  const [status, setStatus] = useState<StatusFilterValue>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const filter: BillingFilter = {}
    if (status !== 'all') filter.status = status
    if (start) filter.start_time = Math.floor(start.getTime() / 1000)
    if (end) filter.end_time = Math.floor(end.getTime() / 1000)
    const trimmed = search.trim()
    if (trimmed) {
      if (/^\d+$/.test(trimmed)) {
        filter.user_id = parseInt(trimmed, 10)
      } else {
        filter.keyword = trimmed
      }
    }
    onChange(filter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, start, end, search])

  const handlePresetClick = (key: PresetKey) => {
    setActivePreset(key)
    const { start: s, end: e } = computePreset(key)
    setStart(s)
    setEnd(e)
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <SegmentedControl
        options={TIME_PRESETS.map((p) => ({
          value: p.key,
          label: t(p.labelKey),
        }))}
        value={activePreset}
        onChange={handlePresetClick}
      />
      <SegmentedControl
        options={STATUS_VALUES.map((s) => ({
          value: s.value,
          label: t(s.labelKey),
        }))}
        value={status}
        onChange={setStatus}
      />
      <div className='relative min-w-[200px] flex-1'>
        <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
        <Input
          placeholder={t('Order no. / user ID (digits-only = user ID)')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className='h-9 pl-10'
        />
      </div>
    </div>
  )
}
