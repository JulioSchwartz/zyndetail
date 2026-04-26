'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useEmpresa() {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [perfil, setPerfil] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function carregar() {
      // Tenta pegar sessão atual
      let { data: { session } } = await supabase.auth.getSession()

      // Se não tem sessão, aguarda até 3s pelo evento de login
      if (!session) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 3000)
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
            if (s) {
              session = s
              clearTimeout(timeout)
              subscription.unsubscribe()
              resolve()
            }
          })
        })
      }

      if (!session?.user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('usuarios_detail')
        .select('empresa_id, perfil')
        .eq('user_id', session.user.id)
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