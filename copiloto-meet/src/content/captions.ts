import type { TranscriptLine } from '../shared/types';
import { extractCaptionText, extractSpeaker, findCaptionRoot } from './dom';

/**
 * Leitor das legendas ao vivo do Meet.
 *
 * As legendas nao sao imutaveis: o Meet reescreve a mesma linha varias vezes
 * enquanto a pessoa fala ("vocês inte" -> "vocês integram com o" -> ...). Por
 * isso nada e emitido no ato: cada bloco so vira linha de transcricao depois
 * de ficar STABLE_MS sem mudar, ou quando sai do DOM.
 */

const STABLE_MS = 2500;
const TICK_MS = 500;

interface Pending {
  speaker: string;
  text: string;
  changedAt: number;
  /** Quanto desse bloco ja foi emitido — o resto e delta a emitir. */
  emittedChars: number;
}

export class CaptionReader {
  private root: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private timer: number | null = null;
  private pending = new Map<HTMLElement, Pending>();
  private seq = 0;

  constructor(private readonly onLines: (lines: TranscriptLine[]) => void) {}

  async start(): Promise<boolean> {
    this.root = await findCaptionRoot();
    if (!this.root) return false;

    this.observer = new MutationObserver(() => this.scan());
    this.observer.observe(this.root, { childList: true, subtree: true, characterData: true });
    this.timer = setInterval(() => this.flushStable(), TICK_MS) as unknown as number;
    this.scan();
    return true;
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.flushStable(true);
    this.pending.clear();
  }

  /** Blocos de legenda = filhos diretos do root que tem texto. */
  private blocks(): HTMLElement[] {
    if (!this.root) return [];
    const direct = Array.from(this.root.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && (el.innerText ?? '').trim().length > 0,
    );
    // Alguns layouts embrulham tudo em um unico wrapper; desce um nivel.
    if (direct.length === 1 && direct[0] && direct[0].children.length > 1) {
      return Array.from(direct[0].children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement && (el.innerText ?? '').trim().length > 0,
      );
    }
    return direct;
  }

  private scan(): void {
    const now = Date.now();
    const seen = new Set<HTMLElement>();

    for (const block of this.blocks()) {
      seen.add(block);
      const speaker = extractSpeaker(block);
      const text = extractCaptionText(block, speaker);
      if (!text) continue;

      const prev = this.pending.get(block);
      if (!prev) {
        this.pending.set(block, { speaker, text, changedAt: now, emittedChars: 0 });
      } else if (prev.text !== text) {
        // Se o texto encolheu, o Meet reciclou o no para outra fala:
        // fecha o que havia e recomeca.
        if (!text.startsWith(prev.text.slice(0, prev.emittedChars))) {
          this.emit(prev, prev.text.slice(prev.emittedChars));
          prev.emittedChars = 0;
        }
        prev.speaker = speaker;
        prev.text = text;
        prev.changedAt = now;
      }
    }

    // Bloco que saiu do DOM: consolida o que sobrou.
    for (const [block, entry] of this.pending) {
      if (!seen.has(block)) {
        this.emit(entry, entry.text.slice(entry.emittedChars));
        this.pending.delete(block);
      }
    }
  }

  private flushStable(force = false): void {
    const now = Date.now();
    const out: TranscriptLine[] = [];
    for (const entry of this.pending.values()) {
      const stale = force || now - entry.changedAt >= STABLE_MS;
      if (!stale) continue;
      const delta = entry.text.slice(entry.emittedChars).trim();
      if (!delta) continue;
      out.push(this.line(entry.speaker, delta));
      entry.emittedChars = entry.text.length;
    }
    if (out.length) this.onLines(out);
  }

  private emit(entry: Pending, delta: string): void {
    const trimmed = delta.trim();
    if (trimmed) this.onLines([this.line(entry.speaker, trimmed)]);
  }

  private line(speaker: string, text: string): TranscriptLine {
    return {
      id: `fala-${Date.now()}-${this.seq++}`,
      source: 'fala',
      speaker,
      text,
      at: Date.now(),
    };
  }
}
