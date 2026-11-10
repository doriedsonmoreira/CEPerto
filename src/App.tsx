import { useEffect, useState } from 'react'
import { searchAddress, ViaCepRateLimitError } from './services/viaCep'
import { reverseGeocode } from './services/geocoding'
import { parseAddressWithAi } from './services/aiParser'
import type { ProcessedCepResult } from './types/address'

type UiState = 'idle' | 'loading' | 'success' | 'empty' | 'error'

export default function App() {
  // Estado da busca inteligente (Texto livre)
  const [freeText, setFreeText] = useState('')
  const [isAiSearching, setIsAiSearching] = useState(false)

  // Estados do formulário manual
  const [uf, setUf] = useState('CE')
  const [city, setCity] = useState('Fortaleza')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')

  // Estados de controle da UI (Regras do SPEC)
  const [status, setStatus] = useState<UiState>('idle')
  const [isLocating, setIsLocating] = useState(false)
  const [showManualForm, setShowManualForm] = useState(false)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [results, setResults] = useState<ProcessedCepResult[]>([])
  const [copiedCep, setCopiedCep] = useState<string | null>(null)
  const [isSplashFading, setIsSplashFading] = useState(false)
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setIsSplashFading(true), 800)
    const removeTimer = setTimeout(() => setShowSplash(false), 1200)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [])

  // Fluxo 5.1: Busca por Texto Livre com Inteligência Artificial
  async function handleAiSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!freeText.trim()) return

    setInfoMessage(null)
    setIsAiSearching(true)
    setStatus('loading')
    setResults([])

    try {
      const parsed = await parseAddressWithAi(freeText)

      // Regra R5: Se a IA falhar, estourar tempo ou bater no limite de buscas (429), aviso amigável
      if (!parsed || parsed.errorMessage) {
        setStatus('idle')
        setShowManualForm(true)
        setInfoMessage(
          parsed?.errorMessage || 'Não foi possível interpretar o texto com IA. Por favor, use os campos abaixo.'
        )
        return
      }

      // Preenche o formulário com o que a IA extraiu
      setStreet(parsed.logradouro)
      if (parsed.numero) setNumber(parsed.numero)
      if (parsed.cidade) setCity(parsed.cidade)
      if (parsed.uf) setUf(parsed.uf)

      // Regra R3: Se faltou cidade ou UF, pede para o usuário preencher
      const targetCity = parsed.cidade || city
      const targetUf = parsed.uf || uf

      if (!parsed.cidade || !parsed.uf) {
        setStatus('idle')
        setShowManualForm(true)
        setInfoMessage('Identificamos a rua! Por favor, confirme a Cidade e o Estado abaixo para buscar.')
        return
      }

      // Busca o CEP real no ViaCEP
      const data = await searchAddress({
        uf: targetUf,
        city: targetCity,
        street: parsed.logradouro,
        number: parsed.numero,
      })

      if (data.length === 0) {
        setStatus('empty')
      } else {
        setResults(data)
        setStatus('success')
      }
    } catch (err) {
      if (err instanceof ViaCepRateLimitError) {
        setStatus('idle')
        setInfoMessage(err.message)
        return
      }
      console.error(err)
      setStatus('error')
    } finally {
      // R5: nunca deixar a UI presa em 'loading'
      setIsAiSearching(false)
      setStatus(prev => (prev === 'loading' ? 'idle' : prev))
    }
  }

  // Fluxo 5.2: Busca por Localização Atual (GPS + Nominatim)
  function handleUseLocation() {
    setInfoMessage(null)

    if (!('geolocation' in navigator)) {
      setInfoMessage('Seu navegador não possui suporte a geolocalização.')
      return
    }

    setIsLocating(true)
    setStatus('idle')

    navigator.geolocation.getCurrentPosition(
      async position => {
        const { latitude, longitude } = position.coords

        try {
          const geo = await reverseGeocode(latitude, longitude)

          if (!geo) {
            setShowManualForm(true)
            setInfoMessage('Não foi possível identificar sua localização. Preencha os campos abaixo.')
            setIsLocating(false)
            return
          }

          setUf(geo.uf)
          setCity(geo.city)
          setNumber('')

          if (geo.street) {
            setStreet(geo.street)
            setIsLocating(false)

            setStatus('loading')
            setResults([])
            const data = await searchAddress({
              uf: geo.uf,
              city: geo.city,
              street: geo.street,
            })

            if (data.length === 0) {
              setStatus('empty')
            } else {
              setResults(data)
              setStatus('success')
            }
          } else {
            setStreet('')
            setIsLocating(false)
            setShowManualForm(true)
            setInfoMessage(`Localizamos sua cidade: ${geo.city}/${geo.uf}. Por favor, digite apenas a rua abaixo.`)
          }
        } catch (err) {
          console.error(err)
          setInfoMessage('Erro ao consultar dados da sua localização.')
          setIsLocating(false)
        }
      },
      error => {
        setIsLocating(false)
        if (error.code === error.PERMISSION_DENIED) {
          setShowManualForm(true)
          setInfoMessage('Permissão de localização negada. Sem problemas! Use os campos abaixo.')
        } else {
          setInfoMessage('Não foi possível obter sua localização no momento.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  // Busca Manual Estruturada
  async function handleManualSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!street.trim() || !city.trim() || uf.length !== 2) return

    setInfoMessage(null)
    setStatus('loading')
    setResults([])

    try {
      const data = await searchAddress({
        uf,
        city,
        street,
        number: number.trim() || undefined,
      })

      if (data.length === 0) {
        setStatus('empty')
      } else {
        setResults(data)
        setStatus('success')
      }
    } catch (err) {
      if (err instanceof ViaCepRateLimitError) {
        setStatus('idle')
        setInfoMessage(err.message)
        return
      }
      console.error(err)
      setStatus('error')
    }
  }

  // Regra R8: Copiar o CEP com feedback visual de 1 toque
  function handleCopy(cep: string) {
    navigator.clipboard.writeText(cep)
    setCopiedCep(cep)
    setTimeout(() => setCopiedCep(null), 2000)
  }

  return (
    <div className="min-h-screen bg-[#F1F3F6] text-[#0F1F44] font-sans">
      {/* Splash Screen Inicial */}
      {showSplash && (
        <div
          aria-hidden="true"
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F1F3F6] transition-opacity duration-400 ease-out ${
            isSplashFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <img
            src="/favicon.svg"
            alt="CEPerto"
            className="w-24 h-24 sm:w-28 sm:h-28 drop-shadow-sm animate-pulse"
          />
          <span className="mt-3 font-display font-semibold text-[24px] text-[#0F1F44] tracking-tight">
            CEPerto
          </span>
        </div>
      )}

      {/* Faixa do mapa */}
      <div
        className="relative w-full h-[140px] sm:h-[220px] border-b border-[#0F1F44] overflow-hidden bg-[#B5C4DD]"
        aria-hidden="true"
      >
        <img
          src="/map-banner.webp"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[#B5C4DD] mix-blend-multiply" />

        {/* Rota e pin (Desktop) */}
        <svg
          className="hidden sm:block relative w-full h-full max-w-[1440px] mx-auto"
          viewBox="0 0 1440 220"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M300 180C480 120 640 200 820 150C1000 100 1000 120 1080 128"
            stroke="#F1F3F6"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M300 180C480 120 640 200 820 150C1000 100 1000 120 1080 128"
            stroke="#8A4B27"
            strokeWidth="3"
            strokeDasharray="9 8"
          />
          <circle cx="300" cy="180" r="7" fill="#F1F3F6" stroke="#8A4B27" strokeWidth="2" />
          <path
            d="M1080 128C1058 100 1058 72 1080 72C1102 72 1102 100 1080 128Z"
            fill="#0F1F44"
            stroke="#F1F3F6"
            strokeWidth="3"
          />
          <circle cx="1080" cy="90" r="7" fill="#E0BE6E" />
        </svg>

        {/* Rota e pin (Mobile) */}
        <svg
          className="block sm:hidden relative w-full h-full"
          viewBox="0 0 390 140"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M50 112C110 80 170 124 220 100C270 76 270 88 300 92"
            stroke="#F1F3F6"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M50 112C110 80 170 124 220 100C270 76 270 88 300 92"
            stroke="#8A4B27"
            strokeWidth="2.5"
            strokeDasharray="8 7"
          />
          <circle cx="50" cy="112" r="6" fill="#F1F3F6" stroke="#8A4B27" strokeWidth="2" />
          <path
            d="M300 92C282.4 69.6 282.4 47.2 300 47.2C317.6 47.2 317.6 69.6 300 92Z"
            fill="#0F1F44"
            stroke="#F1F3F6"
            strokeWidth="2.4"
          />
          <circle cx="300" cy="61.6" r="5.6" fill="#E0BE6E" />
        </svg>
      </div>

      {/* Conteúdo */}
      <main className="max-w-[560px] mx-auto px-5 pt-8 pb-14 sm:px-0 sm:pt-14 sm:pb-24 flex flex-col gap-[22px] sm:gap-[28px]">
        {/* Cabeçalho */}
        <header className="flex flex-col gap-2 sm:gap-[10px]">
          <h1 className="font-display font-semibold text-[46px] sm:text-[60px] leading-[1.2] text-[#0F1F44] tracking-tight">
            CEPerto
          </h1>
          <p className="text-[16px] sm:text-[18px] leading-snug text-[#0F1F44]">
            Digite o endereço e encontre o CEP.
          </p>
        </header>

        {/* 1. Busca Inteligente */}
        <form onSubmit={handleAiSearch} className="flex flex-col gap-[10px] sm:flex-row sm:gap-0">
          <label htmlFor="free-text-search" className="sr-only">
            Digite o endereço para buscar o CEP
          </label>
          <input
            id="free-text-search"
            type="text"
            maxLength={150}
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            placeholder="Av Beira Mar 1200 Fortaleza CE"
            disabled={isAiSearching || status === 'loading'}
            className="w-full sm:flex-1 h-[53px] sm:h-[56px] px-4 sm:px-[18px] bg-white border-[1.5px] border-[#0F1F44] font-mono text-[16px] text-black placeholder:text-black/50 focus:outline-none focus:ring-2 focus:ring-[#3F6EB0] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isAiSearching || status === 'loading' || !freeText.trim()}
            className="w-full sm:w-[112px] h-[50px] sm:h-[56px] bg-[#0F1F44] hover:bg-[#182e61] text-white font-mono font-medium text-[14px] uppercase tracking-wide flex items-center justify-center transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isAiSearching ? '...' : 'BUSCAR'}
          </button>
        </form>

        {/* 2. Botão Localização */}
        <button
          type="button"
          onClick={handleUseLocation}
          disabled={isLocating || isAiSearching || status === 'loading'}
          className="w-full h-[52px] bg-[#3F6EB0] hover:bg-[#345d98] text-white font-sans font-medium text-[16px] flex items-center justify-center gap-[10px] transition cursor-pointer disabled:opacity-60"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M13.75 11C13.75 12.5188 12.5188 13.75 11 13.75C9.48122 13.75 8.25 12.5188 8.25 11C8.25 9.48122 9.48122 8.25 11 8.25C12.5188 8.25 13.75 9.48122 13.75 11Z"
              stroke="white"
              strokeWidth="1.83333"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M18.3334 11C18.3334 15.0501 15.0501 18.3333 11 18.3333C6.94993 18.3333 3.66669 15.0501 3.66669 11C3.66669 6.9499 6.94993 3.66666 11 3.66666C15.0501 3.66666 18.3334 6.9499 18.3334 11Z"
              stroke="white"
              strokeWidth="1.83333"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M11 0.916656V3.66666M11 18.3333V21.0833M0.916687 11H3.66669M18.3334 11H21.0834"
              stroke="white"
              strokeWidth="1.83333"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            {isLocating ? 'Consultando sua localização...' : 'Usar minha localização'}
          </span>
        </button>

        {/* Mensagens informativas / avisos */}
        {infoMessage && (
          <div
            role="status"
            className="p-3.5 bg-white border-[1.5px] border-[#0F1F44] text-[#0F1F44] text-[14px] flex items-start gap-2.5"
          >
            <span className="font-mono font-medium shrink-0">[!]</span>
            <p>{infoMessage}</p>
          </div>
        )}

        {/* Link Preencher Campos */}
        <button
          type="button"
          onClick={() => setShowManualForm(prev => !prev)}
          aria-expanded={showManualForm}
          className="flex items-center gap-[6px] text-[14px] text-[#0F1F44] hover:underline cursor-pointer w-fit"
        >
          <span>Prefiro preencher os campos</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className={`transition-transform duration-200 ${showManualForm ? 'rotate-180' : ''}`}
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="#0F1F44"
              strokeWidth="1.33333"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* 3. Campos Manuais (Exibido ao clicar no link ou em fallback) */}
        {showManualForm && (
          <form
            onSubmit={handleManualSearch}
            className="border-t border-[#0F1F44] pt-5 sm:pt-6 flex flex-col gap-[14px] sm:gap-4"
          >
            {/* Linha UF e Cidade */}
            <div className="flex gap-3 sm:gap-4">
              <div className="w-[88px] sm:w-[96px] shrink-0 flex flex-col gap-[6px]">
                <label
                  htmlFor="input-uf"
                  className="text-[12px] font-medium text-[#0F1F44] uppercase"
                >
                  UF
                </label>
                <input
                  id="input-uf"
                  type="text"
                  maxLength={2}
                  value={uf}
                  onChange={e => setUf(e.target.value.toUpperCase())}
                  placeholder="UF"
                  required
                  className="w-full h-[49px] sm:h-[51px] px-4 bg-white border-[1.5px] border-[#0F1F44] font-mono text-[16px] sm:text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#3F6EB0]"
                />
              </div>

              <div className="flex-1 flex flex-col gap-[6px]">
                <label
                  htmlFor="input-city"
                  className="text-[12px] font-medium text-[#0F1F44] uppercase"
                >
                  CIDADE
                </label>
                <input
                  id="input-city"
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="Fortaleza"
                  required
                  className="w-full h-[49px] sm:h-[51px] px-4 bg-white border-[1.5px] border-[#0F1F44] font-mono text-[16px] sm:text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#3F6EB0]"
                />
              </div>
            </div>

            {/* Linha Rua e Número */}
            <div className="flex flex-col sm:flex-row gap-[14px] sm:gap-4">
              <div className="flex-1 flex flex-col gap-[6px]">
                <label
                  htmlFor="input-street"
                  className="text-[12px] font-medium text-[#0F1F44] uppercase"
                >
                  RUA, SÍTIO OU POVOADO
                </label>
                <input
                  id="input-street"
                  type="text"
                  value={street}
                  onChange={e => setStreet(e.target.value)}
                  placeholder="Ex: Beira Mar ou Sítio Areias de Cima"
                  required
                  className="w-full h-[49px] sm:h-[51px] px-4 bg-white border-[1.5px] border-[#0F1F44] font-mono text-[16px] sm:text-[15px] text-black placeholder:text-black/50 focus:outline-none focus:ring-2 focus:ring-[#3F6EB0]"
                />
              </div>

              <div className="w-full sm:w-[150px] shrink-0 flex flex-col gap-[6px]">
                <label
                  htmlFor="input-number"
                  className="text-[12px] font-medium text-[#0F1F44] uppercase"
                >
                  Nº (OPCIONAL)
                </label>
                <input
                  id="input-number"
                  type="text"
                  value={number}
                  onChange={e => setNumber(e.target.value)}
                  placeholder="Ex: 1200"
                  className="w-full h-[49px] sm:h-[51px] px-4 bg-white border-[1.5px] border-[#0F1F44] font-mono text-[16px] sm:text-[15px] text-black placeholder:text-black/50 focus:outline-none focus:ring-2 focus:ring-[#3F6EB0]"
                />
              </div>
            </div>

            {/* Dica Zona Rural */}
            <p className="text-[13px] text-[#0F1F44] leading-snug">
              Zona rural: use Sítio, Povoado, Comunidade ou Fazenda antes do nome da localidade.
            </p>

            {/* Botão Buscar Manualmente */}
            <button
              type="submit"
              disabled={status === 'loading' || isAiSearching || isLocating}
              className="w-full h-[51px] border-[1.5px] border-[#0F1F44] bg-transparent hover:bg-[#0F1F44] text-[#0F1F44] hover:text-white font-mono font-medium text-[14px] uppercase transition cursor-pointer disabled:opacity-50"
            >
              {status === 'loading' ? 'BUSCANDO...' : 'BUSCAR MANUALMENTE'}
            </button>
          </form>
        )}

        {/* Estados de UI: Loading */}
        {status === 'loading' && (
          <div className="py-6 border-[1.5px] border-[#0F1F44] bg-white text-center font-mono text-[14px] text-[#0F1F44] animate-pulse">
            {isAiSearching
              ? 'Interpretando endereço com Inteligência Artificial...'
              : 'Consultando ViaCEP e calculando resultados...'}
          </div>
        )}

        {/* Estados de UI: Vazio */}
        {status === 'empty' && (
          <div className="p-4 border-[1.5px] border-[#0F1F44] bg-white text-[#0F1F44] text-[14px]">
            Nenhum CEP encontrado para este endereço. Verifique se o nome da rua ou cidade estão corretos.
          </div>
        )}

        {/* Estados de UI: Erro */}
        {status === 'error' && (
          <div className="p-4 border-[1.5px] border-[#8A4B27] bg-white text-[#8A4B27] text-[14px] font-medium">
            Houve uma falha ao conectar com o serviço. Tente novamente em instantes.
          </div>
        )}

        {/* Estados de UI: Sucesso (Card de Resultado fiel ao Figma) */}
        {status === 'success' && (
          <section className="flex flex-col gap-3" aria-label="Resultados de CEP">
            {results.map((item, index) => (
              <div
                key={`${item.cep}-${index}`}
                className={`w-full min-h-[106px] sm:min-h-[119px] bg-[#8A4B27] text-white flex items-stretch ${item.isExactMatch && results.length > 1 ? 'ring-2 ring-[#0F1F44]' : ''
                  }`}
              >
                {/* Dados do CEP */}
                <div className="flex-1 flex flex-col justify-center gap-1 py-4 pl-4 pr-3 sm:py-[18px] sm:px-[22px]">
                  <span className="text-[13px] font-normal text-white leading-tight">
                    {item.isExactMatch && number
                      ? `Seu CEP · Nº ${number}`
                      : 'Seu CEP'}
                  </span>
                  <div className="font-mono font-medium text-[28px] sm:text-[34px] leading-tight text-[#E0BE6E] sm:text-white">
                    {item.cep}
                  </div>
                  <p className="text-[13px] sm:text-[14px] font-normal text-white leading-snug">
                    {item.logradouro}
                    {item.bairro ? ` · ${item.bairro}` : ''}, {item.localidade} - {item.uf}
                    {item.complemento ? ` (${item.complemento})` : ''}
                  </p>
                </div>

                {/* Botão Copiar */}
                <button
                  type="button"
                  onClick={() => handleCopy(item.cep)}
                  className="w-[78px] sm:w-[98px] shrink-0 border-l-2 border-[#E0BE6E] flex flex-col items-center justify-center gap-[6px] px-4 sm:px-6 hover:bg-black/10 transition cursor-pointer text-[#E0BE6E] sm:text-white"
                  aria-label={`Copiar CEP ${item.cep}`}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M9.16667 7.5H15C15.9205 7.5 16.6667 8.24619 16.6667 9.16667V15C16.6667 15.9205 15.9205 16.6667 15 16.6667H9.16667C8.24619 16.6667 7.5 15.9205 7.5 15V9.16667C7.5 8.24619 8.24619 7.5 9.16667 7.5Z"
                      stroke="currentColor"
                      strokeWidth="1.66667"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4.16675 12.5V4.16667C4.16675 3.72464 4.34234 3.30072 4.6549 2.98816C4.96746 2.67559 5.39139 2.5 5.83341 2.5H14.1667"
                      stroke="currentColor"
                      strokeWidth="1.66667"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="font-mono font-medium text-[11px] sm:text-[12px] uppercase">
                    {copiedCep === item.cep ? 'COPIADO' : 'COPIAR'}
                  </span>
                </button>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  )
}
