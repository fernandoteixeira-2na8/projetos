# CRM Comercial 2na8

CRM para acompanhar a **meta comercial** do período e os **leads em prospecção**. Página HTML/CSS/JS única (`index.html`), sem build e sem dependências além da fonte Inter do Google Fonts. Segue o design system da 2na8 (mesmos tokens de cor e tipografia do briefing de pré-vendas).

## Abas

- **Meta** — realizado × meta do período, ritmo linear esperado para hoje, previsão ponderada, cobertura do gap pelo pipeline, **plano reverso** (do gap até quantos contratos, propostas, discoveries e leads novos faltam, e quantos por semana), funil aberto, lista do que pede atenção (próximo passo atrasado, de hoje, sem próximo passo, lead parado) e resultado do período (ganhos, perdidos, taxa de ganho, motivos de perda).
- **Pipeline** — kanban por etapa (Prospecção → Primeiro contato → Discovery → Proposta enviada → Negociação → Ganho / Perdido). Arraste os cards entre colunas; mover para Perdido pede o motivo.
- **Leads** — tabela com busca, filtros por etapa e responsável, ordenação por coluna, importação e exportação em CSV.
- **Meta e premissas** — período, meta de receita, ticket médio, cobertura alvo, dias para considerar um lead parado, taxas de conversão entre etapas e probabilidade padrão de cada etapa. Mostra também as conversões observadas na base para calibrar.

Cada lead tem empresa, contato, origem, responsável, valor, probabilidade, score da triagem, previsão de fechamento, próximo passo com data, notas e um histórico de atividades (ligação, WhatsApp, e-mail, reunião…), com as mudanças de etapa registradas automaticamente.

## Como os números são calculados

- **Realizado**: soma do valor dos leads em *Ganho* com data de fechamento dentro do período.
- **Pipeline ponderado**: soma de valor × probabilidade dos leads em aberto com previsão de fechamento até o fim do período (ou sem previsão).
- **Previsão**: realizado + pipeline ponderado.
- **Cobertura**: pipeline em aberto (mesmo recorte) ÷ gap. Alvo padrão: 3x.
- **Plano reverso**: contratos = gap ÷ ticket médio; propostas = contratos ÷ conversão proposta→ganho; descontando o que já está em Proposta/Negociação, o restante é desdobrado em discoveries e leads novos pelas outras taxas.

## Persistência

- Publicado como Artifact no claude.ai, usa `window.claude.use('db')`: leads em `leads/{id}` e premissas em `config/meta`, compartilhados com o time e atualizados ao vivo.
- Aberto como arquivo estático, salva no `localStorage` do navegador (`crm2na8.leads.v1` e `crm2na8.cfg.v1`). Use **Exportar CSV** para backup ou para levar os dados ao Artifact (via **Importar CSV**).

## Importar CSV

Cabeçalho com nomes como `empresa`, `contato`, `cargo`, `email`, `telefone`, `segmento`, `origem`, `responsavel`, `etapa`, `valor`, `probabilidade`, `previsao`, `proximo passo`, `notas` (sem diferenciar acentos/maiúsculas; aceita `,` ou `;`). Só `empresa` é obrigatória. Linhas com mesma empresa + e-mail de um lead existente são ignoradas.
