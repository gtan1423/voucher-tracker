export interface Voucher {
  id: string
  name: string
  value: number | null
  value_note: string | null
  start_date: string | null
  expiry_date: string | null
  type: string
  interest: string
  status_input: string
}

export interface VoucherStatus extends Voucher {
  ageing_bucket: string
  days_until_expiry: string
  status: string
}

export interface NotificationSettings {
  user_id: string
  recipient_email: string
  day_of_week: number
  hour: number
  timezone: string
  enabled: boolean
  last_sent_at: string | null
}

export const TYPE_OPTIONS = ['Dining', 'Lifestyle', 'Shopping', 'Travel', 'Climbing']
export const INTEREST_OPTIONS = ['Low', 'Medium', 'High']
export const STATUS_INPUT_OPTIONS = ['', 'Booked', 'Redeemed', 'Expired']
