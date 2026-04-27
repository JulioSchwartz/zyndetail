'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ETAPAS = [
  { key: 'recebimento', label: 'Recebimento', icon: '📥', desc: 'Veículo recebido na estética' },
  { key: 'andamento',   label: 'Em Serviço',  icon: '🔧', desc: 'Serviço em andamento' },
  { key: 'finalizado',  label: 'Finalizado',  icon: '✅', desc: 'Serviço concluído' },
]

const ITEM_STATUS: Record<string, { label: string, cor: string, icon: string }> = {
  pendente:     { label: 'Pendente',     cor: '#4A5568', icon: '⏳' },
  em_andamento: { label: 'Em andamento', cor: '#D4A843', icon: '🔧' },
  concluido:    { label: 'Concluído',    cor: '#48BB78', icon: '✅' },
}

export default function AcompanharClient() {
  const params = useParams()
  const token = Array.isArray(params.token) ? params.token[0] : params.token

  const [os, setOs] = useState<any>(null)
  const [empresa, setEmpresa] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [etapaAtiva, setEtapaAtiva] = useState('recebimento')

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase
        .from('ordens_servico')
        .select('*, cliente:clientes(*), veiculo:veiculos(*), fotos:os_fotos(*), itens:os_itens(*)')
        .eq('token', token)
        .single()

      if (!data) { setLoading(false); return }
      setOs(data)

      const { data: emp } = await supabase.from('empresas_detail').select('*').eq('id', data.empresa_id).single()
      setEmpresa(emp)
      setLoading(false)
    }
    if (token) carregar()
  }, [token])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080C18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#080C18', fontSize: 22, fontWeight: 900 }}>Z</span>
      </div>
      <p style={{ color: '#D4A843', fontWeight: 700, letterSpacing: 2, fontSize: 12 }}>CARREGANDO...</p>
    </div>
  )

  if (!os) return (
    <div style={{ minHeight: '100vh', background: '#080C18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
      <p style={{ fontSize: 40 }}>🔍</p>
      <p style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>OS não encontrada</p>
      <p style={{ color: '#4A5568', fontSize: 14 }}>O link pode ser inválido.</p>
    </div>
  )

  const fotosEtapa = (os.fotos || []).filter((f: any) => f.etapa === etapaAtiva)
  const itens = os.itens || []
  const concluidos = itens.filter((i: any) => i.status === 'concluido').length
  const progresso = itens.length > 0 ? Math.round((concluidos / itens.length) * 100) : 0

  const statusLabel: Record<string, { label: string, cor: string }> = {
    aberta:       { label: 'Aguardando início', cor: '#90CDF4' },
    em_andamento: { label: 'Em andamento',      cor: '#D4A843' },
    finalizada:   { label: 'Finalizado! ✅',    cor: '#48BB78' },
  }
  const stLabel = statusLabel[os.status] || { label: os.status, cor: '#4A5568' }

  return (
    <div style={{ minHeight: '100vh', background: '#080C18', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ background: '#0A0F1E', borderBottom: '1px solid rgba(212,168,67,0.15)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {empresa?.logo_url ? (
            <img src={empresa.logo_url} alt="Logo" style={{ height: 36, maxWidth: 120, objectFit: 'contain' }} />
          ) : (
            <>
              <div style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', borderRadius: 7, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#080C18', fontWeight: 900, fontSize: 15 }}>Z</span>
              </div>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 13, letterSpacing: 2 }}>{empresa?.nome || 'ZYNDETAIL'}</span>
            </>
          )}
        </div>
        <span style={{ color: stLabel.cor, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>{stLabel.label}</span>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 24px' }}>

        {/* Saudação */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 900, margin: '0 0 8px' }}>
            Olá, {os.cliente?.nome?.split(' ')[0]}! 👋
          </h1>
          <p style={{ color: '#4A5568', fontSize: 14, margin: 0 }}>Acompanhe o serviço do seu veículo em tempo real.</p>
          <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #D4A843, transparent)', marginTop: 10 }} />
        </div>

        {/* Veículo */}
        <div style={{ background: '#0D1220', border: '1px solid rgba(212,168,67,0.15)', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 28 }}>🚗</span>
          <div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: 0 }}>{os.veiculo?.marca} {os.veiculo?.modelo}</p>
            <p style={{ color: '#4A5568', fontSize: 13, margin: '4px 0 0' }}>{os.veiculo?.placa} · {os.veiculo?.cor} · {os.veiculo?.ano}</p>
          </div>
        </div>

        {/* Progresso dos serviços */}
        {itens.length > 0 && (
          <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, margin: 0 }}>SERVIÇOS</p>
              <p style={{ color: '#D4A843', fontSize: 13, fontWeight: 700, margin: 0 }}>{progresso}% concluído</p>
            </div>
            <div style={{ background: '#080C18', borderRadius: 4, height: 8, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(90deg, #D4A843, #48BB78)', height: '100%', width: `${progresso}%`, transition: 'width 0.5s', borderRadius: 4 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {itens.map((item: any) => {
                const ist = ITEM_STATUS[item.status]
                return (
                  <div key={item.id} style={{ background: '#080C18', border: `1px solid ${ist.cor}22`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16 }}>{ist.icon}</span>
                      <p style={{ color: item.status === 'concluido' ? '#48BB78' : '#fff', fontSize: 14, margin: 0, textDecoration: item.status === 'concluido' ? 'line-through' : 'none' }}>
                        {item.descricao}
                      </p>
                    </div>
                    <span style={{ color: ist.cor, fontSize: 11, fontWeight: 700 }}>{ist.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Fotos por etapa */}
        <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#D4A843', letterSpacing: 2, marginBottom: 14 }}>FOTOS DO SERVIÇO</p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {ETAPAS.map(e => {
              const qtd = (os.fotos || []).filter((f: any) => f.etapa === e.key).length
              const ativo = etapaAtiva === e.key
              return (
                <button key={e.key} onClick={() => setEtapaAtiva(e.key)}
                  style={{ flex: 1, background: ativo ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${ativo ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: ativo ? '#D4A843' : '#4A5568', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: ativo ? 700 : 400, textAlign: 'center' as const }}>
                  {e.icon} {e.label} ({qtd})
                </button>
              )
            })}
          </div>

          {fotosEtapa.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ color: '#4A5568', fontSize: 13 }}>Nenhuma foto nesta etapa ainda.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {fotosEtapa.map((foto: any) => (
                <div key={foto.id} style={{ background: '#080C18', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
                  <img src={foto.url} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                  {(foto.servico_descricao || foto.observacao) && (
                    <div style={{ padding: '8px 10px' }}>
                      {foto.servico_descricao && <p style={{ color: '#D4A843', fontSize: 11, fontWeight: 700, margin: '0 0 2px' }}>{foto.servico_descricao}</p>}
                      {foto.observacao && <p style={{ color: '#4A5568', fontSize: 11, margin: 0 }}>{foto.observacao}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* OS Finalizada */}
        {os.status === 'finalizada' && (
          <div style={{ background: 'rgba(72,187,120,0.06)', border: '1px solid rgba(72,187,120,0.2)', borderRadius: 12, padding: 24, textAlign: 'center' as const, marginBottom: 16 }}>
            <p style={{ fontSize: 40, margin: '0 0 12px' }}>🎉</p>
            <p style={{ color: '#48BB78', fontWeight: 900, fontSize: 18, margin: '0 0 8px' }}>Serviço Finalizado!</p>
            <p style={{ color: '#4A5568', fontSize: 14, margin: 0 }}>Seu veículo está pronto. Obrigado pela confiança!</p>
            {empresa?.whatsapp && (
              <a href={`https://wa.me/55${empresa.whatsapp.replace(/\D/g, '')}`} target="_blank"
                style={{ display: 'inline-block', marginTop: 16, background: 'rgba(72,187,120,0.1)', border: '1px solid rgba(72,187,120,0.3)', color: '#48BB78', padding: '10px 20px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
                📱 Falar com a estética
              </a>
            )}
          </div>
        )}

        <p style={{ color: '#2D3748', fontSize: 11, textAlign: 'center' as const, letterSpacing: 1 }}>
          POWERED BY ZYNDETAIL · ZYNCOMPANY
        </p>
      </div>
    </div>
  )
}