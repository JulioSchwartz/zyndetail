'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function CadastroClient() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [nomeLoja, setNomeLoja] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [etapa, setEtapa] = useState<'formulario' | 'sucesso'>('formulario')

  async function cadastrar() {
    setErro('')
    if (!nome.trim() || !nomeLoja.trim() || !email.trim() || !senha || !confirma) {
      setErro('Preencha todos os campos.')
      return
    }
    if (senha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres.')
      return
    }
    if (senha !== confirma) {
      setErro('As senhas não coincidem.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: senha, nomeEmpresa: nomeLoja, nomeUsuario: nome }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || 'Erro ao criar conta. Tente novamente.')
        setLoading(false)
        return
      }

      // Login automático via tokens retornados pelo backend
      if (data.accessToken && data.refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.accessToken,
          refresh_token: data.refreshToken,
        })
        if (sessionError) {
          // Fallback: tenta signInWithPassword
          await new Promise(resolve => setTimeout(resolve, 800))
          const { error: loginError } = await supabase.auth.signInWithPassword({ email, password: senha })
          if (loginError) {
            setErro('Conta criada com sucesso! Houve um erro ao entrar automaticamente. Clique em "Já tem conta? Entrar" e faça login com o e-mail e senha que você acabou de cadastrar.')
            setLoading(false)
            return
          }
        }
      } else {
        // Fallback: tenta signInWithPassword
        await new Promise(resolve => setTimeout(resolve, 800))
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (loginError) {
          setErro('Conta criada com sucesso! Houve um erro ao entrar automaticamente. Clique em "Já tem conta? Entrar" e faça login com o e-mail e senha que você acabou de cadastrar.')
          setLoading(false)
          return
        }
      }

      // Mostra tela de sucesso e redireciona após 2.5s
      setEtapa('sucesso')
      setTimeout(() => router.push('/setup'), 2500)

    } catch {
      setErro('Erro inesperado. Tente novamente.')
      setLoading(false)
    }
  }

  if (etapa === 'sucesso') {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0F1E', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,168,67,0.3)', borderRadius: 20, padding: 48, width: '100%', maxWidth: 420, textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(212,168,67,0.15)', border: '2px solid rgba(212,168,67,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', fontSize: 36
          }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>Conta criada com sucesso!</h2>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, margin: '0 0 8px' }}>
            Bem-vindo à Zyndetail, <strong style={{ color: '#fff' }}>{nome.split(' ')[0]}</strong>! 🚗
          </p>
          <p style={{ color: '#4A5568', fontSize: 13, margin: '0 0 36px' }}>
            Seu trial de <strong style={{ color: '#D4A843' }}>7 dias grátis</strong> começou agora.
          </p>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 100, height: 4, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{
              height: '100%', borderRadius: 100, background: '#D4A843',
              animation: 'progresso 2.5s linear forwards',
            }} />
          </div>
          <p style={{ fontSize: 12, color: '#4B5563', margin: 0 }}>Preparando seu painel...</p>
          <style>{`
            @keyframes progresso {
              from { width: 0%; }
              to   { width: 100%; }
            }
          `}</style>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0F1E', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(43,108,176,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 40, width: '100%', maxWidth: 440, position: 'relative', backdropFilter: 'blur(10px)' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <div style={{ background: '#D4A843', borderRadius: 14, width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <span style={{ color: '#0A0F1E', fontSize: 28, fontWeight: 900 }}>Z</span>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: 3 }}>ZYNDETAIL</h1>
            <p style={{ color: '#2B6CB0', fontSize: 10, marginTop: 4, letterSpacing: 4, fontWeight: 600 }}>GESTÃO AUTOMOTIVA</p>
          </a>
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', textAlign: 'center', marginBottom: 4, letterSpacing: 1 }}>CRIAR CONTA</h2>
        <p style={{ textAlign: 'center', color: '#4A5568', fontSize: 12, marginBottom: 24, letterSpacing: 1 }}>ACESSO GRATUITO</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelSt}>Seu nome</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="João Silva"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '11px 14px', fontSize: 14, color: '#fff', outline: 'none', boxSizing: 'border-box' as const }} />
          </div>
          <div>
            <label style={labelSt}>Nome da estética</label>
            <input type="text" value={nomeLoja} onChange={e => setNomeLoja(e.target.value)} placeholder="Auto Detailing Premium"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '11px 14px', fontSize: 14, color: '#fff', outline: 'none', boxSizing: 'border-box' as const }} />
          </div>
          <div>
            <label style={labelSt}>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '11px 14px', fontSize: 14, color: '#fff', outline: 'none', boxSizing: 'border-box' as const }} />
          </div>
          <div>
            <label style={labelSt}>Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '11px 14px', fontSize: 14, color: '#fff', outline: 'none', boxSizing: 'border-box' as const }} />
          </div>
          <div>
            <label style={labelSt}>Confirmar senha</label>
            <input type="password" value={confirma} onChange={e => setConfirma(e.target.value)} placeholder="Repita a senha"
              onKeyDown={e => e.key === 'Enter' && cadastrar()}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '11px 14px', fontSize: 14, color: '#fff', outline: 'none', boxSizing: 'border-box' as const }} />
          </div>

          {erro && (
            <p style={{ color: '#FC8181', fontSize: 13, textAlign: 'center', background: 'rgba(252,129,129,0.08)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(252,129,129,0.2)', lineHeight: 1.6 }}>{erro}</p>
          )}

          <button onClick={cadastrar} disabled={loading}
            style={{ background: loading ? 'rgba(43,108,176,0.5)' : '#2B6CB0', color: '#fff', border: 'none', padding: '14px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, letterSpacing: 2 }}>
            {loading ? 'CRIANDO CONTA...' : 'CRIAR CONTA →'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#4A5568', marginTop: 20 }}>
          Já tem conta?{' '}
          <a href="/auth/login" style={{ color: '#90CDF4', fontWeight: 700, textDecoration: 'none' }}>Entrar</a>
        </p>
        <p style={{ textAlign: 'center', fontSize: 10, color: '#2D3748', marginTop: 16, letterSpacing: 1 }}>POWERED BY ZYNCOMPANY</p>
      </div>
    </div>
  )
}

const labelSt: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#718096', display: 'block', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' as const,
}