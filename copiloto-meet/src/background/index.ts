import type Anthropic from '@anthropic-ai/sdk';
import { loadSettings, onSettingsChanged, type Settings } from '../shared/settings';
import type { Card, ContentMessage, PanelEvent, PanelMessage } from '../shared/types';
import { createClient, describeError } from './client';
import { runCard, runCoverage, runGate, runSummary } from './pipeline';
import { Session } from './session';

/**
 * Service worker: o unico lugar que fala com a API.
 *
 * Ciclo, por rodada de TICK_MS:
 *   ha texto novo? -> estagio 1 (barato) -> passou do limiar? -> estagio 2 (caro)
 *
 * Tres guardas existem para proteger a atencao do usuario, e nao o custo:
 * cooldown entre cards, deduplicacao por trecho, e gatilhos desligaveis. Um
 * card errado custa mais caro que dez cards ausentes.
 */

const TICK_MS = 2000;
const COVERAGE_EVERY_MS = 60_000;

const session = new Session();
let settings: Settings;
let client: Anthropic | null = null;
let clientError: string | null = null;

let lastGateAt = 0;
let lastCardAt = 0;
let lastCoverageAt = 0;
let inFlight = false;
const recentExcerpts = new Set<string>();

const panelPorts = new Set<chrome.runtime.Port>();

function broadcast(event: PanelEvent): void {
  for (const port of panelPorts) {
    try {
      port.postMessage(event);
    } catch {
      panelPorts.delete(port);
    }
  }
}

function pushState(): void {
  broadcast({ type: 'state', state: session.snapshot(settings?.hostName ?? '') });
}

function rebuildClient(): void {
  try {
    client = createClient(settings);
    clientError = null;
  } catch (error) {
    client = null;
    clientError = describeError(error);
  }
  session.setError(clientError);
}

async function init(): Promise<void> {
  settings = await loadSettings();
  await session.restore();
  rebuildClient();
  onSettingsChanged((next) => {
    settings = next;
    rebuildClient();
    pushState();
  });
}

const ready = init();

/** Normaliza o trecho para comparar gatilhos repetidos. */
function excerptKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9áàâãéêíóôõúç ]/gi, '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

async function tick(): Promise<void> {
  await ready;
  if (!session.isRunning || !client || inFlight) return;

  const now = Date.now();
  if (now - lastGateAt < settings.gateIntervalMs) return;
  if (!session.hasFreshLines()) return;

  inFlight = true;
  lastGateAt = now;

  try {
    const lines = session.allLines;
    const gate = await runGate(client, lines);
    session.markGated();

    if (now - lastCoverageAt > COVERAGE_EVERY_MS) {
      lastCoverageAt = now;
      void runCoverage(client, lines)
        .then((coverage) => {
          if (coverage) {
            session.setCoverage(coverage);
            pushState();
          }
        })
        .catch(() => {
          /* cobertura e acessorio: falhar aqui nao interrompe a call */
        });
    }

    if (!gate || gate.trigger === 'nenhum') return;
    if (!settings.enabledTriggers[gate.trigger]) return;
    if (gate.confidence < settings.gateThreshold) return;
    if (Date.now() - lastCardAt < settings.cardCooldownMs) return;

    const key = excerptKey(gate.excerpt);
    if (!key || recentExcerpts.has(key)) return;
    recentExcerpts.add(key);
    if (recentExcerpts.size > 40) recentExcerpts.delete(recentExcerpts.values().next().value as string);

    const built = await runCard(client, settings, lines, gate);
    const card: Card = {
      id: `card-${Date.now()}`,
      kind: gate.trigger,
      headline: built.headline,
      body: built.body,
      sources: built.sources,
      excerpt: gate.excerpt,
      at: Date.now(),
    };
    lastCardAt = card.at;
    session.addCard(card);
    session.setError(null);
    broadcast({ type: 'card', card });
    pushState();
  } catch (error) {
    session.setError(describeError(error));
    pushState();
  } finally {
    inFlight = false;
  }
}

setInterval(() => void tick(), TICK_MS);

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'meet') {
    port.onMessage.addListener((msg: ContentMessage) => void onContentMessage(msg));
    port.onDisconnect.addListener(() => {
      session.setPresenting(false);
      pushState();
    });
    return;
  }

  if (port.name === 'panel') {
    panelPorts.add(port);
    port.onMessage.addListener((msg: PanelMessage) => void onPanelMessage(msg));
    port.onDisconnect.addListener(() => panelPorts.delete(port));
    void ready.then(pushState);
  }
});

async function onContentMessage(msg: ContentMessage): Promise<void> {
  await ready;
  switch (msg.type) {
    case 'meet/hello':
      session.start(msg.meetingId);
      pushState();
      break;
    case 'meet/lines':
      session.addLines(msg.lines);
      break;
    case 'meet/presenting':
      session.setPresenting(msg.presenting);
      pushState();
      break;
    case 'meet/bye':
      session.stop();
      pushState();
      break;
    case 'meet/heartbeat':
      break;
  }
}

async function onPanelMessage(msg: PanelMessage): Promise<void> {
  await ready;
  switch (msg.type) {
    case 'panel/subscribe':
      pushState();
      break;
    case 'panel/start':
      session.start(null);
      pushState();
      break;
    case 'panel/stop':
      session.stop();
      pushState();
      break;
    case 'panel/dismiss-card':
      session.dropCard(msg.cardId);
      pushState();
      break;
    case 'panel/export-transcript':
      broadcast({ type: 'transcript', markdown: session.toMarkdown() });
      break;
    case 'panel/summary':
      await generateSummary();
      break;
  }
}

async function generateSummary(): Promise<void> {
  if (!client) {
    broadcast({ type: 'summary/error', message: clientError ?? 'Client nao configurado.' });
    return;
  }
  if (!session.allLines.length) {
    broadcast({ type: 'summary/error', message: 'Nada foi capturado ainda.' });
    return;
  }
  try {
    await runSummary(client, settings, session.allLines, (chunk) =>
      broadcast({ type: 'summary/chunk', text: chunk }),
    );
    broadcast({ type: 'summary/done' });
  } catch (error) {
    broadcast({ type: 'summary/error', message: describeError(error) });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
