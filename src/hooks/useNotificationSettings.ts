import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import type { NotificationSettings } from '@/lib/types'

const DEFAULTS: Omit<NotificationSettings, 'user_id' | 'last_sent_at'> = {
  recipient_email: '76-endings-midsts@icloud.com',
  day_of_week: 5, // Friday
  hour: 19,
  timezone: 'Asia/Singapore',
  enabled: true,
}

export function useNotificationSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('voucher_notification_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      setError(error.message)
    } else {
      setSettings(data ?? { user_id: user.id, last_sent_at: null, ...DEFAULTS })
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const save = async (input: Omit<NotificationSettings, 'user_id' | 'last_sent_at'>) => {
    if (!user) throw new Error('Not signed in')
    const { error } = await supabase
      .from('voucher_notification_settings')
      .upsert({ user_id: user.id, ...input }, { onConflict: 'user_id' })
    if (error) throw error
    await load()
  }

  return { settings, loading, error, save, reload: load }
}
