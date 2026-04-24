'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useEmpresa() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [perfil, setPerfil] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('usuarios_detail')
        .select('empresa_id, perfil')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data) {
        setEmpresaId(data.empresa_id)
        setPerfil(data.perfil)
      }
      setLoading(false)
    }
    carregar()
  }, [])

  return { empresaId, perfil, loading }
}