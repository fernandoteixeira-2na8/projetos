import { loadSettings, saveSettings, type Settings } from '../shared/settings';
import { DIMENSOES } from '../background/prompts';
import type { Card, PanelEvent, PanelMessage, SessionState } from '../shared/types';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const els = {
  dot: $('dot'),
  status: $('status'),
  toggle: $<HTMLButtonElement>('toggle'),
  opts: $<HTMLButtonElement>('opts'),
  consent: $('consent'),
  consentOk: $<HTMLButtonElement>('consent-ok'),
  error: $('error'),
  presenting: $('presenting'),
  cards: $('cards'),
  meter: $('meter'),
  meterFill: $('meter-fill'),
  meterVal: $('meter-val'),
  coverage: $('coverage'),
  summary: $<HTMLButtonElement>('summary'),
  export: $<HTMLButtonElement>('export'),
  modal: $<HTMLDialogElement>('modal'),
  modalTitle: $('modal-title'),
  modalBody: $('modal-body'),
  modalCopy: $<HTMLButtonElement>('modal-copy'),
  modalClose: $<HTMLButtonElement>('modal-close'),
};

let settings: Settings;
let state: SessionState | null = null;

const port = chrome.runtime.connect({ name: 'panel' });
const send = (msg: PanelMessage) => port.postMessage(msg);

port.onMessage.addListener((event: PanelEvent) => {
  switch (event.type) {
    case 'state':
      render(event.state);
      break;
    case 'card':
      // O estado tambem chega logo atras; o card vem separado so para a animacao
      // entrar no momento certo, sem esperar o redesenho do painel inteiro.
      break;
    case 'summary/chunk':
      els.modalBody.textContent += event.text;
      els.modalBody.scrollTop = els.modalBody.scrollHeight;
      break;
    case 'summary/done':
      els.modalTitle.textContent = 'Resumo';
      els.summary.disabled = false;
      break;
    case 'summary/error':
      els.modalTitle.textContent = 'Resumo — erro';
      els.modalBody.textContent = event.message;
      els.summary.disabled = false;
      break;
    case 'transcript':
      openModal('Transcricao', event.markdown);
      break;
  }
});

function timeLabel(at: number): string {
  return new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function cardNode(card: Card): HTMLElement {
  const el = document.createElement('article');
  el.className = 'card';
  el.dataset.kind = card.kind;

  const top = document.createElement('div');
  top.className = 'card-top';
  const kind = document.createElement('span');
  kind.className = 'kind';
  kind.textContent = card.kind;
  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = timeLabel(card.at);
  const close = document.createElement('button');
  close.className = 'x';
  close.textContent = '×';
  close.title = 'Dispensar';
  close.addEventListener('click', () => send({ type: 'panel/dismiss-card', cardId: card.id }));
  top.append(kind, time, close);

  const headline = document.createElement('p');
  headline.className = 'headline';
  headline.textContent = card.headline;

  const body = document.createElement('p');
  body.className = 'body';
  body.textContent = card.body;

  el.append(top, headline, body);

  if (card.sources.length) {
    const ul = document.createElement('ul');
    ul.className = 'sources';
    for (const source of card.sources) {
      const li = document.createElement('li');
      li.textContent = source;
      ul.append(li);
    }
    el.append(ul);
  }
  return el;
}

function render(next: SessionState): void {
  state = next;

  const on = next.running;
  els.dot.dataset.state = next.lastError ? 'err' : on ? 'on' : 'off';
  els.toggle.textContent = on ? 'Pausar' : 'Iniciar';
  els.status.textContent = next.meetingId
    ? `${next.meetingId} · ${next.lineCount} falas`
    : 'sem reuniao detectada';

  els.error.hidden = !next.lastError;
  els.error.textContent = next.lastError ?? '';

  const hide = next.presenting && settings?.hideWhilePresenting;
  els.presenting.hidden = !hide;
  els.cards.classList.toggle('blur', !!hide);

  els.cards.replaceChildren();
  if (!next.cards.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = on
      ? 'Ouvindo. Ligue as legendas (CC) no Meet se ainda nao ligou.'
      : 'Pausado.';
    els.cards.append(p);
  } else {
    for (const card of next.cards) els.cards.append(cardNode(card));
  }

  if (next.talkRatio === null) {
    els.meter.hidden = true;
  } else {
    els.meter.hidden = false;
    const pct = Math.round(next.talkRatio * 100);
    els.meterFill.style.width = `${pct}%`;
    els.meterFill.dataset.warn = pct > 60 ? '1' : '0';
    els.meterVal.textContent = `${pct}%`;
  }

  els.coverage.replaceChildren();
  for (const dim of DIMENSOES) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.dataset.v = next.coverage[dim.id] ?? 'nao';
    chip.textContent = dim.nome;
    chip.title = dim.pergunta;
    els.coverage.append(chip);
  }
}

function openModal(title: string, body: string): void {
  els.modalTitle.textContent = title;
  els.modalBody.textContent = body;
  if (!els.modal.open) els.modal.showModal();
}

els.toggle.addEventListener('click', () => {
  send({ type: state?.running ? 'panel/stop' : 'panel/start' });
});
els.opts.addEventListener('click', () => chrome.runtime.openOptionsPage());
els.consentOk.addEventListener('click', () => {
  els.consent.hidden = true;
  void saveSettings({ consentReminder: false });
});
els.summary.addEventListener('click', () => {
  els.summary.disabled = true;
  openModal('Resumo — gerando...', '');
  send({ type: 'panel/summary' });
});
els.export.addEventListener('click', () => send({ type: 'panel/export-transcript' }));
els.modalClose.addEventListener('click', () => els.modal.close());
els.modalCopy.addEventListener('click', () => {
  void navigator.clipboard.writeText(els.modalBody.textContent ?? '');
  els.modalCopy.textContent = 'Copiado';
  setTimeout(() => (els.modalCopy.textContent = 'Copiar'), 1200);
});

void (async () => {
  settings = await loadSettings();
  els.consent.hidden = !settings.consentReminder;
  send({ type: 'panel/subscribe' });
})();
