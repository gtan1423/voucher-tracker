export type SortKey = 'name' | 'value' | 'start_date' | 'expiry_date' | 'ageing_bucket' | 'type' | 'status' | 'interest'

export default function VoucherTableHead({
  sort,
  onToggleSort,
}: {
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  onToggleSort: (key: SortKey) => void
}) {
  const th = (label: string, key?: SortKey) => (
    <th
      onClick={key ? () => onToggleSort(key) : undefined}
      className="cursor-pointer px-2.5 py-2.5 text-left text-[11px] font-semibold tracking-wide uppercase whitespace-nowrap"
      style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}
    >
      {label}
      {sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )

  return (
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
  )
}
