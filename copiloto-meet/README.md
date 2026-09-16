# Copiloto de Reunião (Google Meet)

Extensão de Chrome que lê as **legendas ao vivo** e o **chat** do Google Meet e mostra
cards de apoio no painel lateral do anfitrião. Não entra na reunião como participante,
não grava áudio e não aparece para os convidados.

Esqueleto funcional — o pipeline está implementado e testado contra um servidor de eco,
mas ainda não rodou em uma call de verdade. Leia "O que ainda não foi validado" antes de
levar para um cliente.

## Por que ler legenda em vez de capturar áudio

A escolha define o produto inteiro:

| | Bot participante | API oficial (Zoom RTMS / Meet Media) | Captura local (app desktop) | **Legenda via extensão** |
|---|---|---|---|---|
| Aparece para o convidado | sim | aviso de consentimento | não | não |
| Esforço | baixo | médio | alto | **baixo** |
| Custo de STT | ~US$ 0,25/h | ~US$ 0,25/h | ~US$ 0,25/h | **zero** |
| Latência | 1–3 s | 1–2 s | 1–2 s | **~0** |
| Funciona no Zoom/Teams | sim | sim | sim | **não** |

O Meet já transcreve de graça e em tempo real. Enquanto a hipótese "feedback ao vivo é
útil" não estiver validada, pagar por STT e escrever um app desktop é construir
infraestrutura para uma pergunta ainda em aberto.

**Consequência direta: o usuário precisa ligar as legendas (CC) no Meet.** Sem CC ligado,
não há o que ler.

## Como funciona

```
legendas + chat (DOM)  ->  content script  ->  service worker
                                                   |
                    a cada 5 s, se houver fala nova |
                                                   v
                         estágio 1: Haiku 4.5 classifica o gatilho
                              (pergunta / objeção / compromisso / risco / nenhum)
                                                   |
                       passou do limiar de confiança e do cooldown?
                                                   v
                         estágio 2: Opus 5 escreve o card (effort low),
                         com a base de conhecimento em prefixo cacheado
                                                   |
                                                   v
                                          painel lateral
```

Os dois estágios existem por custo: ~95% das rodadas terminam em "nenhum" e nunca chegam
ao modelo caro. Chamar o modelo bom a cada 5 segundos multiplicaria a conta por ~20.

Três guardas protegem a **atenção** do usuário, não o custo:

- **cooldown** entre cards (padrão 25 s);
- **deduplicação** por trecho — o mesmo gatilho não vira dois cards;
- **gatilhos desligáveis**, um a um, nas opções.

Em paralelo, a cada 60 s, um checklist passivo marca quais das seis dimensões da
[Triagem 2na8](../triagem-2na8) já foram cobertas. Esse é o estado que fica no rodapé:
informação sem interrupção.

## Instalação

```bash
npm install
npm run build          # gera dist/
npm run dev            # rebuild automático durante o desenvolvimento
```

1. `chrome://extensions` → ligue o **Modo do desenvolvedor**.
2. **Carregar sem compactação** → escolha a pasta `dist/`.
3. Abra as opções da extensão e preencha:
   - **chave da API Anthropic** (modo direto);
   - **seu nome exatamente como aparece no Meet** — é o que separa a sua fala da do cliente;
   - **base de conhecimento**: faixas de preço, prazos, integrações já feitas, respostas para as objeções que mais aparecem. É daqui que sai o conteúdo dos cards. Sem isso o copiloto só sabe dizer que vai confirmar depois.
4. Entre em uma reunião, **ligue as legendas (CC)** e abra o painel lateral no ícone da extensão.

### Modo direto vs. backend

No modo **direto** a chave fica no storage da extensão e vai do navegador para a API.
Serve para você usar na sua máquina. **Não distribua a extensão assim** — quem instalar
consegue ler a chave. Para o time, use o modo **proxy**: um backend seu guarda a chave e
espelha `/v1/messages`.

## Como testar

Quatro níveis, do mais barato para o mais caro. Cada um responde uma pergunta diferente —
não pule para o nível 4 antes que o 2 esteja passando.

### 1. O pipeline responde certo? (sem chave, sem custo, 5 segundos)

```bash
npm run smoke
```

Sobe um servidor que finge ser a API, roda os três estágios contra ele e confere as
respostas **e** o formato das requisições (modelo certo em cada estágio, `effort` baixo no
card, base de conhecimento em bloco cacheado, nenhuma chamada extra ao modelo caro).
Também exercita resposta malformada: gatilho fora do enum deve pular a rodada, não virar
faixa vermelha no meio da call.

É o teste que roda em qualquer máquina, sem Chrome e sem gastar um centavo. Rode depois de
mexer em `pipeline.ts`.

### 2. As legendas estão sendo lidas? (sem chave, sem custo, 2 minutos)

Este é o nível que mais importa, porque é o que tem mais chance de estar quebrado.

1. `npm run build` e carregue `dist/` em `chrome://extensions` (Modo do desenvolvedor → Carregar sem compactação).
2. **Não configure a chave da API ainda.**
3. Entre em qualquer reunião do Meet — pode ser sozinho, criando uma em `meet.google.com`.
4. Ligue as legendas (**CC**) e abra o painel lateral no ícone da extensão.
5. Fale.

O painel vai mostrar `abc-defg-hij · N falas` no topo, e **N tem que subir enquanto você
fala**. É esse contador que diz se o leitor de DOM está vivo. Vai aparecer também um aviso
vermelho de chave não configurada — é esperado neste nível, ignore.

Se N não sobe: DevTools na aba do Meet → no seletor de contexto do console, troque `top`
por **Copiloto de Reunião** → rode `__copilotoDiagnose()`. O relatório mostra quais
seletores casaram e quais regiões `aria-live` existem na página. Pegue o seletor novo e
adicione na primeira camada de `src/content/dom.ts`.

### 3. Os cards fazem sentido? (com chave, ~US$ 1, 15 minutos)

Precisa de **duas vozes** — é o que exercita a separação de quem falou. O jeito mais
simples de conseguir isso sozinho: entre na mesma reunião pelo celular, com fone, e faça os
dois papéis. O celular vira o "cliente".

Antes de começar, preencha nas opções:

- **seu nome exatamente como aparece no Meet** (sem isso não há medidor de monólogo nem separação de fala);
- **base de conhecimento** com 5 ou 6 fatos reais — faixas de preço, uma integração que vocês já fizeram, a resposta para a objeção de preço. Sem isso todo card vira "te confirmo depois" e o teste não mede nada.

Aí rode um roteiro curto, pelo celular, deixando alguns segundos entre as falas:

1. "Vocês integram com o [sistema que está na sua base]?" → deve virar card de **pergunta** com a resposta da base.
2. "Achei caro." → card de **objeção**.
3. "Te mando a proposta até sexta." → card de **compromisso**.
4. "Ainda não tenho orçamento aprovado." → card de **risco**.
5. Mande uma pergunta pelo **chat** do Meet também — é o caminho que passa pelo `chat.ts`, separado das legendas.

Depois clique em **Resumo da call** e confira se as seis dimensões saíram coerentes.

O que observar, além de "funcionou": **quanto tempo passou entre a fala e o card**, e se o
texto do card é dizível em voz alta do jeito que está. Card correto que chega 8 segundos
depois é card inútil.

### 4. Você usa de verdade? (5 calls reais)

Nível 3 mostra se o software funciona. Só o 4 mostra se o produto existe. Rode em 5 calls
de verdade e conte uma coisa só: **quantas vezes um card mudou o que você falou**.

Se for zero, a resposta não é melhorar o prompt — é que o valor está no resumo pós-call, e
o tempo real pode ser desligado sem perda. Essa é a hipótese que este repositório existe
para testar.

### Enquanto desenvolve

```bash
npm run dev         # rebuild automático
npm run typecheck   # sem emitir nada
npm run smoke       # pipeline contra o servidor de eco
```

Depois de cada rebuild, clique no botão de recarregar da extensão em `chrome://extensions`
e **recarregue a aba do Meet** — content script não recarrega sozinho.

## Custo por hora de call

Com base de conhecimento de ~2.000 tokens e uma call de 1 hora:

| Item | Estimativa |
|---|---|
| Estágio 1 (Haiku 4.5, ~720 chamadas curtas) | US$ 0,30 – 0,60 |
| Estágio 2 (Opus 5, ~8–15 cards) | US$ 0,25 – 0,60 |
| Checklist de cobertura (60 chamadas) | US$ 0,05 – 0,15 |
| Resumo pós-call (Opus 5, 1 chamada longa) | US$ 0,10 – 0,30 |
| **Total** | **~US$ 0,70 – 1,65/h** |

O cache do prefixo (base de conhecimento + briefing) só entra em ação a partir de um
tamanho mínimo — base pequena simplesmente não cacheia, e não há erro nisso. Confira
`usage.cache_read_input_tokens` se quiser medir.

## Privacidade e LGPD

- Nenhum áudio é capturado. A fonte é a legenda que o próprio Meet já gera.
- Transcrição e configuração ficam em `chrome.storage` local, nunca sincronizados.
- O texto da call vai para a API da Anthropic para gerar os cards.
- **Invisível não é secreto.** O painel não aparecer para o convidado é conveniência de UX,
  não licença para não avisar. Avise na call que você usa um assistente de IA para notas —
  a ANPD colocou IA como eixo prioritário de fiscalização para 2026–2027, e para vender
  para empresa isso vira pergunta de compliance mais cedo ou mais tarde.

### Cuidado com o compartilhamento de tela

Se você compartilhar **a tela inteira**, o painel vai junto. A detecção de "estou
apresentando" é heurística por texto da interface do Meet e pode falhar quando o Google
mudar a UI. A proteção que funciona de verdade é **compartilhar uma aba ou janela
específica**, nunca a tela inteira.

## Quando parar de funcionar

O Meet não tem API pública de DOM e os nomes de classe mudam sem aviso. Todo seletor
está em `src/content/dom.ts`, em três camadas: seletores conhecidos → dicas de
acessibilidade (`aria-*`) → heurística que observa qual região `aria-live` mais muda.

Se parar de ler:

1. Abra o DevTools na aba do Meet;
2. no seletor de contexto do console, troque de `top` para **Copiloto de Reunião**;
3. rode `__copilotoDiagnose()`;
4. pegue o seletor novo no relatório e adicione na primeira camada de `dom.ts`.

## O que ainda não foi validado

- **Nunca rodou em uma call real.** O pipeline passa no `npm run smoke` (15 verificações contra um servidor de eco). Isso cobre o nível 1 da escada acima. Nada além disso.
- **Os seletores do Meet não foram testados contra o DOM atual** — é o primeiro lugar a quebrar.
- **A hipótese central continua aberta:** ninguém olha para a tela durante uma call. Antes de investir mais, rode 5 calls de verdade e conte quantas vezes você realmente usou um card. Se a resposta for zero, o produto é o resumo pós-call, não o tempo real.

## Próximos passos naturais

- Espelhar os cards no celular (resolve o problema do compartilhamento de tela de vez).
- Exportar a transcrição direto para a skill `briefing-lead`, que já transforma transcrição de call em briefing de precificação.
- Preencher a ficha da [Triagem 2na8](../triagem-2na8) com a cobertura detectada.
- Zoom e Teams, que exigem captura local de áudio — só depois que o tempo real provar valor aqui.

## Estrutura

```
src/
  manifest.json          MV3
  shared/                tipos e settings (storage local)
  content/               leitura do DOM do Meet
    dom.ts               <- seletores; é aqui que quebra
    captions.ts          <- consolidação das legendas (elas são reescritas ao vivo)
    chat.ts
  background/            service worker: o único que fala com a API
    pipeline.ts          <- os dois estágios + resumo + cobertura
    prompts.ts           <- prompts e as seis dimensões da triagem
    session.ts           <- estado, espelhado em storage.session
  panel/                 painel lateral
  options/               configuração
```
