import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from '@/lib/dayjs'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

interface BillingFiltersProps {
  onChange: (filter: BillingFilter) => void
}

export function BillingFilters({ onChange }: BillingFiltersProps) {
  const { t } = useTranslation()
  const [activePreset, setActivePreset] = useState<PresetKey>('all')
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
      <Tabs
        value={activePreset}
        onValueChange={(value) => handlePresetClick(value as PresetKey)}
        className='shrink-0'
      >
        <TabsList>
          {TIME_PRESETS.map((p) => (
            <TabsTrigger key={p.key} value={p.key} className='px-2.5 text-xs'>
              {t(p.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Tabs
        value={status}
        onValueChange={(value) => setStatus(value as StatusFilterValue)}
        className='shrink-0'
      >
        <TabsList>
          {STATUS_VALUES.map((s) => (
            <TabsTrigger
              key={s.value}
              value={s.value}
              className='px-2.5 text-xs'
            >
              {t(s.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

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
