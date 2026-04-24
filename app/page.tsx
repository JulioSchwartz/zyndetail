'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard')
      } else {
        router.push('/auth/login')
      }
    })
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0F1E',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          background: '#D4A843',
          borderRadius: 12,
          width: 56,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <span style={{ color: '#0A0F1E', fontSize: 28, fontWeight: 900 }}>Z</span>
        </div>
        <p style={{ color: '#2B6CB0', fontWeight: 700, fontSize: 16, letterSpacing: 2 }}>
          ZYNDETAIL
        </p>
      </div>
    </div>
  )
}