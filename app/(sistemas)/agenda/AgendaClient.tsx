'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Agendamento = {
  id: string
  empresa_id: string
  cliente_id?: string
  veiculo_id?: string
  titulo?: string
  data: string
  hora: string
  duracao_minutos: number
  servico?: string
  status: string
  observacoes?: string
  tipo: string
  criado_em: string
  cliente?: any
  veiculo?: any
}

type VisualizacaoTipo = 'semana' | 'lista'

const DIAS_SEMANA_KEY = ['dom','seg','ter','qua','qui','sex','sab']
const SLOT_HEIGHT = 52

const STATUS_CONFIG: Record<string, { label: string, cor: string, bg: string }> = {
  agendado:   { label: 'AGENDADO',   cor: '#90CDF4', bg: 'rgba(144,205,244,0.15)' },
  confirmado: { label: 'CONFIRMADO', cor: '#D4A843', bg: 'rgba(212,168,67,0.15)'  },
  concluido:  { label: 'CONCLUÍDO',  cor: '#48BB78', bg: 'rgba(72,187,120,0.15)'  },
  cancelado:  { label: 'CANCELADO',  cor: '#FC8181', bg: 'rgba(252,129,129,0.15)' },
  pendente:   { label: 'PENDENTE',   cor: '#CBD5E0', bg: 'rgba(203,213,224,0.15)' },
}

function getDiasSemana(dataBase: Date) {
  const dias = []
  const inicio = new Date(dataBase)
  const diaSemana = inicio.getDay()
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana
  inicio.setDate(inicio.getDate() + diff)
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio)
    d.setDate(inicio.getDate() + i)
    dias.push(d)
  }
  return dias
}

function formatarDataLocal(d: Date) {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function nomeDia(d: Date) {
  return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase()
}

function horaParaMinutos(hora: string) {
  const [h, m] = hora.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function minutosParaTop(minutos: number, aberturaMin: number) {
  return ((minutos - aberturaMin) / 30) * SLOT_HEIGHT
}

function formatarDuracao(min: number) {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export default function AgendaClient() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [empresa, setEmpresa] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])
  const [visualizacao, setVisualizacao] = useState<VisualizacaoTipo>('semana')
  const [semanaBase, setSemanaBase] = useState(new Date())
  const [modalAberto, setModalAberto] = useState(false)
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<Agendamento | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  const [clienteId, setClienteId] = useState('')
  const [veiculoId, setVeiculoId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('09:00')
  const [duracao, setDuracao] = useState('60')
  const [servicoNome, setServicoNome] = useState('')
  const [status, setStatus] = useState('agendado')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/auth/login'); return }
      const { data: usuario } = await supabase.from('usuarios_detail').select('empresa_id').eq('user_id', session.user.id).maybeSingle()
      if (!usuario?.empresa_id) { router.push('/auth/login'); return }
      setEmpresaId(usuario.empresa_id)
      await Promise.all([carregarAgendamentos(usuario.empresa_id), carregarDados(usuario.empresa_id), carregarEmpresa(usuario.empresa_id)])
      setLoading(false)
    }
    init()
  }, [])

  async function carregarEmpresa(eid: string) {
    const { data } = await supabase.from('empresas_detail').select('*').eq('id', eid).single()
    setEmpresa(data)
  }

  async function carregarAgendamentos(eid: string) {
    const { data } = await supabase.from('agendamentos').select('*, cliente:clientes(*), veiculo:veiculos(*)').eq('empresa_id', eid).order('data').order('hora')
    setAgendamentos(data || [])
  }

  async function carregarDados(eid: string) {
    const [{ data: cls }, { data: servs }] = await Promise.all([
      supabase.from('clientes').select('*, veiculos(*)').eq('empresa_id', eid).order('nome'),
      supabase.from('servicos_catalogo').select('*').eq('empresa_id', eid).eq('ativo', true).order('nome'),
    ])
    setClientes(cls || [])
    setServicos(servs || [])
  }

  // Ao selecionar serviço, preenche duração automaticamente
  function selecionarServico(nomeServico: string) {
    setServicoNome(nomeServico)
    if (nomeServico) {
      const serv = servicos.find(s => s.nome === nomeServico)
      if (serv?.duracao_minutos) {
        setDuracao(String(serv.duracao_minutos))
      }
    }
  }

  async function salvar() {
    setErro('')
    if (!data) { setErro('Selecione uma data.'); return }
    if (!hora) { setErro('Selecione um horário.'); return }
    if (!titulo.trim() && !servicoNome.trim()) { setErro('Informe um título ou serviço.'); return }
    setSalvando(true)

    const payload: any = {
      empresa_id: empresaId, cliente_id: clienteId || null, veiculo_id: veiculoId || null,
      titulo: titulo.trim() || null, data, hora, duracao_minutos: parseInt(duracao) || 60,
      servico: servicoNome.trim() || null, status, observacoes: observacoes.trim() || null, tipo: 'avulso',
    }

    if (agendamentoSelecionado) {
      await supabase.from('agendamentos').update(payload).eq('id', agendamentoSelecionado.id)
    } else {
      await supabase.from('agendamentos').insert(payload)
    }

    await carregarAgendamentos(empresaId!)
    fecharModal()
    setSalvando(false)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este agendamento?')) return
    await supabase.from('agendamentos').delete().eq('id', id)
    await carregarAgendamentos(empresaId!)
    fecharModal()
  }

  async function atualizarStatus(id: string, novoStatus: string) {
    await supabase.from('agendamentos').update({ status: novoStatus }).eq('id', id)
    await carregarAgendamentos(empresaId!)
    if (agendamentoSelecionado?.id === id) setAgendamentoSelecionado(prev => prev ? { ...prev, status: novoStatus } : null)
  }

  function abrirModal(ag?: Agendamento, diaPreSelecionado?: string, horaPreSelecionada?: string) {
    if (ag) {
      setAgendamentoSelecionado(ag)
      setClienteId(ag.cliente_id || ''); setVeiculoId(ag.veiculo_id || '')
      setTitulo(ag.titulo || ''); setData(ag.data); setHora(ag.hora.slice(0,5))
      setDuracao(String(ag.duracao_minutos || 60)); setServicoNome(ag.servico || '')
      setStatus(ag.status); setObservacoes(ag.observacoes || '')
    } else {
      setAgendamentoSelecionado(null)
      setClienteId(''); setVeiculoId(''); setTitulo('')
      setData(diaPreSelecionado || formatarDataLocal(new Date()))
      setHora(horaPreSelecionada || '09:00')
      setDuracao('60'); setServicoNome(''); setStatus('agendado'); setObservacoes('')
    }
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false); setAgendamentoSelecionado(null); setErro('') }

  const diasSemana = getDiasSemana(semanaBase)
  const veiculosCliente = clientes.find(c => c.id === clienteId)?.veiculos || []
  const hoje = formatarDataLocal(new Date())
  const diasFuncionamento: string[] = empresa?.dias_funcionamento || ['seg','ter','qua','qui','sex']
  const horaAbertura = empresa?.horario_abertura?.slice(0, 5) || '08:00'
  const horaFechamento = empresa?.horario_fechamento?.slice(0, 5) || '18:00'
  const aberturaMin = horaParaMinutos(horaAbertura)
  const fechamentoMin = horaParaMinutos(horaFechamento)

  const slots: string[] = []
  for (let m = aberturaMin; m < fechamentoMin; m += 30) {
    const h = String(Math.floor(m / 60)).padStart(2, '0')
    const min = String(m % 60).padStart(2, '0')
    slots.push(`${h}:${min}`)
  }

  const alturaGrid = slots.length * SLOT_HEIGHT
  const agendamentosFiltrados = filtroStatus === 'todos' ? agendamentos : agendamentos.filter(a => a.status === filtroStatus)

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0 }}>📅 Agenda</h1>
          <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', margin: '8px 0' }} />
          <p style={{ color: '#4A5568', fontSize: 13, margin: 0 }}>
            {agendamentos.length} agendamentos
            {empresa?.horario_abertura && ` · Funcionamento: ${horaAbertura} às ${horaFechamento}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
            {(['semana', 'lista'] as VisualizacaoTipo[]).map(v => (
              <button key={v} onClick={() => setVisualizacao(v)}
                style={{ background: visualizacao === v ? 'rgba(212,168,67,0.15)' : 'transparent', border: 'none', color: visualizacao === v ? '#D4A843' : '#4A5568', padding: '8px 16px', cursor: 'pointer', fontSize: 12, fontWeight: visualizacao === v ? 700 : 400 }}>
                {v === 'semana' ? '📆 Semana' : '📋 Lista'}
              </button>
            ))}
          </div>
          <button onClick={() => abrirModal()}
            style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '10px 20px', borderRadius: 8, fontWeight: 900, fontSize: 13, cursor: 'pointer', letterSpacing: 1 }}>
            + AGENDAR
          </button>
        </div>
      </div>

      {/* ── SEMANA ── */}
      {visualizacao === 'semana' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button onClick={() => { const d = new Date(semanaBase); d.setDate(d.getDate() - 7); setSemanaBase(new Date(d)) }}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#CBD5E0', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>← Anterior</button>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: 0 }}>
              {diasSemana[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} — {diasSemana[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
            <button onClick={() => { const d = new Date(semanaBase); d.setDate(d.getDate() + 7); setSemanaBase(new Date(d)) }}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#CBD5E0', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Próxima →</button>
          </div>

          <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#080C18' }}>
              <div />
              {diasSemana.map((dia, i) => {
                const dStr = formatarDataLocal(dia)
                const isHoje = dStr === hoje
                const diaKey = DIAS_SEMANA_KEY[dia.getDay()]
                const diaAtivo = diasFuncionamento.includes(diaKey)
                return (
                  <div key={i} style={{ padding: '10px 8px', textAlign: 'center' as const, borderLeft: '1px solid rgba(255,255,255,0.06)', opacity: diaAtivo ? 1 : 0.4 }}>
                    <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, margin: '0 0 6px', letterSpacing: 1 }}>{nomeDia(dia)}</p>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: isHoje ? '#D4A843' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                      <p style={{ color: isHoje ? '#080C18' : '#fff', fontSize: 14, fontWeight: isHoje ? 900 : 400, margin: 0 }}>{dia.getDate()}</p>
                    </div>
                    {!diaAtivo && <p style={{ color: '#4A5568', fontSize: 9, margin: '4px 0 0', letterSpacing: 1 }}>FECHADO</p>}
                  </div>
                )
              })}
            </div>

            <div style={{ maxHeight: 560, overflowY: 'auto' as const }}>
              <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', position: 'relative' as const }}>
                <div style={{ position: 'relative' as const, height: alturaGrid }}>
                  {slots.map((slot, i) => (
                    <div key={slot} style={{ position: 'absolute' as const, top: i * SLOT_HEIGHT, left: 0, right: 0, height: SLOT_HEIGHT, borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', alignItems: 'flex-start', paddingTop: 4, paddingLeft: 6 }}>
                      <p style={{ color: '#2D3748', fontSize: 10, margin: 0 }}>{slot}</p>
                    </div>
                  ))}
                </div>

                {diasSemana.map((dia, di) => {
                  const dStr = formatarDataLocal(dia)
                  const diaKey = DIAS_SEMANA_KEY[dia.getDay()]
                  const diaAtivo = diasFuncionamento.includes(diaKey)
                  const agsNoDia = agendamentos.filter(a => a.data === dStr)
                  return (
                    <div key={di} style={{ position: 'relative' as const, height: alturaGrid, borderLeft: '1px solid rgba(255,255,255,0.04)', background: !diaAtivo ? 'rgba(0,0,0,0.15)' : 'transparent' }}>
                      {slots.map((slot, si) => (
                        <div key={slot} onClick={() => { if (diaAtivo) abrirModal(undefined, dStr, slot) }}
                          style={{ position: 'absolute' as const, top: si * SLOT_HEIGHT, left: 0, right: 0, height: SLOT_HEIGHT, borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: diaAtivo ? 'pointer' : 'default' }} />
                      ))}
                      {agsNoDia.map(ag => {
                        const agMin = horaParaMinutos(ag.hora)
                        const top = minutosParaTop(agMin, aberturaMin)
                        const altura = Math.max(((ag.duracao_minutos || 60) / 30) * SLOT_HEIGHT - 4, SLOT_HEIGHT - 4)
                        const st = STATUS_CONFIG[ag.status] || STATUS_CONFIG.agendado
                        const label = ag.titulo || ag.servico || ag.cliente?.nome || 'Agendamento'
                        return (
                          <div key={ag.id} onClick={e => { e.stopPropagation(); abrirModal(ag) }}
                            style={{ position: 'absolute' as const, top: top + 2, left: 2, right: 2, height: altura, background: st.bg, border: `1px solid ${st.cor}66`, borderRadius: 6, padding: '4px 6px', cursor: 'pointer', overflow: 'hidden', zIndex: 1 }}>
                            <p style={{ color: st.cor, fontSize: 11, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{label}</p>
                            {ag.cliente && altura > 40 && <p style={{ color: '#4A5568', fontSize: 10, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{ag.cliente.nome}</p>}
                            {altura > 60 && <p style={{ color: st.cor, fontSize: 10, margin: '2px 0 0', opacity: 0.7 }}>{ag.hora.slice(0,5)} · {formatarDuracao(ag.duracao_minutos)}</p>}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LISTA ── */}
      {visualizacao === 'lista' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as const }}>
            {['todos', 'agendado', 'confirmado', 'concluido', 'cancelado'].map(f => {
              const qtd = f === 'todos' ? agendamentos.length : agendamentos.filter(a => a.status === f).length
              return (
                <button key={f} onClick={() => setFiltroStatus(f)}
                  style={{ background: filtroStatus === f ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${filtroStatus === f ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: filtroStatus === f ? '#D4A843' : '#4A5568', padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: filtroStatus === f ? 700 : 400 }}>
                  {f === 'todos' ? `Todos (${qtd})` : `${STATUS_CONFIG[f]?.label} (${qtd})`}
                </button>
              )
            })}
          </div>
          {agendamentosFiltrados.length === 0 ? (
            <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 40, textAlign: 'center' as const }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>📅</p>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Nenhum agendamento</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {agendamentosFiltrados.map(ag => {
                const st = STATUS_CONFIG[ag.status] || STATUS_CONFIG.agendado
                return (
                  <div key={ag.id} onClick={() => abrirModal(ag)}
                    style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 10, padding: '8px 12px', textAlign: 'center' as const, flexShrink: 0, minWidth: 60 }}>
                      <p style={{ color: '#D4A843', fontSize: 14, fontWeight: 900, margin: 0 }}>{ag.hora.slice(0,5)}</p>
                      <p style={{ color: '#4A5568', fontSize: 10, margin: '2px 0 0' }}>{new Date(ag.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: 0 }}>{ag.titulo || ag.servico || 'Agendamento'}</p>
                        <span style={{ background: st.bg, color: st.cor, fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>{st.label}</span>
                      </div>
                      <p style={{ color: '#4A5568', fontSize: 12, margin: 0 }}>
                        {ag.cliente?.nome || 'Sem cliente'}{ag.veiculo && ` · ${ag.veiculo.placa}`} · {formatarDuracao(ag.duracao_minutos || 60)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL ── */}
      {modalAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: '#0D1220', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' as const }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 900, margin: 0 }}>{agendamentoSelecionado ? 'Editar Agendamento' : 'Novo Agendamento'}</h2>
              <button onClick={fecharModal} style={{ background: 'transparent', border: 'none', color: '#4A5568', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Título</label>
                <input style={inp} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Lavagem completa, Polimento..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Data <span style={{ color: '#D4A843' }}>*</span></label>
                  <input style={inp} type="date" value={data} onChange={e => setData(e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Horário <span style={{ color: '#D4A843' }}>*</span></label>
                  <select style={inp} value={hora} onChange={e => setHora(e.target.value)}>
                    {slots.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              {/* Serviço com auto-duração */}
              <div>
                <label style={lbl}>Serviço</label>
                <select style={inp} value={servicoNome} onChange={e => selecionarServico(e.target.value)}>
                  <option value="">Selecionar do catálogo...</option>
                  {servicos.map(s => (
                    <option key={s.id} value={s.nome}>{s.nome} — {formatarDuracao(s.duracao_minutos || 60)}</option>
                  ))}
                </select>
                {servicoNome && servicos.find(s => s.nome === servicoNome) && (
                  <p style={{ color: '#90CDF4', fontSize: 11, marginTop: 5 }}>
                    ⏱ Duração preenchida automaticamente: {formatarDuracao(parseInt(duracao))}
                  </p>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Duração</label>
                  <select style={inp} value={duracao} onChange={e => setDuracao(e.target.value)}>
                    {[30,45,60,90,120,150,180,210,240,300,360,480].map(d => (
                      <option key={d} value={d}>{formatarDuracao(d)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Status</label>
                  <select style={inp} value={status} onChange={e => setStatus(e.target.value)}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={lbl}>Cliente</label>
                <select style={inp} value={clienteId} onChange={e => { setClienteId(e.target.value); setVeiculoId('') }}>
                  <option value="">Sem cliente vinculado</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              {clienteId && (
                <div>
                  <label style={lbl}>Veículo</label>
                  <select style={inp} value={veiculoId} onChange={e => setVeiculoId(e.target.value)}>
                    <option value="">Sem veículo vinculado</option>
                    {veiculosCliente.map((v: any) => <option key={v.id} value={v.id}>{v.placa} — {v.marca} {v.modelo}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={lbl}>Observações</label>
                <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' as const }} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Detalhes adicionais..." />
              </div>
            </div>

            {erro && <div style={{ color: '#FC8181', fontSize: 13, margin: '12px 0', background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', borderRadius: 8, padding: '8px 12px' }}>{erro}</div>}

            {agendamentoSelecionado && (
              <div style={{ marginTop: 16 }}>
                <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>STATUS RÁPIDO</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <button key={k} onClick={() => atualizarStatus(agendamentoSelecionado.id, k)}
                      style={{ background: agendamentoSelecionado.status === k ? v.bg : 'rgba(255,255,255,0.04)', border: `1px solid ${agendamentoSelecionado.status === k ? v.cor + '66' : 'rgba(255,255,255,0.08)'}`, color: agendamentoSelecionado.status === k ? v.cor : '#4A5568', padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={salvar} disabled={salvando}
                style={{ flex: 1, background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: 13, borderRadius: 10, fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>
                {salvando ? 'SALVANDO...' : agendamentoSelecionado ? 'SALVAR ALTERAÇÕES' : 'CRIAR AGENDAMENTO'}
              </button>
              {agendamentoSelecionado && (
                <button onClick={() => excluir(agendamentoSelecionado.id)}
                  style={{ background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', color: '#FC8181', padding: '13px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  EXCLUIR
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}