#!/usr/bin/env node
/* Verifies the Market Watch access gate against a running server.
 *
 *   # terminal 1 — feature OFF (no secret configured)
 *   npm run dev
 *   # terminal 2
 *   node scripts/verify-market-watch.mjs
 *
 *   # terminal 1 — feature ON
 *   MARKET_WATCH_SECRET=choose-something-long npm run dev
 *   # terminal 2
 *   MARKET_WATCH_SECRET=choose-something-long node scripts/verify-market-watch.mjs
 *
 * Checks that an unauthenticated caller cannot reach the page OR the API
 * routes, that a wrong secret is indistinguishable from a disabled
 * feature, and that the secret never appears in a URL or a response.
 */

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const SECRET = process.env.MARKET_WATCH_SECRET || '';
const ON = SECRET.length >= 16;

const results = [];
const check = (name, pass, detail='') => { results.push({name,pass,detail}); };

async function hit(path, opts={}) {
  const r = await fetch(BASE+path, { redirect:'manual', ...opts });
  const body = await r.text().catch(()=> '');
  return { status:r.status, body, cookie:r.headers.get('set-cookie')||'' };
}

const PAGE='/market-watch', SESSION='/api/market-watch/session',
      COLLECT='/api/market-watch/collect', DATA='/api/market-watch/data';

(async () => {
  console.log(`Target ${BASE} — feature expected ${ON?'ON':'OFF'}\n`);

  // ── Unauthenticated, always ────────────────────────────────────────
  const data0 = await hit(DATA);
  check('GET data route without a session → 404', data0.status === 404, `got ${data0.status}`);

  const col0 = await hit(COLLECT, { method:'POST' });
  check('POST collect route without a session → 404', col0.status === 404, `got ${col0.status}`);

  const sesGet = await hit(SESSION);
  check('GET session route → 404 (secret must never travel in a URL)', sesGet.status === 404, `got ${sesGet.status}`);

  const wrong = await hit(SESSION, { method:'POST', headers:{'content-type':'application/json'},
                                     body: JSON.stringify({ secret:'definitely-not-the-secret' }) });
  check('POST session with a wrong secret → 404, not 401/403', wrong.status === 404, `got ${wrong.status}`);
  check('wrong secret sets no cookie', !wrong.cookie, wrong.cookie ? 'cookie was set' : '');

  const page0 = await hit(PAGE);
  if (ON) {
    check('page without a session → 200 prompt, no data', page0.status === 200 && !/Latest uploads/.test(page0.body),
          page0.status === 200 ? '' : `got ${page0.status}`);
  } else {
    check('page with feature OFF → 404', page0.status === 404, `got ${page0.status}`);
  }

  // ── Authenticated, only when the feature is on ─────────────────────
  if (ON) {
    const good = await hit(SESSION, { method:'POST', headers:{'content-type':'application/json'},
                                      body: JSON.stringify({ secret: SECRET }) });
    check('POST session with the correct secret → 200', good.status === 200, `got ${good.status}`);
    const cookie = (good.cookie.split(';')[0]) || '';
    check('session cookie is httpOnly', /httponly/i.test(good.cookie));
    check('session cookie does not contain the secret', !good.cookie.includes(SECRET));

    const dataOk = await hit(DATA, { headers:{ cookie } });
    check('GET data route with a session → 200', dataOk.status === 200, `got ${dataOk.status}`);

    const forged = await hit(DATA, { headers:{ cookie:'mw_session=' + 'f'.repeat(64) } });
    check('forged cookie → 404', forged.status === 404, `got ${forged.status}`);

    const pageOk = await hit(PAGE, { headers:{ cookie } });
    check('page with a session → 200 feature', pageOk.status === 200 && /Market Watch/.test(pageOk.body),
          pageOk.status === 200 ? '' : `got ${pageOk.status}`);
  } else {
    const anySecret = await hit(SESSION, { method:'POST', headers:{'content-type':'application/json'},
                                           body: JSON.stringify({ secret:'anything' }) });
    check('session route with feature OFF → 404', anySecret.status === 404, `got ${anySecret.status}`);
  }

  // ── Report ─────────────────────────────────────────────────────────
  let bad = 0;
  for (const r of results) {
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail && !r.pass ? `  (${r.detail})` : ''}`);
    if (!r.pass) bad++;
  }
  console.log(bad ? `\n${bad} CHECK(S) FAILED — do not deploy` : `\nAll ${results.length} checks passed`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('Verifier could not run:', e.message); process.exit(2); });
