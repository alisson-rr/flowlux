-- =====================================================
-- FlowLux - Migration V13: Mass Message RPC Overload Fix
-- =====================================================
-- Objetivo:
-- remover overloads antigos com UUID para que o PostgREST
-- resolva corretamente as RPCs em producao.

DROP FUNCTION IF EXISTS public.prepare_mass_message_campaign(UUID);
DROP FUNCTION IF EXISTS public.claim_next_mass_message_delivery(UUID);
DROP FUNCTION IF EXISTS public.finish_mass_message_delivery_attempt(UUID, JSONB);
DROP FUNCTION IF EXISTS public.finalize_mass_message_campaign(UUID);

-- Observacao:
-- apos remover os overloads UUID, reaplique a migration v11
-- se quiser garantir que as versoes TEXT mais recentes estejam sincronizadas.
