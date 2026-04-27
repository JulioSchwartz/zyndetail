'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type OS = {
  id: string
  empresa_id: string
  cliente_id: string
  veiculo_id: string
  orcamento_id?: string
  status: 'aberta' | 'em_andamento' | 'finalizada'
  observacoes?: string
  criado_em: string
  finalizado_em?: string
  notificacao_lida: boolean
  cliente?: any
  veiculo?: any
  orcamento?: any
  fotos?: Foto[]
}

type Foto = {
  id: string
  os_id: string
  url: string
  etapa: 'recebimento' | 'andamento' | 'finalizado'
  observacao?: string
  servico_descricao?: string
  criado_em: string
}

type Aba = 'lista' | 'nova' | 'detalhe'

const STATUS_CONFIG: Record<string, { label: string, cor: string, bg: string }> = {
  aberta:       { label: 'ABERTA',       cor: '#90CDF4', bg: 'rgba(144,205,244,0.1)' },
  em_andamento: { label: 'EM ANDAMENTO', cor: '#D4A843', bg: 'rgba(212,168,67,0.1)' },
  finalizada:   { label: 'FINALIZADA',   cor: '#48BB78', bg: 'rgba(72,187,120,0.1)' },
}

const ETAPAS: { key: 'recebimento' | 'andamento' | 'finalizado', label: string, icon: string }[] = [
  { key: 'recebimento', label: 'Recebimento', icon: '📥' },
  { key: 'andamento',   label: 'Andamento',   icon: '🔧' },
  { key: 'finalizado',  label: 'Finalizado',  icon: '✅' },
]

export default function OrdensClient() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<Aba>('lista')
  const [ordens, setOrdens] = useState<OS[]>([])
  const [osSelecionada, setOsSelecionada] = useState<OS | null>(null)
  const [clientes, setClientes] = useState<any[]>([])
  const [orcamentosAprovados, setOrcamentosAprovados] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [etapaAtiva, setEtapaAtiva] = useState<'recebimento' | 'andamento' | 'finalizado'>('recebimento')
  const [uploadando, setUploadando] = useState(false)
  const [novaObs, setNovaObs] = useState('')
  const [novaServDesc, setNovaServDesc] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Form nova OS
  const [tipoAbertura, setTipoAbertura] = useState<'orcamento' | 'direto'>('orcamento')
  const [orcamentoId, setOrcamentoId] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [veiculoId, setVeiculoId] = useState('')
  const [obsNova, setObsNova] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/auth/login'); return }
      const { data: usuario } = await supabase.from('usuarios_detail').select('empresa_id').eq('user_id', session.user.id).maybeSingle()
      if (!usuario?.empresa_id) { router.push('/auth/login'); return }
      setEmpresaId(usuario.empresa_id)
      await Promise.all([carregarOrdens(usuario.empresa_id), carregarDados(usuario.empresa_id)])
      setLoading(false)
    }
    init()
  }, [])

  async function carregarOrdens(eid: string) {
    const { data } = await supabase
      .from('ordens_servico')
      .select('*, cliente:clientes(*), veiculo:veiculos(*), orcamento:orcamentos_detail(*), fotos:os_fotos(*)')
      .eq('empresa_id', eid)
      .order('criado_em', { ascending: false })
    setOrdens(data || [])
  }

  async function carregarDados(eid: string) {
    const [{ data: cls }, { data: orcs }] = await Promise.all([
      supabase.from('clientes').select('*, veiculos(*)').eq('empresa_id', eid).order('nome'),
      supabase.from('orcamentos_detail').select('*, cliente:clientes(*), veiculo:veiculos(*), itens:orcamento_itens_detail(*)').eq('empresa_id', eid).eq('status', 'aprovado').order('criado_em', { ascending: false }),
    ])
    setClientes(cls || [])
    setOrcamentosAprovados(orcs || [])
  }

  async function abrirOS() {
    setErro('')
    if (tipoAbertura === 'orcamento' && !orcamentoId) { setErro('Selecione um orçamento.'); return }
    if (tipoAbertura === 'direto' && !clienteId) { setErro('Selecione um cliente.'); return }
    if (tipoAbertura === 'direto' && !veiculoId) { setErro('Selecione um veículo.'); return }
    setSalvando(true)

    let cid = clienteId, vid = veiculoId, oid: string | null = null
    if (tipoAbertura === 'orcamento') {
      const orc = orcamentosAprovados.find(o => o.id === orcamentoId)
      if (orc) { cid = orc.cliente_id; vid = orc.veiculo_id; oid = orc.id }
    }

    const { data: os, error } = await supabase.from('ordens_servico').insert({
      empresa_id: empresaId,
      cliente_id: cid,
      veiculo_id: vid,
      orcamento_id: oid,
      status: 'aberta',
      observacoes: obsNova.trim() || null,
      notificacao_lida: false,
    }).select().single()

    if (error || !os) { setErro('Erro ao abrir OS.'); setSalvando(false); return }
    await carregarOrdens(empresaId!)
    setSalvando(false)
    await abrirDetalhe(os.id)
    limparFormNova()
  }

  async function abrirDetalhe(id: string) {
    const { data } = await supabase
      .from('ordens_servico')
      .select('*, cliente:clientes(*), veiculo:veiculos(*), orcamento:orcamentos_detail(*, itens:orcamento_itens_detail(*)), fotos:os_fotos(*)')
      .eq('id', id).single()
    setOsSelecionada(data)
    setEtapaAtiva('recebimento')
    setAba('detalhe')
  }

  async function atualizarStatus(id: string, status: string) {
    const update: any = { status }
    if (status === 'finalizada') {
      update.finalizado_em = new Date().toISOString()
      update.notificacao_lida = false
    }
    await supabase.from('ordens_servico').update(update).eq('id', id)
    await abrirDetalhe(id)
    await carregarOrdens(empresaId!)
  }

  async function uploadFoto(file: File) {
    if (!osSelecionada) return
    setUploadando(true)
    setErro('')

    if (!file.type.startsWith('image/')) { setErro('Arquivo deve ser imagem.'); setUploadando(false); return }
    if (file.size > 5 * 1024 * 1024) { setErro('Imagem deve ter no máximo 5MB.'); setUploadando(false); return }

    const ext = file.name.split('.').pop()
    const path = `${empresaId}/${osSelecionada.id}/${etapaAtiva}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('os-fotos').upload(path, file)
    if (uploadError) { setErro('Erro ao fazer upload.'); setUploadando(false); return }

    const { data: { publicUrl } } = supabase.storage.from('os-fotos').getPublicUrl(path)

    await supabase.from('os_fotos').insert({
      os_id: osSelecionada.id,
      empresa_id: empresaId,
      url: publicUrl,
      etapa: etapaAtiva,
      observacao: novaObs.trim() || null,
      servico_descricao: novaServDesc.trim() || null,
    })

    setNovaObs('')
    setNovaServDesc('')
    setUploadando(false)
    await abrirDetalhe(osSelecionada.id)
  }

  async function excluirFoto(foto: Foto) {
    if (!confirm('Excluir esta foto?')) return
    const path = foto.url.split('/os-fotos/')[1]?.split('?')[0]
    if (path) await supabase.storage.from('os-fotos').remove([path])
    await supabase.from('os_fotos').delete().eq('id', foto.id)
    await abrirDetalhe(osSelecionada!.id)
  }

  async function excluirOS(id: string) {
    if (!confirm('Excluir esta OS e todas as fotos?')) return
    await supabase.from('os_fotos').delete().eq('os_id', id)
    await supabase.from('ordens_servico').delete().eq('id', id)
    await carregarOrdens(empresaId!)
    setAba('lista')
  }

  function limparFormNova() {
    setOrcamentoId(''); setClienteId(''); setVeiculoId(''); setObsNova(''); setErro('')
  }

  const veiculosCliente = clientes.find(c => c.id === clienteId)?.veiculos || []
  const ordensFiltradas = filtro === 'todos' ? ordens : ordens.filter(o => o.status === filtro)
  const fotosEtapa = (osSelecionada?.fotos || []).filter(f => f.etapa === etapaAtiva)

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
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0 }}>🔧 Ordens de Serviço</h1>
          <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', margin: '8px 0' }} />
          <p style={{ color: '#4A5568', fontSize: 13, margin: 0 }}>{ordens.length} ordens cadastradas</p>
        </div>
        <button onClick={() => { limparFormNova(); setAba('nova') }}
          style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '10px 20px', borderRadius: 8, fontWeight: 900, fontSize: 13, cursor: 'pointer', letterSpacing: 1 }}>
          + NOVA OS
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as const }}>
        {['todos', 'aberta', 'em_andamento', 'finalizada'].map(f => {
          const qtd = f === 'todos' ? ordens.length : ordens.filter(o => o.status === f).length
          const st = STATUS_CONFIG[f]
          return (
            <button key={f} onClick={() => setFiltro(f)}
              style={{ background: filtro === f ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${filtro === f ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: filtro === f ? '#D4A843' : '#4A5568', padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: filtro === f ? 700 : 400 }}>
              {f === 'todos' ? `Todos (${qtd})` : `${st?.label} (${qtd})`}
            </button>
          )
        })}
      </div>

      {ordensFiltradas.length === 0 ? (
        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🔧</p>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Nenhuma OS encontrada</p>
          <p style={{ color: '#4A5568', fontSize: 13 }}>Abra a primeira ordem de serviço.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ordensFiltradas.map(o => {
            const st = STATUS_CONFIG[o.status]
            return (
              <div key={o.id} onClick={() => abrirDetalhe(o.id)}
                style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: 0 }}>{o.cliente?.nome || '—'}</p>
                    <span style={{ background: st.bg, color: st.cor, fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700, border: `1px solid ${st.cor}33` }}>{st.label}</span>
                  </div>
                  <p style={{ color: '#4A5568', fontSize: 12, margin: 0 }}>
                    {o.veiculo?.marca} {o.veiculo?.modelo} · {o.veiculo?.placa}
                    {o.orcamento && ` · Orçamento #${o.orcamento.token}`}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: '#4A5568', fontSize: 11, margin: '0 0 4px' }}>{new Date(o.criado_em).toLocaleDateString('pt-BR')}</p>
                  <p style={{ color: '#4A5568', fontSize: 11, margin: 0 }}>{(o.fotos || []).length} foto(s)</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── NOVA OS ──
  if (aba === 'nova') return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => setAba('lista')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>← Voltar</button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>Nova Ordem de Serviço</h1>
          <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', marginTop: 6 }} />
        </div>
      </div>

      <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 24, maxWidth: 600 }}>
        {/* Tipo de abertura */}
        <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>ORIGEM DA OS</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={() => setTipoAbertura('orcamento')}
            style={{ flex: 1, background: tipoAbertura === 'orcamento' ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${tipoAbertura === 'orcamento' ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: tipoAbertura === 'orcamento' ? '#D4A843' : '#4A5568', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            📋 A partir de orçamento
          </button>
          <button onClick={() => setTipoAbertura('direto')}
            style={{ flex: 1, background: tipoAbertura === 'direto' ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${tipoAbertura === 'direto' ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: tipoAbertura === 'direto' ? '#D4A843' : '#4A5568', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            🔧 Abrir diretamente
          </button>
        </div>

        {tipoAbertura === 'orcamento' ? (
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Orçamento aprovado <span style={{ color: '#D4A843' }}>*</span></label>
            <select style={inp} value={orcamentoId} onChange={e => setOrcamentoId(e.target.value)}>
              <option value="">Selecione um orçamento...</option>
              {orcamentosAprovados.map(o => (
                <option key={o.id} value={o.id}>
                  #{o.token} — {o.cliente?.nome} — {o.veiculo?.placa} — R$ {o.valor_total?.toFixed(2).replace('.', ',')}
                </option>
              ))}
            </select>
            {orcamentosAprovados.length === 0 && (
              <p style={{ color: '#FC8181', fontSize: 12, marginTop: 6 }}>Nenhum orçamento aprovado disponível.</p>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
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
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Observações</label>
          <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' as const }} value={obsNova} onChange={e => setObsNova(e.target.value)} placeholder="Observações iniciais da OS..." />
        </div>

        {erro && <div style={{ color: '#FC8181', fontSize: 13, marginBottom: 12, background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', borderRadius: 8, padding: '8px 12px' }}>{erro}</div>}

        <button onClick={abrirOS} disabled={salvando}
          style={{ width: '100%', background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: 14, borderRadius: 10, fontWeight: 900, fontSize: 14, cursor: 'pointer', letterSpacing: 1 }}>
          {salvando ? 'ABRINDO...' : 'ABRIR ORDEM DE SERVIÇO'}
        </button>
      </div>
    </div>
  )

  // ── DETALHE OS ──
  if (aba === 'detalhe' && osSelecionada) {
    const st = STATUS_CONFIG[osSelecionada.status]
    const itensOrcamento = osSelecionada.orcamento?.itens || []

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => setAba('lista')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>← Voltar</button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>OS — {osSelecionada.cliente?.nome}</h1>
              <span style={{ background: st.bg, color: st.cor, fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 700, border: `1px solid ${st.cor}33` }}>{st.label}</span>
            </div>
            <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', marginTop: 6 }} />
          </div>
          <button onClick={() => excluirOS(osSelecionada.id)} style={{ background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', color: '#FC8181', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>EXCLUIR</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Dados */}
            <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>DADOS DA OS</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
                {[
                  { label: 'Cliente', valor: osSelecionada.cliente?.nome },
                  { label: 'Veículo', valor: `${osSelecionada.veiculo?.marca} ${osSelecionada.veiculo?.modelo}` },
                  { label: 'Placa', valor: osSelecionada.veiculo?.placa },
                  { label: 'Abertura', valor: new Date(osSelecionada.criado_em).toLocaleDateString('pt-BR') },
                  { label: 'Finalização', valor: osSelecionada.finalizado_em ? new Date(osSelecionada.finalizado_em).toLocaleDateString('pt-BR') : '—' },
                ].map((item, i) => (
                  <div key={i}>
                    <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>{item.label.toUpperCase()}</p>
                    <p style={{ color: '#fff', fontSize: 14, margin: 0 }}>{item.valor}</p>
                  </div>
                ))}
                {osSelecionada.observacoes && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>OBSERVAÇÕES</p>
                    <p style={{ color: '#CBD5E0', fontSize: 13, margin: 0 }}>{osSelecionada.observacoes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Serviços do orçamento */}
            {itensOrcamento.length > 0 && (
              <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>SERVIÇOS DO ORÇAMENTO</p>
                {itensOrcamento.map((item: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <p style={{ color: '#fff', fontSize: 13, margin: 0 }}>{item.descricao}</p>
                    <p style={{ color: '#D4A843', fontSize: 13, fontWeight: 700, margin: 0 }}>R$ {(item.valor * item.quantidade).toFixed(2).replace('.', ',')}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Etapas e fotos */}
            <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>FOTOS POR ETAPA</p>

              {/* Tabs etapas */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {ETAPAS.map(e => {
                  const qtd = (osSelecionada.fotos || []).filter(f => f.etapa === e.key).length
                  const ativo = etapaAtiva === e.key
                  return (
                    <button key={e.key} onClick={() => setEtapaAtiva(e.key)}
                      style={{ flex: 1, background: ativo ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${ativo ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: ativo ? '#D4A843' : '#4A5568', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: ativo ? 700 : 400, textAlign: 'center' as const }}>
                      {e.icon} {e.label} ({qtd})
                    </button>
                  )
                })}
              </div>

              {/* Upload nova foto */}
              {osSelecionada.status !== 'finalizada' && (
                <div style={{ background: '#080C18', border: '1px solid rgba(212,168,67,0.15)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>ADICIONAR FOTO — {ETAPAS.find(e => e.key === etapaAtiva)?.label.toUpperCase()}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={lbl}>Serviço realizado</label>
                      <input style={inp} value={novaServDesc} onChange={e => setNovaServDesc(e.target.value)} placeholder="Ex: Polimento — em andamento" />
                    </div>
                    <div>
                      <label style={lbl}>Observação da foto</label>
                      <input style={inp} value={novaObs} onChange={e => setNovaObs(e.target.value)} placeholder="Ex: Detalhe lateral direita" />
                    </div>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => e.target.files?.[0] && uploadFoto(e.target.files[0])} />
                  <button onClick={() => fileRef.current?.click()} disabled={uploadando}
                    style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '8px 20px', borderRadius: 8, fontWeight: 900, fontSize: 12, cursor: 'pointer', letterSpacing: 1 }}>
                    {uploadando ? 'ENVIANDO...' : '📷 ADICIONAR FOTO'}
                  </button>
                  {erro && <p style={{ color: '#FC8181', fontSize: 12, marginTop: 8 }}>{erro}</p>}
                </div>
              )}

              {/* Grid de fotos */}
              {fotosEtapa.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#4A5568', fontSize: 13 }}>
                  Nenhuma foto nesta etapa
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                  {fotosEtapa.map(foto => (
                    <div key={foto.id} style={{ background: '#080C18', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
                      <img src={foto.url} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                      <div style={{ padding: '8px 10px' }}>
                        {foto.servico_descricao && <p style={{ color: '#D4A843', fontSize: 11, fontWeight: 700, margin: '0 0 3px' }}>{foto.servico_descricao}</p>}
                        {foto.observacao && <p style={{ color: '#4A5568', fontSize: 11, margin: 0 }}>{foto.observacao}</p>}
                        <button onClick={() => excluirFoto(foto)}
                          style={{ background: 'transparent', border: 'none', color: '#FC8181', cursor: 'pointer', fontSize: 11, padding: '4px 0 0', fontWeight: 700 }}>
                          REMOVER
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14 }}>ATUALIZAR STATUS</p>

              {osSelecionada.status === 'aberta' && (
                <button onClick={() => atualizarStatus(osSelecionada.id, 'em_andamento')}
                  style={{ width: '100%', background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.3)', color: '#D4A843', padding: '12px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                  🔧 INICIAR SERVIÇO
                </button>
              )}
              {osSelecionada.status === 'em_andamento' && (
                <button onClick={() => atualizarStatus(osSelecionada.id, 'finalizada')}
                  style={{ width: '100%', background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '12px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 900, marginBottom: 8, letterSpacing: 1 }}>
                  ✅ FINALIZAR OS
                </button>
              )}
              {osSelecionada.status === 'finalizada' && (
                <div style={{ background: 'rgba(72,187,120,0.08)', border: '1px solid rgba(72,187,120,0.2)', borderRadius: 8, padding: 12, textAlign: 'center' as const }}>
                  <p style={{ color: '#48BB78', fontWeight: 700, fontSize: 14, margin: 0 }}>✅ OS FINALIZADA</p>
                  <p style={{ color: '#4A5568', fontSize: 12, margin: '4px 0 0' }}>
                    {osSelecionada.finalizado_em ? new Date(osSelecionada.finalizado_em).toLocaleDateString('pt-BR') : ''}
                  </p>
                </div>
              )}

              {osSelecionada.status !== 'aberta' && osSelecionada.status !== 'finalizada' && (
                <button onClick={() => atualizarStatus(osSelecionada.id, 'aberta')}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
                  Voltar para Aberta
                </button>
              )}
            </div>

            {/* Resumo fotos */}
            <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#4A5568', letterSpacing: 2, marginBottom: 12 }}>RESUMO DE FOTOS</p>
              {ETAPAS.map(e => {
                const qtd = (osSelecionada.fotos || []).filter(f => f.etapa === e.key).length
                return (
                  <div key={e.key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <p style={{ color: '#CBD5E0', fontSize: 13, margin: 0 }}>{e.icon} {e.label}</p>
                    <p style={{ color: qtd > 0 ? '#D4A843' : '#4A5568', fontSize: 13, fontWeight: 700, margin: 0 }}>{qtd} foto(s)</p>
                  </div>
                )
              })}
            </div>

            {/* Orçamento vinculado */}
            {osSelecionada.orcamento && (
              <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#4A5568', letterSpacing: 2, marginBottom: 10 }}>ORÇAMENTO VINCULADO</p>
                <p style={{ color: '#D4A843', fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>#{osSelecionada.orcamento.token}</p>
                <p style={{ color: '#fff', fontSize: 16, fontWeight: 900, margin: 0 }}>R$ {osSelecionada.orcamento.valor_total?.toFixed(2).replace('.', ',')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}