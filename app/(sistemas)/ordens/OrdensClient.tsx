'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Foto = {
  id: string; os_id: string; url: string
  etapa: 'recebimento' | 'andamento' | 'finalizado'
  observacao?: string; servico_descricao?: string; criado_em: string
}

type OsItem = {
  id: string; os_id: string; descricao: string
  status: 'pendente' | 'em_andamento' | 'concluido'
  observacao?: string; valor?: number; tipo?: 'servico' | 'material'; quantidade?: number
}

type OS = {
  id: string; empresa_id: string; cliente_id: string; veiculo_id: string
  orcamento_id?: string; plano_id?: string
  status: 'aberta' | 'em_andamento' | 'finalizada'
  observacoes?: string; criado_em: string; finalizado_em?: string
  notificacao_lida: boolean; token: string
  cliente?: any; veiculo?: any; orcamento?: any
  fotos?: Foto[]; itens?: OsItem[]; pagamentos?: { valor: number, forma: string }[]
}

type Aba = 'lista' | 'nova' | 'detalhe'
type FormaPagamento = 'dinheiro' | 'cartao_vista' | 'cartao_parcelado' | 'pix'

const FORMAS_PAGAMENTO: { key: FormaPagamento, label: string, icon: string }[] = [
  { key: 'dinheiro',         label: 'Dinheiro',       icon: '💵' },
  { key: 'pix',              label: 'Pix',            icon: '📱' },
  { key: 'cartao_vista',     label: 'Cartão à vista', icon: '💳' },
  { key: 'cartao_parcelado', label: 'Cartão parc.',   icon: '💳' },
]

const STATUS_CONFIG: Record<string, { label: string, cor: string, bg: string }> = {
  aberta:       { label: 'ABERTA',      cor: '#90CDF4', bg: 'rgba(144,205,244,0.1)' },
  em_andamento: { label: 'EM EXECUÇÃO', cor: '#D4A843', bg: 'rgba(212,168,67,0.1)'  },
  finalizada:   { label: 'FINALIZADA',  cor: '#48BB78', bg: 'rgba(72,187,120,0.1)'  },
}

const ITEM_STATUS: Record<string, { label: string, cor: string, bg: string, proximo: string }> = {
  pendente:     { label: 'PENDENTE',     cor: '#4A5568', bg: 'rgba(74,85,104,0.1)',   proximo: 'em_andamento' },
  em_andamento: { label: 'EM ANDAMENTO', cor: '#D4A843', bg: 'rgba(212,168,67,0.1)', proximo: 'concluido' },
  concluido:    { label: 'CONCLUÍDO',    cor: '#48BB78', bg: 'rgba(72,187,120,0.1)', proximo: 'pendente' },
}

const ETAPAS: { key: 'recebimento' | 'andamento' | 'finalizado', label: string, icon: string }[] = [
  { key: 'recebimento', label: 'Recebimento', icon: '📥' },
  { key: 'andamento',   label: 'Andamento',   icon: '🔧' },
  { key: 'finalizado',  label: 'Finalizado',  icon: '✅' },
]

function calcularValorOS(os: OS): number {
  if (os.orcamento_id && os.orcamento?.valor_total) return os.orcamento.valor_total
  return (os.itens || []).reduce((acc, item) => acc + ((item.valor || 0) * (item.quantidade || 1)), 0)
}

export default function OrdensClient() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [aba, setAba]             = useState<Aba>('lista')
  const [ordens, setOrdens]       = useState<OS[]>([])
  const [osSelecionada, setOsSelecionada] = useState<OS | null>(null)
  const [clientes, setClientes]   = useState<any[]>([])
  const [servicos, setServicos]   = useState<any[]>([])
  const [orcamentosAprovados, setOrcamentosAprovados] = useState<any[]>([])
  const [planosAtivos, setPlanosAtivos] = useState<any[]>([])
  const [salvando, setSalvando]   = useState(false)
  const [erro, setErro]           = useState('')
  const [filtro, setFiltro]       = useState('todos')
  const [etapaAtiva, setEtapaAtiva] = useState<'recebimento' | 'andamento' | 'finalizado'>('recebimento')
  const [uploadando, setUploadando] = useState(false)
  const [novaObs, setNovaObs]     = useState('')
  const [novaServDesc, setNovaServDesc] = useState('')
  const [linkCopiado, setLinkCopiado] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Modal de pagamento
  const [modalPagamento, setModalPagamento]     = useState(false)
  const [osParaFinalizar, setOsParaFinalizar]   = useState<OS | null>(null)
  const [formaPagamento, setFormaPagamento]     = useState<FormaPagamento>('pix')
  const [parcelas, setParcelas]                 = useState('2')
  const [valorRecebido, setValorRecebido]       = useState('')
  const [obsPagamento, setObsPagamento]         = useState('')
  const [salvandoPagamento, setSalvandoPagamento] = useState(false)

  // Form nova OS
  const [tipoAbertura, setTipoAbertura]         = useState<'orcamento' | 'direto'>('orcamento')
  const [orcamentoId, setOrcamentoId]           = useState('')
  const [clienteId, setClienteId]               = useState('')
  const [veiculoId, setVeiculoId]               = useState('')
  const [obsNova, setObsNova]                   = useState('')
  const [itensSelecionados, setItensSelecionados] = useState<string[]>([])

  // Adicionar item manual (serviço ou material) na OS
  const [novoItemDesc, setNovoItemDesc]         = useState('')
  const [novoItemValor, setNovoItemValor]       = useState('')
  const [novoItemQtd, setNovoItemQtd]           = useState('1')
  const [novoItemTipo, setNovoItemTipo]         = useState<'servico' | 'material'>('servico')
  const [adicionandoItem, setAdicionandoItem]   = useState(false)

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
    const [{ data: ords }, { data: pags }] = await Promise.all([
      supabase.from('ordens_servico').select('*, cliente:clientes(*), veiculo:veiculos(*), orcamento:orcamentos_detail(*, itens:orcamento_itens_detail(*)), fotos:os_fotos(*), itens:os_itens(*)').eq('empresa_id', eid).order('criado_em', { ascending: false }),
      supabase.from('pagamentos_os').select('os_id, valor, forma').eq('empresa_id', eid),
    ])
    const pagMap: Record<string, { valor: number, forma: string }[]> = {}
    ;(pags || []).forEach((p: any) => { if (!pagMap[p.os_id]) pagMap[p.os_id] = []; pagMap[p.os_id].push(p) })
    setOrdens((ords || []).map(os => ({ ...os, pagamentos: pagMap[os.id] || [] })))
  }

  async function carregarDados(eid: string) {
    const [{ data: cls }, { data: orcs }, { data: servs }, { data: planos }] = await Promise.all([
      supabase.from('clientes').select('*, veiculos(*)').eq('empresa_id', eid).order('nome'),
      supabase.from('orcamentos_detail').select('*, cliente:clientes(*), veiculo:veiculos(*), itens:orcamento_itens_detail(*)').eq('empresa_id', eid).eq('status', 'aprovado').order('criado_em', { ascending: false }),
      supabase.from('servicos_catalogo').select('*').eq('empresa_id', eid).eq('ativo', true).order('nome'),
      supabase.from('planos_manutencao').select('id, veiculo_id, cliente_id, servicos').eq('empresa_id', eid).eq('status', 'ativo'),
    ])
    setClientes(cls || []); setOrcamentosAprovados(orcs || [])
    setServicos(servs || []); setPlanosAtivos(planos || [])
  }

  async function abrirOS() {
    setErro('')
    if (tipoAbertura === 'orcamento' && !orcamentoId) { setErro('Selecione um orçamento.'); return }
    if (tipoAbertura === 'direto' && !clienteId) { setErro('Selecione um cliente.'); return }
    if (tipoAbertura === 'direto' && !veiculoId) { setErro('Selecione um veículo.'); return }
    setSalvando(true)
    let cid = clienteId, vid = veiculoId, oid: string | null = null, itensOrcamento: any[] = []
    if (tipoAbertura === 'orcamento') {
      const orc = orcamentosAprovados.find(o => o.id === orcamentoId)
      if (orc) { cid = orc.cliente_id; vid = orc.veiculo_id; oid = orc.id; itensOrcamento = orc.itens || [] }
    }
    const planoDoVeiculo = tipoAbertura === 'direto' ? planosAtivos.find(p => p.veiculo_id === vid) || null : null
    const { data: os, error } = await supabase.from('ordens_servico').insert({ empresa_id: empresaId, cliente_id: cid, veiculo_id: vid, orcamento_id: oid, plano_id: planoDoVeiculo?.id || null, status: 'aberta', observacoes: obsNova.trim() || null, notificacao_lida: false }).select().single()
    if (error || !os) { setErro('Erro ao abrir OS.'); setSalvando(false); return }
    const itensParaInserir = tipoAbertura === 'orcamento'
      ? itensOrcamento.map((i: any) => ({ os_id: os.id, empresa_id: empresaId, descricao: i.descricao, status: 'pendente', valor: i.valor || 0, tipo: 'servico', quantidade: 1 }))
      : itensSelecionados.map(sid => { const serv = servicos.find(s => s.id === sid); return { os_id: os.id, empresa_id: empresaId, descricao: serv?.nome || sid, status: 'pendente', valor: serv?.preco || 0, tipo: 'servico', quantidade: 1 } })
    if (itensParaInserir.length > 0) await supabase.from('os_itens').insert(itensParaInserir)
    await carregarOrdens(empresaId!); setSalvando(false)
    await abrirDetalhe(os.id); limparFormNova()
  }

  async function abrirDetalhe(id: string) {
    const { data } = await supabase.from('ordens_servico').select('*, cliente:clientes(*), veiculo:veiculos(*), orcamento:orcamentos_detail(*, itens:orcamento_itens_detail(*)), fotos:os_fotos(*), itens:os_itens(*)').eq('id', id).single()
    setOsSelecionada(data); setEtapaAtiva('recebimento'); setAba('detalhe')
  }

  async function adicionarItemManual() {
    if (!novoItemDesc.trim() || !osSelecionada) return
    setAdicionandoItem(true)
    const valor = parseFloat(novoItemValor.replace(',', '.')) || 0
    const qtd = parseInt(novoItemQtd) || 1
    await supabase.from('os_itens').insert({ os_id: osSelecionada.id, empresa_id: empresaId, descricao: novoItemDesc.trim(), status: 'pendente', valor, tipo: novoItemTipo, quantidade: qtd })
    setNovoItemDesc(''); setNovoItemValor(''); setNovoItemQtd('1')
    await abrirDetalhe(osSelecionada.id)
    setAdicionandoItem(false)
  }

  async function excluirItem(item: OsItem) {
    if (!confirm(`Excluir "${item.descricao}"?`)) return
    await supabase.from('os_itens').delete().eq('id', item.id)
    await abrirDetalhe(osSelecionada!.id)
  }

  function abrirModalPagamento(os: OS) {
    const valor = calcularValorOS(os)
    setOsParaFinalizar(os); setFormaPagamento('pix'); setParcelas('2')
    setValorRecebido(valor > 0 ? valor.toFixed(2).replace('.', ',') : ''); setObsPagamento(''); setModalPagamento(true)
  }

  async function confirmarFinalizacao(registrarPagamento: boolean) {
    if (!osParaFinalizar) return
    setSalvandoPagamento(true)
    const finalizadoEm = new Date().toISOString()
    const jaFinalizada = osParaFinalizar.status === 'finalizada'
    if (!jaFinalizada) await supabase.from('ordens_servico').update({ status: 'finalizada', finalizado_em: finalizadoEm, notificacao_lida: false }).eq('id', osParaFinalizar.id)
    if (registrarPagamento) {
      const valorBase = calcularValorOS(osParaFinalizar)
      let valorFinal: number
      if (formaPagamento === 'cartao_parcelado') {
        valorFinal = parseInt(parcelas || '1') * (parseFloat((valorRecebido || '0').replace(',', '.')) || 0)
        if (valorFinal <= 0) valorFinal = valorBase
      } else {
        valorFinal = parseFloat((valorRecebido || '0').replace(',', '.')) || valorBase
      }
      await supabase.from('pagamentos_os').insert({ empresa_id: empresaId, os_id: osParaFinalizar.id, forma: formaPagamento, parcelas: formaPagamento === 'cartao_parcelado' ? parseInt(parcelas) : null, valor: valorFinal, recebido_em: jaFinalizada ? new Date().toISOString() : finalizadoEm, observacoes: obsPagamento.trim() || null, status: 'recebido' })
    }
    const osId = osParaFinalizar.id
    setModalPagamento(false); setOsParaFinalizar(null); setSalvandoPagamento(false)
    await abrirDetalhe(osId); await carregarOrdens(empresaId!)
  }

  async function atualizarStatus(id: string, status: string) {
    if (status === 'finalizada') { const os = ordens.find(o => o.id === id) || osSelecionada; if (os) { abrirModalPagamento(os); return } }
    await supabase.from('ordens_servico').update({ status }).eq('id', id)
    await abrirDetalhe(id); await carregarOrdens(empresaId!)
  }

  async function toggleItemStatus(item: OsItem) {
    const proximo = ITEM_STATUS[item.status]?.proximo || 'pendente'
    await supabase.from('os_itens').update({ status: proximo }).eq('id', item.id)
    await abrirDetalhe(osSelecionada!.id)
  }

  async function uploadFoto(file: File) {
    if (!osSelecionada) return
    setUploadando(true); setErro('')
    if (!file.type.startsWith('image/')) { setErro('Arquivo deve ser imagem.'); setUploadando(false); return }
    if (file.size > 5 * 1024 * 1024) { setErro('Imagem deve ter no máximo 5MB.'); setUploadando(false); return }
    const ext = file.name.split('.').pop()
    const path = `${empresaId}/${osSelecionada.id}/${etapaAtiva}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('os-fotos').upload(path, file)
    if (uploadError) { setErro('Erro ao fazer upload.'); setUploadando(false); return }
    const { data: { publicUrl } } = supabase.storage.from('os-fotos').getPublicUrl(path)
    await supabase.from('os_fotos').insert({ os_id: osSelecionada.id, empresa_id: empresaId, url: publicUrl, etapa: etapaAtiva, observacao: novaObs.trim() || null, servico_descricao: novaServDesc.trim() || null })
    setNovaObs(''); setNovaServDesc(''); setUploadando(false)
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
    await supabase.from('os_itens').delete().eq('os_id', id)
    await supabase.from('pagamentos_os').delete().eq('os_id', id)
    await supabase.from('ordens_servico').delete().eq('id', id)
    await carregarOrdens(empresaId!); setAba('lista')
  }

  function copiarLink() {
    if (!osSelecionada?.token) return
    navigator.clipboard.writeText(`${window.location.origin}/acompanhar/${osSelecionada.token}`)
    setLinkCopiado(true); setTimeout(() => setLinkCopiado(false), 2000)
  }

  function enviarWhatsAppOS() {
    if (!osSelecionada) return
    const link = `${window.location.origin}/acompanhar/${osSelecionada.token}`
    const msg = `Olá, ${osSelecionada.cliente?.nome?.split(' ')[0]}! 👋\n\nSeu veículo *${osSelecionada.veiculo?.marca} ${osSelecionada.veiculo?.modelo}* (${osSelecionada.veiculo?.placa}) já está em nosso serviço.\n\nAcompanhe o progresso em tempo real pelo link abaixo:\n🔗 ${link}\n\nQualquer dúvida, estamos à disposição! ✨`
    const tel = osSelecionada.cliente?.telefone?.replace(/\D/g, '')
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function limparFormNova() { setOrcamentoId(''); setClienteId(''); setVeiculoId(''); setObsNova(''); setErro(''); setItensSelecionados([]) }

  const veiculosCliente = clientes.find(c => c.id === clienteId)?.veiculos || []
  const ordensFiltradas = filtro === 'todos' ? ordens : ordens.filter(o => o.status === filtro)
  const fotosEtapa = (osSelecionada?.fotos || []).filter(f => f.etapa === etapaAtiva)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column' as const, gap: 16 }}>
      <div style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#080C18', fontSize: 22, fontWeight: 900 }}>Z</span>
      </div>
      <p style={{ color: '#D4A843', fontWeight: 700, letterSpacing: 2, fontSize: 12 }}>CARREGANDO...</p>
    </div>
  )

  const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', background: '#080C18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#fff', fontSize: 14, boxSizing: 'border-box' as const, outline: 'none' }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#4A5568', display: 'block', marginBottom: 6, letterSpacing: 1 }

  // ── MODAL PAGAMENTO ──
  const ModalPagamento = () => {
    if (!modalPagamento || !osParaFinalizar) return null
    const valor = calcularValorOS(osParaFinalizar)
    const ehPlano = !!osParaFinalizar.plano_id
    const vReal = parseFloat((valorRecebido || '0').replace(',', '.')) || 0
    const diff = vReal - valor
    const temDiff = Math.abs(diff) > 0.01 && vReal > 0
    return (
      <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: '#0D1220', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' as const }}>
          <div style={{ marginBottom: 20, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 16 }}>
            <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 900, margin: '0 0 6px' }}>{osParaFinalizar.status === 'finalizada' ? '💰 Registrar Pagamento' : '✅ Finalizar OS'}</h2>
            <p style={{ color: '#4A5568', fontSize: 13, margin: '0 0 14px' }}>{osParaFinalizar.cliente?.nome} — {osParaFinalizar.veiculo?.marca} {osParaFinalizar.veiculo?.modelo} · {osParaFinalizar.veiculo?.placa}</p>
            {valor > 0 && (
              <div style={{ background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, margin: 0 }}>VALOR DA OS</p>
                <p style={{ color: '#D4A843', fontSize: 26, fontWeight: 900, margin: 0 }}>R$ {valor.toFixed(2).replace('.', ',')}</p>
              </div>
            )}
          </div>
          {ehPlano && (
            <div style={{ background: 'rgba(144,205,244,0.06)', border: '1px solid rgba(144,205,244,0.2)', borderRadius: 10, padding: '8px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>📅</span>
              <p style={{ color: '#90CDF4', fontSize: 12, margin: 0 }}>OS de <strong>Plano Mensal</strong> — registre se houver cobrança avulsa neste atendimento.</p>
            </div>
          )}
          <div style={{ marginBottom: 20 }}>
            <label style={{ ...lbl, marginBottom: 10 }}>FORMA DE PAGAMENTO</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {FORMAS_PAGAMENTO.map(fp => (
                <button key={fp.key} onClick={() => { setFormaPagamento(fp.key); if (fp.key !== 'cartao_parcelado') { setValorRecebido(valor > 0 ? valor.toFixed(2).replace('.', ',') : '') } else { setValorRecebido(''); setParcelas('2') } }}
                  style={{ background: formaPagamento === fp.key ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${formaPagamento === fp.key ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: formaPagamento === fp.key ? '#D4A843' : '#4A5568', padding: '12px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: formaPagamento === fp.key ? 700 : 400, textAlign: 'left' as const }}>
                  {fp.icon} {fp.label}
                </button>
              ))}
            </div>
            {formaPagamento === 'cartao_parcelado' && (
              <div style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <p style={{ color: '#F97316', fontSize: 11, fontWeight: 700, letterSpacing: 1, margin: '0 0 12px' }}>DETALHES DO PARCELAMENTO</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={lbl}>Nº DE PARCELAS</label>
                    <input style={inp} type="text" inputMode="numeric" value={parcelas} onChange={e => setParcelas(e.target.value.replace(/\D/g, ''))} placeholder="Ex: 10" />
                  </div>
                  <div>
                    <label style={lbl}>VALOR DA PARCELA (R$)</label>
                    <div style={{ position: 'relative' as const }}>
                      <span style={{ position: 'absolute' as const, left: 14, top: '50%', transform: 'translateY(-50%)', color: '#4A5568', fontSize: 14 }}>R$</span>
                      <input style={{ ...inp, paddingLeft: 36 }} value={valorRecebido} onChange={e => setValorRecebido(e.target.value)} placeholder="Ex: 73,50" inputMode="decimal" />
                    </div>
                  </div>
                </div>
                {parcelas && valorRecebido && parseFloat((valorRecebido || '0').replace(',', '.')) > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ color: '#4A5568', fontSize: 12, margin: 0 }}>Total a receber:</p>
                    <p style={{ color: '#F97316', fontSize: 15, fontWeight: 900, margin: 0 }}>R$ {(parseInt(parcelas || '0') * parseFloat((valorRecebido || '0').replace(',', '.'))).toFixed(2).replace('.', ',')}</p>
                  </div>
                )}
              </div>
            )}
            {formaPagamento !== 'cartao_parcelado' && (
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>VALOR RECEBIDO <span style={{ color: '#4A5568', marginLeft: 6, fontSize: 10, fontWeight: 400 }}>Edite se houve desconto</span></label>
                <div style={{ position: 'relative' as const }}>
                  <span style={{ position: 'absolute' as const, left: 14, top: '50%', transform: 'translateY(-50%)', color: '#4A5568', fontSize: 14 }}>R$</span>
                  <input style={{ ...inp, paddingLeft: 36 }} value={valorRecebido} onChange={e => setValorRecebido(e.target.value)} placeholder={valor > 0 ? valor.toFixed(2).replace('.', ',') : '0,00'} inputMode="decimal" />
                </div>
                {temDiff && (
                  <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, background: diff > 0 ? 'rgba(249,115,22,0.08)' : 'rgba(72,187,120,0.08)', border: `1px solid ${diff > 0 ? 'rgba(249,115,22,0.2)' : 'rgba(72,187,120,0.2)'}`, display: 'flex', justifyContent: 'space-between' }}>
                    <p style={{ color: diff > 0 ? '#F97316' : '#48BB78', fontSize: 12, fontWeight: 700, margin: 0 }}>{diff > 0 ? '📈 Acréscimo' : '📉 Desconto concedido'}</p>
                    <p style={{ color: diff > 0 ? '#F97316' : '#48BB78', fontSize: 12, fontWeight: 900, margin: 0 }}>{diff > 0 ? '+' : ''}R$ {Math.abs(diff).toFixed(2).replace('.', ',')}</p>
                  </div>
                )}
              </div>
            )}
            <div>
              <label style={lbl}>OBSERVAÇÕES (opcional)</label>
              <input style={inp} value={obsPagamento} onChange={e => setObsPagamento(e.target.value)} placeholder="Ex: Pago no ato, cliente solicitou recibo..." />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            <button onClick={() => confirmarFinalizacao(true)} disabled={salvandoPagamento}
              style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '13px 16px', borderRadius: 10, fontWeight: 900, fontSize: 14, cursor: 'pointer', letterSpacing: 1 }}>
              {salvandoPagamento ? 'SALVANDO...' : osParaFinalizar.status === 'finalizada' ? '✅ CONFIRMAR RECEBIMENTO' : '✅ FINALIZAR E REGISTRAR PAGAMENTO'}
            </button>
            <button onClick={() => confirmarFinalizacao(false)} disabled={salvandoPagamento}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '11px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>
              {osParaFinalizar.status === 'finalizada' ? 'Cancelar' : 'Finalizar sem registrar pagamento'}
            </button>
            <button onClick={() => setModalPagamento(false)} disabled={salvandoPagamento}
              style={{ background: 'transparent', border: 'none', color: '#4A5568', padding: '8px', cursor: 'pointer', fontSize: 12 }}>
              ← Voltar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── LISTA ──
  if (aba === 'lista') {
    const contadores = { todos: ordens.length, aberta: ordens.filter(o => o.status === 'aberta').length, em_andamento: ordens.filter(o => o.status === 'em_andamento').length, finalizada: ordens.filter(o => o.status === 'finalizada').length }
    return (
      <>
        <ModalPagamento />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>🔧 Ordens de Serviço</h1>
              <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', marginTop: 6 }} />
              <p style={{ color: '#4A5568', fontSize: 12, marginTop: 4 }}>{ordens.length} ordens cadastradas</p>
            </div>
            <button onClick={() => { setAba('nova'); limparFormNova() }}
              style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '10px 20px', borderRadius: 10, fontWeight: 900, fontSize: 13, cursor: 'pointer', letterSpacing: 1 }}>
              + NOVA OS
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as const }}>
            {[{ key: 'todos', label: `Todos (${contadores.todos})` }, { key: 'aberta', label: `ABERTA (${contadores.aberta})` }, { key: 'em_andamento', label: `EM EXECUÇÃO (${contadores.em_andamento})` }, { key: 'finalizada', label: `FINALIZADA (${contadores.finalizada})` }].map(f => (
              <button key={f.key} onClick={() => setFiltro(f.key)}
                style={{ background: filtro === f.key ? 'rgba(212,168,67,0.15)' : 'transparent', border: `1px solid ${filtro === f.key ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: filtro === f.key ? '#D4A843' : '#4A5568', padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: filtro === f.key ? 700 : 400 }}>
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {ordensFiltradas.map(os => {
              const st = STATUS_CONFIG[os.status]
              const valor = calcularValorOS(os)
              return (
                <div key={os.id} onClick={() => abrirDetalhe(os.id)}
                  style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' as const }}>
                      <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: 0 }}>{os.cliente?.nome}</p>
                      <span style={{ background: st.bg, color: st.cor, fontSize: 10, padding: '2px 8px', borderRadius: 8, fontWeight: 700, border: `1px solid ${st.cor}33`, whiteSpace: 'nowrap' as const }}>{st.label}</span>
                      {os.plano_id && <span style={{ background: 'rgba(144,205,244,0.1)', color: '#90CDF4', fontSize: 9, padding: '2px 7px', borderRadius: 6, fontWeight: 700, border: '1px solid rgba(144,205,244,0.2)' }}>PLANO</span>}
                      {os.status === 'finalizada' && ((os as any).pagamentos?.length > 0
                        ? <span style={{ background: 'rgba(72,187,120,0.1)', color: '#48BB78', fontSize: 9, padding: '2px 7px', borderRadius: 6, fontWeight: 700, border: '1px solid rgba(72,187,120,0.2)' }}>✅ PAGO</span>
                        : <span style={{ background: 'rgba(252,129,129,0.08)', color: '#FC8181', fontSize: 9, padding: '2px 7px', borderRadius: 6, fontWeight: 700, border: '1px solid rgba(252,129,129,0.2)' }}>💰 PENDENTE</span>
                      )}
                    </div>
                    <p style={{ color: '#4A5568', fontSize: 12, margin: 0 }}>{os.veiculo?.marca} {os.veiculo?.modelo} · {os.veiculo?.placa}{os.itens && os.itens.length > 0 && ` · ${os.itens.filter(i => i.status === 'concluido').length}/${os.itens.length} serviços`}</p>
                  </div>
                  <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                    {valor > 0 && <p style={{ color: '#D4A843', fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>R$ {valor.toFixed(2).replace('.', ',')}</p>}
                    <p style={{ color: '#4A5568', fontSize: 11, margin: 0 }}>{new Date(os.criado_em).toLocaleDateString('pt-BR')}</p>
                    <p style={{ color: '#4A5568', fontSize: 11, margin: '2px 0 0' }}>{(os.fotos || []).length} foto(s)</p>
                  </div>
                </div>
              )
            })}
            {ordensFiltradas.length === 0 && <div style={{ textAlign: 'center' as const, padding: '40px 0', color: '#4A5568' }}><p style={{ fontSize: 28, margin: '0 0 8px' }}>🔧</p><p style={{ fontSize: 14 }}>Nenhuma OS encontrada</p></div>}
          </div>
        </div>
      </>
    )
  }

  // ── NOVA OS ──
  if (aba === 'nova') return (
    <>
      <ModalPagamento />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => setAba('lista')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>← Voltar</button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>Nova Ordem de Serviço</h1>
            <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', marginTop: 6 }} />
          </div>
        </div>
        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 24, maxWidth: 600 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14 }}>ORIGEM DA OS</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[{ key: 'orcamento', label: '📋 A partir de orçamento' }, { key: 'direto', label: '🔧 Abrir diretamente' }].map(opt => (
              <button key={opt.key} onClick={() => setTipoAbertura(opt.key as any)}
                style={{ background: tipoAbertura === opt.key ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${tipoAbertura === opt.key ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: tipoAbertura === opt.key ? '#D4A843' : '#4A5568', padding: '12px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: tipoAbertura === opt.key ? 700 : 400 }}>
                {opt.label}
              </button>
            ))}
          </div>

          {tipoAbertura === 'orcamento' ? (
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Orçamento aprovado <span style={{ color: '#D4A843' }}>*</span></label>
              <select style={inp} value={orcamentoId} onChange={e => setOrcamentoId(e.target.value)}>
                <option value="">Selecione um orçamento...</option>
                {orcamentosAprovados.map(o => <option key={o.id} value={o.id}>#{o.token} — {o.cliente?.nome} — R$ {o.valor_total?.toFixed(2).replace('.', ',')}</option>)}
              </select>
              {orcamentoId && (() => {
                const orc = orcamentosAprovados.find(o => o.id === orcamentoId)
                return orc?.itens?.length > 0 ? (
                  <div style={{ background: '#080C18', border: '1px solid rgba(212,168,67,0.15)', borderRadius: 8, padding: 12, marginTop: 10 }}>
                    <p style={{ color: '#D4A843', fontSize: 11, fontWeight: 700, letterSpacing: 1, margin: '0 0 8px' }}>SERVIÇOS DO ORÇAMENTO</p>
                    {orc.itens.map((i: any) => <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><p style={{ color: '#CBD5E0', fontSize: 13, margin: 0 }}>• {i.descricao}</p>{i.valor > 0 && <p style={{ color: '#4A5568', fontSize: 12, margin: 0 }}>R$ {i.valor?.toFixed(2).replace('.', ',')}</p>}</div>)}
                  </div>
                ) : null
              })()}
            </div>
          ) : (
            <div>
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
              {veiculoId && planosAtivos.find(p => p.veiculo_id === veiculoId) && (
                <div style={{ background: 'rgba(144,205,244,0.06)', border: '1px solid rgba(144,205,244,0.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                  <p style={{ color: '#90CDF4', fontSize: 12, fontWeight: 700, margin: 0 }}>📅 Este veículo possui plano de manutenção ativo — OS será vinculada automaticamente</p>
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Serviços a realizar (catálogo)</label>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, maxHeight: 200, overflowY: 'auto' as const }}>
                  {servicos.map(s => {
                    const selecionado = itensSelecionados.includes(s.id)
                    return (
                      <div key={s.id} onClick={() => setItensSelecionados(prev => selecionado ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                        style={{ background: selecionado ? 'rgba(212,168,67,0.1)' : '#080C18', border: `1px solid ${selecionado ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 8, padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ color: selecionado ? '#D4A843' : '#CBD5E0', fontSize: 13, fontWeight: selecionado ? 700 : 400, margin: 0 }}>{s.nome}</p>
                        <p style={{ color: '#4A5568', fontSize: 12, margin: 0 }}>R$ {s.preco?.toFixed(2).replace('.', ',')}</p>
                      </div>
                    )
                  })}
                  {servicos.length === 0 && <p style={{ color: '#4A5568', fontSize: 13 }}>Nenhum serviço cadastrado.</p>}
                </div>
                {itensSelecionados.length > 0 && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(212,168,67,0.06)', border: '1px solid rgba(212,168,67,0.15)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <p style={{ color: '#D4A843', fontSize: 12, fontWeight: 700, margin: 0 }}>{itensSelecionados.length} serviço(s)</p>
                    <p style={{ color: '#D4A843', fontSize: 12, fontWeight: 900, margin: 0 }}>Total: R$ {itensSelecionados.reduce((acc, sid) => acc + (servicos.find(s => s.id === sid)?.preco || 0), 0).toFixed(2).replace('.', ',')}</p>
                  </div>
                )}
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
    </>
  )

  // ── DETALHE OS ──
  if (aba === 'detalhe' && osSelecionada) {
    const st = STATUS_CONFIG[osSelecionada.status]
    const itens = osSelecionada.itens || []
    const servs = itens.filter(i => !i.tipo || i.tipo === 'servico')
    const mats  = itens.filter(i => i.tipo === 'material')
    const concluidos = servs.filter(i => i.status === 'concluido').length
    const valorTotal = calcularValorOS(osSelecionada)
    const temOrcamento = !!osSelecionada.orcamento_id
    const ehPlano = !!osSelecionada.plano_id

    return (
      <>
        <ModalPagamento />
        <style>{`
          .os-detalhe-grid { display: grid; grid-template-columns: 1fr 300px; gap: 16px; align-items: start; }
          .os-header-row { display: flex; align-items: center; gap: 10px; }
          .os-header-badges { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
          @media (max-width: 768px) {
            .os-detalhe-grid { grid-template-columns: 1fr !important; }
            .os-header-row { flex-wrap: wrap; gap: 6px; }
          }
        `}</style>

        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24, flexWrap: 'wrap' as const }}>
            <button onClick={() => setAba('lista')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>← Voltar</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="os-header-row">
                <h1 style={{ fontSize: 18, fontWeight: 900, color: '#fff', margin: 0 }}>OS — {osSelecionada.cliente?.nome}</h1>
                <div className="os-header-badges">
                  <span style={{ background: st.bg, color: st.cor, fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 700, border: `1px solid ${st.cor}33`, whiteSpace: 'nowrap' as const }}>{st.label}</span>
                  {ehPlano && <span style={{ background: 'rgba(144,205,244,0.1)', color: '#90CDF4', fontSize: 10, padding: '3px 10px', borderRadius: 10, fontWeight: 700, border: '1px solid rgba(144,205,244,0.2)', whiteSpace: 'nowrap' as const }}>PLANO</span>}
                </div>
              </div>
              <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', marginTop: 6 }} />
            </div>
            <button onClick={() => excluirOS(osSelecionada.id)} style={{ background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', color: '#FC8181', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>EXCLUIR</button>
          </div>

          <div className="os-detalhe-grid">
            {/* COLUNA PRINCIPAL */}
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>

              {/* Dados */}
              <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>DADOS DA OS</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14 }}>
                  {[{ label: 'Cliente', valor: osSelecionada.cliente?.nome }, { label: 'Veículo', valor: `${osSelecionada.veiculo?.marca} ${osSelecionada.veiculo?.modelo}` }, { label: 'Placa', valor: osSelecionada.veiculo?.placa }, { label: 'Abertura', valor: new Date(osSelecionada.criado_em).toLocaleDateString('pt-BR') }, { label: 'Finalização', valor: osSelecionada.finalizado_em ? new Date(osSelecionada.finalizado_em).toLocaleDateString('pt-BR') : '—' }].map((item, i) => (
                    <div key={i}>
                      <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>{item.label.toUpperCase()}</p>
                      <p style={{ color: '#fff', fontSize: 14, margin: 0 }}>{item.valor}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* SERVIÇOS */}
              <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, margin: 0 }}>🔧 SERVIÇOS {servs.length > 0 ? `(${concluidos}/${servs.length} concluídos)` : ''}</p>
                  {servs.length > 0 && (
                    <div style={{ background: '#080C18', borderRadius: 20, height: 6, width: 100, overflow: 'hidden' }}>
                      <div style={{ background: 'linear-gradient(90deg, #D4A843, #48BB78)', height: '100%', width: `${servs.length > 0 ? (concluidos / servs.length) * 100 : 0}%`, transition: 'width 0.3s' }} />
                    </div>
                  )}
                </div>

                {servs.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 12 }}>
                    {servs.map(item => {
                      const ist = ITEM_STATUS[item.status]
                      return (
                        <div key={item.id} style={{ background: ist.bg, border: `1px solid ${ist.cor}33`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: osSelecionada.status !== 'finalizada' ? 'pointer' : 'default' }} onClick={() => osSelecionada.status !== 'finalizada' && toggleItemStatus(item)}>
                            <span style={{ fontSize: 18 }}>{item.status === 'concluido' ? '✅' : item.status === 'em_andamento' ? '🔧' : '⏳'}</span>
                            <div>
                              <p style={{ color: item.status === 'concluido' ? '#48BB78' : '#fff', fontSize: 14, fontWeight: item.status === 'concluido' ? 700 : 400, margin: 0, textDecoration: item.status === 'concluido' ? 'line-through' : 'none' }}>{item.descricao}</p>
                              {item.valor != null && item.valor > 0 && <p style={{ color: '#4A5568', fontSize: 11, margin: '2px 0 0' }}>R$ {item.valor.toFixed(2).replace('.', ',')}</p>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span style={{ background: ist.bg, color: ist.cor, fontSize: 10, padding: '3px 8px', borderRadius: 10, fontWeight: 700, border: `1px solid ${ist.cor}33`, whiteSpace: 'nowrap' as const }}>{ist.label}</span>
                            {osSelecionada.status !== 'finalizada' && <button onClick={() => excluirItem(item)} style={{ background: 'transparent', border: 'none', color: '#FC8181', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}>✕</button>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Adicionar serviço manual */}
                {osSelecionada.status !== 'finalizada' && (
                  <div style={{ background: '#080C18', border: '1px solid rgba(212,168,67,0.12)', borderRadius: 10, padding: 14 }}>
                    <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>+ ADICIONAR SERVIÇO AVULSO</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, marginBottom: 8 }}>
                      <input style={inp} value={novoItemTipo === 'servico' ? novoItemDesc : ''} onChange={e => { setNovoItemTipo('servico'); setNovoItemDesc(e.target.value) }} placeholder="Ex: Polimento, Higienização..." onFocus={() => setNovoItemTipo('servico')} />
                      <input style={{ ...inp, width: 100 }} type="text" inputMode="decimal" value={novoItemTipo === 'servico' ? novoItemValor : ''} onChange={e => { setNovoItemTipo('servico'); setNovoItemValor(e.target.value) }} placeholder="R$ valor" onFocus={() => setNovoItemTipo('servico')} />
                      <button onClick={() => { setNovoItemTipo('servico'); adicionarItemManual() }} disabled={adicionandoItem || !novoItemDesc.trim() || novoItemTipo !== 'servico'}
                        style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '0 16px', borderRadius: 8, fontWeight: 900, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                        {adicionandoItem && novoItemTipo === 'servico' ? '...' : '+ ADD'}
                      </button>
                    </div>
                  </div>
                )}

                {osSelecionada.status !== 'finalizada' && servs.length > 0 && <p style={{ color: '#4A5568', fontSize: 11, marginTop: 10, textAlign: 'center' as const }}>Clique em um serviço para atualizar o status</p>}

                {osSelecionada.status !== 'finalizada' && servs.length > 0 && concluidos === servs.length && (
                  <div style={{ marginTop: 14, background: 'linear-gradient(135deg, rgba(72,187,120,0.12), rgba(212,168,67,0.08))', border: '1px solid rgba(72,187,120,0.35)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
                    <div>
                      <p style={{ color: '#48BB78', fontSize: 13, fontWeight: 900, margin: '0 0 3px' }}>🎉 Todos os serviços concluídos!</p>
                      <p style={{ color: '#4A5568', fontSize: 12, margin: 0 }}>Registre o recebimento e feche a OS.</p>
                    </div>
                    <button onClick={() => abrirModalPagamento(osSelecionada)} style={{ background: 'linear-gradient(135deg, #48BB78, #38A169)', border: 'none', color: '#fff', padding: '10px 18px', borderRadius: 10, fontWeight: 900, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>💰 Recebimento e Fechar OS</button>
                  </div>
                )}

                {!temOrcamento && valorTotal > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(212,168,67,0.1)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
                    <p style={{ color: '#4A5568', fontSize: 12, margin: 0 }}>TOTAL DA OS</p>
                    <p style={{ color: '#D4A843', fontSize: 18, fontWeight: 900, margin: 0 }}>R$ {valorTotal.toFixed(2).replace('.', ',')}</p>
                  </div>
                )}
              </div>

              {/* MATERIAIS */}
              <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#90CDF4', letterSpacing: 2, marginBottom: 14, borderBottom: '1px solid rgba(144,205,244,0.1)', paddingBottom: 10 }}>📦 MATERIAIS / PEÇAS {mats.length > 0 ? `(${mats.length})` : ''}</p>

                {mats.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 12 }}>
                    {mats.map(item => (
                      <div key={item.id} style={{ background: 'rgba(144,205,244,0.05)', border: '1px solid rgba(144,205,244,0.15)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ color: '#fff', fontSize: 14, margin: 0 }}>📦 {item.descricao}</p>
                          <p style={{ color: '#4A5568', fontSize: 11, margin: '3px 0 0' }}>
                            {item.quantidade && item.quantidade > 1 ? `${item.quantidade}x ` : ''}
                            {item.valor != null && item.valor > 0 ? `R$ ${item.valor.toFixed(2).replace('.', ',')} cada — Total: R$ ${((item.valor) * (item.quantidade || 1)).toFixed(2).replace('.', ',')}` : 'Sem valor'}
                          </p>
                        </div>
                        {osSelecionada.status !== 'finalizada' && <button onClick={() => excluirItem(item)} style={{ background: 'transparent', border: 'none', color: '#FC8181', cursor: 'pointer', fontSize: 13, padding: '2px 4px', flexShrink: 0 }}>✕</button>}
                      </div>
                    ))}
                    <div style={{ paddingTop: 8, borderTop: '1px solid rgba(144,205,244,0.1)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <p style={{ color: '#90CDF4', fontSize: 12, margin: 0 }}>TOTAL MATERIAIS</p>
                      <p style={{ color: '#90CDF4', fontSize: 15, fontWeight: 900, margin: 0 }}>R$ {mats.reduce((acc, m) => acc + ((m.valor || 0) * (m.quantidade || 1)), 0).toFixed(2).replace('.', ',')}</p>
                    </div>
                  </div>
                )}

                {/* Adicionar material */}
                {osSelecionada.status !== 'finalizada' && (
                  <div style={{ background: '#080C18', border: '1px solid rgba(144,205,244,0.1)', borderRadius: 10, padding: 14 }}>
                    <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>+ ADICIONAR MATERIAL / PEÇA</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8 }}>
                      <input style={inp} value={novoItemTipo === 'material' ? novoItemDesc : ''} onChange={e => { setNovoItemTipo('material'); setNovoItemDesc(e.target.value) }} placeholder="Ex: Módulo som, Cabo HDMI..." onFocus={() => setNovoItemTipo('material')} />
                      <input style={{ ...inp, width: 80 }} type="text" inputMode="numeric" value={novoItemTipo === 'material' ? novoItemQtd : '1'} onChange={e => { setNovoItemTipo('material'); setNovoItemQtd(e.target.value.replace(/\D/g, '') || '1') }} placeholder="Qtd" onFocus={() => setNovoItemTipo('material')} />
                      <input style={{ ...inp, width: 100 }} type="text" inputMode="decimal" value={novoItemTipo === 'material' ? novoItemValor : ''} onChange={e => { setNovoItemTipo('material'); setNovoItemValor(e.target.value) }} placeholder="R$ unit." onFocus={() => setNovoItemTipo('material')} />
                      <button onClick={() => { setNovoItemTipo('material'); adicionarItemManual() }} disabled={adicionandoItem || !novoItemDesc.trim() || novoItemTipo !== 'material'}
                        style={{ background: 'rgba(144,205,244,0.15)', border: '1px solid rgba(144,205,244,0.3)', color: '#90CDF4', padding: '0 14px', borderRadius: 8, fontWeight: 900, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                        {adicionandoItem && novoItemTipo === 'material' ? '...' : '+ ADD'}
                      </button>
                    </div>
                  </div>
                )}
                {mats.length === 0 && osSelecionada.status === 'finalizada' && (
                  <p style={{ color: '#4A5568', fontSize: 13, textAlign: 'center' as const, padding: '12px 0', margin: 0 }}>Nenhum material registrado nesta OS.</p>
                )}
              </div>

              {/* Fotos */}
              <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>FOTOS POR ETAPA</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {ETAPAS.map(e => {
                    const qtd = (osSelecionada.fotos || []).filter(f => f.etapa === e.key).length
                    const ativo = etapaAtiva === e.key
                    return (
                      <button key={e.key} onClick={() => setEtapaAtiva(e.key)}
                        style={{ flex: 1, background: ativo ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${ativo ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: ativo ? '#D4A843' : '#4A5568', padding: '8px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: ativo ? 700 : 400, textAlign: 'center' as const }}>
                        {e.icon} {e.label} ({qtd})
                      </button>
                    )
                  })}
                </div>
                {osSelecionada.status !== 'finalizada' && (
                  <div style={{ background: '#080C18', border: '1px solid rgba(212,168,67,0.15)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>ADICIONAR FOTO — {ETAPAS.find(e => e.key === etapaAtiva)?.label.toUpperCase()}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div><label style={lbl}>Serviço realizado</label><input style={inp} value={novaServDesc} onChange={e => setNovaServDesc(e.target.value)} placeholder="Ex: Polimento..." /></div>
                      <div><label style={lbl}>Observação da foto</label><input style={inp} value={novaObs} onChange={e => setNovaObs(e.target.value)} placeholder="Ex: Detalhe lateral..." /></div>
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadFoto(e.target.files[0])} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploadando}
                      style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '8px 20px', borderRadius: 8, fontWeight: 900, fontSize: 12, cursor: 'pointer', letterSpacing: 1 }}>
                      {uploadando ? 'ENVIANDO...' : '📷 ADICIONAR FOTO'}
                    </button>
                    {erro && <p style={{ color: '#FC8181', fontSize: 12, marginTop: 8 }}>{erro}</p>}
                  </div>
                )}
                {fotosEtapa.length === 0 ? (
                  <div style={{ textAlign: 'center' as const, padding: '24px 0', color: '#4A5568', fontSize: 13 }}>Nenhuma foto nesta etapa</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                    {fotosEtapa.map(foto => (
                      <div key={foto.id} style={{ background: '#080C18', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
                        <img src={foto.url} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
                        <div style={{ padding: '8px 10px' }}>
                          {foto.servico_descricao && <p style={{ color: '#D4A843', fontSize: 11, fontWeight: 700, margin: '0 0 3px' }}>{foto.servico_descricao}</p>}
                          {foto.observacao && <p style={{ color: '#4A5568', fontSize: 11, margin: 0 }}>{foto.observacao}</p>}
                          {osSelecionada.status !== 'finalizada' && <button onClick={() => excluirFoto(foto)} style={{ background: 'transparent', border: 'none', color: '#FC8181', cursor: 'pointer', fontSize: 11, padding: '4px 0 0', fontWeight: 700 }}>REMOVER</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* COLUNA LATERAL */}
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
              {/* Atualizar status */}
              <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14 }}>ATUALIZAR STATUS</p>
                {osSelecionada.status === 'aberta' && (
                  <button onClick={() => atualizarStatus(osSelecionada.id, 'em_andamento')}
                    style={{ width: '100%', background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.3)', color: '#D4A843', padding: '12px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    🔧 INICIAR SERVIÇO
                  </button>
                )}
                {osSelecionada.status === 'em_andamento' && servs.length > 0 && concluidos === servs.length && (
                  <button onClick={() => abrirModalPagamento(osSelecionada)}
                    style={{ width: '100%', background: 'linear-gradient(135deg, #48BB78, #38A169)', border: 'none', color: '#fff', padding: '12px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 900, marginBottom: 8, letterSpacing: 0.5 }}>
                    💰 RECEBIMENTO E FECHAR OS
                  </button>
                )}
                {osSelecionada.status === 'em_andamento' && !(servs.length > 0 && concluidos === servs.length) && (
                  <button onClick={() => abrirModalPagamento(osSelecionada)}
                    style={{ width: '100%', background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '12px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 900, marginBottom: 8, letterSpacing: 1 }}>
                    ✅ FINALIZAR OS
                  </button>
                )}
                {osSelecionada.status === 'finalizada' && (
                  <div style={{ background: 'rgba(72,187,120,0.08)', border: '1px solid rgba(72,187,120,0.2)', borderRadius: 8, padding: 12, textAlign: 'center' as const, marginBottom: 8 }}>
                    <p style={{ color: '#48BB78', fontWeight: 700, fontSize: 14, margin: 0 }}>✅ OS FINALIZADA</p>
                  </div>
                )}
                {osSelecionada.status === 'finalizada' && (
                  <button onClick={() => abrirModalPagamento(osSelecionada)}
                    style={{ width: '100%', background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.3)', color: '#D4A843', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
                    💰 REGISTRAR PAGAMENTO
                  </button>
                )}
                {osSelecionada.status === 'em_andamento' && (
                  <button onClick={() => atualizarStatus(osSelecionada.id, 'aberta')}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, marginTop: 8 }}>
                    Voltar para Aberta
                  </button>
                )}
              </div>

              {/* Valor da OS */}
              {valorTotal > 0 && (
                <div style={{ background: '#0D1220', border: `1px solid ${ehPlano ? 'rgba(144,205,244,0.2)' : 'rgba(212,168,67,0.2)'}`, borderRadius: 12, padding: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: ehPlano ? '#90CDF4' : '#D4A843', letterSpacing: 2, marginBottom: 12 }}>{ehPlano ? '📅 PLANO MENSAL' : '💰 VALOR DA OS'}</p>
                  {temOrcamento ? (
                    <div>
                      <p style={{ color: '#4A5568', fontSize: 11, margin: '0 0 4px' }}>Orçamento #{osSelecionada.orcamento?.token}</p>
                      <p style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: 0 }}>R$ {valorTotal.toFixed(2).replace('.', ',')}</p>
                    </div>
                  ) : (
                    <div>
                      {servs.map(item => item.valor != null && item.valor > 0 ? (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <p style={{ color: '#CBD5E0', fontSize: 12, margin: 0 }}>{item.descricao}</p>
                          <p style={{ color: '#CBD5E0', fontSize: 12, fontWeight: 700, margin: 0 }}>R$ {item.valor.toFixed(2).replace('.', ',')}</p>
                        </div>
                      ) : null)}
                      {mats.length > 0 && mats.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <p style={{ color: '#90CDF4', fontSize: 12, margin: 0 }}>📦 {item.descricao} {item.quantidade && item.quantidade > 1 ? `x${item.quantidade}` : ''}</p>
                          <p style={{ color: '#90CDF4', fontSize: 12, fontWeight: 700, margin: 0 }}>R$ {((item.valor || 0) * (item.quantidade || 1)).toFixed(2).replace('.', ',')}</p>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px solid rgba(212,168,67,0.15)', paddingTop: 8, marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                        <p style={{ color: '#D4A843', fontSize: 12, fontWeight: 700, margin: 0 }}>TOTAL</p>
                        <p style={{ color: '#D4A843', fontSize: 18, fontWeight: 900, margin: 0 }}>R$ {valorTotal.toFixed(2).replace('.', ',')}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Link público */}
              <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 12 }}>LINK DO CLIENTE</p>
                <p style={{ color: '#4A5568', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>Compartilhe o progresso da OS em tempo real com o cliente.</p>
                <button onClick={copiarLink}
                  style={{ width: '100%', background: linkCopiado ? 'rgba(72,187,120,0.1)' : 'rgba(212,168,67,0.1)', border: `1px solid ${linkCopiado ? 'rgba(72,187,120,0.3)' : 'rgba(212,168,67,0.3)'}`, color: linkCopiado ? '#48BB78' : '#D4A843', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
                  {linkCopiado ? '✅ LINK COPIADO!' : '🔗 COPIAR LINK'}
                </button>
                {osSelecionada.cliente?.telefone && (
                  <button onClick={enviarWhatsAppOS}
                    style={{ width: '100%', background: 'rgba(72,187,120,0.1)', border: '1px solid rgba(72,187,120,0.3)', color: '#48BB78', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
                    📱 ENVIAR WHATSAPP
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
            </div>
          </div>
        </div>
      </>
    )
  }

  return null
}