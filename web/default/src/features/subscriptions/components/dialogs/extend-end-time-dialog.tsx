// CUSTOM: 管理员修改订阅 end_time 弹窗
// 配套后端: model/subscription_admin_custom.go + controller/admin_subscription_custom.go
// patch 入口: ./user-subscriptions-dialog.tsx

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DateTimePicker } from '@/components/datetime-picker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import dayjs from '@/lib/dayjs'

import { updateUserSubscriptionEndTime } from '../../api-custom'
import { formatTimestamp } from '../../lib'
import type { UserSubscription } from '../../types'

interface Props {
  sub: UserSubscription | null
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

function describeDiff(seconds: number, t: (k: string) => string): string {
  if (seconds === 0) return t('No change')
  const sign = seconds > 0 ? '+' : '-'
  const abs = Math.abs(seconds)
  const days = Math.floor(abs / 86400)
  const hours = Math.floor((abs % 86400) / 3600)
  const minutes = Math.floor((abs % 3600) / 60)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}${t('d')}`)
  if (hours > 0) parts.push(`${hours}${t('h')}`)
  if (minutes > 0 && days === 0) parts.push(`${minutes}${t('min')}`)
  if (parts.length === 0) parts.push(`${abs}${t('sec')}`)
  return `${sign}${parts.join(' ')}`
}

export function ExtendEndTimeDialog(props: Props) {
  const { t } = useTranslation()
  const [newDate, setNewDate] = useState<Date | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)

  const open = props.sub !== null

  useEffect(() => {
    if (props.sub) {
      setNewDate(new Date(props.sub.end_time * 1000))
    } else {
      setNewDate(undefined)
    }
  }, [props.sub])

  const diffSeconds = useMemo(() => {
    if (!props.sub || !newDate) return 0
    return Math.floor(newDate.getTime() / 1000) - props.sub.end_time
  }, [props.sub, newDate])

  const isPast = newDate ? newDate.getTime() / 1000 <= Date.now() / 1000 : false
  const canSubmit = !!newDate && !isPast && diffSeconds !== 0 && !submitting

  const handleSubmit = async () => {
    if (!props.sub || !newDate) return
    const endUnix = Math.floor(newDate.getTime() / 1000)
    setSubmitting(true)
    try {
      const res = await updateUserSubscriptionEndTime(props.sub.id, endUnix)
      if (res.success) {
        toast.success(t('Subscription end time updated'))
        props.onSuccess?.()
        props.onOpenChange(false)
      } else {
        toast.error(res.message || t('Operation failed'))
      }
    } catch {
      toast.error(t('Request failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && props.onOpenChange(false)}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('Modify subscription end time')}</DialogTitle>
          <DialogDescription>
            {props.sub ? `${t('Subscription')} #${props.sub.id}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='text-sm'>
            <div className='text-muted-foreground'>{t('Current end time')}</div>
            <div className='font-medium'>
              {props.sub ? formatTimestamp(props.sub.end_time) : '-'}
            </div>
          </div>

          <div className='space-y-2'>
            <div className='text-muted-foreground text-sm'>
              {t('New end time')}
            </div>
            <DateTimePicker
              value={newDate}
              onChange={setNewDate}
              placeholder={t('Select date')}
            />
          </div>

          {newDate && props.sub && (
            <div className='text-sm'>
              <span className='text-muted-foreground'>{t('Change')}: </span>
              <span
                className={
                  isPast
                    ? 'text-destructive font-medium'
                    : diffSeconds > 0
                      ? 'font-medium text-emerald-600 dark:text-emerald-400'
                      : diffSeconds < 0
                        ? 'font-medium text-orange-600 dark:text-orange-400'
                        : 'text-muted-foreground'
                }
              >
                {isPast
                  ? t('Time must be in the future')
                  : describeDiff(diffSeconds, t)}
                {!isPast && newDate && (
                  <span className='text-muted-foreground ml-2 text-xs'>
                    ({dayjs(newDate).format('YYYY-MM-DD HH:mm')})
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={submitting}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? t('Submitting...') : t('Confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
