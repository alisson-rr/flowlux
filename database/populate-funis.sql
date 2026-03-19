-- =====================================================
-- FlowLux - Populate: Funis e Etapas para Infoprodutor
-- User ID: 56ed5bf7-c7ca-4497-aaf7-b202483a0b7b
-- =====================================================

-- Criar os funis primeiro
INSERT INTO funnels (id, user_id, name, description) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Lançamento de Curso Online', 'Funil para venda de curso online com upsell de mentoria'),
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Venda de E-book Digital', 'Funil para venda de e-book/infoproduto digital');

-- Funil 1: Lançamento de Curso Online
INSERT INTO funnel_stages (id, user_id, name, color, "order", funnel_id) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Lead Magneto', '#8B5CF6', 0, (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online')),
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Triplo Viral', '#F97316', 1, (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online')),
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Vendas - Curso', '#3B82F6', 2, (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online')),
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Upsell - Mentoria', '#10B981', 3, (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online')),
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Aluno Ativo', '#EAB308', 4, (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online'));

-- Funil 2: Venda de E-book/Infoproduto Digital
INSERT INTO funnel_stages (id, user_id, name, color, "order", funnel_id) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Pesquisa Orgânica', '#8B5CF6', 0, (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital')),
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Lead Magnet - E-book', '#F97316', 1, (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital')),
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Sequência de E-mails', '#3B82F6', 2, (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital')),
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Oferta - E-book Pro', '#10B981', 3, (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital')),
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Comprador', '#EAB308', 4, (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital'));
