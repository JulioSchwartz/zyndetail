'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEmpresa } from '@/hooks/useEmpresa'

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function SetupClient() {
  const { empresaId, loading } = useEmpresa()
  const router = useRouter()
  const [etapa, setEtapa] = useState<'verificando' | 'form' | 'salvando'>('verificando')

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [endereco, setEndereco] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('PR')
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (loading) return // aguarda o hook terminar antes de qualquer decisão

    if (!empresaId) {
      router.push('/auth/login')
      return
    }

    setEtapa('form')
    supabase.from('empresas_detail').select('nome').eq('id', empresaId).single().then(({ data }) => {
      if (data?.nome && !data.nome.includes('@')) setNome(data.nome)
    })
  }, [empresaId, loading])

  async function salvar() {
    setErro('')
    if (!nome.trim()) { setErro('Informe o nome da estética.'); return }
    if (!whatsapp.trim()) { setErro('Informe o WhatsApp para envio de mensagens.'); return }

    setEtapa('salvando')

    const { error } = await supabase.from('empresas_detail').update({
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      whatsapp: whatsapp.trim(),
      email: email.trim() || null,
      endereco: endereco.trim() || null,
      cidade: cidade.trim() || null,
      estado,
    }).eq('id', empresaId)

    if (error) {
      setErro('Erro ao salvar. Tente novamente.')
      setEtapa('form')
      return
    }

    router.push('/dashboard')
  }

  if (etapa === 'verificando' || etapa === 'salvando') {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0F1E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#D4A843', borderRadius: 12, width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#0A0F1E', fontSize: 26, fontWeight: 900 }}>Z</span>
        </div>
        <p style={{ color: '#2B6CB0', fontWeight: 700, fontSize: 14, letterSpacing: 3 }}>
          {etapa === 'salvando' ? 'CONFIGURANDO...' : 'CARREGANDO...'}
        </p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0F1E' }}>
      {/* Header */}
      <div style={{ background: '#0A0F1E', borderBottom: '1px solid rgba(43,108,176,0.2)', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: '#D4A843', borderRadius: 6, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#0A0F1E', fontSize: 16, fontWeight: 900 }}>Z</span>
          </div>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 14, letterSpacing: 2 }}>ZYNDETAIL</span>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Boas-vindas */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <span style={{ fontSize: 48 }}>🚗</span>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#fff', margin: '16px 0 8px', letterSpacing: 1 }}>
            BEM-VINDO AO ZYNDETAIL!
          </h1>
          <p style={{ color: '#2B6CB0', fontSize: 14, margin: '0 0 6px' }}>
            Configure sua estética antes de começar.
          </p>
          <p style={{ color: '#4A5568', fontSize: 13 }}>
            Essas informações aparecem nos orçamentos e mensagens enviados aos seus clientes.
          </p>
        </div>

        {/* Formulário */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 32 }}>

          <p style={secaoTitulo}>🏪 DADOS DA ESTÉTICA</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>Nome da estética <span style={{ color: '#FC8181' }}>*</span></label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Auto Detailing Premium" />
            </div>
            <div>
              <label style={labelSt}>WhatsApp <span style={{ color: '#FC8181' }}>*</span></label>
              <input type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(42) 99999-9999" />
            </div>
            <div>
              <label style={labelSt}>Telefone</label>
              <input type="text" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(42) 3333-3333" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>E-mail da estética</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contato@suaestetica.com.br" />
            </div>
          </div>

          <p style={secaoTitulo}>📍 LOCALIZAÇÃO</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelSt}>Endereço</label>
              <input type="text" value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua das Flores, 123" />
            </div>
            <div>
              <label style={labelSt}>Cidade</label>
              <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Castro" />
            </div>
            <div>
              <label style={labelSt}>Estado</label>
              <select value={estado} onChange={e => setEstado(e.target.value)}>
                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>

          {erro && (
            <div style={{ background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#FC8181', fontSize: 14 }}>
              {erro}
            </div>
          )}

          <button onClick={salvar}
            style={{ width: '100%', background: '#2B6CB0', color: '#fff', border: 'none', padding: '16px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', letterSpacing: 2 }}>
            SALVAR E ENTRAR NO SISTEMA →
          </button>

          <p style={{ textAlign: 'center', color: '#4A5568', fontSize: 12, marginTop: 16, letterSpacing: 0.5 }}>
            Você pode editar essas informações depois em Configurações
          </p>
        </div>
      </div>
    </div>
  )
}

const labelSt: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#718096', display: 'block', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' as const }
const secaoTitulo: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#2B6CB0', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid rgba(43,108,176,0.2)', letterSpacing: 2 }