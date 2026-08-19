import { useMemo, useState } from 'react'
import { useVouchers } from '@/hooks/useVouchers'
import VoucherRow from '@/components/VoucherRow'
import CompactVoucherRow from '@/components/CompactVoucherRow'
import VoucherTableHead, { type SortKey } from '@/components/VoucherTableHead'
import { TYPE_OPTIONS, INTEREST_OPTIONS } from '@/lib/types'
import type { VoucherStatus } from '@/lib/types'

type ViewMode = 'compact' | 'expanded'
type GroupField = 'none' | 'name' | 'value' | 'interest' | 'type' | 'ageing_bucket'

const AGEING_ORDER = ['(1) Overdue', '(2) 0-30 Days', '(3) 31-60 Days', '(4) 61-90 Days', '(5) 91+ Days', 'No Expiry']
const INTEREST_ORDER = ['High', 'Medium', 'Low']

const GROUP_OPTIONS: { value: GroupField; label: string }[] = [
  { value: 'none', label: 'No grouping' },
  { value: 'name', label: 'Name' },
  { value: 'value', label: 'Value' },
  { value: 'interest', label: 'Priority' },
  { value: 'type', label: 'Category' },
  { value: 'ageing_bucket', label: 'Ageing Bucket' },
]

function valueLabel(v: VoucherStatus): string {
  if (typeof v.value === 'number') return `$${v.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  return v.value_note || 'No value'
}

function groupVouchers(list: VoucherStatus[], field: GroupField): { label: string; rows: VoucherStatus[] }[] {
  if (field === 'none') return [{ label: '', rows: list }]

  const keyFn: Record<Exclude<GroupField, 'none'>, (v: VoucherStatus) => string> = {
    name: (v) => v.name || '(untitled)',
    value: valueLabel,
    interest: (v) => v.interest || '—',
    type: (v) => v.type || '—',
    ageing_bucket: (v) => v.ageing_bucket,
  }
  const getKey = keyFn[field]

  const groups = new Map<string, VoucherStatus[]>()
  for (const v of list) {
    const key = getKey(v)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(v)
  }

  let orderedKeys: string[]
  if (field === 'ageing_bucket') {
    orderedKeys = AGEING_ORDER.filter((k) => groups.has(k))
  } else if (field === 'interest') {
    orderedKeys = [...INTEREST_ORDER.filter((k) => groups.has(k)), ...[...groups.keys()].filter((k) => !INTEREST_ORDER.includes(k)).sort()]
  } else {
    orderedKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }

  return orderedKeys.map((label) => ({ label, rows: groups.get(label)! }))
}

export default function Vouchers() {
  const { vouchers, loading, error, createVoucher, updateVoucher, deleteVoucher } = useVouchers()

  const [viewMode, setViewMode] = useState<ViewMode>('compact')
  const [groupBy, setGroupBy] = useState<GroupField>('none')

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [interestFilter, setInterestFilter] = useState('')
  const [ageingFilter, setAgeingFilter] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'expiry_date', dir: 'asc' })
  const [busy, setBusy] = useState(false)

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
      if (typeFilter && v.type !== typeFilter) return false
      if (statusFilter && v.status !== statusFilter) return false
      if (interestFilter && v.interest !== interestFilter) return false
      if (ageingFilter && v.ageing_bucket !== ageingFilter) return false
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
  }, [vouchers, search, typeFilter, statusFilter, interestFilter, ageingFilter, sort])

  const grouped = useMemo(() => groupVouchers(filtered, groupBy), [filtered, groupBy])

  const clearFilters = () => {
    setSearch('')
    setTypeFilter('')
    setStatusFilter('')
    setInterestFilter('')
    setAgeingFilter('')
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
  // Status is the master field for every summary count: a voucher only counts as
  // "overdue" here if its status literally reads Expired. A voucher whose date has
  // passed but carries a status_input override (Redeemed, Booked, ...) already shows
  // that override as its status, not Expired, so it correctly falls out of this count
  // even though its Ageing Bucket independently still reads "(1) Overdue" (that field
  // is date-only and never looks at status_input -- see voucherLogic.ts).
  const overdueCount = vouchers.filter((v) => v.status === 'Expired').length

  const selectCls = 'rounded border px-2.5 py-1.5 text-xs'

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-5 text-sm" style={{ color: 'var(--muted)' }}>
          <span><strong style={{ color: 'var(--text)' }}>{vouchers.length}</strong> total</span>
          <span><strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> shown</span>
          <span><strong style={{ color: 'var(--text)' }}>{openCount}</strong> open</span>
          <span><strong style={{ color: 'var(--text)' }}>{overdueCount}</strong> overdue</span>
          <span>
            Total value:{' '}
            <strong style={{ color: 'var(--text)' }}>
              ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'compact' && (
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupField)}
              className={selectCls}
              style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}
            >
              {GROUP_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.value === 'none' ? 'Group by…' : `Group by ${g.label}`}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setViewMode((m) => (m === 'compact' ? 'expanded' : 'compact'))}
            className={selectCls}
            style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}
          >
            {viewMode === 'compact' ? 'Show expanded view' : 'Show compact view'}
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border p-2.5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-40 rounded border px-2 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded border px-2 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
        >
          <option value="">All types</option>
          {[...distinctTypes].sort().map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border px-2 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
        >
          <option value="">All statuses</option>
          {[...distinctStatuses].sort().map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={interestFilter}
          onChange={(e) => setInterestFilter(e.target.value)}
          className="rounded border px-2 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
        >
          <option value="">All priorities</option>
          {[...distinctInterests].sort().map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={ageingFilter}
          onChange={(e) => setAgeingFilter(e.target.value)}
          className="rounded border px-2 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
        >
          <option value="">All ageing</option>
          {distinctAgeings.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <button
          onClick={clearFilters}
          className="rounded border px-2.5 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}
        >
          Clear
        </button>
      </div>

      {error && <p className="mb-3 text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

      {viewMode === 'expanded' ? (
        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <table className="w-full min-w-[1100px] border-collapse">
            <VoucherTableHead sort={sort} onToggleSort={toggleSort} />
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>Loading…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>No vouchers match the current filters.</td>
                </tr>
              ) : (
                filtered.map((v: VoucherStatus) => (
                  <VoucherRow key={v.id} voucher={v} onSave={updateVoucher} onDelete={deleteVoucher} />
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          {loading ? (
            <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>No vouchers match the current filters.</p>
          ) : (
            grouped.map((g) => (
              <div key={g.label || 'all'}>
                {groupBy !== 'none' && (
                  <div
                    className="px-3 py-2 text-xs font-semibold tracking-wide uppercase"
                    style={{ color: 'var(--muted)', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
                  >
                    {g.label} <span className="font-normal normal-case">({g.rows.length})</span>
                  </div>
                )}
                {g.rows.map((v) => (
                  <CompactVoucherRow key={v.id} voucher={v} onSave={updateVoucher} onDelete={deleteVoucher} />
                ))}
              </div>
            ))
          )}
        </div>
      )}

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
