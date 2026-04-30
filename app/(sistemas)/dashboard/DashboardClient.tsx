'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type OSAlerta = {
  id: string
  cliente?: any
  veiculo?: any
  criado_em: string
  status: string
  plano_id?: string
  diasAberta: number
  nivel: 'atencao' | 'alerta' | 'critico'
}

type OSFinalizada = {
  id: string
  cliente?: any
  veiculo?: any
  finalizado_em: string
  orcamento_id?: string
  orcamento?: any
  itens?: any[]
  plano_id?: string
}

export default function DashboardClient() {
  const router = useRouter()
  const [empresa, setEmpresa] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [orcamentosNovos, setOrcamentosNovos] = useState<any[]>([])
  const [solicitacoesNovas, setSolicitacoesNovas] = useState<any[]>([])
  const [totais, setTotais] = useState({ osAbertas: 0, orcamentosPendentes: 0, agendamentosHoje: 0 })

  // Faturamento
  const [faturamentoMes, setFaturamentoMes] = useState(0)
  const [faturamentoMesAnterior, setFaturamentoMesAnterior] = useState(0)
  const [ticketMedio, setTicketMedio] = useState(0)
  const [graficoSemana, setGraficoSemana] = useState<{ dia: string, valor: number }[]>([])
  const [topServicos, setTopServicos] = useState<{ nome: string, total: number, qtd: number }[]>([])

  // Novas notificações
  const [osFinalizadasNovas, setOsFinalizadasNovas] = useState<OSFinalizada[]>([])
  const [osAlertas, setOsAlertas] = useState<OSAlerta[]>([])

  const hojeFormatado = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  function formatarDataLocal(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }

  function diasDesde(dataStr: string): number {
    const agora = new Date()
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
    const criado = new Date(dataStr)
    const dCriado = new Date(criado.getFullYear(), criado.getMonth(), criado.getDate())
    return Math.floor((hoje.getTime() - dCriado.getTime()) / (1000 * 60 * 60 * 24))
  }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/auth/login'); return }
      const { data: usuario } = await supabase.from('usuarios_detail').select('empresa_id').eq('user_id', session.user.id).maybeSingle()
      if (!usuario?.empresa_id) { router.push('/auth/login'); return }
      const eid = usuario.empresa_id

      const hojeStr = formatarDataLocal(new Date())
      const agora = new Date()
      const inicioMes = formatarDataLocal(new Date(agora.getFullYear(), agora.getMonth(), 1))
      const fimMes = formatarDataLocal(new Date(agora.getFullYear(), agora.getMonth() + 1, 0))
      const inicioMesAnterior = formatarDataLocal(new Date(agora.getFullYear(), agora.getMonth() - 1, 1))
      const fimMesAnterior = formatarDataLocal(new Date(agora.getFullYear(), agora.getMonth(), 0))

      const diaSemana = agora.getDay() === 0 ? 6 : agora.getDay() - 1
      const inicioSemana = new Date(agora)
      inicioSemana.setDate(agora.getDate() - diaSemana)
      const inicioSemanaStr = formatarDataLocal(inicioSemana)

      // Limite: OS abertas há 10+ dias
      const limite10dias = new Date(agora)
      limite10dias.setDate(agora.getDate() - 10)
      const limite10Str = limite10dias.toISOString()

      const [
        { data: emp },
        { data: orcsNovos },
        { data: orcsPendentes },
        { data: osAbertasCount },
        { data: solicitacoes },
        { data: agsHoje },
        { data: osFinalizadasMes },
        { data: osFinalizadasMesAnterior },
        { data: osFinalizadasSemana },
        { data: osFinalizadasNotif },
        { data: osParadas },
      ] = await Promise.all([
        supabase.from('empresas_detail').select('*').eq('id', eid).single(),
        supabase.from('orcamentos_detail').select('*, cliente:clientes(nome), veiculo:veiculos(modelo, placa)').eq('empresa_id', eid).eq('notificacao_lida', false).in('status', ['aprovado', 'recusado']).order('criado_em', { ascending: false }),
        supabase.from('orcamentos_detail').select('id').eq('empresa_id', eid).eq('status', 'pendente'),
        supabase.from('ordens_servico').select('id').eq('empresa_id', eid).in('status', ['aberta', 'em_andamento']),
        supabase.from('agendamentos').select('*, cliente:clientes(nome), veiculo:veiculos(modelo, placa)').eq('empresa_id', eid).eq('status', 'pendente').eq('tipo', 'solicitacao').eq('notificacao_lida', false).order('data').order('hora'),
        supabase.from('agendamentos').select('id').eq('empresa_id', eid).eq('data', hojeStr).neq('status', 'cancelado'),
        supabase.from('ordens_servico').select('*, orcamento_id, orcamento:orcamentos_detail(valor_total), itens:os_itens(descricao, valor), finalizado_em').eq('empresa_id', eid).eq('status', 'finalizada').gte('finalizado_em', `${inicioMes}T00:00:00`).lte('finalizado_em', `${fimMes}T23:59:59`),
        supabase.from('ordens_servico').select('*, orcamento_id, orcamento:orcamentos_detail(valor_total), itens:os_itens(descricao, valor)').eq('empresa_id', eid).eq('status', 'finalizada').gte('finalizado_em', `${inicioMesAnterior}T00:00:00`).lte('finalizado_em', `${fimMesAnterior}T23:59:59`),
        supabase.from('ordens_servico').select('*, orcamento_id, orcamento:orcamentos_detail(valor_total), itens:os_itens(descricao, valor), finalizado_em').eq('empresa_id', eid).eq('status', 'finalizada').gte('finalizado_em', `${inicioSemanaStr}T00:00:00`),
        // OS finalizadas não lidas
        supabase.from('ordens_servico').select('*, orcamento_id, cliente:clientes(nome), veiculo:veiculos(marca, modelo, placa), orcamento:orcamentos_detail(valor_total), itens:os_itens(valor), plano_id').eq('empresa_id', eid).eq('status', 'finalizada').eq('notificacao_lida', false).order('finalizado_em', { ascending: false }),
        // OS paradas há 10+ dias
        supabase.from('ordens_servico').select('*, cliente:clientes(nome), veiculo:veiculos(marca, modelo, placa), plano_id').eq('empresa_id', eid).in('status', ['aberta', 'em_andamento']).lte('criado_em', limite10Str).order('criado_em', { ascending: true }),
      ])

      setEmpresa(emp)
      setOrcamentosNovos(orcsNovos || [])
      setSolicitacoesNovas(solicitacoes || [])
      setTotais({ osAbertas: osAbertasCount?.length || 0, orcamentosPendentes: orcsPendentes?.length || 0, agendamentosHoje: agsHoje?.length || 0 })

      // OS finalizadas notificação
      setOsFinalizadasNovas(osFinalizadasNotif || [])

      // OS paradas — classificar por nível
      const alertas: OSAlerta[] = (osParadas || []).map(os => {
        const dias = diasDesde(os.criado_em)
        const nivel: OSAlerta['nivel'] = dias >= 30 ? 'critico' : dias >= 15 ? 'alerta' : 'atencao'
        return { id: os.id, cliente: os.cliente, veiculo: os.veiculo, criado_em: os.criado_em, status: os.status, plano_id: os.plano_id, diasAberta: dias, nivel }
      }).sort((a, b) => b.diasAberta - a.diasAberta)
      setOsAlertas(alertas)

      // Faturamento
      function valorOS(os: any): number {
        if (os.orcamento_id && os.orcamento?.valor_total) return os.orcamento.valor_total
        return (os.itens || []).reduce((acc: number, item: any) => acc + (item.valor || 0), 0)
      }

      const totalMes = (osFinalizadasMes || []).reduce((acc, os) => acc + valorOS(os), 0)
      const totalMesAnt = (osFinalizadasMesAnterior || []).reduce((acc, os) => acc + valorOS(os), 0)
      const qtdMes = (osFinalizadasMes || []).length
      setFaturamentoMes(totalMes)
      setFaturamentoMesAnterior(totalMesAnt)
      setTicketMedio(qtdMes > 0 ? totalMes / qtdMes : 0)

      // Gráfico semana
      const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
      const porDia: Record<string, number> = {}
      DIAS.forEach(d => { porDia[d] = 0 })
      ;(osFinalizadasSemana || []).forEach(os => {
        const dt = new Date(os.finalizado_em)
        const idx = dt.getDay() === 0 ? 6 : dt.getDay() - 1
        porDia[DIAS[idx]] = (porDia[DIAS[idx]] || 0) + valorOS(os)
      })
      setGraficoSemana(DIAS.map(d => ({ dia: d, valor: porDia[d] })))

      // Top serviços
      const contagem: Record<string, { total: number, qtd: number }> = {}
      ;(osFinalizadasMes || []).forEach(os => {
        if (os.orcamento_id && os.orcamento?.valor_total) {
          const nome = 'Via orçamento'
          if (!contagem[nome]) contagem[nome] = { total: 0, qtd: 0 }
          contagem[nome].total += os.orcamento.valor_total
          contagem[nome].qtd += 1
        } else {
          ;(os.itens || []).forEach((item: any) => {
            if (!item.descricao) return
            if (!contagem[item.descricao]) contagem[item.descricao] = { total: 0, qtd: 0 }
            contagem[item.descricao].total += item.valor || 0
            contagem[item.descricao].qtd += 1
          })
        }
      })
      setTopServicos(Object.entries(contagem).map(([nome, v]) => ({ nome, total: v.total, qtd: v.qtd })).sort((a, b) => b.total - a.total).slice(0, 5))

      setLoading(false)
    }
    init()
  }, [])

  async function marcarLidoOrcamento(id: string) {
    await supabase.from('orcamentos_detail').update({ notificacao_lida: true }).eq('id', id)
    setOrcamentosNovos(prev => prev.filter(o => o.id !== id))
  }
  async function marcarTodosLidosOrcamentos() {
    await Promise.all(orcamentosNovos.map(o => supabase.from('orcamentos_detail').update({ notificacao_lida: true }).eq('id', o.id)))
    setOrcamentosNovos([])
  }
  async function marcarOsFinalizadaLida(id: string) {
    await supabase.from('ordens_servico').update({ notificacao_lida: true }).eq('id', id)
    setOsFinalizadasNovas(prev => prev.filter(o => o.id !== id))
  }
  async function marcarTodasOsFinalizadasLidas() {
    await Promise.all(osFinalizadasNovas.map(o => supabase.from('ordens_servico').update({ notificacao_lida: true }).eq('id', o.id)))
    setOsFinalizadasNovas([])
  }
  async function aprovarSolicitacao(s: any) {
    await supabase.from('agendamentos').update({ status: 'confirmado', notificacao_lida: true }).eq('id', s.id)
    setSolicitacoesNovas(prev => prev.filter(ag => ag.id !== s.id))
    if (s.solicitante_telefone) {
      const tel = s.solicitante_telefone.replace(/\D/g, '')
      const dataFormatada = new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
      const msg = `Olá, ${s.solicitante_nome?.split(' ')[0]}!\n\nSeu agendamento foi *CONFIRMADO* por *${empresa?.nome}*!\n\nData: *${dataFormatada}* às *${s.hora?.slice(0,5)}*\nVeículo: ${s.solicitante_veiculo}\nServiço: ${s.servico || 'A combinar'}\n\nAguardamos você! Qualquer dúvida, estamos à disposição.`
      window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank')
    }
  }
  async function recusarSolicitacao(s: any) {
    await supabase.from('agendamentos').update({ status: 'cancelado', notificacao_lida: true }).eq('id', s.id)
    setSolicitacoesNovas(prev => prev.filter(ag => ag.id !== s.id))
    if (s.solicitante_telefone) {
      const tel = s.solicitante_telefone.replace(/\D/g, '')
      const dataFormatada = new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
      const msg = `Olá, ${s.solicitante_nome?.split(' ')[0]}!\n\nInfelizmente não conseguimos confirmar seu agendamento para *${dataFormatada}* às *${s.hora?.slice(0,5)}*.\n\nPor favor, entre em contato conosco para verificar outro horário disponível.`
      window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank')
    }
  }

  function valorOSFinalizada(os: OSFinalizada): number {
    if (os.orcamento_id && os.orcamento?.valor_total) return os.orcamento.valor_total
    return (os.itens || []).reduce((acc, item: any) => acc + (item.valor || 0), 0)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#080C18', fontSize: 22, fontWeight: 900 }}>Z</span>
      </div>
      <p style={{ color: '#D4A843', fontWeight: 700, letterSpacing: 2, fontSize: 12 }}>CARREGANDO...</p>
    </div>
  )

  const variacao = faturamentoMesAnterior > 0
    ? ((faturamentoMes - faturamentoMesAnterior) / faturamentoMesAnterior) * 100
    : faturamentoMes > 0 ? 100 : 0
  const variacaoPositiva = variacao >= 0

  const cards = [
    { label: 'OS ABERTAS',  icon: '🔧', value: String(totais.osAbertas),          sub: 'em aberto ou andamento', cor: '#D4A843', gradiente: 'linear-gradient(90deg, #D4A843, #F0C060)', href: '/ordens' },
    { label: 'ORÇAMENTOS',  icon: '📋', value: String(totais.orcamentosPendentes), sub: 'aguardando aprovação',   cor: '#90CDF4', gradiente: 'linear-gradient(90deg, #2B6CB0, #90CDF4)', href: '/orcamentos' },
    { label: 'AGENDA HOJE', icon: '📅', value: String(totais.agendamentosHoje),    sub: 'agendamentos hoje',      cor: '#48BB78', gradiente: 'linear-gradient(90deg, #276749, #48BB78)', href: '/agenda' },
    { label: 'FATURAMENTO', icon: '💰', value: `R$ ${faturamentoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: `no mês atual ${faturamentoMesAnterior > 0 ? `· ${variacaoPositiva ? '+' : ''}${variacao.toFixed(0)}% vs mês anterior` : ''}`, cor: '#D4A843', gradiente: 'linear-gradient(90deg, #92600A, #D4A843)', href: null },
  ]

  const NIVEL_CONFIG = {
    atencao: { cor: '#D4A843', bg: 'rgba(212,168,67,0.08)',  border: 'rgba(212,168,67,0.25)',  icon: '⚠️', label: '10+ DIAS'  },
    alerta:  { cor: '#F97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.25)',  icon: '🔶', label: '15+ DIAS'  },
    critico: { cor: '#FC8181', bg: 'rgba(252,129,129,0.08)', border: 'rgba(252,129,129,0.25)', icon: '🚨', label: '30+ DIAS'  },
  }

  const maxValorSemana = Math.max(...graficoSemana.map(d => d.valor), 1)
  const diaAtualIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0 }}>{saudacao}, {empresa?.nome || 'Bem-vindo'}</h1>
        <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', margin: '8px 0' }} />
        <p style={{ color: '#4A5568', fontSize: 13 }}>{hojeFormatado.charAt(0).toUpperCase() + hojeFormatado.slice(1)} — aqui está o resumo do dia</p>
      </div>

      {/* ── Alerta: OS paradas ── */}
      {osAlertas.length > 0 && (
        <div style={{ background: '#0D1220', border: '1px solid rgba(252,129,129,0.2)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <p style={{ color: '#FC8181', fontSize: 12, fontWeight: 700, letterSpacing: 2, margin: '0 0 12px' }}>
            🚨 OS PARADAS — {osAlertas.length} ordem(ns) sem movimentação
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {osAlertas.map(os => {
              const cfg = NIVEL_CONFIG[os.nivel]
              const ehPlano = !!os.plano_id
              return (
                <div key={os.id} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{cfg.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' as const }}>
                      <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0 }}>
                        {os.cliente?.nome} — {os.veiculo?.marca} {os.veiculo?.modelo} · {os.veiculo?.placa}
                      </p>
                      <span style={{ background: cfg.bg, color: cfg.cor, fontSize: 9, padding: '2px 7px', borderRadius: 6, fontWeight: 700, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' as const }}>{cfg.label}</span>
                      {ehPlano && <span style={{ background: 'rgba(144,205,244,0.1)', color: '#90CDF4', fontSize: 9, padding: '2px 7px', borderRadius: 6, fontWeight: 700, border: '1px solid rgba(144,205,244,0.2)', whiteSpace: 'nowrap' as const }}>PLANO</span>}
                    </div>
                    <p style={{ color: '#4A5568', fontSize: 12, margin: 0 }}>
                      Aberta há <span style={{ color: cfg.cor, fontWeight: 700 }}>{os.diasAberta} dias</span>
                      {' · '}{os.status === 'aberta' ? 'Aberta' : 'Em andamento'}
                      {!ehPlano && os.nivel !== 'atencao' && <span style={{ color: '#FC8181', fontWeight: 700 }}> · Verificar pagamento</span>}
                      {ehPlano && <span style={{ color: '#90CDF4' }}> · Pagamento mensal — verificar execução</span>}
                    </p>
                  </div>
                  <button onClick={() => router.push('/ordens')}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E0', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    VER OS
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Notificações OS finalizadas ── */}
      {osFinalizadasNovas.length > 0 && (
        <div style={{ background: '#0D1220', border: '1px solid rgba(72,187,120,0.25)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ color: '#48BB78', fontSize: 12, fontWeight: 700, letterSpacing: 2, margin: 0 }}>✅ OS FINALIZADAS ({osFinalizadasNovas.length})</p>
            <button onClick={marcarTodasOsFinalizadasLidas} style={{ background: 'transparent', border: 'none', color: '#4A5568', fontSize: 11, cursor: 'pointer', fontWeight: 700, letterSpacing: 1 }}>MARCAR COMO LIDAS</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {osFinalizadasNovas.map(os => {
              const valor = valorOSFinalizada(os)
              const ehPlano = !!os.plano_id
              return (
                <div key={os.id} style={{ background: 'rgba(72,187,120,0.05)', border: '1px solid rgba(72,187,120,0.15)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>✅</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0 }}>OS finalizada — {os.cliente?.nome}</p>
                      {ehPlano && <span style={{ background: 'rgba(144,205,244,0.1)', color: '#90CDF4', fontSize: 9, padding: '2px 7px', borderRadius: 6, fontWeight: 700, border: '1px solid rgba(144,205,244,0.2)' }}>PLANO</span>}
                    </div>
                    <p style={{ color: '#4A5568', fontSize: 12, margin: 0 }}>
                      {os.veiculo?.marca} {os.veiculo?.modelo} · {os.veiculo?.placa}
                      {os.finalizado_em && ` · ${new Date(os.finalizado_em).toLocaleDateString('pt-BR')}`}
                      {valor > 0 && !ehPlano && <span style={{ color: '#48BB78', fontWeight: 700 }}> · R$ {valor.toFixed(2).replace('.', ',')} — verificar cobrança</span>}
                      {valor > 0 && ehPlano && <span style={{ color: '#90CDF4' }}> · R$ {valor.toFixed(2).replace('.', ',')} — plano mensal</span>}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => router.push('/ordens')} style={{ background: 'rgba(72,187,120,0.1)', border: '1px solid rgba(72,187,120,0.3)', color: '#48BB78', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>VER</button>
                    <button onClick={() => marcarOsFinalizadaLida(os.id)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>✕</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Notificações solicitações agendamento ── */}
      {solicitacoesNovas.length > 0 && (
        <div style={{ background: '#0D1220', border: '1px solid rgba(144,205,244,0.25)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <p style={{ color: '#90CDF4', fontSize: 12, fontWeight: 700, letterSpacing: 2, margin: '0 0 12px' }}>📅 SOLICITAÇÕES DE AGENDAMENTO ({solicitacoesNovas.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {solicitacoesNovas.map(s => (
              <div key={s.id} style={{ background: 'rgba(144,205,244,0.05)', border: '1px solid rgba(144,205,244,0.15)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>{s.solicitante_nome} — {new Date(s.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} às {s.hora?.slice(0,5)}</p>
                    <p style={{ color: '#4A5568', fontSize: 12, margin: 0 }}>{s.solicitante_veiculo} · {s.servico || 'Serviço não especificado'}{s.solicitante_telefone && ` · ${s.solicitante_telefone}`}</p>
                    {s.observacoes && <p style={{ color: '#4A5568', fontSize: 11, margin: '4px 0 0', fontStyle: 'italic' }}>"{s.observacoes}"</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => aprovarSolicitacao(s)} style={{ background: 'rgba(72,187,120,0.1)', border: '1px solid rgba(72,187,120,0.3)', color: '#48BB78', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✅ APROVAR</button>
                    <button onClick={() => recusarSolicitacao(s)} style={{ background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', color: '#FC8181', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>❌ RECUSAR</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Notificações orçamentos ── */}
      {orcamentosNovos.length > 0 && (
        <div style={{ background: '#0D1220', border: '1px solid rgba(212,168,67,0.25)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ color: '#D4A843', fontSize: 12, fontWeight: 700, letterSpacing: 2, margin: 0 }}>🔔 ORÇAMENTOS ({orcamentosNovos.length})</p>
            <button onClick={marcarTodosLidosOrcamentos} style={{ background: 'transparent', border: 'none', color: '#4A5568', fontSize: 11, cursor: 'pointer', fontWeight: 700, letterSpacing: 1 }}>MARCAR COMO LIDAS</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orcamentosNovos.map(o => (
              <div key={o.id} style={{ background: o.status === 'aprovado' ? 'rgba(72,187,120,0.06)' : 'rgba(252,129,129,0.06)', border: `1px solid ${o.status === 'aprovado' ? 'rgba(72,187,120,0.2)' : 'rgba(252,129,129,0.2)'}`, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>{o.status === 'aprovado' ? '✅' : '❌'}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0 }}>{o.status === 'aprovado' ? 'Orçamento aprovado' : 'Orçamento recusado'} — {o.cliente?.nome}</p>
                  <p style={{ color: '#4A5568', fontSize: 12, margin: '3px 0 0' }}>{o.veiculo?.modelo} · {o.veiculo?.placa} · #{o.token}</p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => router.push('/orcamentos')} style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.3)', color: '#D4A843', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>VER</button>
                  <button onClick={() => marcarLidoOrcamento(o.id)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {cards.map((c, i) => (
          <div key={i} onClick={() => c.href && router.push(c.href)}
            style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, position: 'relative' as const, overflow: 'hidden', cursor: c.href ? 'pointer' : 'default' }}>
            <div style={{ position: 'absolute' as const, top: 0, left: 0, right: 0, height: 2, background: c.gradiente }} />
            <p style={{ color: '#4A5568', fontSize: 10, fontWeight: 700, letterSpacing: 2, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>{c.icon}</span> {c.label}
            </p>
            <p style={{ color: c.cor, fontSize: c.label === 'FATURAMENTO' ? 18 : 28, fontWeight: 900, letterSpacing: 1, margin: 0 }}>{c.value}</p>
            <p style={{ color: '#4A5568', fontSize: 11, marginTop: 6 }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Métricas faturamento ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14 }}>
          <p style={{ color: '#4A5568', fontSize: 10, fontWeight: 700, letterSpacing: 2, margin: '0 0 8px' }}>🎯 TICKET MÉDIO</p>
          <p style={{ color: '#CBD5E0', fontSize: 20, fontWeight: 900, margin: 0 }}>R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p style={{ color: '#4A5568', fontSize: 11, marginTop: 4 }}>por OS finalizada</p>
        </div>
        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14 }}>
          <p style={{ color: '#4A5568', fontSize: 10, fontWeight: 700, letterSpacing: 2, margin: '0 0 8px' }}>📊 MÊS ANTERIOR</p>
          <p style={{ color: '#CBD5E0', fontSize: 20, fontWeight: 900, margin: 0 }}>R$ {faturamentoMesAnterior.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p style={{ color: variacaoPositiva ? '#48BB78' : '#FC8181', fontSize: 11, fontWeight: 700, marginTop: 4 }}>{variacaoPositiva ? '▲' : '▼'} {Math.abs(variacao).toFixed(0)}% vs atual</p>
        </div>
      </div>

      {/* ── Gráfico + Top serviços ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 }}>
          <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: '0 0 16px' }}>📈 Faturamento — Semana Atual</p>
          <div style={{ position: 'relative' as const, height: 160, display: 'flex', alignItems: 'flex-end', gap: 6, paddingBottom: 24 }}>
            {graficoSemana.map((d, idx) => {
              const AREA_H = 136
              const alturaPx = maxValorSemana > 0 ? Math.max((d.valor / maxValorSemana) * AREA_H, d.valor > 0 ? 20 : 3) : 3
              const isHoje = idx === diaAtualIdx
              return (
                <div key={d.dia} style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 0 }}>
                  {d.valor > 0 && <p style={{ color: '#D4A843', fontSize: 9, fontWeight: 700, margin: '0 0 3px', whiteSpace: 'nowrap' as const }}>{d.valor >= 1000 ? `${(d.valor/1000).toFixed(1)}k` : d.valor.toFixed(0)}</p>}
                  <div style={{ width: '80%', height: alturaPx, background: isHoje ? 'linear-gradient(180deg, #F0C060, #D4A843)' : d.valor > 0 ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.05)', borderRadius: '4px 4px 0 0', transition: 'height 0.4s ease', marginBottom: 6 }} />
                  <p style={{ color: isHoje ? '#D4A843' : '#4A5568', fontSize: 10, fontWeight: isHoje ? 700 : 400, margin: 0, position: 'absolute' as const, bottom: 0 }}>{d.dia}</p>
                </div>
              )
            })}
          </div>
          {graficoSemana.every(d => d.valor === 0) && <p style={{ color: '#4A5568', fontSize: 12, textAlign: 'center' as const, marginTop: 8 }}>Sem OS finalizadas esta semana</p>}
        </div>

        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 }}>
          <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: '0 0 16px' }}>🏆 Top Serviços — Mês Atual</p>
          {topServicos.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100 }}><p style={{ color: '#4A5568', fontSize: 13 }}>Sem dados no mês</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topServicos.map((s, i) => {
                const pct = topServicos[0].total > 0 ? (s.total / topServicos[0].total) * 100 : 0
                return (
                  <div key={s.nome}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: i === 0 ? '#D4A843' : '#4A5568', fontSize: 11, fontWeight: 700 }}>#{i+1}</span>
                        <p style={{ color: '#CBD5E0', fontSize: 12, margin: 0, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{s.nome}</p>
                      </div>
                      <div style={{ textAlign: 'right' as const }}>
                        <p style={{ color: '#D4A843', fontSize: 12, fontWeight: 700, margin: 0 }}>R$ {s.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p style={{ color: '#4A5568', fontSize: 10, margin: 0 }}>{s.qtd}x</p>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                      <div style={{ background: i === 0 ? 'linear-gradient(90deg, #D4A843, #F0C060)' : 'rgba(212,168,67,0.3)', height: '100%', width: `${pct}%`, borderRadius: 4, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Painéis OS + Agenda ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0 }}>Ordens de Serviço</p>
            <span onClick={() => router.push('/ordens')} style={{ color: '#D4A843', fontSize: 10, letterSpacing: 2, cursor: 'pointer', fontWeight: 700 }}>VER TODAS →</span>
          </div>
          {totais.osAbertas > 0 ? (
            <div style={{ textAlign: 'center' as const, padding: '16px 0' }}>
              <p style={{ color: '#D4A843', fontSize: 32, fontWeight: 900, margin: '0 0 8px' }}>{totais.osAbertas}</p>
              <p style={{ color: '#4A5568', fontSize: 13, margin: '0 0 12px' }}>ordens em aberto ou andamento</p>
              <button onClick={() => router.push('/ordens')} style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.3)', color: '#D4A843', padding: '8px 20px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>VER OS →</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100, flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 28 }}>🔧</span>
              <p style={{ color: '#4A5568', fontSize: 13 }}>Nenhuma OS aberta</p>
              <button onClick={() => router.push('/ordens')} style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.3)', color: '#D4A843', padding: '6px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>CRIAR OS</button>
            </div>
          )}
        </div>
        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0 }}>Agenda de Hoje</p>
            <span onClick={() => router.push('/agenda')} style={{ color: '#D4A843', fontSize: 10, letterSpacing: 2, cursor: 'pointer', fontWeight: 700 }}>GERENCIAR →</span>
          </div>
          {totais.agendamentosHoje > 0 ? (
            <div style={{ textAlign: 'center' as const, padding: '16px 0' }}>
              <p style={{ color: '#48BB78', fontSize: 32, fontWeight: 900, margin: '0 0 8px' }}>{totais.agendamentosHoje}</p>
              <p style={{ color: '#4A5568', fontSize: 13, margin: '0 0 12px' }}>agendamentos hoje</p>
              <button onClick={() => router.push('/agenda')} style={{ background: 'rgba(72,187,120,0.1)', border: '1px solid rgba(72,187,120,0.2)', color: '#48BB78', padding: '8px 20px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>VER AGENDA →</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100, flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 28 }}>📅</span>
              <p style={{ color: '#4A5568', fontSize: 13 }}>Sem agendamentos hoje</p>
              <button onClick={() => router.push('/agenda')} style={{ background: 'rgba(144,205,244,0.1)', border: '1px solid rgba(144,205,244,0.2)', color: '#90CDF4', padding: '6px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>NOVO AGENDAMENTO</button>
            </div>
          )}
        </div>
      </div>

      {empresa?.token_publico && (
        <div style={{ marginTop: 12, background: 'rgba(144,205,244,0.04)', border: '1px solid rgba(144,205,244,0.15)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ color: '#90CDF4', fontSize: 12, fontWeight: 700, margin: '0 0 4px', letterSpacing: 1 }}>🔗 LINK DE AGENDAMENTO PÚBLICO</p>
            <p style={{ color: '#4A5568', fontSize: 12, margin: 0 }}>Compartilhe com seus clientes para receberem solicitações.</p>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/agendar/${empresa.token_publico}`); alert('Link copiado!') }}
            style={{ background: '#90CDF4', border: 'none', color: '#080C18', padding: '8px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 900, letterSpacing: 1, whiteSpace: 'nowrap' as const }}>
            COPIAR LINK
          </button>
        </div>
      )}

      {empresa && !empresa.whatsapp && (
        <div style={{ marginTop: 12, background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.15)', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ color: '#D4A843', fontSize: 13, fontWeight: 700, margin: '0 0 4px', letterSpacing: 1 }}>⚙️ COMPLETE SEU PERFIL</p>
            <p style={{ color: '#4A5568', fontSize: 13, margin: 0 }}>Adicione WhatsApp, endereço e logo para usar todos os recursos.</p>
          </div>
          <button onClick={() => router.push('/configuracoes')} style={{ background: '#D4A843', border: 'none', color: '#080C18', padding: '10px 20px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 900, letterSpacing: 1, whiteSpace: 'nowrap' as const }}>CONFIGURAR →</button>
        </div>
      )}
    </div>
  )
}