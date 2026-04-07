# FlowLux - Fase 5: Metricas e Endurecimento Operacional

## Status

Concluida

## Objetivo

Dar visibilidade operacional e permitir rollout gradual com fallback curto para as mudancas de arquitetura.

## Problema que esta fase resolve

Sem metricas e sem rollout controlado, falhas ficam escondidas ou dependentes de investigacao manual no n8n.

Isso dificulta:

- detectar regressao rapido
- saber onde o fluxo falhou
- medir impacto de cada mudanca
- fazer rollback com confianca

## Arquitetura desejada

Toda migracao deve ser gradual e acompanhada por metricas minimas.

## Stories

### Story 5.1 - Operacao deve ter metricas minimas de saude

Como operacao,
queremos metricas simples e objetivas de mensagens e fluxos,
para identificar falhas sem depender de caca manual no n8n.

#### Tarefas

- medir mensagens recebidas
- medir mensagens com erro
- medir agendamentos processados
- medir tempo medio de execucao
- medir fluxos falhos por etapa

#### Criterios de aceite

- qualquer falha operacional relevante fica visivel sem depender de procurar manualmente no n8n

### Story 5.2 - Migracao deve seguir rollout gradual com fallback curto

Como time tecnico,
queremos ativar cada mudanca por etapa independente,
para reduzir risco e permitir rollback rapido.

#### Tarefas

- registrar estrategia de rollout por fase
- registrar estrategia de rollback por fase
- ativar uma camada por vez
- validar antes de promover para o proximo passo

#### Criterios de aceite

- cada fase pode ser ativada e revertida sem interromper toda a operacao

## Entregaveis esperados

- painel ou camada minima de metricas operacionais
- checklist de rollout
- checklist de rollback
- criterios de promocao entre fases

## Entregue

- tabela `operational_events` para trilha operacional minima
- instrumentacao de erros no inbound do chat, envio de midia e falha terminal dos fluxos async
- dashboard com:
  - erros operacionais na janela de 7 dias
  - agendamentos processados na janela de 7 dias
  - tempo medio de execucao dos fluxos
  - ranking de falhas por etapa do fluxo
  - alertas operacionais recentes
- amarracao do chat para enviar `user_id` e `conversation_id` ao endpoint de envio de midia
- documentacao de rollout e rollback atualizada para a camada de observabilidade

## Dependencias

- fase 2 com inbound controlado
- fase 3 com fluxo auditavel por etapa
- eventos e logs suficientes para medir operacao

## Rollout sugerido

1. instrumentar metricas minimas
2. definir baseline
3. acompanhar cada rollout de fase
4. revisar alertas e thresholds
5. validar periodicamente se `operational_events` continua recebendo falhas reais dos caminhos criticos

## Rollback sugerido

- rollback orientado por metrica e nao apenas por percepcao manual
- se a camada visual do dashboard falhar, manter os eventos persistidos e recuar apenas a leitura/visualizacao
- se alguma instrumentacao gerar ruído, desligar somente o ponto de escrita afetado sem remover a tabela de observabilidade

## Checkpoint final

Esta fase fecha o ciclo de endurecimento:

- confiabilidade
- auditabilidade
- desempenho percebido
- capacidade real de operar e evoluir com menos risco
