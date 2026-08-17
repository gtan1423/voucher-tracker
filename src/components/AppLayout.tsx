import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function AppLayout() {
  const { signOut } = useAuth()

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `border-b-2 pb-1 text-sm ${isActive ? 'font-semibold' : ''}`

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold" style={{ color: 'var(--primary)' }}>🎟️ Voucher Tracker</span>
          <nav className="flex gap-5">
            <NavLink
              to="/"
              end
              className={linkCls}
              style={({ isActive }) => ({
                borderColor: isActive ? 'var(--primary)' : 'transparent',
                color: isActive ? 'var(--text)' : 'var(--muted)',
              })}
            >
              Vouchers
            </NavLink>
            <NavLink
              to="/settings"
              className={linkCls}
              style={({ isActive }) => ({
                borderColor: isActive ? 'var(--primary)' : 'transparent',
                color: isActive ? 'var(--text)' : 'var(--muted)',
              })}
            >
              Settings
            </NavLink>
          </nav>
        </div>
        <button onClick={signOut} className="text-sm" style={{ color: 'var(--muted)' }}>
          Sign out
        </button>
      </header>
      <Outlet />
    </div>
  )
}
