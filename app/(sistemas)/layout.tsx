'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SistemasLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [menuAberto, setMenuAberto] = useState(false)

  async function sair() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const menu = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/clientes', label: 'Clientes' },
    { href: '/orcamentos', label: 'Orçamentos' },
    { href: '/ordens', label: 'OS' },
    { href: '/agenda', label: 'Agenda' },
  ]

  if (pathname === '/setup') return <>{children}</>

  return (
    <div style={{ minHeight: '100vh', background: '#080C18' }}>

      {/* TOPBAR */}
      <div style={{
        background: '#0A0F1E',
        borderBottom: '1px solid rgba(212,168,67,0.15)',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setMenuAberto(!menuAberto)} className="hamburger"
            style={{ background: 'transparent', border: 'none', color: '#D4A843', fontSize: 18, cursor: 'pointer', display: 'none', padding: 4 }}>
            ☰
          </button>
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

        {/* Menu desktop */}
        <nav style={{ display: 'flex', gap: 2 }} className="nav-desktop">
          {menu.map(item => {
            const ativo = pathname === item.href
            return (
              <a key={item.href} href={item.href} style={{
                color: ativo ? '#D4A843' : '#4A5568',
                textDecoration: 'none',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: ativo ? 700 : 400,
                background: ativo ? 'rgba(212,168,67,0.1)' : 'transparent',
                letterSpacing: 0.3,
                transition: 'all 0.2s',
                border: ativo ? '1px solid rgba(212,168,67,0.2)' : '1px solid transparent',
              }}>
                {item.label}
              </a>
            )
          })}
        </nav>

        {/* Direita */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="/configuracoes" style={{
            fontSize: 16, textDecoration: 'none', padding: '5px 10px', borderRadius: 6,
            color: pathname === '/configuracoes' ? '#D4A843' : '#4A5568',
            background: pathname === '/configuracoes' ? 'rgba(212,168,67,0.1)' : 'transparent',
            transition: 'all 0.2s',
          }}>⚙️</a>
          <button onClick={sair} style={{
            background: 'transparent',
            border: '1px solid rgba(212,168,67,0.2)',
            color: '#4A5568',
            padding: '5px 14px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 11,
            letterSpacing: 1,
            fontWeight: 700,
            transition: 'all 0.2s',
          }}>
            SAIR
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {menuAberto && (
        <div style={{ background: '#0A0F1E', borderBottom: '1px solid rgba(212,168,67,0.1)', padding: '8px 16px' }} className="nav-mobile">
          {menu.map(item => (
            <a key={item.href} href={item.href} onClick={() => setMenuAberto(false)}
              style={{ display: 'block', color: pathname === item.href ? '#D4A843' : '#4A5568', textDecoration: 'none', padding: '12px 8px', fontSize: 14, borderBottom: '1px solid rgba(255,255,255,0.04)', fontWeight: pathname === item.href ? 700 : 400 }}>
              {item.label}
            </a>
          ))}
        </div>
      )}

      {/* Conteúdo */}
      <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        {children}
      </main>

      <style>{`
        @media (max-width: 768px) {
          .hamburger { display: flex !important; }
          .nav-desktop { display: none !important; }
        }
        a:hover { opacity: 0.85; }
      `}</style>
    </div>
  )
}