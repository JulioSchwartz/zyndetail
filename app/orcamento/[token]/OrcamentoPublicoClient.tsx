'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function mascaraCpf(v: string) {
  v = v.replace(/\D/g, '').slice(0, 11)
  return v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export default function OrcamentoPublicoClient() {
  const params = useParams()
  const token = Array.isArray(params.token) ? params.token[0] : params.token

  const [orcamento, setOrcamento] = useState<any>(null)
  const [empresa, setEmpresa] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [etapa, setEtapa] = useState<'visualizar' | 'assinar' | 'recusar' | 'concluido'>('visualizar')
  const [assinaturaNome, setAssinaturaNome] = useState('')
  const [assinaturaCpf, setAssinaturaCpf] = useState('')
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregar() {
      const { data: orc } = await supabase
        .from('orcamentos_detail')
        .select('*, cliente:clientes(*), veiculo:veiculos(*), itens:orcamento_itens_detail(*)')
        .eq('token', token)
        .single()

      if (!orc) { setLoading(false); return }
      setOrcamento(orc)

      const { data: emp } = await supabase
        .from('empresas_detail')
        .select('*')
        .eq('id', orc.empresa_id)
        .single()
      setEmpresa(emp)
      setLoading(false)
    }
    if (token) carregar()
  }, [token])

  async function assinar() {
    setErro('')
    if (!assinaturaNome.trim()) { setErro('Informe seu nome completo.'); return }
    if (assinaturaCpf.replace(/\D/g, '').length < 11) { setErro('Informe um CPF válido.'); return }
    setSalvando(true)

    // Pega IP público
    let ip = 'N/A'
    try {
      const res = await fetch('https://api.ipify.org?format=json')
      const data = await res.json()
      ip = data.ip
    } catch {}

    const { error } = await supabase.from('orcamentos_detail').update({
      status: 'aprovado',
      assinatura_nome: assinaturaNome.trim(),
      assinatura_cpf: assinaturaCpf,
      assinatura_ip: ip,
      assinado_em: new Date().toISOString(),
      notificacao_lida: false,
    }).eq('token', token)

    if (error) { setErro('Erro ao registrar assinatura.'); setSalvando(false); return }

    // Envia email para a estética
    await fetch('/api/notificar-orcamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'aprovado',
        orcamento_id: orcamento.id,
        token,
        empresa_email: empresa?.email,
        empresa_nome: empresa?.nome,
        cliente_nome: orcamento.cliente?.nome,
        veiculo: `${orcamento.veiculo?.marca} ${orcamento.veiculo?.modelo} (${orcamento.veiculo?.placa})`,
        valor: orcamento.valor_total,
        assinatura_nome: assinaturaNome,
      }),
    }).catch(() => {})

    setSalvando(false)
    setEtapa('concluido')
  }

  async function recusar() {
    setErro('')
    if (!motivoRecusa.trim()) { setErro('Informe o motivo da recusa.'); return }
    setSalvando(true)

    const { error } = await supabase.from('orcamentos_detail').update({
      status: 'recusado',
      motivo_recusa: motivoRecusa.trim(),
      notificacao_lida: false,
    }).eq('token', token)

    if (error) { setErro('Erro ao registrar recusa.'); setSalvando(false); return }

    await fetch('/api/notificar-orcamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'recusado',
        orcamento_id: orcamento.id,
        token,
        empresa_email: empresa?.email,
        empresa_nome: empresa?.nome,
        cliente_nome: orcamento.cliente?.nome,
        motivo: motivoRecusa,
      }),
    }).catch(() => {})

    setSalvando(false)
    setEtapa('concluido')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080C18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#080C18', fontSize: 22, fontWeight: 900 }}>Z</span>
      </div>
      <p style={{ color: '#D4A843', fontWeight: 700, letterSpacing: 2, fontSize: 12 }}>CARREGANDO...</p>
    </div>
  )

  if (!orcamento) return (
    <div style={{ minHeight: '100vh', background: '#080C18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
      <p style={{ fontSize: 40 }}>🔍</p>
      <p style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>Orçamento não encontrado</p>
      <p style={{ color: '#4A5568', fontSize: 14 }}>O link pode ter expirado ou ser inválido.</p>
    </div>
  )

  const inp: React.CSSProperties = { width: '100%', padding: '12px 14px', background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 15, boxSizing: 'border-box' as const, outline: 'none' }

  // Concluído
  if (etapa === 'concluido') return (
    <div style={{ minHeight: '100vh', background: '#080C18', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#0D1220', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 20, padding: 40, maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', borderRadius: 16, width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <span style={{ color: '#080C18', fontSize: 30, fontWeight: 900 }}>Z</span>
        </div>
        <p style={{ fontSize: 40, marginBottom: 16 }}>{orcamento.status === 'aprovado' ? '✅' : '❌'}</p>
        <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: '0 0 12px' }}>
          {orcamento.status === 'aprovado' ? 'Orçamento Aprovado!' : 'Orçamento Recusado'}
        </h2>
        <p style={{ color: '#4A5568', fontSize: 14, lineHeight: 1.6 }}>
          {orcamento.status === 'aprovado'
            ? `Obrigado, ${assinaturaNome.split(' ')[0]}! Sua aprovação foi registrada. Em breve nossa equipe entrará em contato para agendar o serviço.`
            : 'Sua recusa foi registrada. Obrigado pelo retorno.'}
        </p>
        {empresa?.whatsapp && orcamento.status === 'aprovado' && (
          <a href={`https://wa.me/55${empresa.whatsapp.replace(/\D/g, '')}`} target="_blank"
            style={{ display: 'inline-block', marginTop: 20, background: 'rgba(72,187,120,0.1)', border: '1px solid rgba(72,187,120,0.3)', color: '#48BB78', padding: '12px 24px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
            📱 Falar com a estética
          </a>
        )}
        <p style={{ color: '#2D3748', fontSize: 11, marginTop: 24 }}>POWERED BY ZYNDETAIL · ZYNCOMPANY</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#080C18', padding: '0 0 60px' }}>
      {/* Header */}
      <div style={{ background: '#0A0F1E', borderBottom: '1px solid rgba(212,168,67,0.15)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', borderRadius: 7, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#080C18', fontWeight: 900, fontSize: 15 }}>Z</span>
          </div>
          <div>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 13, letterSpacing: 2 }}>{empresa?.nome || 'ZYNDETAIL'}</span>
          </div>
        </div>
        <span style={{ color: '#4A5568', fontSize: 11, letterSpacing: 2 }}>ORÇAMENTO #{orcamento.token}</span>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>

        {/* Status já respondido */}
        {(orcamento.status === 'aprovado' || orcamento.status === 'recusado') && etapa === 'visualizar' && (
          <div style={{ background: orcamento.status === 'aprovado' ? 'rgba(72,187,120,0.08)' : 'rgba(252,129,129,0.08)', border: `1px solid ${orcamento.status === 'aprovado' ? 'rgba(72,187,120,0.3)' : 'rgba(252,129,129,0.3)'}`, borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'center' }}>
            <p style={{ color: orcamento.status === 'aprovado' ? '#48BB78' : '#FC8181', fontWeight: 700, fontSize: 15, margin: 0 }}>
              {orcamento.status === 'aprovado' ? '✅ Este orçamento já foi aprovado.' : '❌ Este orçamento foi recusado.'}
            </p>
          </div>
        )}

        {/* Saudação */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: '0 0 8px' }}>
            Olá, {orcamento.cliente?.nome?.split(' ')[0]}! 👋
          </h1>
          <p style={{ color: '#4A5568', fontSize: 14, margin: 0 }}>
            {empresa?.nome} preparou um orçamento para o seu veículo.
          </p>
          <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', marginTop: 10 }} />
        </div>

        {/* Veículo */}
        <div style={{ background: '#0D1220', border: '1px solid rgba(212,168,67,0.15)', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 28 }}>🚗</span>
          <div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: 0 }}>{orcamento.veiculo?.marca} {orcamento.veiculo?.modelo}</p>
            <p style={{ color: '#4A5568', fontSize: 13, margin: '4px 0 0' }}>{orcamento.veiculo?.placa} · {orcamento.veiculo?.cor} · {orcamento.veiculo?.ano}</p>
          </div>
        </div>

        {/* Itens */}
        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14 }}>SERVIÇOS INCLUSOS</p>
          {(orcamento.itens || []).map((item: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div>
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: 0 }}>{item.descricao}</p>
                {item.quantidade > 1 && <p style={{ color: '#4A5568', fontSize: 12, margin: '3px 0 0' }}>Qtd: {item.quantidade} × R$ {item.valor?.toFixed(2).replace('.', ',')}</p>}
              </div>
              <p style={{ color: '#D4A843', fontSize: 15, fontWeight: 700, margin: 0 }}>R$ {(item.valor * item.quantidade).toFixed(2).replace('.', ',')}</p>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: '2px solid rgba(212,168,67,0.2)' }}>
            <p style={{ color: '#fff', fontWeight: 900, fontSize: 16, margin: 0 }}>TOTAL</p>
            <p style={{ color: '#D4A843', fontWeight: 900, fontSize: 24, margin: 0 }}>R$ {orcamento.valor_total?.toFixed(2).replace('.', ',')}</p>
          </div>
        </div>

        {orcamento.observacoes && (
          <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>OBSERVAÇÕES</p>
            <p style={{ color: '#CBD5E0', fontSize: 14, margin: 0, lineHeight: 1.6 }}>{orcamento.observacoes}</p>
          </div>
        )}

        {/* Ações — só se pendente */}
        {orcamento.status === 'pendente' && (
          <>
            {etapa === 'visualizar' && (
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={() => setEtapa('assinar')}
                  style={{ flex: 1, background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: 16, borderRadius: 12, fontWeight: 900, fontSize: 16, cursor: 'pointer', letterSpacing: 1 }}>
                  ✅ APROVAR
                </button>
                <button onClick={() => setEtapa('recusar')}
                  style={{ flex: 1, background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.3)', color: '#FC8181', padding: 16, borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                  ❌ RECUSAR
                </button>
              </div>
            )}

            {etapa === 'assinar' && (
              <div style={{ background: '#0D1220', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 12, padding: 24 }}>
                <p style={{ color: '#D4A843', fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 16 }}>✍️ ASSINATURA DIGITAL</p>
                <p style={{ color: '#4A5568', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                  Ao assinar, você confirma que leu e aprovou todos os serviços e valores descritos neste orçamento.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#4A5568', display: 'block', marginBottom: 8, letterSpacing: 1 }}>NOME COMPLETO *</label>
                    <input style={inp} value={assinaturaNome} onChange={e => setAssinaturaNome(e.target.value)} placeholder="Seu nome completo" />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#4A5568', display: 'block', marginBottom: 8, letterSpacing: 1 }}>CPF *</label>
                    <input style={inp} value={assinaturaCpf} onChange={e => setAssinaturaCpf(mascaraCpf(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
                  </div>
                </div>
                {erro && <div style={{ color: '#FC8181', fontSize: 13, marginTop: 12, background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', borderRadius: 8, padding: '8px 12px' }}>{erro}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                  <button onClick={assinar} disabled={salvando}
                    style={{ flex: 1, background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: 14, borderRadius: 10, fontWeight: 900, fontSize: 15, cursor: 'pointer' }}>
                    {salvando ? 'REGISTRANDO...' : '✅ CONFIRMAR APROVAÇÃO'}
                  </button>
                  <button onClick={() => setEtapa('visualizar')}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '14px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>
                    VOLTAR
                  </button>
                </div>
                <p style={{ color: '#2D3748', fontSize: 11, textAlign: 'center', marginTop: 16 }}>
                  IP e data/hora registrados automaticamente para validade jurídica.
                </p>
              </div>
            )}

            {etapa === 'recusar' && (
              <div style={{ background: '#0D1220', border: '1px solid rgba(252,129,129,0.2)', borderRadius: 12, padding: 24 }}>
                <p style={{ color: '#FC8181', fontSize: 13, fontWeight: 700, letterSpacing: 1, marginBottom: 16 }}>❌ RECUSAR ORÇAMENTO</p>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#4A5568', display: 'block', marginBottom: 8, letterSpacing: 1 }}>MOTIVO DA RECUSA *</label>
                  <textarea style={{ ...inp, minHeight: 100, resize: 'vertical' as const }} value={motivoRecusa} onChange={e => setMotivoRecusa(e.target.value)} placeholder="Descreva o motivo da recusa..." />
                </div>
                {erro && <div style={{ color: '#FC8181', fontSize: 13, marginTop: 12 }}>{erro}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button onClick={recusar} disabled={salvando}
                    style={{ flex: 1, background: 'rgba(252,129,129,0.1)', border: '1px solid rgba(252,129,129,0.3)', color: '#FC8181', padding: 14, borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                    {salvando ? 'REGISTRANDO...' : 'CONFIRMAR RECUSA'}
                  </button>
                  <button onClick={() => setEtapa('visualizar')}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#4A5568', padding: '14px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13 }}>
                    VOLTAR
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <p style={{ color: '#2D3748', fontSize: 11, textAlign: 'center', marginTop: 32, letterSpacing: 1 }}>
          POWERED BY ZYNDETAIL · ZYNCOMPANY
        </p>
      </div>
    </div>
  )
}