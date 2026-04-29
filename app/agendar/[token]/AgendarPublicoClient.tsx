'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const DIAS_SEMANA_KEY = ['dom','seg','ter','qua','qui','sex','sab']

function formatarDataLocal(d: Date) {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function horaParaMinutos(hora: string) {
  const [h, m] = hora.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function mascaraTelefone(v: string) {
  v = v.replace(/\D/g, '').slice(0, 11)
  if (v.length <= 10) return v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '')
  return v.replace(/(\d{2})(\d{1})(\d{4})(\d{0,4})/, '($1) $2 $3-$4').replace(/-$/, '')
}

type Etapa = 'escolher_data' | 'escolher_hora' | 'dados' | 'confirmado'

export default function AgendarPublicoClient() {
  const params = useParams()
  const token = Array.isArray(params.token) ? params.token[0] : params.token

  const [empresa, setEmpresa] = useState<any>(null)
  const [servicos, setServicos] = useState<any[]>([])
  const [agendamentosExistentes, setAgendamentosExistentes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [etapa, setEtapa] = useState<Etapa>('escolher_data')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Seleções
  const [dataSelecionada, setDataSelecionada] = useState('')
  const [horaSelecionada, setHoraSelecionada] = useState('')
  const [servicoSelecionado, setServicoSelecionado] = useState('')

  // Dados do solicitante
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [veiculo, setVeiculo] = useState('')
  const [observacoes, setObservacoes] = useState('')

  // Semana navegável
  const [semanaBase, setSemanaBase] = useState(new Date())

  useEffect(() => {
    async function carregar() {
      const { data: emp } = await supabase
        .from('empresas_detail')
        .select('*')
        .eq('token_publico', token)
        .single()

      if (!emp) { setLoading(false); return }
      setEmpresa(emp)

      const [{ data: servs }, { data: ags }] = await Promise.all([
        supabase.from('servicos_catalogo').select('*').eq('empresa_id', emp.id).eq('ativo', true).order('nome'),
        supabase.from('agendamentos').select('data, hora, duracao_minutos, status').eq('empresa_id', emp.id).neq('status', 'cancelado'),
      ])

      setServicos(servs || [])
      setAgendamentosExistentes(ags || [])
      setLoading(false)
    }
    if (token) carregar()
  }, [token])

  function getDiasSemana(base: Date) {
    const dias = []
    const inicio = new Date(base)
    const diaSemana = inicio.getDay()
    const diff = diaSemana === 0 ? -6 : 1 - diaSemana
    inicio.setDate(inicio.getDate() + diff)
    for (let i = 0; i < 7; i++) {
      const d = new Date(inicio)
      d.setDate(inicio.getDate() + i)
      dias.push(d)
    }
    return dias
  }

  function getHorasDisponiveis(dataStr: string): string[] {
    const horaAbertura = empresa?.horario_abertura?.slice(0, 5) || '08:00'
    const horaFechamento = empresa?.horario_fechamento?.slice(0, 5) || '18:00'
    const aberturaMin = horaParaMinutos(horaAbertura)
    const fechamentoMin = horaParaMinutos(horaFechamento)

    const slots: string[] = []
    for (let m = aberturaMin; m < fechamentoMin; m += 30) {
      const h = String(Math.floor(m / 60)).padStart(2, '0')
      const min = String(m % 60).padStart(2, '0')
      slots.push(`${h}:${min}`)
    }

    // Filtra horários já passados hoje
    const hoje = formatarDataLocal(new Date())
    if (dataStr === hoje) {
      const agora = new Date()
      const agoraMin = agora.getHours() * 60 + agora.getMinutes()
      return slots.filter(s => horaParaMinutos(s) > agoraMin)
    }

    return slots
  }

  function getVagasDisponiveis(dataStr: string, horaStr: string): number {
    const vagas = empresa?.vagas || {}
    const serv = servicos.find(s => s.nome === servicoSelecionado)
    const nomeServ = (serv?.nome || '').toLowerCase()

    let vagasTotal = 2
    if (nomeServ.includes('lavag') || nomeServ.includes('lavação')) vagasTotal = vagas.lavagem || 2
    else if (nomeServ.includes('poliment')) vagasTotal = vagas.polimento || 1
    else vagasTotal = vagas.outros || 2

    const ocupados = agendamentosExistentes.filter(a => a.data === dataStr && a.hora.slice(0,5) === horaStr).length
    return Math.max(0, vagasTotal - ocupados)
  }

  async function confirmarAgendamento() {
    setErro('')
    if (!nome.trim()) { setErro('Informe seu nome.'); return }
    if (telefone.replace(/\D/g, '').length < 10) { setErro('Informe um telefone válido.'); return }
    if (!veiculo.trim()) { setErro('Informe o veículo.'); return }
    setSalvando(true)

    const serv = servicos.find(s => s.nome === servicoSelecionado)

    const { error } = await supabase.from('agendamentos').insert({
      empresa_id: empresa.id,
      titulo: servicoSelecionado || 'Solicitação de agendamento',
      data: dataSelecionada,
      hora: horaSelecionada,
      duracao_minutos: serv?.duracao_minutos || 60,
      servico: servicoSelecionado || null,
      status: 'pendente',
      tipo: 'solicitacao',
      solicitante_nome: nome.trim(),
      solicitante_telefone: telefone,
      solicitante_veiculo: veiculo.trim(),
      observacoes: observacoes.trim() || null,
      notificacao_lida: false,
    })

    if (error) { setErro('Erro ao enviar solicitação. Tente novamente.'); setSalvando(false); return }
    setSalvando(false)
    setEtapa('confirmado')
  }

  const diasSemana = getDiasSemana(semanaBase)
  const hoje = formatarDataLocal(new Date())
  const diasFuncionamento: string[] = empresa?.dias_funcionamento || ['seg','ter','qua','qui','sex']
  const horasDisponiveis = dataSelecionada ? getHorasDisponiveis(dataSelecionada) : []

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#080C18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#080C18', fontSize: 22, fontWeight: 900 }}>Z</span>
      </div>
      <p style={{ color: '#D4A843', fontWeight: 700, letterSpacing: 2, fontSize: 12 }}>CARREGANDO...</p>
    </div>
  )

  if (!empresa) return (
    <div style={{ minHeight: '100vh', background: '#080C18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
      <p style={{ fontSize: 40 }}>🔍</p>
      <p style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>Estética não encontrada</p>
      <p style={{ color: '#4A5568', fontSize: 14 }}>O link pode ser inválido.</p>
    </div>
  )

  const inp: React.CSSProperties = { width: '100%', padding: '12px 14px', background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#fff', fontSize: 15, boxSizing: 'border-box' as const, outline: 'none' }

  // ── CONFIRMADO ──
  if (etapa === 'confirmado') return (
    <div style={{ minHeight: '100vh', background: '#080C18', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#0D1220', border: '1px solid rgba(212,168,67,0.2)', borderRadius: 20, padding: 40, maxWidth: 480, width: '100%', textAlign: 'center' as const }}>
        {empresa.logo_url ? (
          <img src={empresa.logo_url} alt="Logo" style={{ height: 60, maxWidth: 160, objectFit: 'contain', margin: '0 auto 20px', display: 'block' }} />
        ) : (
          <div style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', borderRadius: 16, width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <span style={{ color: '#080C18', fontSize: 30, fontWeight: 900 }}>Z</span>
          </div>
        )}
        <p style={{ fontSize: 48, margin: '0 0 16px' }}>🎉</p>
        <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: '0 0 12px' }}>Solicitação Enviada!</h2>
        <p style={{ color: '#4A5568', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
          Olá, <strong style={{ color: '#CBD5E0' }}>{nome.split(' ')[0]}</strong>! Sua solicitação foi recebida por <strong style={{ color: '#D4A843' }}>{empresa.nome}</strong>.
          Em breve entrarão em contato para confirmar seu agendamento.
        </p>
        <div style={{ background: '#080C18', borderRadius: 12, padding: 16, marginBottom: 20, textAlign: 'left' as const }}>
          <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>RESUMO DA SOLICITAÇÃO</p>
          {[
            { label: 'Data', valor: new Date(dataSelecionada + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) },
            { label: 'Horário', valor: horaSelecionada },
            { label: 'Serviço', valor: servicoSelecionado || 'Não especificado' },
            { label: 'Veículo', valor: veiculo },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <p style={{ color: '#4A5568', fontSize: 13, margin: 0 }}>{item.label}</p>
              <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, margin: 0 }}>{item.valor}</p>
            </div>
          ))}
        </div>
        {empresa.whatsapp && (
          <a href={`https://wa.me/55${empresa.whatsapp.replace(/\D/g, '')}`} target="_blank"
            style={{ display: 'inline-block', background: 'rgba(72,187,120,0.1)', border: '1px solid rgba(72,187,120,0.3)', color: '#48BB78', padding: '12px 24px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
            📱 Falar com a estética
          </a>
        )}
        <p style={{ color: '#2D3748', fontSize: 11, marginTop: 24, letterSpacing: 1 }}>POWERED BY ZYNDETAIL · ZYNCOMPANY</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#080C18', paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ background: '#0A0F1E', borderBottom: '1px solid rgba(212,168,67,0.15)', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {empresa.logo_url ? (
            <img src={empresa.logo_url} alt="Logo" style={{ height: 36, maxWidth: 120, objectFit: 'contain' }} />
          ) : (
            <div style={{ background: 'linear-gradient(135deg, #D4A843, #F0C060)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#080C18', fontWeight: 900, fontSize: 18 }}>Z</span>
            </div>
          )}
          <div>
            <p style={{ color: '#fff', fontWeight: 900, fontSize: 14, margin: 0, letterSpacing: 1 }}>{empresa.nome}</p>
            {empresa.cidade && <p style={{ color: '#4A5568', fontSize: 11, margin: 0 }}>{empresa.cidade} · {empresa.estado}</p>}
          </div>
        </div>
        <span style={{ color: '#D4A843', fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>AGENDAR SERVIÇO</span>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '28px 24px' }}>

        {/* Steps */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 28 }}>
          {[
            { key: 'escolher_data', label: 'Data', num: 1 },
            { key: 'escolher_hora', label: 'Horário', num: 2 },
            { key: 'dados', label: 'Seus dados', num: 3 },
          ].map((step, i) => {
            const etapas = ['escolher_data', 'escolher_hora', 'dados']
            const idx = etapas.indexOf(etapa)
            const stepIdx = etapas.indexOf(step.key)
            const concluido = idx > stepIdx
            const ativo = idx === stepIdx
            return (
              <div key={step.key} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', flex: 1 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: concluido ? '#48BB78' : ativo ? '#D4A843' : 'rgba(255,255,255,0.06)', border: `2px solid ${concluido ? '#48BB78' : ativo ? '#D4A843' : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                    <span style={{ color: concluido ? '#fff' : ativo ? '#080C18' : '#4A5568', fontSize: 13, fontWeight: 900 }}>{concluido ? '✓' : step.num}</span>
                  </div>
                  <p style={{ color: ativo ? '#D4A843' : concluido ? '#48BB78' : '#4A5568', fontSize: 11, fontWeight: ativo ? 700 : 400, margin: 0 }}>{step.label}</p>
                </div>
                {i < 2 && <div style={{ height: 2, flex: 0.5, background: concluido ? '#48BB78' : 'rgba(255,255,255,0.06)', marginBottom: 20 }} />}
              </div>
            )
          })}
        </div>

        {/* ── ETAPA 1: ESCOLHER DATA ── */}
        {etapa === 'escolher_data' && (
          <div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 900, margin: '0 0 6px' }}>Escolha a data</h2>
            <p style={{ color: '#4A5568', fontSize: 14, margin: '0 0 20px' }}>Selecione o dia que deseja comparecer.</p>

            {/* Serviço */}
            {servicos.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ color: '#4A5568', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>SERVIÇO DESEJADO</p>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                  <button onClick={() => setServicoSelecionado('')}
                    style={{ background: !servicoSelecionado ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${!servicoSelecionado ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: !servicoSelecionado ? '#D4A843' : '#4A5568', padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: !servicoSelecionado ? 700 : 400 }}>
                    Não sei ainda
                  </button>
                  {servicos.map(s => (
                    <button key={s.id} onClick={() => setServicoSelecionado(s.nome)}
                      style={{ background: servicoSelecionado === s.nome ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${servicoSelecionado === s.nome ? 'rgba(212,168,67,0.4)' : 'rgba(255,255,255,0.08)'}`, color: servicoSelecionado === s.nome ? '#D4A843' : '#CBD5E0', padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: servicoSelecionado === s.nome ? 700 : 400 }}>
                      {s.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Calendário */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <button onClick={() => { const d = new Date(semanaBase); d.setDate(d.getDate() - 7); setSemanaBase(new Date(d)) }}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#CBD5E0', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>←</button>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 13, margin: 0 }}>
                {diasSemana[0].toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </p>
              <button onClick={() => { const d = new Date(semanaBase); d.setDate(d.getDate() + 7); setSemanaBase(new Date(d)) }}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#CBD5E0', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>→</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 20 }}>
              {diasSemana.map((dia, i) => {
                const dStr = formatarDataLocal(dia)
                const diaKey = DIAS_SEMANA_KEY[dia.getDay()]
                const diaAtivo = diasFuncionamento.includes(diaKey)
                const passado = dStr < hoje
                const selecionado = dStr === dataSelecionada
                const isHoje = dStr === hoje
                const desativado = !diaAtivo || passado

                return (
                  <button key={i} disabled={desativado} onClick={() => { setDataSelecionada(dStr); setHoraSelecionada('') }}
                    style={{ background: selecionado ? '#D4A843' : desativado ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)', border: `2px solid ${selecionado ? '#D4A843' : isHoje ? 'rgba(212,168,67,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 10, padding: '10px 4px', cursor: desativado ? 'not-allowed' : 'pointer', opacity: desativado ? 0.3 : 1, textAlign: 'center' as const }}>
                    <p style={{ color: selecionado ? '#080C18' : '#4A5568', fontSize: 10, fontWeight: 700, margin: '0 0 4px', letterSpacing: 1 }}>
                      {['DOM','SEG','TER','QUA','QUI','SEX','SÁB'][dia.getDay()]}
                    </p>
                    <p style={{ color: selecionado ? '#080C18' : isHoje ? '#D4A843' : '#fff', fontSize: 16, fontWeight: 900, margin: 0 }}>{dia.getDate()}</p>
                    {!diaAtivo && !passado && <p style={{ color: '#4A5568', fontSize: 8, margin: '2px 0 0', letterSpacing: 1 }}>FECHADO</p>}
                  </button>
                )
              })}
            </div>

            <button onClick={() => { if (!dataSelecionada) { setErro('Selecione uma data.'); return }; setErro(''); setEtapa('escolher_hora') }}
              disabled={!dataSelecionada}
              style={{ width: '100%', background: dataSelecionada ? 'linear-gradient(135deg, #D4A843, #F0C060)' : 'rgba(255,255,255,0.06)', border: 'none', color: dataSelecionada ? '#080C18' : '#4A5568', padding: 16, borderRadius: 12, fontWeight: 900, fontSize: 15, cursor: dataSelecionada ? 'pointer' : 'not-allowed', letterSpacing: 1 }}>
              CONTINUAR →
            </button>
            {erro && <p style={{ color: '#FC8181', fontSize: 13, marginTop: 10, textAlign: 'center' as const }}>{erro}</p>}
          </div>
        )}

        {/* ── ETAPA 2: ESCOLHER HORA ── */}
        {etapa === 'escolher_hora' && (
          <div>
            <button onClick={() => setEtapa('escolher_data')} style={{ background: 'transparent', border: 'none', color: '#4A5568', cursor: 'pointer', fontSize: 13, marginBottom: 16, padding: 0 }}>← Voltar</button>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 900, margin: '0 0 6px' }}>Escolha o horário</h2>
            <p style={{ color: '#4A5568', fontSize: 14, margin: '0 0 20px' }}>
              {new Date(dataSelecionada + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>

            {horasDisponiveis.length === 0 ? (
              <div style={{ background: '#0D1220', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 24, textAlign: 'center' as const }}>
                <p style={{ fontSize: 32, marginBottom: 12 }}>😔</p>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Nenhum horário disponível</p>
                <p style={{ color: '#4A5568', fontSize: 13 }}>Escolha outra data.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                {horasDisponiveis.map(h => {
                  const vagas = getVagasDisponiveis(dataSelecionada, h)
                  const sem_vagas = vagas === 0
                  const selecionado = h === horaSelecionada
                  return (
                    <button key={h} disabled={sem_vagas} onClick={() => setHoraSelecionada(h)}
                      style={{ background: selecionado ? '#D4A843' : sem_vagas ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)', border: `2px solid ${selecionado ? '#D4A843' : sem_vagas ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, padding: '12px 8px', cursor: sem_vagas ? 'not-allowed' : 'pointer', opacity: sem_vagas ? 0.4 : 1, textAlign: 'center' as const }}>
                      <p style={{ color: selecionado ? '#080C18' : '#fff', fontSize: 16, fontWeight: 900, margin: '0 0 4px' }}>{h}</p>
                      <p style={{ color: selecionado ? '#080C18' : sem_vagas ? '#FC8181' : '#48BB78', fontSize: 10, fontWeight: 700, margin: 0 }}>
                        {sem_vagas ? 'Lotado' : `${vagas} vaga${vagas > 1 ? 's' : ''}`}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}

            <button onClick={() => { if (!horaSelecionada) { setErro('Selecione um horário.'); return }; setErro(''); setEtapa('dados') }}
              disabled={!horaSelecionada}
              style={{ width: '100%', background: horaSelecionada ? 'linear-gradient(135deg, #D4A843, #F0C060)' : 'rgba(255,255,255,0.06)', border: 'none', color: horaSelecionada ? '#080C18' : '#4A5568', padding: 16, borderRadius: 12, fontWeight: 900, fontSize: 15, cursor: horaSelecionada ? 'pointer' : 'not-allowed', letterSpacing: 1 }}>
              CONTINUAR →
            </button>
            {erro && <p style={{ color: '#FC8181', fontSize: 13, marginTop: 10, textAlign: 'center' as const }}>{erro}</p>}
          </div>
        )}

        {/* ── ETAPA 3: DADOS ── */}
        {etapa === 'dados' && (
          <div>
            <button onClick={() => setEtapa('escolher_hora')} style={{ background: 'transparent', border: 'none', color: '#4A5568', cursor: 'pointer', fontSize: 13, marginBottom: 16, padding: 0 }}>← Voltar</button>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 900, margin: '0 0 6px' }}>Seus dados</h2>
            <p style={{ color: '#4A5568', fontSize: 14, margin: '0 0 20px' }}>Preencha para enviar a solicitação.</p>

            {/* Resumo */}
            <div style={{ background: '#0D1220', border: '1px solid rgba(212,168,67,0.15)', borderRadius: 12, padding: 14, marginBottom: 20 }}>
              <p style={{ color: '#D4A843', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>RESUMO</p>
              <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>
                📅 {new Date(dataSelecionada + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} às {horaSelecionada}
              </p>
              {servicoSelecionado && <p style={{ color: '#4A5568', fontSize: 13, margin: 0 }}>🛠️ {servicoSelecionado}</p>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#4A5568', display: 'block', marginBottom: 6, letterSpacing: 1 }}>NOME COMPLETO *</label>
                <input style={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#4A5568', display: 'block', marginBottom: 6, letterSpacing: 1 }}>TELEFONE / WHATSAPP *</label>
                <input style={inp} value={telefone} onChange={e => setTelefone(mascaraTelefone(e.target.value))} placeholder="(42) 9 9999-9999" maxLength={16} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#4A5568', display: 'block', marginBottom: 6, letterSpacing: 1 }}>VEÍCULO *</label>
                <input style={inp} value={veiculo} onChange={e => setVeiculo(e.target.value)} placeholder="Ex: Honda Civic Prata — ABC1234" />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#4A5568', display: 'block', marginBottom: 6, letterSpacing: 1 }}>OBSERVAÇÕES</label>
                <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' as const }} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Algum detalhe importante sobre o serviço..." />
              </div>
            </div>

            {erro && <div style={{ color: '#FC8181', fontSize: 13, marginTop: 12, background: 'rgba(252,129,129,0.08)', border: '1px solid rgba(252,129,129,0.2)', borderRadius: 8, padding: '10px 14px' }}>{erro}</div>}

            <button onClick={confirmarAgendamento} disabled={salvando}
              style={{ width: '100%', background: 'linear-gradient(135deg, #D4A843, #F0C060)', border: 'none', color: '#080C18', padding: 16, borderRadius: 12, fontWeight: 900, fontSize: 15, cursor: 'pointer', letterSpacing: 1, marginTop: 20 }}>
              {salvando ? 'ENVIANDO...' : '✅ ENVIAR SOLICITAÇÃO'}
            </button>

            <p style={{ color: '#4A5568', fontSize: 12, textAlign: 'center' as const, marginTop: 12 }}>
              A estética confirmará seu agendamento em breve.
            </p>
          </div>
        )}

        <p style={{ color: '#2D3748', fontSize: 11, textAlign: 'center' as const, marginTop: 32, letterSpacing: 1 }}>
          POWERED BY ZYNDETAIL · ZYNCOMPANY
        </p>
      </div>
    </div>
  )
}