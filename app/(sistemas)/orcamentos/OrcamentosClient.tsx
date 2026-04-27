'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Orcamento = {
  id: string
  cliente_id: string
  veiculo_id: string
  status: string
  token: string
  valor_total: number
  validade: string
  observacoes: string
  assinatura_nome: string
  assinatura_cpf: string
  assinatura_ip: string
  assinado_em: string
  motivo_recusa: string
  notificacao_lida: boolean
  criado_em: string
  cliente?: any
  veiculo?: any
  itens?: any[]
}

type Aba = 'lista' | 'novo' | 'detalhe'

function formatarPreco(v: string) {
  const nums = v.replace(/\D/g, '')
  if (!nums) return ''
  const valor = (parseInt(nums) / 100).toFixed(2)
  return valor.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function precoParaNumero(v: string) {
  return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0
}

export default function OrcamentosClient() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [empresa, setEmpresa] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<Aba>('lista')
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [orcamentoSelecionado, setOrcamentoSelecionado] = useState<Orcamento | null>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [veiculos, setVeiculos] = useState<any[]>([])
  const [servicos, setServicos] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('todos')

  // Form novo orçamento
  const [clienteId, setClienteId] = useState('')
  const [veiculoId, setVeiculoId] = useState('')
  const [validade, setValidade] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState<{ servico_id: string, descricao: string, quantidade: number, valor: string }[]>([
    { servico_id: '', descricao: '', quantidade: 1, valor: '' }
  ])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/auth/login'); return }
      const { data: usuario } = await supabase.from('usuarios_detail').select('empresa_id').eq('user_id', session.user.id).maybeSingle()
      if (!usuario?.empresa_id) { router.push('/auth/login'); return }
      setEmpresaId(usuario.empresa_id)
      await Promise.all([
        carregarOrcamentos(usuario.empresa_id),
        carregarDados(usuario.empresa_id),
      ])
      setLoading(false)
    }
    init()
  }, [])

  async function carregarOrcamentos(eid: string) {
    const { data } = await supabase
      .from('orcamentos_detail')
      .select('*, cliente:clientes(*), veiculo:veiculos(*), itens:orcamento_itens_detail(*)')
      .eq('empresa_id', eid)
      .order('criado_em', { ascending: false })
    setOrcamentos(data || [])
  }

  async function carregarDados(eid: string) {
    const [{ data: cls }, { data: servs }, { data: emp }] = await Promise.all([
      supabase.from('clientes').select('*, veiculos(*)').eq('empresa_id', eid).order('nome'),
      supabase.from('servicos_catalogo').select('*').eq('empresa_id', eid).eq('ativo', true).order('nome'),
      supabase.from('empresas_detail').select('*').eq('id', eid).single(),
    ])
    setClientes(cls || [])
    setServicos(servs || [])
    setEmpresa(emp)
  }

  const veiculosCliente = clientes.find(c => c.id === clienteId)?.veiculos || []

  function adicionarItem() {
    setItens([...itens, { servico_id: '', descricao: '', quantidade: 1, valor: '' }])
  }

  function removerItem(i: number) {
    setItens(itens.filter((_, idx) => idx !== i))
  }

  function atualizarItem(i: number, campo: string, valor: any) {
    const novos = [...itens]
    novos[i] = { ...novos[i], [campo]: valor }
    if (campo === 'servico_id' && valor) {
      const serv = servicos.find(s => s.id === valor)
      if (serv) {
        novos[i].descricao = serv.nome
        novos[i].valor = serv.preco ? (serv.preco.toFixed(2)).replace('.', ',') : ''
      }
    }
    setItens(novos)
  }

  const totalOrcamento = itens.reduce((acc, item) => acc + (precoParaNumero(item.valor) * item.quantidade), 0)

  async function salvarOrcamento() {
    setErro('')
    if (!clienteId) { setErro('Selecione um cliente.'); return }
    if (!veiculoId) { setErro('Selecione um veículo.'); return }
    if (itens.every(i => !i.descricao.trim())) { setErro('Adicione ao menos um serviço.'); return }
    setSalvando(true)

    const token = Math.random().toString(36).substring(2, 10).toUpperCase()

    const { data: orc, error } = await supabase.from('orcamentos_detail').insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      veiculo_id: veiculoId,
      status: 'pendente',
      token,
      valor_total: totalOrcamento,
      validade: validade || null,
      observacoes: observacoes.trim() || null,
      notificacao_lida: false,
    }).select().single()

    if (error || !orc) { setErro('Erro ao salvar orçamento.'); setSalvando(false); return }

    const itensFiltrados = itens.filter(i => i.descricao.trim())
    await supabase.from('orcamento_itens_detail').insert(
      itensFiltrados.map(i => ({
        orcamento_id: orc.id,
        servico_id: i.servico_id || null,
        descricao: i.descricao.trim(),
        quantidade: i.quantidade,
        valor: precoParaNumero(i.valor),
      }))
    )

    await carregarOrcamentos(empresaId!)
    setSalvando(false)
    setAba('lista')
    // Abre o detalhe do orçamento criado
    const { data: orcCompleto } = await supabase
      .from('orcamentos_detail')
      .select('*, cliente:clientes(*), veiculo:veiculos(*), itens:orcamento_itens_detail(*)')
      .eq('id', orc.id).single()
    setOrcamentoSelecionado(orcCompleto)
    setAba('detalhe')
    limparForm()
  }

  function limparForm() {
    setClienteId(''); setVeiculoId(''); setValidade(''); setObservacoes('')
    setItens([{ servico_id: '', descricao: '', quantidade: 1, valor: '' }]); setErro('')
  }

  async function marcarNotificacaoLida(id: string) {
    await supabase.from('orcamentos_detail').update({ notificacao_lida: true }).eq('id', id)
    await carregarOrcamentos(empresaId!)
  }

  const linkPublico = (token: string) => `${window.location.origin}/orcamento/${token}`

  function enviarWhatsApp(orc: Orcamento) {
    const cliente = orc.cliente
    const veiculo = orc.veiculo
    const link = linkPublico(orc.token)
    const msg = `Olá, ${cliente?.nome?.split(' ')[0]}! 👋

Segue o orçamento referente ao serviço do seu veículo *${veiculo?.marca || ''} ${veiculo?.modelo || ''}* (${veiculo?.placa || ''}).

💰 *Valor Total: R$ ${orc.valor_total.toFixed(2).replace('.', ',')}*

Para visualizar e aprovar seu orçamento, acesse o link abaixo:
🔗 ${link}

Qualquer dúvida, estou à disposição. ✨`

    const tel = cliente?.telefone?.replace(/\D/g, '')
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const statusConfig: Record<string, { label: string, cor: string, bg: string }> = {
    pendente:  { label: 'PENDENTE',  cor: '#D4A843', bg: 'rgba(212,168,67,0.1)' },
    aprovado:  { label: 'APROVADO',  cor: '#48BB78', bg: 'rgba(72,187,120,0.1)' },
    recusado:  { label: 'RECUSADO',  cor: '#FC8181', bg: 'rgba(252,129,129,0.1)' },
    cancelado: { label: 'CANCELADO', cor: '#4A5568', bg: 'rgba(74,85,104,0.1)' },
  }

  const orcamentosFiltrados = filtro === 'todos' ? orcamentos : orcamentos.filter(o => o.status === filtro)
  const pendentesNaoLidos = orcamentos.filter(o => (o.status === 'aprovado' || o.status === 'recusado') && !o.notificacao_lida).length

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
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0 }}>
            📋 Orçamentos
            {pendentesNaoLidos > 0 && (
              <span style={{ background: '#D4A843', color: '#080C18', fontSize: 11, fontWeight: 900, padding: '2px 8px', borderRadius: 10, marginLeft: 10 }}>{pendentesNaoLidos}</span>
            )}
          </h1>
          <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', margin: '8px 0' }} />
          <p style={{ color: '#4A5568', fontSize: 13, margin: 0 }}>{orcamentos.length} orçamentos</p>
        </div>
        <button onClick={() => { limparForm(); setAba('novo') }} style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '10px 20px', borderRadius: 8, fontWeight: 900, fontSize: 13, cursor: 'pointer', letterSpacing: 1 }}>
          + NOVO ORÇAMENTO
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['todos', 'pendente', 'aprovado', 'recusado'].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{ background: filtro === f ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${filtro === f ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: filtro === f ? '#D4A843' : '#4A5568', padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: filtro === f ? 700 : 400, textTransform: 'capitalize' as const }}>
            {f === 'todos' ? `Todos (${orcamentos.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${orcamentos.filter(o => o.status === f).length})`}
          </button>
        ))}
      </div>

      {orcamentosFiltrados.length === 0 ? (
        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>📋</p>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Nenhum orçamento encontrado</p>
          <p style={{ color: '#4A5568', fontSize: 13 }}>Crie seu primeiro orçamento.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {orcamentosFiltrados.map(o => {
            const st = statusConfig[o.status] || statusConfig.pendente
            const naoLido = (o.status === 'aprovado' || o.status === 'recusado') && !o.notificacao_lida
            return (
              <div key={o.id} onClick={async () => {
                setOrcamentoSelecionado(o)
                setAba('detalhe')
              }}
                style={{ background: '#0D1220', border: `1px solid ${naoLido ? 'rgba(212,168,67,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                {naoLido && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#D4A843', flexShrink: 0 }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: 0 }}>{o.cliente?.nome || '—'}</p>
                    <span style={{ background: st.bg, color: st.cor, fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700, border: `1px solid ${st.cor}33` }}>{st.label}</span>
                    {naoLido && <span style={{ background: 'rgba(212,168,67,0.15)', color: '#D4A843', fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>NOVO</span>}
                  </div>
                  <p style={{ color: '#4A5568', fontSize: 12, margin: 0 }}>{o.veiculo?.marca} {o.veiculo?.modelo} · {o.veiculo?.placa} · #{o.token}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: '#D4A843', fontSize: 16, fontWeight: 900, margin: '0 0 4px' }}>R$ {o.valor_total?.toFixed(2).replace('.', ',')}</p>
                  <p style={{ color: '#4A5568', fontSize: 11, margin: 0 }}>{new Date(o.criado_em).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── NOVO ORÇAMENTO ──
  if (aba === 'novo') return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => setAba('lista')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>← Voltar</button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>Novo Orçamento</h1>
          <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', marginTop: 6 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Cliente e Veículo */}
          <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
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
              <div>
                <label style={lbl}>Validade</label>
                <input style={inp} type="date" value={validade} onChange={e => setValidade(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Observações</label>
                <input style={inp} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações gerais..." />
              </div>
            </div>
          </div>

          {/* Itens */}
          <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>SERVIÇOS / ITENS</p>

            {itens.map((item, i) => (
              <div key={i} style={{ background: '#080C18', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 14, marginBottom: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
                  <div>
                    <label style={lbl}>Serviço do catálogo</label>
                    <select style={inp} value={item.servico_id} onChange={e => atualizarItem(i, 'servico_id', e.target.value)}>
                      <option value="">Selecionar serviço...</option>
                      {servicos.map(s => <option key={s.id} value={s.id}>{s.nome} — R$ {s.preco?.toFixed(2).replace('.', ',')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Qtd</label>
                    <input style={inp} type="number" min="1" value={item.quantidade} onChange={e => atualizarItem(i, 'quantidade', parseInt(e.target.value) || 1)} />
                  </div>
                  <div>
                    <label style={lbl}>Valor unit. (R$)</label>
                    <input style={inp} value={item.valor} onChange={e => atualizarItem(i, 'valor', formatarPreco(e.target.value))} placeholder="0,00" />
                  </div>
                  <button onClick={() => removerItem(i)} disabled={itens.length === 1}
                    style={{ background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', color: '#FC8181', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 14, marginBottom: 0 }}>✕</button>
                </div>
                <div style={{ marginTop: 10 }}>
                  <label style={lbl}>Descrição</label>
                  <input style={inp} value={item.descricao} onChange={e => atualizarItem(i, 'descricao', e.target.value)} placeholder="Descrição do serviço..." />
                </div>
                {item.valor && item.quantidade && (
                  <p style={{ color: '#4A5568', fontSize: 12, marginTop: 8, textAlign: 'right' }}>
                    Subtotal: <span style={{ color: '#D4A843', fontWeight: 700 }}>R$ {(precoParaNumero(item.valor) * item.quantidade).toFixed(2).replace('.', ',')}</span>
                  </p>
                )}
              </div>
            ))}

            <button onClick={adicionarItem} style={{ background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.2)', color: '#D4A843', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, width: '100%', marginTop: 4 }}>
              + ADICIONAR ITEM
            </button>
          </div>
        </div>

        {/* Resumo */}
        <div style={{ background: '#0D1220', border: '1px solid rgba(212,168,67,0.15)', borderRadius: 12, padding: 20, position: 'sticky', top: 80 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 16, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>RESUMO</p>
          {itens.filter(i => i.descricao).map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ color: '#CBD5E0', fontSize: 13, margin: 0 }}>{item.descricao || '—'} {item.quantidade > 1 ? `×${item.quantidade}` : ''}</p>
              <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, margin: 0 }}>R$ {(precoParaNumero(item.valor) * item.quantidade).toFixed(2).replace('.', ',')}</p>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(212,168,67,0.2)', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
            <p style={{ color: '#fff', fontWeight: 900, fontSize: 16, margin: 0 }}>TOTAL</p>
            <p style={{ color: '#D4A843', fontWeight: 900, fontSize: 20, margin: 0 }}>R$ {totalOrcamento.toFixed(2).replace('.', ',')}</p>
          </div>

          {erro && <div style={{ color: '#FC8181', fontSize: 13, margin: '12px 0', background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', borderRadius: 8, padding: '8px 12px' }}>{erro}</div>}

          <button onClick={salvarOrcamento} disabled={salvando}
            style={{ width: '100%', background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: 14, borderRadius: 10, fontWeight: 900, fontSize: 14, cursor: 'pointer', letterSpacing: 1, marginTop: 16 }}>
            {salvando ? 'SALVANDO...' : 'GERAR ORÇAMENTO'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── DETALHE ORÇAMENTO ──
  if (aba === 'detalhe' && orcamentoSelecionado) {
    const o = orcamentoSelecionado
    const st = statusConfig[o.status] || statusConfig.pendente
    const naoLido = (o.status === 'aprovado' || o.status === 'recusado') && !o.notificacao_lida

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => setAba('lista')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>← Voltar</button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>Orçamento #{o.token}</h1>
              <span style={{ background: st.bg, color: st.cor, fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 700, border: `1px solid ${st.cor}33` }}>{st.label}</span>
            </div>
            <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', marginTop: 6 }} />
          </div>
        </div>

        {/* Alerta novo */}
        {naoLido && (
          <div style={{ background: o.status === 'aprovado' ? 'rgba(72,187,120,0.08)' : 'rgba(252,129,129,0.08)', border: `1px solid ${o.status === 'aprovado' ? 'rgba(72,187,120,0.3)' : 'rgba(252,129,129,0.3)'}`, borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: o.status === 'aprovado' ? '#48BB78' : '#FC8181', fontWeight: 700, fontSize: 14, margin: '0 0 4px' }}>
                {o.status === 'aprovado' ? '✅ Orçamento APROVADO pelo cliente!' : '❌ Orçamento RECUSADO pelo cliente'}
              </p>
              {o.status === 'aprovado' && <p style={{ color: '#4A5568', fontSize: 13, margin: 0 }}>Assinado por {o.assinatura_nome} em {o.assinado_em ? new Date(o.assinado_em).toLocaleDateString('pt-BR') : '—'}</p>}
              {o.status === 'recusado' && o.motivo_recusa && <p style={{ color: '#4A5568', fontSize: 13, margin: 0 }}>Motivo: {o.motivo_recusa}</p>}
            </div>
            <button onClick={() => marcarNotificacaoLida(o.id)}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E0', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' as const }}>
              MARCAR COMO LIDA
            </button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Dados */}
            <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>DADOS</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                {[
                  { label: 'Cliente', valor: o.cliente?.nome || '—' },
                  { label: 'Veículo', valor: `${o.veiculo?.marca || ''} ${o.veiculo?.modelo || ''}` },
                  { label: 'Placa', valor: o.veiculo?.placa || '—' },
                  { label: 'Validade', valor: o.validade ? new Date(o.validade + 'T12:00:00').toLocaleDateString('pt-BR') : '—' },
                  { label: 'Data', valor: new Date(o.criado_em).toLocaleDateString('pt-BR') },
                ].map((item, i) => (
                  <div key={i}>
                    <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>{item.label.toUpperCase()}</p>
                    <p style={{ color: '#fff', fontSize: 14, margin: 0 }}>{item.valor}</p>
                  </div>
                ))}
              </div>
              {o.observacoes && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>OBSERVAÇÕES</p>
                  <p style={{ color: '#CBD5E0', fontSize: 13, margin: 0 }}>{o.observacoes}</p>
                </div>
              )}
            </div>

            {/* Itens */}
            <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>SERVIÇOS</p>
              {(o.itens || []).map((item: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: 0 }}>{item.descricao}</p>
                    {item.quantidade > 1 && <p style={{ color: '#4A5568', fontSize: 12, margin: '3px 0 0' }}>Qtd: {item.quantidade}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: '#D4A843', fontSize: 14, fontWeight: 700, margin: 0 }}>R$ {(item.valor * item.quantidade).toFixed(2).replace('.', ',')}</p>
                    {item.quantidade > 1 && <p style={{ color: '#4A5568', fontSize: 11, margin: '3px 0 0' }}>R$ {item.valor?.toFixed(2).replace('.', ',')} un.</p>}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: '2px solid rgba(212,168,67,0.2)' }}>
                <p style={{ color: '#fff', fontWeight: 900, fontSize: 16, margin: 0 }}>TOTAL</p>
                <p style={{ color: '#D4A843', fontWeight: 900, fontSize: 22, margin: 0 }}>R$ {o.valor_total?.toFixed(2).replace('.', ',')}</p>
              </div>
            </div>

            {/* Assinatura */}
            {o.status === 'aprovado' && (
              <div style={{ background: 'rgba(72,187,120,0.05)', border: '1px solid rgba(72,187,120,0.2)', borderRadius: 12, padding: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#48BB78', letterSpacing: 2, marginBottom: 14 }}>✅ ASSINATURA DIGITAL</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                  {[
                    { label: 'Nome', valor: o.assinatura_nome },
                    { label: 'CPF', valor: o.assinatura_cpf },
                    { label: 'IP', valor: o.assinatura_ip },
                    { label: 'Data/Hora', valor: o.assinado_em ? new Date(o.assinado_em).toLocaleString('pt-BR') : '—' },
                  ].map((item, i) => (
                    <div key={i}>
                      <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>{item.label.toUpperCase()}</p>
                      <p style={{ color: '#fff', fontSize: 13, margin: 0 }}>{item.valor}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14 }}>AÇÕES</p>

              <button onClick={() => navigator.clipboard.writeText(linkPublico(o.token))}
                style={{ width: '100%', background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.3)', color: '#D4A843', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
                🔗 COPIAR LINK
              </button>

              <button onClick={() => window.open(linkPublico(o.token), '_blank')}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#CBD5E0', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                👁 VER ORÇAMENTO
              </button>

              {o.cliente?.telefone && (
                <button onClick={() => enviarWhatsApp(o)}
                  style={{ width: '100%', background: 'rgba(72,187,120,0.1)', border: '1px solid rgba(72,187,120,0.3)', color: '#48BB78', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
                  📱 ENVIAR WHATSAPP
                </button>
              )}

              {o.status === 'aprovado' && (
                <button onClick={() => router.push('/ordens')}
                  style={{ width: '100%', background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '12px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>
                  🔧 ABRIR ORDEM DE SERVIÇO
                </button>
              )}
            </div>

            <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 }}>
              <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>LINK PÚBLICO</p>
              <p style={{ color: '#2B6CB0', fontSize: 11, wordBreak: 'break-all' as const, margin: 0 }}>{typeof window !== 'undefined' ? linkPublico(o.token) : ''}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}