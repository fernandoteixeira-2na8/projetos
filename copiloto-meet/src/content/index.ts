import type { ContentMessage, TranscriptLine } from '../shared/types';
import { CaptionReader } from './captions';
import { ChatReader } from './chat';
import { detectPresenting, diagnose } from './dom';

/**
 * Content script do Meet. Nao fala com a API: so le o DOM e manda linhas para
 * o service worker. Nenhum audio e capturado — a fonte e a legenda que o
 * proprio Meet ja gera, entao o usuario precisa ligar as legendas (CC).
 */

/**
 * Canal com o service worker.
 *
 * Usamos uma Port em vez de sendMessage por um motivo especifico do MV3: o
 * service worker e desligado depois de ~30s ocioso, e um copiloto que dorme no
 * meio da call nao serve para nada. Enquanto a porta estiver aberta e houver
 * trafego (ver o heartbeat abaixo), o worker fica de pe.
 */
let port: chrome.runtime.Port | null = null;

function connect(): void {
  try {
    port = chrome.runtime.connect({ name: 'meet' });
    port.onDisconnect.addListener(() => {
      port = null;
      setTimeout(connect, 1000);
    });
  } catch {
    port = null;
  }
}

const send = (msg: ContentMessage) => {
  if (!port) connect();
  try {
    port?.postMessage(msg);
  } catch {
    port = null;
  }
};

function meetingId(): string {
  const m = location.pathname.match(/\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  return m?.[1] ?? (location.pathname.replace(/^\//, '') || 'desconhecida');
}

let buffer: TranscriptLine[] = [];
let flushTimer: number | null = null;

/** Agrupa linhas em lotes de ~1s para nao inundar o service worker. */
function queue(lines: TranscriptLine[]): void {
  buffer.push(...lines);
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (!buffer.length) return;
    send({ type: 'meet/lines', lines: buffer });
    buffer = [];
  }, 1000) as unknown as number;
}

const captions = new CaptionReader(queue);
const chat = new ChatReader(queue);

let presenting = false;
function watchPresenting(): void {
  setInterval(() => {
    const now = detectPresenting();
    if (now !== presenting) {
      presenting = now;
      send({ type: 'meet/presenting', presenting });
    }
  }, 4000);
}

async function boot(): Promise<void> {
  connect();
  send({ type: 'meet/hello', meetingId: meetingId() });
  setInterval(() => send({ type: 'meet/heartbeat' }), 20000);

  const ok = await captions.start();
  if (!ok) {
    console.warn(
      '[copiloto] nao encontrei o painel de legendas. Ligue as legendas (CC) no Meet. ' +
        'Se ja estiverem ligadas, rode __copilotoDiagnose() neste console.',
    );
    // Tenta de novo enquanto a reuniao estiver aberta: o usuario pode ligar CC depois.
    const retry = setInterval(async () => {
      if (await captions.start()) clearInterval(retry);
    }, 5000);
  }

  chat.start();
  watchPresenting();
}

window.addEventListener('pagehide', () => {
  captions.stop();
  chat.stop();
  send({ type: 'meet/bye' });
});

// Exposto para depuracao no console (contexto "Copiloto de Reuniao" do DevTools).
(globalThis as unknown as Record<string, unknown>).__copilotoDiagnose = diagnose;

void boot();
