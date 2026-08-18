import { useState } from 'react'
import type { VoucherStatus } from '@/lib/types'
import type { VoucherInput } from '@/hooks/useVouchers'
import VoucherRow from '@/components/VoucherRow'
import VoucherTableHead from '@/components/VoucherTableHead'

// A single-row table has nothing to sort, so the header's sort arrows are
// inert here -- kept only for visual consistency with the expanded view.
const NOOP_SORT = { key: 'name' as const, dir: 'asc' as const }
const noopToggleSort = () => {}

function formatValue(v: VoucherStatus): string {
  if (typeof v.value === 'number') {
    return `$${v.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  }
  return v.value_note || '—'
}

function ageingStyle(bucket: string): React.CSSProperties {
  if (bucket === '(1) Overdue') return { color: 'var(--danger)', fontWeight: 600 }
  if (bucket === '(2) 0-30 Days') return { color: 'var(--amber)', fontWeight: 600 }
  return { color: 'var(--muted)' }
}

export default function CompactVoucherRow({
  voucher,
  onSave,
  onDelete,
}: {
  voucher: VoucherStatus
  onSave: (id: string, input: Partial<VoucherInput>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b" style={{ borderColor: 'var(--border)' }}>
      <div
        onClick={() => setExpanded((e) => !e)}
        className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:opacity-80"
      >
        <span className="w-3 text-xs select-none" style={{ color: 'var(--muted)' }}>
          {expanded ? '▾' : '▸'}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{voucher.name || '(untitled)'}</span>
        <span className="w-20 shrink-0 text-right tabular-nums">{formatValue(voucher)}</span>
        <span className="w-16 shrink-0 text-xs" style={{ color: 'var(--muted)' }}>{voucher.interest || '—'}</span>
        <span className="w-20 shrink-0 truncate text-xs" style={{ color: 'var(--muted)' }}>{voucher.type || '—'}</span>
        <span className="w-28 shrink-0 text-xs whitespace-nowrap" style={ageingStyle(voucher.ageing_bucket)}>
          {voucher.ageing_bucket}
        </span>
      </div>
      {expanded && (
        <div className="overflow-x-auto px-3 pb-3" onClick={(e) => e.stopPropagation()}>
          <table className="w-full min-w-[1000px] border-collapse">
            <VoucherTableHead sort={NOOP_SORT} onToggleSort={noopToggleSort} />
            <tbody>
              <VoucherRow voucher={voucher} onSave={onSave} onDelete={onDelete} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
