/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SiWechat } from 'react-icons/si'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getCurrencySymbol } from '@/lib/currency-symbol'
import { getXunhuOrderStatus } from './api'

interface XunhuQrcodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  qrcodeUrl: string | null
  tradeNo: string | null
  amount: number
  /** ISO 4217 货币代码（CNY/USD/EUR 等），用于决定金额前缀符号；默认 CNY */
  currency?: string
  fallbackUrl?: string | null
  expireSeconds?: number
  onPaid?: () => void
}

const POLL_INTERVAL_MS = 3000
const DEFAULT_EXPIRE_SECONDS = 300
const AUTO_CLOSE_DELAY_MS = 3000

function formatTimeMMSS(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0')
  const s = (safe % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function XunhuQrcodeDialog({
  open,
  onOpenChange,
  qrcodeUrl,
  tradeNo,
  amount,
  currency = 'CNY',
  fallbackUrl,
  expireSeconds = DEFAULT_EXPIRE_SECONDS,
  onPaid,
}: XunhuQrcodeDialogProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<
    'pending' | 'success' | 'failed' | 'expired'
  >('pending')
  const [remaining, setRemaining] = useState(expireSeconds)
  const onPaidRef = useRef(onPaid)

  // 订单未就绪（API 还没返回）—— 走 loading UI，不启动倒计时/轮询
  const isLoading = !tradeNo || !qrcodeUrl
  const symbol = getCurrencySymbol(currency)

  useEffect(() => {
    onPaidRef.current = onPaid
  }, [onPaid])

  useEffect(() => {
    if (open) {
      setStatus('pending')
    }
  }, [open])

  // 支付成功后自动关闭弹窗
  useEffect(() => {
    if (status !== 'success') return
    const id = setTimeout(() => onOpenChange(false), AUTO_CLOSE_DELAY_MS)
    return () => clearTimeout(id)
  }, [status, onOpenChange])

  // 订单数据到达后再设置倒计时（避免 loading 阶段就开始倒数）
  useEffect(() => {
    if (open && !isLoading) {
      setRemaining(expireSeconds)
    }
  }, [open, isLoading, expireSeconds])

  // 倒计时 —— 仅在订单就绪且 pending 时运行
  useEffect(() => {
    if (!open || isLoading || status !== 'pending') return
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setStatus('expired')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [open, isLoading, status])

  // 轮询订单状态 —— 仅在 tradeNo 就绪时运行；tab 不可见时暂停
  useEffect(() => {
    if (!open || !tradeNo || status !== 'pending') return

    let cancelled = false
    let timerId: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      if (cancelled) return
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      ) {
        return
      }
      try {
        const response = await getXunhuOrderStatus(tradeNo)
        if (cancelled) return
        const data = response.data
        if (data?.status === 'success') {
          setStatus('success')
          onPaidRef.current?.()
          return
        }
        if (data?.status === 'failed' || data?.status === 'expired') {
          setStatus(data.status)
          return
        }
      } catch {
        // 网络抖动 — 继续轮询
      }
      if (cancelled) return
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      ) {
        return
      }
      timerId = setTimeout(tick, POLL_INTERVAL_MS)
    }

    const onVisibility = () => {
      if (cancelled) return
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible'
      ) {
        if (timerId !== null) {
          clearTimeout(timerId)
          timerId = null
        }
        tick()
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility)
      if (document.visibilityState === 'visible') {
        timerId = setTimeout(tick, POLL_INTERVAL_MS)
      }
    } else {
      timerId = setTimeout(tick, POLL_INTERVAL_MS)
    }

    return () => {
      cancelled = true
      if (timerId !== null) clearTimeout(timerId)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }
  }, [open, tradeNo, status])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-sm'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <SiWechat className='h-5 w-5 text-[#07C160]' />
            {t('WeChat QR Pay')}
          </DialogTitle>
          <DialogDescription className='sr-only'>
            {t('Use WeChat to scan the QR code below to complete your payment.')}
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col items-center gap-3 py-1'>
          <div className='text-center'>
            <p className='text-muted-foreground text-xs'>{t('Amount Due')}</p>
            <p className='mt-0.5 text-2xl font-semibold'>
              {amount > 0 ? `${symbol}${Number(amount).toFixed(2)}` : '—'}
            </p>
          </div>

          <div className='flex h-48 w-48 items-center justify-center rounded-md border bg-white'>
            {qrcodeUrl ? (
              <img
                src={qrcodeUrl}
                alt={t('WeChat QR Pay')}
                className='block h-48 w-48'
                referrerPolicy='no-referrer'
              />
            ) : (
              <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
            )}
          </div>

          {isLoading ? (
            <div className='text-muted-foreground flex items-center gap-2 text-xs'>
              <Loader2 className='h-3 w-3 animate-spin' />
              <span>{t('Creating order...')}</span>
            </div>
          ) : (
            <>
              <p className='text-muted-foreground text-xs'>
                {t('Use WeChat to scan the QR code above')}
              </p>

              {status === 'pending' && (
                <div className='inline-flex items-center rounded-full bg-green-50 px-3 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/50 dark:text-green-300'>
                  {t('Time remaining')}: {formatTimeMMSS(remaining)}
                </div>
              )}

              <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                {status === 'pending' && (
                  <>
                    <Loader2 className='h-3 w-3 animate-spin' />
                    <span>{t('Waiting for payment...')}</span>
                  </>
                )}
                {status === 'success' && (
                <div className='flex flex-col items-center gap-2'>
                  <span className='flex items-center gap-1.5 text-green-600 dark:text-green-400'>
                    <CheckCircle2 className='h-4 w-4' />
                    {t('Payment received')}
                  </span>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => onOpenChange(false)}
                  >
                    {t('Done')}
                  </Button>
                </div>
              )}
                {status === 'failed' && (
                  <span className='text-destructive'>
                    {t('Payment failed')}
                  </span>
                )}
                {status === 'expired' && (
                  <span className='text-destructive'>
                    {t('Order expired')}
                  </span>
                )}
              </div>

              {fallbackUrl && status === 'pending' && (
                <a
                  href={fallbackUrl}
                  target='_blank'
                  rel='noreferrer noopener'
                  className='text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline'
                >
                  {t('Or open payment page in new tab')}
                  <ExternalLink className='h-3 w-3' />
                </a>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
