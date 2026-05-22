import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import dayjs from '@/lib/dayjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import type { BillingFilter, BillingStatus } from '../types'

type StatusFilterValue = 'all' | BillingStatus

type PresetKey = 'today' | 'yesterday' | '7d' | '30d' | 'all'

const STATUS_VALUES: Array<{ value: StatusFilterValue; labelKey: string }> = [
  { value: 'all', labelKey: 'All Status' },
  { value: 'success', labelKey: 'Success' },
  { value: 'pending', labelKey: 'Pending' },
  { value: 'failed', labelKey: 'Failed' },
  { value: 'expired', labelKey: 'Expired' },
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
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null)
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
    // We intentionally exclude onChange so a parent re-renders' new callback
    // doesn't trigger a refetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, start, end, search])

  const handlePresetClick = (key: PresetKey) => {
    setActivePreset(key)
    const { start: s, end: e } = computePreset(key)
    setStart(s)
    setEnd(e)
  }

  const handleDateChange = (range: { start?: Date; end?: Date }) => {
    setStart(range.start)
    setEnd(range.end)
    setActivePreset(null)
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        {TIME_PRESETS.map((p) => (
          <Button
            key={p.key}
            variant={activePreset === p.key ? 'default' : 'outline'}
            size='sm'
            onClick={() => handlePresetClick(p.key)}
          >
            {t(p.labelKey)}
          </Button>
        ))}
        <CompactDateTimeRangePicker
          start={start}
          end={end}
          onChange={handleDateChange}
          className='w-full sm:w-[340px]'
        />
      </div>

      <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
        <Select
          items={STATUS_VALUES.map((s) => ({
            value: s.value,
            label: t(s.labelKey),
          }))}
          value={status}
          onValueChange={(v) =>
            v !== null && setStatus(v as StatusFilterValue)
          }
        >
          <SelectTrigger className='h-9 w-full sm:w-[160px]'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {STATUS_VALUES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {t(s.labelKey)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <div className='relative flex-1'>
          <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          <Input
            placeholder={t(
              'Order no. / user ID (digits-only = user ID)'
            )}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='h-9 pl-10'
          />
        </div>
      </div>
    </div>
  )
}
