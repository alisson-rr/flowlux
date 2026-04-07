# FlowLux - Story de Continuidade da Arquitetura de Chat e Automacoes

## Objetivo

Registrar a continuidade do processo arquitetural que foi definido para chat, agendamentos, execucao de fluxos e observabilidade operacional.

Este documento nao reabre o que ja foi concluido no agendamento. Ele organiza:

- a arquitetura-alvo
- a ordem de implementacao combinada
- o status atual de cada fase
- os objetivos tecnicos de cada etapa
- os criterios de aceite que orientam a continuidade

---

## Arquitetura-alvo

A direcao arquitetural definida para o produto e:

- chat inbound sai do n8n e vai para um backend idempotente
- agendamentos permanecem no n8n, mas com workflow minimo baseado em RPC
- execucao de fluxos deixa de rodar inteira dentro de uma request HTTP
- a UI do chat passa a operar melhor em escala
- observabilidade e rollout passam a ser tratados como parte da arquitetura, nao como complemento tardio

Essa sequencia ataca primeiro confiabilidade, depois desempenho, e por ultimo refinamento de UX.

---

## Ordem de implementacao

1. Agendamentos v2
2. Chat inbound v2
3. Flows async
4. Otimizacao da UI do chat
5. Metricas e endurecimento operacional

## Documentos por fase

- [Fase 1 - Agendamentos v2](/c:/Users/Alisson/CascadeProjects/FlowLux/docs/PHASE-1-AGENDAMENTOS-V2.md)
- [Fase 2 - Chat inbound v2](/c:/Users/Alisson/CascadeProjects/FlowLux/docs/PHASE-2-CHAT-INBOUND-V2.md)
- [Fase 3 - Flows async](/c:/Users/Alisson/CascadeProjects/FlowLux/docs/PHASE-3-FLOWS-ASYNC.md)
- [Fase 4 - Otimizacao da UI do chat](/c:/Users/Alisson/CascadeProjects/FlowLux/docs/PHASE-4-OTIMIZACAO-UI-CHAT.md)
- [Fase 5 - Metricas e endurecimento operacional](/c:/Users/Alisson/CascadeProjects/FlowLux/docs/PHASE-5-METRICAS-E-ENDURECIMENTO.md)

---

## Status atual

### Fase 1 - Agendamentos v2

Status: concluida

Observacao:

- esta fase ja foi implementada e resolvida
- o JSON final do n8n foi ajustado no ambiente e esta funcionando como definido
- a partir daqui, a continuidade deve seguir pelas fases abaixo, sem reabrir o escopo do agendamento como pendencia principal

### Fases seguintes

Status:

- Chat inbound v2: concluida
- Flows async: concluida
- Otimizacao da UI do chat: concluida
- Metricas e endurecimento: concluida

---

## Fase 1 - Agendamentos v2

Status: concluida

### Objetivo

Substituir o legado de agendamento por um modelo minimo e seguro no n8n:

- claim
- send
- finish

com a logica critica de estado e rastreabilidade apoiada por RPC no banco.

### Escopo da fase

- substituir o legado em `database/n8n-workflow-mensagem-agendada.json`
- adotar modelo equivalente ao disparo em massa v4
- estruturar rastreabilidade e reprocessamento seguro

### Contrato tecnico da fase

- tabela `scheduled_message_attempts`
- status `processing`
- `attempt_count`
- `claimed_at`
- `sent_at`
- `failure_reason`
- `provider_response`
- RPCs `claim_next_scheduled_message`
- RPCs `finish_scheduled_message_attempt`
- RPCs `finalize_scheduled_message`
- RPCs `requeue_failed_scheduled_message`

### Criterio de aceite

- nenhum agendamento duplica em concorrencia
- falha fica rastreavel
- reprocesso e seguro

---

## Fase 2 - Chat inbound v2

Status: proxima fase recomendada

### Objetivo

Migrar o inbound do chat para um backend idempotente e tirar o webhook do caminho principal do n8n.

### Story 2.1 - Webhook inbound deve ser recebido por backend proprio

Como arquitetura do produto,
queremos que o webhook da Evolution entre por uma rota backend dedicada,
para garantir idempotencia, normalizacao de dados e controle real sobre persistencia e automacoes.

#### Escopo tecnico

- retirar `database/n8n-workflow-receber-mensagens.json` do caminho principal
- criar rota backend propria para receber o webhook da Evolution
- normalizar `remote_jid` e `phone`
- salvar `provider_message_id`
- respeitar `from_me`
- fazer upsert de conversa
- fazer upsert de mensagem
- disparar automacoes apenas depois da persistencia

#### Criterio de aceite

- a mesma mensagem nunca entra duas vezes
- o preview da conversa mostra o conteudo real
- `unread_count` nao e sobrescrito com valor fixo

### Story 2.2 - Persistencia inbound deve ser auditavel e idempotente

Como time tecnico,
queremos conseguir provar que uma entrega inbound foi processada uma unica vez,
para reduzir inconsistencias de conversa, mensagens duplicadas e contagem errada de nao lidas.

#### Tarefas

- definir chave de idempotencia por mensagem do provider
- proteger upsert contra repeticao do mesmo evento
- registrar eventos rejeitados por duplicidade

#### Criterio de aceite

- reenvio do mesmo webhook nao duplica mensagem
- a conversa permanece consistente mesmo com retry do provider

---

## Fase 3 - Flows async

Status: pendente

### Objetivo

Transformar a execucao de fluxos em processamento assincrono e auditavel.

### Story 3.1 - A rota de execucao deve apenas enfileirar

Como arquitetura do produto,
queremos que `src/app/api/execute-flow/route.ts` pare de executar o fluxo inteiro dentro da request,
para que fluxos longos nao dependam de conexao HTTP aberta.

#### Escopo tecnico

- a rota passa a apenas criar ou enfileirar uma execucao
- um worker processa os passos
- delays deixam de existir dentro da request

#### Criterio de aceite

- fluxo longo nao depende de request aberta
- timeout HTTP deixa de ser risco estrutural para execucoes longas

### Story 3.2 - Cada passo do fluxo deve ser auditavel

Como operacao,
queremos enxergar cada etapa executada, falhada, reprocessada ou cancelada,
para tornar o motor de fluxos observavel e recuperavel.

#### Escopo tecnico

- log por etapa
- retry controlado
- cancelamento
- persistencia em `flow_executions`
- persistencia em `flow_execution_steps`

#### Criterio de aceite

- cada passo fica auditavel em `flow_executions` e `flow_execution_steps`
- retry e cancelamento ficam claros e controlados

---

## Fase 4 - Otimizacao da UI do chat

Status: pendente

### Objetivo

Escalar a experiencia do chat para bases maiores, reduzindo carregamento excessivo no cliente.

### Story 4.1 - A tela do chat deve carregar menos dados no cliente

Como usuario,
quero abrir o chat sem carregar volume excessivo de metadados,
para navegar com fluidez mesmo com base grande.

#### Escopo tecnico

- revisar `src/app/(dashboard)/chat/page.tsx`
- paginacao real de conversas
- filtros no banco
- lazy load mais agressivo do painel lateral
- realtime apenas para a conversa aberta e mudancas essenciais

#### Criterio de aceite

- abrir o chat com base grande continua rapido
- a troca de conversa nao engasga

### Story 4.2 - Estrategia de realtime deve ser reduzida ao essencial

Como time tecnico,
queremos limitar o realtime ao que realmente muda a experiencia principal,
para reduzir custo de processamento e ruido de atualizacao.

#### Tarefas

- manter realtime na conversa aberta
- manter realtime em eventos essenciais de atualizacao da lista
- remover assinaturas redundantes ou amplas demais

#### Criterio de aceite

- a pagina permanece responsiva mesmo com muito volume
- atualizacoes em tempo real nao travam a interface

---

## Fase 5 - Metricas e endurecimento operacional

Status: pendente

### Objetivo

Dar visibilidade operacional e permitir rollout gradual com fallback curto.

### Story 5.1 - Operacao deve ter metricas minimas de saude

Como operacao,
queremos metricas simples e objetivas de mensagens e fluxos,
para identificar falhas sem depender de investigacao manual no n8n.

#### Escopo tecnico

- mensagens recebidas
- mensagens com erro
- agendamentos processados
- tempo medio de execucao
- fluxos falhos por etapa

#### Criterio de aceite

- qualquer falha operacional relevante fica visivel sem precisar cacar no n8n manualmente

### Story 5.2 - Migracao deve seguir rollout gradual com fallback curto

Como time tecnico,
queremos implementar as mudancas por etapas independentes,
para reduzir risco e permitir rollback rapido.

#### Escopo tecnico

- primeiro sobe agendamentos v2
- depois chat inbound v2
- depois flows async
- manter fallback curto por fase
- registrar estrategia de rollback por etapa

#### Criterio de aceite

- cada fase consegue ser ativada e revertida sem interromper toda a operacao

---

## Artefatos relacionados

- [workflow legado de inbound](/c:/Users/Alisson/CascadeProjects/FlowLux/database/n8n-workflow-receber-mensagens.json)
- [workflow v3 de agendamentos](/c:/Users/Alisson/CascadeProjects/FlowLux/database/n8n-workflow-mensagem-agendada-v3-rich-content.json)
- [workflow v4 de disparo em massa](/c:/Users/Alisson/CascadeProjects/FlowLux/database/n8n-workflow-disparo-massa-v4-rpc.json)
- [rota atual de execute-flow](/c:/Users/Alisson/CascadeProjects/FlowLux/src/app/api/execute-flow/route.ts)
- [tela atual do chat](/c:/Users/Alisson/CascadeProjects/FlowLux/src/app/%28dashboard%29/chat/page.tsx)
- [story executivo principal](/c:/Users/Alisson/CascadeProjects/FlowLux/docs/PRODUCT-STORY-MELHORIAS.md)

---

## Checkpoint de continuidade

O processo continua daqui:

1. preservar o que ja esta estavel em agendamentos v2
2. mover o proximo foco para chat inbound v2
3. depois atacar flows async
4. na sequencia otimizar a UI do chat
5. fechar com metricas e endurecimento operacional
