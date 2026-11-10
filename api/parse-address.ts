import { GoogleGenAI, Type } from '@google/genai'

const MAX_TEXT_LENGTH = 150
const LIMIT_PER_MINUTE = 2
const LIMIT_PER_HOUR = 4
const LIMIT_PER_DAY = 6

const ONE_MINUTE_MS = 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

// Mantém os contadores por IP e o cache em globalThis para persistir entre chamadas
const globalStore = globalThis as unknown as {
    __cepertoIpHits?: Map<string, number[]>
    __cepertoAiCache?: Map<string, Record<string, unknown>>
}

const ipHits = globalStore.__cepertoIpHits ?? (globalStore.__cepertoIpHits = new Map<string, number[]>())
const aiCache = globalStore.__cepertoAiCache ?? (globalStore.__cepertoAiCache = new Map<string, Record<string, unknown>>())

function getClientIp(req: Request): string {
    const forwarded = req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-forwarded-for')
    if (forwarded) {
        return forwarded.split(',')[0].trim()
    }
    return req.headers.get('x-real-ip') || 'local-client'
}

function checkRateLimit(ip: string): string | null {
    const now = Date.now()
    const previousHits = ipHits.get(ip) || []

    // Mantém apenas os registros das últimas 24 horas
    const hitsLastDay = previousHits.filter(timestamp => now - timestamp < ONE_DAY_MS)
    const hitsLastHour = hitsLastDay.filter(timestamp => now - timestamp < ONE_HOUR_MS)
    const hitsLastMinute = hitsLastHour.filter(timestamp => now - timestamp < ONE_MINUTE_MS)

    if (hitsLastDay.length >= LIMIT_PER_DAY) {
        return 'Você atingiu o limite diário (6 buscas/dia) da busca com IA. Você pode continuar buscando normalmente pelos campos manuais abaixo ou usando sua localização atual!'
    }
    if (hitsLastHour.length >= LIMIT_PER_HOUR) {
        return 'Você atingiu o limite por hora (4 buscas/hora) da busca com IA. Você pode buscar pelos campos manuais abaixo ou usando sua localização atual!'
    }
    if (hitsLastMinute.length >= LIMIT_PER_MINUTE) {
        return 'Você atingiu o limite por minuto (2 buscas/minuto) da busca com IA. Aguarde um instante ou busque pelos campos manuais abaixo ou usando sua localização atual!'
    }

    hitsLastDay.push(now)
    ipHits.set(ip, hitsLastDay)
    return null
}

interface VercelNodeRequest {
    method?: string
    headers?: Record<string, string | string[] | undefined>
    body?: unknown
}

interface VercelNodeResponse {
    statusCode: number
    setHeader: (name: string, value: string) => void
    end: (body: string) => void
}

async function handleWebRequest(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Método não permitido' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    try {
        const body = await req.json()
        const rawText = body?.text

        if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
            return new Response(JSON.stringify({ error: 'Texto não fornecido' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        const text = rawText.trim()

        if (text.length > MAX_TEXT_LENGTH) {
            return new Response(
                JSON.stringify({ error: `O endereço deve ter no máximo ${MAX_TEXT_LENGTH} caracteres.` }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                },
            )
        }

        const cacheKey = text.toLowerCase()
        const cachedResult = aiCache.get(cacheKey)
        if (cachedResult) {
            return new Response(JSON.stringify({ ...cachedResult, cached: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        const clientIp = getClientIp(req)
        const rateLimitMessage = checkRateLimit(clientIp)
        if (rateLimitMessage) {
            return new Response(
                JSON.stringify({ error: rateLimitMessage, rateLimited: true }),
                {
                    status: 429,
                    headers: { 'Content-Type': 'application/json' },
                },
            )
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

        const formatSafeError = (err: unknown): string => {
            const status = (err as { status?: number })?.status ?? (err as { code?: number })?.code ?? 'unknown'
            const rawMsg = err instanceof Error ? err.message : 'Erro inesperado'
            // Remove qualquer chave acidentalmente presente em URLs ou mensagens de erro
            const cleanMsg = rawMsg.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_KEY]')
            return `[status=${status}] ${cleanMsg.slice(0, 200)}`
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
                aiCache.set(cacheKey, { ...parsedData, model })

                return new Response(JSON.stringify({ ...parsedData, model }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                })
            } catch (error) {
                lastError = error
                console.warn(`Modelo ${model} falhou, tentando próximo:`, formatSafeError(error))
                if (!isRetriable(error)) break
                // transitório: continua para o próximo modelo da lista
            }
        }

        console.error('Erro na API parse-address (todos os modelos falharam):', formatSafeError(lastError))
        const unavailable = isRetriable(lastError)
        return new Response(
            JSON.stringify({
                error: unavailable
                    ? 'O limite de uso da IA foi atingido no momento. Você pode buscar normalmente pelos campos manuais abaixo ou usando sua localização atual!'
                    : 'Falha ao processar endereço com IA. Utilize os campos manuais abaixo ou sua localização atual.',
            }),
            {
                status: unavailable ? 429 : 500,
                headers: { 'Content-Type': 'application/json' },
            },
        )
    } catch (error) {
        const safeMsg = error instanceof Error ? error.message.slice(0, 200) : 'Erro inesperado'
        console.error('Erro na API parse-address:', safeMsg)
        return new Response(JSON.stringify({ error: 'Falha ao processar endereço com IA' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}

// Compatível tanto com Web Request/Response (Vite local / Edge) quanto com Node (req, res) da Vercel
export default async function handler(
    req: Request | VercelNodeRequest,
    res?: VercelNodeResponse
): Promise<Response | void> {
    if (typeof (req as Request).json === 'function' && !res) {
        return handleWebRequest(req as Request)
    }

    const nodeReq = req as VercelNodeRequest
    const headers = new Headers()
    if (nodeReq.headers) {
        for (const [key, value] of Object.entries(nodeReq.headers)) {
            if (typeof value === 'string') headers.set(key, value)
            else if (Array.isArray(value)) headers.set(key, value.join(', '))
        }
    }

    const bodyStr =
        typeof nodeReq.body === 'string'
            ? nodeReq.body
            : JSON.stringify(nodeReq.body ?? {})

    const webReq = new Request('http://localhost/api/parse-address', {
        method: nodeReq.method || 'POST',
        headers,
        body: nodeReq.method === 'POST' ? bodyStr : undefined,
    })

    const webRes = await handleWebRequest(webReq)
    const responseText = await webRes.text()

    if (res) {
        res.statusCode = webRes.status
        res.setHeader('Content-Type', 'application/json')
        res.end(responseText)
        return
    }

    return new Response(responseText, {
        status: webRes.status,
        headers: { 'Content-Type': 'application/json' },
    })
}
