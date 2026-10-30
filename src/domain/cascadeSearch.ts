import { cleanText } from './normalize'
import type { ViaCepResult } from '../types/address'

export function extractSearchWords(street: string): string[] {
    const ignoredWords = new Set(['rua', 'avenida', 'travessa', 'alameda', 'praca', 'dos', 'das'])
    const cleaned = cleanText(street)

    return cleaned
        .split(/\s+/)
        .filter(word => word.length >= 3 && !ignoredWords.has(word))
}

export function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i]
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1]
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                )
            }
        }
    }

    return matrix[b.length][a.length]
}

export function calculateSimilarity(str1: string, str2: string): number {
    const s1 = cleanText(str1)
    const s2 = cleanText(str2)

    if (s1 === s2) return 1.0
    const maxLen = Math.max(s1.length, s2.length)
    if (maxLen === 0) return 1.0

    const distance = levenshteinDistance(s1, s2)
    return 1 - distance / maxLen
}

export function rankResultsBySimilarity(results: ViaCepResult[], queryStreet: string): ViaCepResult[] {
    return [...results].sort((a, b) => {
        const simA = calculateSimilarity(a.logradouro, queryStreet)
        const simB = calculateSimilarity(b.logradouro, queryStreet)
        return simB - simA
    })
}
