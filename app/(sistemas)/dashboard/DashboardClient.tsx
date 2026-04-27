'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DashboardClient() {
  const router = useRouter()
  const [empresa, setEmpresa] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [orcamentosNovos, setOrcamentosNovos] = useState<any[]>([])
  const [totais, setTotais] = useState({
    osAbertas: 0,
    orcamentosPendentes: 0,
    agendamentosHoje: 0,
  })

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/auth/login'); return }

      const { data: usuario } = await supabase
        .from('usuarios_detail').select('empresa_id')
        .eq('user_id', session.user.id).maybeSingle()
      if (!usuario?.empresa_id) { router.push('/auth/login'); return }

      const eid = usuario.empresa_id

      const [
        { data: emp },
        { data: orcsNovos },
        { data: orcsPendentes },
        { data: osAbertas },
      ] = await Promise.all([
        supabase.from('empresas_detail').select('*').eq('id', eid).single(),
        supabase.from('orcamentos_detail')
          .select('*, cliente:clientes(nome), veiculo:veiculos(modelo, placa)')
          .eq('empresa_id', eid)
          .eq('notificacao_lida', false)
          .in('status', ['aprovado', 'recusado'])
          .order('criado_em', { ascending: false }),
        supabase.from('orcamentos_detail')
          .select('id').eq('empresa_id', eid).eq('status', 'pendente'),
        supabase.from('ordens_servico')
          .select('id').eq('empresa_id', eid).in('status', ['aberta', 'em_andamento']),
      ])

      setEmpresa(emp)
      setOrcamentosNovos(orcsNovos || [])
      setTotais({
        osAbertas: osAbertas?.length || 0,
        orcamentosPendentes: orcsPendentes?.length || 0,
        agendamentosHoje: 0,
      })
      setLoading(false)
    }
    init()
  }, [])

  async function marcarLido(id: string) {
    await supabase.from('orcamentos_detail').update({ notificacao_lida: true }).eq('id', id)
    setOrcamentosNovos(prev => prev.filter(o => o.id !== id))
  }

  async function marcarTodosLidos() {
    await Promise.all(orcamentosNovos.map(o =>
      supabase.from('orcamentos_detail').update({ notificacao_lida: true }).eq('id', o.id)
    ))
    setOrcamentosNovos([])
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#080C18', fontSize: 22, fontWeight: 900 }}>Z</span>
      </div>
      <p style={{ color: '#D4A843', fontWeight: 700, letterSpacing: 2, fontSize: 12 }}>CARREGANDO...</p>
    </div>
  )

  const cards = [
    { label: 'OS ABERTAS',   icon: '🔧', value: String(totais.osAbertas),           sub: 'em aberto ou andamento', cor: '#D4A843', gradiente: 'linear-gradient(90deg, #D4A843, #F0C060)', href: '/ordens' },
    { label: 'ORÇAMENTOS',   icon: '📋', value: String(totais.orcamentosPendentes),  sub: 'aguardando aprovação',   cor: '#90CDF4', gradiente: 'linear-gradient(90deg, #2B6CB0, #90CDF4)', href: '/orcamentos' },
    { label: 'AGENDA HOJE',  icon: '📅', value: String(totais.agendamentosHoje),     sub: 'agendamentos',           cor: '#48BB78', gradiente: 'linear-gradient(90deg, #276749, #48BB78)', href: '/agenda' },
    { label: 'FATURAMENTO',  icon: '💰', value: 'R$ 0,00',                           sub: 'no mês atual',           cor: '#CBD5E0', gradiente: 'linear-gradient(90deg, #4A5568, #CBD5E0)', href: null },
  ]

  return (
    <div>
      {/* Saudação */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: 0.5 }}>
          {saudacao}, {empresa?.nome || 'Bem-vindo'}
        </h1>
        <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', margin: '8px 0' }} />
        <p style={{ color: '#4A5568', fontSize: 13 }}>
          {hoje.charAt(0).toUpperCase() + hoje.slice(1)} — aqui está o resumo do dia
        </p>
      </div>

      {/* Notificações de orçamentos */}
      {orcamentosNovos.length > 0 && (
        <div style={{ background: '#0D1220', border: '1px solid rgba(212,168,67,0.25)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ color: '#D4A843', fontSize: 12, fontWeight: 700, letterSpacing: 2, margin: 0 }}>
              🔔 NOTIFICAÇÕES ({orcamentosNovos.length})
            </p>
            <button onClick={marcarTodosLidos}
              style={{ background: 'transparent', border: 'none', color: '#4A5568', fontSize: 11, cursor: 'pointer', fontWeight: 700, letterSpacing: 1 }}>
              MARCAR TODAS COMO LIDAS
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orcamentosNovos.map(o => (
              <div key={o.id} style={{ background: o.status === 'aprovado' ? 'rgba(72,187,120,0.06)' : 'rgba(252,129,129,0.06)', border: `1px solid ${o.status === 'aprovado' ? 'rgba(72,187,120,0.2)' : 'rgba(252,129,129,0.2)'}`, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>{o.status === 'aprovado' ? '✅' : '❌'}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0 }}>
                    {o.status === 'aprovado' ? 'Orçamento aprovado' : 'Orçamento recusado'} — {o.cliente?.nome}
                  </p>
                  <p style={{ color: '#4A5568', fontSize: 12, margin: '3px 0 0' }}>
                    {o.veiculo?.modelo} · {o.veiculo?.placa} · #{o.token}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => router.push('/orcamentos')}
                    style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.3)', color: '#D4A843', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                    VER
                  </button>
                  <button onClick={() => marcarLido(o.id)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cards — clicáveis */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {cards.map((c, i) => (
          <div key={i}
            onClick={() => c.href && router.push(c.href)}
            style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, position: 'relative', overflow: 'hidden', cursor: c.href ? 'pointer' : 'default', transition: 'border-color 0.2s' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: c.gradiente }} />
            <p style={{ color: '#4A5568', fontSize: 10, fontWeight: 700, letterSpacing: 2, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>{c.icon}</span> {c.label}
            </p>
            <p style={{ color: c.cor, fontSize: c.label === 'FATURAMENTO' ? 20 : 28, fontWeight: 900, letterSpacing: 1, margin: 0 }}>{c.value}</p>
            <p style={{ color: '#4A5568', fontSize: 11, marginTop: 6 }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Painéis */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 1, margin: 0 }}>Ordens de Serviço</p>
            <span onClick={() => router.push('/ordens')} style={{ color: '#D4A843', fontSize: 10, letterSpacing: 2, cursor: 'pointer', fontWeight: 700 }}>VER TODAS →</span>
          </div>
          {totais.osAbertas > 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ color: '#D4A843', fontSize: 32, fontWeight: 900, margin: '0 0 8px' }}>{totais.osAbertas}</p>
              <p style={{ color: '#4A5568', fontSize: 13, margin: '0 0 12px' }}>ordens em aberto ou andamento</p>
              <button onClick={() => router.push('/ordens')} style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.3)', color: '#D4A843', padding: '8px 20px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700, letterSpacing: 1 }}>
                VER OS →
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100, flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 28 }}>🔧</span>
              <p style={{ color: '#4A5568', fontSize: 13 }}>Nenhuma OS aberta</p>
              <button onClick={() => router.push('/ordens')} style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.3)', color: '#D4A843', padding: '6px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700, letterSpacing: 1 }}>
                CRIAR PRIMEIRA OS
              </button>
            </div>
          )}
        </div>

        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 1, margin: 0 }}>Agenda de Hoje</p>
            <span onClick={() => router.push('/agenda')} style={{ color: '#D4A843', fontSize: 10, letterSpacing: 2, cursor: 'pointer', fontWeight: 700 }}>GERENCIAR →</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100, flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 28 }}>📅</span>
            <p style={{ color: '#4A5568', fontSize: 13 }}>Sem agendamentos hoje</p>
            <button onClick={() => router.push('/agenda')} style={{ background: 'rgba(144,205,244,0.1)', border: '1px solid rgba(144,205,244,0.2)', color: '#90CDF4', padding: '6px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700, letterSpacing: 1 }}>
              NOVO AGENDAMENTO
            </button>
          </div>
        </div>
      </div>

      {/* Banner setup */}
      {empresa && !empresa.whatsapp && (
        <div style={{ marginTop: 12, background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.15)', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ color: '#D4A843', fontSize: 13, fontWeight: 700, margin: '0 0 4px', letterSpacing: 1 }}>⚙️ COMPLETE SEU PERFIL</p>
            <p style={{ color: '#4A5568', fontSize: 13, margin: 0 }}>Adicione WhatsApp, endereço e logo para usar todos os recursos.</p>
          </div>
          <button onClick={() => router.push('/configuracoes')} style={{ background: '#D4A843', border: 'none', color: '#080C18', padding: '10px 20px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 900, letterSpacing: 1, whiteSpace: 'nowrap' as const }}>
            CONFIGURAR →
          </button>
        </div>
      )}
    </div>
  )
}