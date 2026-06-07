

<div align="center" style="line-height: 1;">
  <a href="https://github.com/JefersonArnaldoSavaris/Cortex" target="_blank"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-Cortex-14C290?logo=github"/></a>

</div>

---

# Cortex: framework financeiro multiagente com LLM

## Novidades
- [2026-04] **Cortex v0.2.4** lançado com agentes de saída estruturada (Research Manager, Trader, Portfolio Manager), retomada por checkpoint no LangGraph, log persistente de decisões, suporte a provedores DeepSeek/Qwen/GLM/Azure, Docker e correção de codificação UTF-8 no Windows. Veja a lista completa em [CHANGELOG.md](CHANGELOG.md).
- [2026-03] **Cortex v0.2.3** lançado com suporte multilíngue, família de modelos GPT-5.4, catálogo unificado de modelos, fidelidade de datas em backtests e suporte a proxy.
- [2026-03] **Cortex v0.2.2** lançado com cobertura para GPT-5.4/Gemini 3.1/Claude 4.6, escala de avaliação em cinco níveis, OpenAI Responses API, controle de esforço da Anthropic e estabilidade multiplataforma.
- [2026-02] **Cortex v0.2.0** lançado com suporte a múltiplos provedores de LLM (GPT-5.x, Gemini 3.x, Claude 4.x, Grok 4.x) e arquitetura aprimorada.
- [2026-01] **Trading-R1** teve seu [Technical Report](https://arxiv.org/abs/2509.11420) publicado.

> **Cortex** é a base técnica do Cortex para pesquisa, análise e automação de fluxos de decisão em mercados financeiros.
>
> O objetivo é combinar agentes especializados, modelos de linguagem e persistência de análises para criar uma experiência de pesquisa financeira mais estruturada, auditável e evolutiva.

<div align="center">

[Cortex](#framework-cortex) | [Instalação e CLI](#instalacao-e-cli) | [Demonstração](https://www.youtube.com/watch?v=90gr5lwjIho) | [Uso como pacote](#pacote-cortex) | [Contribuição](#contribuicao) | [Citação](#citacao)

</div>

## Framework Cortex

Cortex é um framework multiagente para análise financeira que simula a dinâmica de uma equipe de pesquisa e trading. O sistema usa agentes especializados com LLM para analisar fundamentos, sentimento, notícias, indicadores técnicos, riscos e decisões de portfólio. Esses agentes colaboram e debatem para chegar a uma decisão de investimento mais contextualizada.

<p align="center">
  <img src="assets/schema.png" style="width: 100%; height: auto;">
</p>

> Este projeto foi criado para fins de pesquisa e desenvolvimento. O desempenho de trading pode variar de acordo com o modelo usado, temperatura, período analisado, qualidade dos dados e outros fatores não determinísticos. Este projeto não é recomendação financeira, recomendação de investimento nem aconselhamento de trading.

O framework divide a análise em papéis especializados. Essa separação torna o fluxo mais modular, facilita auditoria dos relatórios intermediários e permite evoluir cada etapa sem reescrever todo o sistema.

### Time de analistas
- **Fundamentals Analyst:** avalia demonstrativos financeiros, métricas de desempenho, valor intrínseco e possíveis sinais de alerta.
- **Sentiment Analyst:** analisa sentimento público e redes sociais para estimar o humor de curto prazo do mercado.
- **News Analyst:** acompanha notícias, eventos globais e fatores macroeconômicos que podem afetar o ativo analisado.
- **Technical Analyst:** usa indicadores técnicos, como MACD e RSI, para identificar padrões e possíveis movimentos de preço.

<p align="center">
  <img src="assets/analyst.png" width="100%" style="display: inline-block; margin: 0 2%;">
</p>

### Time de pesquisadores
- Reúne pesquisadores com visão otimista e pessimista. Eles revisam criticamente os relatórios dos analistas, debatem riscos e oportunidades e ajudam a equilibrar a tese de investimento.

<p align="center">
  <img src="assets/researcher.png" width="70%" style="display: inline-block; margin: 0 2%;">
</p>

### Agente trader
- Consolida os relatórios dos analistas e pesquisadores para propor uma decisão operacional. O agente avalia entrada, direção, justificativa e contexto da operação com base nos dados disponíveis.

<p align="center">
  <img src="assets/trader.png" width="70%" style="display: inline-block; margin: 0 2%;">
</p>

### Gestão de risco e portfólio
- O time de risco avalia volatilidade, liquidez, exposição e fragilidades da tese.
- O Portfolio Manager revisa a proposta final, aprova ou rejeita a operação e registra a decisão consolidada.

<p align="center">
  <img src="assets/risk.png" width="70%" style="display: inline-block; margin: 0 2%;">
</p>

## Instalação e CLI

### Instalação

Clone o projeto:

```bash
git clone https://github.com/JefersonArnaldoSavaris/Cortex.git
cd Cortex
```

Crie um ambiente virtual no gerenciador de sua preferência:

```bash
conda create -n cortex python=3.13
conda activate cortex
```

Instale o pacote e suas dependências:

```bash
pip install .
```

### Docker

Também é possível executar com Docker:

```bash
cp .env.example .env  # adicione suas chaves de API
docker compose run --rm cortex
```

Para usar modelos locais com Ollama:

```bash
docker compose --profile ollama run --rm cortex-ollama
```

### APIs necessárias

Cortex suporta múltiplos provedores de LLM. Configure a chave de API do provedor escolhido:

```bash
export OPENAI_API_KEY=...          # OpenAI (GPT)
export GOOGLE_API_KEY=...          # Google (Gemini)
export ANTHROPIC_API_KEY=...       # Anthropic (Claude)
export XAI_API_KEY=...             # xAI (Grok)
export DEEPSEEK_API_KEY=...        # DeepSeek
export DASHSCOPE_API_KEY=...       # Qwen (Alibaba DashScope)
export ZHIPU_API_KEY=...           # GLM (Zhipu)
export OPENROUTER_API_KEY=...      # OpenRouter
export ALPHA_VANTAGE_API_KEY=...   # Alpha Vantage
```

Para provedores corporativos, como Azure OpenAI ou AWS Bedrock, copie `.env.enterprise.example` para `.env.enterprise` e preencha as credenciais.

Para modelos locais, configure Ollama com `llm_provider: "ollama"` na configuração.

Como alternativa, copie `.env.example` para `.env` e preencha as chaves:

```bash
cp .env.example .env
```

### Uso da CLI

Inicie a CLI interativa:

```bash
cortex          # comando instalado
python -m cli.main     # alternativa: executar direto do código-fonte
```

A tela inicial permite selecionar tickers, data de análise, provedor de LLM, profundidade de pesquisa e outras opções.

<p align="center">
  <img src="assets/cli/cli_init.png" width="100%" style="display: inline-block; margin: 0 2%;">
</p>

Durante a execução, a interface exibe o progresso dos agentes e os relatórios conforme eles são gerados.

<p align="center">
  <img src="assets/cli/cli_news.png" width="100%" style="display: inline-block; margin: 0 2%;">
</p>

<p align="center">
  <img src="assets/cli/cli_transaction.png" width="100%" style="display: inline-block; margin: 0 2%;">
</p>

## Pacote Cortex

### Detalhes de implementação

Cortex usa LangGraph para manter flexibilidade e modularidade. O framework suporta múltiplos provedores de LLM: OpenAI, Google, Anthropic, xAI, DeepSeek, Qwen (Alibaba DashScope), GLM (Zhipu), OpenRouter, Ollama para modelos locais e Azure OpenAI para ambientes corporativos.

### Uso em Python

Para usar Cortex em código Python, importe o módulo `cortex` e inicialize um objeto `CortexGraph()`. A função `.propagate()` retorna a decisão da análise. Também é possível executar `main.py`. Exemplo rápido:

```python
from cortex.graph.trading_graph import CortexGraph
from cortex.default_config import DEFAULT_CONFIG

ta = CortexGraph(debug=True, config=DEFAULT_CONFIG.copy())

# propagação direta
_, decision = ta.propagate("NVDA", "2026-01-15")
print(decision)
```

Você também pode ajustar a configuração padrão para escolher modelos, rodadas de debate e outros parâmetros.

```python
from cortex.graph.trading_graph import CortexGraph
from cortex.default_config import DEFAULT_CONFIG

config = DEFAULT_CONFIG.copy()
config["llm_provider"] = "openai"        # openai, google, anthropic, xai, deepseek, qwen, glm, openrouter, ollama, azure
config["deep_think_llm"] = "gpt-5.4"     # modelo para raciocínio complexo
config["quick_think_llm"] = "gpt-5.4-mini" # modelo para tarefas rápidas
config["max_debate_rounds"] = 2

ta = CortexGraph(debug=True, config=config)
_, decision = ta.propagate("NVDA", "2026-01-15")
print(decision)
```

Veja `cortex/default_config.py` para consultar todas as opções de configuração.

## Persistência e recuperação

Cortex persiste dois tipos de estado entre execuções.

### Log de decisões

O log de decisões fica sempre ativo. Cada execução concluída adiciona a decisão em `~/.cortex/memory/trading_memory.md`. Na próxima execução para o mesmo ticker, Cortex busca o retorno realizado (bruto e alpha vs SPY), gera uma reflexão em um parágrafo e injeta no prompt do Portfolio Manager as decisões recentes do mesmo ticker junto com aprendizados recentes de outros tickers. Assim, cada análise carrega contexto sobre o que funcionou e o que não funcionou.

Use `CORTEX_MEMORY_LOG_PATH` para sobrescrever o caminho do log.

### Retomada por checkpoint

A retomada por checkpoint é opcional e ativada com `--checkpoint`. Quando habilitada, LangGraph salva o estado depois de cada nó, permitindo que uma execução interrompida ou com falha continue a partir da última etapa concluída em vez de começar do zero. Em uma retomada, os logs exibem `Resuming from step N for <TICKER> on <date>`; em uma nova execução, exibem `Starting fresh`. Os checkpoints são limpos automaticamente quando a execução termina com sucesso.

Os bancos SQLite por ticker ficam em `~/.cortex/cache/checkpoints/<TICKER>.db`. Use `CORTEX_CACHE_DIR` para alterar o diretório base. Use `--clear-checkpoints` para limpar todos os checkpoints antes de uma execução.

```bash
cortex analyze --checkpoint           # ativa nesta execução
cortex analyze --clear-checkpoints    # limpa antes de executar
```

```python
config = DEFAULT_CONFIG.copy()
config["checkpoint_enabled"] = True
ta = CortexGraph(config=config)
_, decision = ta.propagate("NVDA", "2026-01-15")
```

## Contribuição

Contribuições são bem-vindas. Correções de bugs, melhorias de documentação, ajustes de experiência, novos testes e sugestões de funcionalidades ajudam a tornar o Cortex mais robusto.

As contribuições anteriores, incluindo código, feedback de design e relatórios de bugs, são registradas por versão em [`CHANGELOG.md`](CHANGELOG.md).

## Citação

Se *Cortex* for útil para sua pesquisa ou desenvolvimento, cite o trabalho original:

```bibtex
@misc{xiao2025cortexmultiagentsllmfinancial,
      title={Cortex: Multi-Agents LLM Financial Trading Framework}, 
      author={Yijia Xiao and Edward Sun and Di Luo and Wei Wang},
      year={2025},
      eprint={2412.20138},
      archivePrefix={arXiv},
      primaryClass={q-fin.TR},
      url={https://arxiv.org/abs/2412.20138}, 
}
```
