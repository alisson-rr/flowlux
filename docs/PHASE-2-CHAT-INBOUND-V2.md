# FlowLux - Fase 2: Chat Inbound v2

## Status

Proxima fase recomendada

## Objetivo

Tirar o webhook inbound do caminho principal do n8n e migrar o recebimento de mensagens para um backend idempotente.

## Problema que esta fase resolve

Hoje o inbound via n8n aumenta o risco de:

- mensagens duplicadas
- normalizacao inconsistente de `remote_jid` e telefone
- tratamento incorreto de `from_me`
- preview de conversa divergente do conteudo real
- `unread_count` sobrescrito por regra fixa

## Arquitetura desejada

O webhook da Evolution entra por uma rota backend propria.

A ordem de processamento deve ser:

1. receber o evento
2. validar autenticidade minima
3. normalizar `remote_jid` e `phone`
4. extrair e persistir `provider_message_id`
5. respeitar `from_me`
6. fazer upsert de conversa
7. fazer upsert de mensagem
8. disparar automacoes somente depois da persistencia

## Stories

### Story 2.1 - Webhook inbound deve ser recebido por backend proprio

Como arquitetura do produto,
queremos receber o webhook da Evolution em uma rota dedicada,
para garantir idempotencia, normalizacao de dados e controle de persistencia.

#### Tarefas

- retirar `database/n8n-workflow-receber-mensagens.json` do caminho principal
- definir rota backend propria para inbound
- normalizar `remote_jid` e telefone antes de gravar
- salvar `provider_message_id`
- tratar `from_me` corretamente
- fazer upsert de conversa e mensagem antes de qualquer automacao

#### Criterios de aceite

- a mesma mensagem nunca entra duas vezes
- o preview da conversa mostra o conteudo real
- `unread_count` nao e sobrescrito com valor fixo

### Story 2.2 - Persistencia inbound deve ser auditavel e idempotente

Como time tecnico,
queremos provar que cada entrega inbound foi processada uma unica vez,
para reduzir inconsistencias e facilitar diagnostico.

#### Tarefas

- definir chave de idempotencia por mensagem do provider
- proteger upsert contra repeticao do mesmo evento
- registrar eventos ignorados por duplicidade
- manter rastreabilidade suficiente para suporte

#### Criterios de aceite

- retry do provider nao duplica mensagem
- conversa e contagem de nao lidas permanecem consistentes

## Entregaveis esperados

- rota backend inbound
- servico de normalizacao e idempotencia
- persistencia com `provider_message_id`
- automacoes desacopladas do webhook bruto

## Dependencias

- entendimento do payload real da Evolution
- definicao da chave de idempotencia
- ajuste da tabela de mensagens se faltar campo unico do provider

## Rollout sugerido

1. subir a rota backend paralela
2. homologar com eventos reais controlados
3. trocar o endpoint do provider
4. manter fallback curto para rollback

## Rollback sugerido

- reativar o caminho anterior do n8n apenas se a rota nova falhar em homologacao ou em producao inicial

## Artefatos relacionados

- [workflow legado de inbound](/c:/Users/Alisson/CascadeProjects/FlowLux/database/n8n-workflow-receber-mensagens.json)
- [tela do chat](/c:/Users/Alisson/CascadeProjects/FlowLux/src/app/%28dashboard%29/chat/page.tsx)
