import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const { priceId, empresaId, email, nomeEmpresa } = await req.json()

    if (!priceId || !empresaId || !email) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
    }

    // Buscar empresa para verificar se já tem customer no Stripe
    const { data: empresa } = await supabaseAdmin
      .from('empresas_detail')
      .select('stripe_customer_id')
      .eq('id', empresaId)
      .single()

    let customerId = empresa?.stripe_customer_id

    // Criar customer no Stripe se não existir
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: nomeEmpresa,
        metadata: { empresa_id: empresaId },
      })
      customerId = customer.id

      await supabaseAdmin
        .from('empresas_detail')
        .update({ stripe_customer_id: customerId })
        .eq('id', empresaId)
    }

    // Criar sessão de checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card', 'boleto'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 7,
        metadata: { empresa_id: empresaId },
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?sucesso=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?cancelado=1`,
      metadata: { empresa_id: empresaId },
      locale: 'pt-BR',
    })

    return NextResponse.json({ url: session.url })

  } catch (err: any) {
    console.error('Erro criar checkout:', err)
    return NextResponse.json({ error: err.message || 'Erro inesperado.' }, { status: 500 })
  }
}