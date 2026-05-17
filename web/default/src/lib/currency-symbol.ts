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
 * 按 ISO 4217 货币代码返回前缀符号（"¥" / "$" / "€" 等）。
 *
 * 用 Intl.NumberFormat 抽取，比硬编码 map 更全面（覆盖所有 ISO 货币）。
 * 找不到符号时回退到代码本身（避免空字符串导致 UI 显示 "100" 没有上下文）。
 *
 * 用于「按订阅套餐自身货币显示」的场景，例如 subscription plan card：
 *   {getCurrencySymbol(plan.currency)}{price}  → "¥100" 或 "$100"
 *
 * 这避免硬编码 ¥ / $ 在 JSX 里，让上游合并时不容易丢失我们的定制
 * （上游若重写定价行，只要还沿用 plan.currency 字段就会自动正确显示）。
 */

// 常见货币的窄符号 fallback，避免依赖运行时 Intl locale 数据差异。
const FALLBACK_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  KRW: '₩',
  HKD: 'HK$',
  TWD: 'NT$',
  AUD: 'A$',
  CAD: 'CA$',
}

export function getCurrencySymbol(
  currency: string | undefined | null,
  defaultCurrency: string = 'CNY'
): string {
  const code = (currency || defaultCurrency).toUpperCase()
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0)
    const symbol = parts.find((p) => p.type === 'currency')?.value
    if (symbol) return symbol
  } catch {
    // Intl 不识别的代码 — 走 fallback
  }
  return FALLBACK_SYMBOLS[code] ?? code
}
