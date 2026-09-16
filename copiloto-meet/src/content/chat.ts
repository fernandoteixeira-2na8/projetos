import type { TranscriptLine } from '../shared/types';
import { findChatRoot } from './dom';

/**
 * Leitor do chat do Meet. Mais simples que as legendas: mensagem de chat nao
 * e reescrita, entao basta deduplicar pelo par (autor, texto) ja visto.
 */
export class ChatReader {
  private root: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private poll: number | null = null;
  private seen = new Set<string>();
  private seq = 0;

  constructor(private readonly onLines: (lines: TranscriptLine[]) => void) {}

  start(): void {
    // O painel de chat so existe no DOM quando aberto — por isso o poll.
    this.poll = setInterval(() => this.attach(), 3000) as unknown as number;
    this.attach();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.poll !== null) clearInterval(this.poll);
    this.poll = null;
  }

  private attach(): void {
    const root = findChatRoot();
    if (!root || root === this.root) return;
    this.root = root;
    this.observer?.disconnect();
    this.observer = new MutationObserver(() => this.scan());
    this.observer.observe(root, { childList: true, subtree: true });
    this.scan();
  }

  private scan(): void {
    if (!this.root) return;
    const out: TranscriptLine[] = [];

    for (const el of Array.from(this.root.querySelectorAll<HTMLElement>('[data-message-text], [data-sender-name]'))) {
      const text = (el.getAttribute('data-message-text') ?? el.innerText ?? '').trim();
      if (!text) continue;
      const speaker =
        el.getAttribute('data-sender-name') ??
        el.closest<HTMLElement>('[data-sender-name]')?.getAttribute('data-sender-name') ??
        'chat';
      const key = `${speaker}::${text}`;
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      out.push({
        id: `chat-${Date.now()}-${this.seq++}`,
        source: 'chat',
        speaker,
        text,
        at: Date.now(),
      });
    }

    if (out.length) this.onLines(out);
  }
}
