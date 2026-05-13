'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Etapa = 'email' | 'enviado' | 'nova_senha' | 'sucesso'

export default function RecuperarSenhaClient() {
  const [etapa, setEtapa] = useState<Etapa>('email')
  const [email, setEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  // Detecta o token de recuperação na URL (Supabase redireciona com #access_token)
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('access_token') && hash.includes('type=recovery')) {
      setEtapa('nova_senha')
    }
  }, [])

  async function enviarEmail() {
    setErro('')
    if (!email.trim()) { setErro('Informe seu e-mail.'); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/recuperar-senha`,
    })
    setLoading(false)
    if (error) { setErro('Erro ao enviar e-mail. Verifique o endereço.'); return }
    setEtapa('enviado')
  }

  async function salvarNovaSenha() {
    setErro('')
    if (novaSenha.length < 6) { setErro('A senha deve ter no mínimo 6 caracteres.'); return }
    if (novaSenha !== confirmaSenha) { setErro('As senhas não coincidem.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    setLoading(false)
    if (error) { setErro('Erro ao salvar senha. Tente novamente.'); return }
    setEtapa('sucesso')
  }

  const containerSt: React.CSSProperties = {
    minHeight: '100vh',
    background: '#0A0F1E',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
  }

  const cardSt: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 40,
    width: '100%',
    maxWidth: 400,
    position: 'relative',
    backdropFilter: 'blur(10px)',
  }

  const inputSt: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    background: '#080C18',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 15,
    boxSizing: 'border-box' as const,
    outline: 'none',
  }

  const labelSt: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: '#718096',
    display: 'block',
    marginBottom: 6,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  }

  const Logo = () => (
    <div style={{ textAlign: 'center', marginBottom: 32 }}>
      <a href="/" style={{ textDecoration: 'none' }}>
        <div style={{ background: '#D4A843', borderRadius: 14, width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <span style={{ color: '#0A0F1E', fontSize: 28, fontWeight: 900 }}>Z</span>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: 3 }}>ZYNDETAIL</h1>
        <p style={{ color: '#2B6CB0', fontSize: 10, marginTop: 4, letterSpacing: 4, fontWeight: 600 }}>GESTÃO AUTOMOTIVA</p>
      </a>
    </div>
  )

  // ── ETAPA 1: SOLICITAR E-MAIL ──
  if (etapa === 'email') return (
    <div style={containerSt}>
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(43,108,176,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={cardSt}>
        <Logo />
        <h2 style={{ fontSize: 18, fontWeight: 900, color: '#fff', textAlign: 'center', margin: '0 0 8px', letterSpacing: 1 }}>RECUPERAR SENHA</h2>
        <p style={{ color: '#4A5568', fontSize: 13, textAlign: 'center', margin: '0 0 28px', lineHeight: 1.6 }}>
          Informe seu e-mail e enviaremos um link para criar uma nova senha.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelSt}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              onKeyDown={e => e.key === 'Enter' && enviarEmail()}
              style={inputSt}
            />
          </div>

          {erro && (
            <p style={{ color: '#FC8181', fontSize: 13, textAlign: 'center', background: 'rgba(252,129,129,0.08)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(252,129,129,0.2)' }}>{erro}</p>
          )}

          <button onClick={enviarEmail} disabled={loading}
            style={{ background: loading ? 'rgba(43,108,176,0.5)' : '#2B6CB0', color: '#fff', border: 'none', padding: '14px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: 1 }}>
            {loading ? 'ENVIANDO...' : 'ENVIAR LINK DE RECUPERAÇÃO'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#718096', marginTop: 24 }}>
          Lembrou a senha?{' '}
          <a href="/auth/login" style={{ color: '#90CDF4', fontWeight: 700, textDecoration: 'none' }}>Entrar</a>
        </p>
        <p style={{ textAlign: 'center', fontSize: 10, color: '#2D3748', marginTop: 16, letterSpacing: 1 }}>POWERED BY ZYNCOMPANY</p>
      </div>
    </div>
  )

  // ── ETAPA 2: E-MAIL ENVIADO ──
  if (etapa === 'enviado') return (
    <div style={containerSt}>
      <div style={cardSt}>
        <Logo />
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 56, margin: '0 0 16px' }}>📧</p>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: '0 0 12px' }}>E-mail enviado!</h2>
          <p style={{ color: '#4A5568', fontSize: 14, lineHeight: 1.6, margin: '0 0 8px' }}>
            Enviamos um link de recuperação para
          </p>
          <p style={{ color: '#90CDF4', fontSize: 15, fontWeight: 700, margin: '0 0 20px' }}>{email}</p>
          <p style={{ color: '#4A5568', fontSize: 13, lineHeight: 1.6, margin: '0 0 28px' }}>
            Clique no link do e-mail para criar uma nova senha. Verifique também a caixa de spam.
          </p>
          <a href="/auth/login"
            style={{ display: 'inline-block', background: '#2B6CB0', color: '#fff', padding: '12px 32px', borderRadius: 10, fontWeight: 700, textDecoration: 'none', letterSpacing: 1, fontSize: 13 }}>
            VOLTAR AO LOGIN
          </a>
        </div>
        <p style={{ textAlign: 'center', fontSize: 10, color: '#2D3748', marginTop: 24, letterSpacing: 1 }}>POWERED BY ZYNCOMPANY</p>
      </div>
    </div>
  )

  // ── ETAPA 3: NOVA SENHA ──
  if (etapa === 'nova_senha') return (
    <div style={containerSt}>
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(43,108,176,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={cardSt}>
        <Logo />
        <h2 style={{ fontSize: 18, fontWeight: 900, color: '#fff', textAlign: 'center', margin: '0 0 8px', letterSpacing: 1 }}>CRIAR NOVA SENHA</h2>
        <p style={{ color: '#4A5568', fontSize: 13, textAlign: 'center', margin: '0 0 28px' }}>
          Escolha uma senha segura para sua conta.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelSt}>Nova senha</label>
            <input
              type="password"
              value={novaSenha}
              onChange={e => setNovaSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              style={inputSt}
            />
          </div>
          <div>
            <label style={labelSt}>Confirmar nova senha</label>
            <input
              type="password"
              value={confirmaSenha}
              onChange={e => setConfirmaSenha(e.target.value)}
              placeholder="Repita a nova senha"
              onKeyDown={e => e.key === 'Enter' && salvarNovaSenha()}
              style={inputSt}
            />
          </div>

          {erro && (
            <p style={{ color: '#FC8181', fontSize: 13, textAlign: 'center', background: 'rgba(252,129,129,0.08)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(252,129,129,0.2)' }}>{erro}</p>
          )}

          <button onClick={salvarNovaSenha} disabled={loading}
            style={{ background: loading ? 'rgba(43,108,176,0.5)' : '#2B6CB0', color: '#fff', border: 'none', padding: '14px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: 1 }}>
            {loading ? 'SALVANDO...' : 'SALVAR NOVA SENHA'}
          </button>
        </div>
        <p style={{ textAlign: 'center', fontSize: 10, color: '#2D3748', marginTop: 24, letterSpacing: 1 }}>POWERED BY ZYNCOMPANY</p>
      </div>
    </div>
  )

  // ── ETAPA 4: SUCESSO ──
  return (
    <div style={containerSt}>
      <div style={cardSt}>
        <Logo />
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 56, margin: '0 0 16px' }}>✅</p>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: '0 0 12px' }}>Senha atualizada!</h2>
          <p style={{ color: '#4A5568', fontSize: 14, lineHeight: 1.6, margin: '0 0 28px' }}>
            Sua senha foi alterada com sucesso. Faça login com a nova senha.
          </p>
          <a href="/auth/login"
            style={{ display: 'inline-block', background: '#2B6CB0', color: '#fff', padding: '12px 32px', borderRadius: 10, fontWeight: 700, textDecoration: 'none', letterSpacing: 1, fontSize: 13 }}>
            IR PARA O LOGIN
          </a>
        </div>
        <p style={{ textAlign: 'center', fontSize: 10, color: '#2D3748', marginTop: 24, letterSpacing: 1 }}>POWERED BY ZYNCOMPANY</p>
      </div>
    </div>
  )
}