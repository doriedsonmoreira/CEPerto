import { cleanText } from '../domain/normalize'
import { calculateSimilarity, extractRuralTargetName } from '../domain/cascadeSearch'
import type { ViaCepResult } from '../types/address'


export type RuralLocalityTuple = [string] | [string, string] | [string, string, string]

export interface RuralMunicipalityData {
    cep: string
    locs: RuralLocalityTuple[]
}

export type RuralStateData = Record<string, RuralMunicipalityData>


function formatCep(rawCep: string): string {
    const digits = rawCep.replace(/\D/g, '')
    if (digits.length !== 8) return rawCep
    return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export async function fetchRuralStateData(uf: string): Promise<RuralStateData | null> {
    const cleanUF = uf.trim().toLowerCase()
    if (cleanUF.length !== 2) return null

    const path = `/data/rural/${cleanUF}.json`

    try {
        const response = await fetch(path)
        if (!response.ok) return null

        const data: RuralStateData = await response.json()
        return data
    } catch (error) {
        console.error('Erro ao consultar base de dados rurais:', error)
        return null
    }
}

export async function searchRuralAddress(
    uf: string,
    city: string,
    street: string
): Promise<ViaCepResult[]> {

    const stateData = await fetchRuralStateData(uf)
    if (!stateData) {
        return []
    }


    const cleanCityInput = cleanText(city)
    let matchedCityName = ''

    for (const cityName of Object.keys(stateData)) {
        if (cleanText(cityName) === cleanCityInput) {
            matchedCityName = cityName
            break
        }
    }

    if (!matchedCityName) {
        return []
    }

    const cityData = stateData[matchedCityName]

    const targetName = extractRuralTargetName(street)
    const fullCleanStreet = cleanText(street)

    if (targetName.length < 2) {
        return []
    }

    const matches: { item: ViaCepResult; score: number; isSpecificCep: boolean }[] = []

    for (const locTuple of cityData.locs) {
        const localityName = locTuple[0]
        const districtName = locTuple[1] || ''
        const rawCep = locTuple[2] || cityData.cep

        const cleanLocality = cleanText(localityName)

        const scoreWithoutPrefix = calculateSimilarity(cleanLocality, targetName)
        const scoreFull = calculateSimilarity(cleanLocality, fullCleanStreet)
        let bestScore = Math.max(scoreWithoutPrefix, scoreFull)

        if (cleanLocality.includes(targetName) && bestScore < 0.75) {
            bestScore = 0.75
        }

        if (bestScore >= 0.6) {
            const isSpecificCep = !rawCep.endsWith('000')
            const isDistrictCep = rawCep !== cityData.cep && rawCep.endsWith('000')

            let complemento = 'Zona Rural (CEP geral do município)'
            if (isSpecificCep) {
                complemento = 'Zona Rural (CEP específico da localidade)'
            } else if (isDistrictCep) {
                complemento = 'Zona Rural (CEP específico do distrito)'
            }

            const bairro = districtName ? `Distrito: ${districtName}` : 'Zona Rural'

            matches.push({
                score: bestScore,
                isSpecificCep,
                item: {
                    cep: formatCep(rawCep),
                    logradouro: localityName,
                    complemento,
                    bairro,
                    localidade: matchedCityName,
                    uf: uf.trim().toUpperCase(),
                },
            })
        }
    }

    matches.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score
        }
        return (b.isSpecificCep ? 1 : 0) - (a.isSpecificCep ? 1 : 0)
    })

    return matches.slice(0, 20).map(match => match.item)
}
