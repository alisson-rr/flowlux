# FlowLux - Database & Automations

## SQL Migrations (executar na ordem)

1. `supabase-schema.sql` - Schema inicial completo
2. `supabase-migration-v2.sql` - Soft delete de leads, media e storage
3. `supabase-migration-v3.sql` - Multiplos funis, flows, flow_steps e flow_executions
4. `supabase-migration-v4.sql` - Soft delete para mass_messages, scheduled_messages e flows
5. `supabase-migration-v5-rls.sql` - Ajustes de RLS
6. `supabase-migration-v6-subscriptions.sql` - Estrutura de assinaturas
7. `supabase-migration-v7-flows-rls.sql` - Ajustes de RLS para flows
8. `supabase-migration-v8-subscription-fixes.sql` - Correcoes de assinatura
9. `supabase-migration-v9-subscription-management.sql` - Indices e regras de gestao de assinatura
10. `supabase-migration-v10-mass-message-observability.sql` - Logs por contato, motivo de falha, tentativas e reprocessamento do disparo em massa
11. `supabase-migration-v11-mass-message-rpc.sql` - Funcoes RPC para claim, preparo, tentativa e finalizacao do disparo em massa live
12. `supabase-migration-v12-mass-message-usage-index.sql` - Indice para leitura do contador mensal direto dos logs persistidos
13. `supabase-migration-v13-mass-message-rpc-overload-fix.sql` - Remove overloads antigos UUID das RPCs do disparo em massa
14. `supabase-migration-v14-mass-message-claim-delivery-lock-fix.sql` - Corrige o lock da RPC claim_next_mass_message_delivery em join com whatsapp_instances
15. `supabase-migration-v15-scheduled-message-observability.sql` - Logs de tentativa, novos status e observabilidade dos agendamentos
16. `supabase-migration-v16-scheduled-message-rpc.sql` - Funcoes RPC para claim e finalizacao segura dos agendamentos
17. `supabase-migration-v17-scheduled-message-rich-content.sql` - Permite agendar midia com legenda e expor esses dados no RPC do agendamento
18. `supabase-migration-v18-scheduled-message-status-and-placeholders.sql` - Ajusta confirmacao real do envio e placeholders no agendamento
19. `supabase-migration-v19-chat-inbound-idempotency.sql` - Idempotencia do inbound do chat e persistencia correta de conversa e mensagem
20. `supabase-migration-v20-flow-executions-async.sql` - Fila, status async, retry e auditoria por etapa dos fluxos
21. `supabase-migration-v21-operational-observability.sql` - Eventos operacionais, metricas de erro e base de observabilidade minima

## Workflows n8n

- `n8n-workflow-disparo-massa.json` - Workflow legado do disparo em massa
- `n8n-workflow-disparo-massa-v3-observability.json` - Workflow importavel do disparo em massa com logs por contato e reprocessamento seguro
- `n8n-workflow-disparo-massa-v3-observability.md` - Contrato funcional e referencia da versao v3
- `n8n-workflow-disparo-massa-v4-rpc.json` - Workflow importavel recomendado para live, com a logica pesada movida para RPC no Supabase
- `n8n-workflow-disparo-massa-v4-rpc.md` - Referencia da versao v4 com RPC
- `n8n-workflow-mensagem-agendada.json` - Workflow legado dos agendamentos
- `n8n-workflow-mensagem-agendada-v2-rpc.json` - Workflow importavel recomendado para agendamentos com claim seguro, tentativas e reprocessamento
- `n8n-workflow-mensagem-agendada-v2-rpc.md` - Referencia da versao v2 RPC dos agendamentos
- `n8n-workflow-mensagem-agendada-v3-rich-content.json` - Workflow importavel recomendado para agendamentos com texto ou midia com legenda
- `n8n-workflow-mensagem-agendada-v3-rich-content.md` - Referencia da versao v3 rich content dos agendamentos
- `../docs/PRODUCT-STORY-ARQUITETURA-CHAT-E-AUTOMACOES.md` - Story de continuidade das proximas fases de chat, automacoes e endurecimento operacional
- `n8n-workflow-receber-mensagens.json` - Workflow de recebimento de mensagens do Evolution API
  - Recebe webhook `MESSAGES_UPSERT`
  - Salva em `messages`
  - Atualiza `conversations`
  - Tambem verifica keyword triggers para fluxos automaticos
  - Trocar `CONFIGURE_SUPABASE_CREDENTIAL` pelo ID da credencial Supabase no n8n

## API Route (Next.js)

- `src/app/api/execute-flow/route.ts` - Enfileira a execucao do fluxo e dispara o worker em segundo plano
  - Chamado pelo frontend ao executar um fluxo no chat
  - Persiste em `flow_executions` e `flow_execution_steps`
  - Usa `NEXT_PUBLIC_EVOLUTION_API_URL` e `NEXT_PUBLIC_EVOLUTION_API_KEY`
  - Requer `SUPABASE_SERVICE_ROLE_KEY` para escrita no banco
- `src/app/api/flow-worker/route.ts` - Processa execucoes pendentes ou uma execucao especifica
- `src/app/api/flow-executions/[id]/cancel/route.ts` - Cancela uma execucao pendente ou em andamento

## Notas

- Soft delete: disparos e agendamentos excluidos recebem `status='cancelled'` com `deleted_at`
- Disparo em massa v3:
  - persiste logs em `mass_message_deliveries`
  - resume `sent_count`, `failed_count` e `total_count` a partir dos logs
  - reenfileira apenas registros `failed`, sem recriar a campanha
- Disparo em massa v4:
  - usa RPC no Supabase para `claim`, preparo e fechamento da campanha
  - reduz a dependencia de `Code` nodes no `n8n`
  - recomendado para a execucao live
- Agendamentos v2:
  - usa RPC no Supabase para `claim` e finalizacao da tentativa
  - persiste historico em `scheduled_message_attempts`
  - substitui o workflow legado que varria todos os pendentes sem lock
- Agendamentos v3:
  - adiciona suporte a midia com legenda
  - mantém quebra de linha do texto
  - recomendado quando você quiser usar mensagens prontas + mídia no mesmo fluxo
- Flows async:
  - a request do chat apenas enfileira
  - delays passam a ser retomados pelo banco via `next_run_at`
  - cada etapa fica rastreavel em `flow_execution_steps`
- Observabilidade operacional:
  - erros do inbound, envio de midia e falhas terminais dos fluxos ficam em `operational_events`
  - o dashboard passa a ler erros, agendamentos processados, tempo medio de execucao e alertas recentes
- Gravacao de audio requer HTTPS ou `localhost`
