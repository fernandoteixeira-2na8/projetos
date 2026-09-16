import type { Card, CoverageState, SessionState, TranscriptLine } from '../shared/types';

/** Quantas linhas mantemos em memoria. ~1h de call cabe folgado. */
const MAX_LINES = 4000;
/** Janela do medidor de monologo. */
const TALK_WINDOW_MS = 5 * 60 * 1000;

/**
 * Estado de uma reuniao. Vive no service worker, que o Chrome pode derrubar a
 * qualquer momento — por isso a transcricao e espelhada em chrome.storage.session
 * a cada lote. Perder o resumo de uma call de uma hora por causa de um
 * service worker reciclado seria o pior bug possivel deste produto.
 */
export class Session {
  private lines: TranscriptLine[] = [];
  private cards: Card[] = [];
  private coverage: CoverageState = {};
  private startedAt: number | null = null;
  private meetingId: string | null = null;
  private running = false;
  private presenting = false;
  private lastError: string | null = null;

  /** Ultima linha ja vista pelo estagio 1 — evita reclassificar o mesmo texto. */
  private gatedUpTo = 0;

  static readonly STORAGE_KEY = 'copiloto.session.v1';

  async restore(): Promise<void> {
    const stored = await chrome.storage.session.get(Session.STORAGE_KEY);
    const snap = stored[Session.STORAGE_KEY] as
      | { lines: TranscriptLine[]; cards: Card[]; coverage: CoverageState; startedAt: number | null; meetingId: string | null }
      | undefined;
    if (!snap) return;
    this.lines = snap.lines ?? [];
    this.cards = snap.cards ?? [];
    this.coverage = snap.coverage ?? {};
    this.startedAt = snap.startedAt ?? null;
    this.meetingId = snap.meetingId ?? null;
    this.gatedUpTo = this.lines.length;
  }

  private persist(): void {
    void chrome.storage.session.set({
      [Session.STORAGE_KEY]: {
        lines: this.lines,
        cards: this.cards,
        coverage: this.coverage,
        startedAt: this.startedAt,
        meetingId: this.meetingId,
      },
    });
  }

  start(meetingId: string | null): void {
    if (this.meetingId && meetingId && this.meetingId !== meetingId) this.reset();
    this.meetingId = meetingId ?? this.meetingId;
    this.startedAt ??= Date.now();
    this.running = true;
    this.lastError = null;
    this.persist();
  }

  stop(): void {
    this.running = false;
    this.persist();
  }

  reset(): void {
    this.lines = [];
    this.cards = [];
    this.coverage = {};
    this.startedAt = null;
    this.gatedUpTo = 0;
    this.lastError = null;
    this.persist();
  }

  addLines(lines: TranscriptLine[]): void {
    this.lines.push(...lines);
    if (this.lines.length > MAX_LINES) this.lines = this.lines.slice(-MAX_LINES);
    this.persist();
  }

  addCard(card: Card): void {
    this.cards.unshift(card);
    if (this.cards.length > 30) this.cards.pop();
    this.persist();
  }

  dropCard(cardId: string): void {
    this.cards = this.cards.filter((c) => c.id !== cardId);
    this.persist();
  }

  setCoverage(coverage: CoverageState): void {
    this.coverage = coverage;
    this.persist();
  }

  setPresenting(value: boolean): void {
    this.presenting = value;
  }

  setError(message: string | null): void {
    this.lastError = message;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get allLines(): TranscriptLine[] {
    return this.lines;
  }

  /** Ha texto novo desde a ultima passada do estagio 1? */
  hasFreshLines(): boolean {
    return this.lines.length > this.gatedUpTo;
  }

  markGated(): void {
    this.gatedUpTo = this.lines.length;
  }

  /** Fracao da fala que saiu do anfitriao nos ultimos 5 minutos. */
  talkRatio(hostName: string): number | null {
    if (!hostName) return null;
    const since = Date.now() - TALK_WINDOW_MS;
    let host = 0;
    let total = 0;
    for (const line of this.lines) {
      if (line.at < since || line.source !== 'fala') continue;
      total += line.text.length;
      if (line.speaker.toLowerCase().includes(hostName.toLowerCase())) host += line.text.length;
    }
    return total > 0 ? host / total : null;
  }

  snapshot(hostName: string): SessionState {
    return {
      meetingId: this.meetingId,
      running: this.running,
      startedAt: this.startedAt,
      lineCount: this.lines.length,
      cards: this.cards,
      coverage: this.coverage,
      talkRatio: this.talkRatio(hostName),
      lastError: this.lastError,
      presenting: this.presenting,
    };
  }

  toMarkdown(): string {
    const header = `# Transcricao — ${this.meetingId ?? 'call'}\n\n`;
    const body = this.lines
      .map((l) => {
        const t = new Date(l.at).toLocaleTimeString('pt-BR');
        return `**${l.speaker}** (${t}${l.source === 'chat' ? ', chat' : ''}): ${l.text}`;
      })
      .join('\n\n');
    return header + body + '\n';
  }
}
