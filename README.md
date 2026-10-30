# 📍 CEPerto

> Descubra o CEP de qualquer rua de forma simples, rápida e sem atritos.

O **CEPerto** nasceu para resolver a experiência burocrática dos buscadores de CEP tradicionais, que exigem preenchimento rígido de formulários, possuem interfaces lentas e estão cheios de CAPTCHAs.

---

## ✨ Funcionalidades

1. **Busca por Texto Livre (com IA):** Digite um endereço como *"Av Beira Mar 1200 Fortaleza"* ou *"Rua Sete de Setembro"*. A IA extrai e normaliza os dados para consulta direta em fontes oficiais de CEP.
2. **Busca por Localização Atual:** Com apenas um toque, use o GPS do seu dispositivo para descobrir a rua em que você está e listar todos os seus CEPs correspondentes.
3. **Formulário Estruturado (Fallback):** Busca manual por UF, Cidade e Logradouro disponível a qualquer momento, sem depender da IA ou de permissões.
4. **Resolução de Numeração e Lados:** Interpretação inteligente de faixas de numeração e paridade (lado par/ímpar) para destacar o CEP exato do seu número.
5. **Cópia em 1 Toque:** CEP formatado no padrão `00000-000` pronto para a área de transferência.

---

## 🛠️ Tecnologias

- **Front-end:** [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) e [Vite](https://vite.dev/)
- **Estilização:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Testes Unitários:** [Vitest](https://vitest.dev/)
- **Inteligência Artificial:** [Google Gemini API](https://ai.google.dev/) (`gemini-2.5-flash`) via Serverless Functions
- **Fontes de Dados:** [ViaCEP](https://viacep.com.br/) e [Nominatim / OpenStreetMap](https://nominatim.openstreetmap.org/)
- **Hospedagem & CI/CD:** [Vercel](https://vercel.com/) e [GitHub Actions](https://github.com/features/actions)

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

3. Configure as variáveis de ambiente:
   ```bash
   cp .env.example .env
   ```
   *(Adicione sua chave da API do Google Gemini no arquivo `.env`)*

4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

---

## 🧪 Testes e Qualidade

- **Executar testes unitários:**
  ```bash
  npm test
  ```
- **Executar testes em modo CI (uma única execução):**
  ```bash
  npm test -- --run
  ```
- **Verificação de tipagem TypeScript e Build:**
  ```bash
  npm run build
  ```
- **Linter de código:**
  ```bash
  npm run lint
  ```

---

## 📄 Licença

Este projeto está sob a licença [MIT](LICENSE).
