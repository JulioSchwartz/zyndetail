import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ⚠️ Necessário para ler o body raw do Stripe
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature inválida:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log('Evento Stripe recebido:', event.type)

  try {
    switch (event.type) {

      // ── Checkout concluído ──
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const empresaId = session.metadata?.empresa_id
        if (!empresaId) break

        const subscriptionId = session.subscription as string
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0]?.price.id
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString()
        const trialEnd = subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null

        await supabaseAdmin
          .from('empresas_detail')
          .update({
            stripe_subscription_id: subscriptionId,
            stripe_price_id: priceId,
            status: 'ativo',
            plano: getPlanFromPrice(priceId),
            subscription_ends_at: currentPeriodEnd,
            trial_ends_at: trialEnd,
          })
          .eq('id', empresaId)

        console.log(`✅ Assinatura ativada para empresa ${empresaId}`)
        break
      }

      // ── Pagamento recebido (renovação) ──
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string
        if (!subscriptionId) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const empresaId = subscription.metadata?.empresa_id
        if (!empresaId) break

        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString()

        await supabaseAdmin
          .from('empresas_detail')
          .update({
            status: 'ativo',
            subscription_ends_at: currentPeriodEnd,
          })
          .eq('stripe_subscription_id', subscriptionId)

        console.log(`✅ Pagamento recebido, assinatura renovada: ${subscriptionId}`)
        break
      }

      // ── Pagamento falhou ──
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string
        if (!subscriptionId) break

        await supabaseAdmin
          .from('empresas_detail')
          .update({ status: 'inadimplente' })
          .eq('stripe_subscription_id', subscriptionId)

        console.log(`⚠️ Pagamento falhou: ${subscriptionId}`)
        break
      }

      // ── Assinatura cancelada ──
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const empresaId = subscription.metadata?.empresa_id

        await supabaseAdmin
          .from('empresas_detail')
          .update({
            status: 'cancelado',
            stripe_subscription_id: null,
          })
          .eq('stripe_subscription_id', subscription.id)

        console.log(`❌ Assinatura cancelada: ${subscription.id}`)
        break
      }

      // ── Assinatura atualizada (upgrade/downgrade) ──
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const priceId = subscription.items.data[0]?.price.id
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString()

        await supabaseAdmin
          .from('empresas_detail')
          .update({
            stripe_price_id: priceId,
            plano: getPlanFromPrice(priceId),
            status: subscription.status === 'active' ? 'ativo' : subscription.status,
            subscription_ends_at: currentPeriodEnd,
          })
          .eq('stripe_subscription_id', subscription.id)

        console.log(`🔄 Assinatura atualizada: ${subscription.id}`)
        break
      }

      // ── Trial terminando ──
      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription
        console.log(`⏰ Trial terminando em 3 dias: ${subscription.id}`)
        // Aqui você pode enviar e-mail de aviso via Resend
        break
      }
    }
  } catch (err) {
    console.error('Erro processando webhook:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// Mapeia Price ID para nome do plano
function getPlanFromPrice(priceId: string): string {
  const map: Record<string, string> = {
    'price_1TSKsjPI61I7rxR2lzzp3mzZ': 'mensal',    // Zyndetail Mensal
    'price_1TSKuBPI61I7rxR2mmOlIqKY': 'anual',     // Zyndetail Anual
  }
  return map[priceId] || 'mensal'
}