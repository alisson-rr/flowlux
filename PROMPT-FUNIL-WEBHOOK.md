# Prompt: Múltiplos Funis + Webhook Hotmart

## Task 1: Múltiplos Funis de Vendas

### Contexto
O FlowLux é um CRM com WhatsApp integrado. Atualmente já existe uma estrutura de banco de dados para múltiplos funis:
- Tabela `funnels` (id, user_id, name, description, created_at)
- Tabela `funnel_stages` (id, user_id, funnel_id, name, color, order)
- Tabela `leads` com coluna `funnel_id` que referencia qual funil o lead pertence

### O que precisa ser feito
1. **Tela de Funil (`/funil`)** - JÁ CRIADA com Kanban board
   - Selector de funil no topo da página
   - Cada funil tem suas etapas independentes (colunas do Kanban)
   - Botão para criar novos funis
   - Botão para configurar etapas de cada funil (renomear, reordenar, adicionar, remover, trocar cor)
   - Drag-and-drop de leads entre etapas

2. **Tela de Leads (`/leads`)** - Listagem tabular
   - Tabela com todos os leads (nome, telefone, email, origem, funil, etapa, tags, data)
   - Filtros: por funil, por tag, por status (ativo/arquivado), busca por texto
   - Ações: editar, arquivar, soft delete, ver detalhes
   - Modal de detalhes com todas as informações, tags, notas

3. **Ao cadastrar um lead** deve ser possível escolher:
   - Qual funil ele pertence
   - Qual etapa inicial dentro daquele funil

4. **Importante**: Cada funil é completamente independente
   - Exemplo: "Funil Compradores" com etapas: Novo → Onboarding → Ativo → VIP
   - Exemplo: "Funil Não Compradores" com etapas: Novo → Contato → Qualificado → Proposta → Fechado
   - Um lead pertence a um único funil por vez, mas pode ser movido entre funis

### Estrutura do banco (já existe)
```sql
-- funnels
CREATE TABLE funnels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- funnel_stages (com funnel_id)
ALTER TABLE funnel_stages ADD COLUMN funnel_id UUID REFERENCES funnels(id);

-- leads (com funnel_id)
ALTER TABLE leads ADD COLUMN funnel_id UUID REFERENCES funnels(id);
```

---

## Task 2: Webhook Hotmart com Mapeamento de Funis

### Contexto
O FlowLux recebe webhooks da Hotmart quando eventos de compra acontecem (compra aprovada, compra cancelada, reembolso, etc.). O usuário precisa poder configurar para qual funil e etapa cada tipo de evento deve direcionar o lead.

### O que precisa ser feito

1. **Na tela de Configurações (`/configuracoes`), aba Hotmart**:
   - Além do token e URL do webhook, adicionar uma seção de "Mapeamento de Eventos"
   - Para cada tipo de evento da Hotmart, o usuário escolhe:
     - **Funil destino**: dropdown com os funis criados
     - **Etapa destino**: dropdown com as etapas daquele funil selecionado
   - Tipos de eventos da Hotmart:
     - `PURCHASE_APPROVED` - Compra aprovada
     - `PURCHASE_COMPLETE` - Compra completa
     - `PURCHASE_CANCELED` - Compra cancelada
     - `PURCHASE_REFUNDED` - Compra reembolsada
     - `PURCHASE_CHARGEBACK` - Chargeback
     - `PURCHASE_EXPIRED` - Compra expirada
     - `SUBSCRIPTION_CANCELLATION` - Cancelamento de assinatura
     - `SWITCH_PLAN` - Troca de plano

2. **A configuração é salva** na coluna `webhook_config` (JSONB) da tabela `integrations`:
   ```json
   {
     "event_mapping": {
       "PURCHASE_APPROVED": { "funnel_id": "uuid-do-funil", "stage_id": "uuid-da-etapa" },
       "PURCHASE_CANCELED": { "funnel_id": "uuid-do-funil", "stage_id": "uuid-da-etapa" },
       ...
     }
   }
   ```

3. **API Route `/api/webhooks/hotmart`** (Next.js API route):
   - Recebe o POST da Hotmart
   - Identifica o tipo de evento
   - Busca o mapeamento configurado pelo usuário
   - Cria ou atualiza o lead no funil/etapa corretos
   - Dados do lead extraídos do payload da Hotmart:
     - Nome: `data.buyer.name`
     - Email: `data.buyer.email`
     - Telefone: `data.buyer.phone` ou `data.buyer.cellphone`
   - Se o lead já existe (mesmo email ou telefone), move para o funil/etapa configurado
   - Se não existe, cria um novo lead

### Estrutura do banco (já existe)
```sql
-- webhook_config na tabela integrations
ALTER TABLE integrations ADD COLUMN webhook_config JSONB DEFAULT '{}';

-- hotmart_webhooks para log de eventos
CREATE TABLE hotmart_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Stack técnica
- Next.js 14 (App Router) com TypeScript
- Supabase (Auth + PostgreSQL + Storage)
- TailwindCSS + shadcn/ui (Radix) + Lucide icons
- Evolution API para WhatsApp
