-- =====================================================
-- FlowLux - Populate: Mensagens em Massa e Agendadas
-- User ID: 56ed5bf7-c7ca-4497-aaf7-b202483a0b7b
-- =====================================================

-- 1. Mensagens em Massa (3 disparos)
-- ================================

-- Mass Message 1: Campanha de Lançamento - COMPLETO
INSERT INTO mass_messages (id, user_id, name, message, target_tags, target_stages, status, sent_count, total_count, created_at) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Campanha Lançamento Curso', 
   'LANÇAMENTO IMPERDÍVEL! Olá! Tenho uma novidade exclusiva para você. Curso Completo: Marketing Digital para Infoprodutores. 10 módulos intensivos, Suporte individual, Comunidade VIP, Bônus exclusivos. Oferta de Lançamento: De R$ 997 por apenas R$ 197! Parcelamos em até 12x! Acesso vitalício + atualizações gratuitas! Início: 15 de Março. Vagas: Limitadas a 50 alunos. Garanta sua vaga: [link]. Não perca essa oportunidade!', 
   ARRAY['Alto Potencial', 'Contato Quente'], 
   ARRAY['Lead Magneto', 'Triplo Viral'], 
   'completed', 127, 127, NOW() - INTERVAL '5 days');

-- Mass Message 2: Black Friday - COMPLETO
INSERT INTO mass_messages (id, user_id, name, message, target_tags, target_stages, status, sent_count, total_count, created_at) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Black Friday - Super Oferta', 
   'BLACK FRIDAY - OFERTA MÁXIMA! Só hoje! Desconto imperdível em todos os produtos. CURSO PROFESSIONAL: De R$ 1.997 por R$ 497. Economia de R$ 1.500! E-BOOK DIGITAL: De R$ 197 por R$ 47. Economia de 76%! MENTORIA INDIVIDUAL: De R$ 2.997 por R$ 997. Economia de R$ 2.000! 12x sem juros no cartão. Oferta válida até 23:59 de hoje! Compre agora: [link_black_friday]. Aproveite! Essa oferta não se repete!', 
   ARRAY['Newsletter', 'Interesse em Curso', 'Interesse em E-book'], 
   ARRAY['Pesquisa Orgânica', 'Lead Magnet - E-book', 'Sequência de E-mails'], 
   'completed', 89, 89, NOW() - INTERVAL '2 days');

-- Mass Message 3: Campanha de Natal - AGENDADO
INSERT INTO mass_messages (id, user_id, name, message, target_tags, target_stages, status, scheduled_at, sent_count, total_count, created_at) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Campanha Natal Especial', 
   'NATAL ESPECIAL - PRESENTE PERFEITO! Que tal presentear alguém (ou você mesmo) com o presente que transforma resultados? SUPER PACOTE NATAL: Curso Completo (valor: R$ 997), E-book Digital (valor: R$ 197), Mentoria 1h (valor: R$ 497), Acesso Comunidade (valor: R$ 97/mês). Valor total: R$ 1.788. Preço especial: Apenas R$ 497! 12x de R$ 41,42 sem juros. Oferta de Natal: Válida até 25/12. Bônus extra: E-book exclusivo para presentes! Presenteie com resultado: [link_natal]. Transforme 2025 em seu ano de sucesso!', 
   ARRAY['VIP', 'Alto Potencial', 'Seguimento'], 
   ARRAY['Vendas - Curso', 'Oferta - E-book Pro', 'Upsell - Mentoria'], 
   'scheduled', NOW() + INTERVAL '3 days', 0, 150, NOW() - INTERVAL '1 day');

-- 2. Mensagens Agendadas (5 mensagens)
-- ===================================

-- Scheduled Message 1: Follow-up Pós Webinar
INSERT INTO scheduled_messages (id, user_id, lead_id, instance_id, message, scheduled_at, status, created_at) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 
   (SELECT id FROM leads WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'João Silva' LIMIT 1),
   (SELECT id FROM whatsapp_instances WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1),
   'Oi João! Como foi o webinar ontem? Vi que você participou ativamente das perguntas! Tem alguma dúvida sobre o conteúdo que apresentei? Se quiser avançar mais rápido, tenho uma condição especial para o curso completo. Quer saber mais?', 
   NOW() + INTERVAL '2 hours', 'pending', NOW() - INTERVAL '1 hour');

-- Scheduled Message 2: Lembrete Oferta Última Hora
INSERT INTO scheduled_messages (id, user_id, lead_id, instance_id, message, scheduled_at, status, created_at) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 
   (SELECT id FROM leads WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Maria Santos' LIMIT 1),
   (SELECT id FROM whatsapp_instances WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1),
   'ULTIMA HORA - OFERTA EXPIRANDO! Maria! Sua oferta especial expira em 2 horas! Curso: Marketing Digital Avançado. Preço: R$ 197 (de R$ 997). Economia: R$ 800! Garanta agora: [link_urgente]. Não perca essa chance!', 
   NOW() + INTERVAL '1 hour', 'pending', NOW() - INTERVAL '30 minutes');

-- Scheduled Message 3: Follow-up Pós Compra
INSERT INTO scheduled_messages (id, user_id, lead_id, instance_id, message, scheduled_at, status, created_at) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 
   (SELECT id FROM leads WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Felipe Gomes' LIMIT 1),
   (SELECT id FROM whatsapp_instances WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1),
   'PARABÉNS FELIPE! Sua compra foi aprovada com sucesso! Acesso enviado para seu e-mail. Verifique a caixa de entrada. Acesso imediato à plataforma. Dica: Comece pelo Módulo 1 e participe da comunidade VIP! Precisando de algo? Estou aqui! Bons estudos!', 
   NOW() + INTERVAL '30 minutes', 'pending', NOW() - INTERVAL '2 hours');

-- Scheduled Message 4: Convite Mentoria Individual
INSERT INTO scheduled_messages (id, user_id, lead_id, instance_id, message, scheduled_at, status, created_at) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 
   (SELECT id FROM leads WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Bruno Cardoso' LIMIT 1),
   (SELECT id FROM whatsapp_instances WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1),
   'MENTORIA EXCLUSIVA! Bruno! Vi seu progresso no curso e tenho uma proposta especial: Sessão estratégica de 1h, Plano de ação personalizado, Metas claras e alcançáveis, Análise do seu negócio. Investimento: Apenas R$ 297. Normalmente: R$ 497. Vagas: Apenas 2 esta semana! Quer agendar?', 
   NOW() + INTERVAL '4 hours', 'pending', NOW() - INTERVAL '3 hours');

-- Scheduled Message 5: Lembrete Aula Ao Vivo
INSERT INTO scheduled_messages (id, user_id, lead_id, instance_id, message, scheduled_at, status, created_at) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 
   (SELECT id FROM leads WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Marcos Barbosa' LIMIT 1),
   (SELECT id FROM whatsapp_instances WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1),
   'LEMBRETE - AULA AO VIVO! Marcos! Sua aula exclusiva começa em 1 hora! Tópico: Estratégias de Escalagem para 2025. Horário: 20h. Link: [link_aula]. Prepare-se: Dúvidas prontas, Notebook e caneta, Internet estável. Bônus: E-book exclusivo para presentes! Te vejo lá!', 
   NOW() + INTERVAL '1 hour', 'pending', NOW() - INTERVAL '15 minutes');

-- =====================================================
-- RESUMO DO POPULATE:
-- ✅ 3 Mensagens em Massa:
--    - 1 Campanha Lançamento (completed - 127 envios)
--    - 1 Black Friday (completed - 89 envios)  
--    - 1 Campanha Natal (scheduled - 150 previstos)
-- 
-- ✅ 5 Mensagens Agendadas:
--    - 1 Follow-up Pós Webinar (pending - 2 horas)
--    - 1 Oferta Última Hora (pending - 1 hora)
--    - 1 Follow-up Pós Compra (pending - 30 minutos)
--    - 1 Convite Mentoria (pending - 4 horas)
--    - 1 Lembrete Aula (pending - 1 hora)
-- 
-- ✅ Status variados: completed e scheduled/pending
-- ✅ Conteúdo otimizado para infoprodutores
-- ✅ Diferentes propósitos: vendas, follow-up, lembretes
-- =====================================================
