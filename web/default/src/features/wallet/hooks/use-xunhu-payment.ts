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
import i18next from 'i18next'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'

import { requestXunhuPayment, isApiSuccess } from '../api'

/**
 * Result returned from Xunhu payment request.
 *
 * - `type === 'qrcode'`: caller should open a QR code dialog with `qrcodeUrl`.
 *   The QR image URL is already a rendered PNG — render it via `<img src>`,
 *   never re-encode it with QRCodeSVG/QRCodeCanvas.
 * - `type === 'redirect'`: caller should navigate the mobile browser to `url`.
 */
export type XunhuPaymentResult =
  | {
      type: 'qrcode'
      tradeNo: string
      amount: number
      qrcodeUrl: string
      fallbackUrl?: string
      expireSeconds?: number
    }
  | {
      type: 'redirect'
      tradeNo: string
      amount: number
      url: string
    }
  | null

/**
 * Hook for initiating Xunhu (WeChat) payment. Returns either a QR code URL
 * or a redirect URL depending on the device. The caller is responsible
 * for rendering the QR dialog or performing the redirect.
 */
export function useXunhuPayment() {
  const [processing, setProcessing] = useState(false)

  const processXunhuPayment = useCallback(
    async (topupAmount: number): Promise<XunhuPaymentResult> => {
      setProcessing(true)
      try {
        const response = await requestXunhuPayment({
          amount: Math.floor(topupAmount),
          payment_method: 'xunhu',
        })

        if (!isApiSuccess(response) || !response.data) {
          const fallback =
            typeof response.data === 'string' ? response.data : response.message
          toast.error(fallback || i18next.t('Payment request failed'))
          return null
        }

        const data = response.data
        if (data.type === 'qrcode' && data.qrcode_url) {
          return {
            type: 'qrcode',
            tradeNo: data.trade_no,
            amount: data.amount,
            qrcodeUrl: data.qrcode_url,
            fallbackUrl: data.url,
            expireSeconds: data.expire_seconds,
          }
        }
        if (data.type === 'redirect' && data.url) {
          return {
            type: 'redirect',
            tradeNo: data.trade_no,
            amount: data.amount,
            url: data.url,
          }
        }
        toast.error(i18next.t('Payment request failed'))
        return null
      } catch (_error) {
        toast.error(i18next.t('Payment request failed'))
        return null
      } finally {
        setProcessing(false)
      }
    },
    []
  )

  return { processing, processXunhuPayment }
}
