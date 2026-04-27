'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Cliente = {
  id: string
  nome: string
  telefone: string
  cpf: string
  email: string
  data_nascimento: string
  observacoes: string
  criado_em: string
  veiculos?: Veiculo[]
}

type Veiculo = {
  id: string
  cliente_id: string
  placa: string
  modelo: string
  marca: string
  cor: string
  ano: string
  observacoes: string
}

type Aba = 'clientes' | 'novo_cliente' | 'detalhe'

function mascaraTelefone(v: string) {
  v = v.replace(/\D/g, '').slice(0, 11)
  if (v.length <= 10) return v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  return v.replace(/(\d{2})(\d{1})(\d{4})(\d{0,4})/, '($1) $2 $3-$4').replace(/-$/, '')
}

function mascaraCpfCnpj(v: string) {
  v = v.replace(/\D/g, '').slice(0, 14)
  if (v.length <= 11) {
    return v
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return v
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function labelDocumento(v: string) {
  const nums = v.replace(/\D/g, '')
  if (nums.length <= 11) return 'CPF'
  return 'CNPJ'
}

export default function ClientesClient() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState<Aba>('clientes')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mostrarNovoVeiculo, setMostrarNovoVeiculo] = useState(false)

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const [placa, setPlaca] = useState('')
  const [modelo, setModelo] = useState('')
  const [marca, setMarca] = useState('')
  const [cor, setCor] = useState('')
  const [ano, setAno] = useState('')
  const [obsVeiculo, setObsVeiculo] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/auth/login'); return }
      const { data: usuario } = await supabase
        .from('usuarios_detail').select('empresa_id')
        .eq('user_id', session.user.id).maybeSingle()
      if (!usuario?.empresa_id) { router.push('/auth/login'); return }
      setEmpresaId(usuario.empresa_id)
      await carregarClientes(usuario.empresa_id)
      setLoading(false)
    }
    init()
  }, [])

  async function carregarClientes(eid: string) {
    const { data } = await supabase
      .from('clientes').select('*, veiculos(*)')
      .eq('empresa_id', eid).order('nome')
    setClientes(data || [])
  }

  async function salvarCliente() {
    setErro('')
    if (!nome.trim()) { setErro('Nome é obrigatório.'); return }
    if (!telefone.trim()) { setErro('Telefone é obrigatório.'); return }
    setSalvando(true)
    const { error } = await supabase.from('clientes').insert({
      empresa_id: empresaId,
      nome: nome.trim(),
      telefone: telefone.trim(),
      cpf: cpf.trim() || null,
      email: email.trim() || null,
      data_nascimento: dataNascimento || null,
      observacoes: observacoes.trim() || null,
    })
    if (error) { setErro('Erro ao salvar cliente.'); setSalvando(false); return }
    await carregarClientes(empresaId!)
    limparFormCliente()
    setAba('clientes')
    setSalvando(false)
  }

  async function salvarVeiculo() {
    setErro('')
    if (!placa.trim()) { setErro('Placa é obrigatória.'); return }
    if (!modelo.trim()) { setErro('Modelo é obrigatório.'); return }
    setSalvando(true)
    const { error } = await supabase.from('veiculos').insert({
      empresa_id: empresaId,
      cliente_id: clienteSelecionado!.id,
      placa: placa.trim().toUpperCase(),
      modelo: modelo.trim(),
      marca: marca.trim() || null,
      cor: cor.trim() || null,
      ano: ano.trim() || null,
      observacoes: obsVeiculo.trim() || null,
    })
    if (error) { setErro('Erro ao salvar veículo.'); setSalvando(false); return }
    limparFormVeiculo()
    setMostrarNovoVeiculo(false)
    setSalvando(false)
    await abrirDetalhe(clienteSelecionado!.id)
  }

  async function abrirDetalhe(id: string) {
    const { data } = await supabase
      .from('clientes').select('*, veiculos(*)')
      .eq('id', id).single()
    setClienteSelecionado(data)
    setAba('detalhe')
  }

  async function excluirCliente(id: string) {
    if (!confirm('Excluir este cliente e todos os seus veículos?')) return
    await supabase.from('veiculos').delete().eq('cliente_id', id)
    await supabase.from('clientes').delete().eq('id', id)
    await carregarClientes(empresaId!)
    setAba('clientes')
  }

  async function excluirVeiculo(id: string) {
    if (!confirm('Excluir este veículo?')) return
    await supabase.from('veiculos').delete().eq('id', id)
    await abrirDetalhe(clienteSelecionado!.id)
  }

  function limparFormCliente() {
    setNome(''); setTelefone(''); setCpf(''); setEmail('')
    setDataNascimento(''); setObservacoes(''); setErro('')
  }

  function limparFormVeiculo() {
    setPlaca(''); setModelo(''); setMarca(''); setCor(''); setAno(''); setObsVeiculo(''); setErro('')
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.telefone.includes(busca) ||
    (c.veiculos || []).some(v => v.placa.toLowerCase().includes(busca.toLowerCase()))
  )

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

  if (aba === 'clientes') return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: 0.5 }}>👤 Clientes</h1>
          <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', margin: '8px 0' }} />
          <p style={{ color: '#4A5568', fontSize: 13, margin: 0 }}>{clientes.length} clientes cadastrados</p>
        </div>
        <button onClick={() => { limparFormCliente(); setAba('novo_cliente') }} style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '10px 20px', borderRadius: 8, fontWeight: 900, fontSize: 13, cursor: 'pointer', letterSpacing: 1 }}>
          + NOVO CLIENTE
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input type="text" placeholder="Buscar por nome, telefone ou placa..."
          value={busca} onChange={e => setBusca(e.target.value)}
          style={{ ...inp, background: '#0D1220', border: '1px solid rgba(212,168,67,0.2)', padding: '12px 16px' }} />
      </div>

      {clientesFiltrados.length === 0 ? (
        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>👤</p>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Nenhum cliente encontrado</p>
          <p style={{ color: '#4A5568', fontSize: 13 }}>{busca ? 'Tente outra busca.' : 'Cadastre seu primeiro cliente.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {clientesFiltrados.map(c => (
            <div key={c.id} onClick={() => abrirDetalhe(c.id)}
              style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'border-color 0.2s' }}>
              <div style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#D4A843', fontSize: 18, fontWeight: 900 }}>{c.nome.charAt(0).toUpperCase()}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: 0 }}>{c.nome}</p>
                <p style={{ color: '#4A5568', fontSize: 12, margin: '3px 0 0' }}>{c.telefone}{c.email ? ` · ${c.email}` : ''}</p>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {(c.veiculos || []).length > 0 && (
                  <span style={{ background: 'rgba(144,205,244,0.1)', border: '1px solid rgba(144,205,244,0.2)', color: '#90CDF4', fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>
                    🚗 {(c.veiculos || []).length}
                  </span>
                )}
                <span style={{ color: '#4A5568', fontSize: 18 }}>›</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (aba === 'novo_cliente') return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => setAba('clientes')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>← Voltar</button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>Novo Cliente</h1>
          <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', marginTop: 6 }} />
        </div>
      </div>

      <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 24, maxWidth: 680 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 16, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>DADOS DO CLIENTE</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Nome completo <span style={{ color: '#D4A843' }}>*</span></label>
            <input style={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="João da Silva" />
          </div>
          <div>
            <label style={lbl}>Telefone / WhatsApp <span style={{ color: '#D4A843' }}>*</span></label>
            <input style={inp} value={telefone}
              onChange={e => setTelefone(mascaraTelefone(e.target.value))}
              placeholder="(49) 9 9999-9999" maxLength={16} />
          </div>
          <div>
            <label style={lbl}>{labelDocumento(cpf)} <span style={{ color: '#4A5568', fontSize: 10 }}>(CPF ou CNPJ)</span></label>
            <input style={inp} value={cpf}
              onChange={e => setCpf(mascaraCpfCnpj(e.target.value))}
              placeholder="000.000.000-00 ou 00.000.000/0000-00" maxLength={18} />
          </div>
          <div>
            <label style={lbl}>E-mail</label>
            <input style={inp} value={email} onChange={e => setEmail(e.target.value)} placeholder="joao@email.com" type="email" />
          </div>
          <div>
            <label style={lbl}>Data de Nascimento</label>
            <input style={inp} value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} type="date" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Observações</label>
            <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' as const }} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Cliente VIP, prefere atendimento às terças..." />
          </div>
        </div>

        {erro && <div style={{ background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', borderRadius: 8, padding: '10px 14px', color: '#FC8181', fontSize: 13, marginBottom: 14 }}>{erro}</div>}

        <button onClick={salvarCliente} disabled={salvando} style={{ width: '100%', background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: 14, borderRadius: 10, fontWeight: 900, fontSize: 14, cursor: salvando ? 'not-allowed' : 'pointer', letterSpacing: 1 }}>
          {salvando ? 'SALVANDO...' : 'CADASTRAR CLIENTE'}
        </button>
      </div>
    </div>
  )

  if (aba === 'detalhe' && clienteSelecionado) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => setAba('clientes')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>← Voltar</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>{clienteSelecionado.nome}</h1>
          <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', marginTop: 6 }} />
        </div>
        <button onClick={() => excluirCliente(clienteSelecionado.id)} style={{ background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', color: '#FC8181', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          EXCLUIR
        </button>
      </div>

      <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>DADOS DO CLIENTE</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          {[
            { label: 'Telefone', valor: clienteSelecionado.telefone },
            { label: 'E-mail', valor: clienteSelecionado.email || '—' },
            { label: labelDocumento(clienteSelecionado.cpf || ''), valor: clienteSelecionado.cpf || '—' },
            { label: 'Nascimento', valor: clienteSelecionado.data_nascimento ? new Date(clienteSelecionado.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—' },
          ].map((item, i) => (
            <div key={i}>
              <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>{item.label.toUpperCase()}</p>
              <p style={{ color: '#fff', fontSize: 14 }}>{item.valor}</p>
            </div>
          ))}
          {clienteSelecionado.observacoes && (
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>OBSERVAÇÕES</p>
              <p style={{ color: '#CBD5E0', fontSize: 13, lineHeight: 1.6 }}>{clienteSelecionado.observacoes}</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, margin: 0 }}>VEÍCULOS ({(clienteSelecionado.veiculos || []).length})</p>
          <button onClick={() => { limparFormVeiculo(); setMostrarNovoVeiculo(!mostrarNovoVeiculo) }} style={{ background: 'rgba(212,168,67,0.1)', border: '1px solid rgba(212,168,67,0.3)', color: '#D4A843', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
            {mostrarNovoVeiculo ? 'CANCELAR' : '+ VEÍCULO'}
          </button>
        </div>

        {mostrarNovoVeiculo && (
          <div style={{ background: '#080C18', border: '1px solid rgba(212,168,67,0.15)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Placa <span style={{ color: '#D4A843' }}>*</span></label>
                <input style={inp} value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} placeholder="ABC-1234 ou ABC1D23" maxLength={8} />
              </div>
              <div>
                <label style={lbl}>Modelo <span style={{ color: '#D4A843' }}>*</span></label>
                <input style={inp} value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Corolla" />
              </div>
              <div>
                <label style={lbl}>Marca</label>
                <input style={inp} value={marca} onChange={e => setMarca(e.target.value)} placeholder="Toyota" />
              </div>
              <div>
                <label style={lbl}>Cor</label>
                <input style={inp} value={cor} onChange={e => setCor(e.target.value)} placeholder="Prata" />
              </div>
              <div>
                <label style={lbl}>Ano</label>
                <input style={inp} value={ano} onChange={e => setAno(e.target.value)} placeholder="2023" maxLength={4} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Observações</label>
                <input style={inp} value={obsVeiculo} onChange={e => setObsVeiculo(e.target.value)} placeholder="Arranhão no para-choque dianteiro..." />
              </div>
            </div>
            {erro && <div style={{ color: '#FC8181', fontSize: 13, marginBottom: 10 }}>{erro}</div>}
            <button onClick={salvarVeiculo} disabled={salvando} style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '10px 20px', borderRadius: 8, fontWeight: 900, fontSize: 13, cursor: 'pointer', letterSpacing: 1 }}>
              {salvando ? 'SALVANDO...' : 'SALVAR VEÍCULO'}
            </button>
          </div>
        )}

        {(clienteSelecionado.veiculos || []).length === 0 && !mostrarNovoVeiculo ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>🚗</p>
            <p style={{ color: '#4A5568', fontSize: 13 }}>Nenhum veículo cadastrado</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(clienteSelecionado.veiculos || []).map(v => (
              <div key={v.id} style={{ background: '#080C18', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: 'rgba(144,205,244,0.1)', border: '1px solid rgba(144,205,244,0.2)', borderRadius: 8, padding: '4px 10px' }}>
                  <p style={{ color: '#90CDF4', fontSize: 13, fontWeight: 900, letterSpacing: 2, margin: 0 }}>{v.placa}</p>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0 }}>{v.marca ? `${v.marca} ` : ''}{v.modelo}</p>
                  <p style={{ color: '#4A5568', fontSize: 11, margin: '3px 0 0' }}>{v.cor ? `${v.cor} · ` : ''}{v.ano || ''}</p>
                </div>
                <button onClick={() => excluirVeiculo(v.id)} style={{ background: 'transparent', border: 'none', color: '#4A5568', cursor: 'pointer', fontSize: 16, padding: 4 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return null
}