import { useEffect, useState } from 'react'
import type { VoucherStatus } from '@/lib/types'
import { TYPE_OPTIONS, INTEREST_OPTIONS, STATUS_INPUT_OPTIONS } from '@/lib/types'
import type { VoucherInput } from '@/hooks/useVouchers'

function statusBadgeStyle(status: string): React.CSSProperties {
  const s = status.toLowerCase()
  if (s === 'open') return { background: 'var(--ok-bg)', color: 'var(--ok)' }
  if (s === 'expired') return { background: 'var(--danger-bg)', color: 'var(--danger)' }
  if (s === 'redeemed') return { background: '#e0e7ff', color: '#3730a3' }
  if (s === 'booked') return { background: 'var(--amber-bg)', color: 'var(--amber)' }
  return { background: '#f1f5f9', color: '#475569' }
}

function ageingStyle(bucket: string): React.CSSProperties {
  if (bucket === '(1) Overdue') return { color: 'var(--danger)', fontWeight: 600 }
  if (bucket === '(2) 0-30 Days') return { color: 'var(--amber)', fontWeight: 600 }
  return {}
}

const cellCls =
  'w-full min-w-[90px] rounded border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-[var(--border)] focus:border-[var(--primary)] focus:outline-none focus:bg-[var(--bg)]'

export default function VoucherRow({
  voucher,
  onSave,
  onDelete,
}: {
  voucher: VoucherStatus
  onSave: (id: string, input: Partial<VoucherInput>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [name, setName] = useState(voucher.name)
  const [valueText, setValueText] = useState(
    voucher.value != null ? String(voucher.value) : voucher.value_note ?? '',
  )
  const [startDate, setStartDate] = useState(voucher.start_date ?? '')
  const [expiryDate, setExpiryDate] = useState(voucher.expiry_date ?? '')
  const [type, setType] = useState(voucher.type)
  const [interest, setInterest] = useState(voucher.interest)
  const [statusInput, setStatusInput] = useState(voucher.status_input)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setName(voucher.name)
    setValueText(voucher.value != null ? String(voucher.value) : voucher.value_note ?? '')
    setStartDate(voucher.start_date ?? '')
    setExpiryDate(voucher.expiry_date ?? '')
    setType(voucher.type)
    setInterest(voucher.interest)
    setStatusInput(voucher.status_input)
  }, [voucher])

  const save = async (input: Partial<VoucherInput>) => {
    setBusy(true)
    try {
      await onSave(voucher.id, input)
    } finally {
      setBusy(false)
    }
  }

  const commitValue = () => {
    const raw = valueText.trim()
    if (raw === '') {
      if (voucher.value !== null || voucher.value_note !== null) save({ value: null, value_note: null })
      return
    }
    const num = Number(raw)
    if (!Number.isNaN(num)) {
      if (voucher.value !== num) save({ value: num, value_note: null })
    } else if (voucher.value_note !== raw) {
      save({ value: null, value_note: raw })
    }
  }

  return (
    <tr className="border-b" style={{ borderColor: 'var(--border)', opacity: busy ? 0.6 : 1 }}>
      <td className="px-2 py-1">
        <button
          onClick={() => onDelete(voucher.id)}
          title="Delete this voucher"
          className="cursor-pointer border-none bg-transparent px-1.5 text-base"
          style={{ color: 'var(--danger)' }}
        >
          ✕
        </button>
      </td>
      <td className="px-2 py-1">
        <input
          className={cellCls + ' min-w-[180px]'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== voucher.name && save({ name: name.trim() })}
        />
      </td>
      <td className="px-2 py-1">
        <input
          className={cellCls}
          value={valueText}
          onChange={(e) => setValueText(e.target.value)}
          onBlur={commitValue}
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="date"
          className={cellCls + ' min-w-[130px]'}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          onBlur={() => startDate !== (voucher.start_date ?? '') && save({ start_date: startDate || null })}
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="date"
          className={cellCls + ' min-w-[130px]'}
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          onBlur={() => expiryDate !== (voucher.expiry_date ?? '') && save({ expiry_date: expiryDate || null })}
        />
      </td>
      <td className="px-2 py-1 text-sm whitespace-nowrap" style={ageingStyle(voucher.ageing_bucket)}>
        {voucher.ageing_bucket}
      </td>
      <td className="px-2 py-1 text-sm whitespace-nowrap" style={{ color: 'var(--muted)' }}>
        {voucher.days_until_expiry}
      </td>
      <td className="px-2 py-1">
        <select
          className={cellCls}
          value={type}
          onChange={(e) => {
            setType(e.target.value)
            save({ type: e.target.value })
          }}
        >
          {[...new Set([type, ...TYPE_OPTIONS])].map((t) => (
            <option key={t} value={t}>
              {t || '—'}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1">
        <span className="inline-block rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap" style={statusBadgeStyle(voucher.status)}>
          {voucher.status}
        </span>
      </td>
      <td className="px-2 py-1">
        <select
          className={cellCls}
          value={interest}
          onChange={(e) => {
            setInterest(e.target.value)
            save({ interest: e.target.value })
          }}
        >
          {[...new Set([interest, ...INTEREST_OPTIONS])].map((t) => (
            <option key={t} value={t}>
              {t || '—'}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1">
        <select
          className={cellCls}
          value={statusInput}
          onChange={(e) => {
            setStatusInput(e.target.value)
            save({ status_input: e.target.value })
          }}
        >
          {[...new Set([statusInput, ...STATUS_INPUT_OPTIONS])].map((t) => (
            <option key={t} value={t}>
              {t === '' ? '—' : t}
            </option>
          ))}
        </select>
      </td>
    </tr>
  )
}
