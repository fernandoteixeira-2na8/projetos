# CRM Comercial 2na8

CRM para acompanhar os **OKRs comerciais** do ciclo e os **leads em prospecção**. Página HTML/CSS/JS única (`index.html`), sem build. Segue o design system da 2na8 (o mesmo da Proposta Comercial e da Calculadora): tema escuro, azul #2f2ef5 e #8181fc, FHLecturis nos títulos (fonte embutida no arquivo), DM Sans no texto e Fira Code nos rótulos e números (Google Fonts), cantos retos e logo em pixel. Verde não faz parte da paleta: "no ritmo" usa o azul claro e "abaixo do esperado" o laranja da marca (#e29568).

## Abas

- **OKR** — dois objetivos. *Gerar pipeline qualificado*: reuniões qualificadas e propostas apresentadas. *Converter em receita*: receita contratada e taxa de ganho em propostas. Cada KR é um card com atual, meta, falta, status e barra com o esperado de hoje. Abaixo: ritmo da semana (contatos novos, qualificados, agendadas, reuniões, propostas: esta semana × meta semanal, e acumulado do ciclo × meta do ciclo), números do período, agenda por situação e funil aberto.
- **Projeção** — simulador com ticket, ciclo, capacidade semanal de contatos novos, conversões entre etapas e meta mensal opcional. Mostra quanto a operação entrega por mês em três cenários, o funil reverso que uma meta exige (e se cabe na capacidade), a previsão dos próximos 6 meses (já fechado + pipeline ponderado + novos negócios) e a comparação premissa × realidade medida no CRM.
- **Pipeline** — kanban por etapa (Prospecção → Contato realizado → Contato qualificado → Reunião agendada → Reunião qualificada → Proposta → Negociação → Fechado / Perdido), com filtros por responsável e prioridade. Em Contato realizado o card mostra o toque da cadência (1 a 4). Mover para Perdido pede o motivo.
- **Leads** — tabela com filtros rápidos por etapa, busca, filtro por situação, responsável e segmento, ordenação por coluna, importação de planilha (.xlsx ou .csv) e exportação em CSV.
- **OKRs e premissas** — nome e período do ciclo, de quem são os negócios que contam, nome e meta de cada resultado-chave, o limite de "em risco", quanto já foi feito fora do CRM, dias para considerar um lead parado e probabilidade padrão de cada etapa.

Cada lead tem conta (empresa, segmento, sistema/grupo, UF, origem), contato (nome, cargo, e-mail, telefone, LinkedIn, responsável), qualificação (prioridade, fit 0–12, toque da cadência, score de discovery), negócio (valor, probabilidade, previsão), próximo passo com data, notas e histórico de atividades, com as mudanças de etapa registradas automaticamente.

## Como os OKRs são contados

- **Reuniões qualificadas / Propostas apresentadas**: leads que chegaram pela primeira vez a Reunião qualificada / Proposta dentro do período (pular etapas conta as anteriores).
- **Receita contratada**: valor dos leads ganhos com fechamento no período (sem valor no lead, conta o ticket médio da projeção).
- **Taxa de ganho**: ganhos ÷ propostas decididas (ganhas ou perdidas) no período; com menos de 3 decididas o status é "Poucos dados".
- **Esperado hoje** (KRs de quantidade e receita) = meta × dias úteis já passados ÷ dias úteis do período (sem fins de semana e feriados nacionais). Status: *Em dia* no esperado ou acima; *Em risco* entre o limite configurado (padrão 70%) e o esperado; *Atrasado* abaixo. A taxa de ganho compara direto com a meta.
- **Ritmo da semana**: metas semanais saem da projeção (capacidade × conversões); "no ciclo" soma o feito fora do CRM.
- Só contam os leads do responsável configurado em "Negócios de" (vazio = time todo). "Já feito fora do CRM" soma ao que o CRM conta; na taxa de ganho, entra como propostas ganhas e decididas fora do CRM.
- Cada etapa tem um critério (exibido na ficha do lead e no título da coluna do pipeline), para que a contagem signifique a mesma coisa para todo mundo.

## Projeção

- Regime estável: contatos novos por mês = capacidade semanal × 52 ÷ 12, que percorrem o funil pelas conversões. Cenários pessimista/otimista mudam em 25% as conversões reunião → proposta e proposta → ganho.
- Próximos 6 meses: já fechado no mês + pipeline atual (de Contato qualificado em diante) × probabilidade da etapa no mês da previsão de fechamento + novos negócios do cenário base a partir de um ciclo de defasagem.
- Premissa × realidade: conversões reais pelas datas de cada etapa, ticket médio e ciclo dos contratos ganhos. Menos de 10 leads na base de um passo = amostra pequena.

## Persistência

- Publicado como Artifact no claude.ai, usa `window.claude.use('db')`: leads em `leads/{id}` e premissas em `config/meta`, compartilhados com o time e atualizados ao vivo.
- Aberto como arquivo estático, salva no `localStorage` do navegador (`crm2na8.leads.v1` e `crm2na8.cfg.v1`). Use **Exportar CSV** para backup ou para levar os dados ao Artifact (via **Importar CSV**).

## Importar planilha

Aceita `.xlsx` (lido com SheetJS, carregado do cdnjs só no momento da importação) ou `.csv` (`,` ou `;`). A linha de cabeçalho é localizada sozinha nas primeiras 20 linhas, em qualquer aba. Colunas reconhecidas (sem diferenciar acentos/maiúsculas): instituição/empresa, segmento, sistema/grupo, UF, patrocinador/contato, cargo, contato/LinkedIn, e-mail, telefone, origem, responsável, status/etapa ("Toque N enviado" vira Contato realizado no toque N; "Call agendada" vira Reunião agendada; "Discovery feito" vira Reunião qualificada; "Sprint proposto"/"Proposta apresentada" viram Proposta), prioridade, fit total, valor, próxima ação, data próxima ação e notas. Colunas como dor-hipótese, quem aprova, quem pode bloquear e indicador de porte vão para as notas com o rótulo original. Linhas `[EXEMPLO]`, placeholders (`[nome]`, `linkedin.com/in/...`, `a confirmar`) e empresas já cadastradas são ignorados. Sem responsável na planilha, o lead fica com o responsável dos OKRs.
