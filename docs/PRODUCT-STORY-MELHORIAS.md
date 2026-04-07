# FlowLux - Product Story de Melhorias

## Objetivo

Organizar a evolução do FlowLux como SaaS com foco em:

- velocidade de carregamento
- usabilidade e experiência do usuário
- correções funcionais
- organização do código para acelerar novas entregas

Este documento serve como backlog executivo e técnico para orientar as próximas entregas do produto.

---

## Visão Geral

### Problema principal atual

O FlowLux já possui muitas funcionalidades importantes, mas a experiência geral ainda sofre com:

- carregamento lento em quase todas as páginas do dashboard
- telas muito grandes com lógica concentrada demais
- consultas excessivas ao abrir páginas
- duplicação de regras entre módulos
- feedback visual ainda pouco refinado em fluxos importantes

### Resultado esperado

Ao final deste plano, o produto deve:

- abrir mais rápido
- carregar dados de forma progressiva
- ter telas mais estáveis e fáceis de evoluir
- reduzir fricção no uso diário
- melhorar a sensação de produto profissional

---

## Prioridades

### P0 - Crítico para operação

- Lentidão extrema no carregamento das páginas
- Bloqueio da interface com loaders de tela inteira
- Bootstrap pesado nas páginas Chat, Leads, Funil e Automação
- Requisições duplicadas no layout global

### P1 - Muito importante

- Duplicação de lógica entre Chat, Leads e Funil
- Ausência de camada de dados reutilizável
- Falta de paginação e lazy loading
- Dashboard calculando métricas no client

### P2 - Evolução de produto

- Refinos de UX
- Melhorias visuais e de feedback
- Estrutura melhor para futuras features

---

## Épico 1 - Performance Estrutural do Dashboard

### Objetivo

Reduzir o tempo de carregamento inicial e a sensação de lentidão em toda a área logada.

### Story 1.1 - Shell do dashboard deve abrir rápido

Como usuário logado,
quero entrar no dashboard sem esperar um bloqueio completo da tela,
para começar a navegar rapidamente.

#### Tarefas

- Reduzir consultas feitas em [`src/app/(dashboard)/layout.tsx`](/c:/Users/Alisson/CascadeProjects/FlowLux/src/app/(dashboard)/layout.tsx)
- Remover dependências desnecessárias do carregamento global
- Trocar loaders de tela cheia por skeletons locais
- Evitar refetch redundante de perfil na [`src/components/layout/sidebar.tsx`](/c:/Users/Alisson/CascadeProjects/FlowLux/src/components/layout/sidebar.tsx)

#### Critérios de aceite

- O layout principal aparece rapidamente
- A navegação lateral não fica travando a abertura das páginas
- O usuário consegue perceber a estrutura da tela antes do carregamento de todos os dados

### Story 1.2 - Navegação entre páginas deve parecer instantânea

Como usuário recorrente,
quero navegar entre módulos sem sentir recarregamento pesado,
para usar o sistema com fluidez.

#### Tarefas

- Centralizar dados compartilhados entre layout, sidebar, auth e assinatura
- Evitar múltiplas consultas para os mesmos dados em páginas diferentes
- Reutilizar dados já carregados quando possível

#### Critérios de aceite

- Mudança entre páginas do dashboard fica perceptivelmente mais rápida
- Dados comuns não são recarregados sem necessidade

---

## Épico 2 - Camada de Dados e Organização Técnica

### Objetivo

Criar uma base sustentável para o crescimento do produto sem continuar duplicando fetch, loading e estado.

### Story 2.1 - O projeto deve ter uma camada de dados reutilizável

Como time de produto,
queremos uma forma padronizada de carregar, cachear e atualizar dados,
para reduzir complexidade e acelerar novas implementações.

#### Tarefas

- Definir padrão de hooks por domínio
- Criar hooks como `useChatData`, `useLeads`, `useFunnels`, `useMedia`, `useDashboardMetrics`
- Centralizar estados de loading, refetch e invalidação
- Avaliar adoção de React Query para cache e sincronização

#### Critérios de aceite

- Páginas novas e antigas deixam de repetir o mesmo padrão de `useEffect + useState + Promise.all`
- O código fica mais previsível e reutilizável

### Story 2.2 - Páginas monolíticas devem ser divididas

Como time de desenvolvimento,
queremos quebrar páginas muito grandes em componentes e módulos menores,
para facilitar manutenção e evolução.

#### Tarefas

- Refatorar páginas acima de 500 linhas
- Extrair componentes de modais, listas, painéis laterais e formulários
- Separar lógica de interface da lógica de dados

#### Alvos principais

- [`src/app/(dashboard)/chat/page.tsx`](/c:/Users/Alisson/CascadeProjects/FlowLux/src/app/(dashboard)/chat/page.tsx)
- [`src/app/(dashboard)/leads/page.tsx`](/c:/Users/Alisson/CascadeProjects/FlowLux/src/app/(dashboard)/leads/page.tsx)
- [`src/app/(dashboard)/automacao/page.tsx`](/c:/Users/Alisson/CascadeProjects/FlowLux/src/app/(dashboard)/automacao/page.tsx)
- [`src/app/(dashboard)/configuracoes/page.tsx`](/c:/Users/Alisson/CascadeProjects/FlowLux/src/app/(dashboard)/configuracoes/page.tsx)
- [`src/app/(dashboard)/midia/page.tsx`](/c:/Users/Alisson/CascadeProjects/FlowLux/src/app/(dashboard)/midia/page.tsx)

#### Critérios de aceite

- Cada página fica mais legível
- Componentes têm responsabilidade clara
- Mudanças futuras exigem menos retrabalho

---

## Épico 3 - Refatoração do Chat

### Objetivo

Transformar o Chat na experiência mais rápida e confiável do produto.

### Story 3.1 - O Chat deve abrir rapidamente

Como usuário de atendimento,
quero abrir o módulo de chat sem esperar o carregamento de dados secundários,
para começar a responder mensagens rápido.

#### Tarefas

- Carregar inicialmente apenas conversas e instâncias
- Buscar mensagens apenas quando uma conversa for selecionada
- Carregar templates, mídia, tags e fluxos sob demanda
- Evitar trazer listas completas desnecessárias na abertura da página

#### Critérios de aceite

- O chat abre rápido
- A lista de conversas aparece antes dos painéis secundários
- A troca de conversa não trava a interface

### Story 3.2 - O detalhe do lead no chat deve ser leve

Como usuário do chat,
quero abrir dados do lead sem depender de buscas pesadas,
para consultar contexto da conversa com rapidez.

#### Tarefas

- Parar de carregar todos os leads para localizar um único lead
- Criar estratégia mais direta para associação conversa -> lead
- Carregar notas e tags apenas no detalhe

#### Critérios de aceite

- Abrir painel do lead não causa travamento perceptível
- Dados do lead aparecem de forma rápida e consistente

### Story 3.3 - Envio de mensagem deve ter UX melhor

Como usuário,
quero ter feedback rápido ao enviar texto, mídia, áudio ou fluxo,
para confiar que a ação foi executada corretamente.

#### Tarefas

- Adicionar feedback otimista nas mensagens
- Melhorar estados de envio e erro
- Refinar modais e seleção de mídia/fluxos

#### Critérios de aceite

- O usuário entende imediatamente que a mensagem está sendo enviada
- Falhas têm retorno claro

---

## Épico 4 - Refatoração de Leads e Funil

### Objetivo

Unificar a gestão de leads e reduzir duplicação entre os módulos.

### Story 4.1 - Leads deve carregar rápido mesmo com base grande

Como usuário comercial,
quero listar leads sem travamentos,
para trabalhar bem mesmo com volume maior de dados.

#### Tarefas

- Trazer apenas campos necessários para listagem
- Implementar paginação ou carregamento incremental
- Carregar notas e tags completas apenas no detalhe
- Melhorar busca e filtros

#### Critérios de aceite

- A tela de Leads abre rápido
- Busca e filtros respondem melhor
- A página não depende de carregar tudo antes de exibir a lista

### Story 4.2 - Funil deve carregar só o contexto atual

Como usuário,
quero visualizar o funil selecionado sem carregar dados irrelevantes,
para navegar com mais fluidez.

#### Tarefas

- Buscar apenas leads do funil ativo
- Otimizar mudança de etapa
- Separar configuração de funil da visualização operacional

#### Critérios de aceite

- Troca de funil é rápida
- Colunas e cards aparecem sem espera excessiva

### Story 4.3 - Regras de lead devem ser centralizadas

Como time,
queremos uma única lógica para notas, tags, edição e movimentação de lead,
para evitar bugs e inconsistência entre telas.

#### Tarefas

- Criar módulo compartilhado de lead
- Reaproveitar componentes entre Leads, Funil e Chat
- Padronizar fluxos de edição

#### Critérios de aceite

- O comportamento de lead é consistente nas três áreas
- Ajustes futuros são feitos em um único lugar

---

## Épico 5 - Refatoração de Automação

### Objetivo

Deixar o módulo de automação mais leve, mais previsível e mais fácil de usar.

### Story 5.1 - Automação deve carregar por contexto

Como usuário,
quero abrir automações sem esperar que todos os dados do módulo sejam carregados,
para trabalhar mais rápido.

#### Tarefas

- Separar carregamento de fluxos, disparos em massa e agendamentos
- Carregar dados por aba, bloco ou necessidade
- Extrair editores e listas em componentes independentes

#### Critérios de aceite

- A página abre mais rápido
- Cada aba funciona sem depender do bootstrap completo do módulo

### Story 5.2 - Editor de fluxo deve ser mais organizado

Como usuário,
quero montar e editar fluxos com clareza,
para reduzir erros operacionais.

#### Tarefas

- Extrair editor de fluxo para componente próprio
- Melhorar organização visual dos passos
- Revisar experiência de mídia, delay e ordenação

#### Critérios de aceite

- O editor fica mais intuitivo
- O código do módulo fica mais limpo

---

## Épico 6 - Dashboard, Configurações e Mídia

### Objetivo

Melhorar módulos secundários que ainda afetam a percepção geral do produto.

### Story 6.1 - Dashboard deve usar métricas prontas

Como gestor,
quero ver métricas rapidamente,
para entender o negócio sem esperar processamento pesado no navegador.

#### Tarefas

- Mover agregações para Supabase via RPC, view ou consultas dedicadas
- Reduzir processamento client-side
- Melhorar priorização de métricas

#### Critérios de aceite

- Dashboard abre rápido
- Métricas aparecem de forma mais estável

### Story 6.2 - Configurações deve ser mais modular

Como usuário,
quero configurar integrações e instâncias sem enfrentar uma tela pesada,
para concluir ações administrativas com facilidade.

#### Tarefas

- Separar integrações por blocos ou abas
- Reduzir bootstrap da página
- Melhorar estados de conexão e ação

#### Critérios de aceite

- Configurações abre rápido
- Ações de conexão ficam mais claras

### Story 6.3 - Biblioteca de mídia deve escalar melhor

Como usuário,
quero acessar arquivos e templates sem lentidão,
para reutilizar conteúdo com agilidade.

#### Tarefas

- Implementar paginação ou carregamento incremental
- Separar templates de arquivos de mídia
- Melhorar busca e organização

#### Critérios de aceite

- A tela de mídia não degrada com volume crescente

---

## Épico 7 - UX e Percepção de Produto

### Objetivo

Melhorar a sensação geral de qualidade do SaaS.

### Story 7.1 - O sistema deve parecer rápido mesmo durante carregamento

Como usuário,
quero perceber progresso visual e continuidade de interface,
para sentir o produto fluido.

#### Tarefas

- Adicionar skeletons nos blocos mais importantes
- Evitar loaders globais quando possível
- Melhorar feedback de ações assíncronas

#### Critérios de aceite

- A interface sempre mostra contexto visual
- O produto transmite mais fluidez

### Story 7.2 - Filtros e buscas devem ajudar o trabalho diário

Como usuário,
quero refinar dados com rapidez,
para operar com produtividade.

#### Tarefas

- Debounce em buscas
- Persistência de filtros principais
- Ordenações mais úteis

#### Critérios de aceite

- O uso diário fica mais rápido e menos repetitivo

---

## Ordem Recomendada de Execução

1. Épico 1 - Performance estrutural do dashboard
2. Épico 2 - Camada de dados e organização técnica
3. Épico 3 - Refatoração do Chat
4. Épico 4 - Refatoração de Leads e Funil
5. Épico 5 - Refatoração de Automação
6. Épico 6 - Dashboard, Configurações e Mídia
7. Épico 7 - UX e percepção de produto

---

## Entregas por Sprint

### Sprint 1

- Performance estrutural do dashboard
- Redução de refetch global
- Base de organização de dados

### Sprint 2

- Refatoração do Chat
- Carregamento progressivo do módulo

### Sprint 3

- Refatoração de Leads e Funil
- Centralização das regras de lead

### Sprint 4

- Refatoração de Automação
- Dashboard com métricas otimizadas

### Sprint 5

- Configurações e Mídia
- Polimento de UX

---

## Indicadores de Sucesso

- Redução perceptível do tempo de abertura das páginas principais
- Redução de consultas carregadas no bootstrap inicial
- Menor uso de loaders de tela inteira
- Menor duplicação de código entre módulos
- Maior fluidez no uso diário do sistema

---

## Observações

- O foco deste plano é produto, usabilidade, performance e organização.
- Melhorias de segurança mais profundas podem ser tratadas depois, conforme crescimento real de uso.
- O ideal é executar em etapas curtas, com ganho perceptível ao final de cada sprint.
