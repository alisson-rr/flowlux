-- =====================================================
-- FlowLux - Populate: Fluxos de Automação para Infoprodutor
-- User ID: 56ed5bf7-c7ca-4497-aaf7-b202483a0b7b
-- =====================================================

-- Fluxo 1: Boas-vindas Automáticas para Novos Leads
INSERT INTO flows (id, user_id, name, description, trigger_type, is_active) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Boas-vindas Automáticas', 
   'Envia sequência de boas-vindas para novos leads que entram no funil', 'manual', true);

INSERT INTO flow_steps (id, flow_id, step_order, step_type, content, delay_seconds) VALUES
  (gen_random_uuid(), (SELECT id FROM flows WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Boas-vindas Automáticas'), 0, 'text', 
   'Olá {nome}! 👋 Seja bem-vindo(a) ao nosso canal! 🎉\n\nVi seu interesse no nosso material e já preparei tudo para você. Tenho um conteúdo exclusivo que vai ajudar muito nos seus resultados!\n\nQuer receber o material agora mesmo?', 0),
   
  (gen_random_uuid(), (SELECT id FROM flows WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Boas-vindas Automáticas'), 1, 'delay', 
   '300', 300),
   
  (gen_random_uuid(), (SELECT id FROM flows WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Boas-vindas Automáticas'), 2, 'text', 
   'Perfeito! Já enviei o material para seu e-mail. 📧\n\n🔍 Verifique sua caixa de entrada e a pasta de spam!\n\nO conteúdo é prático e já pode ser aplicado hoje mesmo! 🚀\n\nDepois me avise se tiver alguma dúvida! 💪', 0);

-- Fluxo 2: Nutrição de Leads - Conteúdo Gratuito
INSERT INTO flows (id, user_id, name, description, trigger_type, keywords, is_active) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Nutrição de Leads', 
   'Envia dicas valiosas e conteúdo gratuito para nutrir leads', 'keyword', ARRAY['sim', 'quero', 'aceito', 'confirmo'], true);

INSERT INTO flow_steps (id, flow_id, step_order, step_type, content, delay_seconds) VALUES
  (gen_random_uuid(), (SELECT id FROM flows WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Nutrição de Leads'), 0, 'text', 
   'Excelente {nome}! 🌟\n\nAqui vai a primeira dica exclusiva:\n\n💡 **DICA 1:** O segredo não está em ter mais leads, mas em ter as conversas certas! Foque em QUALIDADE vs QUANTIDADE.\n\nQuer mais dicas como esta?', 0),
   
  (gen_random_uuid(), (SELECT id FROM flows WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Nutrição de Leads'), 1, 'delay', 
   '86400', 86400),
   
  (gen_random_uuid(), (SELECT id FROM flows WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Nutrição de Leads'), 2, 'text', 
   'Bom dia {nome}! ☀️\n\n💡 **DICA 2:** Use gatilhos mentais nas suas mensagens!\n\n• Escassez: "Apenas 3 vagas restantes"\n• Urgência: "Oferta termina hoje"\n• Prova Social: "Mais de 100 alunos satisfeitos"\n\nAplicou alguma dessas? Me conte o resultado! 📊', 0),
   
  (gen_random_uuid(), (SELECT id FROM flows WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Nutrição de Leads'), 3, 'delay', 
   '86400', 86400),
   
  (gen_random_uuid(), (SELECT id FROM flows WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Nutrição de Leads'), 4, 'text', 
   'Oi {nome}! 👋\n\n💡 **DICA 3:** Crie uma sequência de 3 mensagens!\n\n1. **Conexão:** Pergunte sobre o dia/desafio\n2. **Valor:** Compartilhe uma dica útil\n3. **Chamada:** Convide para próximo passo\n\nTeste e me diga como funcionou! 🚀', 0);

-- Fluxo 3: Convite para Webinar
INSERT INTO flows (id, user_id, name, description, trigger_type, keywords, is_active) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Convite Webinar', 
   'Convida leads para webinars e aulas ao vivo', 'keyword', ARRAY['webinar', 'aula', 'ao vivo', 'evento'], true);

INSERT INTO flow_steps (id, flow_id, step_order, step_type, content, delay_seconds) VALUES
  (gen_random_uuid(), (SELECT id FROM flows WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Convite Webinar'), 0, 'text', 
   '🔥 **WEBINAR EXCLUSIVO** 🔥\n\nPerfeito {nome}! Tenho uma vaga reservada para você!\n\n📚 **Tópico:** "Como Vender Infoprodutos em 30 Dias"\n🗓️ **Data:** {data_webinar}\n⏰ **Horário:** {horario_webinar}\n\n⭐ **O que vai aprender:**\n• Estratégia de lançamento\n• Como criar ofertas irresistíveis\n• Tráfego qualificado\n• Escalagem de vendas\n\n🎁 **BÔNUS:** E-book exclusivo para presentes!\n\n**Vagas limitadas!** Quer reservar agora?', 0),
   
  (gen_random_uuid(), (SELECT id FROM flows WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Convite Webinar'), 1, 'delay', 
   '3600', 3600),
   
  (gen_random_uuid(), (SELECT id FROM flows WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Convite Webinar'), 2, 'text', 
   '⏰ **ÚLTIMA CHANCE** ⏰\n\n{nome}, restam apenas {vagas_restantes} vagas para o webinar!\n\n🔗 **Link para inscrição:** {link_webinar}\n\nNão perca essa oportunidade de transformar seus resultados! 🚀\n\nMe avise quando se inscrever! ✅', 0);

-- Fluxo 4: Venda de Curso/E-book
INSERT INTO flows (id, user_id, name, description, trigger_type, keywords, is_active) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Venda de Produto', 
   'Apresenta oferta de cursos e e-books para leads qualificados', 'keyword', ARRAY['comprar', 'preço', 'valor', 'curso', 'e-book', 'produto'], true);

INSERT INTO flow_steps (id, flow_id, step_order, step_type, content, delay_seconds) VALUES
  (gen_random_uuid(), (SELECT id FROM flows WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de Produto'), 0, 'text', 
   '🎓 **OFERTA ESPECIAL PARA VOCÊ** 🎓\n\n{nome}, vi seu interesse e preparei uma condição especial!\n\n📚 **{nome_produto}**\n\n✅ Módulos completos\n✅ Suporte direto\n✅ Bônus exclusivos\n✅ Certificado\n\n💰 **Investimento:** De R$ {preco_cheio} por R$ {preco_oferta}\n🔥 **Parcelamos em até {parcelas}x!**\n\nQuer saber mais detalhes?', 0),
   
  (gen_random_uuid(), (SELECT id FROM flows WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de Produto'), 1, 'delay', 
   '1800', 1800),
   
  (gen_random_uuid(), (SELECT id FROM flows WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Venda de Produto'), 2, 'text', 
   '⚡ **DETALHES DO PRODUTO** ⚡\n\n{nome}, aqui está tudo o que você recebe:\n\n📖 **Módulo 1:** {modulo1}\n📖 **Módulo 2:** {modulo2}\n📖 **Módulo 3:** {modulo3}\n\n🎁 **BÔNUS ESPECIAL:** {bonus}\n\n🛡️ **GARANTIA:** 7 dias para testar sem risco!\n\n🚀 **Link para compra:** {link_compra}\n\nAcesso imediato após pagamento! 💳', 0);

-- Fluxo 5: Lembrete de Aula/Evento
INSERT INTO flows (id, user_id, name, description, trigger_type, schedule_cron, is_active) VALUES
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Lembrete de Aulas', 
   'Envia lembretes automáticos para aulas e eventos ao vivo', 'schedule', '0 19 * * 1,3,5', true);

INSERT INTO flow_steps (id, flow_id, step_order, step_type, content, delay_seconds) VALUES
  (gen_random_uuid(), (SELECT id FROM flows WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lembrete de Aulas'), 0, 'text', 
   '⏰ **LEMBRETE - AULA AO VIVO** ⏰\n\nOlá {nome}!\n\nSua aula começa em **30 minutos**! ⚡\n\n📺 **Tópico:** {assunto_aula}\n🕐 **Horário:** {horario_aula}\n🔗 **Link:** {link_aula}\n\n💡 **Prepare-se:**\n• Notebook e caneta\n• Internet estável\n• Dúvidas prontas\n\nTe vejo lá! 🎥✨', 0),
   
  (gen_random_uuid(), (SELECT id FROM flows WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lembrete de Aulas'), 1, 'delay', 
   '900', 900),
   
  (gen_random_uuid(), (SELECT id FROM flows WHERE user_id = '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b' AND name = 'Lembrete de Aulas'), 2, 'text', 
   '🔥 **COMEÇANDO AGORA!** 🔥\n\n{nome}, a aula está começando!\n\n🔗 **Entre agora:** {link_aula}\n\nNão perca o início! 🚀\n\nProblemas técnicos? Me chame no WhatsApp: {whatsapp_suporte}', 0);

-- =====================================================
-- RESUMO DO POPULATE:
-- ✅ 5 Fluxos de automação completos
-- ✅ Fluxo 1: Boas-vindas (3 passos)
-- ✅ Fluxo 2: Nutrição de Leads (5 passos)
-- ✅ Fluxo 3: Convite Webinar (3 passos)
-- ✅ Fluxo 4: Venda de Produto (3 passos)
-- ✅ Fluxo 5: Lembrete de Aulas (3 passos)
-- ✅ Total: 17 passos de automação
-- ✅ Diferentes gatilhos: manual, keyword, schedule
-- ✅ Conteúdo otimizado para infoprodutores
-- =====================================================
