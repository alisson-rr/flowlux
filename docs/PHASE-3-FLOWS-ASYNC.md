# FlowLux - Fase 3: Flows Async

## Status

Pendente

## Objetivo

Transformar a execucao de fluxos em processamento assincrono, auditavel e resiliente.

## Problema que esta fase resolve

Hoje a execucao inteira do fluxo acontece dentro da request em `execute-flow/route.ts`, o que cria risco de:

- timeout HTTP
- execucao interrompida por perda de request aberta
- pouca rastreabilidade por etapa
- retry inseguro
- impossibilidade pratica de cancelamento

## Arquitetura desejada

A rota deixa de executar o fluxo inteiro e passa apenas a:

- criar uma execucao
- enfileirar o trabalho

Depois disso, um worker processa os passos com:

- log por etapa
- retry controlado
- cancelamento
- persistencia de estado

## Stories

### Story 3.1 - A rota de execucao deve apenas enfileirar

Como arquitetura do produto,
queremos que a rota HTTP apenas registre e enfileire a execucao,
para que fluxos longos nao dependam de conexao aberta.

#### Tarefas

- reduzir `src/app/api/execute-flow/route.ts` a uma funcao de enqueue
- mover delays e processamento para worker
- garantir retorno rapido da request

#### Criterios de aceite

- fluxo longo nao depende de request aberta
- timeout HTTP deixa de ser risco estrutural

### Story 3.2 - Cada passo deve ficar auditavel

Como operacao,
queremos visibilidade de cada etapa do fluxo,
para diagnosticar falhas e acompanhar retries.

#### Tarefas

- registrar etapas em `flow_execution_steps`
- registrar execucao em `flow_executions`
- modelar status por etapa
- registrar erro, retry e cancelamento

#### Criterios de aceite

- cada passo fica auditavel em `flow_executions` e `flow_execution_steps`
- retry e cancelamento ficam claros e controlados

## Entregaveis esperados

- rota de enqueue
- worker de execucao
- trilha de passos persistida
- mecanismo de retry controlado

## Dependencias

- estrategia de fila ou worker escolhida
- contrato de logs por etapa
- politica de retry por tipo de passo

## Rollout sugerido

1. subir o motor async em paralelo
2. validar um fluxo simples
3. migrar fluxos progressivamente
4. manter fallback curto para o modo anterior

## Rollback sugerido

- reativar execucao sincrona apenas temporariamente se o worker nao atingir estabilidade minima

## Artefatos relacionados

- [rota atual de execucao](/c:/Users/Alisson/CascadeProjects/FlowLux/src/app/api/execute-flow/route.ts)
