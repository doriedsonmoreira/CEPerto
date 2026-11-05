export interface ParsedAddress {
    logradouro: string
    numero?: string
    bairro?: string
    cidade?: string
    uf?: string
}

export async function parseAddressWithAi(text: string): Promise<ParsedAddress | null> {
    if (!text || !text.trim()) return null

    try {
        const controller = new AbortController()
        // 20s: o servidor tenta até 3 modelos em cascata (503 transitório),
        // então o cliente precisa dar tempo para todos terminarem antes de abortar (R5).
        const timeoutId = setTimeout(() => controller.abort(), 20000)

        const response = await fetch('/api/parse-address', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text.trim() }),
            signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) return null

        const data = await response.json()
        if (!data.logradouro) return null

        return {
            logradouro: data.logradouro,
            numero: data.numero || undefined,
            bairro: data.bairro || undefined,
            cidade: data.cidade || undefined,
            uf: data.uf ? data.uf.toUpperCase() : undefined,
        }
    } catch (error) {
        console.warn('Falha ou timeout na IA, acionando fallback manual:', error)
        return null
    }
}
