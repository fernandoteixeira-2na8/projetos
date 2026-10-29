# CRM Comercial 2na8

CRM para acompanhar os **OKRs comerciais** do ciclo e os **leads em prospecção**. Página HTML/CSS/JS única (`index.html`), sem build. Segue o design system da 2na8 (o mesmo da Proposta Comercial e da Calculadora): tema escuro, azul #2f2ef5 e #8181fc, FHLecturis nos títulos (fonte embutida no arquivo), DM Sans no texto e Fira Code nos rótulos e números (Google Fonts), cantos retos e logo em pixel. Verde não faz parte da paleta: "no ritmo" usa o azul claro e "abaixo do esperado" o laranja da marca (#e29568).

## Abas

- **OKR** — os seis resultados-chave do ciclo (contatos realizados, contatos qualificados, reuniões agendadas, reuniões qualificadas, propostas, fechamentos) com atual, meta, falta e status (Em dia, Em risco, Atrasado). Abaixo: o que pede atenção (próximo passo atrasado, de hoje, lead parado, sem próximo passo), funil aberto e resultado do período.
- **Pipeline** — kanban por etapa (Prospecção → Contato realizado → Contato qualificado → Reunião agendada → Reunião qualificada → Proposta → Negociação → Fechado / Perdido), com filtros por responsável e prioridade. Em Contato realizado o card mostra o toque da cadência (1 a 4). Mover para Perdido pede o motivo.
- **Leads** — tabela com busca, filtros por etapa, responsável e segmento, ordenação por coluna, importação de planilha (.xlsx ou .csv) e exportação em CSV.
- **OKRs e premissas** — nome e período do ciclo, de quem são os negócios que contam, nome e meta de cada resultado-chave, o limite de "em risco", quanto já foi feito fora do CRM, dias para considerar um lead parado e probabilidade padrão de cada etapa.

Cada lead tem conta (empresa, segmento, sistema/grupo, UF, origem), contato (nome, cargo, e-mail, telefone, LinkedIn, responsável), qualificação (prioridade, fit 0–12, toque da cadência, score de discovery), negócio (valor, probabilidade, previsão), próximo passo com data, notas e histórico de atividades, com as mudanças de etapa registradas automaticamente.

## Como os OKRs são contados

- Cada resultado-chave conta os leads que chegaram pela primeira vez à etapa correspondente dentro do período: Contato realizado, Contato qualificado, Reunião agendada, Reunião qualificada e Proposta. Fechamentos são leads ganhos com data de fechamento no período. A data é gravada quando o lead muda de etapa (pular etapas conta as anteriores).
- Só contam os leads do responsável configurado em "Negócios de" (vazio = time todo).
- **Esperado hoje** = meta × dias úteis já passados ÷ dias úteis do período (segunda a sexta, sem feriados nacionais, carnaval, sexta-feira santa e Corpus Christi).
- **Status**: *Em dia* quando o atual alcança o esperado de hoje (ou a meta); *Em risco* entre o limite configurado (padrão 70%) e o esperado; *Atrasado* abaixo do limite; *Sem meta* quando a meta é zero.
- **Já feito fora do CRM** soma ao que o CRM conta. Leads importados não geram marcos retroativos: o que aconteceu antes entra nesse ajuste.
- Leads da versão anterior em "Discovery" passam automaticamente para Reunião qualificada.

## Persistência

- Publicado como Artifact no claude.ai, usa `window.claude.use('db')`: leads em `leads/{id}` e premissas em `config/meta`, compartilhados com o time e atualizados ao vivo.
- Aberto como arquivo estático, salva no `localStorage` do navegador (`crm2na8.leads.v1` e `crm2na8.cfg.v1`). Use **Exportar CSV** para backup ou para levar os dados ao Artifact (via **Importar CSV**).

## Importar planilha

Aceita `.xlsx` (lido com SheetJS, carregado do cdnjs só no momento da importação) ou `.csv` (`,` ou `;`). A linha de cabeçalho é localizada sozinha nas primeiras 20 linhas, em qualquer aba. Colunas reconhecidas (sem diferenciar acentos/maiúsculas): instituição/empresa, segmento, sistema/grupo, UF, patrocinador/contato, cargo, contato/LinkedIn, e-mail, telefone, origem, responsável, status/etapa ("Toque N enviado" vira Contato realizado no toque N; "Call agendada" vira Reunião agendada; "Discovery feito" vira Reunião qualificada; "Sprint proposto"/"Proposta apresentada" viram Proposta), prioridade, fit total, valor, próxima ação, data próxima ação e notas. Colunas como dor-hipótese, quem aprova, quem pode bloquear e indicador de porte vão para as notas com o rótulo original. Linhas `[EXEMPLO]`, placeholders (`[nome]`, `linkedin.com/in/...`, `a confirmar`) e empresas já cadastradas são ignorados. Sem responsável na planilha, o lead fica com o responsável dos OKRs.
