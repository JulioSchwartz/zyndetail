'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DashboardClient() {
  const router = useRouter()
  const [empresa, setEmpresa] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push('/auth/login')
        return
      }

      const { data: usuario } = await supabase
        .from('usuarios_detail')
        .select('empresa_id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!usuario?.empresa_id) {
        router.push('/auth/login')
        return
      }

      const { data: emp } = await supabase
        .from('empresas_detail')
        .select('*')
        .eq('id', usuario.empresa_id)
        .single()

      setEmpresa(emp)
      setLoading(false)
    }

    init()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#D4A843', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#0A0F1E', fontSize: 22, fontWeight: 900 }}>Z</span>
      </div>
      <p style={{ color: '#2B6CB0', fontWeight: 700, letterSpacing: 2, fontSize: 13 }}>CARREGANDO...</p>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: 1 }}>
          🏠 Dashboard
        </h1>
        {empresa && (
          <p style={{ color: '#4A5568', marginTop: 4, fontSize: 13, letterSpacing: 1 }}>
            {empresa.nome} · {empresa.cidade || 'Configure sua localização'}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { titulo: 'OS Abertas', valor: '0', cor: '#2B6CB0', icon: '🔧' },
          { titulo: 'Orçamentos Pendentes', valor: '0', cor: '#D4A843', icon: '📋' },
          { titulo: 'Agendamentos Hoje', valor: '0', cor: '#48BB78', icon: '📅' },
          { titulo: 'Faturamento do Mês', valor: 'R$ 0,00', cor: '#90CDF4', icon: '💰' },
        ].map((c, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '20px', borderTop: `3px solid ${c.cor}` }}>
            <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 2, margin: 0 }}>{c.icon} {c.titulo.toUpperCase()}</p>
            <h2 style={{ color: c.cor, fontSize: 28, fontWeight: 900, margin: '8px 0 0', letterSpacing: 1 }}>{c.valor}</h2>
          </div>
        ))}
      </div>

      <div style={{ background: 'rgba(43,108,176,0.06)', border: '1px solid rgba(43,108,176,0.15)', borderRadius: 16, padding: 28, textAlign: 'center' }}>
        <span style={{ fontSize: 40 }}>🚗</span>
        <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: '12px 0 8px', letterSpacing: 1 }}>
          Sistema em construção
        </h2>
        <p style={{ color: '#4A5568', fontSize: 14, lineHeight: 1.6 }}>
          Em breve: Clientes, Orçamentos, Ordens de Serviço, Agenda e muito mais.
        </p>
      </div>
    </div>
  )
}