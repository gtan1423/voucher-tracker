import { useMemo, useState } from 'react'
import { useVouchers } from '@/hooks/useVouchers'
import VoucherRow from '@/components/VoucherRow'
import { TYPE_OPTIONS, INTEREST_OPTIONS } from '@/lib/types'
import type { VoucherStatus } from '@/lib/types'

type SortKey = 'name' | 'value' | 'start_date' | 'expiry_date' | 'ageing_bucket' | 'type' | 'status' | 'interest'

const AGEING_ORDER = ['(1) Overdue', '(2) 0-30 Days', '(3) 31-60 Days', '(4) 61-90 Days', '(5) 91+ Days', 'No Expiry']

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <span
      onClick={onClick}
      className="cursor-pointer rounded-full border px-2.5 py-1 text-xs select-none"
      style={
        active
          ? { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }
          : { borderColor: 'var(--border)', background: 'var(--card)' }
      }
    >
      {label}
    </span>
  )
}

export default function Vouchers() {
  const { vouchers, loading, error, createVoucher, updateVoucher, deleteVoucher } = useVouchers()

  const [search, setSearch] = useState('')
  const [types, setTypes] = useState<Set<string>>(new Set())
  const [statuses, setStatuses] = useState<Set<string>>(new Set())
  const [interests, setInterests] = useState<Set<string>>(new Set())
  const [ageings, setAgeings] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'expiry_date', dir: 'asc' })
  const [busy, setBusy] = useState(false)

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void, val: string) => {
    const next = new Set(set)
    if (next.has(val)) next.delete(val)
    else next.add(val)
    setSet(next)
  }

  const distinctTypes = useMemo(() => new Set([...TYPE_OPTIONS, ...vouchers.map((v) => v.type).filter(Boolean)]), [vouchers])
  const distinctInterests = useMemo(() => new Set([...INTEREST_OPTIONS, ...vouchers.map((v) => v.interest).filter(Boolean)]), [vouchers])
  const distinctStatuses = useMemo(() => new Set(vouchers.map((v) => v.status)), [vouchers])
  const distinctAgeings = useMemo(
    () => AGEING_ORDER.filter((a) => vouchers.some((v) => v.ageing_bucket === a)),
    [vouchers],
  )

  const filtered = useMemo(() => {
    let list = vouchers.filter((v) => {
      if (search) {
        const hay = `${v.name} ${v.type} ${v.interest} ${v.status_input}`.toLowerCase()
        if (!hay.includes(search.toLowerCase())) return false
      }
      if (types.size && !types.has(v.type)) return false
      if (statuses.size && !statuses.has(v.status)) return false
      if (interests.size && !interests.has(v.interest)) return false
      if (ageings.size && !ageings.has(v.ageing_bucket)) return false
      return true
    })
    list = [...list].sort((a, b) => {
      const mul = sort.dir === 'asc' ? 1 : -1
      let av: string | number = a[sort.key] ?? ''
      let bv: string | number = b[sort.key] ?? ''
      if (sort.key === 'value') {
        av = a.value ?? 0
        bv = b.value ?? 0
      }
      if (av < bv) return -1 * mul
      if (av > bv) return 1 * mul
      return 0
    })
    return list
  }, [vouchers, search, types, statuses, interests, ageings, sort])

  const clearFilters = () => {
    setSearch('')
    setTypes(new Set())
    setStatuses(new Set())
    setInterests(new Set())
    setAgeings(new Set())
  }

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  const handleAdd = async () => {
    setBusy(true)
    try {
      await createVoucher({
        name: 'New voucher',
        value: null,
        value_note: null,
        start_date: null,
        expiry_date: null,
        type: TYPE_OPTIONS[0],
        interest: INTEREST_OPTIONS[0],
        status_input: '',
      })
    } finally {
      setBusy(false)
    }
  }

  const totalValue = vouchers.reduce((sum, v) => sum + (typeof v.value === 'number' ? v.value : 0), 0)
  const openCount = vouchers.filter((v) => v.status === 'Open').length
  const overdueCount = vouchers.filter((v) => v.ageing_bucket === '(1) Overdue').length

  const th = (label: string, key?: SortKey) => (
    <th
      onClick={key ? () => toggleSort(key) : undefined}
      className="cursor-pointer px-2.5 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase whitespace-nowrap"
      style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}
    >
      {label}
      {sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="mb-3 flex flex-wrap gap-5 text-sm" style={{ color: 'var(--muted)' }}>
        <span>
          <strong style={{ color: 'var(--text)' }}>{vouchers.length}</strong> total
        </span>
        <span>
          <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> shown
        </span>
        <span>
          <strong style={{ color: 'var(--text)' }}>{openCount}</strong> open
        </span>
        <span>
          <strong style={{ color: 'var(--text)' }}>{overdueCount}</strong> overdue
        </span>
        <span>
          Total value:{' '}
          <strong style={{ color: 'var(--text)' }}>
            ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </strong>
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-5 rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, type, interest…"
            className="w-52 rounded border px-2 py-1.5 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Type</label>
          <div className="flex max-w-xs flex-wrap gap-1.5">
            {[...distinctTypes].sort().map((t) => (
              <Chip key={t} label={t} active={types.has(t)} onClick={() => toggle(types, setTypes, t)} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Status</label>
          <div className="flex max-w-xs flex-wrap gap-1.5">
            {[...distinctStatuses].sort().map((s) => (
              <Chip key={s} label={s} active={statuses.has(s)} onClick={() => toggle(statuses, setStatuses, s)} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Interest</label>
          <div className="flex max-w-xs flex-wrap gap-1.5">
            {[...distinctInterests].sort().map((s) => (
              <Chip key={s} label={s} active={interests.has(s)} onClick={() => toggle(interests, setInterests, s)} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Ageing</label>
          <div className="flex max-w-xs flex-wrap gap-1.5">
            {distinctAgeings.map((a) => (
              <Chip key={a} label={a} active={ageings.has(a)} onClick={() => toggle(ageings, setAgeings, a)} />
            ))}
          </div>
        </div>
        <button
          onClick={clearFilters}
          className="rounded border px-2.5 py-1.5 text-xs"
          style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}
        >
          Clear filters
        </button>
      </div>

      {error && <p className="mb-3 text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <table className="w-full min-w-[1100px] border-collapse">
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid var(--border)' }}></th>
              {th('Name / Description', 'name')}
              {th('Value ($)', 'value')}
              {th('Start Date', 'start_date')}
              {th('Expiry Date', 'expiry_date')}
              {th('Ageing Bucket', 'ageing_bucket')}
              <th className="px-2.5 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                Days Until Expiry
              </th>
              {th('Type', 'type')}
              {th('Status', 'status')}
              {th('Interest', 'interest')}
              <th className="px-2.5 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                Status Override
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
                  No vouchers match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((v: VoucherStatus) => (
                <VoucherRow key={v.id} voucher={v} onSave={updateVoucher} onDelete={deleteVoucher} />
              ))
            )}
          </tbody>
        </table>
      </div>

      <button
        onClick={handleAdd}
        disabled={busy}
        className="mt-4 rounded border px-3 py-2 text-sm disabled:opacity-50"
        style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}
      >
        + Add voucher
      </button>
    </div>
  )
}
