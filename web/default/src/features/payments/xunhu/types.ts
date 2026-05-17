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
/**
 * 虎皮椒（XunhuPay）共享类型。
 *
 * 充值（features/wallet）和订阅（features/subscriptions）都用到虎皮椒，
 * 这里集中放真正跨 feature 共享的类型，避免相互 import。
 */

export interface XunhuOrderStatusData {
  trade_no: string
  status: 'pending' | 'success' | 'failed' | 'expired'
  amount: number
  money: number
}

export interface XunhuOrderStatusResponse {
  success?: boolean
  message?: string
  data?: XunhuOrderStatusData
}
