/* ==========================================================================
   Kapitel-Logik: Router + Diagramme der Probleme
   ========================================================================== */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const nf = new Intl.NumberFormat('de-DE');
  const fmt = (v) => nf.format(v);
  const pct = (v, d = 1) => (v * 100).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const rnd = (k) => Math.floor(Math.random() * k);

  const C = {
    grid: 'rgba(255,255,255,0.055)',
    axis: 'rgba(255,255,255,0.16)',
    tick: '#8f8fa2',
    cyan: '#5ad4f2',
    amber: '#ffc24a',
    green: '#63e6a4',
    violet: '#b39dfb'
  };
  const MONO = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  const TAU = Math.PI * 2;

  function fit(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, cv.clientWidth);
    const h = Math.max(1, cv.clientHeight);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }

  function niceTicks(max, count = 3) {
    if (!(max > 0)) return [0, 1];
    const step = niceStep(max / count);
    const top = Math.ceil(max / step) * step;
    const out = [];
    for (let v = 0; v <= top + step / 2; v += step) out.push(v);
    return out;
  }

  function sup(n) {
    const map = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
    return String(n).split('').map((d) => map[Number(d)] || d).join('');
  }

  function sieve(n) {
    const a = new Uint8Array(n + 1).fill(1);
    a[0] = 0;
    if (n >= 1) a[1] = 0;
    for (let i = 2; i * i <= n; i++) {
      if (a[i]) for (let j = i * i; j <= n; j += i) a[j] = 0;
    }
    return a;
  }

  function gridY(ctx, pad, pw, ticks, Y, fmtTick) {
    ctx.font = MONO;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ticks.forEach((v) => {
      const y = Math.round(Y(v)) + 0.5;
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + pw, y);
      ctx.stroke();
      ctx.fillStyle = C.tick;
      ctx.fillText(fmtTick ? fmtTick(v) : fmt(v), pad.l - 9, y);
    });
  }

  function axisLine(ctx, pad, pw, ph) {
    ctx.strokeStyle = C.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t + ph + 0.5);
    ctx.lineTo(pad.l + pw, pad.t + ph + 0.5);
    ctx.stroke();
  }

  function xLabels(ctx, pad, pw, ph, items) {
    ctx.font = MONO;
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.tick;
    items.forEach((it, i) => {
      ctx.textAlign = i === 0 ? 'left' : i === items.length - 1 ? 'right' : 'center';
      ctx.fillText(it.label, it.x, pad.t + ph + 7);
    });
  }

  /* ================================================== Collatz (nur Hook) */

  /* ================================================== Goldbach */

  const gb = { n: 100, N: 10000, MAX: 30000, isPrime: null, primes: [], comet: null, upTo: 0 };

  function gbInit() {
    if (gb.isPrime) return;
    gb.isPrime = sieve(gb.MAX);
    gb.primes = [];
    for (let i = 2; i <= gb.MAX; i++) if (gb.isPrime[i]) gb.primes.push(i);
    gb.comet = new Uint16Array(gb.MAX + 1);
    gb.upTo = 0;
  }

  function gbExtend(N) {
    if (N <= gb.upTo) return;
    const primes = gb.primes, isP = gb.isPrime;
    const start = gb.upTo === 0 ? 4 : gb.upTo + 2;
    for (let n = start; n <= N; n += 2) {
      let c = 0;
      for (let k = 0; k < primes.length; k++) {
        const p = primes[k];
        if (p * 2 > n) break;
        if (isP[n - p]) c++;
      }
      gb.comet[n] = c;
    }
    gb.upTo = N;
  }

  function gbPairs(n) {
    const out = [];
    for (let k = 0; k < gb.primes.length; k++) {
      const p = gb.primes[k];
      if (p * 2 > n) break;
      if (gb.isPrime[n - p]) out.push([p, n - p]);
    }
    return out;
  }

  function drawGbComet() {
    const cv = $('#gbComet');
    if (!cv) return;
    gbInit();
    gbExtend(gb.N);

    const { ctx, w, h } = fit(cv);
    const pad = { l: 52, r: 18, t: 20, b: 30 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    if (pw < 40) return;

    const N = gb.N;
    let peak = 1;
    for (let n = 4; n <= N; n += 2) if (gb.comet[n] > peak) peak = gb.comet[n];
    const ticks = niceTicks(peak, 3);
    const ymax = (ticks[ticks.length - 1] || 1) * 1.06;

    const X = (n) => pad.l + (pw * (n - 4)) / Math.max(1, N - 4);
    const Y = (v) => pad.t + ph * (1 - v / ymax);

    gridY(ctx, pad, pw, ticks, Y);

    ctx.fillStyle = 'rgba(255,194,74,0.8)';
    for (let n = 4; n <= N; n += 2) {
      const r = gb.comet[n];
      if (!r) continue;
      ctx.fillRect(X(n) - 1.1, Y(r) - 1.1, 2.2, 2.2);
    }

    axisLine(ctx, pad, pw, ph);
    xLabels(ctx, pad, pw, ph, [
      { x: X(4), label: '4' },
      { x: X(Math.round(N * 0.25 / 2) * 2), label: fmt(Math.round(N * 0.25 / 2) * 2) },
      { x: X(Math.round(N * 0.5 / 2) * 2), label: fmt(Math.round(N * 0.5 / 2) * 2) },
      { x: X(Math.round(N * 0.75 / 2) * 2), label: fmt(Math.round(N * 0.75 / 2) * 2) },
      { x: X(N), label: fmt(N) }
    ]);

    /* gewähltes n */
    if (gb.n <= N) {
      const r = gb.comet[gb.n] || 0;
      if (r > 0) {
        const x = X(gb.n), y = Y(r);
        ctx.strokeStyle = 'rgba(90,212,242,0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, pad.t);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, TAU);
        ctx.fillStyle = C.cyan;
        ctx.fill();
      }
      ctx.font = MONO;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(90,212,242,0.92)';
      ctx.fillText('n = ' + fmt(gb.n) + ' → ' + fmt(r) + ' Zerlegungen', pad.l + 8, pad.t + 6);
    }

    const note = $('#gbCometNote');
    if (note) note.textContent = 'bis ' + fmt(N);
    cv.setAttribute('aria-label',
      'Goldbach-Komet bis ' + fmt(N) + '. Ausgewählt: n = ' + fmt(gb.n) + ' mit ' +
      fmt(gb.comet[gb.n] || 0) + ' Zerlegungen.');
  }

  function drawGbHist() {
    const cv = $('#gbHist');
    if (!cv) return;
    gbInit();
    gbExtend(gb.N);

    const { ctx, w, h } = fit(cv);
    const pad = { l: 46, r: 16, t: 20, b: 30 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    if (pw < 40) return;

    let peak = 1, sum = 0, count = 0;
    for (let n = 4; n <= gb.N; n += 2) {
      const r = gb.comet[n];
      if (r > peak) peak = r;
      sum += r; count++;
    }
    const mean = sum / count;
    const binW = Math.max(5, Math.ceil(peak / 34));
    const nb = Math.ceil(peak / binW) + 1;
    const bins = new Uint32Array(nb);
    for (let n = 4; n <= gb.N; n += 2) {
      const r = gb.comet[n];
      bins[Math.min(nb - 1, Math.floor(r / binW))]++;
    }
    let top = 1;
    for (let i = 0; i < nb; i++) if (bins[i] > top) top = bins[i];

    const ticks = niceTicks(top * 1.06, 3);
    const ymax = ticks[ticks.length - 1] || 1;
    const X = (i) => pad.l + (pw * i) / nb;
    const bw = Math.max(1, pw / nb - 1);
    const Y = (v) => pad.t + ph * (1 - v / ymax);

    gridY(ctx, pad, pw, ticks, Y);
    axisLine(ctx, pad, pw, ph);

    for (let i = 0; i < nb; i++) {
      if (!bins[i]) continue;
      const y = Y(bins[i]);
      const g = ctx.createLinearGradient(0, y, 0, pad.t + ph);
      g.addColorStop(0, 'rgba(255,194,74,0.85)');
      g.addColorStop(1, 'rgba(255,194,74,0.25)');
      ctx.fillStyle = g;
      ctx.fillRect(X(i) + 0.5, y, bw, pad.t + ph - y);
    }

    /* Mittelwert */
    const mx = X(mean / binW);
    ctx.strokeStyle = 'rgba(90,212,242,0.8)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(mx, pad.t);
    ctx.lineTo(mx, pad.t + ph);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = MONO;
    ctx.fillStyle = C.cyan;
    ctx.textAlign = mx > pad.l + pw * 0.7 ? 'right' : 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Ø ' + fmt(Math.round(mean)), mx + (ctx.textAlign === 'right' ? -6 : 6), pad.t + 4);

    xLabels(ctx, pad, pw, ph, [
      { x: pad.l, label: '0' },
      { x: X(nb / 2), label: fmt(Math.round((nb / 2) * binW)) },
      { x: pad.l + pw, label: fmt(peak) }
    ]);

    const note = $('#gbHistNote');
    if (note) note.textContent = 'bis ' + fmt(gb.N) + ' · Ø ' + fmt(Math.round(mean));
    cv.setAttribute('aria-label',
      'Verteilung der Zerlegungszahlen für gerade Zahlen bis ' + fmt(gb.N) +
      ', Mittelwert ' + fmt(Math.round(mean)) + '.');
  }

  function renderGb() {
    gbInit();
    const pairs = gbPairs(gb.n);
    const res = $('#gbRes');
    if (res) {
      res.textContent = fmt(gb.n) + ' = ' + (pairs.length
        ? 'Summe von ' + fmt(pairs.length) + (pairs.length === 1 ? ' Primzahlpaar' : ' Primzahlpaaren')
        : 'keine Zerlegung gefunden');
    }
    const list = $('#gbPairs');
    if (list) {
      const shown = pairs.slice(0, 10);
      list.innerHTML = shown.map(([a, b]) => '<span>' + fmt(a) + ' + ' + fmt(b) + '</span>').join('') +
        (pairs.length > shown.length ? '<span>… +' + fmt(pairs.length - shown.length) + '</span>' : '');
    }
  }

  function bindGb() {
    const input = $('#gbN');
    if (!input) return;
    const apply = () => {
      let v = Math.round(Number(input.value));
      if (!Number.isFinite(v)) v = 100;
      if (v % 2 === 1) v += 1;
      v = clamp(v, 4, gb.MAX);
      input.value = String(v);
      gb.n = v;
      if (gb.n > gb.N) {
        gb.N = clamp(Math.ceil(gb.n / 2000) * 2000, 2000, gb.MAX);
        const r = $('#gbRange');
        if (r) r.value = String(gb.N);
      }
      renderGb();
      drawGbComet();
      drawGbHist();
      const out = $('#gbRangeOut');
      if (out) out.textContent = fmt(gb.N);
    };
    input.addEventListener('change', apply);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });

    const rand = $('#gbRand');
    if (rand) rand.addEventListener('click', () => {
      gb.n = (rnd(15000) + 2) * 2;
      input.value = String(gb.n);
      apply();
    });

    const range = $('#gbRange');
    if (range) range.addEventListener('input', () => {
      gb.N = Number(range.value);
      const out = $('#gbRangeOut');
      if (out) out.textContent = fmt(gb.N);
      drawGbComet();
      drawGbHist();
    });
  }

  /* ================================================== Primzahlzwillinge */

  const tw = { N: 200000, MAX: 1000000, isPrime: null, starts: null };

  function twInit() {
    if (tw.isPrime) return;
    tw.isPrime = sieve(tw.MAX);
    const starts = [];
    for (let p = 3; p + 2 <= tw.MAX; p++) if (tw.isPrime[p] && tw.isPrime[p + 2]) starts.push(p);
    tw.starts = starts;
  }

  function twCountUpTo(N) {
    const s = tw.starts;
    let lo = 0, hi = s.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (s[mid] <= N) lo = mid + 1; else hi = mid;
    }
    return lo;
  }

  function renderTw() {
    twInit();
    const N = tw.N;
    const count = twCountUpTo(N);
    const res = $('#twRes');
    if (res) {
      const last = tw.starts[count - 1];
      res.textContent = 'bis ' + fmt(N) + ': ' + fmt(count) + ' Zwillinge' +
        (last ? ' · letztes Paar ' + fmt(last) + ' / ' + fmt(last + 2) : '');
    }
    const list = $('#twList');
    if (list) {
      const from = Math.max(0, count - 12);
      const items = [];
      for (let i = from; i < count; i++) {
        items.push('<li class="is-twin">' + fmt(tw.starts[i]) + ' · ' + fmt(tw.starts[i] + 2) + '</li>');
      }
      list.innerHTML = items.join('');
    }
    const out = $('#twRangeOut');
    if (out) out.textContent = fmt(N);
  }

  function drawUlam() {
    const cv = $('#ulam');
    if (!cv) return;
    const size = Number($('#ulamRange').value) || 101;
    const total = size * size;
    const isP = sieve(total);

    const { ctx, w, h } = fit(cv);
    const box = Math.min(w, h) - 8;
    const cell = box / size;
    const ox = (w - box) / 2;
    const oy = (h - box) / 2;

    let primes = 0, twins = 0, pairs = 0;
    let n = 1, x = 0, y = 0, dir = 0, len = 1;
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const mid = (size - 1) / 2;
    const s = Math.max(cell * 0.84, 1);

    while (n <= total) {
      for (let pass = 0; pass < 2 && n <= total; pass++) {
        for (let i = 0; i < len && n <= total; i++) {
          const px = ox + (x + mid) * cell;
          const py = oy + (y + mid) * cell;
          if (n === 1) {
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fillRect(px, py, s, s);
          } else if (isP[n]) {
            primes++;
            if (n + 2 <= total && isP[n + 2]) pairs++;
            const twin = (n > 2 && isP[n - 2]) || (n + 2 <= total && isP[n + 2]);
            if (twin) { twins++; ctx.fillStyle = C.amber; }
            else ctx.fillStyle = 'rgba(90,212,242,0.95)';
            ctx.fillRect(px, py, s, s);
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.02)';
            ctx.fillRect(px, py, s, s);
          }
          x += dirs[dir][0];
          y += dirs[dir][1];
          n++;
        }
        dir = (dir + 1) % 4;
      }
      len++;
    }

    const note = $('#ulamNote');
    if (note) note.textContent = size + ' × ' + size + ' Zahlen · ' + fmt(primes) + ' Primzahlen · ' + fmt(pairs) + ' Zwillinge';
    const out = $('#ulamRangeOut');
    if (out) out.textContent = size + '²';
    cv.setAttribute('aria-label',
      'Ulam-Spirale über ' + fmt(total) + ' Zahlen mit ' + fmt(primes) +
      ' Primzahlen und ' + fmt(pairs) + ' Primzahlzwillingen.');
  }

  function drawTwCount() {
    const cv = $('#twCount');
    if (!cv) return;
    twInit();
    const isP = tw.isPrime;
    const MAX = tw.MAX;
    const C2 = 0.6601618158468696;

    const { ctx, w, h } = fit(cv);
    const pad = { l: 50, r: 18, t: 20, b: 30 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    if (pw < 40) return;

    const lo = Math.log10(10), hi = Math.log10(MAX);
    const X = (x) => pad.l + (pw * (Math.log10(x) - lo)) / (hi - lo);
    const total = tw.starts.length;
    const ticks = niceTicks(total * 1.08, 3);
    const ymax = ticks[ticks.length - 1] || 1;
    const Y = (v) => pad.t + ph * (1 - v / ymax);

    gridY(ctx, pad, pw, ticks, Y);
    axisLine(ctx, pad, pw, ph);

    /* gezählt */
    const path = new Path2D();
    const steps = 220;
    for (let k = 0; k <= steps; k++) {
      const x = Math.pow(10, lo + ((hi - lo) * k) / steps);
      const v = twCountUpTo(Math.round(x));
      if (k === 0) path.moveTo(X(x), Y(v));
      else path.lineTo(X(x), Y(v));
    }
    ctx.save();
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke(path);
    ctx.restore();

    /* Modell 2C2 x/(ln x)^2 */
    const model = new Path2D();
    for (let k = 0; k <= steps; k++) {
      const x = Math.pow(10, lo + ((hi - lo) * k) / steps);
      const v = (2 * C2 * x) / Math.pow(Math.log(x), 2);
      if (k === 0) model.moveTo(X(x), Y(v));
      else model.lineTo(X(x), Y(v));
    }
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = C.amber;
    ctx.lineWidth = 1.6;
    ctx.stroke(model);
    ctx.restore();

    const items = [];
    for (let e = 1; e <= 6; e++) {
      const v = Math.pow(10, e);
      if (v <= MAX) items.push({ x: X(v), label: '10' + sup(e) });
    }
    xLabels(ctx, pad, pw, ph, items);

    cv.setAttribute('aria-label',
      'Zwillinge unterhalb von x bis ' + fmt(MAX) + ': gezählt ' + fmt(total) + ' Paare, Modell ' +
      fmt(Math.round((2 * C2 * MAX) / Math.pow(Math.log(MAX), 2))) + '.');
  }

  function bindTw() {
    const range = $('#twRange');
    if (range) range.addEventListener('input', () => {
      tw.N = Number(range.value);
      renderTw();
    });
    const ulam = $('#ulamRange');
    if (ulam) ulam.addEventListener('input', drawUlam);
  }

  /* ================================================== Primzahlsatz */

  const pnt = { xmax: 100000, MAX: 1000000, isPrime: null, cum: null };

  function pntInit() {
    if (pnt.isPrime) return;
    pnt.isPrime = sieve(pnt.MAX);
    pnt.cum = new Uint32Array(pnt.MAX + 1);
    let c = 0;
    for (let i = 0; i <= pnt.MAX; i++) {
      if (i >= 2 && pnt.isPrime[i]) c++;
      pnt.cum[i] = c;
    }
  }

  function Li(x) {
    if (x <= 2) return 0;
    const g = 0.5772156649015329;
    const t = Math.log(x);
    let s = g + Math.log(t), term = 1;
    for (let k = 1; k < 200; k++) {
      term *= t / k;
      s += term / k;
      if (Math.abs(term / k) < 1e-10) break;
    }
    return s;
  }

  function renderPnt() {
    pntInit();
    const x = pnt.xmax;
    const pi = pnt.cum[x];
    const asym = x / Math.log(x);
    const li = Li(x);
    const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
    set('piCount', fmt(pi));
    set('piAsym', fmt(Math.round(asym)));
    set('piLi', fmt(Math.round(li)));
    set('piRatio', (pi / asym).toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 }));
    const out = $('#piRangeOut');
    if (out) out.textContent = '10' + sup(Math.round(Math.log10(x)));
    const out2 = $('#piRangeBigOut');
    if (out2) out2.textContent = '10' + sup(Math.round(Math.log10(x)));
    const note = $('#piNote');
    if (note) note.textContent = 'bis 10' + sup(Math.round(Math.log10(x)));
  }

  function drawPiChart() {
    const cv = $('#piChart');
    if (!cv) return;
    pntInit();
    const X0 = pnt.xmax;

    const { ctx, w, h } = fit(cv);
    const pad = { l: 60, r: 18, t: 20, b: 30 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    if (pw < 40) return;

    const piX = pnt.cum[X0];
    const asym = X0 / Math.log(X0);
    const ticks = niceTicks(Math.max(piX, asym), 3);
    const ymax = (ticks[ticks.length - 1] || 1) * 1.06;

    const lo = Math.log10(2), hi = Math.log10(X0);
    const X = (x) => pad.l + (pw * (Math.log10(x) - lo)) / (hi - lo);
    const Y = (v) => pad.t + ph * (1 - v / ymax);

    gridY(ctx, pad, pw, ticks, Y);

    for (let e = 1; e <= 9; e++) {
      const v = Math.pow(10, e);
      if (v < 2 || v > X0) continue;
      const x = Math.round(X(v)) + 0.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, pad.t + ph);
      ctx.stroke();
    }

    const step = new Path2D();
    step.moveTo(pad.l, Y(0));
    for (let i = 2; i <= X0; i++) {
      if (!pnt.isPrime[i]) continue;
      const x = X(i), prev = pnt.cum[i] - 1;
      step.lineTo(x, Y(prev));
      step.lineTo(x, Y(prev + 1));
    }

    const area = new Path2D(step);
    area.lineTo(pad.l + pw, pad.t + ph);
    area.lineTo(pad.l, pad.t + ph);
    area.closePath();
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
    grad.addColorStop(0, 'rgba(90,212,242,0.22)');
    grad.addColorStop(1, 'rgba(90,212,242,0.02)');
    ctx.fillStyle = grad;
    ctx.fill(area);

    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.stroke(step);

    const asymPath = new Path2D();
    const steps = 200;
    for (let k = 0; k <= steps; k++) {
      const x = Math.pow(10, lo + ((hi - lo) * k) / steps);
      const v = x / Math.log(x);
      if (k === 0) asymPath.moveTo(X(x), Y(v));
      else asymPath.lineTo(X(x), Y(v));
    }
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = C.amber;
    ctx.lineWidth = 1.6;
    ctx.stroke(asymPath);
    ctx.restore();

    axisLine(ctx, pad, pw, ph);
    const items = [];
    for (let e = 1; e <= 9; e++) {
      const v = Math.pow(10, e);
      if (v <= X0) items.push({ x: X(v), label: '10' + sup(e) });
    }
    xLabels(ctx, pad, pw, ph, items);

    cv.setAttribute('aria-label',
      'Primzahlfunktion bis ' + fmt(X0) + ': ' + fmt(piX) + ' Primzahlen, x durch ln x ergibt ' +
      fmt(Math.round(asym)) + '.');
  }

  function drawRatio() {
    const cv = $('#ratioChart');
    if (!cv) return;
    pntInit();
    const X0 = pnt.xmax;

    const { ctx, w, h } = fit(cv);
    const pad = { l: 50, r: 18, t: 20, b: 30 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    if (pw < 40) return;

    const lo = Math.log10(2), hi = Math.log10(X0);
    const X = (x) => pad.l + (pw * (Math.log10(x) - lo)) / (hi - lo);
    const YMIN = 0.3, YMAX = 1.32;
    const Y = (v) => pad.t + ph * (1 - (v - YMIN) / (YMAX - YMIN));

    gridY(ctx, pad, pw, [0.4, 0.6, 0.8, 1.0, 1.2], Y, (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 1 }));

    /* Linie bei 1 */
    ctx.strokeStyle = 'rgba(255,194,74,0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.l, Math.round(Y(1)) + 0.5);
    ctx.lineTo(pad.l + pw, Math.round(Y(1)) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    const path = new Path2D();
    const steps = 300;
    for (let k = 0; k <= steps; k++) {
      const x = Math.pow(10, lo + ((hi - lo) * k) / steps);
      const v = (pnt.cum[Math.round(x)] * Math.log(x)) / x;
      if (k === 0) path.moveTo(X(x), Y(v));
      else path.lineTo(X(x), Y(v));
    }
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.stroke(path);

    axisLine(ctx, pad, pw, ph);
    const items = [];
    for (let e = 1; e <= 9; e++) {
      const v = Math.pow(10, e);
      if (v <= X0) items.push({ x: X(v), label: '10' + sup(e) });
    }
    xLabels(ctx, pad, pw, ph, items);

    cv.setAttribute('aria-label',
      'Verhältnis von Primzahlfunktion zu x durch ln x, das gegen 1 strebt.');
  }

  function bindPnt() {
    const a = $('#piRange'), b = $('#piRangeBig');
    const apply = (v) => {
      pnt.xmax = Math.pow(10, Number(v));
      if (a) a.value = v;
      if (b) b.value = v;
      renderPnt();
      drawPiChart();
      drawRatio();
    };
    if (a) a.addEventListener('input', () => apply(a.value));
    if (b) b.addEventListener('input', () => apply(b.value));
  }

  /* ================================================== Ziegenproblem */

  const monty = {
    prize: -1, chosen: -1, opened: -1, final: -1, phase: 'pick', lastWin: false,
    stats: { stay: { w: 0, n: 0 }, swit: { w: 0, n: 0 } },
    series: null
  };

  function montyRender() {
    $$('.door').forEach((btn, i) => {
      const face = $('.door-face', btn);
      const open = monty.opened === i;
      const revealed = monty.phase === 'done';
      btn.classList.toggle('is-picked', revealed ? monty.final === i : monty.chosen === i);
      btn.classList.toggle('is-open', open || (revealed && monty.prize !== i));
      btn.disabled = monty.phase !== 'pick' || open;
      if (face) {
        if (revealed) face.textContent = monty.prize === i ? '🚗' : '🐐';
        else face.textContent = open ? '🐐' : '';
      }
      btn.setAttribute('aria-label', 'Tür ' + (i + 1) +
        (revealed ? (monty.prize === i ? ', Auto' : ', Ziege') : open ? ', offen, Ziege' : ''));
    });

    const stayBtn = $('#montyStay'), switchBtn = $('#montySwitch');
    if (stayBtn) stayBtn.disabled = monty.phase !== 'decide';
    if (switchBtn) switchBtn.disabled = monty.phase !== 'decide';

    const msg = $('#montyMsg');
    if (msg) {
      if (monty.phase === 'pick') msg.textContent = 'Wähle eine Tür.';
      else if (monty.phase === 'decide') msg.textContent = 'Der Moderator öffnet eine Ziege. Wechseln oder bleiben?';
      else msg.textContent = monty.lastWin ? 'Gewonnen — diese Tür hatte das Auto.' : 'Verloren — diese Tür hatte eine Ziege.';
    }
    montyBars();
  }

  function montyBars() {
    const s = monty.stats;
    const a = s.stay.n ? s.stay.w / s.stay.n : 0;
    const b = s.swit.n ? s.swit.w / s.swit.n : 0;
    const bs = $('#barStay'), bw = $('#barSwitch');
    if (bs) bs.style.width = (a * 100).toFixed(1) + '%';
    if (bw) bw.style.width = (b * 100).toFixed(1) + '%';
    const vs = $('#barStayVal'), vw = $('#barSwitchVal');
    if (vs) vs.textContent = s.stay.n ? pct(a) + ' % (' + fmt(s.stay.n) + ')' : '—';
    if (vw) vw.textContent = s.swit.n ? pct(b) + ' % (' + fmt(s.swit.n) + ')' : '—';
  }

  function montyNew() {
    monty.prize = rnd(3);
    monty.chosen = -1;
    monty.opened = -1;
    monty.final = -1;
    monty.phase = 'pick';
    monty.lastWin = false;
    montyRender();
  }

  function montyPick(i) {
    if (monty.phase !== 'pick') return;
    monty.chosen = i;
    const options = [0, 1, 2].filter((d) => d !== i && d !== monty.prize);
    monty.opened = options[rnd(options.length)];
    monty.phase = 'decide';
    montyRender();
  }

  function montyDecide(switching) {
    if (monty.phase !== 'decide') return;
    const final = switching ? [0, 1, 2].find((d) => d !== monty.chosen && d !== monty.opened) : monty.chosen;
    const win = final === monty.prize;
    const key = switching ? 'swit' : 'stay';
    monty.stats[key].n++;
    if (win) monty.stats[key].w++;
    monty.final = final;
    monty.lastWin = win;
    monty.phase = 'done';
    montyRender();
  }

  function montySimulate(k) {
    for (let i = 0; i < k; i++) {
      const prize = rnd(3), pick = rnd(3);
      monty.stats.stay.n++;
      monty.stats.swit.n++;
      if (pick === prize) monty.stats.stay.w++;
      else monty.stats.swit.w++;
    }
    montyBars();
  }

  function montySeries() {
    if (monty.series) return monty.series;
    const N = 5000;
    const sw = [], st = [];
    let swW = 0, stW = 0;
    for (let i = 1; i <= N; i++) {
      const prize = rnd(3), pick = rnd(3);
      if (pick === prize) stW++; else swW++;
      sw.push(swW / i);
      st.push(stW / i);
    }
    monty.series = { N, sw, st };
    return monty.series;
  }

  function drawMontyChart() {
    const cv = $('#montyChart');
    if (!cv) return;
    const { N, sw, st } = montySeries();

    const { ctx, w, h } = fit(cv);
    const pad = { l: 48, r: 18, t: 20, b: 30 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    if (pw < 40) return;

    const X = (i) => pad.l + (pw * (i - 1)) / (N - 1);
    const Y = (v) => pad.t + ph * (1 - v);

    gridY(ctx, pad, pw, [0, 0.25, 0.5, 0.75, 1], Y, (v) => Math.round(v * 100) + ' %');

    [1 / 3, 2 / 3].forEach((v) => {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.l, Math.round(Y(v)) + 0.5);
      ctx.lineTo(pad.l + pw, Math.round(Y(v)) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    const line = (arr, color) => {
      ctx.beginPath();
      ctx.moveTo(X(1), Y(arr[0]));
      for (let i = 1; i < arr.length; i++) ctx.lineTo(X(i + 1), Y(arr[i]));
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.lineJoin = 'round';
      ctx.stroke();
    };

    line(st, 'rgba(255,194,74,0.85)');
    line(sw, C.cyan);

    axisLine(ctx, pad, pw, ph);
    xLabels(ctx, pad, pw, ph, [
      { x: pad.l, label: '1' },
      { x: X(Math.round(N / 4)), label: fmt(Math.round(N / 4)) },
      { x: X(Math.round(N / 2)), label: fmt(Math.round(N / 2)) },
      { x: X(Math.round(3 * N / 4)), label: fmt(Math.round(3 * N / 4)) },
      { x: pad.l + pw, label: fmt(N) }
    ]);

    const note = $('#montyChartNote');
    if (note) note.textContent = fmt(N) + ' simulierte Spiele';
    cv.setAttribute('aria-label',
      'Kumulierte Gewinnquote über ' + fmt(N) + ' simulierte Spiele: Wechseln endet bei 66 Prozent, Bleiben bei 33 Prozent.');
  }

  function bindMonty() {
    $$('.door').forEach((btn) => btn.addEventListener('click', () => montyPick(Number(btn.dataset.door))));
    const stay = $('#montyStay'), swit = $('#montySwitch'), reset = $('#montyReset'), sim = $('#montySim');
    if (stay) stay.addEventListener('click', () => montyDecide(false));
    if (swit) swit.addEventListener('click', () => montyDecide(true));
    if (reset) reset.addEventListener('click', montyNew);
    if (sim) sim.addEventListener('click', () => montySimulate(10000));
    montyNew();
  }

  /* ================================================== Geburtstag */

  const bd = { k: 23, MAXK: 80, simTotal: 0, simHits: 0 };

  function bdP(k) {
    let q = 1;
    for (let i = 0; i < k; i++) q *= (365 - i) / 365;
    return 1 - q;
  }

  function renderBd() {
    const res = $('#bdRes');
    if (res) {
      const sim = bd.simTotal
        ? ' · ' + fmt(bd.simTotal) + ' Räume: ' + pct(bd.simHits / bd.simTotal) + ' % Treffer'
        : '';
      res.textContent = 'k = ' + bd.k + ' → ' + pct(bdP(bd.k)) + ' %' + sim;
    }
    const out = $('#bdRangeOut');
    if (out) out.textContent = String(bd.k);
    const out2 = $('#bdChordOut');
    if (out2) out2.textContent = String(bd.k);
    const note = $('#bdNote');
    if (note) note.textContent = 'k = ' + bd.k;
    const chordNote = $('#bdChordNote');
    if (chordNote) chordNote.textContent = fmt((bd.k * (bd.k - 1)) / 2) + ' Paare';
  }

  function drawBdChart() {
    const cv = $('#bdChart');
    if (!cv) return;
    const { ctx, w, h } = fit(cv);
    const pad = { l: 52, r: 18, t: 20, b: 30 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    if (pw < 40) return;

    const X = (k) => pad.l + (pw * (k - 2)) / (bd.MAXK - 2);
    const Y = (p) => pad.t + ph * (1 - p);

    gridY(ctx, pad, pw, [0, 0.25, 0.5, 0.75, 1], Y, (v) => Math.round(v * 100) + ' %');

    ctx.strokeStyle = 'rgba(255,194,74,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.l, Math.round(Y(0.5)) + 0.5);
    ctx.lineTo(pad.l + pw, Math.round(Y(0.5)) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    const curve = new Path2D();
    curve.moveTo(X(2), Y(bdP(2)));
    for (let k = 3; k <= bd.MAXK; k++) curve.lineTo(X(k), Y(bdP(k)));

    const area = new Path2D(curve);
    area.lineTo(X(bd.MAXK), pad.t + ph);
    area.lineTo(X(2), pad.t + ph);
    area.closePath();
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
    grad.addColorStop(0, 'rgba(99,230,164,0.18)');
    grad.addColorStop(1, 'rgba(99,230,164,0.015)');
    ctx.fillStyle = grad;
    ctx.fill(area);

    ctx.strokeStyle = C.green;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.stroke(curve);

    const p = bdP(bd.k);
    const x = X(bd.k), y = Y(p);
    ctx.strokeStyle = 'rgba(99,230,164,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, pad.t + ph);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 4.2, 0, TAU);
    ctx.fillStyle = C.green;
    ctx.fill();

    ctx.font = MONO;
    const alignRight = x > pad.l + pw * 0.35;
    ctx.textAlign = alignRight ? 'right' : 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = C.green;
    ctx.fillText('k = ' + bd.k + ' · ' + pct(p) + ' %',
      x + (alignRight ? -10 : 10), Math.max(y - 10, pad.t + 12));

    axisLine(ctx, pad, pw, ph);
    xLabels(ctx, pad, pw, ph, [
      { x: X(2), label: '2' },
      { x: X(20), label: '20' },
      { x: X(40), label: '40' },
      { x: X(60), label: '60' },
      { x: X(80), label: '80' }
    ]);

    cv.setAttribute('aria-label',
      'Wahrscheinlichkeit eines gemeinsamen Geburtstags bei ' + bd.k + ' Personen: ' + pct(p) + ' Prozent.');
  }

  function drawBdChords() {
    const cv = $('#bdChords');
    if (!cv) return;
    const { ctx, w, h } = fit(cv);
    const R = Math.min(w, h) / 2 - 22;
    const cx = w / 2, cy = h / 2;
    const k = clamp(bd.k, 2, 40);

    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();

    const pts = [];
    for (let i = 0; i < k; i++) {
      const a = -Math.PI / 2 + (TAU * i) / k;
      pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }

    ctx.strokeStyle = 'rgba(99,230,164,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[j][0], pts[j][1]);
      }
    }
    ctx.stroke();

    ctx.fillStyle = C.green;
    for (let i = 0; i < k; i++) {
      ctx.beginPath();
      ctx.arc(pts[i][0], pts[i][1], 2.6, 0, TAU);
      ctx.fill();
    }

    cv.setAttribute('aria-label',
      'Kreis mit ' + k + ' Personen und ' + fmt((k * (k - 1)) / 2) + ' Verbindungslinien für die Paare.');
  }

  function bindBd() {
    const a = $('#bdRange'), b = $('#bdChordRange');
    const apply = (v) => {
      bd.k = clamp(Number(v), 2, bd.MAXK);
      bd.simTotal = 0;
      bd.simHits = 0;
      if (a) a.value = String(Math.min(bd.k, 80));
      if (b) b.value = String(Math.min(bd.k, 40));
      renderBd();
      drawBdChart();
      drawBdChords();
    };
    if (a) a.addEventListener('input', () => apply(a.value));
    if (b) b.addEventListener('input', () => apply(b.value));

    const sim = $('#bdSim');
    if (sim) sim.addEventListener('click', () => {
      const rooms = 2000;
      let hits = 0;
      for (let r = 0; r < rooms; r++) {
        const seen = new Set();
        for (let i = 0; i < bd.k; i++) {
          const d = rnd(365);
          if (seen.has(d)) { hits++; break; }
          seen.add(d);
        }
      }
      bd.simTotal = rooms;
      bd.simHits = hits;
      renderBd();
    });

    const reset = $('#bdReset');
    if (reset) reset.addEventListener('click', () => { bd.simTotal = 0; bd.simHits = 0; renderBd(); });
  }

  /* ================================================== Buffon */

  const bf = { needles: [], L: 0.8, max: 6000, conv: null };

  function drawBuffon() {
    const cv = $('#buffonCanvas');
    if (!cv) return;
    const { ctx, w, h } = fit(cv);
    const d = w / 12;
    const L = d * bf.L;

    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 12; i++) {
      const x = Math.round(i * d) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    let hits = 0;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < bf.needles.length; i++) {
      const n = bf.needles[i];
      const x = n.x * d, y = n.y * h;
      const x2 = x + L * Math.cos(n.a);
      const y2 = y + L * Math.sin(n.a);
      const cross = Math.floor(n.x) !== Math.floor(n.x + bf.L * Math.cos(n.a));
      if (cross) hits++;
      ctx.strokeStyle = cross ? 'rgba(255,194,74,0.9)' : 'rgba(150,150,190,0.32)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    const N = bf.needles.length;
    const res = $('#buffonRes');
    if (res) {
      if (!N) res.textContent = 'Noch keine Nadeln gefallen.';
      else {
        const est = hits ? (2 * bf.L * N) / hits : NaN;
        res.textContent = fmt(N) + ' Nadeln · ' + fmt(hits) + ' kreuzen (' + pct(hits / N) + ' %) · π ≈ ' +
          (Number.isFinite(est) ? est.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '—');
      }
    }
    const note = $('#buffonNote');
    if (note) note.textContent = fmt(N) + ' Nadeln · L/d = ' + bf.L.toLocaleString('de-DE', { minimumFractionDigits: 2 });
    const out = $('#buffonLOut');
    if (out) out.textContent = bf.L.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    cv.setAttribute('aria-label',
      'Buffon-Experiment mit ' + fmt(N) + ' Nadeln, ' + fmt(hits) + ' kreuzen eine Linie.');
  }

  function buffonConv() {
    if (bf.conv) return bf.conv;
    const N = 5000;
    const out = new Float32Array(N);
    let hits = 0;
    for (let i = 1; i <= N; i++) {
      const x = Math.random() * 12;
      const a = Math.random() * Math.PI;
      if (Math.floor(x) !== Math.floor(x + 0.8 * Math.cos(a))) hits++;
      out[i - 1] = (1.6 * i) / Math.max(1, hits);
    }
    bf.conv = out;
    return out;
  }

  function drawBuffonConv() {
    const cv = $('#buffonConv');
    if (!cv) return;
    const data = buffonConv();
    const { ctx, w, h } = fit(cv);
    const pad = { l: 48, r: 18, t: 20, b: 30 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    if (pw < 40) return;

    const X = (i) => pad.l + (pw * (i - 1)) / (data.length - 1);
    const Y = (v) => pad.t + ph * (1 - clamp((v - 2.4) / 1.6, 0, 1));

    gridY(ctx, pad, pw, [2.5, 2.8, 3.0, 3.2, 3.5, 3.8], Y, (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 1 }));

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.l, Math.round(Y(Math.PI)) + 0.5);
    ctx.lineTo(pad.l + pw, Math.round(Y(Math.PI)) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(X(1), Y(data[0]));
    for (let i = 1; i < data.length; i++) ctx.lineTo(X(i + 1), Y(data[i]));
    ctx.strokeStyle = C.green;
    ctx.lineWidth = 1.3;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.font = MONO;
    ctx.fillStyle = C.tick;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('π = 3,1416', pad.l + 8, Y(Math.PI) - 5);

    axisLine(ctx, pad, pw, ph);
    xLabels(ctx, pad, pw, ph, [
      { x: pad.l, label: '1' },
      { x: X(1250), label: '1 250' },
      { x: X(2500), label: '2 500' },
      { x: X(3750), label: '3 750' },
      { x: pad.l + pw, label: '5 000' }
    ]);

    cv.setAttribute('aria-label', 'Schätzung von Pi über fünftausend zufällig geworfene Nadeln.');
  }

  function buffonThrow(count) {
    for (let i = 0; i < count && bf.needles.length < bf.max; i++) {
      bf.needles.push({ x: Math.random() * 12, y: Math.random(), a: Math.random() * Math.PI });
    }
    drawBuffon();
  }

  function bindBuffon() {
    const t = $('#buffonThrow'), t2 = $('#buffonThrow1000'), r = $('#buffonReset');
    if (t) t.addEventListener('click', () => buffonThrow(100));
    if (t2) t2.addEventListener('click', () => buffonThrow(1000));
    if (r) r.addEventListener('click', () => { bf.needles = []; drawBuffon(); });
    const l = $('#buffonLRange');
    if (l) l.addEventListener('input', () => {
      bf.L = Number(l.value);
      bf.needles = [];
      bf.conv = null;
      drawBuffon();
      drawBuffonConv();
    });
    bf.needles = [];
    for (let i = 0; i < 220; i++) {
      bf.needles.push({ x: Math.random() * 12, y: Math.random(), a: Math.random() * Math.PI });
    }
  }

  /* ==================================================== Router */

  const TITLES = {
    menu: 'Berühmte Probleme',
    collatz: 'Das Collatz-Problem',
    goldbach: 'Goldbach-Vermutung',
    zwillinge: 'Primzahlzwillinge',
    primzahlsatz: 'Der Primzahlsatz',
    ziegenproblem: 'Das Ziegenproblem',
    geburtstag: 'Geburtstagsparadoxon',
    buffon: 'Buffons Nadelproblem'
  };

  const IDS = Object.keys(TITLES).filter((k) => k !== 'menu');

  const DRAW = {
    collatz: () => { if (window.__collatzRedraw) window.__collatzRedraw(); },
    goldbach: () => { renderGb(); drawGbComet(); drawGbHist(); },
    zwillinge: () => { renderTw(); drawUlam(); drawTwCount(); },
    primzahlsatz: () => { renderPnt(); drawPiChart(); drawRatio(); },
    ziegenproblem: () => { montyBars(); drawMontyChart(); },
    geburtstag: () => { renderBd(); drawBdChart(); drawBdChords(); },
    buffon: () => { drawBuffon(); drawBuffonConv(); }
  };

  let current = null;

  function route() {
    const raw = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    const id = TITLES[raw] ? raw : 'menu';

    const menu = $('#menu');
    if (menu) menu.hidden = id !== 'menu';
    IDS.forEach((c) => {
      const el = document.getElementById(c);
      if (el) el.hidden = c !== id;
    });

    $$('.site-head nav a').forEach((a) => {
      if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    document.title = TITLES[id] + ' — visuell erklärt';
    current = id;

    window.scrollTo(0, 0);
    requestAnimationFrame(() => window.scrollTo(0, 0));
    if (id !== 'menu' && DRAW[id]) {
      requestAnimationFrame(() => requestAnimationFrame(DRAW[id]));
    }
  }

  function init() {
    if (!$('#menu')) return;
    bindGb();
    bindTw();
    bindPnt();
    bindMonty();
    bindBd();
    bindBuffon();

    window.addEventListener('hashchange', route);
    route();

    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => {
        if (current && DRAW[current]) DRAW[current]();
      });
      ['#gbComet', '#gbHist', '#ulam', '#twCount', '#piChart', '#ratioChart', '#montyChart', '#bdChart', '#bdChords', '#buffonCanvas', '#buffonConv']
        .forEach((sel) => { const el = $(sel); if (el) ro.observe(el); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
