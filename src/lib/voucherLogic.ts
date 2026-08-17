// Mirrors the `voucher_status` SQL view exactly (see supabase/migrations/0001_vouchers.sql),
// so edits show correct Ageing Bucket / Days Until Expiry / Status instantly in the UI
// without waiting on a round trip.
import type { Voucher } from './types'

function parseISO(s: string | null): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000)
}

export function todayLocal(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function computeAgeingBucket(expiryISO: string | null, today: Date): string {
  const e = parseISO(expiryISO)
  if (!e) return 'No Expiry'
  if (e < today) return '(1) Overdue'
  if (e <= addDays(today, 30)) return '(2) 0-30 Days'
  if (e <= addDays(today, 60)) return '(3) 31-60 Days'
  if (e <= addDays(today, 90)) return '(4) 61-90 Days'
  return '(5) 91+ Days'
}

export function computeDaysUntilExpiry(expiryISO: string | null, today: Date): string {
  const e = parseISO(expiryISO)
  if (!e) return '-'
  if (e < today) return 'Overdue'
  return `${daysBetween(e, today)} days`
}

export function computeStatus(statusInput: string | null, expiryISO: string | null, today: Date): string {
  if (statusInput) return statusInput
  const e = parseISO(expiryISO)
  if (!e) return 'Open'
  if (e < today) return 'Expired'
  return 'Open'
}

export function withComputed<T extends Voucher>(v: T, today: Date = todayLocal()) {
  return {
    ...v,
    ageing_bucket: computeAgeingBucket(v.expiry_date, today),
    days_until_expiry: computeDaysUntilExpiry(v.expiry_date, today),
    status: computeStatus(v.status_input, v.expiry_date, today),
  }
}
