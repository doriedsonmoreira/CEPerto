import { describe, it, expect } from 'vitest'
import {
    extractSearchWords,
    calculateSimilarity,
    rankResultsBySimilarity,
    isRuralSearch,
    extractRuralTargetName,
} from './cascadeSearch'
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

    describe('isRuralSearch e extractRuralTargetName (Pré-filtro Rural)', () => {
        it('deve detectar termos rurais independente de acento ou maiúsculas', () => {
            expect(isRuralSearch('Sítio Areias de Cima')).toBe(true)
            expect(isRuralSearch('Povoado da Marambaia')).toBe(true)
            expect(isRuralSearch('Avenida Beira Mar')).toBe(false)
        })

        it('não deve gerar falso positivo quando o termo é apenas substring de outra palavra', () => {
            expect(isRuralSearch('Rua Serra Dourada')).toBe(true)
            expect(isRuralSearch('Avenida Serrana')).toBe(false)
        })

        it('deve extrair apenas o nome-alvo removendo o prefixo rural e preposições iniciais', () => {
            expect(extractRuralTargetName('Sítio Areias de Cima')).toBe('areias de cima')
            expect(extractRuralTargetName('Povoado da Marambaia')).toBe('marambaia')
            expect(extractRuralTargetName('Zona Rural Barra do Feijão')).toBe('barra do feijao')
        })
    })
})
