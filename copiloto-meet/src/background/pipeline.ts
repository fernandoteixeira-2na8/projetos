import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { Settings } from '../shared/settings';
import type { GateResult, TranscriptLine, TriggerKind } from '../shared/types';
import {
  CARD_SYSTEM_PERSONA,
  GATE_SYSTEM,
  SUMMARY_SYSTEM,
  knowledgeBlock,
  renderTranscript,
} from './prompts';

/**
 * Pipeline de dois estagios.
 *
 * Estagio 1 (barato, roda sempre): Haiku 4.5 classifica se aconteceu algo que
 * merece interromper. ~95% das rodadas terminam aqui, com "nenhum".
 * Estagio 2 (caro, roda raramente): Opus 5 escreve o card, com a base de
 * conhecimento no prefixo cacheado.
 *
 * O ganho de custo vem dessa razao. Trocar o estagio 1 por uma chamada unica
 * ao modelo bom a cada 5 segundos multiplica a conta por ~20.
 */

const GATE_MODEL = 'claude-haiku-4-5';
const CARD_MODEL = 'claude-opus-5';
const SUMMARY_MODEL = 'claude-opus-5';

/** Quantas linhas recentes cada estagio enxerga. */
const GATE_WINDOW = 14;
const CARD_WINDOW = 40;

const TRIGGERS = ['pergunta', 'objecao', 'compromisso', 'risco', 'nenhum'] as const;

/**
 * O schema estrito que vai no fio nao carrega `enum` — o helper do SDK rebaixa
 * a restricao para uma dica na `description`. A API entao aceita qualquer
 * string, e quem barra e o SDK, no cliente, LANCANDO ao validar a resposta.
 *
 * Numa call isso importa: um unico token torto do estagio 1 viraria faixa
 * vermelha no painel no meio da conversa. Rodada malformada e rodada pulada,
 * nao erro na tela. Erro de API de verdade (401, 429, 500) continua subindo.
 */
function respostaMalformada(error: unknown): boolean {
  return error instanceof Anthropic.AnthropicError && !(error instanceof Anthropic.APIError);
}

const GateSchema = z.object({
  trigger: z.enum(TRIGGERS),
  excerpt: z.string(),
  confidence: z.number(),
});

const CardSchema = z.object({
  headline: z.string(),
  body: z.string(),
  sources: z.array(z.string()),
});

export async function runGate(
  client: Anthropic,
  lines: TranscriptLine[],
): Promise<GateResult | null> {
  const window = lines.slice(-GATE_WINDOW);
  if (!window.length) return null;

  let parsed;
  try {
    const response = await client.messages.parse({
      model: GATE_MODEL,
      max_tokens: 300,
      system: GATE_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Ultimas falas da call:\n\n${renderTranscript(window)}`,
        },
      ],
      output_config: { format: zodOutputFormat(GateSchema) },
    });
    parsed = response.parsed_output;
  } catch (error) {
    if (respostaMalformada(error)) return null;
    throw error;
  }

  if (!parsed) return null;
  return {
    trigger: parsed.trigger as TriggerKind,
    // `confidence` passa pelo schema como numero qualquer: 7 e um numero.
    excerpt: parsed.excerpt.slice(0, 200),
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
  };
}

export async function runCard(
  client: Anthropic,
  settings: Settings,
  lines: TranscriptLine[],
  gate: GateResult,
): Promise<{ headline: string; body: string; sources: string[] }> {
  const window = lines.slice(-CARD_WINDOW);

  const response = await client.messages.parse({
    model: CARD_MODEL,
    max_tokens: 700,
    system: [
      { type: 'text', text: CARD_SYSTEM_PERSONA },
      {
        type: 'text',
        text: knowledgeBlock(settings),
        // Prefixo estavel entre chamadas: a base de conhecimento so muda quando
        // o usuario edita as opcoes. O cache so entra em acao a partir de um
        // tamanho minimo (512-4096 tokens conforme o modelo) — base pequena
        // simplesmente nao cacheia, e nao ha erro nenhum nisso.
        cache_control: { type: 'ephemeral' },
      },
    ],
    // effort baixo em vez de desligar o pensamento: e o caminho recomendado
    // para latencia no Opus 5, e aqui a latencia E o produto.
    output_config: { effort: 'low', format: zodOutputFormat(CardSchema) },
    messages: [
      {
        role: 'user',
        content:
          `Gatilho detectado: ${gate.trigger}\n` +
          `Trecho: "${gate.excerpt}"\n\n` +
          `Contexto recente da call:\n${renderTranscript(window)}\n\n` +
          `Escreva o card para esse gatilho.`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error('O modelo nao devolveu um card valido.');
  return {
    headline: parsed.headline.slice(0, 80),
    body: parsed.body.slice(0, 300),
    sources: parsed.sources.slice(0, 4),
  };
}

/**
 * Resumo pos-call. Sai em streaming porque e texto longo — e porque ver o
 * resumo nascendo evita a sensacao de travamento depois de uma hora de call.
 */
export async function runSummary(
  client: Anthropic,
  settings: Settings,
  lines: TranscriptLine[],
  onText: (chunk: string) => void,
): Promise<void> {
  const stream = client.messages.stream({
    model: SUMMARY_MODEL,
    max_tokens: 8000,
    system: [
      { type: 'text', text: SUMMARY_SYSTEM },
      {
        type: 'text',
        text: knowledgeBlock(settings),
        cache_control: { type: 'ephemeral' },
      },
    ],
    output_config: { effort: 'medium' },
    messages: [
      {
        role: 'user',
        content: `Transcricao completa da call:\n\n${renderTranscript(lines)}`,
      },
    ],
  });

  stream.on('text', onText);
  await stream.finalMessage();
}

const CoverageSchema = z.object({
  grana: z.enum(['nao', 'parcial', 'sim']),
  dor: z.enum(['nao', 'parcial', 'sim']),
  fit: z.enum(['nao', 'parcial', 'sim']),
  urgencia: z.enum(['nao', 'parcial', 'sim']),
  decisao: z.enum(['nao', 'parcial', 'sim']),
  operar: z.enum(['nao', 'parcial', 'sim']),
});

/**
 * Checklist passivo: o que das seis dimensoes ja foi coberto. Nao interrompe
 * ninguem — e o estado que fica no rodape do painel. Roda no modelo barato
 * porque e leitura de cobertura, nao julgamento.
 */
export async function runCoverage(
  client: Anthropic,
  lines: TranscriptLine[],
): Promise<Record<string, 'nao' | 'parcial' | 'sim'> | null> {
  if (!lines.length) return null;

  let response;
  try {
    response = await client.messages.parse({
      model: GATE_MODEL,
      max_tokens: 400,
      system:
        'Voce acompanha uma call de pre-vendas e marca quais dimensoes de qualificacao ja foram cobertas.\n\n' +
        'Para cada dimensao responda:\n' +
        '- "sim": foi perguntada E respondida com informacao util.\n' +
        '- "parcial": tocaram no assunto sem fechar.\n' +
        '- "nao": nao apareceu.\n\n' +
        'Dimensoes: grana (capacidade de investimento), dor (dor quantificada com numero), ' +
        'fit (por que precisa ser sob medida), urgencia (gatilho com data), ' +
        'decisao (quem decide e se esta na call), operar (quem toca depois de entregue).',
      messages: [
        {
          role: 'user',
          content: `Transcricao ate agora:\n\n${renderTranscript(lines.slice(-150))}`,
        },
      ],
      output_config: { format: zodOutputFormat(CoverageSchema) },
    });
  } catch (error) {
    if (respostaMalformada(error)) return null;
    throw error;
  }

  return response.parsed_output ?? null;
}
