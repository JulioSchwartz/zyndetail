'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const PRICE_MENSAL = 'price_1TSKsjPI61I7rxR2lzzp3mzZ'
const PRICE_ANUAL  = 'price_1TSKuBPI61I7rxR2mmOlIqKY'

export default function AssinarPage() {
  const router = useRouter()
  const [empresa, setEmpresa] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null)
  const [planoSelecionado, setPlanoSelecionado] = useState<'mensal' | 'anual'>('anual')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/auth/login'); return }
      const { data: usuario } = await supabase
        .from('usuarios_detail')
        .select('empresa_id')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (!usuario?.empresa_id) { router.push('/auth/login'); return }
      const { data: emp } = await supabase
        .from('empresas_detail')
        .select('*')
        .eq('id', usuario.empresa_id)
        .single()
      setEmpresa(emp)
      setLoading(false)
    }
    init()
  }, [])

  async function assinar(priceId: string) {
    if (!empresa) return
    setProcessando(priceId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/criar-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          empresaId: empresa.id,
          email: session?.user?.email,
          nomeEmpresa: empresa.nome,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Erro ao criar checkout. Tente novamente.')
        setProcessando(null)
      }
    } catch {
      alert('Erro inesperado. Tente novamente.')
      setProcessando(null)
    }
  }

  // Dias restantes do trial
  const diasTrial = empresa?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(empresa.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#080C18', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#080C18', fontSize: 22, fontWeight: 900 }}>Z</span>
      </div>
      <p style={{ color: '#D4A843', fontWeight: 700, letterSpacing: 2, fontSize: 12 }}>CARREGANDO...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#080C18', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', borderRadius: 14, width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <span style={{ color: '#080C18', fontSize: 28, fontWeight: 900 }}>Z</span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 900, margin: '0 0 8px', letterSpacing: 1 }}>ZYNDETAIL</h1>
          <p style={{ color: '#4A5568', fontSize: 14 }}>Escolha seu plano para continuar</p>
        </div>

        {/* Aviso de trial */}
        {empresa?.status === 'trial' && (
          <div style={{ background: diasTrial <= 2 ? 'rgba(252,129,129,0.08)' : 'rgba(212,168,67,0.08)', border: `1px solid ${diasTrial <= 2 ? 'rgba(252,129,129,0.25)' : 'rgba(212,168,67,0.25)'}`, borderRadius: 12, padding: '12px 16px', marginBottom: 28, textAlign: 'center' }}>
            <p style={{ color: diasTrial <= 2 ? '#FC8181' : '#D4A843', fontSize: 14, fontWeight: 700, margin: 0 }}>
              {diasTrial > 0
                ? `⏰ Seu período de teste termina em ${diasTrial} dia(s)`
                : '⚠️ Seu período de teste encerrou'}
            </p>
            <p style={{ color: '#4A5568', fontSize: 12, margin: '4px 0 0' }}>
              Assine agora para manter o acesso a todas as funcionalidades
            </p>
          </div>
        )}

        {/* Toggle mensal/anual */}
        <div style={{ display: 'flex', background: '#0D1220', borderRadius: 10, padding: 4, marginBottom: 24, border: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => setPlanoSelecionado('mensal')}
            style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: planoSelecionado === 'mensal' ? 'rgba(212,168,67,0.15)' : 'transparent', color: planoSelecionado === 'mensal' ? '#D4A843' : '#4A5568', transition: 'all 0.2s' }}>
            Mensal
          </button>
          <button onClick={() => setPlanoSelecionado('anual')}
            style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: planoSelecionado === 'anual' ? 'rgba(212,168,67,0.15)' : 'transparent', color: planoSelecionado === 'anual' ? '#D4A843' : '#4A5568', transition: 'all 0.2s', position: 'relative' }}>
            Anual
            <span style={{ position: 'absolute', top: -8, right: 8, background: 'linear-gradient(135deg, #48BB78, #2D9E6B)', color: '#fff', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 6, letterSpacing: 0.5 }}>
              2 MESES GRÁTIS
            </span>
          </button>
        </div>

        {/* Card do plano */}
        <div style={{ background: '#0D1220', border: '1px solid rgba(212,168,67,0.25)', borderRadius: 20, padding: 32, marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #D4A843, #F0C060)' }} />

          <div style={{ marginBottom: 24 }}>
            <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 2, margin: '0 0 8px' }}>ZYNDETAIL COMPLETO</p>
            {planoSelecionado === 'mensal' ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ color: '#D4A843', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>R$</span>
                <span style={{ color: '#D4A843', fontSize: 48, fontWeight: 900, lineHeight: 1, fontFamily: 'monospace' }}>199</span>
                <span style={{ color: '#4A5568', fontSize: 18, marginBottom: 8 }}>,90/mês</span>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ color: '#D4A843', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>R$</span>
                  <span style={{ color: '#D4A843', fontSize: 48, fontWeight: 900, lineHeight: 1, fontFamily: 'monospace' }}>1.998</span>
                  <span style={{ color: '#4A5568', fontSize: 18, marginBottom: 8 }}>,90/ano</span>
                </div>
                <p style={{ color: '#48BB78', fontSize: 13, fontWeight: 700, margin: '4px 0 0' }}>
                  Equivale a R$ 166,58/mês — 2 meses grátis!
                </p>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 20, marginBottom: 24 }}>
            {[
              'Clientes e veículos ilimitados',
              'Ordens de serviço ilimitadas',
              'Orçamentos com assinatura digital',
              'Agenda com agendamento público',
              'Planos de manutenção recorrentes',
              'Controle financeiro completo',
              'WhatsApp automático',
              'Dashboard com faturamento real',
              'Suporte em português',
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ color: '#48BB78', fontSize: 14, fontWeight: 900 }}>✓</span>
                <p style={{ color: '#CBD5E0', fontSize: 14, margin: 0 }}>{f}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => assinar(planoSelecionado === 'mensal' ? PRICE_MENSAL : PRICE_ANUAL)}
            disabled={!!processando}
            style={{ width: '100%', background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: '16px', borderRadius: 12, fontWeight: 900, fontSize: 15, cursor: processando ? 'not-allowed' : 'pointer', letterSpacing: 1, opacity: processando ? 0.7 : 1, transition: 'all 0.2s' }}>
            {processando ? 'REDIRECIONANDO...' : `ASSINAR PLANO ${planoSelecionado === 'mensal' ? 'MENSAL' : 'ANUAL'}`}
          </button>

          <p style={{ textAlign: 'center', color: '#4A5568', fontSize: 12, marginTop: 12 }}>
            Cartão de crédito ou boleto · Cancele quando quiser
          </p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <button onClick={() => router.push('/dashboard')}
            style={{ background: 'transparent', border: 'none', color: '#4A5568', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
            Voltar ao sistema
          </button>
        </div>
      </div>
    </div>
  )
}