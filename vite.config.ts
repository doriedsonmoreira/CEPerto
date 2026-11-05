import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  process.env.GEMINI_API_KEY = env.GEMINI_API_KEY

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'local-api-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url === '/api/parse-address' && req.method === 'POST') {
              let bodyStr = ''
              req.on('data', chunk => {
                bodyStr += chunk
              })
              req.on('end', async () => {
                try {
                  const { default: handler } = await server.ssrLoadModule('/api/parse-address.ts')
                  const webReq = new Request('http://localhost/api/parse-address', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: bodyStr,
                  })
                  const webRes: Response = await handler(webReq)
                  res.statusCode = webRes.status
                  res.setHeader('Content-Type', 'application/json')
                  const json = await webRes.text()
                  res.end(json)
                } catch (err: any) {
                  res.statusCode = 500
                  res.end(JSON.stringify({ error: err.message }))
                }
              })
            } else {
              next()
            }
          })
        },
      },
    ],
  }
}) 
