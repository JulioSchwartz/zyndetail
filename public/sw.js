// Zyndetail Service Worker
// Versão do cache — incrementar ao fazer deploy para atualizar
const CACHE_NAME = 'zyndetail-v1'

// Arquivos para cache inicial (shell do app)
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

// ── INSTALL: pré-cacheia o shell ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// ── ACTIVATE: limpa caches antigos ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

// ── FETCH: Network first, cache fallback ──
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar requests não-GET e requests externos (Supabase, Resend etc)
  if (request.method !== 'GET') return
  if (!url.origin.includes(self.location.origin)) return

  // API routes — sempre network, nunca cache
  if (url.pathname.startsWith('/api/')) return

  // Supabase — nunca cachear
  if (url.hostname.includes('supabase.co')) return

  // Arquivos estáticos (_next/static) — cache first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
      })
    )
    return
  }

  // Páginas — Network first, fallback para cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        return response
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached
          // Fallback offline — redireciona para dashboard em cache
          return caches.match('/dashboard')
        })
      })
  )
})