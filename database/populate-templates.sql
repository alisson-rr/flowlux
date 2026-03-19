-- =====================================================
-- FlowLux - Populate: Mensagens Prontas para Infoprodutor
-- User ID: 56ed5bf7-c7ca-4497-aaf7-b202483a0b7b
-- =====================================================

INSERT INTO message_templates (id, user_id, name, content, category) VALUES
  -- Template 1: Boas-vindas Lead Magnet
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Boas-vindas Lead Magnet', 
   'Olá {nome}! 👋 Seja bem-vindo(a) ao nosso canal! 🎉\n\nRecebi seu interesse no nosso material exclusivo e já enviei tudo para seu e-mail: {email}\n\n📚 Verifique sua caixa de entrada e a pasta de spam!\n\nO material vai transformar seus resultados! 🚀\n\nTem alguma dúvida sobre o conteúdo? Estou aqui para ajudar! 💪', 'boas-vindas'),
   
  -- Template 2: Confirmação de Envio
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Confirmação Envio Material', 
   'Oi {nome}! ✨\n\nCONFIRMEI: Seu material exclusivo foi enviado com sucesso! 📧\n\n🔍 **O que fazer agora:**\n1. Abra seu e-mail {email}\n2. Procure pelo assunto: "Seu Material Exclusivo"\n3. Salve em uma pasta segura\n\n⚡ **Dica extra:** O conteúdo é prático e já pode ser aplicado hoje mesmo!\n\nSe não encontrou, me avise que reenvio imediatamente! 📲', 'confirmação'),
   
  -- Template 3: Oferta de Curso
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Oferta Curso Completo', 
   '🎓 **OFERTA ESPECIAL - CURSO COMPLETO** 🎓\n\nOlá {nome}!\n\nVi seu interesse no conteúdo e preparei uma condição IMPERDÍVEL para você no curso "{nome_curso}":\n\n✅ **Módulo 1:** {modulo1}\n✅ **Módulo 2:** {modulo2}\n✅ **Módulo 3:** {modulo3}\n✅ **Bônus Exclusivo:** Acesso à comunidade VIP\n✅ **Suporte Direto** comigo\n✅ **Certificado** de conclusão\n\n💰 **De R$ {preco_cheio} por apenas R$ {preco_oferta}**\n🔥 **Parcelamos em até {parcelas}x no cartão!**\n\n⏰ **Vagas limitadas!** Últimas {vagas} vagas disponíveis!\n\n🚀 **Clique aqui e garanta sua vaga:** {link_compra}\n\nEssa oferta expira em {horas} horas! Não perca! ⏳', 'vendas'),
   
  -- Template 4: Convite Webinar
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Convite Webinar Ao Vivo', 
   '🔥 **AO VIVO HOJE - WEBINAR EXCLUSIVO** 🔥\n\nOlá {nome}!\n\nTenho uma vaga reservada especialmente para você no meu webinar:\n\n📚 **Tópico:** "{titulo_webinar}"\n🗓️ **Data:** Hoje, {data}\n⏰ **Horário:** {horario}\n🔗 **Link:** {link_webinar}\n\n⭐ **O que você vai aprender:**\n• {aprendizado1}\n• {aprendizado2}\n• {aprendizado3}\n• {aprendizado4}\n\n🎁 **BÔNUS PARA PRESENTES:** {bonus_presente}\n\n⚠️ **ATENÇÃO:** Vagas extremamente limitadas! Apenas {vagas_disponiveis} vagas restantes!\n\n✅ **Confirme sua presença agora:** {link_confirmacao}\n\nNão perca a oportunidade de transformar seus resultados! 🚀', 'webinar'),
   
  -- Template 5: Lembrete Aula/Evento
  (gen_random_uuid(), '56ed5bf7-c7ca-4497-aaf7-b202483a0b7b', 'Lembrete Aula Ao Vivo', 
   '⏰ **LEMBRETE IMPORTANTE** ⏰\n\nOi {nome}!\n\nSua aula ao vivo começa em **{minutos} minutos**! ⚡\n\n📺 **Tópico da Aula:** {assunto_aula}\n🕐 **Horário:** {horario_inicio}\n🔗 **Link da Aula:** {link_aula}\n\n💡 **Dicas para aproveitar melhor:**\n• Chegue 5 minutos antes\n• Tenha papel e caneta\n• Prepare suas dúvidas\n• Conecte pelo computador para melhor experiência\n\n🎯 **O que vamos aprender hoje:**\n{conteudo_programa}\n\n📱 **Problemas técnicos?** Me chame no WhatsApp: {whatsapp_suporte}\n\nTe vejo lá! 🎥✨', 'lembrete');

-- =====================================================
-- RESUMO DO POPULATE:
-- ✅ 5 Templates de mensagens prontas
-- ✅ Templates para diferentes situações: boas-vindas, confirmação, vendas, webinar, lembrete
-- ✅ Personalização com variáveis como {nome}, {email}, {link_compra}, etc.
-- ✅ Formatação profissional com emojis e estrutura clara
-- =====================================================
