# FlowLux - Disparo em Massa v4 RPC

## Objetivo

Estabilizar a execucao live do disparo em massa removendo a dependencia de `Code` nodes para:

- separar campanhas agendadas
- preparar fila por contato
- classificar resposta do provider
- consolidar resumo final

Na v4, o `n8n` fica responsavel apenas por:

1. buscar uma campanha agendada por vez
2. pedir ao Supabase para preparar a campanha
3. claim de uma entrega por vez
4. enviar via Evolution API
5. registrar o resultado da tentativa
6. repetir o loop ate acabar
7. finalizar a campanha

## Dependencia obrigatoria

Aplicar antes a migration:

- `supabase-migration-v11-mass-message-rpc.sql`

Ela cria as funcoes RPC:

- `claim_next_mass_message_campaign()`
- `prepare_mass_message_campaign(p_mass_message_id uuid)`
- `claim_next_mass_message_delivery(p_mass_message_id uuid)`
- `finish_mass_message_delivery_attempt(p_delivery_id uuid, p_provider_response jsonb)`
- `finalize_mass_message_campaign(p_mass_message_id uuid)`

## Vantagens da v4

- remove os `Code` nodes que estavam falhando no live workflow
- deixa a mesma regra de negocio rodando sempre no backend
- melhora a consistencia entre manual, reprocessamento e live
- facilita auditar e corrigir o motor sem reescrever o workflow inteiro

## Fluxo recomendado

1. `Schedule Trigger`
2. `Claim Next Campaign`
3. `Encontrou Campanha?`
4. `Preparar Campanha`
5. `Campanha Pronta?`
6. `Claim Next Delivery`
7. `Encontrou Entrega?`
8. `Enviar via Evolution API`
9. `Registrar Resultado`
10. `Delay Anti-Ban`
11. `Finalizar Campanha`

## Comportamento importante

- o workflow processa uma campanha por vez
- dentro da campanha, processa uma entrega por vez
- a fila por contato vem de `mass_message_deliveries`
- o backend registra `attempt_count`, `failure_reason`, `sent_at` e counters
- o limitador mensal do app passa a refletir `sent_count`

## Importacao

Arquivo importavel:

- `n8n-workflow-disparo-massa-v4-rpc.json`

Revise antes de ativar:

- credencial Supabase
- credencial da Evolution API
- URL base do Supabase
- nome da instancia/credencial da Evolution

## Observacao operacional

Essa versao continua suficiente para o MVP. Se o volume crescer e o disparo em massa virar gargalo de throughput, o proximo passo natural passa a ser um worker proprio com fila dedicada.
