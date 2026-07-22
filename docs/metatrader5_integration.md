# Integração MetaTrader 5

O provider MT5 do Cortex usa o pacote oficial `MetaTrader5`, que controla um
terminal MetaTrader 5 local. Essa integração é somente leitura: ela busca conta,
preços e candles da corretora, mas não envia ordens.

## Requisito de ambiente

O pacote oficial `MetaTrader5` é distribuído como wheel para Windows x86-64.
Por isso, a API Cortex precisa rodar em uma máquina ou VM Windows para conectar
diretamente ao terminal MT5.

O ambiente Linux local continua útil para desenvolvimento do frontend, API,
mock e yFinance, mas não consegue carregar o módulo oficial `MetaTrader5`.

## Setup recomendado com bridge Windows

O ambiente local Linux pode continuar rodando Cortex API e frontend. A VM
Windows roda apenas a bridge MT5 em `0.0.0.0:8765`, e o VirtualBox encaminha:

```text
Linux 127.0.0.1:8765 -> Windows VM 8765
```

No Linux, configure:

```bash
CORTEX_MT5_BRIDGE_URL=http://127.0.0.1:8765
```

Na VM Windows, siga [apps/mt5_bridge/README.md](../apps/mt5_bridge/README.md).

## Setup alternativo: API inteira no Windows

1. Instale o MetaTrader 5 da sua corretora.
2. Faça login no terminal com a conta da corretora ao menos uma vez.
3. Instale Python compatível com o projeto.
4. No diretório do Cortex, crie/ative o ambiente virtual.
5. Instale o pacote:

```bash
python -m pip install MetaTrader5
```

6. Suba a API no Windows:

```bash
uvicorn apps.api.cortex_api.main:app --reload --host 127.0.0.1 --port 8000
```

7. Suba o frontend normalmente e use `Integrações > MetaTrader 5` para informar:
   - servidor da corretora;
   - login/usuário MT5;
   - senha;
   - caminho do terminal, se o terminal não for encontrado automaticamente.

## Arquitetura recomendada para produção

Para SaaS ou multiusuário, não rode várias contas MT5 dentro do mesmo processo.
O terminal MT5 e o pacote Python trabalham como uma integração local/process-wide.
O desenho recomendado é:

- um serviço Windows isolado por usuário/conta ou por corretora;
- credenciais protegidas por cofre de segredos;
- API Cortex chamando esse serviço Windows por HTTP/gRPC interno;
- execução de ordens em um serviço separado, com permissões e auditoria próprias.

No estágio atual, o Cortex usa sessão MT5 em memória por usuário e bloqueia
execução real de ordens.

