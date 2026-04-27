import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tipo, empresa_email, empresa_nome, cliente_nome, veiculo, valor, assinatura_nome, motivo, token } = body

    if (!empresa_email) return NextResponse.json({ ok: false })

    const linkOrcamento = `${process.env.NEXT_PUBLIC_SITE_URL}/orcamento/${token}`

    const assunto = tipo === 'aprovado'
      ? `✅ Orçamento APROVADO — ${cliente_nome}`
      : `❌ Orçamento RECUSADO — ${cliente_nome}`

    const html = tipo === 'aprovado' ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #080C18; color: #fff; border-radius: 16px; overflow: hidden;">
        <div style="background: #0A0F1E; padding: 24px; border-bottom: 2px solid #D4A843;">
          <h1 style="color: #D4A843; font-size: 24px; margin: 0; letter-spacing: 2px;">ZYNDETAIL</h1>
          <p style="color: #4A5568; margin: 4px 0 0; font-size: 12px; letter-spacing: 2px;">GESTÃO AUTOMOTIVA</p>
        </div>
        <div style="padding: 32px 24px;">
          <div style="background: rgba(72,187,120,0.1); border: 1px solid rgba(72,187,120,0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
            <p style="font-size: 40px; margin: 0 0 8px;">✅</p>
            <h2 style="color: #48BB78; font-size: 20px; margin: 0;">Orçamento Aprovado!</h2>
          </div>
          <p style="color: #CBD5E0; font-size: 15px; line-height: 1.6;">Olá, <strong style="color: #fff;">${empresa_nome}</strong>!</p>
          <p style="color: #CBD5E0; font-size: 15px; line-height: 1.6;">
            O cliente <strong style="color: #fff;">${cliente_nome}</strong> aprovou o orçamento referente ao veículo <strong style="color: #fff;">${veiculo || ''}</strong>.
          </p>
          <div style="background: #0D1220; border: 1px solid rgba(212,168,67,0.2); border-radius: 12px; padding: 20px; margin: 20px 0;">
            <p style="color: #4A5568; font-size: 12px; letter-spacing: 1px; margin: 0 0 8px;">VALOR APROVADO</p>
            <p style="color: #D4A843; font-size: 28px; font-weight: 900; margin: 0;">R$ ${Number(valor).toFixed(2).replace('.', ',')}</p>
            <p style="color: #4A5568; font-size: 12px; margin: 8px 0 0;">Assinado por: ${assinatura_nome}</p>
          </div>
          <p style="color: #CBD5E0; font-size: 14px; line-height: 1.6;">
            🔧 Acesse a plataforma para abrir a Ordem de Serviço e agendar o atendimento.
          </p>
          <a href="${linkOrcamento}" style="display: inline-block; margin-top: 16px; background: linear-gradient(135deg, #D4A843, #F0C060); color: #080C18; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 900; font-size: 14px; letter-spacing: 1px;">
            VER ORÇAMENTO →
          </a>
        </div>
        <div style="padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center;">
          <p style="color: #2D3748; font-size: 11px; margin: 0; letter-spacing: 1px;">POWERED BY ZYNDETAIL · ZYNCOMPANY</p>
        </div>
      </div>
    ` : `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #080C18; color: #fff; border-radius: 16px; overflow: hidden;">
        <div style="background: #0A0F1E; padding: 24px; border-bottom: 2px solid #D4A843;">
          <h1 style="color: #D4A843; font-size: 24px; margin: 0; letter-spacing: 2px;">ZYNDETAIL</h1>
          <p style="color: #4A5568; margin: 4px 0 0; font-size: 12px; letter-spacing: 2px;">GESTÃO AUTOMOTIVA</p>
        </div>
        <div style="padding: 32px 24px;">
          <div style="background: rgba(252,129,129,0.1); border: 1px solid rgba(252,129,129,0.3); border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
            <p style="font-size: 40px; margin: 0 0 8px;">❌</p>
            <h2 style="color: #FC8181; font-size: 20px; margin: 0;">Orçamento Recusado</h2>
          </div>
          <p style="color: #CBD5E0; font-size: 15px; line-height: 1.6;">Olá, <strong style="color: #fff;">${empresa_nome}</strong>!</p>
          <p style="color: #CBD5E0; font-size: 15px; line-height: 1.6;">
            O cliente <strong style="color: #fff;">${cliente_nome}</strong> recusou o orçamento.
          </p>
          <div style="background: #0D1220; border: 1px solid rgba(252,129,129,0.2); border-radius: 12px; padding: 20px; margin: 20px 0;">
            <p style="color: #4A5568; font-size: 12px; letter-spacing: 1px; margin: 0 0 8px;">MOTIVO DA RECUSA</p>
            <p style="color: #FC8181; font-size: 15px; margin: 0; line-height: 1.6;">"${motivo}"</p>
          </div>
          <a href="${linkOrcamento}" style="display: inline-block; margin-top: 16px; background: rgba(212,168,67,0.1); border: 1px solid rgba(212,168,67,0.3); color: #D4A843; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px;">
            VER ORÇAMENTO →
          </a>
        </div>
        <div style="padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center;">
          <p style="color: #2D3748; font-size: 11px; margin: 0; letter-spacing: 1px;">POWERED BY ZYNDETAIL · ZYNCOMPANY</p>
        </div>
      </div>
    `

    await resend.emails.send({
      from: 'noreply@zynplan.com.br',
      to: empresa_email,
      subject: assunto,
      html,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false })
  }
}