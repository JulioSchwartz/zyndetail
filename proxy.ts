import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Rotas públicas que não precisam de autenticação
const PUBLIC_ROUTES = [
  '/',
  '/auth/login',
  '/auth/cadastro',
  '/auth/recuperar',
  '/orcamento',
  '/acompanhar',
  '/agendar',
  '/assinar',        // página de assinatura/upgrade
  '/api/cadastro',
  '/api/webhook-stripe',
  '/api/criar-checkout',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Permitir rotas públicas, assets e API routes de webhook
  if (
    PUBLIC_ROUTES.some(r => pathname.startsWith(r)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Verificar autenticação via cookie do Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const authCookie = req.cookies.getAll()
    .find(c => c.name.includes('auth-token') || c.name.includes('access_token'))

  if (!authCookie) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}