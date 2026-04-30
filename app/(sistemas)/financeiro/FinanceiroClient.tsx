'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Pagamento = {
  id: string
  empresa_id: string
  os_id: string
  forma: 'dinheiro' | 'cartao_vista' | 'cartao_parcelado' | 'pix'
  parcelas?: number
  valor: number
  recebido_em: string
  observacoes?: string
  status: 'recebido' | 'pendente'
  os?: {
    id: string
    token: string
    finalizado_em: string
    plano_id?: string
    cliente: { nome: string, telefone?: string }
    veiculo: { marca: string, modelo: string, placa: string }
  }
}

type OSPendente = {
  id: string
  token: string
  finalizado_em: string
  plano_id?: string
  orcamento_id?: string
  orcamento?: { valor_total: number }
  itens?: { valor: number }[]
  cliente: { nome: string, telefone?: string }
  veiculo: { marca: string, modelo: string, placa: string }
}

type FormaPagamento = 'dinheiro' | 'cartao_vista' | 'cartao_parcelado' | 'pix'

const FORMAS: Record<string, { label: string, icon: string, cor: string }> = {
  dinheiro:         { label: 'Dinheiro',         icon: '💵', cor: '#48BB78' },
  pix:              { label: 'Pix',              icon: '📱', cor: '#90CDF4' },
  cartao_vista:     { label: 'Cartão à vista',   icon: '💳', cor: '#D4A843' },
  cartao_parcelado: { label: 'Cartão parcelado', icon: '💳', cor: '#F97316' },
}

const FORMAS_LISTA: { key: FormaPagamento, label: string, icon: string }[] = [
  { key: 'dinheiro',         label: 'Dinheiro',         icon: '💵' },
  { key: 'pix',              label: 'Pix',              icon: '📱' },
  { key: 'cartao_vista',     label: 'Cartão à vista',   icon: '💳' },
  { key: 'cartao_parcelado', label: 'Cartão parcelado', icon: '💳' },
]

function calcularValorOS(os: any): number {
  if (os.orcamento_id && os.orcamento?.valor_total) return os.orcamento.valor_total
  return (os.itens || []).reduce((acc: number, i: any) => acc + (i.valor || 0), 0)
}

function formatarDataLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function FinanceiroClient() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [osPendentes, setOsPendentes] = useState<OSPendente[]>([])
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'recebido' | 'pendente'>('todos')
  const [filtroForma, setFiltroForma] = useState<string>('todos')
  const [filtroPeriodo, setFiltroPeriodo] = useState<'mes' | '3meses' | 'ano' | 'tudo' | 'custom'>('mes')
  const [dataInicio, setDataInicio] = useState(formatarDataLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [dataFim, setDataFim] = useState(formatarDataLocal(new Date()))

  // Modal registrar pagamento
  const [modalPag, setModalPag] = useState(false)
  const [osSelecionada, setOsSelecionada] = useState<OSPendente | null>(null)
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('pix')
  const [parcelas, setParcelas] = useState('2')
  const [valorRecebido, setValorRecebido] = useState('')
  const [obsPagamento, setObsPagamento] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Quando muda a forma ou parcelas, sugerir valor
  useEffect(() => {
    if (!osSelecionada) return
    const base = calcularValorOS(osSelecionada)
    if (formaPagamento === 'cartao_parcelado') {
      // Não alterar — o usuário preenche o valor total com juros
    } else {
      setValorRecebido(base.toFixed(2).replace('.', ','))
    }
  }, [formaPagamento, osSelecionada])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/auth/login'); return }
      const { data: usuario } = await supabase.from('usuarios_detail').select('empresa_id').eq('user_id', session.user.id).maybeSingle()
      if (!usuario?.empresa_id) { router.push('/auth/login'); return }
      setEmpresaId(usuario.empresa_id)
      await carregarDados(usuario.empresa_id)
      setLoading(false)
    }
    init()
  }, [])

  async function carregarDados(eid: string) {
    const [{ data: pags }, { data: osFinalizadas }] = await Promise.all([
      supabase.from('pagamentos_os')
        .select('*, os:ordens_servico(id, token, finalizado_em, plano_id, cliente:clientes(nome, telefone), veiculo:veiculos(marca, modelo, placa))')
        .eq('empresa_id', eid)
        .order('recebido_em', { ascending: false }),
      supabase.from('ordens_servico')
        .select('id, token, finalizado_em, plano_id, orcamento_id, orcamento:orcamentos_detail(valor_total), itens:os_itens(valor), cliente:clientes(nome, telefone), veiculo:veiculos(marca, modelo, placa)')
        .eq('empresa_id', eid)
        .eq('status', 'finalizada')
        .order('finalizado_em', { ascending: false }),
    ])

    setPagamentos(pags || [])

    const osComPagamento = new Set((pags || []).map((p: any) => p.os_id))
    const pendentes = (osFinalizadas || []).filter(os => !osComPagamento.has(os.id))
    setOsPendentes(pendentes as any)
  }

  async function registrarPagamento() {
    if (!osSelecionada || !empresaId) return
    setSalvando(true)

    // Converter valor digitado (aceita vírgula ou ponto)
    const valorFinal = parseFloat(valorRecebido.replace(',', '.')) || calcularValorOS(osSelecionada)

    await supabase.from('pagamentos_os').insert({
      empresa_id: empresaId,
      os_id: osSelecionada.id,
      forma: formaPagamento,
      parcelas: formaPagamento === 'cartao_parcelado' ? parseInt(parcelas) : null,
      valor: valorFinal,
      recebido_em: new Date().toISOString(),
      observacoes: obsPagamento.trim() || null,
      status: 'recebido',
    })

    setModalPag(false)
    setOsSelecionada(null)
    setObsPagamento('')
    setValorRecebido('')
    setSalvando(false)
    await carregarDados(empresaId)
  }

  function abrirModal(os: OSPendente) {
    const valor = calcularValorOS(os)
    setOsSelecionada(os)
    setFormaPagamento('pix')
    setParcelas('2')
    setValorRecebido(valor.toFixed(2).replace('.', ','))
    setObsPagamento('')
    setModalPag(true)
  }

  // Calcular datas do filtro de período
  const agora = new Date()
  let inicioPeriodoISO = '2000-01-01T00:00:00Z'
  let fimPeriodoISO = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59).toISOString()

  if (filtroPeriodo === 'mes') {
    inicioPeriodoISO = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString()
    fimPeriodoISO = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59).toISOString()
  } else if (filtroPeriodo === '3meses') {
    inicioPeriodoISO = new Date(agora.getFullYear(), agora.getMonth() - 2, 1).toISOString()
  } else if (filtroPeriodo === 'ano') {
    inicioPeriodoISO = new Date(agora.getFullYear(), 0, 1).toISOString()
  } else if (filtroPeriodo === 'custom') {
    inicioPeriodoISO = `${dataInicio}T00:00:00`
    fimPeriodoISO = `${dataFim}T23:59:59`
  }

  const pagamentosFiltrados = pagamentos.filter(p => {
    if (filtroStatus !== 'todos' && p.status !== filtroStatus) return false
    if (filtroForma !== 'todos' && p.forma !== filtroForma) return false
    if (filtroPeriodo !== 'tudo') {
      if (p.recebido_em < inicioPeriodoISO) return false
      if (p.recebido_em > fimPeriodoISO) return false
    }
    return true
  })

  const totalRecebido = pagamentosFiltrados.filter(p => p.status === 'recebido').reduce((acc, p) => acc + p.valor, 0)
  const totalPendente = osPendentes.reduce((acc, os) => acc + calcularValorOS(os), 0)

  const breakdownForma: Record<string, number> = {}
  pagamentosFiltrados.filter(p => p.status === 'recebido').forEach(p => {
    breakdownForma[p.forma] = (breakdownForma[p.forma] || 0) + p.valor
  })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column' as const, gap: 16 }}>
      <div style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#080C18', fontSize: 22, fontWeight: 900 }}>Z</span>
      </div>
      <p style={{ color: '#D4A843', fontWeight: 700, letterSpacing: 2, fontSize: 12 }}>CARREGANDO...</p>
    </div>
  )

  const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', background: '#080C18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff', fontSize: 14, boxSizing: 'border-box' as const, outline: 'none' }
  const inpDate: React.CSSProperties = { ...inp, colorScheme: 'dark' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#4A5568', display: 'block', marginBottom: 6, letterSpacing: 1 }

  const valorBase = osSelecionada ? calcularValorOS(osSelecionada) : 0
  const valorReal = parseFloat((valorRecebido || '0').replace(',', '.')) || 0
  const diferencaValor = valorReal - valorBase
  const temDiferenca = Math.abs(diferencaValor) > 0.01

  return (
    <div>
      {/* ── Modal registrar pagamento ── */}
      {modalPag && osSelecionada && (
        <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#0D1220', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480 }}>
            <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 900, margin: '0 0 6px' }}>💰 Registrar Pagamento</h2>
            <p style={{ color: '#4A5568', fontSize: 13, margin: '0 0 4px' }}>
              {osSelecionada.cliente?.nome} — {osSelecionada.veiculo?.marca} {osSelecionada.veiculo?.modelo} · {osSelecionada.veiculo?.placa}
            </p>
            <p style={{ color: '#4A5568', fontSize: 12, margin: '0 0 20px' }}>
              Valor da OS: <span style={{ color: '#CBD5E0', fontWeight: 700 }}>R$ {valorBase.toFixed(2).replace('.', ',')}</span>
            </p>

            {/* Forma de pagamento */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...lbl, marginBottom: 10 }}>FORMA DE PAGAMENTO</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {FORMAS_LISTA.map(fp => (
                  <button key={fp.key} onClick={() => setFormaPagamento(fp.key)}
                    style={{ background: formaPagamento === fp.key ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${formaPagamento === fp.key ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: formaPagamento === fp.key ? '#D4A843' : '#4A5568', padding: '12px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: formaPagamento === fp.key ? 700 : 400, textAlign: 'left' as const }}>
                    {fp.icon} {fp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Parcelas — só para parcelado */}
            {formaPagamento === 'cartao_parcelado' && (
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>NÚMERO DE PARCELAS</label>
                <select style={inp} value={parcelas} onChange={e => setParcelas(e.target.value)}>
                  {[2,3,4,5,6,7,8,9,10,11,12].map(n => (
                    <option key={n} value={n}>{n}x de R$ {(valorBase / n).toFixed(2).replace('.', ',')} (sem juros)</option>
                  ))}
                </select>
              </div>
            )}

            {/* Valor recebido — sempre editável */}
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>
                VALOR RECEBIDO
                {formaPagamento === 'cartao_parcelado' && <span style={{ color: '#F97316', marginLeft: 6, fontSize: 10 }}>Informe o valor total com juros se houver</span>}
                {formaPagamento !== 'cartao_parcelado' && <span style={{ color: '#4A5568', marginLeft: 6, fontSize: 10, fontWeight: 400 }}>Edite se houve desconto</span>}
              </label>
              <div style={{ position: 'relative' as const }}>
                <span style={{ position: 'absolute' as const, left: 14, top: '50%', transform: 'translateY(-50%)', color: '#4A5568', fontSize: 14 }}>R$</span>
                <input
                  style={{ ...inp, paddingLeft: 36 }}
                  value={valorRecebido}
                  onChange={e => setValorRecebido(e.target.value)}
                  placeholder={valorBase.toFixed(2).replace('.', ',')}
                  inputMode="decimal"
                />
              </div>
              {/* Indicador de diferença */}
              {temDiferenca && valorReal > 0 && (
                <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, background: diferencaValor > 0 ? 'rgba(249,115,22,0.08)' : 'rgba(72,187,120,0.08)', border: `1px solid ${diferencaValor > 0 ? 'rgba(249,115,22,0.2)' : 'rgba(72,187,120,0.2)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ color: diferencaValor > 0 ? '#F97316' : '#48BB78', fontSize: 12, fontWeight: 700, margin: 0 }}>
                    {diferencaValor > 0 ? '📈 Acréscimo (juros)' : '📉 Desconto concedido'}
                  </p>
                  <p style={{ color: diferencaValor > 0 ? '#F97316' : '#48BB78', fontSize: 12, fontWeight: 900, margin: 0 }}>
                    {diferencaValor > 0 ? '+' : ''}R$ {Math.abs(diferencaValor).toFixed(2).replace('.', ',')}
                  </p>
                </div>
              )}
            </div>

            {/* Observações */}
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>OBSERVAÇÕES (opcional)</label>
              <input style={inp} value={obsPagamento} onChange={e => setObsPagamento(e.target.value)} placeholder="Ex: Pago no ato, cliente solicitou recibo..." />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={registrarPagamento} disabled={salvando}
                style={{ flex: 1, background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '13px 16px', borderRadius: 10, fontWeight: 900, fontSize: 14, cursor: 'pointer', letterSpacing: 1 }}>
                {salvando ? 'SALVANDO...' : '✅ CONFIRMAR RECEBIMENTO'}
              </button>
              <button onClick={() => setModalPag(false)}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '13px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cabeçalho ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>💰 Financeiro</h1>
        <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', marginTop: 6 }} />
        <p style={{ color: '#4A5568', fontSize: 12, marginTop: 4 }}>Controle de recebimentos das ordens de serviço</p>
      </div>

      {/* ── Cards totais ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, position: 'relative' as const, overflow: 'hidden' }}>
          <div style={{ position: 'absolute' as const, top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #48BB78, #D4A843)' }} />
          <p style={{ color: '#4A5568', fontSize: 10, fontWeight: 700, letterSpacing: 2, margin: '0 0 10px' }}>✅ RECEBIDO</p>
          <p style={{ color: '#48BB78', fontSize: 22, fontWeight: 900, margin: 0 }}>R$ {totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p style={{ color: '#4A5568', fontSize: 11, marginTop: 6 }}>{pagamentosFiltrados.filter(p => p.status === 'recebido').length} pagamento(s)</p>
        </div>

        <div style={{ background: '#0D1220', border: '1px solid rgba(252,129,129,0.15)', borderRadius: 12, padding: 16, position: 'relative' as const, overflow: 'hidden' }}>
          <div style={{ position: 'absolute' as const, top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #FC8181, #F97316)' }} />
          <p style={{ color: '#4A5568', fontSize: 10, fontWeight: 700, letterSpacing: 2, margin: '0 0 10px' }}>⏳ PENDENTE</p>
          <p style={{ color: '#FC8181', fontSize: 22, fontWeight: 900, margin: 0 }}>R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p style={{ color: '#4A5568', fontSize: 11, marginTop: 6 }}>{osPendentes.length} OS sem pagamento</p>
        </div>

        {Object.entries(breakdownForma).map(([forma, valor]) => {
          const cfg = FORMAS[forma]
          return (
            <div key={forma} style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 }}>
              <p style={{ color: '#4A5568', fontSize: 10, fontWeight: 700, letterSpacing: 2, margin: '0 0 10px' }}>{cfg?.icon} {cfg?.label.toUpperCase()}</p>
              <p style={{ color: cfg?.cor || '#D4A843', fontSize: 20, fontWeight: 900, margin: 0 }}>R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p style={{ color: '#4A5568', fontSize: 11, marginTop: 6 }}>{totalRecebido > 0 ? ((valor / totalRecebido) * 100).toFixed(0) : 0}% do total</p>
            </div>
          )
        })}
      </div>

      {/* ── OS pendentes de pagamento ── */}
      {osPendentes.length > 0 && (
        <div style={{ background: '#0D1220', border: '1px solid rgba(252,129,129,0.2)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <p style={{ color: '#FC8181', fontSize: 12, fontWeight: 700, letterSpacing: 2, margin: '0 0 12px' }}>
            ⚠️ OS SEM PAGAMENTO REGISTRADO ({osPendentes.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {osPendentes.map(os => {
              const valor = calcularValorOS(os)
              return (
                <div key={os.id} style={{ background: 'rgba(252,129,129,0.05)', border: '1px solid rgba(252,129,129,0.15)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: '0 0 3px' }}>{os.cliente?.nome}</p>
                    <p style={{ color: '#4A5568', fontSize: 12, margin: 0 }}>
                      {os.veiculo?.marca} {os.veiculo?.modelo} · {os.veiculo?.placa}
                      {os.finalizado_em && ` · Finalizada em ${new Date(os.finalizado_em).toLocaleDateString('pt-BR')}`}
                    </p>
                  </div>
                  {valor > 0 && <p style={{ color: '#FC8181', fontSize: 15, fontWeight: 900, flexShrink: 0 }}>R$ {valor.toFixed(2).replace('.', ',')}</p>}
                  <button onClick={() => abrirModal(os)}
                    style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 900, flexShrink: 0 }}>
                    REGISTRAR
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Filtros ── */}
      <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const, alignItems: 'flex-start' }}>

          {/* Período */}
          <div>
            <p style={{ color: '#4A5568', fontSize: 10, fontWeight: 700, letterSpacing: 1, margin: '0 0 8px' }}>PERÍODO</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
              {[
                { key: 'mes',    label: 'Este mês' },
                { key: '3meses', label: '3 meses'  },
                { key: 'ano',    label: 'Este ano' },
                { key: 'tudo',   label: 'Tudo'     },
                { key: 'custom', label: '📅 Personalizado' },
              ].map(p => (
                <button key={p.key} onClick={() => setFiltroPeriodo(p.key as any)}
                  style={{ background: filtroPeriodo === p.key ? 'rgba(212,168,67,0.15)' : 'transparent', border: `1px solid ${filtroPeriodo === p.key ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: filtroPeriodo === p.key ? '#D4A843' : '#4A5568', padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: filtroPeriodo === p.key ? 700 : 400, whiteSpace: 'nowrap' as const }}>
                  {p.label}
                </button>
              ))}
            </div>
            {/* Campos de data customizados */}
            {filtroPeriodo === 'custom' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <div>
                  <label style={{ ...lbl, marginBottom: 4 }}>DE</label>
                  <input type="date" style={{ ...inpDate, width: 150 }} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                </div>
                <span style={{ color: '#4A5568', alignSelf: 'flex-end', paddingBottom: 12 }}>→</span>
                <div>
                  <label style={{ ...lbl, marginBottom: 4 }}>ATÉ</label>
                  <input type="date" style={{ ...inpDate, width: 150 }} value={dataFim} onChange={e => setDataFim(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <p style={{ color: '#4A5568', fontSize: 10, fontWeight: 700, letterSpacing: 1, margin: '0 0 8px' }}>STATUS</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ key: 'todos', label: 'Todos' }, { key: 'recebido', label: '✅ Recebido' }, { key: 'pendente', label: '⏳ Pendente' }].map(s => (
                <button key={s.key} onClick={() => setFiltroStatus(s.key as any)}
                  style={{ background: filtroStatus === s.key ? 'rgba(212,168,67,0.15)' : 'transparent', border: `1px solid ${filtroStatus === s.key ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: filtroStatus === s.key ? '#D4A843' : '#4A5568', padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: filtroStatus === s.key ? 700 : 400 }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Forma */}
          <div>
            <p style={{ color: '#4A5568', fontSize: 10, fontWeight: 700, letterSpacing: 1, margin: '0 0 8px' }}>FORMA</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
              {[{ key: 'todos', label: 'Todas' }, ...FORMAS_LISTA.map(f => ({ key: f.key, label: `${f.icon} ${f.label}` }))].map(f => (
                <button key={f.key} onClick={() => setFiltroForma(f.key)}
                  style={{ background: filtroForma === f.key ? 'rgba(212,168,67,0.15)' : 'transparent', border: `1px solid ${filtroForma === f.key ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: filtroForma === f.key ? '#D4A843' : '#4A5568', padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: filtroForma === f.key ? 700 : 400, whiteSpace: 'nowrap' as const }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Lista de pagamentos ── */}
      <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0 }}>Histórico de Pagamentos</p>
          <p style={{ color: '#4A5568', fontSize: 12, margin: 0 }}>{pagamentosFiltrados.length} registro(s)</p>
        </div>

        {pagamentosFiltrados.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center' as const }}>
            <p style={{ fontSize: 28, margin: '0 0 8px' }}>💰</p>
            <p style={{ color: '#4A5568', fontSize: 14 }}>Nenhum pagamento encontrado</p>
          </div>
        ) : (
          <div>
            {pagamentosFiltrados.map((pag, idx) => {
              const forma = FORMAS[pag.forma]
              const ehUltimo = idx === pagamentosFiltrados.length - 1
              return (
                <div key={pag.id} style={{ padding: '14px 18px', borderBottom: ehUltimo ? 'none' : '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${forma?.cor}18`, border: `1px solid ${forma?.cor}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                    {forma?.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0 }}>{pag.os?.cliente?.nome || '—'}</p>
                      <span style={{ background: `${forma?.cor}18`, color: forma?.cor, fontSize: 9, padding: '2px 7px', borderRadius: 6, fontWeight: 700, border: `1px solid ${forma?.cor}33`, whiteSpace: 'nowrap' as const }}>
                        {forma?.label}{pag.forma === 'cartao_parcelado' && pag.parcelas ? ` ${pag.parcelas}x` : ''}
                      </span>
                      <span style={{ background: 'rgba(72,187,120,0.1)', color: '#48BB78', fontSize: 9, padding: '2px 7px', borderRadius: 6, fontWeight: 700, border: '1px solid rgba(72,187,120,0.2)' }}>RECEBIDO</span>
                    </div>
                    <p style={{ color: '#4A5568', fontSize: 12, margin: 0 }}>
                      {pag.os?.veiculo?.marca} {pag.os?.veiculo?.modelo} · {pag.os?.veiculo?.placa}
                      {pag.recebido_em && ` · ${new Date(pag.recebido_em).toLocaleDateString('pt-BR')}`}
                      {pag.observacoes && ` · ${pag.observacoes}`}
                    </p>
                  </div>
                  <p style={{ color: '#48BB78', fontSize: 15, fontWeight: 900, margin: 0, flexShrink: 0 }}>
                    R$ {pag.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}