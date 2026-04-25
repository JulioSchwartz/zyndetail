'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEmpresa } from '@/hooks/useEmpresa'

export default function SistemasLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { empresaId, loading } = useEmpresa()
  const [verificado, setVerificado] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/auth/login')
    })
  }, [router])

  useEffect(() => {
    if (loading) return

    if (!empresaId) {
      if (pathname !== '/setup') router.push('/setup')
      setVerificado(true)
      return
    }

    if (pathname === '/setup') {
      setVerificado(true)
      return
    }

    supabase.from('empresas_detail').select('nome').eq('id', empresaId).single().then(({ data }) => {
      if (!data || !data.nome || data.nome.includes('@')) {
        router.push('/setup')
      }
      setVerificado(true)
    })
  }, [empresaId, loading, pathname, router])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const menu = [
    { href: '/dashboard', label: '🏠 Dashboard' },
    { href: '/clientes', label: '👤 Clientes' },
    { href: '/orcamentos', label: '📋 Orçamentos' },
    { href: '/ordens', label: '🔧 Ordens de Serviço' },
    { href: '/agenda', label: '📅 Agenda' },
  ]

  if (!verificado && pathname !== '/setup') {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0F1E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ background: '#D4A843', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <span style={{ color: '#0A0F1E', fontSize: 22, fontWeight: 900 }}>Z</span>
          </div>
          <p style={{ color: '#2B6CB0', fontWeight: 700, fontSize: 13, letterSpacing: 2 }}>CARREGANDO...</p>
        </div>
      </div>
    )
  }

  if (pathname === '/setup') return <>{children}</>

  return (
    <div style={{ minHeight: '100vh', background: '#0D1117' }}>

      {/* TOPBAR */}
      <div style={{
        background: '#0A0F1E',
        borderBottom: '1px solid rgba(43,108,176,0.2)',
        padding: '0 24px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Hamburger mobile */}
          <button onClick={() => setMenuAberto(!menuAberto)}
            className="hamburger"
            style={{ background: 'transparent', border: 'none', color: '#D4A843', fontSize: 20, cursor: 'pointer', display: 'none' }}>
            ☰
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: '#D4A843', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#0A0F1E', fontWeight: 900, fontSize: 18 }}>Z</span>
            </div>
            <div>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 15, letterSpacing: 2, display: 'block', lineHeight: 1 }}>ZYNDETAIL</span>
              <span style={{ color: '#2B6CB0', fontSize: 8, letterSpacing: 3 }}>GESTÃO AUTOMOTIVA</span>
            </div>
          </div>
        </div>

        {/* MENU DESKTOP */}
        <nav style={{ display: 'flex', gap: 2 }} className="nav-desktop">
          {menu.map(item => (
            <a key={item.href} href={item.href}
              style={{
                color: pathname === item.href ? '#D4A843' : '#718096',
                textDecoration: 'none',
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: pathname === item.href ? 700 : 400,
                background: pathname === item.href ? 'rgba(212,168,67,0.08)' : 'transparent',
                letterSpacing: 0.3,
                transition: 'all 0.2s',
              }}>
              {item.label}
            </a>
          ))}
        </nav>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="/configuracoes" style={{
            fontSize: 13, textDecoration: 'none',
            padding: '6px 12px', borderRadius: 8,
            color: pathname === '/configuracoes' ? '#D4A843' : '#718096',
          }}>⚙️</a>
          <button onClick={sair}
            style={{ background: 'transparent', border: '1px solid rgba(43,108,176,0.3)', color: '#718096', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, letterSpacing: 1 }}>
            SAIR
          </button>
        </div>
      </div>

      {/* MENU MOBILE */}
      {menuAberto && (
        <div style={{ background: '#0A0F1E', borderBottom: '1px solid rgba(43,108,176,0.2)', padding: '8px 16px' }} className="nav-mobile">
          {menu.map(item => (
            <a key={item.href} href={item.href}
              onClick={() => setMenuAberto(false)}
              style={{ display: 'block', color: pathname === item.href ? '#D4A843' : '#718096', textDecoration: 'none', padding: '12px 8px', fontSize: 14, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              {item.label}
            </a>
          ))}
        </div>
      )}

      {/* CONTEÚDO */}
      <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        {children}
      </main>

      <style>{`
        @media (max-width: 768px) {
          .hamburger { display: block !important; }
          .nav-desktop { display: none !important; }
        }
      `}</style>
    </div>
  )
}