import Anthropic from '@anthropic-ai/sdk';
import { runCard, runCoverage, runGate } from '../src/background/pipeline';
import { DEFAULT_SETTINGS } from '../src/shared/settings';
import type { TranscriptLine } from '../src/shared/types';

/**
 * Exercita os tres estagios do pipeline contra um servidor de eco.
 * Roda em node, fora do navegador — nao toca em nenhuma API do Chrome.
 */

const lines: TranscriptLine[] = [
  { id: '1', source: 'fala', speaker: 'Fernando', text: 'A gente costuma trabalhar em fases.', at: Date.now() },
  { id: '2', source: 'fala', speaker: 'Cliente', text: 'Voces integram com o Protheus?', at: Date.now() },
];

export async function run(baseURL: string) {
  const client = new Anthropic({
    apiKey: 'sk-ant-falsa',
    baseURL,
    dangerouslyAllowBrowser: true,
    maxRetries: 0,
  });

  const settings = {
    ...DEFAULT_SETTINGS,
    hostName: 'Fernando',
    knowledgeBase: 'Integramos com Protheus via API REST.',
  };

  // A ordem importa: o servidor de eco devolve as respostas em fila, uma por
  // modelo, para exercitar cada caso.
  const gate = await runGate(client, lines);
  const card = gate ? await runCard(client, settings, lines, gate) : null;
  const coverage = await runCoverage(client, lines);
  const gateMalformado = await runGate(client, lines);
  const gateForaDeFaixa = await runGate(client, lines);

  return { gate, card, coverage, gateMalformado, gateForaDeFaixa };
}
