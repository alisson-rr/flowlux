# Auditoria de Assinaturas (SaaS) — 2026-04-02

## Escopo revisado
- Estrutura SQL de assinaturas/pagamentos/webhooks em `database/`.
- Fluxo de criação, atualização e cancelamento de assinatura.
- Processamento de webhooks de cobrança/renovação.
- Consumo de status de assinatura no front-end.

## O que está bom hoje
1. **Webhook com validação de assinatura HMAC do Mercado Pago**.
2. **Log de webhooks (`mp_webhooks`) e histórico de pagamentos (`subscription_payments`)**.
3. **Deduplicação de pagamentos por `mp_payment_id`** (índice único parcial).
4. **Tratamento de múltiplos status relevantes** (`trial`, `active`, `authorized`, `paused`, `cancelled`).
5. **Fluxo de cancelamento mantendo `current_period_end`** para acesso até fim de ciclo.

## Riscos encontrados (prioridade alta)
1. **Risco de autorização nas rotas internas de assinatura**  
   As rotas aceitavam `user_id` vindo do cliente sem obrigar token de autenticação do usuário.

2. **Inconsistência de acesso após cancelamento com período vigente**  
   Parte da UI já tratava cancelado-com-acesso, mas o hook global de assinatura não.

3. **Potencial de estado “pendente eterno”**  
   Em cenários de perda de webhook/rede, assinatura pode ficar em `pending_payment` sem rotina de reconciliação automática periódica.

4. **Ausência de restrições mais fortes de unicidade de assinatura ativa por usuário**  
   Há lógica aplicacional para evitar duplicidade, mas sem constraint de banco isso pode falhar sob concorrência.

## Correções aplicadas neste ciclo
1. **Autenticação obrigatória nas APIs de assinatura**  
   - `create-subscription`, `update-subscription`, `cancel-subscription` agora exigem `Authorization: Bearer <access_token>`.
   - As rotas validam usuário autenticado e bloqueiam mismatch com `user_id` recebido.

2. **Envio de token no front-end para chamadas de assinatura**  
   - Páginas de assinatura agora anexam `access_token` nas requisições internas.

3. **Hook de assinatura ajustado para cancelado-com-acesso**  
   - `useSubscription` agora considera assinatura `cancelled` ainda ativa quando `current_period_end > now()`.

## Recomendações para robustez SaaS (próximos passos)
1. **Implementar reconciliação agendada (job diário/horário)**  
   - Buscar assinaturas `pending_payment` antigas.
   - Consultar Mercado Pago por `preapproval`/`payment`.
   - Corrigir status local automaticamente.

2. **Adicionar proteção de unicidade para assinatura “vigente”**  
   - Estratégia comum: índice parcial/constraint lógica para impedir mais de uma assinatura vigente por usuário.

3. **Idempotência forte por evento de webhook**  
   - Armazenar `event_id` único (quando disponível) para evitar reprocessamento em reentregas.

4. **Máquina de estados explícita**  
   - Definir transições permitidas por status em um único lugar (evita regressão de estados inválidos).

5. **Observabilidade de cobrança**  
   - Métricas: webhook recebido/processado, latência, taxa de erro por evento, assinaturas presas em pendência.
   - Alertas para anomalias (ex.: aumento de `pending_payment` > X minutos).

## Checklist de operação recomendado
- [ ] Toda cobrança aprovada vira `subscription_payments` + atualização de assinatura.
- [ ] Cancelamento sempre persiste `cancelled_at`.
- [ ] Acesso de cancelado respeita `current_period_end`.
- [ ] Trial concedido apenas uma vez por usuário.
- [ ] APIs internas de assinatura exigem autenticação de usuário.
- [ ] Reconciliação periódica habilitada em produção.

