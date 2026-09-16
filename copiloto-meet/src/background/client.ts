import Anthropic from '@anthropic-ai/sdk';
import type { Settings } from '../shared/settings';

/**
 * Cria o client da API.
 *
 * ATENCAO ao modo 'direto': a chave fica no storage da extensao e vai do
 * navegador direto para api.anthropic.com. Isso serve para VOCE usar na sua
 * maquina. Para distribuir a extensao, use o modo 'proxy' — um backend seu
 * guarda a chave e a extensao so fala com ele.
 */
export function createClient(settings: Settings): Anthropic {
  if (settings.authMode === 'proxy') {
    if (!settings.proxyUrl) throw new Error('Configure a URL do backend nas opcoes.');
    return new Anthropic({
      baseURL: settings.proxyUrl,
      apiKey: settings.proxyToken || 'proxy',
      dangerouslyAllowBrowser: true,
    });
  }

  if (!settings.apiKey) throw new Error('Configure a chave da API nas opcoes.');
  return new Anthropic({
    apiKey: settings.apiKey,
    dangerouslyAllowBrowser: true,
    defaultHeaders: { 'anthropic-dangerous-direct-browser-access': 'true' },
  });
}

/** Mensagem de erro curta o suficiente para caber no painel. */
export function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return 'Chave da API invalida.';
  if (error instanceof Anthropic.RateLimitError) return 'Limite de requisicoes atingido.';
  if (error instanceof Anthropic.BadRequestError) return `Requisicao invalida: ${error.message}`;
  if (error instanceof Anthropic.APIError) return `Erro ${error.status}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}
