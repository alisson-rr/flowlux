-- =====================================================
-- FlowLux - Migration V9: Subscription Management
-- =====================================================
-- Melhorias no gerenciamento de assinaturas:
-- 1. Suporte a cancelamento com acesso até o fim do período
-- 2. Controle de trial: apenas uma vez por usuário
-- 3. Alteração de plano via API do Mercado Pago
--
-- NOTA: Nenhuma alteração de schema necessária.
-- O schema existente (v6) já possui todos os campos necessários:
--   - subscriptions.cancelled_at: data do cancelamento
--   - subscriptions.current_period_end: fim do período (acesso válido até esta data)
--   - subscriptions.trial_start / trial_end: controle de trial
--
-- A lógica de "trial apenas uma vez" é feita via query:
--   SELECT id FROM subscriptions WHERE user_id = ? AND trial_start IS NOT NULL LIMIT 1
--   Se retornar resultado, o usuário já usou o trial.
--
-- A lógica de "acesso até o fim do período após cancelamento" é feita via:
--   status = 'cancelled' AND current_period_end > NOW()
--   Neste caso, o usuário ainda tem acesso às funcionalidades.

-- Índice para otimizar a consulta de histórico de trial por usuário
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_trial
  ON subscriptions(user_id, trial_start) WHERE trial_start IS NOT NULL;
