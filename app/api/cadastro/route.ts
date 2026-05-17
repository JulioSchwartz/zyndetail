import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

export async function POST(req: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const { email, password, nomeEmpresa, nomeUsuario } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
    })

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        return NextResponse.json({
          error: 'Este e-mail já está cadastrado em um produto Zyncompany. Use outro e-mail para realizar o cadastro.'
        }, { status: 409 })
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const user = authData.user
    if (!user) return NextResponse.json({ error: 'Erro ao criar usuário.' }, { status: 500 })

    let stripeCustomerId: string | null = null
    try {
      const customer = await stripe.customers.create({
        email,
        name: nomeEmpresa?.trim() || email,
        metadata: { origem: 'zyndetail_cadastro' },
      })
      stripeCustomerId = customer.id
    } catch (stripeErr) {
      console.error('Erro ao criar customer Stripe:', stripeErr)
    }

    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 7)

    const { data: empresa, error: erroEmpresa } = await supabaseAdmin
      .from('empresas_detail')
      .insert({
        nome: nomeEmpresa?.trim() || email,
        plano: 'trial',
        status: 'trial',
        stripe_customer_id: stripeCustomerId,
        trial_ends_at: trialEndsAt.toISOString(),
        criado_em: new Date().toISOString(),
      })
      .select().single()

    if (erroEmpresa || !empresa) {
      await supabaseAdmin.auth.admin.deleteUser(user.id)
      return NextResponse.json({ error: 'Erro ao criar empresa.' }, { status: 500 })
    }

    const { error: erroUsuario } = await supabaseAdmin
      .from('usuarios_detail')
      .insert({
        email, user_id: user.id, empresa_id: empresa.id,
        perfil: 'admin', criado_em: new Date().toISOString(),
      })

    if (erroUsuario) {
      await supabaseAdmin.from('empresas_detail').delete().eq('id', empresa.id)
      await supabaseAdmin.auth.admin.deleteUser(user.id)
      return NextResponse.json({ error: 'Erro ao vincular usuário.' }, { status: 500 })
    }

    // Gera sessão para login automático
    const { data: sessionData } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    const resend = new Resend(process.env.RESEND_API_KEY!)

    // Email de boas-vindas
    try {
      await resend.emails.send({
        from: 'Zyndetail <noreply@zyncompany.com.br>',
        to: [email],
        subject: `Bem-vindo à Zyndetail, ${nomeEmpresa || ''}!`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #0A0F1E; color: #fff; border-radius: 12px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 28px;">
              <div style="background: #D4A843; border-radius: 8px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                <span style="color: #0A0F1E; font-size: 22px; font-weight: 900;">Z</span>
              </div>
              <div>
                <span style="color: #fff; font-size: 16px; font-weight: 900; letter-spacing: 2px;">ZYNDETAIL</span><br/>
                <span style="color: #D4A843; font-size: 10px; letter-spacing: 3px;">GESTÃO AUTOMOTIVA</span>
              </div>
            </div>
            <h2 style="color: #D4A843; margin-bottom: 8px;">Bem-vindo à Zyndetail! 🚗</h2>
            <p style="color: #94a3b8; margin-bottom: 24px;">Sua conta foi criada com sucesso. Você tem <strong style="color:#fff;">7 dias de trial gratuito</strong> para testar a plataforma.</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr><td style="padding: 12px 0; border-bottom: 1px solid #1a2744; color: #4A5568; font-size: 13px; width: 140px;">Estética</td><td style="padding: 12px 0; border-bottom: 1px solid #1a2744; font-weight: 600;">${nomeEmpresa || '—'}</td></tr>
              <tr><td style="padding: 12px 0; border-bottom: 1px solid #1a2744; color: #4A5568; font-size: 13px;">E-mail</td><td style="padding: 12px 0; border-bottom: 1px solid #1a2744; font-weight: 600;">${email}</td></tr>
              <tr><td style="padding: 12px 0; color: #4A5568; font-size: 13px;">Trial até</td><td style="padding: 12px 0; font-weight: 600; color: #D4A843;">${trialEndsAt.toLocaleDateString('pt-BR')}</td></tr>
            </table>
            <a href="https://zyndetail.com.br/auth/login"
               style="display: inline-block; background: #D4A843; color: #0A0F1E; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700;">
              Acessar minha conta →
            </a>
            <p style="color: #475569; font-size: 13px; margin-top: 32px;">Qualquer dúvida, fale com a gente em <a href="https://zyncompany.com.br/contato" style="color: #D4A843;">zyncompany.com.br/contato</a>.</p>
          </div>
        `,
      })
    } catch (emailErr) {
      console.error('Erro ao enviar boas-vindas:', emailErr)
    }

    // Notificação interna
    try {
      await resend.emails.send({
        from: 'Zyndetail <noreply@zyncompany.com.br>',
        to: ['suportezyndetail@gmail.com'],
        subject: `🚗 Novo cadastro Zyndetail: ${nomeEmpresa || email}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #0A0F1E; color: #fff; border-radius: 12px;">
            <h2 style="color: #D4A843; margin-bottom: 24px;">🚗 Novo cadastro na Zyndetail!</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 12px 0; border-bottom: 1px solid #1a2744; color: #4A5568; font-size: 13px; width: 140px;">Nome</td><td style="padding: 12px 0; border-bottom: 1px solid #1a2744; font-weight: 600;">${nomeUsuario || '—'}</td></tr>
              <tr><td style="padding: 12px 0; border-bottom: 1px solid #1a2744; color: #4A5568; font-size: 13px;">Estética</td><td style="padding: 12px 0; border-bottom: 1px solid #1a2744; font-weight: 600;">${nomeEmpresa || '—'}</td></tr>
              <tr><td style="padding: 12px 0; border-bottom: 1px solid #1a2744; color: #4A5568; font-size: 13px;">E-mail</td><td style="padding: 12px 0; border-bottom: 1px solid #1a2744; font-weight: 600;">${email}</td></tr>
              <tr><td style="padding: 12px 0; border-bottom: 1px solid #1a2744; color: #4A5568; font-size: 13px;">Trial até</td><td style="padding: 12px 0; border-bottom: 1px solid #1a2744; font-weight: 600; color: #D4A843;">${trialEndsAt.toLocaleDateString('pt-BR')}</td></tr>
              <tr><td style="padding: 12px 0; color: #4A5568; font-size: 13px;">Data/hora</td><td style="padding: 12px 0; font-weight: 600;">${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td></tr>
            </table>
          </div>
        `,
      })
    } catch (emailErr) {
      console.error('Erro ao enviar notificação:', emailErr)
    }

    return NextResponse.json({
      success: true,
      empresaId: empresa.id,
      accessToken: sessionData?.properties?.access_token || null,
      refreshToken: sessionData?.properties?.refresh_token || null,
    })

  } catch (err) {
    console.error('Erro cadastro Zyndetail:', err)
    return NextResponse.json({ error: 'Erro inesperado. Tente novamente.' }, { status: 500 })
  }
}