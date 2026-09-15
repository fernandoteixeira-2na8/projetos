# Triagem 2na8

Ferramenta de qualificação de leads para calls de pré-vendas de software sob medida. Página HTML/CSS/JS única (`index.html`), sem build e sem dependências além de fontes do Google Fonts.

## Como usar

Abra `index.html` em qualquer navegador. Não precisa de servidor — é um arquivo estático.

## Conteúdo

- **Roteiro** — script de discovery em 6 blocos (motor de receita, dor/gatilho, desconstrução da solução, valor, decisão/orçamento, fechamento), com perguntas, tempo sugerido e sinais verdes/vermelhos por bloco.
- **Ficha da call** — formulário para preencher durante a call (dados do lead + notas + nível de cada dimensão), com score calculado ao vivo no painel lateral.
- **Call de hoje** — espaço para um briefing específico do lead da call do dia (vem pré-preenchido com um exemplo; edite o bloco `#p-hoje` no HTML para trocar pelo lead real).
- **Critérios** — as 6 dimensões de pontuação (100 pontos no total), faixas de veredito (quente/morno/frio/fora) e os 5 kill switches que desqualificam um lead independentemente do score.
- **Histórico** — lista de fichas salvas.

## Persistência

- O rascunho da ficha em preenchimento fica salvo em `localStorage` do navegador (`triagem2na8.draft.v1`), então não se perde ao recarregar a página.
- O botão **Salvar ficha** e a aba **Histórico** usam `window.claude.use('db')`, uma capability disponível apenas quando a página roda como Artifact dentro do claude.ai. Rodando como arquivo estático fora desse ambiente, o histórico compartilhado fica indisponível automaticamente (a página avisa isso na tela) — o "Copiar resumo" continua funcionando normalmente como alternativa.

## Origem

Importado de um Artifact do Claude (`claude.ai/artifact/LDESYeuCMFUCgkisePKfWn`).
