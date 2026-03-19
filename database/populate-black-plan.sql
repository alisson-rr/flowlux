-- =====================================================
-- DADOS DE TESTE - ASSINATURA FAKE (PLANO BLACK)
-- =====================================================

-- ATENÇÃO: Substitua 'SEU_USER_ID_AQUI' pelo ID real do seu usuário no Supabase
-- Você pode encontrar este ID na tabela auth.users ou executando:
-- SELECT id, email FROM auth.users;

-- Inserir assinatura de teste (plano Black em período trial)
INSERT INTO subscriptions (
  user_id,
  plan_id,
  status,
  mp_preapproval_id,
  mp_payer_id,
  mp_payer_email,
  trial_start,
  trial_end,
  current_period_start,
  current_period_end,
  created_at,
  updated_at
) VALUES (
  '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b',  -- <-- SUBSTITUA PELO ID REAL DO SEU USUÁRIO
  'black',  -- <-- ALTERADO DE 'starter' PARA 'black'
  'trial',
  'preapproval_test_123456',
  'payer_test_789',
  'teste@exemplo.com',
  CURRENT_DATE - INTERVAL '3 days',
  CURRENT_DATE + INTERVAL '4 days',
  CURRENT_DATE - INTERVAL '3 days',
  CURRENT_DATE + INTERVAL '1 month',
  NOW(),
  NOW()
);

-- Inserir alguns pagamentos de teste (valor ajustado para plano Black)
INSERT INTO subscription_payments (
  user_id,
  subscription_id,
  mp_payment_id,
  status,
  amount,
  currency,
  payment_method,
  description,
  paid_at,
  created_at
) VALUES (
  '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b',  -- <-- SUBSTITUA PELO ID REAL DO SEU USUÁRIO
  (SELECT id FROM subscriptions WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' ORDER BY created_at DESC LIMIT 1),
  'payment_test_001',
  'approved',
  297.00,  -- <-- VALOR AJUSTADO PARA PLANO BLACK
  'BRL',
  'credit_card',
  'Pagamento FlowLux - Plano Black',
  NOW() - INTERVAL '1 hour',
  NOW()
);

-- Inserir webhook de teste
INSERT INTO mp_webhooks (
  event_type,
  event_action,
  mp_id,
  payload,
  processed,
  created_at
) VALUES (
  'subscription_preapproval',
  'created',
  'preapproval_test_123456',
  '{"type": "subscription_preapproval", "action": "created", "data": {"id": "preapproval_test_123456"}}',
  true,
  NOW()
);

-- Para testar outros cenários, você pode usar estes exemplos:

-- Assinatura Black ativa (comente o INSERT acima e use este)
/*
INSERT INTO subscriptions (
  user_id, plan_id, status, mp_preapproval_id, mp_payer_email,
  current_period_start, current_period_end, created_at, updated_at
) VALUES (
  'SEU_USER_ID_AQUI',
  'black',
  'active',
  'preapproval_black_789',
  'black@exemplo.com',
  CURRENT_DATE - INTERVAL '15 days',
  CURRENT_DATE + INTERVAL '15 days',
  NOW() - INTERVAL '15 days',
  NOW()
);
*/

-- Assinatura cancelada (para testar upgrade)
/*
INSERT INTO subscriptions (
  user_id, plan_id, status, mp_preapproval_id, mp_payer_email,
  cancelled_at, created_at, updated_at
) VALUES (
  'SEU_USER_ID_AQUI',
  'black',
  'cancelled',
  'preapproval_cancelled_123',
  'cancelado@exemplo.com',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '30 days',
  NOW() - INTERVAL '5 days'
);
*/
