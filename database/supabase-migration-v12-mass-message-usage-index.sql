-- =====================================================
-- FlowLux - Migration V12: Mass Message Usage Index
-- =====================================================
-- Objetivo:
-- acelerar a consulta do contador mensal a partir dos logs persistidos

CREATE INDEX IF NOT EXISTS idx_mass_message_deliveries_user_sent_at
  ON mass_message_deliveries(user_id, sent_at DESC)
  WHERE status = 'sent' AND sent_at IS NOT NULL;
