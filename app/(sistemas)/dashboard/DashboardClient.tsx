'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DashboardClient() {
  const router = useRouter()
  const [empresa, setEmpresa] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/auth/login'); return }

      const { data: usuario } = await supabase
        .from('usuarios_detail')
        .select('empresa_id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!usuario?.empresa_id) { router.push('/auth/login'); return }

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
      <div style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#080C18', fontSize: 22, fontWeight: 900 }}>Z</span>
      </div>
      <p style={{ color: '#D4A843', fontWeight: 700, letterSpacing: 2, fontSize: 12 }}>CARREGANDO...</p>
    </div>
  )

  const cards = [
    { label: 'OS ABERTAS', icon: '🔧', value: '0', sub: 'ordens em aberto', cor: '#D4A843', corBg: 'rgba(212,168,67,0.1)', gradiente: 'linear-gradient(90deg, #D4A843, #F0C060)' },
    { label: 'ORÇAMENTOS', icon: '📋', value: '0', sub: 'aguardando aprovação', cor: '#90CDF4', corBg: 'rgba(144,205,244,0.1)', gradiente: 'linear-gradient(90deg, #2B6CB0, #90CDF4)' },
    { label: 'AGENDA HOJE', icon: '📅', value: '0', sub: 'agendamentos', cor: '#48BB78', corBg: 'rgba(72,187,120,0.1)', gradiente: 'linear-gradient(90deg, #276749, #48BB78)' },
    { label: 'FATURAMENTO', icon: '💰', value: 'R$ 0,00', sub: 'no mês atual', cor: '#CBD5E0', corBg: 'rgba(203,213,224,0.1)', gradiente: 'linear-gradient(90deg, #4A5568, #CBD5E0)' },
  ]

  return (
    <div>
      {/* Saudação */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: 0.5 }}>
          {saudacao}, {empresa?.nome || 'Bem-vindo'}
        </h1>
        <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', margin: '8px 0' }} />
        <p style={{ color: '#4A5568', fontSize: 13 }}>
          {hoje.charAt(0).toUpperCase() + hoje.slice(1)} — aqui está o resumo do dia
        </p>
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {cards.map((c, i) => (
          <div key={i} style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: c.gradiente }} />
            <p style={{ color: '#4A5568', fontSize: 10, fontWeight: 700, letterSpacing: 2, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>{c.icon}</span> {c.label}
            </p>
            <p style={{ color: c.cor, fontSize: c.label === 'FATURAMENTO' ? 20 : 28, fontWeight: 900, letterSpacing: 1, margin: 0 }}>{c.value}</p>
            <p style={{ color: '#4A5568', fontSize: 11, marginTop: 6 }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Painéis inferiores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>

        {/* OS Recentes */}
        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 1, margin: 0 }}>Ordens de Serviço</p>
            <span style={{ color: '#D4A843', fontSize: 10, letterSpacing: 2, cursor: 'pointer', fontWeight: 700 }}>VER TODAS →</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120, flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 28 }}>🔧</span>
            <p style={{ color: '#4A5568', fontSize: 13 }}>Nenhuma OS aberta</p>
            <button onClick={() => router.push('/ordens')} style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.3)', color: '#D4A843', padding: '6px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700, letterSpacing: 1, marginTop: 4 }}>
              CRIAR PRIMEIRA OS
            </button>
          </div>
        </div>

        {/* Agenda */}
        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 1, margin: 0 }}>Agenda de Hoje</p>
            <span style={{ color: '#D4A843', fontSize: 10, letterSpacing: 2, cursor: 'pointer', fontWeight: 700 }}>GERENCIAR →</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120, flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 28 }}>📅</span>
            <p style={{ color: '#4A5568', fontSize: 13 }}>Sem agendamentos hoje</p>
            <button onClick={() => router.push('/agenda')} style={{ background: 'rgba(144,205,244,0.1)', border: '1px solid rgba(144,205,244,0.2)', color: '#90CDF4', padding: '6px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700, letterSpacing: 1, marginTop: 4 }}>
              NOVO AGENDAMENTO
            </button>
          </div>
        </div>

      </div>

      {/* Bem-vindo / Setup */}
      {empresa && !empresa.whatsapp && (
        <div style={{ marginTop: 12, background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.15)', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ color: '#D4A843', fontSize: 13, fontWeight: 700, margin: '0 0 4px', letterSpacing: 1 }}>⚙️ COMPLETE SEU PERFIL</p>
            <p style={{ color: '#4A5568', fontSize: 13, margin: 0 }}>Adicione WhatsApp, endereço e logo da sua estética para usar todos os recursos.</p>
          </div>
          <button onClick={() => router.push('/configuracoes')} style={{ background: '#D4A843', border: 'none', color: '#080C18', padding: '10px 20px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 900, letterSpacing: 1, whiteSpace: 'nowrap' }}>
            CONFIGURAR →
          </button>
        </div>
      )}
    </div>
  )
}