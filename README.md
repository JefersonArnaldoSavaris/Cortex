# Cortex

Framework financeiro multiagente com LLM, API FastAPI e aplicação web Next.js
para pesquisa de mercado, análise de oportunidades, gestão de risco e integração
com MetaTrader 5.

> **Aviso:** o Cortex é um projeto de pesquisa e desenvolvimento. As análises,
> sinais e simulações não constituem recomendação financeira. Operações reais
> envolvem risco e permanecem desabilitadas por padrão.

## Visão geral

O Cortex organiza uma análise financeira como o trabalho de uma equipe
especializada. Analistas produzem evidências, pesquisadores debatem cenários,
um agente trader formula a operação e a camada de risco e portfólio consolida a
decisão.

Além da CLI original, o repositório inclui:

- aplicação web em Next.js;
- API REST e WebSocket em FastAPI;
- autenticação e persistência por usuário;
- PostgreSQL para ambientes compartilhados e SQLite para desenvolvimento;
- pesquisa de ativos e favoritos;
- dados de mercado por Yahoo Finance, Twelve Data e MetaTrader 5;
- estratégias de Day Trade e Swing Trade, incluindo Smart Money Concepts;
- prévia, envio, acompanhamento e encerramento de ordens via MT5;
- persistência do contexto técnico e de risco associado às operações.

## Arquitetura

```text
apps/web (Next.js)
        |
        | HTTP / WebSocket
        v
apps/api (FastAPI) -------- PostgreSQL / SQLite
        |
        +---- CortexGraph e agentes LLM
        +---- Trading Opportunities
        +---- Yahoo Finance / Twelve Data
        +---- MetaTrader 5 / MT5 Bridge
```

### Agentes

- **Fundamentals Analyst:** demonstrações, métricas, valor e sinais de alerta.
- **Sentiment Analyst:** humor de mercado e sinais de curto prazo.
- **News Analyst:** notícias, eventos e contexto macroeconômico.
- **Technical Analyst:** preço, volume e indicadores técnicos.
- **Bull/Bear Researchers:** debate estruturado dos cenários favorável e adverso.
- **Trader:** consolidação da tese e proposta operacional.
- **Risk Team:** avaliação de volatilidade, liquidez e exposição.
- **Portfolio Manager:** aprovação ou rejeição e registro da decisão final.

## Requisitos

- Python 3.13 recomendado;
- Node.js 20 ou superior;
- PostgreSQL para o ambiente compartilhado, ou SQLite para desenvolvimento local;
- terminal MetaTrader 5 no Windows para integração direta com a corretora;
- ao menos uma chave de provedor de LLM para análises com modelos externos.

## Instalação

```bash
git clone https://github.com/JefersonArnaldoSavaris/Cortex.git
cd Cortex
python -m venv .venv
```

Ative o ambiente virtual.

Linux ou macOS:

```bash
source .venv/bin/activate
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Instale o backend e a CLI:

```bash
pip install .
```

Instale o frontend:

```bash
cd apps/web
npm install
cd ../..
```

## Configuração

Copie o arquivo de exemplo e preencha somente as integrações utilizadas:

```bash
cp .env.example .env
```

No PowerShell:

```powershell
Copy-Item .env.example .env
```

### Modelos de linguagem

O Cortex suporta OpenAI, Google, Anthropic, xAI, DeepSeek, Qwen, GLM,
OpenRouter, Ollama, Azure OpenAI e AWS Bedrock. Exemplos:

```dotenv
OPENAI_API_KEY=
GOOGLE_API_KEY=
ANTHROPIC_API_KEY=
XAI_API_KEY=
DEEPSEEK_API_KEY=
DASHSCOPE_API_KEY=
ZHIPU_API_KEY=
OPENROUTER_API_KEY=
```

Para Azure e Bedrock, use também `.env.enterprise.example` como referência.

### Banco de dados

SQLite local:

```dotenv
CORTEX_DATABASE_URL=sqlite:///./cortex_app.db
```

PostgreSQL externo:

```dotenv
CORTEX_DATABASE_URL=postgresql://usuario:senha@host:5432/banco
```

`DATABASE_URL` também é aceito, mas `CORTEX_DATABASE_URL` tem prioridade. No
PostgreSQL, a aplicação mantém as tabelas no schema `cortex` e preserva
compatibilidade com instalações anteriores no schema `public`.

Opções de pool:

```dotenv
CORTEX_DB_POOL_SIZE=5
CORTEX_DB_MAX_OVERFLOW=5
CORTEX_DB_POOL_RECYCLE_SECONDS=300
```

### Dados de mercado

Yahoo Finance funciona como fonte gratuita padrão. Para REST e WebSocket em
tempo real via Twelve Data:

```dotenv
TWELVE_DATA_API_KEY=
```

### Autenticação

Configure um segredo forte para os tokens de sessão:

```dotenv
CORTEX_AUTH_SECRET=
CORTEX_AUTH_COOKIE_SECURE=false
CORTEX_AUTH_COOKIE_SAMESITE=lax
```

Quando frontend e API estiverem em domínios HTTPS diferentes, use:

```dotenv
CORTEX_AUTH_COOKIE_SECURE=true
CORTEX_AUTH_COOKIE_SAMESITE=none
CORTEX_CORS_ORIGINS=https://seu-frontend.vercel.app
```

`CORTEX_CORS_ORIGINS` aceita múltiplas origens separadas por vírgula. Informe
origens exatas, sem caminho, e não use `*` com autenticação por cookie.

### MetaTrader 5

A API pode acessar diretamente o terminal MT5 no Windows. Quando o terminal
estiver em outra máquina, configure o bridge:

```dotenv
CORTEX_MT5_BRIDGE_URL=
CORTEX_BROKER_CREDENTIALS_KEY=
```

Operações reais são bloqueadas por padrão. A habilitação deve ser intencional:

```dotenv
CORTEX_LIVE_TRADING_ENABLED=false
```

Mantenha esse valor como `false` até revisar credenciais, conta, permissões,
volume, stops e limites de risco.

## Executar a aplicação

### Backend

Na raiz do projeto:

```bash
uvicorn apps.api.cortex_api.main:app --reload --host 127.0.0.1 --port 8000
```

Valide:

```text
http://127.0.0.1:8000/health
```

### Frontend

Em outro terminal:

```bash
cd apps/web
npm run dev
```

Acesse:

```text
http://127.0.0.1:3000
```

Por padrão, o frontend usa `http://localhost:8000`. Para alterar:

```dotenv
NEXT_PUBLIC_CORTEX_API_URL=http://127.0.0.1:8000
```

## Deploy na Vercel

Use dois projetos Vercel conectados ao mesmo repositório:

### Frontend

- Root Directory: `apps/web`
- Framework Preset: Next.js
- Production Branch: `main`
- `NEXT_PUBLIC_CORTEX_API_URL=https://seu-backend.vercel.app`

### API

- Root Directory: raiz do repositório
- Framework Preset: Other
- Production Branch: `main`
- entrypoint: `api/index.py`

O arquivo `vercel.json` encaminha as rotas para a aplicação FastAPI. Configure
no projeto da API, no mínimo:

```dotenv
CORTEX_DATABASE_URL=postgresql://...
CORTEX_AUTH_SECRET=...
CORTEX_AUTH_COOKIE_SECURE=true
CORTEX_AUTH_COOKIE_SAMESITE=none
CORTEX_CORS_ORIGINS=https://seu-frontend.vercel.app
```

Adicione também as chaves dos provedores utilizados. O terminal MetaTrader 5
não executa dentro do runtime Linux da Vercel; para MT5, configure
`CORTEX_MT5_BRIDGE_URL` apontando para um bridge Windows acessível pela API.

## Docker

A imagem principal executa a CLI:

```bash
docker compose run --rm cortex
```

Para modelos locais com Ollama:

```bash
docker compose --profile ollama run --rm cortex-ollama
```

O arquivo `.env` deve existir antes de iniciar os serviços.

## Aplicação web

O produto web reúne:

- cadastro, login, logout e recuperação de senha;
- seleção de ativo, data, provedor, modelos e profundidade da pesquisa;
- histórico e relatório das análises;
- busca e favoritos por usuário;
- gráfico de mercado com atualização por WebSocket;
- oportunidades de Day Trade e Swing Trade;
- seleção de estratégia e perfil de risco;
- conexão individual ao MT5;
- posições abertas e ordens pendentes;
- prévia de volume, risco, stop e take profit antes do envio;
- execução, cancelamento e encerramento quando o trading real está habilitado.

## Trading Opportunities

O módulo gera sinais técnicos estruturados, sem executar ordens por conta
própria. A resposta inclui:

- direção planejada e direção confirmada;
- confiança e nome do setup;
- preço ou zona de entrada;
- stop loss e take profit;
- relação risco/retorno;
- tamanho da posição e perda máxima;
- critérios de invalidação e alertas;
- indicação explícita de prontidão para execução.

Exemplo pela CLI:

```bash
cortex opportunities \
  --symbol SPY \
  --strategy-type daytrade \
  --timeframe M15 \
  --provider mock
```

As estratégias disponíveis são expostas pela API e incluem o fluxo clássico
automático e Smart Money Concepts (SMC). Consulte
[`docs/trading_opportunities.md`](docs/trading_opportunities.md) para detalhes.

## API

Principais grupos de endpoints:

| Grupo | Rotas |
|---|---|
| Saúde | `GET /health` |
| Autenticação | `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`, `/auth/forgot-password` |
| Configuração | `GET /config/options` |
| Ativos | `GET /assets`, `/assets/search`, `/assets/{symbol}/history`, `/assets/{symbol}/tick` |
| Favoritos | `GET/PUT/DELETE /favorites` e `/favorites/mt5` |
| Análises | `POST/GET /analyses`, `GET /analyses/{id}`, `GET /analyses/{id}/report` |
| Oportunidades | `POST /opportunities/analyze`, `GET /opportunities/strategies` |
| MT5 | `/integrations/mt5/connect`, `/disconnect`, `/status`, `/symbols` |
| Ordens | `/orders/preview`, `/execute`, `/close`, `/open`, `/status` |
| Pendentes | `/orders/pending/preview`, `/execute`, `/cancel`, `GET /orders/pending` |
| Tempo real | `WS /ws/market-data` |

A documentação OpenAPI fica disponível, durante o desenvolvimento, em:

```text
http://127.0.0.1:8000/docs
```

As rotas de produto, exceto saúde e autenticação, exigem sessão válida.

## CLI de análise multiagente

Inicie a interface interativa:

```bash
cortex
```

Ou diretamente pelo código:

```bash
python -m cli.main
```

Uso como biblioteca:

```python
from cortex.default_config import DEFAULT_CONFIG
from cortex.graph.trading_graph import CortexGraph

config = DEFAULT_CONFIG.copy()
config["llm_provider"] = "openai"
config["quick_think_llm"] = "gpt-5.4-mini"
config["deep_think_llm"] = "gpt-5.4"
config["max_debate_rounds"] = 2

graph = CortexGraph(debug=True, config=config)
_, decision = graph.propagate("NVDA", "2026-07-24")
print(decision)
```

## Persistência e retomada

### Dados do produto

Usuários, análises, eventos, favoritos, credenciais protegidas de corretora e
contextos de execução são persistidos no banco configurado.

### Memória de decisões

Cada análise concluída alimenta o histórico em:

```text
~/.cortex/memory/trading_memory.md
```

Altere o caminho com `CORTEX_MEMORY_LOG_PATH`.

### Checkpoints

Ative retomada do LangGraph após interrupções:

```bash
cortex analyze --checkpoint
```

Limpe checkpoints antigos:

```bash
cortex analyze --clear-checkpoints
```

Os arquivos ficam em `~/.cortex/cache/checkpoints`. Use `CORTEX_CACHE_DIR` para
alterar o diretório base.

## Testes e qualidade

Backend:

```bash
pytest
```

Frontend:

```bash
cd apps/web
npm run build
```

Os testes cobrem autenticação, persistência, dados de mercado, oportunidades,
Twelve Data e controles de execução MT5.

## Estrutura do repositório

```text
apps/
  api/                 API FastAPI e persistência do produto
  web/                 Aplicação Next.js
  mt5_bridge/          Bridge opcional para terminal MT5 remoto
cli/                   Interface de linha de comando
cortex/
  agents/              Agentes especializados
  graph/               Orquestração LangGraph
  trading_opportunities/
                       Dados, estratégias, sinais e risco
docs/                  Documentação complementar
tests/                 Testes automatizados
```

## Segurança

- nunca versione `.env`, senhas, chaves de API ou credenciais da corretora;
- use um `CORTEX_AUTH_SECRET` exclusivo por ambiente;
- mantenha `CORTEX_LIVE_TRADING_ENABLED=false` fora de ambientes controlados;
- valide conta, símbolo, lote, stop e take profit na prévia da ordem;
- use TLS e um gerenciador de segredos em produção;
- limite acesso de rede ao PostgreSQL e ao MT5 Bridge.

## Contribuição

Contribuições são bem-vindas. Antes de enviar alterações:

1. crie uma branch a partir de `develop`;
2. mantenha mudanças focadas e documentadas;
3. execute `pytest` e o build do frontend;
4. não inclua segredos nem bancos locais;
5. abra um pull request descrevendo impacto e validação.

Consulte [`CHANGELOG.md`](CHANGELOG.md) para o histórico de versões.

## Licença e citação

Consulte [`LICENSE`](LICENSE) para os termos de uso do código.

Se o framework for útil em pesquisa, cite o trabalho que originou a arquitetura:

```bibtex
@misc{xiao2025tradingagentsmultiagentsllmfinancial,
  title={TradingAgents: Multi-Agents LLM Financial Trading Framework},
  author={Yijia Xiao and Edward Sun and Di Luo and Wei Wang},
  year={2025},
  eprint={2412.20138},
  archivePrefix={arXiv},
  primaryClass={q-fin.TR},
  url={https://arxiv.org/abs/2412.20138}
}
```
