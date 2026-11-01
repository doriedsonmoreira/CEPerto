import { describe, it, expect } from 'vitest'
import { extractSearchWords, calculateSimilarity, rankResultsBySimilarity } from './cascadeSearch'
import type { ViaCepResult } from '../types/address'

describe('cascadeSearch (Regra R9 - Tolerância a erros)', () => {
    describe('extractSearchWords', () => {
        it('deve extrair palavras com 3+ letras ignorando prefixos de rua e conectivos', () => {
            const words = extractSearchWords('Avenida Beira Mar')
            expect(words).toEqual(['beira', 'mar'])
        })

        it('deve ignorar conectivos curtos como "de", "do", "da"', () => {
            const words = extractSearchWords('Rua Sete de Setembro')
            expect(words).toEqual(['sete', 'setembro'])
        })
    })

    describe('calculateSimilarity', () => {
        it('deve retornar 1.0 para textos idênticos', () => {
            expect(calculateSimilarity('Beira Mar', 'beira mar')).toBe(1.0)
        })

        it('deve dar alta pontuação (> 0.8) para pequenos erros de digitação', () => {
            const score = calculateSimilarity('Beira Mr', 'Beira Mar')
            expect(score).toBeGreaterThan(0.8)
        })

        it('deve dar pontuação maior para o match mais próximo', () => {
            const matchCorreto = calculateSimilarity('Beira Mr', 'Avenida Beira Mar')
            const matchDistante = calculateSimilarity('Beira Mr', 'Rua das Flores')

            expect(matchCorreto).toBeGreaterThan(matchDistante)
        })
    })

    describe('rankResultsBySimilarity', () => {
        it('deve ordenar colocando o resultado mais parecido no topo', () => {
            const mockResults: ViaCepResult[] = [
                {
                    cep: '60000-002', logradouro: 'Rua Beira Rio', bairro: 'Centro', localidade: 'Fortaleza', uf:
                        'CE', complemento: ''
                },
                {
                    cep: '60000-001', logradouro: 'Avenida Beira Mar', bairro: 'Meireles', localidade: 'Fortaleza',
                    uf: 'CE', complemento: ''
                },
                {
                    cep: '60000-003', logradouro: 'Rua das Flores', bairro: 'Aldeota', localidade: 'Fortaleza', uf:
                        'CE', complemento: ''
                },
            ]

            const ranked = rankResultsBySimilarity(mockResults, 'Beira Mr')


            expect(ranked[0].logradouro).toBe('Avenida Beira Mar')
        })
    })
})
