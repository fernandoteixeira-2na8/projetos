/** Configuracao persistida em chrome.storage.local (nunca sincronizada). */

export type AuthMode = 'direto' | 'proxy';

export interface Settings {
  /**
   * 'direto': a chave da API fica dentro da extensao. Serve para uso pessoal,
   * nao para distribuir — quem instalar a extensao consegue ler a chave.
   * 'proxy': a extensao chama um backend seu, que guarda a chave.
   */
  authMode: AuthMode;
  apiKey: string;
  proxyUrl: string;
  proxyToken: string;

  /** Seu nome como aparece no Meet. Usado para separar sua fala da do cliente. */
  hostName: string;
  /** Base de conhecimento colada pelo usuario (precos, integracoes, casos). */
  knowledgeBase: string;
  /** Contexto do lead da call de hoje. */
  leadBriefing: string;

  /** Intervalo minimo entre rodadas do estagio 1, em ms. */
  gateIntervalMs: number;
  /** Confianca minima do estagio 1 para acionar o modelo bom. */
  gateThreshold: number;
  /** Tempo minimo entre dois cards, em ms. Protege a atencao do anfitriao. */
  cardCooldownMs: number;
  /** Gatilhos habilitados. */
  enabledTriggers: Record<string, boolean>;

  /** Esconde o conteudo dos cards quando a aba estiver apresentando. */
  hideWhilePresenting: boolean;
  /** Mostra o lembrete de aviso de consentimento ao iniciar a sessao. */
  consentReminder: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  authMode: 'direto',
  apiKey: '',
  proxyUrl: '',
  proxyToken: '',
  hostName: '',
  knowledgeBase: '',
  leadBriefing: '',
  gateIntervalMs: 5000,
  gateThreshold: 0.6,
  cardCooldownMs: 25000,
  enabledTriggers: {
    pergunta: true,
    objecao: true,
    compromisso: true,
    risco: true,
  },
  hideWhilePresenting: true,
  consentReminder: true,
};

const KEY = 'copiloto.settings.v1';

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[KEY] as Partial<Settings> | undefined) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

export function onSettingsChanged(cb: (s: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) {
      cb({ ...DEFAULT_SETTINGS, ...(changes[KEY].newValue as Partial<Settings>) });
    }
  });
}
