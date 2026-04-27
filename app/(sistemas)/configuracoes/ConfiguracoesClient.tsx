'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function mascaraTelefone(v: string) {
  v = v.replace(/\D/g, '').slice(0, 11)
  if (v.length <= 10) return v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  return v.replace(/(\d{2})(\d{1})(\d{4})(\d{0,4})/, '($1) $2 $3-$4').replace(/-$/, '')
}

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function ConfiguracoesClient() {
  const router = useRouter()
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [uploadando, setUploadando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [endereco, setEndereco] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('SC')
  const [logoUrl, setLogoUrl] = useState('')
  const [plano, setPlano] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/auth/login'); return }
      const { data: usuario } = await supabase
        .from('usuarios_detail').select('empresa_id')
        .eq('user_id', session.user.id).maybeSingle()
      if (!usuario?.empresa_id) { router.push('/auth/login'); return }
      setEmpresaId(usuario.empresa_id)

      const { data: emp } = await supabase
        .from('empresas_detail').select('*')
        .eq('id', usuario.empresa_id).single()

      if (emp) {
        setNome(emp.nome || '')
        setTelefone(emp.telefone || '')
        setWhatsapp(emp.whatsapp || '')
        setEmail(emp.email || '')
        setEndereco(emp.endereco || '')
        setCidade(emp.cidade || '')
        setEstado(emp.estado || 'SC')
        setLogoUrl(emp.logo_url || '')
        setPlano(emp.plano || '')
        setStatus(emp.status || '')
      }
      setLoading(false)
    }
    init()
  }, [])

  async function salvar() {
    setErro('')
    setSucesso(false)
    if (!nome.trim()) { setErro('Nome da estética é obrigatório.'); return }
    setSalvando(true)

    const { error } = await supabase.from('empresas_detail').update({
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      email: email.trim() || null,
      endereco: endereco.trim() || null,
      cidade: cidade.trim() || null,
      estado,
      logo_url: logoUrl || null,
    }).eq('id', empresaId)

    if (error) { setErro('Erro ao salvar configurações.'); setSalvando(false); return }
    setSalvando(false)
    setSucesso(true)
    setTimeout(() => setSucesso(false), 3000)
  }

  async function uploadLogo(file: File) {
    setErro('')
    setUploadando(true)

    if (!file.type.startsWith('image/')) { setErro('Arquivo deve ser uma imagem.'); setUploadando(false); return }
    if (file.size > 2 * 1024 * 1024) { setErro('Imagem deve ter no máximo 2MB.'); setUploadando(false); return }

    const ext = file.name.split('.').pop()
    const path = `${empresaId}/logo.${ext}`

    await supabase.storage.from('logos').remove([path])

    const { error: uploadError } = await supabase.storage
      .from('logos').upload(path, file, { upsert: true })

    if (uploadError) { setErro('Erro ao fazer upload da logo.'); setUploadando(false); return }

    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
    const urlFinal = publicUrl + '?t=' + Date.now()

    // Salva automaticamente no banco após upload
    await supabase.from('empresas_detail').update({ logo_url: urlFinal }).eq('id', empresaId)

    setLogoUrl(urlFinal)
    setUploadando(false)
    setSucesso(true)
    setTimeout(() => setSucesso(false), 3000)
  }

  async function removerLogo() {
    if (!confirm('Remover a logo?')) return
    const ext = logoUrl.split('/').pop()?.split('?')[0].split('.').pop()
    await supabase.storage.from('logos').remove([`${empresaId}/logo.${ext}`])
    await supabase.from('empresas_detail').update({ logo_url: null }).eq('id', empresaId)
    setLogoUrl('')
  }

  const planoConfig: Record<string, { label: string, cor: string }> = {
    basico:  { label: 'Básico',  cor: '#90CDF4' },
    pro:     { label: 'Pro',     cor: '#D4A843' },
    premium: { label: 'Premium', cor: '#48BB78' },
  }
  const planoInfo = planoConfig[plano] || { label: plano, cor: '#4A5568' }

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
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0 }}>⚙️ Configurações</h1>
        <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', margin: '8px 0' }} />
        <p style={{ color: '#4A5568', fontSize: 13, margin: 0 }}>Dados da sua estética automotiva</p>
      </div>

      {/* Plano atual */}
      <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, margin: '0 0 4px' }}>PLANO ATUAL</p>
          <p style={{ color: planoInfo.cor, fontSize: 16, fontWeight: 900, margin: 0 }}>{planoInfo.label}</p>
        </div>
        <span style={{ background: status === 'trial' ? 'rgba(212,168,67,0.1)' : 'rgba(72,187,120,0.1)', border: `1px solid ${status === 'trial' ? 'rgba(212,168,67,0.3)' : 'rgba(72,187,120,0.3)'}`, color: status === 'trial' ? '#D4A843' : '#48BB78', fontSize: 11, padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>
          {status === 'trial' ? 'TRIAL' : 'ATIVO'}
        </span>
      </div>

      {/* Logo */}
      <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 16, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>LOGO DA ESTÉTICA</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 100, height: 100, borderRadius: 14, background: '#080C18', border: '2px dashed rgba(212,168,67,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 28, margin: 0 }}>🏪</p>
                <p style={{ color: '#4A5568', fontSize: 10, margin: '4px 0 0' }}>SEM LOGO</p>
              </div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#CBD5E0', fontSize: 13, margin: '0 0 12px', lineHeight: 1.6 }}>
              A logo aparece nos orçamentos enviados aos clientes. Formatos aceitos: PNG, JPG, SVG. Tamanho máximo: 2MB.
            </p>
            <p style={{ color: '#4A5568', fontSize: 11, margin: '0 0 12px' }}>✅ A logo é salva automaticamente após o upload.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
              <button onClick={() => fileRef.current?.click()} disabled={uploadando}
                style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '8px 16px', borderRadius: 8, fontWeight: 900, fontSize: 12, cursor: 'pointer', letterSpacing: 1 }}>
                {uploadando ? 'ENVIANDO...' : logoUrl ? '🔄 TROCAR LOGO' : '📤 ENVIAR LOGO'}
              </button>
              {logoUrl && (
                <button onClick={removerLogo}
                  style={{ background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', color: '#FC8181', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  REMOVER
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dados da empresa */}
      <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 16, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>DADOS DA ESTÉTICA</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Nome da estética <span style={{ color: '#D4A843' }}>*</span></label>
            <input style={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Auto Detailing Premium" />
          </div>
          <div>
            <label style={lbl}>WhatsApp</label>
            <input style={inp} value={whatsapp} onChange={e => setWhatsapp(mascaraTelefone(e.target.value))} placeholder="(42) 9 9999-9999" maxLength={16} />
          </div>
          <div>
            <label style={lbl}>Telefone</label>
            <input style={inp} value={telefone} onChange={e => setTelefone(mascaraTelefone(e.target.value))} placeholder="(42) 3333-3333" maxLength={15} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>E-mail da estética</label>
            <input style={inp} value={email} onChange={e => setEmail(e.target.value)} placeholder="contato@suaestetica.com.br" type="email" />
            <p style={{ color: '#4A5568', fontSize: 11, marginTop: 6 }}>⚠️ Este e-mail recebe notificações de orçamentos aprovados/recusados.</p>
          </div>
        </div>
      </div>

      {/* Localização */}
      <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 16, borderBottom: '1px solid rgba(212,168,67,0.1)', paddingBottom: 10 }}>LOCALIZAÇÃO</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Endereço</label>
            <input style={inp} value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua das Flores, 123" />
          </div>
          <div>
            <label style={lbl}>Cidade</label>
            <input style={inp} value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Castro" />
          </div>
          <div>
            <label style={lbl}>Estado</label>
            <select style={inp} value={estado} onChange={e => setEstado(e.target.value)}>
              {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>
      </div>

      {erro && (
        <div style={{ background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#FC8181', fontSize: 14 }}>
          {erro}
        </div>
      )}
      {sucesso && (
        <div style={{ background: 'rgba(72,187,120,0.08)', border: '1px solid rgba(72,187,120,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#48BB78', fontSize: 14, fontWeight: 700 }}>
          ✅ Configurações salvas com sucesso!
        </div>
      )}

      <button onClick={salvar} disabled={salvando}
        style={{ width: '100%', background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: 16, borderRadius: 12, fontWeight: 900, fontSize: 15, cursor: salvando ? 'not-allowed' : 'pointer', letterSpacing: 1 }}>
        {salvando ? 'SALVANDO...' : 'SALVAR CONFIGURAÇÕES'}
      </button>

      <p style={{ color: '#2D3748', fontSize: 11, textAlign: 'center', marginTop: 20, letterSpacing: 1 }}>
        POWERED BY ZYNDETAIL · ZYNCOMPANY
      </p>
    </div>
  )
}