'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useEmpresa() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [perfil,    setPerfil]    = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    let mounted = true

    async function carregar() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        if (mounted) setLoading(false)
        return
      }

      const { data } = await supabase
        .from('usuarios_detail')
        .select('empresa_id, perfil')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (mounted && data) {
        setEmpresaId(data.empresa_id)
        setPerfil(data.perfil)
      }

      if (mounted) setLoading(false)
    }

    carregar()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (session) carregar()
      else { setEmpresaId(null); setPerfil(null); setLoading(false) }
    })

    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [])

  return { empresaId, perfil, loading }
}