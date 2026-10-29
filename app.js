/* ==========================================================================
   Collatz — Interaktion & Canvas-Visualisierungen
   ========================================================================== */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const nf = new Intl.NumberFormat('de-DE');
  const fmt = (v) => nf.format(v);

  const C = {
    grid: 'rgba(255,255,255,0.055)',
    axis: 'rgba(255,255,255,0.16)',
    tick: '#8f8fa2',
    cyan: '#5ad4f2',
    amber: '#ffc24a',
    green: '#63e6a4',
    violet: '#b39dfb',
    text: '#ececf3'
  };

  const MAX_N = 1e9;

  /* ---------------------------------------------------------------- Daten */

  function collatz(n, cap = 20000) {
    const seq = [n];
    let x = n;
    while (x !== 1 && seq.length < cap) {
      x = x % 2 === 0 ? x / 2 : 3 * x + 1;
      seq.push(x);
    }
    return seq;
  }

  // Stoppzeiten-Tabelle, inkrementell mit Memoisierung
  let stopArr = new Uint32Array(100001);
  let stopMax = 1;
  let stopPeak = 0;

  function ensureStop(N) {
    if (N <= stopMax) return;
    if (stopArr.length < N + 1) {
      const bigger = new Uint32Array(Math.max(N + 1, stopArr.length * 2));
      bigger.set(stopArr);
      stopArr = bigger;
    }
    for (let n = stopMax + 1; n <= N; n++) {
      let m = n, k = 0;
      while (m >= n) {
        m = m & 1 ? 3 * m + 1 : m / 2;
        k++;
      }
      const s = stopArr[m] + k;
      stopArr[n] = s;
      if (s > stopPeak) stopPeak = s;
    }
    stopMax = N;
  }

  const state = {
    n: 27,
    seq: [27],
    logScale: false,
    playIdx: 0,
    playing: false,
    N: 10000,
    flowN: 600,
    flowSel: 27,
    hoverN: null,
    scatterGeo: null,
    flowGeo: null,
    seqWin: { start: -1, end: -1, len: -1 }
  };

  /* ------------------------------------------------------------- Canvas */

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

  function axisFmt(v) {
    if (v >= 1e9) return (v / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' Mrd.';
    if (v >= 1e6) return (v / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio.';
    if (v >= 1e5) return fmt(Math.round(v / 1000)) + ' Tsd.';
    return fmt(Math.round(v));
  }

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }

  function niceTicks(max, count = 4) {
    if (!(max > 0)) return [0];
    const step = niceStep(max / count);
    const top = Math.ceil(max / step) * step;
    const out = [];
    for (let v = 0; v <= top + step / 2; v += step) out.push(v);
    return out;
  }

  /* ------------------------------------------------------- Trajektorie */

  function drawTraj() {
    const cv = $('#traj');
    if (!cv) return;
    const { ctx, w, h } = fit(cv);
    const pad = { l: 68, r: 20, t: 20, b: 28 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    const seq = state.seq;
    const L = seq.length;
    if (!L || pw < 20) return;

    let vmax = 1;
    for (let i = 0; i < L; i++) if (seq[i] > vmax) vmax = seq[i];

    const log = state.logScale;
    const yTicks = log
      ? (() => {
          const out = [];
          const top = Math.floor(Math.log10(vmax));
          const stepE = Math.max(1, Math.ceil((top + 1) / 5));
          for (let e = 0; e <= top; e += stepE) out.push(Math.pow(10, e));
          return out;
        })()
      : niceTicks(vmax, 4);

    const ymin = log ? 0 : 0;
    const ymaxScale = log ? Math.log10(vmax) + 0.08 : yTicks[yTicks.length - 1] * 1.06;

    const Y = (v) => {
      const t = log
        ? (Math.log10(Math.max(v, 1)) - ymin) / (ymaxScale - ymin)
        : (v - ymin) / (ymaxScale - ymin);
      return pad.t + ph * (1 - clamp(t, 0, 1));
    };
    const X = (i) => (L === 1 ? pad.l + pw / 2 : pad.l + (pw * i) / (L - 1));

    /* Grid */
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    yTicks.forEach((v) => {
      const y = Math.round(Y(v)) + 0.5;
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + pw, y);
      ctx.stroke();
      ctx.fillStyle = C.tick;
      ctx.fillText(axisFmt(v), pad.l - 12, y);
    });

    /* Grundlinie */
    ctx.strokeStyle = C.axis;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t + ph + 0.5);
    ctx.lineTo(pad.l + pw, pad.t + ph + 0.5);
    ctx.stroke();

    /* Achsen-Ticks */
    const xTicks = 4;
    ctx.textBaseline = 'top';
    for (let i = 0; i <= xTicks; i++) {
      const idx = Math.round(((L - 1) * i) / xTicks);
      ctx.textAlign = i === 0 ? 'left' : i === xTicks ? 'right' : 'center';
      ctx.fillStyle = C.tick;
      ctx.fillText(String(idx), X(idx), pad.t + ph + 8);
    }

    /* Pfad-Helfer */
    const pathTo = (upto) => {
      const p = new Path2D();
      p.moveTo(X(0), Y(seq[0]));
      for (let i = 1; i <= upto; i++) p.lineTo(X(i), Y(seq[i]));
      return p;
    };

    /* Fläche unter der gezogenen Kurve */
    const head = clamp(state.playIdx, 0, L - 1);
    if (head > 0) {
      const area = pathTo(head);
      area.lineTo(X(head), pad.t + ph);
      area.lineTo(X(0), pad.t + ph);
      area.closePath();
      const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
      grad.addColorStop(0, 'rgba(90,212,242,0.20)');
      grad.addColorStop(1, 'rgba(90,212,242,0.01)');
      ctx.fillStyle = grad;
      ctx.fill(area);
    }

    /* Geisterpfad (noch nicht gelaufen) */
    if (head < L - 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 4]);
      ctx.stroke(pathTo(L - 1));
      ctx.restore();
    }

    /* gezogene Kurve */
    ctx.save();
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 1.7;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(90,212,242,0.45)';
    ctx.shadowBlur = 9;
    ctx.stroke(pathTo(head));
    ctx.restore();

    /* Punkte: ungerade = amber, gerade = cyan */
    const dotEvery = L > 260 ? Math.ceil(L / 260) : 1;
    for (let i = 0; i <= head; i += dotEvery) {
      const x = X(i), y = Y(seq[i]);
      const odd = seq[i] % 2 === 1;
      ctx.beginPath();
      ctx.arc(x, y, L > 140 ? 1.5 : 2.1, 0, Math.PI * 2);
      ctx.fillStyle = odd ? C.amber : C.cyan;
      ctx.globalAlpha = odd ? 0.95 : 0.6;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* Maximum markieren */
    if (vmax > seq[0] && L > 2) {
      const mi = seq.indexOf(vmax);
      const mx = X(mi), my = Y(vmax);
      ctx.beginPath();
      ctx.arc(mx, my, 4.5, 0, Math.PI * 2);
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      const label = 'Maximum ' + fmt(vmax);
      ctx.font = '11.5px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = mx > pad.l + pw * 0.6 ? 'right' : 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = C.amber;
      ctx.fillText(label, mx + (ctx.textAlign === 'right' ? -8 : 8), my - 8);
    }

    /* Startwert + Ziel */
    ctx.font = '11.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#c9c9d6';
    if (L > 1) ctx.fillText('n = ' + fmt(seq[0]), X(0) + 3, Y(seq[0]) - 6);

    /* Kopfpunkt */
    const hx = X(head), hy = Y(seq[head]);
    ctx.beginPath();
    ctx.arc(hx, hy, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = seq[head] === 1 ? C.green : '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (seq[head] === 1 && head === L - 1) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = C.green;
      ctx.fillText('1 ✓', hx - 8, hy - 6);
    }
  }

  /* -------------------------------------------------------- Streudiagramm */

  let scatterCache = null;

  function drawScatter() {
    const cv = $('#scatter');
    if (!cv) return;
    const { ctx, w, h } = fit(cv);
    const pad = { l: 54, r: 18, t: 18, b: 34 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    const N = state.N;
    if (pw < 20) return;
    ensureStop(N);

    /* Basisbild cachen, damit Hover nicht 100 000 Punkte neu zeichnet */
    const key = w + '|' + h + '|' + N;
    if (!scatterCache || scatterCache.key !== key) {
      const base = document.createElement('canvas');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      base.width = Math.round(w * dpr);
      base.height = Math.round(h * dpr);
      const bctx = base.getContext('2d');
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const ymaxVal = paintScatter(bctx, w, h, pad, pw, ph, N);
      scatterCache = { key, canvas: base, ymax: ymaxVal };
    }
    ctx.drawImage(scatterCache.canvas, 0, 0, w, h);

    const ymaxBase = scatterCache.ymax;
    state.scatterGeo = { pad, pw, ph, N, ymax: ymaxBase };

    /* Hover-Marker */
    if (state.hoverN && state.hoverN <= N) {
      const n = state.hoverN;
      const x = pad.l + (pw * (n - 1)) / Math.max(1, N - 1);
      const y = pad.t + ph * (1 - stopArr[n] / ymaxBase);
      ctx.strokeStyle = 'rgba(99,230,164,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, pad.t + ph);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = C.green;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function paintScatter(ctx, w, h, pad, pw, ph, N) {

    let peak = 10;
    for (let n = 1; n <= N; n++) if (stopArr[n] > peak) peak = stopArr[n];
    const yTicks = niceTicks(peak, 4);
    const ymax = yTicks[yTicks.length - 1] || 10;

    const X = (n) => pad.l + (pw * (n - 1)) / Math.max(1, N - 1);
    const Y = (s) => pad.t + ph * (1 - s / ymax);

    /* Grid */
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    yTicks.forEach((v) => {
      const y = Math.round(Y(v)) + 0.5;
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + pw, y);
      ctx.stroke();
      ctx.fillStyle = C.tick;
      ctx.fillText(fmt(v), pad.l - 10, y);
    });

    /* x-Achse */
    ctx.strokeStyle = C.axis;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t + ph + 0.5);
    ctx.lineTo(pad.l + pw, pad.t + ph + 0.5);
    ctx.stroke();

    ctx.textBaseline = 'top';
    ctx.fillStyle = C.tick;
    for (let i = 0; i <= 4; i++) {
      const v = 1 + Math.round(((N - 1) * i) / 4);
      ctx.textAlign = i === 0 ? 'left' : i === 4 ? 'right' : 'center';
      ctx.fillText(fmt(v), X(v), pad.t + ph + 8);
    }

    /* Punkte in 6 Helligkeitsstufen gruppiert */
    const buckets = [[], [], [], [], [], []];
    for (let n = 1; n <= N; n++) {
      const s = stopArr[n];
      const b = clamp(Math.floor((s / ymax) * 6), 0, 5);
      buckets[b].push(n);
    }
    const big = N > 40000 ? 1.3 : 2;
    const cols = [
      'rgba(90,212,242,0.85)',
      'rgba(120,190,240,0.75)',
      'rgba(170,170,230,0.7)',
      'rgba(220,170,150,0.7)',
      'rgba(255,190,110,0.8)',
      'rgba(255,194,74,0.95)'
    ];
    buckets.forEach((arr, bi) => {
      ctx.fillStyle = cols[bi];
      for (let k = 0; k < arr.length; k++) {
        const n = arr[k];
        ctx.fillRect(X(n) - big / 2, Y(stopArr[n]) - big / 2, big, big);
      }
    });

    /* Rekorde hervorheben */
    const records = state.records;
    if (records) {
      const visible = records.filter(([n]) => n <= N);
      const labelFrom = Math.max(0, visible.length - 3);
      let vi = -1;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.1;
      records.forEach(([n, s]) => {
        if (n > N) return;
        vi++;
        const x = X(n), y = Y(s);
        ctx.beginPath();
        ctx.arc(x, y, 3.4, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0a0f';
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 1.7, 0, Math.PI * 2);
        ctx.fillStyle = C.cyan;
        ctx.fill();
        if (vi >= labelFrom) {
          ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = C.cyan;
          ctx.fillText(fmt(n), x - 7, y);
        }
      });
    }

    /* Hover wird im Aufrufer gezeichnet */

    return ymax;
  }

  /* ------------------------------------------------------------ Der Fluss */

  function drawFlow() {
    const cv = $('#flow');
    if (!cv) return;
    const { ctx, w, h } = fit(cv);
    const pad = { l: 52, r: 18, t: 18, b: 32 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    if (pw < 20) return;

    const N = state.flowN;
    const paths = [];
    let maxSteps = 1, maxVal = 1;
    for (let n = 1; n <= N; n++) {
      const seq = collatz(n, 2000);
      if (seq.length - 1 > maxSteps) maxSteps = seq.length - 1;
      const top = Math.max(...seq);
      if (top > maxVal) maxVal = top;
      paths.push(seq);
    }
    const ymax = Math.log10(maxVal) + 0.06;
    const X = (i) => pad.l + (pw * i) / Math.max(1, maxSteps);
    const Y = (v) => pad.t + ph * (1 - Math.log10(Math.max(v, 1)) / ymax);
    state.flowGeo = { pad, pw, ph, maxSteps, ymax };

    /* Grid: Zehnerpotenzen */
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let e = 0; e <= Math.floor(ymax); e++) {
      const y = Math.round(Y(Math.pow(10, e))) + 0.5;
      ctx.strokeStyle = C.grid;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + pw, y);
      ctx.stroke();
      ctx.fillStyle = C.tick;
      ctx.fillText(e === 0 ? '1' : '10' + sup(e), pad.l - 8, y);
    }

    /* Bündel: ein Pfad, dadurch entsteht Dichte-Schattierung */
    const bundle = new Path2D();
    for (let k = 0; k < paths.length; k++) {
      const seq = paths[k];
      if (seq[0] === state.flowSel) continue;
      bundle.moveTo(X(0), Y(seq[0]));
      for (let i = 1; i < seq.length; i++) bundle.lineTo(X(i), Y(seq[i]));
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(150,160,255,0.075)';
    ctx.lineWidth = 1;
    ctx.stroke(bundle);
    ctx.restore();

    /* hervorgehobene Bahn */
    const sel = paths[state.flowSel - 1] || paths[0];
    if (sel) {
      ctx.save();
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = 1.9;
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(255,194,74,0.5)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(X(0), Y(sel[0]));
      for (let i = 1; i < sel.length; i++) ctx.lineTo(X(i), Y(sel[i]));
      ctx.stroke();
      ctx.restore();

      const ex = X(sel.length - 1), ey = Y(sel[sel.length - 1]);
      ctx.beginPath();
      ctx.arc(ex, ey, 4, 0, Math.PI * 2);
      ctx.fillStyle = C.green;
      ctx.fill();

    }

    /* Achsen */
    ctx.strokeStyle = C.axis;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t + ph + 0.5);
    ctx.lineTo(pad.l + pw, pad.t + ph + 0.5);
    ctx.stroke();
    ctx.fillStyle = C.tick;
    ctx.textBaseline = 'top';
    for (let i = 0; i <= 4; i++) {
      const idx = Math.round((maxSteps * i) / 4);
      ctx.textAlign = i === 0 ? 'left' : i === 4 ? 'right' : 'center';
      ctx.fillText(String(idx), X(idx), pad.t + ph + 8);
    }
  }

  function sup(n) {
    const map = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
    return String(n).split('').map((d) => map[d] || d).join('');
  }

  /* ------------------------------------------------------------ Mini-Chart */

  function drawHero() {
    const cv = $('#heroCanvas');
    if (!cv) return;
    const { ctx, w, h } = fit(cv);
    const seq = collatz(27);
    const pad = { l: 2, r: 2, t: 10, b: 4 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    const ymax = Math.log10(Math.max(...seq)) + 0.05;
    const X = (i) => pad.l + (pw * i) / (seq.length - 1);
    const Y = (v) => pad.t + ph * (1 - Math.log10(Math.max(v, 1)) / ymax);

    const area = new Path2D();
    area.moveTo(X(0), Y(seq[0]));
    for (let i = 1; i < seq.length; i++) area.lineTo(X(i), Y(seq[i]));
    area.lineTo(X(seq.length - 1), pad.t + ph);
    area.lineTo(X(0), pad.t + ph);
    area.closePath();
    const g = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
    g.addColorStop(0, 'rgba(90,212,242,0.28)');
    g.addColorStop(1, 'rgba(90,212,242,0.02)');
    ctx.fillStyle = g;
    ctx.fill(area);

    ctx.beginPath();
    ctx.moveTo(X(0), Y(seq[0]));
    for (let i = 1; i < seq.length; i++) ctx.lineTo(X(i), Y(seq[i]));
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 1.3;
    ctx.lineJoin = 'round';
    ctx.stroke();

    /* Gipfel */
    const peak = Math.max(...seq);
    const pi = seq.indexOf(peak);
    ctx.beginPath();
    ctx.arc(X(pi), Y(peak), 2.6, 0, Math.PI * 2);
    ctx.fillStyle = C.amber;
    ctx.fill();

    /* Ziel */
    ctx.beginPath();
    ctx.arc(X(seq.length - 1), Y(1), 3, 0, Math.PI * 2);
    ctx.fillStyle = C.green;
    ctx.fill();
  }

  /* ------------------------------------------------------------- Sequenz */

  const seqList = $('#seqList');

  function renderSeq() {
    if (!seqList) return;
    const len = state.seq.length;
    const winMax = 38;
    let start = 0, end = len;
    if (len > winMax + 8) {
      start = clamp(state.playIdx - Math.floor(winMax / 2), 0, len - winMax);
      end = start + winMax;
    }

    if (state.seqWin.start !== start || state.seqWin.end !== end || state.seqWin.len !== len) {
      const frag = document.createDocumentFragment();
      const addMore = (txt) => {
        const li = document.createElement('li');
        li.className = 'more';
        li.textContent = txt;
        frag.appendChild(li);
      };
      if (start > 0) addMore('…');
      for (let i = start; i < end; i++) {
        const li = document.createElement('li');
        li.dataset.i = String(i);
        li.textContent = fmt(state.seq[i]);
        li.className = state.seq[i] % 2 === 1 ? 'odd' : 'even';
        frag.appendChild(li);
      }
      if (end < len) addMore('… +' + fmt(len - end));
      seqList.replaceChildren(frag);
      state.seqWin = { start, end, len };
    }

    const items = Array.from(seqList.children);
    items.forEach((li) => {
      if (!li.dataset.i) return;
      const i = Number(li.dataset.i);
      li.classList.toggle('current', i === state.playIdx);
      li.classList.toggle('pending', i > state.playIdx);
    });
  }

  function renderStats() {
    const seq = state.seq;
    const steps = Math.max(0, seq.length - 1);
    let vmax = 1;
    for (let i = 0; i < seq.length; i++) if (seq[i] > vmax) vmax = seq[i];
    const growth = state.n > 0 ? vmax / state.n : 0;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('statSteps', fmt(steps));
    set('statMax', fmt(vmax));
    const g = growth < 10 ? growth.toFixed(1).replace('.', ',') : fmt(Math.round(growth));
    set('statGrowth', g + '×');
    set('statNow', fmt(seq[state.playIdx] ?? state.n));
  }

  function renderSlider() {
    const range = $('#stepRange');
    if (!range) return;
    range.max = String(Math.max(0, state.seq.length - 1));
    range.value = String(state.playIdx);
    const out = $('#stepOut');
    if (out) out.textContent = state.playIdx + ' / ' + Math.max(0, state.seq.length - 1);
  }

  /* ------------------------------------------------------------- Playback */

  let rafId = null;

  function stopPlay(complete = false) {
    state.playing = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    const btn = $('#playBtn');
    if (btn) {
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML = complete ? '<span aria-hidden="true">↺</span> Noch einmal' : '<span aria-hidden="true">▶</span> Abspielen';
    }
  }

  function play() {
    if (state.seq.length < 2) return;
    if (state.playing) { stopPlay(); return; }
    if (state.playIdx >= state.seq.length - 1) state.playIdx = 0;
    state.playing = true;
    const btn = $('#playBtn');
    if (btn) {
      btn.setAttribute('aria-pressed', 'true');
      btn.innerHTML = '<span aria-hidden="true">❚❚</span> Pause';
    }
    const perStep = clamp(1800 / state.seq.length, 7, 260);
    const fromIdx = state.playIdx;
    const t0 = performance.now();

    const tick = (t) => {
      if (!state.playing) return;
      const target = fromIdx + Math.floor((t - t0) / perStep);
      if (target >= state.seq.length - 1) {
        state.playIdx = state.seq.length - 1;
        drawTraj(); renderSeq(); renderStats(); renderSlider();
        stopPlay(true);
        return;
      }
      if (target !== state.playIdx) {
        state.playIdx = target;
        drawTraj(); renderSeq(); renderStats(); renderSlider();
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  /* --------------------------------------------------------------- Setzen */

  function setN(n, opts = {}) {
    const val = clamp(Math.round(n), 1, MAX_N);
    state.n = val;
    state.seq = collatz(val);
    state.playIdx = state.seq.length - 1;
    state.seqWin = { start: -1, end: -1, len: -1 };

    const input = $('#nInput');
    if (input && input.value !== String(val)) input.value = String(val);
    $$('[data-bind="n"]').forEach((el) => (el.textContent = fmt(val)));
    $$('.chip-btn[data-preset]').forEach((b) => {
      b.setAttribute('aria-pressed', String(Number(b.dataset.preset) === val));
    });

    const err = $('#nError');
    if (err) err.textContent = '';
    const stepsNote = $('#trajStepsNote');
    if (stepsNote) stepsNote.textContent = fmt(Math.max(0, state.seq.length - 1));

    renderSeq();
    renderStats();
    renderSlider();
    drawTraj();
    drawFlowLegend();

    if (opts.autoplay && !reduceMotion && state.seq.length > 1) {
      state.playIdx = 0;
      renderSeq(); renderStats(); renderSlider(); drawTraj();
      play();
    }
  }

  function readInput() {
    const input = $('#nInput');
    const err = $('#nError');
    if (!input) return;
    const raw = input.value.trim().replace(/[.\s]/g, '');
    let msg = '';
    let v = NaN;
    if (!/^\d+$/.test(raw)) msg = 'Bitte eine ganze Zahl ab 1 eingeben — z. B. 27.';
    else {
      v = Number(raw);
      if (v < 1) msg = 'n muss mindestens 1 sein.';
      else if (v > MAX_N) msg = 'Für diese Demo bitte n ≤ ' + fmt(MAX_N) + ' wählen.';
    }
    if (err) err.textContent = msg;
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (!msg) setN(v, { autoplay: true });
  }

  /* ------------------------------------------------------- Record-Tabelle */

  function computeRecords(limit = 100000) {
    ensureStop(limit);
    const recs = [];
    let best = 0;
    for (let n = 1; n <= limit; n++) {
      if (stopArr[n] > best) { best = stopArr[n]; recs.push([n, best]); }
    }
    state.records = recs;
    return recs;
  }

  /* ------------------------------------------------------------ Scrubbing */

  function bind() {
    const input = $('#nInput');
    if (input) {
      input.addEventListener('change', readInput);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); readInput(); }
      });
    }

    const minus = $('#minusBtn');
    const plus = $('#plusBtn');
    if (minus) minus.addEventListener('click', () => setN(Math.max(1, state.n - 1), { autoplay: true }));
    if (plus) plus.addEventListener('click', () => setN(state.n + 1, { autoplay: true }));

    const rand = $('#randBtn');
    if (rand) rand.addEventListener('click', () => {
      const v = Math.floor(Math.random() * 9999) + 2;
      setN(v, { autoplay: true });
    });

    $$('.chip-btn[data-preset]').forEach((b) => {
      b.addEventListener('click', () => setN(Number(b.dataset.preset), { autoplay: true }));
    });

    const playBtn = $('#playBtn');
    if (playBtn) playBtn.addEventListener('click', play);

    const range = $('#stepRange');
    if (range) {
      range.addEventListener('input', () => {
        if (state.playing) stopPlay();
        state.playIdx = Number(range.value);
        drawTraj(); renderSeq(); renderStats(); renderSlider();
      });
    }

    const logBtn = $('#logBtn');
    if (logBtn) {
      const sync = () => logBtn.setAttribute('aria-pressed', String(state.logScale));
      sync();
      logBtn.addEventListener('click', () => {
        state.logScale = !state.logScale;
        sync();
        drawTraj();
      });
    }

    /* Streudiagramm: N-Slider */
    const nRange = $('#nRange');
    if (nRange) {
      const out = $('#nRangeOut');
      const note = $('#scatterNote');
      nRange.addEventListener('input', () => {
        state.N = Number(nRange.value);
        if (out) out.textContent = fmt(state.N);
        if (note) note.textContent = 'alle n bis ' + fmt(state.N);
        drawScatter();
      });
      if (out) out.textContent = fmt(state.N);
      if (note) note.textContent = 'alle n bis ' + fmt(state.N);
    }

    /* Tastatur-Hinweis fokussiert das Diagramm */
    const kbdBtn = $('#kbdBtn');
    if (kbdBtn) kbdBtn.addEventListener('click', () => $('#scatter')?.focus());

    /* Streudiagramm: Hover */
    const sc = $('#scatter');
    if (sc) {
      const move = (clientX, clientY) => {
        const g = state.scatterGeo;
        if (!g) return;
        const rect = sc.getBoundingClientRect();
        const mx = clientX - rect.left;
        const my = clientY - rect.top;
        if (mx < g.pad.l || mx > g.pad.l + g.pw || my < g.pad.t || my > g.pad.t + g.ph) {
          hideTip(); return;
        }
        const n = clamp(Math.round(1 + ((mx - g.pad.l) / g.pw) * (g.N - 1)), 1, g.N);
        state.hoverN = n;
        drawScatter();
        showTip(
          '<span>n =</span> ' + fmt(n) + ' · <span>Schritte</span> ' + fmt(stopArr[n]),
          g.pad.l + (g.pw * (n - 1)) / Math.max(1, g.N - 1),
          g.pad.t + g.ph * (1 - stopArr[n] / g.ymax)
        );
        sc.setAttribute('aria-label',
          'Streudiagramm der Stoppzeiten für n bis ' + fmt(g.N) +
          '. Aktuell: n = ' + fmt(n) + ' mit ' + fmt(stopArr[n]) + ' Schritten.');
      };
      sc.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
      sc.addEventListener('mouseleave', () => { state.hoverN = null; hideTip(); drawScatter(); });
      sc.addEventListener('touchstart', (e) => {
        if (e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });

      sc.addEventListener('keydown', (e) => {
        const g = state.scatterGeo;
        if (!g) return;
        const cur = state.hoverN || 1;
        let next = null;
        if (e.key === 'ArrowRight') next = clamp(cur + 1, 1, g.N);
        else if (e.key === 'ArrowLeft') next = clamp(cur - 1, 1, g.N);
        else if (e.key === 'ArrowUp') next = clamp(cur + 25, 1, g.N);
        else if (e.key === 'ArrowDown') next = clamp(cur - 25, 1, g.N);
        else if (e.key === 'Home') next = 1;
        else if (e.key === 'End') next = g.N;
        if (next === null) return;
        e.preventDefault();
        state.hoverN = next;
        drawScatter();
        showTip(
          '<span>n =</span> ' + fmt(next) + ' · <span>Schritte</span> ' + fmt(stopArr[next]),
          g.pad.l + (g.pw * (next - 1)) / Math.max(1, g.N - 1),
          g.pad.t + g.ph * (1 - stopArr[next] / g.ymax)
        );
        sc.setAttribute('aria-label',
          'Streudiagramm der Stoppzeiten. Ausgewählt: n = ' + fmt(next) + ' mit ' + fmt(stopArr[next]) + ' Schritten.');
      });
      sc.addEventListener('blur', () => { state.hoverN = null; hideTip(); drawScatter(); });
    }

    /* Fluss-Slider */
    const flowRange = $('#flowRange');
    if (flowRange) {
      const out = $('#flowRangeOut');
      const fs = $('#flowSel');
      flowRange.addEventListener('input', () => {
        state.flowN = Number(flowRange.value);
        if (state.flowSel > state.flowN) {
          state.flowSel = state.flowN;
          if (fs) fs.value = String(state.flowSel);
          drawFlowLegend();
        }
        if (out) out.textContent = fmt(state.flowN);
        drawFlow();
      });
      if (out) out.textContent = fmt(state.flowN);
    }

    /* Fluss: Startwert wählen */
    const flowSel = $('#flowSel');
    if (flowSel) {
      const applySel = () => {
        const v = clamp(Math.round(Number(flowSel.value)) || 27, 1, state.flowN);
        state.flowSel = v;
        if (flowSel.value !== String(v)) flowSel.value = String(v);
        drawFlowLegend();
        drawFlow();
      };
      flowSel.addEventListener('input', applySel);
      flowSel.addEventListener('change', applySel);
    }
  }

  function showTip(html, x, y) {
    const tip = $('#tip');
    if (!tip) return;
    const cv = $('#scatter');
    const rect = cv.getBoundingClientRect();
    const wrap = cv.parentElement.getBoundingClientRect();
    tip.innerHTML = html;
    tip.style.left = x + (rect.left - wrap.left) + 'px';
    tip.style.top = y + (rect.top - wrap.top) + 'px';
    tip.classList.add('is-on');
  }

  function hideTip() {
    const tip = $('#tip');
    if (tip) tip.classList.remove('is-on');
  }

  function drawFlowLegend() {
    const el = $('#flowNow');
    if (el) el.textContent = fmt(state.flowSel);
  }

  /* ------------------------------------------------------------- Resize */

  let resizeTimer = null;
  function scheduleDraw() {
    if (resizeTimer) cancelAnimationFrame(resizeTimer);
    resizeTimer = requestAnimationFrame(() => {
      drawHero();
      drawTraj();
      drawScatter();
      drawFlow();
    });
  }

  /* -------------------------------------------------------------- Reveal */

  function initReveal() {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window) || reduceMotion) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach((el) => io.observe(el));
  }

  /* ---------------------------------------------------------------- Init */

  function init() {
    computeRecords(100000);

    /* Zahlen in der Rekordtabelle deutsch formatieren */
    $$('td[data-num]').forEach((td) => {
      td.textContent = fmt(Number(td.dataset.num));
    });

    const flowSel = $('#flowSel');
    if (flowSel) flowSel.value = '27';

    bind();
    setN(27);
    drawHero();
    initReveal();

    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => scheduleDraw());
      ['#heroCanvas', '#traj', '#scatter', '#flow'].forEach((sel) => {
        const el = $(sel);
        if (el) ro.observe(el.parentElement || el);
      });
    } else {
      window.addEventListener('resize', scheduleDraw);
    }

    /* Wird vom Router aufgerufen, wenn das Kapitel sichtbar wird */
    window.__collatzRedraw = scheduleDraw;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
