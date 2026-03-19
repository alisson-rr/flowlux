-- =====================================================
-- FlowLux - Populate: Leads, Notas e Tags para Infoprodutor
-- User ID: 56ed5bf7-c7ca-4497-aaf7-b202483a0b7b
-- =====================================================

-- 1. Criar tags para organização
INSERT INTO tags (id, user_id, name, color) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Alto Potencial', '#10B981'),
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Contato Quente', '#F97316'),
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Newsletter', '#3B82F6'),
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'VIP', '#8B5CF6'),
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Seguimento', '#EAB308'),
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Interesse em Curso', '#EF4444'),
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Interesse em E-book', '#06B6D4'),
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Lead Frio', '#6B7280'),
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Prospecção Ativa', '#F59E0B'),
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Cliente Anterior', '#8B5CF6');

-- 2. Leads para Funil 1: Lançamento de Curso Online (15 leads)
INSERT INTO leads (id, user_id, name, phone, email, source, funnel_id, stage_id, created_at) VALUES
  -- Etapa: Lead Magneto (5 leads)
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'João Silva', '+5511998765432', 'joao.silva@email.com', 'Instagram Ads', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lead Magneto'), NOW() - INTERVAL '7 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Maria Santos', '+5511887654321', 'maria.santos@email.com', 'Lead Magnet', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lead Magneto'), NOW() - INTERVAL '5 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Pedro Costa', '+5511776543210', 'pedro.costa@email.com', 'Facebook Group', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lead Magneto'), NOW() - INTERVAL '3 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Ana Oliveira', '+5511665432109', 'ana.oliveira@email.com', 'YouTube', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lead Magneto'), NOW() - INTERVAL '2 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Carlos Ferreira', '+5511554321098', 'carlos.ferreira@email.com', 'Indicação', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lead Magneto'), NOW() - INTERVAL '1 day'),
   
  -- Etapa: Triplo Viral (3 leads)
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Lucia Mendes', '+5521998765432', 'lucia.mendes@email.com', 'Instagram Ads', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Triplo Viral'), NOW() - INTERVAL '6 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Roberto Alves', '+5521887654321', 'roberto.alves@email.com', 'Lead Magnet', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Triplo Viral'), NOW() - INTERVAL '4 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Fernanda Lima', '+5521776543210', 'fernanda.lima@email.com', 'Facebook Group', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Triplo Viral'), NOW() - INTERVAL '3 days'),
   
  -- Etapa: Vendas - Curso (4 leads)
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Marcos Barbosa', '+5521665432109', 'marcos.barbosa@email.com', 'YouTube', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Vendas - Curso'), NOW() - INTERVAL '5 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Juliana Castro', '+5521554321098', 'juliana.castro@email.com', 'Indicação', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Vendas - Curso'), NOW() - INTERVAL '3 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Ricardo Souza', '+5531998765432', 'ricardo.souza@email.com', 'Instagram Ads', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Vendas - Curso'), NOW() - INTERVAL '2 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Camila Dias', '+5531887654321', 'camila.dias@email.com', 'Webinar', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Vendas - Curso'), NOW() - INTERVAL '1 day'),
   
  -- Etapa: Upsell - Mentoria (2 leads)
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Bruno Cardoso', '+5531776543210', 'bruno.cardoso@email.com', 'YouTube', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Upsell - Mentoria'), NOW() - INTERVAL '4 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Tatiana Ribeiro', '+5531665432109', 'tatiana.ribeiro@email.com', 'Indicação', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Upsell - Mentoria'), NOW() - INTERVAL '2 days'),
   
  -- Etapa: Aluno Ativo (1 lead)
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Felipe Gomes', '+5531554321098', 'felipe.gomes@email.com', 'Instagram Ads', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Aluno Ativo'), NOW() - INTERVAL '6 days');

-- 3. Leads para Funil 2: Venda de E-book Digital (15 leads)
INSERT INTO leads (id, user_id, name, phone, email, source, funnel_id, stage_id, created_at) VALUES
  -- Etapa: Pesquisa Orgânica (4 leads)
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Paulo Henrique', '+5541998765432', 'paulo.henrique@email.com', 'Google Search', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Pesquisa Orgânica'), NOW() - INTERVAL '8 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Aline Costa', '+5541887654321', 'aline.costa@email.com', 'Blog Post', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Pesquisa Orgânica'), NOW() - INTERVAL '6 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Gustavo Silva', '+5541776543210', 'gustavo.silva@email.com', 'Pinterest', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Pesquisa Orgânica'), NOW() - INTERVAL '4 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Renata Alves', '+5541665432109', 'renata.alves@email.com', 'LinkedIn', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Pesquisa Orgânica'), NOW() - INTERVAL '3 days'),
   
  -- Etapa: Lead Magnet - E-book (4 leads)
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Diego Oliveira', '+5541554321098', 'diego.oliveira@email.com', 'Webinar', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lead Magnet - E-book'), NOW() - INTERVAL '7 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Carla Mendes', '+5551998765432', 'carla.mendes@email.com', 'Google Search', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lead Magnet - E-book'), NOW() - INTERVAL '5 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Leonardo Santos', '+5551887654321', 'leonardo.santos@email.com', 'Blog Post', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lead Magnet - E-book'), NOW() - INTERVAL '4 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Mariana Costa', '+5551776543210', 'mariana.costa@email.com', 'Pinterest', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lead Magnet - E-book'), NOW() - INTERVAL '3 days'),
   
  -- Etapa: Sequência de E-mails (3 leads)
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Thiago Ferreira', '+5551665432109', 'thiago.ferreira@email.com', 'LinkedIn', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Sequência de E-mails'), NOW() - INTERVAL '6 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Beatriz Lima', '+5551554321098', 'beatriz.lima@email.com', 'Webinar', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Sequência de E-mails'), NOW() - INTERVAL '4 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Rafael Barbosa', '+5561998765432', 'rafael.barbosa@email.com', 'Google Search', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Sequência de E-mails'), NOW() - INTERVAL '2 days'),
   
  -- Etapa: Oferta - E-book Pro (3 leads)
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Isabel Castro', '+5561887654321', 'isabel.castro@email.com', 'Blog Post', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Oferta - E-book Pro'), NOW() - INTERVAL '5 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'André Dias', '+5561776543210', 'andre.dias@email.com', 'Pinterest', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Oferta - E-book Pro'), NOW() - INTERVAL '3 days'),
   
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Laura Cardoso', '+5561665432109', 'laura.cardoso@email.com', 'LinkedIn', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Oferta - E-book Pro'), NOW() - INTERVAL '1 day'),
   
  -- Etapa: Comprador (1 lead)
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Gabriel Ribeiro', '+5561554321098', 'gabriel.ribeiro@email.com', 'Webinar', 
   (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital'),
   (SELECT id FROM funnel_stages WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Comprador'), NOW() - INTERVAL '7 days');

-- 4. Associar tags aos leads (lead_tags)
INSERT INTO lead_tags (id, lead_id, tag_id) 
SELECT gen_random_uuid(), l.id, t.id
FROM leads l
CROSS JOIN tags t
WHERE l.user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b'
  AND t.user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b'
  AND (
    -- Leads do funil 1 com tags específicas
    (l.funnel_id = (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lançamento de Curso Online') 
     AND t.name IN ('Alto Potencial', 'Contato Quente', 'Interesse em Curso', 'VIP'))
    OR
    -- Leads do funil 2 com tags específicas
    (l.funnel_id = (SELECT id FROM funnels WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de E-book Digital') 
     AND t.name IN ('Newsletter', 'Interesse em E-book', 'Lead Frio', 'Prospecção Ativa'))
  )
LIMIT 45; -- Aproximadamente 1-3 tags por lead

-- 5. Notas para alguns leads selecionados
INSERT INTO notes (id, lead_id, user_id, content, created_at) VALUES
  -- Notas para leads do funil 1
  (gen_random_uuid(), (SELECT id FROM leads WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'João Silva' LIMIT 1), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 
   'Cliente muito interessado no curso. Perguntou sobre módulo avançado e já tem experiência com marketing digital.', NOW() - INTERVAL '6 days'),
   
  (gen_random_uuid(), (SELECT id FROM leads WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Maria Santos' LIMIT 1), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 
   'Fez todas as aulas gratuitas. Mencionou que está esperando o salário para comprar. Agendar follow-up dia 15.', NOW() - INTERVAL '4 days'),
   
  (gen_random_uuid(), (SELECT id FROM leads WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Bruno Cardoso' LIMIT 1), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 
   'Comprou o curso e já manifestou interesse na mentoria individual. Tem um negócio de e-commerce que está decolando.', NOW() - INTERVAL '3 days'),
   
  (gen_random_uuid(), (SELECT id FROM leads WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Felipe Gomes' LIMIT 1), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 
   'Aluno exemplar! Já implementou 3 estratégias do curso e teve aumento de 40% nas vendas. Pediu para gravar depoimento.', NOW() - INTERVAL '5 days'),
   
  -- Notas para leads do funil 2
  (gen_random_uuid(), (SELECT id FROM leads WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Paulo Henrique' LIMIT 1), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 
   'Encontrou o blog pesquisando sobre "como vender infoprodutos". Baixou o e-book gratuito mas ainda não abriu os e-mails.', NOW() - INTERVAL '7 days'),
   
  (gen_random_uuid(), (SELECT id FROM leads WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Aline Costa' LIMIT 1), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 
   'Leu o e-book completo e mandou mensagem agradecendo. Dúvida sobre como aplicar para serviços físicos.', NOW() - INTERVAL '5 days'),
   
  (gen_random_uuid(), (SELECT id FROM leads WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Isabel Castro' LIMIT 1), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 
   'Está na etapa de oferta. Perguntou se tem garantia e se pode parcelar. Mencionou que já comprou outros cursos.', NOW() - INTERVAL '4 days'),
   
  (gen_random_uuid(), (SELECT id FROM leads WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Gabriel Ribeiro' LIMIT 1), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 
   'COMPRA EFETUADA! Comprou o E-book Pro. Já pediu indicação para curso avançado. Cliente satisfeito!', NOW() - INTERVAL '6 days'),
   
  -- Notas adicionais
  (gen_random_uuid(), (SELECT id FROM leads WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Marcos Barbosa' LIMIT 1), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 
   'Tem uma agência digital com 5 funcionários. Interessado em compra corporativa para equipe.', NOW() - INTERVAL '4 days'),
   
  (gen_random_uuid(), (SELECT id FROM leads WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Carla Mendes' LIMIT 1), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 
   'Coach de carreira. Quer usar o conteúdo para ajudar clientes a monetizar conhecimento.', NOW() - INTERVAL '3 days');

-- =====================================================
-- RESUMO DO POPULATE:
-- ✅ 10 Tags organizacionais
-- ✅ 30 Leads totais (15 por funil)
-- ✅ Leads distribuídos em todas as etapas dos funis
-- ✅ Aproximadamente 45 associações de tags (1-3 tags por lead)
-- ✅ 10 Notas detalhadas para leads selecionados
-- =====================================================
