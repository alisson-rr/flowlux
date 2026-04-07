# FlowLux - Fase 4: Otimizacao da UI do Chat

## Status

Concluida

## Objetivo

Escalar a experiencia do chat para bases maiores, reduzindo carregamento excessivo no cliente e diminuindo travamentos na troca de conversa.

## Problema que esta fase resolve

A tela do chat ainda concentra carregamento e metadados demais no cliente, o que gera:

- abertura lenta com base grande
- troca de conversa engasgando
- excesso de dados secundarios na carga inicial
- realtime mais amplo do que o necessario

## Arquitetura desejada

- paginacao real de conversas
- filtros executados no banco
- lazy load mais agressivo do painel lateral
- realtime restrito a conversa aberta e mudancas essenciais

## Stories

### Story 4.1 - A tela do chat deve carregar menos dados no cliente

Como usuario,
quero abrir o chat sem carregar volume excessivo de metadados,
para navegar com fluidez mesmo com base grande.

#### Tarefas

- revisar `src/app/(dashboard)/chat/page.tsx`
- implementar paginacao real de conversas
- mover filtros pesados para o banco
- carregar painel lateral sob demanda

#### Criterios de aceite

- abrir o chat com base grande continua rapido
- a troca de conversa nao engasga

### Story 4.2 - Estrategia de realtime deve ser reduzida ao essencial

Como time tecnico,
queremos limitar o realtime ao que realmente muda a experiencia principal,
para reduzir ruido de atualizacao e custo operacional.

#### Tarefas

- manter realtime na conversa aberta
- manter realtime em eventos essenciais da lista
- remover assinaturas redundantes ou amplas demais

#### Criterios de aceite

- a pagina permanece responsiva mesmo com muito volume
- atualizacoes em tempo real nao travam a interface

## Entregaveis esperados

- chat com carga inicial menor
- lista de conversas paginada
- realtime reduzido ao necessario
- painel lateral desacoplado da abertura principal

## Entregue

- paginacao real de conversas no banco
- busca principal de conversas executada no backend
- realtime de mensagens restrito a conversa aberta
- realtime da lista restrito a mudancas essenciais de conversas
- lista ordenada e reposicionada pela atividade mais recente

## Dependencias

- fase 2 estabilizada para inbound consistente
- estrategia de consulta paginada no banco
- revisao de subscriptions realtime

## Rollout sugerido

1. primeiro paginacao de conversas
2. depois lazy load do painel lateral
3. depois revisao do realtime

## Rollback sugerido

- rollback por subetapa, sem desfazer toda a tela

## Artefatos relacionados

- [tela atual do chat](/c:/Users/Alisson/CascadeProjects/FlowLux/src/app/%28dashboard%29/chat/page.tsx)
- [story executivo principal](/c:/Users/Alisson/CascadeProjects/FlowLux/docs/PRODUCT-STORY-MELHORIAS.md)
