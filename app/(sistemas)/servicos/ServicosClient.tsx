'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Categoria = {
  id: string
  nome: string
  servicos?: Servico[]
}

type Servico = {
  id: string
  nome: string
  descricao: string
  preco: number
  duracao_minutos: number
  ativo: boolean
  categoria_id?: string
}

const CATEGORIAS_SUGERIDAS = [
  'Polimento', 'Vitrificação / Ceramic Coating', 'PPF',
  'Higienização', 'Lavagem', 'Insulfilm', 'Customização', 'Outros'
]

function formatarPreco(v: string) {
  const nums = v.replace(/\D/g, '')
  if (!nums) return ''
  const valor = (parseInt(nums) / 100).toFixed(2)
  return valor.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function precoParaNumero(v: string) {
  return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0
}

function formatarDuracao(min: number) {
  if (!min) return '—'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export default function ServicosClient() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [modalCategoria, setModalCategoria] = useState(false)
  const [modalServico, setModalServico] = useState(false)
  const [editandoServico, setEditandoServico] = useState<Servico | null>(null)

  // Form categoria
  const [nomeCategoria, setNomeCategoria] = useState('')

  // Form serviço
  const [nomeServico, setNomeServico] = useState('')
  const [descServico, setDescServico] = useState('')
  const [precoServico, setPrecoServico] = useState('')
  const [duracaoServico, setDuracaoServico] = useState('60')
  const [catServico, setCatServico] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/auth/login'); return }
      const { data: usuario } = await supabase
        .from('usuarios_detail').select('empresa_id')
        .eq('user_id', session.user.id).maybeSingle()
      if (!usuario?.empresa_id) { router.push('/auth/login'); return }
      setEmpresaId(usuario.empresa_id)
      await carregar(usuario.empresa_id)
      setLoading(false)
    }
    init()
  }, [])

  async function carregar(eid: string) {
    const [{ data: cats }, { data: servs }] = await Promise.all([
      supabase.from('categorias_servico').select('*').eq('empresa_id', eid).order('nome'),
      supabase.from('servicos_catalogo').select('*').eq('empresa_id', eid).order('nome'),
    ])
    setCategorias(cats || [])
    setServicos(servs || [])
  }

  async function salvarCategoria(nome: string) {
    if (!nome.trim()) return
    setSalvando(true)
    await supabase.from('categorias_servico').insert({ empresa_id: empresaId, nome: nome.trim() })
    await carregar(empresaId!)
    setNomeCategoria('')
    setModalCategoria(false)
    setSalvando(false)
  }

  async function excluirCategoria(id: string) {
    const temServicos = servicos.some(s => s.categoria_id === id)
    if (temServicos) { alert('Remova os serviços desta categoria antes de excluí-la.'); return }
    if (!confirm('Excluir esta categoria?')) return
    await supabase.from('categorias_servico').delete().eq('id', id)
    await carregar(empresaId!)
    if (categoriaSelecionada === id) setCategoriaSelecionada(null)
  }

  async function salvarServico() {
    setErro('')
    if (!nomeServico.trim()) { setErro('Nome do serviço é obrigatório.'); return }
    if (!catServico) { setErro('Selecione uma categoria.'); return }
    setSalvando(true)

    const payload = {
      nome: nomeServico.trim(),
      descricao: descServico.trim() || null,
      preco: precoParaNumero(precoServico),
      duracao_minutos: parseInt(duracaoServico) || 60,
      categoria_id: catServico,
    }

    if (editandoServico) {
      await supabase.from('servicos_catalogo').update(payload).eq('id', editandoServico.id)
    } else {
      await supabase.from('servicos_catalogo').insert({
        empresa_id: empresaId,
        ativo: true,
        ...payload,
      })
    }

    await carregar(empresaId!)
    limparFormServico()
    setModalServico(false)
    setSalvando(false)
  }

  async function toggleAtivo(s: Servico) {
    await supabase.from('servicos_catalogo').update({ ativo: !s.ativo }).eq('id', s.id)
    await carregar(empresaId!)
  }

  async function excluirServico(id: string) {
    if (!confirm('Excluir este serviço?')) return
    await supabase.from('servicos_catalogo').delete().eq('id', id)
    await carregar(empresaId!)
  }

  function abrirEdicao(s: Servico) {
    setEditandoServico(s)
    setNomeServico(s.nome)
    setDescServico(s.descricao || '')
    setPrecoServico(s.preco ? (s.preco.toFixed(2)).replace('.', ',') : '')
    setDuracaoServico(String(s.duracao_minutos || 60))
    setCatServico(s.categoria_id || '')
    setModalServico(true)
  }

  function limparFormServico() {
    setNomeServico(''); setDescServico(''); setPrecoServico('')
    setDuracaoServico('60'); setCatServico(''); setEditandoServico(null); setErro('')
  }

  const servicosFiltrados = categoriaSelecionada
    ? servicos.filter(s => s.categoria_id === categoriaSelecionada)
    : servicos

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#080C18', fontSize: 22, fontWeight: 900 }}>Z</span>
      </div>
      <p style={{ color: '#D4A843', fontWeight: 700, letterSpacing: 2, fontSize: 12 }}>CARREGANDO...</p>
    </div>
  )

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px', background: '#080C18',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
    color: '#fff', fontSize: 14, boxSizing: 'border-box' as const, outline: 'none',
  }
  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#4A5568',
    display: 'block', marginBottom: 6, letterSpacing: 1,
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0 }}>🛠️ Catálogo de Serviços</h1>
          <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', margin: '8px 0' }} />
          <p style={{ color: '#4A5568', fontSize: 13, margin: 0 }}>{servicos.length} serviços · {categorias.length} categorias</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setModalCategoria(true)}
            style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.3)', color: '#D4A843', padding: '10px 16px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', letterSpacing: 1 }}>
            + CATEGORIA
          </button>
          <button onClick={() => { limparFormServico(); setModalServico(true) }}
            style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '10px 20px', borderRadius: 8, fontWeight: 900, fontSize: 13, cursor: 'pointer', letterSpacing: 1 }}>
            + SERVIÇO
          </button>
        </div>
      </div>

      {/* Filtro categorias */}
      {categorias.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as const }}>
          <button onClick={() => setCategoriaSelecionada(null)}
            style={{ background: !categoriaSelecionada ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${!categoriaSelecionada ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: !categoriaSelecionada ? '#D4A843' : '#4A5568', padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: !categoriaSelecionada ? 700 : 400 }}>
            Todos ({servicos.length})
          </button>
          {categorias.map(cat => {
            const qtd = servicos.filter(s => s.categoria_id === cat.id).length
            const ativo = categoriaSelecionada === cat.id
            return (
              <button key={cat.id} onClick={() => setCategoriaSelecionada(ativo ? null : cat.id)}
                style={{ background: ativo ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${ativo ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: ativo ? '#D4A843' : '#4A5568', padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: ativo ? 700 : 400, display: 'flex', alignItems: 'center', gap: 6 }}>
                {cat.nome} <span style={{ opacity: 0.6 }}>({qtd})</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Onboarding sem categorias */}
      {categorias.length === 0 && (
        <div style={{ background: '#0D1220', border: '1px solid rgba(212,168,67,0.15)', borderRadius: 12, padding: 32, marginBottom: 16 }}>
          <p style={{ color: '#D4A843', fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>⚡ COMECE PELAS CATEGORIAS</p>
          <p style={{ color: '#4A5568', fontSize: 13, marginBottom: 16 }}>Sugestões para estéticas automotivas:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
            {CATEGORIAS_SUGERIDAS.map(cat => (
              <button key={cat} onClick={() => salvarCategoria(cat)}
                style={{ background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.2)', color: '#D4A843', padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                + {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista de serviços */}
      {servicosFiltrados.length === 0 && categorias.length > 0 ? (
        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 40, textAlign: 'center' as const }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🛠️</p>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Nenhum serviço cadastrado</p>
          <p style={{ color: '#4A5568', fontSize: 13 }}>Clique em "+ SERVIÇO" para adicionar.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {servicosFiltrados.map(s => {
            const cat = categorias.find(c => c.id === s.categoria_id)
            return (
              <div key={s.id} style={{ background: '#0D1220', border: `1px solid ${s.ativo ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, opacity: s.ativo ? 1 : 0.5 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <p style={{ color: s.ativo ? '#fff' : '#4A5568', fontWeight: 700, fontSize: 14, margin: 0 }}>{s.nome}</p>
                    {cat && (
                      <span style={{ background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.15)', color: '#D4A843', fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>{cat.nome}</span>
                    )}
                    {!s.ativo && (
                      <span style={{ background: 'rgba(255,255,255,0.05)', color: '#4A5568', fontSize: 10, padding: '2px 8px', borderRadius: 10 }}>INATIVO</span>
                    )}
                  </div>
                  {s.descricao && <p style={{ color: '#4A5568', fontSize: 12, margin: 0 }}>{s.descricao}</p>}
                </div>
                <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                  <p style={{ color: '#D4A843', fontSize: 16, fontWeight: 900, margin: '0 0 4px' }}>
                    {s.preco > 0 ? `R$ ${s.preco.toFixed(2).replace('.', ',')}` : '—'}
                  </p>
                  <p style={{ color: '#90CDF4', fontSize: 11, margin: '0 0 8px' }}>
                    ⏱ {formatarDuracao(s.duracao_minutos || 60)}
                  </p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => toggleAtivo(s)}
                      style={{ background: s.ativo ? 'rgba(72,187,120,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${s.ativo ? 'rgba(72,187,120,0.3)' : 'rgba(255,255,255,0.08)'}`, color: s.ativo ? '#48BB78' : '#4A5568', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                      {s.ativo ? 'ON' : 'OFF'}
                    </button>
                    <button onClick={() => abrirEdicao(s)}
                      style={{ background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.2)', color: '#D4A843', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                      EDITAR
                    </button>
                    <button onClick={() => excluirServico(s.id)}
                      style={{ background: 'rgba(252,129,129,0.06)', border: '1px solid rgba(252,129,129,0.15)', color: '#FC8181', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Gerenciar categorias */}
      {categorias.length > 0 && (
        <div style={{ marginTop: 20, background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#4A5568', letterSpacing: 2, marginBottom: 12 }}>GERENCIAR CATEGORIAS</p>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
            {categorias.map(cat => (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '5px 12px' }}>
                <span style={{ color: '#CBD5E0', fontSize: 12 }}>{cat.nome}</span>
                <button onClick={() => excluirCategoria(cat.id)}
                  style={{ background: 'transparent', border: 'none', color: '#4A5568', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
              </div>
            ))}
            <button onClick={() => setModalCategoria(true)}
              style={{ background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.2)', color: '#D4A843', padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
              + Nova
            </button>
          </div>
        </div>
      )}

      {/* Modal — Nova Categoria */}
      {modalCategoria && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: '#0D1220', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
            <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 900, margin: '0 0 20px' }}>Nova Categoria</h2>
            <label style={lbl}>Nome da categoria</label>
            <input style={{ ...inp, marginBottom: 16 }} value={nomeCategoria}
              onChange={e => setNomeCategoria(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && salvarCategoria(nomeCategoria)}
              placeholder="Ex: Polimento, PPF, Higienização..." autoFocus />
            <p style={{ color: '#4A5568', fontSize: 12, marginBottom: 16 }}>Sugestões:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 20 }}>
              {CATEGORIAS_SUGERIDAS.map(s => (
                <button key={s} onClick={() => setNomeCategoria(s)}
                  style={{ background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.15)', color: '#D4A843', padding: '4px 10px', borderRadius: 14, fontSize: 11, cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => salvarCategoria(nomeCategoria)} disabled={salvando}
                style={{ flex: 1, background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: 12, borderRadius: 8, fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>
                {salvando ? 'SALVANDO...' : 'CRIAR CATEGORIA'}
              </button>
              <button onClick={() => { setModalCategoria(false); setNomeCategoria('') }}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '12px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Novo/Editar Serviço */}
      {modalServico && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: '#0D1220', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480 }}>
            <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 900, margin: '0 0 20px' }}>
              {editandoServico ? 'Editar Serviço' : 'Novo Serviço'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Nome do serviço <span style={{ color: '#D4A843' }}>*</span></label>
                <input style={inp} value={nomeServico} onChange={e => setNomeServico(e.target.value)} placeholder="Ex: Polimento Espelhado" autoFocus />
              </div>
              <div>
                <label style={lbl}>Categoria <span style={{ color: '#D4A843' }}>*</span></label>
                <select style={inp} value={catServico} onChange={e => setCatServico(e.target.value)}>
                  <option value="">Selecione uma categoria...</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Preço (R$)</label>
                  <input style={inp} value={precoServico}
                    onChange={e => setPrecoServico(formatarPreco(e.target.value))}
                    placeholder="0,00" />
                </div>
                <div>
                  <label style={lbl}>Duração estimada</label>
                  <select style={inp} value={duracaoServico} onChange={e => setDuracaoServico(e.target.value)}>
                    {[30,45,60,90,120,150,180,210,240,300,360,480].map(d => (
                      <option key={d} value={d}>{formatarDuracao(d)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Descrição</label>
                <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' as const }}
                  value={descServico} onChange={e => setDescServico(e.target.value)}
                  placeholder="Detalhes do serviço, o que está incluso..." />
              </div>
            </div>

            {erro && <div style={{ color: '#FC8181', fontSize: 13, margin: '12px 0', background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', borderRadius: 8, padding: '8px 12px' }}>{erro}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={salvarServico} disabled={salvando}
                style={{ flex: 1, background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: 12, borderRadius: 8, fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>
                {salvando ? 'SALVANDO...' : editandoServico ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR SERVIÇO'}
              </button>
              <button onClick={() => { setModalServico(false); limparFormServico() }}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '12px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}