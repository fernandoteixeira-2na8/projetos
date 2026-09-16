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

- **Nunca rodou em uma call real.** O pipeline foi testado contra um servidor de eco local: as três chamadas saem bem formadas e as respostas são parseadas. Nada além disso.
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
