import { useState } from 'react'
import { searchAddress } from './services/viaCep'
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
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [results, setResults] = useState<ProcessedCepResult[]>([])
  const [copiedCep, setCopiedCep] = useState<string | null>(null)

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
            setInfoMessage(`Localizamos sua cidade: ${geo.city}/${geo.uf}. Por favor, digite apenas a rua
                abaixo.`)
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
    <main className="min-h-screen bg-slate-50 text-slate-900 py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Cabeçalho */}
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-blue-600">
            CEPerto 📍
          </h1>
          <p className="text-slate-600">
            Descubra o CEP digitando livremente ou usando sua localização.
          </p>
        </header>

        {/* 1. Busca por Texto Livre com IA (Fluxo 5.1) */}
        <form onSubmit={handleAiSearch} className="bg-white p-6 rounded-2xl shadow-sm border
            border-slate-200 space-y-3">
          <label className="block text-sm font-bold text-slate-700">
            Busca Inteligente (digite qualquer endereço)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={150}
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              placeholder="Ex: Av Beira Mar 1200 Fortaleza CE"
              className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2
                  focus:ring-blue-500 focus:outline-none text-base"
              disabled={isAiSearching || status === 'loading'}
            />
            <button
              type="submit"
              disabled={isAiSearching || status === 'loading' || !freeText.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl
                  transition shadow-sm hover:shadow disabled:opacity-50 cursor-pointer flex items-center gap-2
                  whitespace-nowrap"
            >
              <span>{isAiSearching ? 'Interpretando...' : 'Buscar'}</span>
              <span>✨</span>
            </button>
          </div>
        </form>

        {/* 2. Botão de Localização Atual (Fluxo 5.2) */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleUseLocation}
            disabled={isLocating || isAiSearching || status === 'loading'}
            className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold
                rounded-2xl transition shadow-sm hover:shadow flex items-center justify-center gap-3
                disabled:opacity-50 cursor-pointer"
          >
            <span>📍</span>
            <span>
              {isLocating ? 'Consultando GPS e descobrindo a rua...' : 'Usar minha localização atual'}
            </span>
          </button>

          {/* Mensagens informativas / avisos */}
          {infoMessage && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm flex
                items-start gap-2">
              <span>ℹ</span>
              <p>{infoMessage}</p>
            </div>
          )}
        </div>

        {/* Divisor Visual */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-200 w-full"></div>
          <span className="bg-slate-50 px-3 text-xs font-semibold text-slate-400 uppercase
              tracking-wider">
            ou preencha os campos manualmente
          </span>
        </div>

        {/* 3. Formulário Manual Estruturado (Fallback R5) */}
        <form onSubmit={handleManualSearch} className="bg-white p-6 rounded-2xl shadow-sm border
            border-slate-200 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                UF
              </label>
              <input
                type="text"
                maxLength={2}
                value={uf}
                onChange={e => setUf(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-center font-bold
                    focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="UF"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Cidade
              </label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2
                    focus:ring-blue-500 focus:outline-none"
                placeholder="Nome da cidade"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Rua / Logradouro / Localidade Rural
              </label>
              <input
                type="text"
                value={street}
                onChange={e => setStreet(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2
                    focus:ring-blue-500 focus:outline-none"
                placeholder="Ex: Beira Mar ou Sítio Areias de Cima"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Nº (Opcional)
              </label>
              <input
                type="text"
                value={number}
                onChange={e => setNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-center focus:ring-2
                    focus:ring-blue-500 focus:outline-none"
                placeholder="Ex: 1200"
              />
            </div>
          </div>

          <p className="text-xs text-slate-500">
            🌾 <strong className="font-semibold text-slate-600">Zona Rural:</strong> no campo de logradouro acima,
            inclua termos como <em>Sítio, Povoado, Comunidade, Fazenda ou Distrito</em> antes do nome da localidade
            (ex: <em>&quot;Sítio Areias de Cima&quot;</em>).
          </p>

          <button
            type="submit"
            disabled={status === 'loading' || isAiSearching || isLocating}
            className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl
                transition shadow-sm hover:shadow disabled:opacity-50 cursor-pointer"
          >
            {status === 'loading' ? 'Buscando...' : 'Buscar manualmente'}
          </button>
        </form>

        {/* Estados de UI: Loading */}
        {status === 'loading' && (
          <div className="text-center py-8 text-slate-500 animate-pulse">
            {isAiSearching ? 'Interpretando endereço com Inteligência Artificial...' : 'Consultando ViaCEP e calculando resultados...'}
          </div>
        )}

        {/* Estados de UI: Vazio */}
        {status === 'empty' && (
          <div className="text-center py-8 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
            Nenhum CEP encontrado para este endereço. Verifique se o nome da rua ou cidade estão corretos.
          </div>
        )}

        {/* Estados de UI: Erro */}
        {status === 'error' && (
          <div className="text-center py-8 bg-red-50 border border-red-200 rounded-xl text-red-800">
            Houve uma falha ao conectar com o serviço. Tente novamente em instantes.
          </div>
        )}

        {/* Estados de UI: Sucesso (Lista de CEPs com Regras R4 e R8) */}
        {status === 'success' && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Resultados encontrados ({results.length})
            </h2>

            <div className="space-y-3">
              {results.map((item, index) => (
                <div
                  key={`${item.cep}-${index}`}
                  className={`p-5 rounded-2xl bg-white border transition ${item.isExactMatch
                    ? 'border-emerald-500 ring-2 ring-emerald-100 shadow-md'
                    : 'border-slate-200 shadow-sm'
                    }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      {item.isExactMatch && (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold
                            bg-emerald-100 text-emerald-800 mb-1">
                          ✓ CEP correspondente ao número {number}
                        </span>
                      )}
                      <h3 className="font-bold text-lg text-slate-900">
                        {item.logradouro}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {item.bairro} — {item.localidade}/{item.uf}
                      </p>
                      {item.complemento && (
                        <p className="text-xs text-slate-400 italic">
                          Complemento: {item.complemento}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleCopy(item.cep)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center
                          gap-2 cursor-pointer ${copiedCep === item.cep
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                        }`}
                    >
                      <span>{item.cep}</span>
                      <span>{copiedCep === item.cep ? '✓ Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  )
}
