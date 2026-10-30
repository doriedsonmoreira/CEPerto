# SPEC.md — CEPerto

> Documento de contexto do projeto. Agentes de IA: leiam este arquivo inteiro antes de escrever código.
> Itens marcados com `[DECIDIR]` ainda não foram definidos: **não assuma, pergunte**.

## 1. Visão

Site simples e rápido para descobrir o CEP de uma rua. Os sites existentes exigem estado e cidade, têm captcha e interface ruim. O CEPerto deve funcionar com o mínimo de informação do usuário.

## 2. Formas de busca

1. **Por texto livre (com IA):** o usuário digita algo como "av beira mar 1200 fortaleza" ou só "rua sete de setembro". Uma LLM extrai os campos estruturados e o app busca o CEP.
2. **Por localização atual:** o app pega as coordenadas, descobre a rua, cidade e UF por geocodificação reversa e lista os CEPs dessa rua.
3. **Por campos manuais (fallback):** UF, cidade e logradouro, caso a busca por texto livre falhe.

## 3. Decisões tomadas

| Tema | Decisão |
|---|---|
| Rua existente em várias cidades | Usar a localização (GPS) para descobrir/priorizar a cidade do usuário. Sem localização e sem cidade no texto, pedir UF e cidade (ver R3). IP fica fora do MVP. |
| Stack | React + TypeScript |
| IA | Também no produto (interpretação de endereço digitado livre), além do uso de agentes no desenvolvimento |

## 4. Regras de negócio

- **R1.** A LLM só **extrai e normaliza** campos do endereço (logradouro, número, bairro, cidade, UF). O CEP **sempre** vem de uma fonte de dados real, nunca é gerado pelo modelo.
- **R2.** Se houver localização do usuário, resultados da cidade/UF dele aparecem primeiro, com destaque visual.
- **R3.** Sem localização e sem cidade/UF no texto, o app **pede UF e cidade** (o ViaCEP não busca só pela rua). Se a rua existir em mais de um bairro da cidade, listar agrupado por bairro. `[DECIDIR]` geolocalização por IP como alternativa (fora do MVP).
- **R4.** Uma rua pode ter vários CEPs (lado par/ímpar e faixas de numeração, descritos no campo `complemento` do ViaCEP). Mostrar todos, exibindo o `complemento`. Se o usuário informar o número, interpretar o `complemento` (ex.: "até 1715 - lado ímpar") e destacar o CEP correspondente; se não conseguir interpretar, mostrar a lista completa.
- **R9.** Tolerância a erros (rua): se a busca completa não retornar nada, tentar em cascata cada palavra com 3+ letras do logradouro separadamente e ordenar os resultados por semelhança com o texto digitado (função própria, sem IA).
- **R10.** Tolerância a erros (cidade): corrigir o nome da cidade antes de buscar, via IA e/ou comparando com a lista de municípios da UF.
- **R11.** Chamar a IA apenas quando necessário (texto fora do formato esperado), para economizar a cota gratuita.
- **R5.** Se a LLM falhar ou estourar o tempo, cair para a busca por campos manuais, sem travar o usuário.
- **R6.** Permissão de localização negada ou indisponível **não** é erro: o app segue normalmente sem priorização.
- **R7.** Não armazenar localização nem endereços do usuário no servidor. Nada de login nem captcha.
- **R8.** CEP exibido no formato `00000-000`, com botão de copiar em um toque.

## 5. Fluxos

### 5.1 Texto livre
1. Usuário digita e envia.
2. Front chama `POST /api/parse-address` (função serverless) com o texto.
3. LLM devolve JSON `{ logradouro, numero?, bairro?, cidade?, uf? }`.
4. Se faltar cidade/UF, usar a localização do usuário (R2); se não houver, pedir UF e cidade (R3).
5. Buscar CEPs na fonte de dados e exibir a lista.

### 5.2 Localização atual
1. Usuário toca em "Usar minha localização".
2. `navigator.geolocation.getCurrentPosition` (exige HTTPS e permissão).
3. Geocodificação reversa → `{ logradouro, cidade, uf }`.
4. Buscar CEPs dessa rua e exibir.
5. Erros: permissão negada, timeout, rua não identificada → mensagem clara e sugerir busca por texto.

## 6. Fontes de dados (resultado do spike)

- **ViaCEP (principal):** busca por UF + cidade + logradouro (mín. 3 letras em cidade e logradouro, máx. 50 resultados, ordenados por proximidade do nome). **Não** aceita só a rua e **não** tolera erro de digitação (testado: "Beira Mr" retornou vazio; cidade com erro retorna erro). Uma mesma rua pode voltar com vários CEPs, diferenciados pelo campo `complemento` (ex.: "lado ímpar", "lado par", faixas de numeração). Evitar uso massivo (risco de bloqueio).
- **Nominatim (OpenStreetMap):** geocodificação reversa (`/reverse?format=jsonv2&lat=..&lon=..`). Testado: retorna `address.road`, `address.suburb`, cidade (em cidades pequenas vem como `town`; tratar também `city` e `village`) e UF em `ISO3166-2-lvl4` (formato `BR-CE`). O `postcode` costuma ser o CEP geral do município (final `-000`): **não usar** como resultado. Política de uso: poucas requisições por segundo e identificação do app.
- **BrasilAPI:** uso opcional e secundário (ex.: lista de municípios do IBGE para corrigir o nome da cidade; confirmar o endpoint antes de usar).

Pendente: confirmar CORS no navegador para ViaCEP e Nominatim.

## 7. Arquitetura (proposta)

- **Front-end:** React + TypeScript (Vite). Sem backend próprio além das funções serverless.
- **Serverless (ex.: Vercel/Netlify Functions):** `parse-address` (chama a LLM). **A chave da API da LLM nunca vai para o front-end.**
- **Camadas:** `services/` (chamadas externas) → `domain/` (regras R1–R8, funções puras) → `components/` (UI).
- **Estados de UI obrigatórios:** inicial, carregando, sucesso, vazio, erro, permissão de localização negada.

## 8. Estrutura de pastas (proposta)

```
src/
  components/
  domain/        # regras de negócio, funções puras e testáveis
  services/      # viacep, geocoding, parseAddress
  types/
api/             # funções serverless
SPEC.md
README.md
.env.example     # nomes das variáveis, sem valores
```

## 9. Modo de colaboração com agentes de IA

**O código é escrito pelo desenvolvedor, não pelo agente.** O agente atua como mentor:

- Usar o modo de planejamento. Não criar, editar nem executar nada no projeto sem pedido explícito.
- Explicar conceitos, comparar alternativas, apontar riscos e revisar o código que eu escrever.
- Quando eu pedir ajuda, preferir dicas, perguntas e trechos curtos de exemplo, em vez de entregar a solução completa.
- Se algo contradisser este SPEC, avisar antes de seguir.

### Casos de teste (resultados reais do spike)

| Entrada | Esperado |
|---|---|
| CE / Fortaleza / "Beira Mar" | Vários CEPs, com `complemento` |
| CE / Fortaleza / "Beira Mr" (erro) | Cascata (R9) deve encontrar "Beira Mar" |
| CE / "Fortalza" / "Beira Mar" (cidade errada) | Cidade corrigida (R10) e resultado normal |
| CE / Tabuleiro do Norte / "Monsenhor Otávio Santiago" | Ao menos um CEP (a cidade tem CEP por rua) |
| Coordenadas em Tabuleiro do Norte | `road`, `town`, UF `CE` extraídos; `postcode` ignorado |
| Permissão de localização negada | App segue normal e pede UF e cidade |

## 10. Convenções de código

- Português nos textos da interface; código e nomes de variáveis em inglês.
- TypeScript estrito, sem `any`. Funções pequenas e puras em `domain/`.
- Não adicionar dependências sem perguntar. Preferir APIs nativas do navegador (`fetch`, `geolocation`).
- Nunca commitar segredos. Usar `.env` (ignorado pelo git) e manter o `.env.example` atualizado.
- Não inventar endpoints nem campos de API: confirmar na documentação ou testando a resposta real.
- Mudanças de escopo: atualizar este arquivo no mesmo commit.
- Antes de implementar algo grande, propor o plano em poucas linhas e esperar confirmação.

## 11. Plano por fases

1. **Spike de dados:** testar as APIs (curl/Insomnia) e preencher a seção 6.
2. **Domínio:** funções de busca e normalização, testadas no console/testes.
3. **UI crua:** input, botão, lista e todos os estados, sem estilo.
4. **Localização:** fluxo 5.2 completo.
5. **IA:** `parse-address` + fallback (R5).
6. **Design:** wireframe e visual no Figma, depois aplicar.
7. **Polimento e deploy:** mobile, acessibilidade, README, deploy.

## 12. Fora de escopo (por enquanto)

- Conta de usuário, histórico de buscas, mapa interativo, cálculo de frete, busca reversa CEP → endereço (já existe em todo lugar).

## 13. Questões em aberto

- `[DECIDIR]` Qual fonte de dados de CEP usar (seção 6).
- `[DECIDIR]` Qual provedor/modelo de LLM e qual plano gratuito/custo aceitável.
- `[DECIDIR]` Hospedagem (Vercel, Netlify, outra).
- `[DECIDIR]` Nome final e domínio.
