/**
 * Форматирует число с пробелами каждые 3 символа
 * Например: 140848 → "140 848"
 */
export function formatNumber(num: number): string {
  return Math.round(num)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

/**
 * Форматирует валюту в рублях
 * Например: 140848 → "140 848 ₽"
 */
export function formatCurrency(num: number): string {
  return `${formatNumber(num)} ₽`
}

/**
 * Форматирует процент
 * Например: 45.678 → "45.7%"
 */
export function formatPercent(num: number, decimals = 1): string {
  return `${(Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals)).toFixed(decimals)}%`
}
