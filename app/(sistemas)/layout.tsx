'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const MANUAL_URL = 'https://cpyvksnsfihybemvxvap.supabase.co/storage/v1/object/public/manuais/zyndetail_manual.pdf'

export default function SistemasLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [menuAberto, setMenuAberto] = useState(false)
  const [mostrarBannerPWA, setMostrarBannerPWA] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Detecta se já está instalado como PWA
    const jáInstalado = window.matchMedia('(display-mode: standalone)').matches
    // Detecta se é mobile
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    // Verifica se já fechou o banner antes
    const jáFechou = localStorage.getItem('zyndetail_pwa_banner') === 'fechado'
    // Detecta iOS
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent)

    setIsIOS(ios)

    if (isMobile && !jáInstalado && !jáFechou) {
      setMostrarBannerPWA(true)
    }
  }, [])

  function fecharBanner() {
    localStorage.setItem('zyndetail_pwa_banner', 'fechado')
    setMostrarBannerPWA(false)
  }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const menu = [
    { href: '/dashboard',   label: 'Dashboard'  },
    { href: '/clientes',    label: 'Clientes'   },
    { href: '/servicos',    label: 'Serviços'   },
    { href: '/orcamentos',  label: 'Orçamentos' },
    { href: '/ordens',      label: 'OS'         },
    { href: '/agenda',      label: 'Agenda'     },
    { href: '/planos',      label: 'Planos'     },
    { href: '/financeiro',  label: 'Financeiro' },
  ]

  if (pathname === '/setup') return <>{children}</>

  return (
    <div style={{ minHeight: '100vh', background: '#080C18' }}>

      {/* BANNER PWA */}
      {mostrarBannerPWA && (
        <div style={{ background: 'rgba(212,168,67,0.1)', borderBottom: '1px solid rgba(212,168,67,0.2)', padding: '10px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>📲</span>
            <div>
              <p style={{ color: '#D4A843', fontWeight: 700, fontSize: 13, margin: '0 0 2px' }}>
                Instale o Zyndetail no seu celular!
              </p>
              <p style={{ color: '#8A7040', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                {isIOS
                  ? 'No Safari: toque em Compartilhar → "Adicionar à Tela de Início"'
                  : 'No Chrome: toque no menu ⋮ → "Adicionar à tela inicial"'}
              </p>
            </div>
          </div>
          <button onClick={fecharBanner}
            style={{ background: 'transparent', border: 'none', color: '#8A7040', fontSize: 18, cursor: 'pointer', flexShrink: 0, padding: 0, lineHeight: 1 }}>
            ✕
          </button>
        </div>
      )}

      {/* TOPBAR */}
      <div style={{ background: '#0A0F1E', borderBottom: '1px solid rgba(212,168,67,0.15)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setMenuAberto(!menuAberto)} className="hamburger"
            style={{ background: 'transparent', border: 'none', color: '#D4A843', fontSize: 18, cursor: 'pointer', display: 'none', padding: 4 }}>☰</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', borderRadius: 7, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#080C18', fontWeight: 900, fontSize: 17 }}>Z</span>
            </div>
            <div>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 14, letterSpacing: 2, display: 'block', lineHeight: 1 }}>ZYNDETAIL</span>
              <span style={{ color: '#D4A843', fontSize: 8, letterSpacing: 3 }}>GESTÃO AUTOMOTIVA</span>
            </div>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: 2 }} className="nav-desktop">
          {menu.map(item => {
            const ativo = pathname === item.href
            return (
              <a key={item.href} href={item.href} style={{ color: ativo ? '#D4A843' : '#4A5568', textDecoration: 'none', padding: '6px 11px', borderRadius: 6, fontSize: 12, fontWeight: ativo ? 700 : 400, background: ativo ? 'rgba(212,168,67,0.1)' : 'transparent', letterSpacing: 0.3, transition: 'all 0.2s', border: ativo ? '1px solid rgba(212,168,67,0.2)' : '1px solid transparent' }}>
                {item.label}
              </a>
            )
          })}
          <a href={MANUAL_URL} target="_blank" rel="noopener noreferrer"
            style={{ color: '#4A5568', textDecoration: 'none', padding: '6px 11px', borderRadius: 6, fontSize: 12, fontWeight: 400, background: 'transparent', border: '1px solid transparent', letterSpacing: 0.3, transition: 'all 0.2s' }}>
            &#128214; Manual
          </a>
        </nav>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="/configuracoes" style={{ fontSize: 16, textDecoration: 'none', padding: '5px 10px', borderRadius: 6, color: pathname === '/configuracoes' ? '#D4A843' : '#4A5568', background: pathname === '/configuracoes' ? 'rgba(212,168,67,0.1)' : 'transparent' }}>⚙️</a>
          <button onClick={sair} style={{ background: 'transparent', border: '1px solid rgba(212,168,67,0.2)', color: '#4A5568', padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 11, letterSpacing: 1, fontWeight: 700 }}>SAIR</button>
        </div>
      </div>

      {/* MENU MOBILE */}
      {menuAberto && (
        <div style={{ background: '#0A0F1E', borderBottom: '1px solid rgba(212,168,67,0.1)', padding: '8px 16px' }} className="nav-mobile">
          {menu.map(item => (
            <a key={item.href} href={item.href} onClick={() => setMenuAberto(false)}
              style={{ display: 'block', color: pathname === item.href ? '#D4A843' : '#4A5568', textDecoration: 'none', padding: '12px 8px', fontSize: 14, borderBottom: '1px solid rgba(255,255,255,0.04)', fontWeight: pathname === item.href ? 700 : 400 }}>
              {item.label}
            </a>
          ))}
          <a href={MANUAL_URL} target="_blank" rel="noopener noreferrer" onClick={() => setMenuAberto(false)}
            style={{ display: 'block', color: '#4A5568', textDecoration: 'none', padding: '12px 8px', fontSize: 14, borderBottom: '1px solid rgba(255,255,255,0.04)', fontWeight: 400 }}>
            &#128214; Manual
          </a>
        </div>
      )}

      <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        {children}
      </main>

      <style>{`
        @media (max-width: 900px) {
          .hamburger { display: flex !important; }
          .nav-desktop { display: none !important; }
        }
      `}</style>
    </div>
  )
}