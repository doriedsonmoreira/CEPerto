import { useState } from 'react'
import { searchAddress } from './services/viaCep'
import type { ProcessedCepResult } from './types/address'

type UiState = 'idle' | 'loading' | 'success' | 'empty' | 'error'

export default function App() {

  const [uf, setUf] = useState('CE')
  const [city, setCity] = useState('Fortaleza')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')

  const [status, setStatus] = useState<UiState>('idle')
  const [results, setResults] = useState<ProcessedCepResult[]>([])
  const [copiedCep, setCopiedCep] = useState<string | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!street.trim() || !city.trim() || uf.length !== 2) return

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

  function handleCopy(cep: string) {
    navigator.clipboard.writeText(cep)
    setCopiedCep(cep)
    setTimeout(() => setCopiedCep(null), 2000)
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-8">

        <header className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-blue-600">
            CEPerto 📍
          </h1>
          <p className="text-slate-600">
            Descubra o CEP de forma rápida, simples e sem burocracia.
          </p>
        </header>

        <form onSubmit={handleSearch} className="bg-white p-6 rounded-2xl shadow-sm border
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
                Rua / Logradouro
              </label>
              <input
                type="text"
                value={street}
                onChange={e => setStreet(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2
                    focus:ring-blue-500 focus:outline-none"
                placeholder="Ex: Beira Mar"
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

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl
                transition shadow-sm hover:shadow disabled:opacity-50 cursor-pointer"
          >
            {status === 'loading' ? 'Buscando...' : 'Buscar CEP'}
          </button>
        </form>

        {status === 'loading' && (
          <div className="text-center py-8 text-slate-500 animate-pulse">
            Consultando ViaCEP e calculando similaridade...
          </div>
        )}

        {status === 'empty' && (
          <div className="text-center py-8 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
            Nenhum CEP encontrado para este endereço. Verifique o nome da rua ou cidade.
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-8 bg-red-50 border border-red-200 rounded-xl text-red-800">
            Houve uma falha ao conectar com o serviço. Tente novamente em instantes.
          </div>
        )}

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
