import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

export default function Login() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session) return <Navigate to="/" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border p-6" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
        <h1 className="mb-1 text-xl font-bold" style={{ color: 'var(--primary)' }}>
          🎟️ Voucher Tracker
        </h1>
        <p className="mb-5 text-sm" style={{ color: 'var(--muted)' }}>
          Log in with your finance tracker account.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            />
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
          >
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  )
}
