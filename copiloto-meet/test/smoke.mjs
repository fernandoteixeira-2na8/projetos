import { build } from 'esbuild';
import http from 'node:http';
import { mkdir, rm } from 'node:fs/promises';

/**
 * Teste de fumaca do pipeline, sem chave de API e sem gastar um centavo.
 *
 * Sobe um servidor que finge ser a API, roda os tres estagios contra ele e
 * confere duas coisas: que as RESPOSTAS sao interpretadas direito, e que as
 * REQUISICOES saem com a forma certa (modelo, output_config, cache_control).
 *
 * O que ele NAO testa: os seletores do DOM do Meet e a qualidade do que o
 * modelo de verdade responde. Para isso, ver "Como testar" no README.
 */

const requests = [];
const respostas = {
  'claude-haiku-4-5': [
    '{"trigger":"pergunta","excerpt":"Voces integram com o Protheus?","confidence":0.82}',
    '{"grana":"nao","dor":"parcial","fit":"nao","urgencia":"nao","decisao":"nao","operar":"nao"}',
    // Gatilho que nao existe no enum: o SDK barra isso lancando.
    '{"trigger":"talvez","excerpt":"...","confidence":0.9}',
    // Gatilho valido, confianca fora da faixa: passa pelo schema, nao pelo clamp.
    '{"trigger":"objecao","excerpt":"ta caro","confidence":7}',
  ],
  'claude-opus-5': [
    '{"headline":"Sim, via API REST","body":"Ja fizemos Protheus por API REST.","sources":["Integramos com Protheus via API REST."]}',
  ],
};
const usadas = {};

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    requests.push(body);
    const lista = respostas[body.model] ?? ['{}'];
    usadas[body.model] = usadas[body.model] ?? 0;
    const text = lista[Math.min(usadas[body.model]++, lista.length - 1)];
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      id: 'msg_teste', type: 'message', role: 'assistant', model: body.model,
      content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 30 },
    }));
  });
});

const falhas = [];
const checa = (nome, condicao, detalhe = '') => {
  if (condicao) console.log(`  ok   ${nome}`);
  else {
    console.log(`  FALHOU  ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
    falhas.push(nome);
  }
};

const tmp = new URL('./.tmp/', import.meta.url);
await rm(tmp, { recursive: true, force: true });
await mkdir(tmp, { recursive: true });
const bundle = new URL('./.tmp/client.mjs', import.meta.url);

await build({
  entryPoints: ['test/pipeline-client.ts'],
  outfile: new URL(bundle).pathname,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'error',
});

await new Promise((resolve) => server.listen(0, resolve));
const baseURL = `http://127.0.0.1:${server.address().port}`;

try {
  const { run } = await import(bundle.href);
  const { gate, card, coverage, gateMalformado, gateForaDeFaixa } = await run(baseURL);

  console.log('\nRespostas interpretadas');
  checa('gate reconhece o gatilho', gate?.trigger === 'pergunta', JSON.stringify(gate));
  checa('gate preserva a confianca', gate?.confidence === 0.82);
  checa('card volta preenchido', !!card?.headline && !!card?.body);
  checa('card cita a base de conhecimento', card?.sources?.length === 1);
  checa('cobertura tem as seis dimensoes', Object.keys(coverage ?? {}).length === 6);

  console.log('\nDefesa contra resposta fora do schema');
  checa(
    'gatilho fora do enum pula a rodada em vez de virar erro na tela',
    gateMalformado === null,
    JSON.stringify(gateMalformado),
  );
  checa('confianca fora da faixa e limitada a 1', gateForaDeFaixa?.confidence === 1);
  checa('gatilho valido sobrevive ao clamp', gateForaDeFaixa?.trigger === 'objecao');

  console.log('\nRequisicoes enviadas');
  const [pedidoGate, pedidoCard, pedidoCobertura] = requests;
  checa('estagio 1 usa o modelo barato', pedidoGate?.model === 'claude-haiku-4-5');
  checa('estagio 2 usa o modelo bom', pedidoCard?.model === 'claude-opus-5');
  checa('estagio 2 pede effort baixo (latencia)', pedidoCard?.output_config?.effort === 'low');
  checa('estagio 2 manda schema de saida', !!pedidoCard?.output_config?.format);
  checa(
    'base de conhecimento vai em bloco cacheado',
    Array.isArray(pedidoCard?.system) && JSON.stringify(pedidoCard.system).includes('cache_control'),
  );
  checa('cobertura tambem roda no modelo barato', pedidoCobertura?.model === 'claude-haiku-4-5');
  checa('nenhuma chamada extra ao modelo caro', requests.filter((r) => r.model === 'claude-opus-5').length === 1);
} finally {
  server.close();
  await rm(tmp, { recursive: true, force: true });
}

console.log(falhas.length ? `\n${falhas.length} verificacao(oes) falharam.\n` : '\nTudo certo.\n');
process.exit(falhas.length ? 1 : 0);
