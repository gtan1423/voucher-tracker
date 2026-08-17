import { useEffect, useState } from 'react'
import { useNotificationSettings } from '@/hooks/useNotificationSettings'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const TIMEZONES = [
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Hong_Kong',
  'Asia/Kolkata',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
]

const labelCls = 'text-xs uppercase tracking-wide'
const inputCls = 'rounded border px-3 py-2 text-sm'

export default function Settings() {
  const { settings, loading, error, save } = useNotificationSettings()

  const [email, setEmail] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState(5)
  const [hour, setHour] = useState(19)
  const [timezone, setTimezone] = useState('Asia/Singapore')
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!settings) return
    setEmail(settings.recipient_email)
    setDayOfWeek(settings.day_of_week)
    setHour(settings.hour)
    setTimezone(settings.timezone)
    setEnabled(settings.enabled)
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await save({ recipient_email: email.trim(), day_of_week: dayOfWeek, hour, timezone, enabled })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="mx-auto max-w-xl p-4 text-sm" style={{ color: 'var(--muted)' }}>Loading…</div>

  return (
    <div className="mx-auto max-w-xl p-4">
      <h1 className="mb-1 text-2xl font-bold" style={{ color: 'var(--primary)' }}>
        Notification settings
      </h1>
      <p className="mb-5 text-sm" style={{ color: 'var(--muted)' }}>
        A weekly status email (overdue &amp; soon-to-expire vouchers) is checked every hour and
        sent once it's this day/time in your chosen timezone.
      </p>

      <div className="flex flex-col gap-4 rounded-lg border p-5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="flex flex-col gap-1">
          <label className={labelCls} style={{ color: 'var(--muted)' }}>Recipient email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className={labelCls} style={{ color: 'var(--muted)' }}>Day</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className={inputCls}
              style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls} style={{ color: 'var(--muted)' }}>Time (24h)</label>
            <select
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className={inputCls}
              style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelCls} style={{ color: 'var(--muted)' }}>Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className={inputCls}
            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>

        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !email.trim()}
          className="rounded px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--primary)' }}
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <p className="text-sm" style={{ color: 'var(--ok)' }}>Saved.</p>}
      </div>
    </div>
  )
}
