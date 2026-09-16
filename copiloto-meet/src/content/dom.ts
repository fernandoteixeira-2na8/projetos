/**
 * Descoberta de elementos no DOM do Meet.
 *
 * ESTE E O ARQUIVO QUE MAIS QUEBRA. O Meet nao tem API publica de DOM e os
 * nomes de classe sao gerados no build — mudam sem aviso. A estrategia aqui e
 * em tres camadas, da mais especifica para a mais generica:
 *
 *   1. seletores conhecidos (rapido, quebra a cada refactor do Meet);
 *   2. dicas de acessibilidade (aria-label / role), que mudam bem menos;
 *   3. heuristica: observar por alguns segundos qual regiao aria-live recebe
 *      mais mutacao de texto e assumir que e a das legendas.
 *
 * Quando tudo falhar, `diagnose()` imprime no console o que foi encontrado —
 * use para descobrir o seletor novo e adicionar na camada 1.
 */

const CAPTION_CANDIDATES = [
  'div[jsname="dsyhDe"]',
  'div[jsname="YSxPC"]',
  '.a4cQT',
  '[role="region"][aria-label*="egenda" i]',
  '[role="region"][aria-label*="aption" i]',
];

const CHAT_CANDIDATES = [
  'div[jsname="xySENc"]',
  '[role="log"][aria-live]',
  '[aria-label*="Mensagens" i][role="list"]',
  '[aria-label*="hat message" i]',
];

function firstMatch(selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
}

/** Camada 3: observa regioes aria-live e devolve a que mais muda de texto. */
function busiestLiveRegion(windowMs: number): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const regions = Array.from(
      document.querySelectorAll<HTMLElement>('[aria-live="polite"], [aria-live="assertive"]'),
    ).filter((el) => el.offsetParent !== null);

    if (regions.length === 0) return resolve(null);

    const hits = new Map<HTMLElement, number>();
    const observers = regions.map((region) => {
      const obs = new MutationObserver((records) => {
        hits.set(region, (hits.get(region) ?? 0) + records.length);
      });
      obs.observe(region, { childList: true, subtree: true, characterData: true });
      return obs;
    });

    setTimeout(() => {
      observers.forEach((o) => o.disconnect());
      let best: HTMLElement | null = null;
      let bestScore = 0;
      for (const [region, score] of hits) {
        if (score > bestScore) {
          best = region;
          bestScore = score;
        }
      }
      resolve(bestScore >= 3 ? best : null);
    }, windowMs);
  });
}

export async function findCaptionRoot(): Promise<HTMLElement | null> {
  return firstMatch(CAPTION_CANDIDATES) ?? (await busiestLiveRegion(6000));
}

export function findChatRoot(): HTMLElement | null {
  return firstMatch(CHAT_CANDIDATES);
}

/**
 * Detecta se ESTA aba esta apresentando. Heuristica por texto de UI — o Meet
 * nao expoe esse estado de forma estavel. Se falhar, o pior caso e o painel
 * nao se esconder sozinho; por isso o README manda compartilhar uma aba ou
 * janela especifica, nunca a tela inteira.
 */
const PRESENTING_HINTS = [
  'Você está apresentando',
  'Voce esta apresentando',
  'You are presenting',
  'Parar de apresentar',
  'Stop presenting',
];

export function detectPresenting(): boolean {
  const haystack = document.body?.innerText ?? '';
  return PRESENTING_HINTS.some((hint) => haystack.includes(hint));
}

/** Extrai o nome de quem fala de um bloco de legenda, com varias tentativas. */
export function extractSpeaker(block: HTMLElement): string {
  const img = block.querySelector('img');
  if (img) {
    const near = img.parentElement?.parentElement;
    const candidate = near?.querySelector('span, div');
    const name = candidate?.textContent?.trim();
    if (name && name.length > 0 && name.length < 60) return name;
  }
  const labelled = block.querySelector<HTMLElement>('[data-self-name], [data-sender-name]');
  if (labelled?.textContent) return labelled.textContent.trim();

  const first = block.firstElementChild?.textContent?.trim();
  if (first && first.length > 0 && first.length < 60) return first;

  return 'desconhecido';
}

/** Texto da legenda sem o nome de quem fala. */
export function extractCaptionText(block: HTMLElement, speaker: string): string {
  const full = (block.innerText ?? block.textContent ?? '').trim();
  const withoutSpeaker = full.startsWith(speaker) ? full.slice(speaker.length) : full;
  return withoutSpeaker.replace(/\s+/g, ' ').trim();
}

/** Chame `__copilotoDiagnose()` no console (contexto da extensao) se parar de ler. */
export function diagnose(): void {
  const report = {
    captionCandidates: CAPTION_CANDIDATES.map((s) => ({ s, found: !!document.querySelector(s) })),
    chatCandidates: CHAT_CANDIDATES.map((s) => ({ s, found: !!document.querySelector(s) })),
    liveRegions: Array.from(document.querySelectorAll('[aria-live]')).map((el) => ({
      aria: el.getAttribute('aria-live'),
      label: el.getAttribute('aria-label'),
      jsname: el.getAttribute('jsname'),
      cls: (el as HTMLElement).className,
      preview: (el as HTMLElement).innerText?.slice(0, 80),
    })),
    presenting: detectPresenting(),
  };
  console.log('[copiloto] diagnostico de seletores', report);
}
