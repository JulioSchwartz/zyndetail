'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Plano = {
  id: string
  empresa_id: string
  cliente_id: string
  veiculo_id: string
  periodicidade: string
  dia_semana?: string
  hora_preferida?: string
  servicos: string[]
  valor_mensal?: number
  status: string
  observacoes?: string
  ultimo_atendimento?: string
  proximo_atendimento?: string
  agendamento_id?: string
  criado_em: string
  cliente?: any
  veiculo?: any
}

type Aba = 'lista' | 'novo' | 'detalhe'

const PERIODICIDADE: Record<string, { label: string, icon: string, cor: string, dias: number }> = {
  semanal:   { label: 'Semanal',   icon: '🔄', cor: '#D4A843', dias: 7  },
  quinzenal: { label: 'Quinzenal', icon: '📅', cor: '#90CDF4', dias: 15 },
  mensal:    { label: 'Mensal',    icon: '🗓️', cor: '#48BB78', dias: 30 },
}

const STATUS_CONFIG: Record<string, { label: string, cor: string, bg: string }> = {
  ativo:     { label: 'ATIVO',     cor: '#48BB78', bg: 'rgba(72,187,120,0.1)'   },
  pausado:   { label: 'PAUSADO',   cor: '#D4A843', bg: 'rgba(212,168,67,0.1)'  },
  cancelado: { label: 'CANCELADO', cor: '#FC8181', bg: 'rgba(252,129,129,0.1)' },
}

const DIAS_OPTIONS = [
  { key: 'seg', label: 'Segunda' }, { key: 'ter', label: 'Terça'   },
  { key: 'qua', label: 'Quarta'  }, { key: 'qui', label: 'Quinta'  },
  { key: 'sex', label: 'Sexta'   }, { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
]

const HORAS = ['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30',
               '11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30',
               '15:00','15:30','16:00','16:30','17:00','17:30','18:00']

function calcularProximoAtendimento(ultimo: string | undefined, periodicidade: string): string {
  const base = ultimo ? new Date(ultimo + 'T12:00:00') : new Date()
  const dias = PERIODICIDADE[periodicidade]?.dias || 7
  base.setDate(base.getDate() + dias)
  return base.toISOString().split('T')[0]
}

function diasAteProximo(data: string): number {
  const agora = new Date()
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  const [ano, mes, dia] = data.split('-').map(Number)
  const proximo = new Date(ano, mes - 1, dia)
  return Math.ceil((proximo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

export default function PlanosClient() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<Aba>('lista')
  const [planos, setPlanos] = useState<Plano[]>([])
  const [planoSelecionado, setPlanoSelecionado] = useState<Plano | null>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('todos')

  // Form
  const [clienteId, setClienteId] = useState('')
  const [veiculoId, setVeiculoId] = useState('')
  const [periodicidade, setPeriodicidade] = useState('semanal')
  const [diaSemana, setDiaSemana] = useState('seg')
  const [horaPreferida, setHoraPreferida] = useState('09:00')
  const [servicosSelecionados, setServicosSelecionados] = useState<string[]>([])
  const [valorMensal, setValorMensal] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [ultimoAtendimento, setUltimoAtendimento] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/auth/login'); return }
      const { data: usuario } = await supabase.from('usuarios_detail').select('empresa_id').eq('user_id', session.user.id).maybeSingle()
      if (!usuario?.empresa_id) { router.push('/auth/login'); return }
      setEmpresaId(usuario.empresa_id)
      await Promise.all([carregarPlanos(usuario.empresa_id), carregarDados(usuario.empresa_id)])
      setLoading(false)
    }
    init()
  }, [])

  async function carregarPlanos(eid: string) {
    const { data } = await supabase
      .from('planos_manutencao')
      .select('*, cliente:clientes(*), veiculo:veiculos(*)')
      .eq('empresa_id', eid)
      .order('criado_em', { ascending: false })
    setPlanos(data || [])
  }

  async function carregarDados(eid: string) {
    const [{ data: cls }, { data: servs }] = await Promise.all([
      supabase.from('clientes').select('*, veiculos(*)').eq('empresa_id', eid).order('nome'),
      supabase.from('servicos_catalogo').select('*').eq('empresa_id', eid).eq('ativo', true).order('nome'),
    ])
    setClientes(cls || [])
    setServicos(servs || [])
  }

  // Cria agendamento na agenda e retorna o id
  async function criarAgendamento(planoData: {
    empresa_id: string, cliente_id: string, veiculo_id: string,
    data: string, hora: string, servicos: string[], observacoes?: string
  }): Promise<string | null> {
    const { data } = await supabase.from('agendamentos').insert({
      empresa_id: planoData.empresa_id,
      cliente_id: planoData.cliente_id,
      veiculo_id: planoData.veiculo_id,
      titulo: `Plano — ${planoData.servicos.join(', ')}`,
      data: planoData.data,
      hora: planoData.hora,
      duracao_minutos: 60,
      servico: planoData.servicos.join(', '),
      status: 'agendado',
      observacoes: planoData.observacoes || null,
      tipo: 'plano',
    }).select('id').single()
    return data?.id || null
  }

  async function salvarPlano() {
    setErro('')
    if (!clienteId) { setErro('Selecione um cliente.'); return }
    if (!veiculoId) { setErro('Selecione um veículo.'); return }
    if (servicosSelecionados.length === 0) { setErro('Selecione ao menos um serviço.'); return }
    setSalvando(true)

    const proximo = calcularProximoAtendimento(ultimoAtendimento || undefined, periodicidade)

    // Cria o agendamento na agenda
    const agId = await criarAgendamento({
      empresa_id: empresaId!,
      cliente_id: clienteId,
      veiculo_id: veiculoId,
      data: proximo,
      hora: horaPreferida,
      servicos: servicosSelecionados,
      observacoes: observacoes || undefined,
    })

    const { error } = await supabase.from('planos_manutencao').insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      veiculo_id: veiculoId,
      periodicidade,
      dia_semana: diaSemana || null,
      hora_preferida: horaPreferida || null,
      servicos: servicosSelecionados,
      valor_mensal: valorMensal ? parseFloat(valorMensal.replace(',', '.')) : null,
      status: 'ativo',
      observacoes: observacoes.trim() || null,
      ultimo_atendimento: ultimoAtendimento || null,
      proximo_atendimento: proximo,
      agendamento_id: agId,
    })

    if (error) { setErro('Erro ao salvar plano.'); setSalvando(false); return }

    await carregarPlanos(empresaId!)
    limparForm()
    setAba('lista')
    setSalvando(false)
  }

  async function registrarAtendimento(plano: Plano) {
    const hoje = new Date().toISOString().split('T')[0]
    const proximo = calcularProximoAtendimento(hoje, plano.periodicidade)

    // Marca agendamento atual como concluído
    if (plano.agendamento_id) {
      await supabase.from('agendamentos').update({ status: 'concluido' }).eq('id', plano.agendamento_id)
    }

    // Cria novo agendamento para o próximo
    const novoAgId = await criarAgendamento({
      empresa_id: plano.empresa_id,
      cliente_id: plano.cliente_id,
      veiculo_id: plano.veiculo_id,
      data: proximo,
      hora: plano.hora_preferida || '09:00',
      servicos: plano.servicos || [],
      observacoes: plano.observacoes || undefined,
    })

    await supabase.from('planos_manutencao').update({
      ultimo_atendimento: hoje,
      proximo_atendimento: proximo,
      agendamento_id: novoAgId,
    }).eq('id', plano.id)

    await carregarPlanos(empresaId!)
    if (planoSelecionado?.id === plano.id) {
      setPlanoSelecionado(prev => prev ? {
        ...prev,
        ultimo_atendimento: hoje,
        proximo_atendimento: proximo,
        agendamento_id: novoAgId || undefined,
      } : null)
    }
  }

  async function atualizarStatus(id: string, novoStatus: string) {
    await supabase.from('planos_manutencao').update({ status: novoStatus }).eq('id', id)
    await carregarPlanos(empresaId!)
    if (planoSelecionado?.id === id) setPlanoSelecionado(prev => prev ? { ...prev, status: novoStatus } : null)
  }

  async function excluirPlano(id: string) {
    if (!confirm('Excluir este plano de manutenção?')) return
    await supabase.from('planos_manutencao').delete().eq('id', id)
    await carregarPlanos(empresaId!)
    setAba('lista')
  }

  function toggleServico(nome: string) {
    setServicosSelecionados(prev => prev.includes(nome) ? prev.filter(s => s !== nome) : [...prev, nome])
  }

  function limparForm() {
    setClienteId(''); setVeiculoId(''); setPeriodicidade('semanal')
    setDiaSemana('seg'); setHoraPreferida('09:00'); setServicosSelecionados([])
    setValorMensal(''); setObservacoes(''); setUltimoAtendimento(''); setErro('')
  }

  const veiculosCliente = clientes.find(c => c.id === clienteId)?.veiculos || []
  const planosFiltrados = filtro === 'todos' ? planos : planos.filter(p => p.status === filtro)
  const ativos = planos.filter(p => p.status === 'ativo').length
  const proximosHoje = planos.filter(p => {
    if (!p.proximo_atendimento || p.status !== 'ativo') return false
    return diasAteProximo(p.proximo_atendimento) <= 2
  }).length

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#080C18', fontSize: 22, fontWeight: 900 }}>Z</span>
      </div>
      <p style={{ color: '#D4A843', fontWeight: 700, letterSpacing: 2, fontSize: 12 }}>CARREGANDO...</p>
    </div>
  )

  const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', background: '#080C18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff', fontSize: 14, boxSizing: 'border-box' as const, outline: 'none' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#4A5568', display: 'block', marginBottom: 6, letterSpacing: 1 }

  // ── LISTA ──
  if (aba === 'lista') return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0 }}>💎 Planos de Manutenção</h1>
          <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', margin: '8px 0' }} />
          <p style={{ color: '#4A5568', fontSize: 13, margin: 0 }}>{ativos} planos ativos · {planos.length} total</p>
        </div>
        <button onClick={() => { limparForm(); setAba('novo') }}
          style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '10px 20px', borderRadius: 8, fontWeight: 900, fontSize: 13, cursor: 'pointer', letterSpacing: 1 }}>
          + NOVO PLANO
        </button>
      </div>

      {proximosHoje > 0 && (
        <div style={{ background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.25)', borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>⏰</span>
          <p style={{ color: '#D4A843', fontSize: 13, fontWeight: 700, margin: 0 }}>
            {proximosHoje} cliente{proximosHoje > 1 ? 's' : ''} com atendimento nos próximos 2 dias!
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as const }}>
        {['todos', 'ativo', 'pausado', 'cancelado'].map(f => {
          const qtd = f === 'todos' ? planos.length : planos.filter(p => p.status === f).length
          return (
            <button key={f} onClick={() => setFiltro(f)}
              style={{ background: filtro === f ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${filtro === f ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: filtro === f ? '#D4A843' : '#4A5568', padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: filtro === f ? 700 : 400 }}>
              {f === 'todos' ? `Todos (${qtd})` : `${STATUS_CONFIG[f]?.label} (${qtd})`}
            </button>
          )
        })}
      </div>

      {planosFiltrados.length === 0 ? (
        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 40, textAlign: 'center' as const }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>💎</p>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Nenhum plano cadastrado</p>
          <p style={{ color: '#4A5568', fontSize: 13, marginBottom: 20 }}>Cadastre clientes com serviços recorrentes.</p>
          <button onClick={() => { limparForm(); setAba('novo') }}
            style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '10px 24px', borderRadius: 8, fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>
            + CRIAR PRIMEIRO PLANO
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {planosFiltrados.map(p => {
            const st = STATUS_CONFIG[p.status]
            const per = PERIODICIDADE[p.periodicidade]
            const diasRestantes = p.proximo_atendimento ? diasAteProximo(p.proximo_atendimento) : null
            const urgente = diasRestantes !== null && diasRestantes <= 2 && p.status === 'ativo'
            return (
              <div key={p.id} onClick={() => { setPlanoSelecionado(p); setAba('detalhe') }}
                style={{ background: '#0D1220', border: `1px solid ${urgente ? 'rgba(212,168,67,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, padding: 16, cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ background: `${per?.cor}18`, border: `1px solid ${per?.cor}44`, borderRadius: 12, width: 52, height: 52, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 20 }}>{per?.icon}</span>
                  <p style={{ color: per?.cor, fontSize: 9, fontWeight: 700, margin: 0, letterSpacing: 1 }}>{per?.label.toUpperCase().slice(0,3)}</p>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: 0 }}>{p.cliente?.nome}</p>
                    <span style={{ background: st.bg, color: st.cor, fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>{st.label}</span>
                    {urgente && <span style={{ background: 'rgba(212,168,67,0.15)', color: '#D4A843', fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>⏰ HOJE/AMANHÃ</span>}
                  </div>
                  <p style={{ color: '#4A5568', fontSize: 12, margin: 0 }}>
                    {p.veiculo?.marca} {p.veiculo?.modelo} · {p.veiculo?.placa}
                    {p.hora_preferida && ` · ${p.hora_preferida.slice(0,5)}`}
                  </p>
                  <p style={{ color: '#4A5568', fontSize: 11, margin: '4px 0 0' }}>{(p.servicos || []).join(' · ')}</p>
                </div>
                <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                  {p.valor_mensal && <p style={{ color: '#D4A843', fontSize: 15, fontWeight: 900, margin: '0 0 4px' }}>R$ {p.valor_mensal.toFixed(2).replace('.', ',')}<span style={{ color: '#4A5568', fontSize: 10 }}>/mês</span></p>}
                  {p.proximo_atendimento && (
                    <p style={{ color: diasRestantes !== null && diasRestantes <= 0 ? '#FC8181' : diasRestantes !== null && diasRestantes <= 2 ? '#D4A843' : '#4A5568', fontSize: 11, margin: 0, fontWeight: urgente ? 700 : 400 }}>
                      {diasRestantes !== null && diasRestantes <= 0 ? '⚠️ Atrasado' : `Em ${diasRestantes}d`}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── NOVO PLANO ──
  if (aba === 'novo') return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => setAba('lista')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>← Voltar</button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>Novo Plano de Manutenção</h1>
          <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', marginTop: 6 }} />
        </div>
      </div>

      <div style={{ background: 'rgba(144,205,244,0.06)', border: '1px solid rgba(144,205,244,0.2)', borderRadius: 10, padding: '10px 16px', marginBottom: 20, maxWidth: 760 }}>
        <p style={{ color: '#90CDF4', fontSize: 13, margin: 0 }}>📅 O agendamento será criado automaticamente na Agenda para o próximo atendimento.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 760 }}>
        <div style={{ gridColumn: '1 / -1', background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>CLIENTE E VEÍCULO</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Cliente <span style={{ color: '#D4A843' }}>*</span></label>
              <select style={inp} value={clienteId} onChange={e => { setClienteId(e.target.value); setVeiculoId('') }}>
                <option value="">Selecione...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Veículo <span style={{ color: '#D4A843' }}>*</span></label>
              <select style={inp} value={veiculoId} onChange={e => setVeiculoId(e.target.value)} disabled={!clienteId}>
                <option value="">Selecione...</option>
                {veiculosCliente.map((v: any) => <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>PERIODICIDADE</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {Object.entries(PERIODICIDADE).map(([k, v]) => (
              <button key={k} onClick={() => setPeriodicidade(k)}
                style={{ flex: 1, background: periodicidade === k ? `${v.cor}18` : 'rgba(255,255,255,0.04)', border: `1px solid ${periodicidade === k ? v.cor + '55' : 'rgba(255,255,255,0.08)'}`, color: periodicidade === k ? v.cor : '#4A5568', padding: '10px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: periodicidade === k ? 700 : 400, textAlign: 'center' as const }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{v.icon}</div>
                {v.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Dia preferido</label>
              <select style={inp} value={diaSemana} onChange={e => setDiaSemana(e.target.value)}>
                {DIAS_OPTIONS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Horário preferido</label>
              <select style={inp} value={horaPreferida} onChange={e => setHoraPreferida(e.target.value)}>
                {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>VALOR E HISTÓRICO</p>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Valor mensal (R$)</label>
            <input style={inp} value={valorMensal} onChange={e => setValorMensal(e.target.value)} placeholder="Ex: 150,00" />
          </div>
          <div>
            <label style={lbl}>Último atendimento</label>
            <input style={inp} type="date" value={ultimoAtendimento} onChange={e => setUltimoAtendimento(e.target.value)} />
            <p style={{ color: '#4A5568', fontSize: 11, marginTop: 6 }}>Deixe vazio para calcular a partir de hoje.</p>
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1', background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>
            SERVIÇOS DO PLANO <span style={{ color: '#D4A843' }}>*</span>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 12 }}>
            {servicos.map(s => {
              const sel = servicosSelecionados.includes(s.nome)
              return (
                <button key={s.id} onClick={() => toggleServico(s.nome)}
                  style={{ background: sel ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${sel ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: sel ? '#D4A843' : '#4A5568', padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: sel ? 700 : 400 }}>
                  {sel ? '✓ ' : ''}{s.nome}
                </button>
              )
            })}
            {servicos.length === 0 && <p style={{ color: '#4A5568', fontSize: 13 }}>Nenhum serviço ativo no catálogo.</p>}
          </div>
          <div>
            <label style={lbl}>Observações</label>
            <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' as const }} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Detalhes do plano, preferências do cliente..." />
          </div>
        </div>
      </div>

      {erro && <div style={{ color: '#FC8181', fontSize: 13, margin: '16px 0', background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', borderRadius: 8, padding: '10px 14px', maxWidth: 760 }}>{erro}</div>}

      <button onClick={salvarPlano} disabled={salvando}
        style={{ width: '100%', maxWidth: 760, background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: 16, borderRadius: 12, fontWeight: 900, fontSize: 15, cursor: 'pointer', letterSpacing: 1, marginTop: 16 }}>
        {salvando ? 'SALVANDO...' : 'CRIAR PLANO E AGENDAR'}
      </button>
    </div>
  )

  // ── DETALHE ──
  if (aba === 'detalhe' && planoSelecionado) {
    const st = STATUS_CONFIG[planoSelecionado.status]
    const per = PERIODICIDADE[planoSelecionado.periodicidade]
    const diasRestantes = planoSelecionado.proximo_atendimento ? diasAteProximo(planoSelecionado.proximo_atendimento) : null

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => setAba('lista')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>← Voltar</button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>{planoSelecionado.cliente?.nome}</h1>
              <span style={{ background: st.bg, color: st.cor, fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 700 }}>{st.label}</span>
              <span style={{ background: `${per?.cor}18`, color: per?.cor, fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 700 }}>{per?.icon} {per?.label}</span>
            </div>
            <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', marginTop: 6 }} />
          </div>
          <button onClick={() => excluirPlano(planoSelecionado.id)} style={{ background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', color: '#FC8181', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>EXCLUIR</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>DADOS DO PLANO</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
                {[
                  { label: 'Veículo', valor: `${planoSelecionado.veiculo?.marca} ${planoSelecionado.veiculo?.modelo}` },
                  { label: 'Placa', valor: planoSelecionado.veiculo?.placa },
                  { label: 'Dia Preferido', valor: DIAS_OPTIONS.find(d => d.key === planoSelecionado.dia_semana)?.label || '—' },
                  { label: 'Horário', valor: planoSelecionado.hora_preferida?.slice(0,5) || '—' },
                  { label: 'Último Atendimento', valor: planoSelecionado.ultimo_atendimento ? new Date(planoSelecionado.ultimo_atendimento + 'T12:00:00').toLocaleDateString('pt-BR') : 'Nenhum' },
                  { label: 'Próximo Atendimento', valor: planoSelecionado.proximo_atendimento ? new Date(planoSelecionado.proximo_atendimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—' },
                ].map((item, i) => (
                  <div key={i}>
                    <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>{item.label.toUpperCase()}</p>
                    <p style={{ color: '#fff', fontSize: 14, margin: 0 }}>{item.valor}</p>
                  </div>
                ))}
              </div>
              {planoSelecionado.observacoes && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>OBSERVAÇÕES</p>
                  <p style={{ color: '#CBD5E0', fontSize: 13, margin: 0 }}>{planoSelecionado.observacoes}</p>
                </div>
              )}
            </div>

            <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>SERVIÇOS INCLUSOS</p>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                {(planoSelecionado.servicos || []).map((s, i) => (
                  <span key={i} style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)', color: '#D4A843', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>✓ {s}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: diasRestantes !== null && diasRestantes <= 2 ? 'rgba(212,168,67,0.06)' : '#0D1220', border: `1px solid ${diasRestantes !== null && diasRestantes <= 2 ? 'rgba(212,168,67,0.25)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, padding: 20, textAlign: 'center' as const }}>
              <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>PRÓXIMO ATENDIMENTO</p>
              {planoSelecionado.proximo_atendimento ? (
                <>
                  <p style={{ color: '#fff', fontSize: 16, fontWeight: 900, margin: '0 0 4px' }}>
                    {new Date(planoSelecionado.proximo_atendimento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                  </p>
                  <p style={{ color: diasRestantes !== null && diasRestantes <= 0 ? '#FC8181' : diasRestantes !== null && diasRestantes <= 2 ? '#D4A843' : '#4A5568', fontSize: 13, fontWeight: 700, margin: 0 }}>
                    {diasRestantes !== null && diasRestantes <= 0 ? '⚠️ Atrasado!' : diasRestantes === 1 ? '⏰ Amanhã!' : `Em ${diasRestantes} dias`}
                  </p>
                  <p style={{ color: '#4A5568', fontSize: 11, margin: '6px 0 0' }}>✅ Agendado na Agenda</p>
                </>
              ) : <p style={{ color: '#4A5568', fontSize: 14, margin: 0 }}>Não definido</p>}
            </div>

            {planoSelecionado.valor_mensal && (
              <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, textAlign: 'center' as const }}>
                <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>VALOR MENSAL</p>
                <p style={{ color: '#D4A843', fontSize: 24, fontWeight: 900, margin: 0 }}>R$ {planoSelecionado.valor_mensal.toFixed(2).replace('.', ',')}</p>
              </div>
            )}

            {planoSelecionado.status === 'ativo' && (
              <button onClick={() => registrarAtendimento(planoSelecionado)}
                style={{ width: '100%', background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '12px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 900, letterSpacing: 1 }}>
                ✅ REGISTRAR ATENDIMENTO
              </button>
            )}

            {planoSelecionado.status === 'ativo' && (
              <button onClick={() => router.push('/agenda')}
                style={{ width: '100%', background: 'rgba(144,205,244,0.1)', border: '1px solid rgba(144,205,244,0.2)', color: '#90CDF4', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
                📅 VER NA AGENDA
              </button>
            )}

            {planoSelecionado.cliente?.telefone && (
              <button onClick={() => {
                const tel = planoSelecionado.cliente.telefone.replace(/\D/g, '')
                const data = planoSelecionado.proximo_atendimento
                  ? new Date(planoSelecionado.proximo_atendimento + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
                  : 'em breve'
                const servs = (planoSelecionado.servicos || []).join(', ')
                const hora = planoSelecionado.hora_preferida?.slice(0,5) || ''
                const msg = `Olá, ${planoSelecionado.cliente.nome.split(' ')[0]}! 👋\n\nPassando para lembrar que o próximo atendimento do seu *${planoSelecionado.veiculo?.modelo}* (${planoSelecionado.veiculo?.placa}) está previsto para *${data}*${hora ? ` às *${hora}*` : ''}.\n\nServiços: ${servs}\n\nAguardamos você! ✨`
                window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank')
              }}
                style={{ width: '100%', background: 'rgba(72,187,120,0.1)', border: '1px solid rgba(72,187,120,0.2)', color: '#48BB78', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
                📱 LEMBRETE WHATSAPP
              </button>
            )}

            <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 14 }}>
              <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>ALTERAR STATUS</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(STATUS_CONFIG).filter(([k]) => k !== planoSelecionado.status).map(([k, v]) => (
                  <button key={k} onClick={() => atualizarStatus(planoSelecionado.id, k)}
                    style={{ background: v.bg, border: `1px solid ${v.cor}33`, color: v.cor, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}