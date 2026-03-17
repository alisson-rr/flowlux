# FlowLux - Database & Automations

## SQL Migrations (executar na ordem)

1. **`supabase-schema.sql`** — Schema inicial completo (tabelas, RLS, triggers)
2. **`supabase-migration-v2.sql`** — Soft delete leads, tabela media, storage
3. **`supabase-migration-v3.sql`** — Múltiplos funis, flows, flow_steps, flow_executions
4. **`supabase-migration-v4.sql`** — Soft delete para mass_messages, scheduled_messages e flows

## Workflows n8n

- **`n8n-workflow-disparo-massa.json`** — Workflow para disparo em massa via n8n
- **`n8n-workflow-receber-mensagens.json`** — Workflow para receber mensagens do Evolution API
  - Recebe webhook `MESSAGES_UPSERT` → parseia → salva em `messages` → atualiza `conversations`
  - Também verifica keyword triggers para fluxos automáticos
  - **Configurar**: trocar `CONFIGURE_SUPABASE_CREDENTIAL` pelo ID da credencial Supabase no n8n

## API Route (Next.js)

- **`src/app/api/execute-flow/route.ts`** — Executa fluxos de mensagens sequenciais via Evolution API
  - Chamado pelo frontend ao executar um fluxo no chat
  - Usa as env vars `NEXT_PUBLIC_EVOLUTION_API_URL` e `NEXT_PUBLIC_EVOLUTION_API_KEY`
  - Requer `SUPABASE_SERVICE_ROLE_KEY` para escrita no DB (adicionar ao `.env.local`)

## Notas

- **Soft delete**: Agendamentos e disparos excluídos recebem `status='cancelled'` + `deleted_at`. O n8n deve filtrar por `status != 'cancelled'`.
- **Gravação de áudio**: Requer HTTPS ou localhost (limitação do browser — `navigator.mediaDevices` indisponível em HTTP).
