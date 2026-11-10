
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

export async function fetchViaCep(uf: string, city: string, street: string): Promise<ViaCepResult[]> {
    const cleanUf = uf.trim().toUpperCase()
    const cleanCity = city.trim()
    const cleanStreet = street.trim()


    if (cleanUf.length !== 2 || cleanCity.length < 3 || cleanStreet.length < 3) {
        return []
    }

    const url = `https://viacep.com.br/ws/${cleanUf}/${encodeURIComponent(cleanCity)}/${encodeURIComponent(cleanStreet)}/json/`

    try {
        const response = await fetch(url)
        if (!response.ok) return []

        const data = await response.json()
        return Array.isArray(data) ? data : []
    } catch (error) {
        console.error('Erro ao consultar ViaCEP:', error)
        return []
    }



}

export async function searchAddress(params: SearchAddressParams): Promise<ProcessedCepResult[]> {
    const { uf, city, street, number } = params

    let rawResults: ViaCepResult[] = []

    // Pré-filtro Rural: se o usuário incluiu termos como "sítio", "povoado", "comunidade", etc.,
    // consulta primeiro a base rural do projeto e combina com o ViaCEP se houver homônimo urbano.
    if (isRuralSearch(street)) {
        const ruralResults = await searchRuralAddress(uf, city, street)
        const urbanExactResults = await fetchViaCep(uf, city, street)
        rawResults = [...ruralResults, ...urbanExactResults]
    }

    // Busca Urbana Padrão (ou fallback caso o pré-filtro rural não tenha retornado nada)
    if (rawResults.length === 0) {
        rawResults = await fetchViaCep(uf, city, street)

        if (rawResults.length === 0) {
            const candidateWords = extractSearchWords(street)

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

