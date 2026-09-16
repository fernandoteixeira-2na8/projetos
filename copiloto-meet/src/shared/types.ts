/** Tipos compartilhados entre content script, service worker e painel. */

/** Uma fala ja consolidada (legenda finalizada) ou uma mensagem do chat. */
export interface TranscriptLine {
  id: string;
  /** 'fala' vem das legendas ao vivo; 'chat' vem do painel de mensagens. */
  source: 'fala' | 'chat';
  speaker: string;
  text: string;
  /** Epoch ms de quando a linha foi consolidada. */
  at: number;
}

/** Tipos de gatilho que justificam interromper a atencao do anfitriao. */
export type TriggerKind =
  | 'pergunta'    // perguntaram algo factual que voce precisa responder agora
  | 'objecao'     // preco, prazo, concorrente, "vou pensar"
  | 'compromisso' // alguem assumiu prazo/entrega — vira item de follow-up
  | 'risco'       // sinal de desqualificacao ou kill switch
  | 'nenhum';

/** Saida do estagio 1 (modelo barato). Classificacao, nada mais. */
export interface GateResult {
  trigger: TriggerKind;
  /** Trecho literal da transcricao que disparou o gatilho (ate ~200 chars). */
  excerpt: string;
  /** 0..1 — abaixo do limiar configurado, nao gasta o modelo bom. */
  confidence: number;
}

/** Saida do estagio 2 (modelo bom). O que aparece na tela. */
export interface Card {
  id: string;
  kind: TriggerKind;
  /** Ate ~60 chars. E o que o anfitriao le de relance. */
  headline: string;
  /** Ate ~240 chars. So aparece se ele olhar de verdade. */
  body: string;
  /** Trechos da base de conhecimento usados, para o usuario conferir. */
  sources: string[];
  excerpt: string;
  at: number;
}

/** Dimensoes de qualificacao cobertas ate agora (checklist passivo). */
export interface CoverageState {
  [dimensionId: string]: 'nao' | 'parcial' | 'sim';
}

export interface SessionState {
  meetingId: string | null;
  running: boolean;
  startedAt: number | null;
  lineCount: number;
  cards: Card[];
  coverage: CoverageState;
  /** Segundos falados pelo anfitriao vs. total, janela dos ultimos 5 min. */
  talkRatio: number | null;
  lastError: string | null;
  /** True quando o content script detecta que a aba esta apresentando. */
  presenting: boolean;
}

/** content script -> service worker */
export type ContentMessage =
  | { type: 'meet/hello'; meetingId: string }
  | { type: 'meet/lines'; lines: TranscriptLine[] }
  | { type: 'meet/presenting'; presenting: boolean }
  | { type: 'meet/heartbeat' }
  | { type: 'meet/bye' };

/** painel -> service worker */
export type PanelMessage =
  | { type: 'panel/subscribe' }
  | { type: 'panel/start' }
  | { type: 'panel/stop' }
  | { type: 'panel/dismiss-card'; cardId: string }
  | { type: 'panel/summary' }
  | { type: 'panel/export-transcript' };

/** service worker -> painel */
export type PanelEvent =
  | { type: 'state'; state: SessionState }
  | { type: 'card'; card: Card }
  | { type: 'summary/chunk'; text: string }
  | { type: 'summary/done' }
  | { type: 'summary/error'; message: string }
  | { type: 'transcript'; markdown: string };
