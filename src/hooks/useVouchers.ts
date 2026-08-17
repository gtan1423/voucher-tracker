import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import type { Voucher, VoucherStatus } from '@/lib/types'
import { withComputed } from '@/lib/voucherLogic'

export interface VoucherInput {
  name: string
  value: number | null
  value_note: string | null
  start_date: string | null
  expiry_date: string | null
  type: string
  interest: string
  status_input: string
}

export function useVouchers() {
  const { user } = useAuth()
  const [vouchers, setVouchers] = useState<VoucherStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('voucher_status')
      .select('*')
      .order('expiry_date', { ascending: true, nullsFirst: false })

    if (error) {
      setError(error.message)
    } else {
      setVouchers((data ?? []) as VoucherStatus[])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const createVoucher = async (input: VoucherInput) => {
    if (!user) throw new Error('Not signed in')
    const { error } = await supabase.from('vouchers').insert({ ...input, user_id: user.id })
    if (error) throw error
    await load()
  }

  const updateVoucher = async (id: string, input: Partial<VoucherInput>) => {
    const { error } = await supabase.from('vouchers').update(input).eq('id', id)
    if (error) throw error
    await load()
  }

  const deleteVoucher = async (id: string) => {
    const { error } = await supabase.from('vouchers').delete().eq('id', id)
    if (error) throw error
    await load()
  }

  return { vouchers, loading, error, reload: load, createVoucher, updateVoucher, deleteVoucher }
}

export function computeLocal(v: Voucher) {
  return withComputed(v)
}
