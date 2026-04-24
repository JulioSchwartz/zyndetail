'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEmpresa } from '@/hooks/useEmpresa'

export default function Dashboard() {
  const { empresaId, loading } = useEmpresa()
  const router = useRouter()
  const [empresa, setEmpresa] = useState<any>(null)

  useEffect(() => {
    if (loading) return
    if (!empresaId) { router.push('/auth/login'); return }
    supabase.from('empresas_detail').select('*').eq('id', empresaId).single().then(({ data }) => {
      setEmpresa(data)
    })
  }, [empresaId, loading])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ color: '#2B6CB0', fontWeight: 700, letterSpacing: 2 }}>CARREGANDO...</p>
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

      {/* Cards placeholder */}
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

      {/* Bem-vindo */}
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