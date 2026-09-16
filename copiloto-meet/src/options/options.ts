import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from '../shared/settings';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const savedBadge = $('saved');

let saveTimer: number | null = null;
function flashSaved(): void {
  savedBadge.classList.add('on');
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => savedBadge.classList.remove('on'), 1200) as unknown as number;
}

const TEXT_FIELDS = [
  'apiKey',
  'proxyUrl',
  'proxyToken',
  'hostName',
  'knowledgeBase',
  'leadBriefing',
] as const;

const TRIGGERS = ['pergunta', 'objecao', 'compromisso', 'risco'] as const;

function toggleAuthGroups(mode: string): void {
  $('grp-direto').hidden = mode !== 'direto';
  $('grp-proxy').hidden = mode !== 'proxy';
}

function fill(settings: Settings): void {
  for (const key of TEXT_FIELDS) {
    $<HTMLInputElement | HTMLTextAreaElement>(key).value = settings[key];
  }
  $<HTMLSelectElement>('authMode').value = settings.authMode;
  toggleAuthGroups(settings.authMode);

  $<HTMLInputElement>('gateThreshold').value = String(settings.gateThreshold);
  $<HTMLInputElement>('cardCooldownMs').value = String(Math.round(settings.cardCooldownMs / 1000));
  $<HTMLInputElement>('gateIntervalMs').value = String(Math.round(settings.gateIntervalMs / 1000));

  for (const t of TRIGGERS) {
    $<HTMLInputElement>(`t-${t}`).checked = settings.enabledTriggers[t] ?? true;
  }
  $<HTMLInputElement>('hideWhilePresenting').checked = settings.hideWhilePresenting;
  $<HTMLInputElement>('consentReminder').checked = settings.consentReminder;
}

function collect(): Partial<Settings> {
  const num = (id: string, fallback: number): number => {
    const value = Number($<HTMLInputElement>(id).value);
    return Number.isFinite(value) ? value : fallback;
  };

  const patch: Partial<Settings> = {
    authMode: $<HTMLSelectElement>('authMode').value as Settings['authMode'],
    gateThreshold: Math.min(1, Math.max(0, num('gateThreshold', DEFAULT_SETTINGS.gateThreshold))),
    cardCooldownMs: Math.max(0, num('cardCooldownMs', 25) * 1000),
    gateIntervalMs: Math.max(2, num('gateIntervalMs', 5)) * 1000,
    enabledTriggers: Object.fromEntries(
      TRIGGERS.map((t) => [t, $<HTMLInputElement>(`t-${t}`).checked]),
    ),
    hideWhilePresenting: $<HTMLInputElement>('hideWhilePresenting').checked,
    consentReminder: $<HTMLInputElement>('consentReminder').checked,
  };
  for (const key of TEXT_FIELDS) {
    patch[key] = $<HTMLInputElement | HTMLTextAreaElement>(key).value;
  }
  return patch;
}

let debounce: number | null = null;
function scheduleSave(): void {
  if (debounce !== null) clearTimeout(debounce);
  debounce = setTimeout(async () => {
    await saveSettings(collect());
    flashSaved();
  }, 400) as unknown as number;
}

void (async () => {
  fill(await loadSettings());
  document.querySelectorAll('input, textarea, select').forEach((el) => {
    el.addEventListener('input', scheduleSave);
    el.addEventListener('change', scheduleSave);
  });
  $<HTMLSelectElement>('authMode').addEventListener('change', (e) =>
    toggleAuthGroups((e.target as HTMLSelectElement).value),
  );
})();
