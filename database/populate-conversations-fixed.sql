-- =====================================================
-- FlowLux - SELECTs para Pegar IDs Corretos
-- User ID: 56ed5bf7-c7ca-4497-aaf7-b202483a0b7b
-- =====================================================

-- SELECTs para pegar os IDs que vamos precisar
-- ===========================================

-- 1. IDs dos leads que vamos usar nas conversas
SELECT id, name, phone FROM leads 
WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' 
AND name IN ('João Silva', 'Maria Santos', 'Pedro Costa', 'Ana Oliveira');

-- 2. IDs das instâncias WhatsApp
SELECT id, instance_name, phone_number FROM whatsapp_instances 
WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b';

-- 3. IDs das tags (se precisarmos)
SELECT id, name FROM tags 
WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b';

-- =====================================================
-- FlowLux - Populate: Conversas e Mensagens WhatsApp (CORRIGIDO)
-- User ID: 56ed5bf7-c7ca-4497-aaf7-b202483a0b7b
-- =====================================================

-- 1. Conversas com Instância 6b4edc06-445e-4284-9b41-2a65c4e64eb9 (3 conversas)
-- =================================================================

-- Conversa 1: João Silva - Conversa sobre curso
INSERT INTO conversations (id, user_id, instance_id, remote_jid, contact_name, contact_phone, last_message, last_message_at, unread_count, created_at) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', '6b4edc06-445e-4284-9b41-2a65c4e64eb9', 
   '5511998765432@s.whatsapp.net', 'João Silva', '+5511998765432', 
   'Perfeito! Vou analisar e te dou uma resposta', NOW() - INTERVAL '1 hour', 0, NOW() - INTERVAL '2 days');

-- Mensagens da Conversa 1
INSERT INTO messages (id, conversation_id, remote_jid, from_me, message_type, content, status, created_at) VALUES
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511998765432@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511998765432@s.whatsapp.net', false, 'text', 'Oi! Vi seu anuncio do curso online', 'read', NOW() - INTERVAL '2 days'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511998765432@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511998765432@s.whatsapp.net', true, 'text', 'Ola Joao! Tudo bem? Qual curso tem interesse?', 'read', NOW() - INTERVAL '2 days' + INTERVAL '5 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511998765432@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511998765432@s.whatsapp.net', false, 'text', 'O curso de marketing digital para infoprodutores', 'read', NOW() - INTERVAL '2 days' + INTERVAL '10 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511998765432@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511998765432@s.whatsapp.net', true, 'text', 'Otimo escolha! O curso tem 10 modulos completos. Ja tem experiencia com marketing?', 'read', NOW() - INTERVAL '2 days' + INTERVAL '15 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511998765432@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511998765432@s.whatsapp.net', false, 'text', 'Trabalho com marketing digital ha 2 anos, quero melhorar nas vendas', 'read', NOW() - INTERVAL '2 days' + INTERVAL '20 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511998765432@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511998765432@s.whatsapp.net', true, 'text', 'Perfeito! O modulo de vendas e exatamente o que precisa. Tenho uma oferta especial hoje', 'read', NOW() - INTERVAL '2 days' + INTERVAL '25 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511998765432@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511998765432@s.whatsapp.net', true, 'text', 'De 997 por apenas 197. Parcelamos em 12x. Interessa?', 'read', NOW() - INTERVAL '2 days' + INTERVAL '30 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511998765432@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511998765432@s.whatsapp.net', false, 'text', 'Uau! Bem de bom! Posso parcelar no cartao?', 'read', NOW() - INTERVAL '2 days' + INTERVAL '35 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511998765432@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511998765432@s.whatsapp.net', true, 'text', 'Sim! 12x sem juros no cartao. Te envio o link agora', 'read', NOW() - INTERVAL '2 days' + INTERVAL '40 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511998765432@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511998765432@s.whatsapp.net', false, 'text', 'Perfeito! Vou analisar e te dou uma resposta', 'read', NOW() - INTERVAL '1 hour');

-- Conversa 2: Maria Santos - Dúvidas sobre e-book
INSERT INTO conversations (id, user_id, instance_id, remote_jid, contact_name, contact_phone, last_message, last_message_at, unread_count, created_at) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', '6b4edc06-445e-4284-9b41-2a65c4e64eb9', 
   '5511887654321@s.whatsapp.net', 'Maria Santos', '+5511887654321', 
   'Obrigada! Ja comprei', NOW() - INTERVAL '3 hours', 0, NOW() - INTERVAL '1 day');

-- Mensagens da Conversa 2
INSERT INTO messages (id, conversation_id, remote_jid, from_me, message_type, content, status, created_at) VALUES
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511887654321@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511887654321@s.whatsapp.net', false, 'text', 'Oi! Baixei seu e-book gratis', 'read', NOW() - INTERVAL '1 day'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511887654321@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511887654321@s.whatsapp.net', true, 'text', 'Ola Maria! Que bom que gostou! Ja leu algum capitulo?', 'read', NOW() - INTERVAL '1 day' + INTERVAL '10 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511887654321@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511887654321@s.whatsapp.net', false, 'text', 'Li o primeiro sobre funis de vendas, muito bom!', 'read', NOW() - INTERVAL '1 day' + INTERVAL '20 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511887654321@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511887654321@s.whatsapp.net', true, 'text', 'Maravilha! O funil e a base de tudo. Ja aplicou alguma estrategia?', 'read', NOW() - INTERVAL '1 day' + INTERVAL '30 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511887654321@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511887654321@s.whatsapp.net', false, 'text', 'Ainda nao, mas quero muito. Tenho um servico de coaching', 'read', NOW() - INTERVAL '1 day' + INTERVAL '40 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511887654321@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511887654321@s.whatsapp.net', true, 'text', 'Perfeito! Coaching funciona muito bem com funis. Tenho o e-book avancado sobre isso', 'read', NOW() - INTERVAL '1 day' + INTERVAL '50 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511887654321@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511887654321@s.whatsapp.net', false, 'text', 'Quanto custa e o que tem?', 'read', NOW() - INTERVAL '1 day' + INTERVAL '1 hour'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511887654321@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511887654321@s.whatsapp.net', true, 'text', 'O e-book Pro tem 50 paginas, com exemplos prontos. De 197 por 97 hoje', 'read', NOW() - INTERVAL '1 day' + INTERVAL '1 hour' + INTERVAL '10 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511887654321@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511887654321@s.whatsapp.net', false, 'text', 'Aceito! Como faco para comprar?', 'read', NOW() - INTERVAL '1 day' + INTERVAL '1 hour' + INTERVAL '20 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511887654321@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511887654321@s.whatsapp.net', true, 'text', 'Te envio o link de pagamento: [link_pagamento]', 'read', NOW() - INTERVAL '1 day' + INTERVAL '1 hour' + INTERVAL '30 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511887654321@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511887654321@s.whatsapp.net', false, 'text', 'Obrigada! Ja comprei', 'read', NOW() - INTERVAL '3 hours');

-- Conversa 3: Pedro Costa - Agendamento mentoria
INSERT INTO conversations (id, user_id, instance_id, remote_jid, contact_name, contact_phone, last_message, last_message_at, unread_count, created_at) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', '6b4edc06-445e-4284-9b41-2a65c4e64eb9', 
   '5511776543210@s.whatsapp.net', 'Pedro Costa', '+5511776543210', 
   'Ok! Aguardo a confirmacao', NOW() - INTERVAL '30 minutes', 0, NOW() - INTERVAL '6 hours');

-- Mensagens da Conversa 3
INSERT INTO messages (id, conversation_id, remote_jid, from_me, message_type, content, status, created_at) VALUES
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511776543210@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511776543210@s.whatsapp.net', false, 'text', 'Boa tarde! Vi que voce faz mentoria individual', 'read', NOW() - INTERVAL '6 hours'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511776543210@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511776543210@s.whatsapp.net', true, 'text', 'Ola Pedro! Sim, faco mentoria. Qual sua area de negocio?', 'read', NOW() - INTERVAL '6 hours' + INTERVAL '15 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511776543210@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511776543210@s.whatsapp.net', false, 'text', 'Tenho uma agencia de marketing digital, 5 funcionarios', 'read', NOW() - INTERVAL '6 hours' + INTERVAL '30 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511776543210@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511776543210@s.whatsapp.net', true, 'text', 'Excelente! Agencias se beneficiam muito da mentoria. Qual seu principal desafio?', 'read', NOW() - INTERVAL '6 hours' + INTERVAL '45 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511776543210@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511776543210@s.whatsapp.net', false, 'text', 'Escalagem. Consequimos clientes, mas dificil crescer', 'read', NOW() - INTERVAL '6 hours' + INTERVAL '1 hour'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511776543210@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511776543210@s.whatsapp.net', true, 'text', 'Entendi! Escalagem e meu forte. Trabalho com processos e automacao', 'read', NOW() - INTERVAL '6 hours' + INTERVAL '1 hour' + INTERVAL '15 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511776543210@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511776543210@s.whatsapp.net', true, 'text', 'A mentoria inclui: diagnostico completo, plano de acao, e acompanhamento por 30 dias', 'read', NOW() - INTERVAL '6 hours' + INTERVAL '1 hour' + INTERVAL '30 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511776543210@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511776543210@s.whatsapp.net', false, 'text', 'Qual o investimento e como funciona?', 'read', NOW() - INTERVAL '6 hours' + INTERVAL '1 hour' + INTERVAL '45 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511776543210@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511776543210@s.whatsapp.net', true, 'text', 'Investimento 497. Inclui 3 sessoes de 1h e suporte por 30 dias. Pode parcelar', 'read', NOW() - INTERVAL '6 hours' + INTERVAL '2 hours'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511776543210@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511776543210@s.whatsapp.net', false, 'text', 'Interessa! Quando podemos comecar?', 'read', NOW() - INTERVAL '6 hours' + INTERVAL '2 hours' + INTERVAL '30 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511776543210@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511776543210@s.whatsapp.net', true, 'text', 'Tenho amanha as 14h ou sexta as 10h. Qual prefere?', 'read', NOW() - INTERVAL '6 hours' + INTERVAL '3 hours'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511776543210@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511776543210@s.whatsapp.net', false, 'text', 'Sexta as 10h fica otimo', 'read', NOW() - INTERVAL '6 hours' + INTERVAL '3 hours' + INTERVAL '30 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511776543210@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511776543210@s.whatsapp.net', true, 'text', 'Perfeito! Te envio link de pagamento e confirmacao. Aguardo pagamento para confirmar', 'read', NOW() - INTERVAL '6 hours' + INTERVAL '4 hours'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511776543210@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511776543210@s.whatsapp.net', false, 'text', 'Ok! Aguardo a confirmacao', 'read', NOW() - INTERVAL '30 minutes');

-- 2. Conversa com Instância 80333498-f340-4094-b5e9-b159cd1a46bb (1 conversa)
-- =================================================================

-- Conversa 4: Ana Oliveira - Suporte pós-venda
INSERT INTO conversations (id, user_id, instance_id, remote_jid, contact_name, contact_phone, last_message, last_message_at, unread_count, created_at) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', '80333498-f340-4094-b5e9-b159cd1a46bb', 
   '5511665432109@s.whatsapp.net', 'Ana Oliveira', '+5511665432109', 
   'Perfeito! Obrigado pelo suporte', NOW() - INTERVAL '2 hours', 0, NOW() - INTERVAL '5 hours');

-- Mensagens da Conversa 4
INSERT INTO messages (id, conversation_id, remote_jid, from_me, message_type, content, status, created_at) VALUES
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511665432109@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511665432109@s.whatsapp.net', false, 'text', 'Oi! Comprei seu curso ontem mas nao consegui acessar', 'read', NOW() - INTERVAL '5 hours'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511665432109@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511665432109@s.whatsapp.net', true, 'text', 'Ola Ana! Tudo bem? Vou te ajudar a acessar. Qual seu email de cadastro?', 'read', NOW() - INTERVAL '5 hours' + INTERVAL '10 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511665432109@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511665432109@s.whatsapp.net', false, 'text', 'ana.oliveira@email.com', 'read', NOW() - INTERVAL '5 hours' + INTERVAL '20 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511665432109@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511665432109@s.whatsapp.net', true, 'text', 'Achei seu cadastro. Vou resetar sua senha. Ja te enviei no email', 'read', NOW() - INTERVAL '5 hours' + INTERVAL '30 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511665432109@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511665432109@s.whatsapp.net', false, 'text', 'Nao recebi o email. Pode ser na caixa de spam?', 'read', NOW() - INTERVAL '5 hours' + INTERVAL '45 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511665432109@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511665432109@s.whatsapp.net', true, 'text', 'Sim, verifica na pasta spam. O assunto e "Redefinicao de senha"', 'read', NOW() - INTERVAL '5 hours' + INTERVAL '1 hour'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511665432109@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511665432109@s.whatsapp.net', false, 'text', 'Achei! Obrigada. Ja consegui acessar', 'read', NOW() - INTERVAL '5 hours' + INTERVAL '1 hour' + INTERVAL '15 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511665432109@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511665432109@s.whatsapp.net', true, 'text', 'Maravilha! Alguma outra duvida sobre o curso?', 'read', NOW() - INTERVAL '5 hours' + INTERVAL '1 hour' + INTERVAL '30 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511665432109@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511665432109@s.whatsapp.net', false, 'text', 'Sim, por onde devo comecar? Tem muitos modulos', 'read', NOW() - INTERVAL '5 hours' + INTERVAL '1 hour' + INTERVAL '45 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511665432109@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511665432109@s.whatsapp.net', true, 'text', 'Recomendo comecar pelo Modulo 1 - Fundamentos. Depois va para o Modulo 2', 'read', NOW() - INTERVAL '5 hours' + INTERVAL '2 hours'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511665432109@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511665432109@s.whatsapp.net', true, 'text', 'E nao pule as aulas praticas. Sao elas que fazem a diferenca', 'read', NOW() - INTERVAL '5 hours' + INTERVAL '2 hours' + INTERVAL '15 minutes'),
   
  (gen_random_uuid(), (SELECT id FROM conversations WHERE remote_jid = '5511665432109@s.whatsapp.net' AND user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' LIMIT 1), 
   '5511665432109@s.whatsapp.net', false, 'text', 'Perfeito! Obrigado pelo suporte', 'read', NOW() - INTERVAL '2 hours');
