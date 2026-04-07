# FlowLux - Fase 1: Agendamentos v2

## Status

Concluida

## Objetivo

Substituir o fluxo legado de agendamentos por um modelo minimo e seguro baseado em:

- claim
- send
- finish

com rastreabilidade no banco e workflow enxuto no n8n.

## Contexto

Esta fase foi a primeira etapa do endurecimento operacional porque o agendamento tinha maior risco de:

- duplicidade em concorrencia
- falta de rastreabilidade de falha
- reprocessamento inseguro
- acoplamento excessivo entre n8n e logica de estado

## Resultado esperado

- workflow de agendamento operando de forma minima no n8n
- controle de estado migrado para RPC
- historico de tentativas persistido no banco
- base preparada para retries e observabilidade

## Escopo da fase

- substituir o legado em `database/n8n-workflow-mensagem-agendada.json`
- adotar o modelo `claim -> send -> finish`
- criar trilha de tentativas no banco
- adicionar suporte seguro a reprocessamento

## Contrato tecnico

- tabela `scheduled_message_attempts`
- status `processing`
- `attempt_count`
- `claimed_at`
- `sent_at`
- `failure_reason`
- `provider_response`
- RPC `claim_next_scheduled_message`
- RPC `finish_scheduled_message_attempt`
- RPC `finalize_scheduled_message`
- RPC `requeue_failed_scheduled_message`

## Criterios de aceite

- nenhum agendamento duplica em concorrencia
- falha fica rastreavel
- reprocesso e seguro

## Artefatos relacionados

- [workflow v3 rich content](/c:/Users/Alisson/CascadeProjects/FlowLux/database/n8n-workflow-mensagem-agendada-v3-rich-content.json)
- [documentacao do workflow](/c:/Users/Alisson/CascadeProjects/FlowLux/database/n8n-workflow-mensagem-agendada-v3-rich-content.md)
- [README de automacoes e banco](/c:/Users/Alisson/CascadeProjects/FlowLux/database/README.md)

## Checkpoint

Esta fase esta encerrada como base estavel.

As proximas fases nao devem reabrir o escopo do agendamento como trilha principal, exceto quando uma dependencia direta exigir ajuste pontual.
