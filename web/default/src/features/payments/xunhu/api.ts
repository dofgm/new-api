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
import { api } from '@/lib/api'

import type { XunhuOrderStatusResponse } from './types'

/**
 * 轮询虎皮椒订单状态。对同一个 trade_no，后端会同时检索充值订单和订阅订单，
 * 所以充值流程和订阅流程可以共用同一个查询接口。
 */
export async function getXunhuOrderStatus(
  tradeNo: string
): Promise<XunhuOrderStatusResponse> {
  const res = await api.get('/api/user/xunhu/order_status', {
    params: { trade_no: tradeNo },
    skipBusinessError: true,
  } as Record<string, unknown>)
  return res.data
}
