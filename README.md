# 📍 CEPerto

> Descubra o CEP de qualquer rua ou localidade rural de forma simples, rápida e sem atritos.

O **CEPerto** nasceu para resolver a experiência burocrática dos buscadores de CEP tradicionais, que exigem preenchimento rígido de formulários, não toleram erros de digitação, falham em áreas rurais e estão cheios de CAPTCHAs.

---

## ✨ Funcionalidades

1. **Busca Inteligente por Texto Livre (com IA):** Digite um endereço completo ou parcial como *"Av Beira Mar 1200 Fortaleza CE"* ou *"Sítio Areias de Cima Tabuleiro do Norte CE"*. A IA extrai e normaliza logradouro, número, bairro, cidade e UF, mas **o CEP sempre vem de fontes de dados reais** (zero alucinação de CEP).
2. **Fallback Multi-Modelo na IA:** A função serverless tenta modelos do Google Gemini em cascata (`gemini-3.5-flash-lite` → `gemini-3.5-flash` → `gemini-3.7-flash` → `gemini-3.8-flash`) para garantir baixa latência e alta disponibilidade mesmo em picos da cota gratuita.
3. **Busca de CEPs na Zona Rural:** Suporte dedicado para localidades rurais (*Sítio, Povoado, Comunidade, Fazenda, Assentamento, Vila, Distrito, Chácara* etc.) consultando base local por UF (`public/data/rural/`), com busca por similaridade e fallback para o CEP geral do município quando a localidade não possui CEP individual.
4. **Tolerância a Erros de Digitação (Busca em Cascata):** Se a busca exata no ViaCEP não retornar resultados (ex.: *"Beira Mr"*), o sistema divide o logradouro em palavras-chave relevantes, consulta em cascata e ordena os resultados por similaridade textual (coeficiente de bigramas).
5. **Busca por Localização Atual (GPS):** Com um toque, usa geocodificação reversa (Nominatim / OpenStreetMap) para identificar sua rua, cidade e UF. Se o GPS identificar apenas o município (comum em zonas rurais), o app preenche UF e Cidade automaticamente e abre o campo de rua/localidade.
6. **Resolução de Numeração e Paridade:** Interpreta automaticamente o campo `complemento` do ViaCEP (ex.: *"de 1002 a 1500 - lado par"*, *"até 1715 - lado ímpar"*) para destacar com precisão o CEP correspondente ao número informado.
7. **Formulário Manual Sempre Disponível:** Permite buscar diretamente por UF, Cidade, Rua/Sítio e Número a qualquer momento, servindo também como fallback automático caso a cota da IA seja atingida.
8. **Cache em Memória e Rate Limiting:**
   - **No cliente (ViaCEP):** Cache em memória das consultas recentes e proteção de limite (4 buscas/min e 15 buscas/hora) para evitar bloqueio de IP pelo ViaCEP.
   - **No servidor (`/api/parse-address`):** Cache de endereços já interpretados pela IA, limite por IP (2/min, 4/hora, 6/dia) e sanitização automática de erros e chaves nos logs.
9. **Cópia em 1 Toque:** Resultado formatado no padrão `00000-000` pronto para copiar para a área de transferência.

---

## 🛠️ Tecnologias

- **Front-end:** [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) e [Vite 8](https://vite.dev/)
- **Estilização:** [Tailwind CSS v4](https://tailwindcss.com/) (tipografia com *Fraunces*, *Public Sans* e *IBM Plex Mono*)
- **Inteligência Artificial:** [Google Gen AI SDK (`@google/genai`)](https://ai.google.dev/) via Vercel Serverless Functions
- **Fontes de Dados:** [ViaCEP](https://viacep.com.br/), Base Local de CEPs Rurais por UF e [Nominatim / OpenStreetMap](https://nominatim.openstreetmap.org/)
- **Qualidade & Testes:** [Vitest](https://vitest.dev/) e [Oxlint](https://oxc.rs/)
- **Hospedagem:** [Vercel](https://vercel.com/)

---

## 📂 Estrutura do Projeto

```text
├── api/
│   └── parse-address.ts        # Serverless Function: extração de endereço via Gemini + cache e rate limit por IP
├── public/
│   └── data/rural/             # Bases JSON de CEPs rurais organizadas por UF
├── src/
│   ├── domain/
│   │   ├── cascadeSearch.ts    # Regras de busca em cascata, detecção rural e ranking por similaridade
│   │   ├── complement.ts       # Interpretação de faixas numéricas e paridade (lado par/ímpar)
│   │   └── normalize.ts        # Limpeza e normalização de texto (remoção de acentos/caixa)
│   ├── services/
│   │   ├── aiParser.ts         # Cliente para a API /api/parse-address
│   │   ├── geocoding.ts        # Geolocalização do navegador + geocodificação reversa (Nominatim)
│   │   ├── ruralCep.ts         # Busca em localidades rurais e fallback para CEP geral do município
│   │   └── viaCep.ts           # Integração com ViaCEP + cache em RAM, rate limit e cascata
│   ├── types/
│   │   └── address.ts          # Contratos e tipagens TypeScript
│   └── App.tsx                 # Interface principal e orquestração dos fluxos de busca
├── SPEC.md                     # Especificação técnica e regras de negócio do projeto
└── package.json
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 20 ou superior)
- `npm`

### Instalação

1. Clone o repositório:
   ```bash
   git clone https://github.com/SEU_USUARIO/ceperto.git
   cd ceperto
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente criando um arquivo `.env` na raiz do projeto:
   ```env
   GEMINI_API_KEY=sua_chave_do_google_ai_studio
   # Opcional: sobrescrever a ordem dos modelos de fallback separados por vírgula
   # GEMINI_MODELS=gemini-3.5-flash-lite,gemini-3.5-flash,gemini-3.7-flash
   ```

4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
   > **Dica:** Para testar também a função serverless `/api/parse-address` localmente, utilize `npx vercel dev`.

---

## 🧪 Testes e Qualidade

- **Executar testes unitários (modo watch):**
  ```bash
  npm test
  ```
- **Executar testes uma única vez (CI):**
  ```bash
  npm test -- --run
  ```
- **Verificação de tipos TypeScript e build de produção:**
  ```bash
  npm run build
  ```
- **Linter (Oxlint):**
  ```bash
  npm run lint
  ```

---

## 📄 Licença

Este projeto está sob a licença [MIT](LICENSE).
