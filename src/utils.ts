import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number) {
  if (value >= 100000000) {
    return `¥ ${(value / 100000000).toFixed(2)} 亿`
  }
  if (value >= 10000) {
    return `¥ ${(value / 10000).toFixed(0)} 万`
  }
  return `¥ ${value.toLocaleString()}`
}
