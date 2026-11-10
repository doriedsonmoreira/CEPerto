
import type { ViaCepResult, ProcessedCepResult } from '../types/address'
import { isNumberInComplement } from '../domain/complement'
import { extractSearchWords, rankResultsBySimilarity, isRuralSearch } from '../domain/cascadeSearch'
import { searchRuralAddress } from './ruralCep'

export interface SearchAddressParams {
    uf: string
    city: string
    street: string
    number?: string
}

const VIACEP_LIMIT_PER_MINUTE = 4
const VIACEP_LIMIT_PER_HOUR = 15
const MAX_CASCADE_WORDS = 3

const ONE_MINUTE_MS = 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000

// 1. ONDE FICA O CACHE: um Map guardado na memória RAM da aba do navegador
const viaCepCache = new Map<string, ViaCepResult[]>()

// Guarda os horários (timestamps) das buscas feitas no ViaCEP para o Rate Limit
let viaCepSearchTimestamps: number[] = []

export class ViaCepRateLimitError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ViaCepRateLimitError'
    }
}

function checkViaCepRateLimit(): void {
    const now = Date.now()

    // Limpa registros com mais de 1 hora
    viaCepSearchTimestamps = viaCepSearchTimestamps.filter(t => now - t < ONE_HOUR_MS)
    const lastMinuteHits = viaCepSearchTimestamps.filter(t => now - t < ONE_MINUTE_MS)

    if (viaCepSearchTimestamps.length >= VIACEP_LIMIT_PER_HOUR) {
        throw new ViaCepRateLimitError(
            'Limite de 15 consultas por hora no ViaCEP atingido para evitar bloqueio do seu IP. Aguarde alguns minutos.'
        )
    }

    if (lastMinuteHits.length >= VIACEP_LIMIT_PER_MINUTE) {
        throw new ViaCepRateLimitError(
            'Muitas buscas seguidas! Limite de 4 consultas por minuto no ViaCEP atingido. Aguarde alguns segundos.'
        )
    }

    viaCepSearchTimestamps.push(now)
}

export async function fetchViaCep(uf: string, city: string, street: string): Promise<ViaCepResult[]> {
    const cleanUf = uf.trim().toUpperCase()
    const cleanCity = city.trim()
    const cleanStreet = street.trim()

    if (cleanUf.length !== 2 || cleanCity.length < 3 || cleanStreet.length < 3) {
        return []
    }

    // 2. CHAVE DO CACHE: junta UF + Cidade + Rua em minúsculo (ex: "ce|fortaleza|beira mar")
    const cacheKey = `${cleanUf}|${cleanCity.toLowerCase()}|${cleanStreet.toLowerCase()}`

    // 3. CONSULTA AO CACHE: se já buscamos isso antes, devolve da memória na hora (sem chamar a internet!)
    if (viaCepCache.has(cacheKey)) {
        return viaCepCache.get(cacheKey)!
    }

    const url = `https://viacep.com.br/ws/${cleanUf}/${encodeURIComponent(cleanCity)}/${encodeURIComponent(cleanStreet)}/json/`

    try {
        const response = await fetch(url)
        if (!response.ok) return []

        const data = await response.json()
        const results: ViaCepResult[] = Array.isArray(data) ? data : []

        // 4. SALVANDO NO CACHE: guarda o resultado na memória para as próximas vezes
        viaCepCache.set(cacheKey, results)

        return results
    } catch (error) {
        console.error('Erro ao consultar ViaCEP:', error)
        return []
    }
}

export async function searchAddress(params: SearchAddressParams): Promise<ProcessedCepResult[]> {
    const { uf, city, street, number } = params

    let rawResults: ViaCepResult[] = []

    // Pré-filtro Rural: se o usuário incluiu termos como "sítio", "povoado", "comunidade", etc.,
    // consulta primeiro a base rural do projeto (não gasta limite do ViaCEP!).
    if (isRuralSearch(street)) {
        rawResults = await searchRuralAddress(uf, city, street)
    }

    // Busca Urbana Padrão no ViaCEP (ou fallback caso o pré-filtro rural não tenha retornado nada)
    if (rawResults.length === 0) {
        // Verifica se esta busca exata já não está no cache antes de descontar do Rate Limit
        const exactKey = `${uf.trim().toUpperCase()}|${city.trim().toLowerCase()}|${street.trim().toLowerCase()}`
        if (!viaCepCache.has(exactKey)) {
            checkViaCepRateLimit()
        }

        rawResults = await fetchViaCep(uf, city, street)

        if (rawResults.length === 0) {
            // Limita a cascata a no máximo 3 palavras para não metralhar o ViaCEP
            const candidateWords = extractSearchWords(street).slice(0, MAX_CASCADE_WORDS)

            for (const word of candidateWords) {
                const cascadeResults = await fetchViaCep(uf, city, word)
                if (cascadeResults.length > 0) {
                    rawResults = rankResultsBySimilarity(cascadeResults, street)
                    break
                }
            }
        }

        // Último fallback: se mesmo após a cascata o ViaCEP retornou vazio, tenta na base rural
        if (rawResults.length === 0) {
            rawResults = await searchRuralAddress(uf, city, street)
        }
    }

    if (rawResults.length === 0) {
        return []
    }

    const userNum = number ? parseInt(number, 10) : NaN

    const processedResults: ProcessedCepResult[] = rawResults.map(item => {
        const isExactMatch = !isNaN(userNum) ? isNumberInComplement(item.complemento, userNum) : false
        return {
            ...item,
            isExactMatch,
        }
    })

    if (!isNaN(userNum)) {
        processedResults.sort((a, b) => (b.isExactMatch ? 1 : 0) - (a.isExactMatch ? 1 : 0))
    }

    return processedResults
}

