import { readFileSync } from 'fs'
import { join } from 'path'

export const metadata = {
  title: 'Zyndetail — Gestão de Estéticas Automotivas',
  description: 'Controle total da sua estética automotiva. Orçamentos com assinatura digital, OS com fotos, agenda inteligente, planos de manutenção e financeiro completo.',
  keywords: 'gestão estética automotiva, sistema detailing, software estética carro, agenda automotiva',
}

export default function LandingPage() {
  const html = readFileSync(join(process.cwd(), 'public', 'landing.html'), 'utf-8')
  return (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  )
}