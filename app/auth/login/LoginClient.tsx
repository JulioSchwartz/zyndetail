'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginClient() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function entrar() {
    setLoading(true)
    setErro('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })

    if (error || !data.session) {
      setErro('E-mail ou senha incorretos')
      setLoading(false)
      return
    }

    // Força reload completo — garante que cookie é lido antes de montar o dashboard
    window.location.href = '/dashboard'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0F1E',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 600,
        height: 600,
        background: 'radial-gradient(circle, rgba(43,108,176,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: 40,
        width: '100%',
        maxWidth: 400,
        position: 'relative',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#D4A843',
              borderRadius: 14,
              width: 60,
              height: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}>
              <span style={{ color: '#0A0F1E', fontSize: 30, fontWeight: 900 }}>Z</span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: 3 }}>
              ZYNDETAIL
            </h1>
            <p style={{ color: '#2B6CB0', fontSize: 10, marginTop: 4, letterSpacing: 4, fontWeight: 600 }}>
              GESTÃO AUTOMOTIVA
            </p>
          </a>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelSt}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label style={labelSt}>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && entrar()}
            />
          </div>

          {erro && (
            <p style={{
              color: '#FC8181',
              fontSize: 13,
              textAlign: 'center',
              background: 'rgba(252,129,129,0.08)',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(252,129,129,0.2)',
            }}>{erro}</p>
          )}

          <button
            onClick={entrar}
            disabled={loading}
            style={{
              background: loading ? 'rgba(43,108,176,0.5)' : '#2B6CB0',
              color: '#fff',
              border: 'none',
              padding: '14px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 8,
              letterSpacing: 1,
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Entrando...' : 'ENTRAR'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#718096', marginTop: 24 }}>
          Não tem conta?{' '}
          <a href="/auth/cadastro" style={{ color: '#90CDF4', fontWeight: 700, textDecoration: 'none' }}>
            Criar acesso
          </a>
        </p>

        <p style={{ textAlign: 'center', fontSize: 10, color: '#2D3748', marginTop: 20, letterSpacing: 1 }}>
          POWERED BY ZYNCOMPANY
        </p>
      </div>
    </div>
  )
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