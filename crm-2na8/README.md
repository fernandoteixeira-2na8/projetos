# CRM Comercial 2na8

CRM para acompanhar os **OKRs comerciais** do ciclo e os **leads em prospecção**. Página HTML/CSS/JS única (`index.html`), sem build. Segue o design system da 2na8 (o mesmo da Proposta Comercial e da Calculadora): tema escuro, azul #2f2ef5 e #8181fc, FHLecturis nos títulos (fonte embutida no arquivo), DM Sans no texto e Fira Code nos rótulos e números (Google Fonts), cantos retos e logo em pixel. Verde não faz parte da paleta: "no ritmo" usa o azul claro e "abaixo do esperado" o laranja da marca (#e29568).

## Abas

- **OKR** — os resultados-chave do ciclo (padrão: OKR Q4 da 2na8) com nível (Compromisso / Aspiracional), atual, esperado hoje, meta, quanto falta, quanto é preciso por semana útil e barra de progresso com o marcador do esperado. Abaixo: o que pede atenção (próximo passo atrasado, de hoje, lead parado, sem próximo passo), funil aberto e resultado do período.
- **Pipeline** — kanban por etapa (Prospecção → Primeiro contato → Discovery → Proposta enviada → Negociação → Ganho / Perdido), com filtros por responsável e prioridade. Em Primeiro contato o card mostra o toque da cadência (1 a 4). Mover para Perdido pede o motivo.
- **Leads** — tabela com busca, filtros por etapa, responsável e segmento, ordenação por coluna, importação de planilha (.xlsx ou .csv) e exportação em CSV.
- **OKRs e premissas** — nome e período do ciclo, de quem são os negócios que contam, nome/nível/meta de cada resultado-chave, quanto já foi feito fora do CRM, dias para considerar um lead parado e probabilidade padrão de cada etapa.

Cada lead tem conta (empresa, segmento, sistema/grupo, UF, origem), contato (nome, cargo, e-mail, telefone, LinkedIn, responsável), qualificação (prioridade, fit 0–12, toque da cadência, score de discovery), negócio (valor, probabilidade, previsão), próximo passo com data, notas e histórico de atividades, com as mudanças de etapa registradas automaticamente.

## Como os OKRs são contados

- **Esperado hoje** = meta × dias úteis já passados ÷ dias úteis do período (segunda a sexta, sem feriados nacionais, carnaval, sexta-feira santa e Corpus Christi).
- Só contam os leads do responsável configurado em "Negócios de" (vazio = time todo).
- **Pessoas novas contatadas / Reuniões qualificadas / Propostas formalizadas**: leads que chegaram pela primeira vez a Primeiro contato / Discovery / Proposta enviada dentro do período. A data é gravada quando o lead muda de etapa (pular etapas conta as anteriores).
- **Oportunidades no funil**: soma do valor dos leads em aberto de Discovery em diante.
- **Contratos assinados**: leads ganhos com data de fechamento no período.
- **Já feito fora do CRM** soma ao que o CRM conta. Leads importados não geram marcos retroativos: o que aconteceu antes entra nesse ajuste.

## Persistência

- Publicado como Artifact no claude.ai, usa `window.claude.use('db')`: leads em `leads/{id}` e premissas em `config/meta`, compartilhados com o time e atualizados ao vivo.
- Aberto como arquivo estático, salva no `localStorage` do navegador (`crm2na8.leads.v1` e `crm2na8.cfg.v1`). Use **Exportar CSV** para backup ou para levar os dados ao Artifact (via **Importar CSV**).

## Importar planilha

Aceita `.xlsx` (lido com SheetJS, carregado do cdnjs só no momento da importação) ou `.csv` (`,` ou `;`). A linha de cabeçalho é localizada sozinha nas primeiras 20 linhas, em qualquer aba. Colunas reconhecidas (sem diferenciar acentos/maiúsculas): instituição/empresa, segmento, sistema/grupo, UF, patrocinador/contato, cargo, contato/LinkedIn, e-mail, telefone, origem, responsável, status/etapa ("Toque N enviado" vira Primeiro contato no toque N; "Discovery feito" vira Discovery; "Sprint proposto"/"Proposta apresentada" viram Proposta enviada), prioridade, fit total, valor, próxima ação, data próxima ação e notas. Colunas como dor-hipótese, quem aprova, quem pode bloquear e indicador de porte vão para as notas com o rótulo original. Linhas `[EXEMPLO]`, placeholders (`[nome]`, `linkedin.com/in/...`, `a confirmar`) e empresas já cadastradas são ignorados. Sem responsável na planilha, o lead fica com o responsável dos OKRs.
