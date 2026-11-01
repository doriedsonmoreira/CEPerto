
import type { ViaCepResult, ProcessedCepResult } from '../types/address'
import { isNumberInComplement } from '../domain/complement'
import { extractSearchWords, rankResultsBySimilarity } from '../domain/cascadeSearch'

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

    let rawResults = await fetchViaCep(uf, city, street)

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

