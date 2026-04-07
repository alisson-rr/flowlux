# FlowLux - Mensagem Agendada v3 Rich Content

## Objetivo

Evoluir o agendamento v2 para suportar:

- texto com quebra de linha
- midia com legenda
- mensagens prontas preenchidas na UI

Na v3, o `n8n` continua minimo:

1. claim de um agendamento por vez
2. decide entre envio de texto ou midia
3. registra o resultado
4. repete com delay anti-ban aleatorio

## Dependencias obrigatorias

Aplicar antes:

- `supabase-migration-v15-scheduled-message-observability.sql`
- `supabase-migration-v16-scheduled-message-rpc.sql`
- `supabase-migration-v17-scheduled-message-rich-content.sql`
- `supabase-migration-v18-scheduled-message-status-and-placeholders.sql`

## O que a v3 adiciona

- colunas `media_url`, `media_type`, `file_name` em `scheduled_messages`
- `claim_next_scheduled_message()` devolvendo placeholders resolvidos para o lead
- classificacao de resposta que nao trata `status: PENDING` como sucesso final
- branch no workflow para texto ou midia, ambos via edge function

## Escopo atual

Tipos de midia suportados no agendamento:

- `image`
- `video`
- `document`

Se no futuro voce quiser audio agendado, o melhor proximo passo e adicionar uma terceira branch no workflow usando `sendWhatsAppAudio`.

## Importacao

Arquivo importavel:

- `n8n-workflow-mensagem-agendada-v3-rich-content.json`

Antes de ativar:

- revise a credencial Supabase
- garanta que a credencial `Header_evo` exista no n8n
- desative a v2 para evitar concorrencia

## Observacao operacional

Nesta revisao, o workflow volta a enviar direto pela Evolution API. Com a migracao `v18` no banco, o fluxo continua:

- enviando texto puro quando nao houver midia
- enviando midia com legenda quando houver arquivo
- registrando corretamente `PENDING` como falha/nao confirmado no RPC de finalizacao

Se voce quiser retomar a versao com edge function depois, o arquivo `supabase/functions/send-scheduled-message/index.ts` ficou pronto no projeto, mas precisa ser publicado no Supabase antes de usar no n8n.
