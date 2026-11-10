import { GoogleGenAI, Type } from '@google/genai'

export default async function handler(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Método não permitido' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    try {
        const body = await req.json()
        const text = body?.text

        if (!text || typeof text !== 'string') {
            return new Response(JSON.stringify({ error: 'Texto não fornecido' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        const apiKey = process.env.GEMINI_API_KEY
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'Chave GEMINI_API_KEY não configurada' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        const ai = new GoogleGenAI({ apiKey })

        const prompt = `Você é um especialista em endereços do Brasil. Extraia os componentes do seguinte
        endereço digitado livremente por um usuário:
    "${text}"

    Regras:
    1. Extraia o logradouro (nome da rua/avenida sem número e sem cidade).
    2. Se houver número do imóvel, extraia apenas os dígitos.
    3. Se houver bairro, cidade ou sigla de UF (2 letras), extraia-os.
    4. NUNCA invente informações. Se cidade ou UF não estiverem no texto, deixe em branco.
    5. NUNCA gere CEP.`

        // Fallback automático: se um modelo estiver indisponível (ex.: 503
        // "high demand" no tier gratuito), tenta o próximo antes de falhar.
        // A ordem pode ser ajustada via env GEMINI_MODELS="a,b,c".
        // gemini-3.8-flash foi removido: modelo novo, com pico recorrente no gratuito.
        const MODELS_FALLBACK = [
            'gemini-3.5-flash-lite',
            'gemini-3.5-flash',
            'gemini-3.7-flash',
            'gemini-3.8-flash',
        ]
        const models = process.env.GEMINI_MODELS
            ? process.env.GEMINI_MODELS.split(',').map(m => m.trim()).filter(Boolean)
            : MODELS_FALLBACK

        const isRetriable = (error: unknown): boolean => {
            const status = (error as { status?: number })?.status
            const code = (error as { code?: number })?.code
            const message = String((error as { message?: string })?.message ?? '')
            return (
                status === 404 || status === 503 || status === 429 || status === 500 || status === 502 || status === 504 ||
                code === 404 || code === 503 || code === 429 ||
                message.includes('NOT_FOUND') ||
                message.includes('UNAVAILABLE') ||
                message.includes('RESOURCE_EXHAUSTED') ||
                message.includes('high demand') ||
                message.includes('429')
            )
        }

        let lastError: unknown = null

        for (const model of models) {
            try {
                const result = await ai.models.generateContent({
                    model,
                    contents: prompt,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                logradouro: { type: Type.STRING, description: 'Nome da rua ou avenida' },
                                numero: { type: Type.STRING, description: 'Número do imóvel' },
                                bairro: { type: Type.STRING, description: 'Bairro' },
                                cidade: { type: Type.STRING, description: 'Nome da cidade' },
                                uf: { type: Type.STRING, description: 'Sigla do estado com 2 letras' },
                            },
                            required: ['logradouro'],
                        },
                    },
                })

                const parsedData = JSON.parse(result.text || '{}')

                return new Response(JSON.stringify({ ...parsedData, model }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                })
            } catch (error) {
                lastError = error
                console.warn(`Modelo ${model} falhou, tentando próximo:`, error)
                if (!isRetriable(error)) break
                // transitório: continua para o próximo modelo da lista
            }
        }

        console.error('Erro na API parse-address (todos os modelos falharam):', lastError)
        const unavailable = isRetriable(lastError)
        return new Response(
            JSON.stringify({
                error: unavailable
                    ? 'Serviço de IA temporariamente indisponível'
                    : 'Falha ao processar endereço com IA',
            }),
            {
                status: unavailable ? 503 : 500,
                headers: { 'Content-Type': 'application/json' },
            },
        )
    } catch (error) {
        console.error('Erro na API parse-address:', error)
        return new Response(JSON.stringify({ error: 'Falha ao processar endereço com IA' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}
