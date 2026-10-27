/* Repères de versets pour un enregistrement « sourate entière » sans repères publiés — partie navigateur.
   Script exécuté dans un onglet de navigateur (le décodage MP3 du navigateur est celui qui sert à la lecture).

   Principe : alignement audio-sur-audio. Le fichier visé (ex. Mohamed Al-Luhaidan, MP3Quran) est comparé à
   trois récitations de référence découpées verset par verset (EveryAyah : un fichier par verset, donc des
   limites de versets exactes). Coefficients cepstraux (MFCC) + énergie, normalisés par fichier, deltas ;
   alignement temporel dynamique (DTW) multi-échelle. Chaque limite de verset de la référence donne une
   position prédite dans le fichier visé. Les pauses réelles du fichier visé sont détectées sur son énergie.
   Choix final (choose) : pour chaque limite, la pause réelle retenue doit être confirmée par les références
   (3 sur 3, ou 2 sur 3 et la troisième à moins de 3 s) ; sinon la limite reste incertaine et les deux versets
   sont surlignés ensemble dans l'appli. Aucun temps n'est recopié d'une référence : seule la correspondance
   acoustique sert. Validation : mêmes calculs sur Yasser Al-Dossari, comparés à ses repères publiés.

   Utilisation (console de l'onglet) : ALN.run({ suras, targets, ayas, conc }) puis ALN.status(),
   ALN.validate(null, liste), ALN.exportApp('luhaidan', null, liste). */
(() => {
  const Z = {};  // fonctions remplaçables (réglages pendant la validation)
  const SR = 16000, HOP = 320, WIN = 512, NFFT = 512, NMEL = 26, NC = 12;
  const FPS = SR / HOP;           // 50 trames / s
  const D0 = NC + 1;              // c1..c12 + énergie
  const D = D0 * 2;               // + deltas
  const EW = 5;                   // poids de l'énergie (aligne pauses sur pauses)
  const MAX_CELLS = 4e7, RADIUS = 24;

  /* ---------- Traitement du signal ---------- */
  function makeFFT(N) {
    const L = Math.log2(N) | 0;
    const cos = new Float64Array(N / 2), sin = new Float64Array(N / 2);
    for (let i = 0; i < N / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / N); sin[i] = Math.sin(2 * Math.PI * i / N); }
    const rev = new Uint32Array(N);
    for (let i = 0; i < N; i++) { let r = 0; for (let b = 0; b < L; b++) r |= ((i >> b) & 1) << (L - 1 - b); rev[i] = r; }
    return (re, im) => {
      for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
      for (let size = 2; size <= N; size *= 2) {
        const half = size / 2, step = N / size;
        for (let i = 0; i < N; i += size) {
          for (let j = i, k = 0; j < i + half; j++, k += step) {
            const l = j + half;
            const tre = re[l] * cos[k] + im[l] * sin[k];
            const tim = -re[l] * sin[k] + im[l] * cos[k];
            re[l] = re[j] - tre; im[l] = im[j] - tim; re[j] += tre; im[j] += tim;
          }
        }
      }
    };
  }
  const fft = makeFFT(NFFT);
  const hamming = new Float64Array(WIN); for (let i = 0; i < WIN; i++) hamming[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (WIN - 1));
  const mel = (f) => 2595 * Math.log10(1 + f / 700), imel = (m) => 700 * (Math.pow(10, m / 2595) - 1);
  const fb = [];
  {
    const lo = mel(80), hi = mel(7600); const pts = [];
    for (let i = 0; i < NMEL + 2; i++) pts.push(Math.floor((NFFT + 1) * imel(lo + (hi - lo) * i / (NMEL + 1)) / SR));
    for (let m = 1; m <= NMEL; m++) {
      const w = new Float64Array(NFFT / 2 + 1);
      for (let k = pts[m - 1]; k < pts[m]; k++) w[k] = (k - pts[m - 1]) / Math.max(1, pts[m] - pts[m - 1]);
      for (let k = pts[m]; k <= pts[m + 1]; k++) w[k] = (pts[m + 1] - k) / Math.max(1, pts[m + 1] - pts[m]);
      fb.push(w);
    }
  }
  const dct = []; for (let k = 1; k <= NC; k++) { const r = new Float64Array(NMEL); for (let m = 0; m < NMEL; m++) r[m] = Math.cos(Math.PI * k * (m + 0.5) / NMEL); dct.push(r); }

  /* Flux de caractéristiques : on pousse le signal (16 kHz mono) morceau par morceau, sans le garder en entier */
  function featureStream() {
    let buf = new Float32Array(0), base = 0, n = 0, total = 0;
    const rows = []; let cur = new Float32Array(4096 * D0), curN = 0;
    const re = new Float64Array(NFFT), im = new Float64Array(NFFT), me = new Float64Array(NMEL);
    function frame(cat, o, prev0) {
      let e = 0; let prev = prev0;
      for (let i = 0; i < WIN; i++) { const v = cat[o + i]; e += v * v; re[i] = (v - 0.97 * prev) * hamming[i]; im[i] = 0; prev = v; }
      for (let i = WIN; i < NFFT; i++) { re[i] = 0; im[i] = 0; }
      fft(re, im);
      for (let m = 0; m < NMEL; m++) { const w = fb[m]; let s = 0; for (let k = 0; k <= NFFT / 2; k++) if (w[k]) s += w[k] * (re[k] * re[k] + im[k] * im[k]); me[m] = Math.log(s + 1e-9); }
      if (curN === 4096) { rows.push(cur); cur = new Float32Array(4096 * D0); curN = 0; }
      const o2 = curN * D0;
      for (let k = 0; k < NC; k++) { let s = 0; const r = dct[k]; for (let m = 0; m < NMEL; m++) s += r[m] * me[m]; cur[o2 + k] = s; }
      cur[o2 + NC] = 10 * Math.log10(e / WIN + 1e-10);
      curN++;
    }
    return {
      push(x) {
        total += x.length;
        const cat = new Float32Array(buf.length + x.length); cat.set(buf); cat.set(x, buf.length);
        while (n * HOP + WIN <= base + cat.length) {
          const o = n * HOP - base;
          frame(cat, o, o > 0 ? cat[o - 1] : 0);
          n++;
        }
        const keep = Math.max(0, n * HOP - base - 1);
        buf = cat.slice(keep); base += keep;
      },
      samples() { return total; },
      finish() {
        rows.push(cur.subarray(0, curN * D0));
        const raw = new Float32Array(n * D0); let p = 0; for (const r of rows) { raw.set(r, p); p += r.length; }
        const E = new Float32Array(n); for (let t = 0; t < n; t++) E[t] = raw[t * D0 + NC];
        // normalisation par fichier (moyenne/écart-type), deltas, poids de l'énergie
        for (let d = 0; d < D0; d++) {
          let s = 0, s2 = 0; for (let t = 0; t < n; t++) { const v = raw[t * D0 + d]; s += v; s2 += v * v; }
          const mu = s / n, sd = Math.sqrt(Math.max(1e-9, s2 / n - mu * mu));
          for (let t = 0; t < n; t++) raw[t * D0 + d] = (raw[t * D0 + d] - mu) / sd;
        }
        const F = new Float32Array(n * D);
        for (let t = 0; t < n; t++) {
          const a = Math.max(0, t - 2), b = Math.min(n - 1, t + 2);
          for (let d = 0; d < D0; d++) {
            const w = d === NC ? EW : 1;
            F[t * D + d] = raw[t * D0 + d] * w;
            F[t * D + D0 + d] = (raw[b * D0 + d] - raw[a * D0 + d]) / (b - a || 1) * 2 * w;
          }
        }
        return { F, E, n, dur: total / SR };
      },
    };
  }

  /* ---------- Décodage ---------- */
  function mix(ab) {
    const n = ab.length, ch = ab.numberOfChannels; const x = new Float32Array(n);
    for (let c = 0; c < ch; c++) { const d = ab.getChannelData(c); for (let i = 0; i < n; i++) x[i] += d[i] / ch; }
    return x;
  }
  function mp3Frames(u8) {
    const BR = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
    const SRS = [44100, 48000, 32000, 0];
    const out = []; let p = 0; let sr0 = 0;
    if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) p = 10 + ((u8[6] & 0x7f) << 21 | (u8[7] & 0x7f) << 14 | (u8[8] & 0x7f) << 7 | (u8[9] & 0x7f));
    while (p + 4 <= u8.length) {
      if (u8[p] === 0xff && (u8[p + 1] & 0xfe) === 0xfa) {
        const bri = u8[p + 2] >> 4, sri = (u8[p + 2] >> 2) & 3, pad = (u8[p + 2] >> 1) & 1;
        const br = BR[bri], sr = SRS[sri];
        if (br && sr) {
          const len = Math.floor(144000 * br / sr) + pad;
          if (p + len <= u8.length && (p + len + 1 >= u8.length || (u8[p + len] === 0xff && (u8[p + len + 1] & 0xe0) === 0xe0))) {
            if (!sr0) sr0 = sr;
            out.push(p); p += len; continue;
          }
        }
      }
      p++;
    }
    // trame d'information Xing/Info (sans son) : exclue de la chronologie
    if (out.length > 1) { const a = out[0], b = out[1]; const s = String.fromCharCode(...u8.subarray(a, b)); if (s.includes('Xing') || s.includes('Info')) out.shift(); }
    return { starts: out, sr: sr0 };
  }
  const octx = () => new OfflineAudioContext(1, 1, SR);
  /* Pousse le signal décodé d'un fichier MP3 dans le flux ; gros fichiers découpés aux limites de trames
     (8 trames d'amorce redécodées puis retirées pour le réservoir de bits) */
  async function decodeInto(buf, fs) {
    const ctx = octx();
    if (buf.byteLength < 30e6) { fs.push(mix(await ctx.decodeAudioData(buf.slice(0)))); return 'entier'; }
    const u8 = new Uint8Array(buf);
    const { starts, sr } = mp3Frames(u8);
    if (!starts.length || !sr) throw new Error('trames MP3 introuvables');
    const per = 3000, pre = 8; const spf = 1152 * SR / sr;
    let written = 0;
    for (let f0 = 0; f0 < starts.length; f0 += per) {
      const a = Math.max(0, f0 - pre); const b = Math.min(starts.length, f0 + per);
      const end = b < starts.length ? starts[b] : u8.length;
      const m = mix(await ctx.decodeAudioData(u8.slice(starts[a], end).buffer));
      const want = Math.round(b * spf) - Math.round(f0 * spf);
      const missing = Math.max(0, Math.round((b - a) * spf) - m.length);
      const skip = Math.max(0, Math.round((f0 - a) * spf) - missing);
      const seg = new Float32Array(want); seg.set(m.subarray(skip, skip + want));
      fs.push(seg); written += want;
    }
    return 'morceaux';
  }

  /* ---------- Chargements ---------- */
  async function getBuf(url) {
    for (let k = 0; k < 3; k++) {
      try { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.arrayBuffer(); }
      catch (e) { if (k === 2) throw new Error(url + ' : ' + e.message); await new Promise((res) => setTimeout(res, 1500 * (k + 1))); }
    }
  }
  const MEM = { on: false, map: new Map() };
  async function loadTarget(url) {
    if (MEM.on && MEM.map.has(url)) return MEM.map.get(url);
    const v = await loadTarget0(url); if (MEM.on) MEM.map.set(url, v); return v;
  }
  async function loadTarget0(url) {
    const buf = await getBuf(url);
    const fs = featureStream();
    const how = await decodeInto(buf, fs);
    const f = fs.finish();
    return Object.assign(f, { bytes: buf.byteLength, how });
  }
  const pad3 = (n) => String(n).padStart(3, '0');
  /* Référence EveryAyah : versets mis bout à bout (basmala d'ouverture ajoutée sauf sourates 1 et 9) */
  async function loadRef(folder, s, ayas) {
    const k = folder + '/' + s;
    if (MEM.on && MEM.map.has(k)) return MEM.map.get(k);
    const v = await loadRef0(folder, s, ayas); if (MEM.on) MEM.map.set(k, v); return v;
  }
  async function loadRef0(folder, s, ayas) {
    const list = [];
    if (s !== 1 && s !== 9) list.push({ key: 'bas', url: `https://everyayah.com/data/${folder}/001001.mp3` });
    for (let a = 1; a <= ayas; a++) list.push({ key: a, url: `https://everyayah.com/data/${folder}/${pad3(s)}${pad3(a)}.mp3` });
    const fs = featureStream(); const bounds = {}; let bytes = 0;
    const ctx = octx();
    // téléchargements en parallèle (6), décodage dans l'ordre — sans minuterie (onglet en arrière-plan)
    const slots = list.map(() => { const o = {}; o.p = new Promise((a, b) => { o.res = a; o.rej = b; }); o.p.catch(() => {}); return o; });
    let next = 0;
    const worker = async () => { while (next < list.length) { const i = next++; try { slots[i].res(await getBuf(list[i].url)); } catch (e) { slots[i].rej(e); } } };
    const workers = Array.from({ length: 6 }, worker);
    for (let i = 0; i < list.length; i++) {
      const b = await slots[i].p; slots[i] = null; bytes += b.byteLength;
      const x = mix(await ctx.decodeAudioData(b));
      const t0 = fs.samples() / SR; fs.push(x); bounds[list[i].key] = [t0, fs.samples() / SR];
    }
    await Promise.all(workers);
    const f = fs.finish();
    return Object.assign(f, { bounds, bytes });
  }

  /* ---------- DTW multi-échelle ---------- */
  function down(F, n, g) {
    const m = Math.ceil(n / g); const G = new Float32Array(m * D);
    for (let i = 0; i < m; i++) { const a = g * i, b = Math.min(n, a + g); for (let d = 0; d < D; d++) { let s = 0; for (let t = a; t < b; t++) s += F[t * D + d]; G[i * D + d] = s / (b - a); } }
    return { F: G, n: m };
  }
  /* DTW (pas symétriques, diagonale ×2) dans une fenêtre par ligne [lo[i], hi[i]].
     Début et fin libres mais bornés, des deux côtés : un enregistrement peut contenir au début ou à la fin
     une partie absente de l'autre (isti'adha, basmala, silence, « âmîn », reprise). Jusqu'à `ed` trames
     (25 s au plus) peuvent être laissées de côté à chaque extrémité, chaque trame laissée coûtant C0
     (≈ coût d'une trame bien appariée) : écarter de la récitation commune n'est donc jamais avantageux. */
  const C0 = 7, EDGE_S = 25;
  /* ed = { sT, sR, eT, eR } : trames qu'on peut laisser au début / à la fin, côté fichier visé (T) et côté référence (R) */
  function dtwWin(A, nA, B, nB, lo, hi, ed) {
    const off = new Int32Array(nA + 1); for (let i = 0; i < nA; i++) off[i + 1] = off[i] + (hi[i] - lo[i] + 1);
    const tb = new Uint8Array(off[nA]);
    const lastCol = new Float64Array(nA).fill(Infinity);
    let prev = null, pl = 0, ph = -1, cur = null;
    for (let i = 0; i < nA; i++) {
      const l = lo[i], h = hi[i]; cur = new Float64Array(h - l + 1); const ai = i * D;
      for (let j = l; j <= h; j++) {
        let d = 0; const bj = j * D; for (let k = 0; k < D; k++) { const v = A[ai + k] - B[bj + k]; d += v * v; } d = Math.sqrt(d);
        let best = Infinity, dir = 3;
        if (i <= ed.sT && j <= ed.sR) best = 2 * d + Z.K.C0 * (i + j);
        if (i > 0 && j > 0 && j - 1 >= pl && j - 1 <= ph) { const v = prev[j - 1 - pl] + 2 * d; if (v < best) { best = v; dir = 0; } }
        if (i > 0 && j >= pl && j <= ph) { const v = prev[j - pl] + d; if (v < best) { best = v; dir = 1; } }
        if (j > l) { const v = cur[j - 1 - l] + d; if (v < best) { best = v; dir = 2; } }
        cur[j - l] = best; tb[off[i] + j - l] = dir;
      }
      if (h === nB - 1) lastCol[i] = cur[h - l];
      prev = cur; pl = l; ph = h;
    }
    // fin : dernière trame de référence atteinte dans les `ed` dernières trames visées, ou l'inverse
    let bi = nA - 1, bj = nB - 1, bc = Infinity;
    for (let i = Math.max(0, nA - 1 - ed.eT); i < nA; i++) { const c = lastCol[i] + Z.K.C0 * (nA - 1 - i); if (c < bc) { bc = c; bi = i; bj = nB - 1; } }
    for (let j = Math.max(pl, nB - 1 - ed.eR); j <= ph; j++) { const c = prev[j - pl] + Z.K.C0 * (nB - 1 - j); if (c < bc) { bc = c; bi = nA - 1; bj = j; } }
    const pi = [], pj = []; let i = bi, j = bj;
    for (let guard = 0; guard < nA + nB + 5; guard++) {
      pi.push(i); pj.push(j);
      const dir = tb[off[i] + j - lo[i]];
      if (dir === 3) break;
      if (dir === 0) { i--; j--; } else if (dir === 1) i--; else j--;
    }
    pi.reverse(); pj.reverse();
    return { pi: Int32Array.from(pi), pj: Int32Array.from(pj), cost: bc };
  }
  function refine(A, nA, B, nB, coarse, ed) {
    const mn = new Int32Array(nA).fill(1 << 30), mx = new Int32Array(nA).fill(-1);
    for (let k = 0; k < coarse.pi.length; k++) {
      const i0 = 2 * coarse.pi[k], j0 = 2 * coarse.pj[k];
      for (let di = 0; di < 2; di++) { const i = i0 + di; if (i >= nA) continue; if (j0 < mn[i]) mn[i] = j0; const jj = Math.min(nB - 1, j0 + 1); if (jj > mx[i]) mx[i] = jj; }
    }
    const first = 2 * coarse.pi[0];
    const lo = new Int32Array(nA), hi = new Int32Array(nA);
    for (let i = 0; i < nA; i++) {
      let a = 1 << 30, b = -1;
      for (let t = Math.max(0, i - RADIUS); t <= Math.min(nA - 1, i + RADIUS); t++) { if (mn[t] < a) a = mn[t]; if (mx[t] > b) b = mx[t]; }
      if (b < 0) { if (i < first) { lo[i] = 0; hi[i] = Math.min(nB - 1, ed.sR); } else { lo[i] = Math.max(0, nB - 1 - ed.eR); hi[i] = nB - 1; } continue; }
      lo[i] = Math.max(0, a - RADIUS); hi[i] = Math.min(nB - 1, b + RADIUS);
    }
    for (let i = 1; i < nA; i++) if (lo[i] < lo[i - 1]) lo[i] = lo[i - 1];
    for (let i = nA - 2; i >= 0; i--) if (hi[i] > hi[i + 1]) hi[i] = hi[i + 1];
    for (let i = 1; i < nA; i++) { if (lo[i] > hi[i - 1] + 1) lo[i] = hi[i - 1] + 1; if (lo[i] > hi[i]) hi[i] = lo[i]; }
    return Z.dtwWin(A, nA, B, nB, lo, hi, ed);
  }
  /* Côté fichier visé : jusqu'à 25 s laissées de côté au début et à la fin (isti'adha, silence, « âmîn »…).
     Côté référence : rien (0,4 s). La basmala placée en tête de la référence est testée dans les deux cas :
     alignement avec elle, puis sans elle ; on garde celui dont le coût moyen par trame est le plus faible
     (certains enregistrements de sourates courtes n'ont pas de basmala). */
  function align1(T, RR, sRsec) {
    let g = 1; while ((T.n / g) * (RR.n / g) > MAX_CELLS) g *= 2;
    let path = null;
    for (let h = g; h >= 1; h /= 2) {
      const a = h === 1 ? T : down(T.F, T.n, h);
      const b = h === 1 ? RR : down(RR.F, RR.n, h);
      const tMax = Math.min(Z.K.EDGE_S * FPS, 0.25 * T.n);
      const ed = { sT: Math.floor(tMax / h), eT: Math.floor(tMax / h), sR: Math.ceil(sRsec * FPS / h), eR: Math.ceil(0.4 * FPS / h) };
      if (!path) path = Z.dtwWin(a.F, a.n, b.F, b.n, new Int32Array(a.n), new Int32Array(a.n).fill(b.n - 1), ed);
      else path = Z.refine(a.F, a.n, b.F, b.n, path, ed);
    }
    return path;
  }
  function align(T, R, basmala) {
    const basEnd = R.bounds && R.bounds.bas ? R.bounds.bas[1] : 0;
    const A = align1(T, R, 0.4);
    if (!basEnd) { A.variant = 'sans-basmala-ref'; return A; }
    if (basmala === 'oui') { A.variant = 'avec-basmala'; return A; }
    const off = Math.round(basEnd * FPS);
    const R2 = { F: R.F.subarray(off * D), n: R.n - off };
    const B = align1(T, R2, 0.4);
    const ca = A.cost / (T.n + R.n), cb = B.cost / (T.n + R2.n);
    if (ca <= cb) { A.variant = 'avec-basmala'; A.alt = +cb.toFixed(4); return A; }
    const pj = new Int32Array(B.pj.length); for (let k = 0; k < pj.length; k++) pj[k] = B.pj[k] + off;
    return { pi: B.pi, pj, cost: B.cost * (T.n + R.n) / (T.n + R2.n), variant: 'sans-basmala', alt: +ca.toFixed(4) };
  }
  function mapTime(path, t) {
    const { pi, pj } = path; const j = Math.round(t * FPS);
    let lo = 0, hi = pj.length - 1, k = pj.length;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (pj[mid] >= j) { k = mid; hi = mid - 1; } else lo = mid + 1; }
    if (k >= pj.length) return pi[pi.length - 1] / FPS;
    let b = k; while (b + 1 < pj.length && pj[b + 1] === pj[k]) b++;
    return (pi[k] + pi[b]) / 2 / FPS;
  }

  /* ---------- Pauses du fichier visé (creux nets par rapport au niveau local de la voix) ---------- */
  function pauses(E) {
    const n = E.length; const s = new Float32Array(n);
    for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); const w = [E[a], E[i], E[b]].sort((x, y) => x - y); s[i] = w[1]; }
    const voiced = Array.from(s).filter((v) => v > -80).sort((a, b) => a - b);
    if (voiced.length < FPS) return [];
    const speech = voiced[Math.floor(0.75 * (voiced.length - 1))];
    const half = Math.round(1.5 * FPS); const peak = new Float32Array(n);
    for (let i = 0; i < n; i += 12) {
      const seg = Array.from(s.subarray(Math.max(0, i - half), Math.min(n, i + half + 1))).sort((a, b) => a - b);
      const v = seg[Math.floor(0.92 * (seg.length - 1))];
      for (let j = i; j < Math.min(n, i + 12); j++) peak[j] = v;
    }
    const out = []; let i = 0;
    while (i < n) {
      if (s[i] < peak[i] - 11 && s[i] < speech - 6) {
        let j = i; let dep = 0;
        while (j < n && s[j] < peak[j] - 11 && s[j] < speech - 6) { dep += peak[j] - s[j]; j++; }
        if (j - i >= 4) out.push([+(i / FPS).toFixed(2), +(j / FPS).toFixed(2), +(dep / (j - i)).toFixed(1)]);
        i = j;
      } else i++;
    }
    return out;
  }

  /* ---------- Travail par sourate ---------- */
  const TARGETS = {
    luhaidan: (s) => `https://cdn.mp3quran.net/audio/muhammad-luhaidan/r1/${pad3(s)}.mp3`,
    dossari: (s) => `https://cdn.mp3quran.net/audio/yasser-dosari/r1/${pad3(s)}.mp3`,
  };
  /* Références retenues après essai de 8 voix EveryAyah sur 10 sourates d'Al-Dossari (repères publiés) :
     précision brute à 300 ms — Husary 86 %, Sudais 81 %, Maher 80 %, Alafasy 76 %, Shuraym 75 %, Fares 74 %,
     Basfar 67 %, Ali Jaber 66 % ; meilleur trio pour le vote à 2 voix sur 3 : Shuraym + Sudais + Maher. */
  const REFS = ['Saood_ash-Shuraym_64kbps', 'Abdurrahmaan_As-Sudais_64kbps', 'Maher_AlMuaiqly_64kbps'];
  /* Basmala au début du fichier visé : Al-Luhaidan (MP3Quran r1) la récite avant chaque sourate (sauf 1 et 9) —
     constaté sur les sourates contrôlées et revérifié à la sortie (segment de 1,5 à 7 s avant le verset 1) ;
     Al-Dossari (r1) ne la récite pas avant les sourates courtes : choix automatique (coût d'alignement). */
  const BASMALA = { luhaidan: 'oui', dossari: 'auto' };
  const KEY = (t, s) => `${t}:${s}`;
  /* Résultats gardés dans IndexedDB de l'onglet (survivent à un rechargement) */
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => { const r = indexedDB.open('aln7', 1); r.onupgradeneeded = () => r.result.createObjectStore('res'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    return dbp;
  }
  async function dbGet(k) { const d = await db(); return new Promise((res, rej) => { const q = d.transaction('res').objectStore('res').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
  async function dbDel(k) { const d = await db(); return new Promise((res, rej) => { const tx = d.transaction('res', 'readwrite'); tx.objectStore('res').delete(k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
  async function dbPut(k, v) { const d = await db(); return new Promise((res, rej) => { const tx = d.transaction('res', 'readwrite'); tx.objectStore('res').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
  async function processSura(s, ayas, targets, refs) {
    const T = {};
    for (const t of targets) { if (await dbGet(KEY(t, s))) continue; T[t] = await loadTarget(TARGETS[t](s)); }
    const todo = Object.keys(T); if (!todo.length) return 'déjà fait';
    const res = {}; for (const t of todo) res[t] = { s, t, url: TARGETS[t](s), bytes: T[t].bytes, dur: +T[t].dur.toFixed(3), how: T[t].how, refs: [], pauses: Z.pauses(T[t].E) };
    for (const f of refs) {
      let R = null;
      try { R = await loadRef(f, s, ayas); } catch (e) { for (const t of todo) res[t].refs.push({ f, err: String(e && e.message || e) }); continue; }
      for (const t of todo) {
        const t0 = performance.now(); const path = Z.align(T[t], R, BASMALA[t]);
        const r = { f, bytes: R.bytes, dur: +R.dur.toFixed(2), ms: Math.round(performance.now() - t0), cost: +(path.cost / (T[t].n + R.n)).toFixed(4), variant: path.variant || null, starts: [], ends: [], bas: null };
        for (let a = 1; a <= ayas; a++) { const b = R.bounds[a]; r.starts.push(+mapTime(path, b[0]).toFixed(2)); r.ends.push(+mapTime(path, b[1]).toFixed(2)); }
        if (R.bounds.bas) r.bas = [+mapTime(path, R.bounds.bas[0]).toFixed(2), +mapTime(path, R.bounds.bas[1]).toFixed(2)];
        res[t].refs.push(r);
      }
    }
    if (todo.includes('dossari')) {
      try { const j = await fetch(`https://www.mp3quran.net/api/v3/ayat_timing?surah=${s}&read=92`).then((r) => r.json()); res.dossari.official = j.filter((x) => x.ayah >= 1).sort((a, b) => a.ayah - b.ayah).map((x) => [x.start_time / 1000, x.end_time / 1000]); } catch (e) { res.dossari.official = null; }
    }
    for (const t of todo) await dbPut(KEY(t, s), res[t]);
    return 'ok';
  }
  const ST = { running: false, log: [], done: 0, todo: 0, cur: [], t0: 0, stop: false };
  /* conc : nombre de sourates traitées en même temps (téléchargement et décodage de l'une pendant le calcul de l'autre) */
  async function run(opts) {
    if (ST.running) return 'déjà en cours';
    const queue = opts.suras.slice(), targets = opts.targets || ['luhaidan'], refs = opts.refs || REFS, conc = opts.conc || 1;
    Object.assign(ST, { running: true, log: [], done: 0, todo: queue.length, t0: Date.now(), stop: false, cur: [] });
    const worker = async () => {
      while (queue.length && !ST.stop) {
        const s = queue.shift(); ST.cur.push(s);
        let r; try { r = await processSura(s, opts.ayas[s], targets, refs); } catch (e) { r = 'ERREUR ' + (e && e.message || e); }
        ST.log.push(s + ' ' + r + ' @' + Math.round((Date.now() - ST.t0) / 1000) + 's');
        ST.cur = ST.cur.filter((x) => x !== s); ST.done++;
      }
    };
    await Promise.all(Array.from({ length: conc }, worker));
    ST.running = false;
    return 'fini';
  }
  /* ---------- Choix des limites (pauses réelles) et contrôles ---------- */
  /* tight / tight0 : deux références sur trois qui tombent dans la même pause à moins de `tight` s l'une de
     l'autre confirment la limite même si la troisième s'est égarée. Mesuré sur Al-Dossari (export_timing.mjs
     --tune) : utile au début du verset 1 (tight0), où la 3e référence se trompe surtout à cause de ce qui
     précède la récitation ; ailleurs (tight) les erreurs de plus d'une seconde augmentent, donc 0. */
  const P0 = { cap: 1.5, sig: 0.3, tolIn: 0.15, agree: 0.5, virt: 6, wasl: 0.4, win: 3, maxDissent: 3, tight: 0, tight0: 0.25, lost: 3, lostTight: 0.5 };
  const strength = (p) => 1 - Math.exp(-((p[1] - p[0]) / 0.35) * (p[2] / 12));
  const median = (xs) => { const a = xs.slice().sort((x, y) => x - y); const m = a.length; return m % 2 ? a[(m - 1) / 2] : (a[m / 2 - 1] + a[m / 2]) / 2; };
  function choose(res, hasBas, P) {
    P = Object.assign({}, P0, P || {});
    const dist = (iv, t) => (t >= iv[0] - P.tolIn && t <= iv[1] + P.tolIn ? 0 : Math.min(Math.abs(t - iv[0]), Math.abs(t - iv[1])));
    const rho = (d) => { const x = Math.min(d, P.cap) / P.sig; return x * x; };
    const refs = res.refs.filter((r) => !r.err);
    if (refs.length < 2) return null;
    const n = refs[0].ends.length; const pz = res.pauses;
    const preds = [refs.map((r) => r.starts[0])];
    for (let k = 1; k < n; k++) preds.push(refs.map((r) => r.ends[k - 1]));
    const K = preds.length; const cands = [];
    // médianes rendues croissantes : la suite des candidats « enchaînés » reste toujours possible (pas d'impasse)
    const ms = preds.map(median); for (let k = 1; k < K; k++) ms[k] = Math.max(ms[k], ms[k - 1] + 0.1);
    for (let k = 0; k < K; k++) {
      const m = ms[k]; const cs = [];
      for (let i = 0; i < pz.length; i++) { const p = pz[i]; if (p[1] >= m - P.win && p[0] <= m + P.win) cs.push({ id: i, iv: [p[0], p[1]], st: strength(p) }); }
      if (k === 0) { const lead = pz.length && pz[0][0] <= 0.05 ? pz[0][1] : 0; cs.push({ id: -1, iv: [0, lead], st: 1 }); }
      cs.push({ id: 'v', iv: [m, m], st: 0 });
      cands.push(cs);
    }
    const best = [], back = [];
    for (let k = 0; k < K; k++) {
      best.push(new Float64Array(cands[k].length).fill(Infinity)); back.push(new Int32Array(cands[k].length).fill(-1));
      cands[k].forEach((c, ci) => {
        const own = preds[k].reduce((a, t) => a + rho(dist(c.iv, t)), 0) + 1.5 * (1 - c.st) + (c.id === 'v' ? P.virt : 0);
        if (k === 0) { best[k][ci] = own; return; }
        let bc = Infinity, bp = -1;
        cands[k - 1].forEach((pc, cj) => { if (c.iv[0] <= pc.iv[1] + 0.05) return; const v = best[k - 1][cj] + own; if (v < bc) { bc = v; bp = cj; } });
        best[k][ci] = bc; back[k][ci] = bp;
      });
    }
    let ci = -1, bv = Infinity; best[K - 1].forEach((v, i) => { if (v < bv) { bv = v; ci = i; } });
    if (ci < 0 || !isFinite(bv)) return null;
    const chosen = new Array(K);
    for (let k = K - 1; k >= 0; k--) { chosen[k] = cands[k][ci]; ci = back[k][ci]; }
    const bounds = chosen.map((c, k) => {
      const agree = preds[k].filter((t) => dist(c.iv, t) <= P.agree).length;
      const near = preds[k].filter((t) => Math.abs(t - c.iv[0]) <= P.wasl).length;
      const kind = c.id === 'v' ? 'enchaîné' : 'pause';
      const mid = (c.iv[0] + c.iv[1]) / 2;
      const dissent = Math.max(...preds[k].map((t) => Math.abs(t - mid)));
      const inP = preds[k].filter((t) => dist(c.iv, t) <= P.agree);
      const tight = inP.length === 2 && Math.abs(inP[0] - inP[1]) <= (k === 0 ? P.tight0 : P.tight);
      // confirmée : les trois voix tombent dans la pause, ou deux (la troisième à moins de 3 s, ou les deux d'accord à `tight` près)
      const ok = kind === 'pause' ? (agree >= 3 || (agree === 2 && (dissent <= P.maxDissent || tight))) : near >= 2;
      return { a: c.iv[0], b: c.iv[1], kind, agree, dissent: +dissent.toFixed(2), st: +c.st.toFixed(2), ok, preds: preds[k] };
    });
    /* Référence égarée sur toute une zone (loin, de plus de maxDissent, de la pause retenue sur au moins `lost`
       limites de suite) : elle ne fait plus douter des deux autres quand celles-ci s'accordent (à `lostTight` près).
       Un désaccord isolé, lui, garde la limite incertaine. */
    if (P.lost) {
      const far = bounds.map((b) => { const mid = (b.a + b.b) / 2; return b.preds.map((t) => Math.abs(t - mid) > P.maxDissent); });
      for (let k = 0; k < K; k++) {
        const b = bounds[k]; if (b.ok || b.kind !== 'pause' || b.agree !== 2) continue;
        const nf = far[k].filter(Boolean).length; if (nf !== 1) continue;
        const j = far[k].indexOf(true);
        const others = b.preds.filter((_, i) => i !== j); if (Math.abs(others[0] - others[1]) > P.lostTight) continue;
        let run = 1; for (let q = k - 1; q >= 0 && far[q][j]; q--) run++; for (let q = k + 1; q < K && far[q][j]; q++) run++;
        if (run >= P.lost) { b.ok = true; b.lost = j; }
      }
    }
    // basmala : de la reprise de voix qui précède la basmala prédite jusqu'à la pause avant le verset 1
    let bas = null;
    if (hasBas) {
      const bp = refs.map((r) => r.bas).filter(Boolean);
      if (bp.length) {
        const b0 = median(bp.map((x) => x[0])); const end = bounds[0].a;
        const on = pz.filter((p) => p[1] <= b0 + 0.3 && p[1] < end - 1.0).map((p) => p[1]);
        const start = on.length ? Math.max(...on) : 0;
        if (end - start >= 1.0) bas = [start, end];
      }
    }
    // fin du dernier verset : début du silence final s'il dure au moins 1 s
    const last = pz.length ? pz[pz.length - 1] : null;
    const endLast = last && last[1] >= res.dur - 0.1 && last[1] - last[0] >= 1 && last[0] > bounds[K - 1].b ? last[0] : res.dur;
    return { n, bounds, bas, endLast };
  }
  function toApp(ch) {
    const v = [];
    for (let k = 0; k < ch.n; k++) { const st = ch.bounds[k].b; const en = k + 1 < ch.n ? ch.bounds[k + 1].a : ch.endLast; v.push([Math.round(st * 1000), Math.round(en * 1000)]); }
    return v;
  }
  /* Validation : nos limites comparées aux repères publiés d'Al-Dossari */
  /* get : lecture d'un résultat brut (par défaut IndexedDB de l'onglet ; hors navigateur, un fichier d'archive) */
  async function validate(P, list, get) {
    get = get || dbGet;
    const errs = [], conf = [], per = {}; let usable = 0, nb = 0, nconf = 0, isol = 0, verses = 0; const startErr = [];
    for (const s of list) {
      const res = await get(KEY('dossari', s)); if (!res || !res.official) continue;
      const ch = Z.choose(res, s !== 1 && s !== 9, P); if (!ch) { per[s] = 'aucune'; continue; }
      if (res.official.length !== ch.n) { per[s] = 'versets?'; continue; }
      const u = []; for (let k = 1; k < ch.n; k++) if (!ch.bounds[k].ok) u.push(k);
      const ok = ch.bounds[0].ok && u.length <= 0.5 * Math.max(1, ch.n - 1);
      const t1 = res.official[0][0], b0 = ch.bounds[0];
      const e1 = t1 >= b0.a - 0.05 && t1 <= b0.b + 0.35 ? 0 : Math.min(Math.abs(t1 - b0.a), Math.abs(t1 - b0.b));
      if (ok) { usable++; startErr.push(e1); }
      const se = [];
      for (let k = 1; k < ch.n; k++) {
        const t = res.official[k - 1][1]; const b = ch.bounds[k];
        const e = t >= b.a - 0.05 && t <= b.b + 0.05 ? 0 : Math.min(Math.abs(t - b.a), Math.abs(t - b.b));
        errs.push(e); se.push(e);
        if (ok) { nb++; if (b.ok) { nconf++; conf.push(e); } }
      }
      if (ok) for (let a = 1; a <= ch.n; a++) { verses++; if ((a === 1 ? ch.bounds[0].ok : ch.bounds[a - 1].ok) && (a === ch.n || ch.bounds[a].ok)) isol++; }
      per[s] = [ok ? 1 : 0, ch.n, u.length, +e1.toFixed(2), +Math.max(0, ...se).toFixed(2)];
    }
    const pct = (xs, th) => (xs.length ? +(100 * xs.filter((e) => e <= th).length / xs.length).toFixed(1) : null);
    return {
      reference: 'Yasser Al-Dossari, repères publiés par MP3Quran (read=92) — utilisés uniquement pour mesurer',
      sourates: Object.keys(per).length, utilisables: usable,
      limites: errs.length, toutes_300ms: pct(errs, 0.3), toutes_500ms: pct(errs, 0.5),
      limites_des_sourates_utilisables: nb, confirmees: nconf,
      confirmees_300ms: pct(conf, 0.3), confirmees_500ms: pct(conf, 0.5), confirmees_1s: pct(conf, 1),
      versets_isolables: isol + '/' + verses, debut_v1_500ms: pct(startErr, 0.5),
      per,
    };
  }
  /* Export pour l'appli : une limite non confirmée n'est jamais présentée comme sûre — les deux versets qu'elle
     sépare sont surlignés ensemble (u = rangs des limites incertaines). Sourate utilisable si le début du
     verset 1 est confirmé et si au moins la moitié des limites le sont. */
  async function exportApp(t, P, list, get) {
    get = get || dbGet;
    const out = {};
    for (const s of list) {
      const res = await get(KEY(t, s)); if (!res) continue;
      const ch = Z.choose(res, s !== 1 && s !== 9, P);
      if (!ch) { out[s] = { bytes: res.bytes, dur: res.dur, ok: false, why: 'aucune solution' }; continue; }
      const u = []; for (let k = 1; k < ch.n; k++) if (!ch.bounds[k].ok) u.push(k);
      const ok = ch.bounds[0].ok && u.length <= 0.5 * Math.max(1, ch.n - 1);
      out[s] = { bytes: res.bytes, dur: +res.dur.toFixed(3), ok, v: toApp(ch), intro: ch.bas ? [Math.round(ch.bas[0] * 1000), Math.round(ch.bas[1] * 1000)] : null, u, start: ch.bounds[0].ok };
    }
    return out;
  }
  function status() { return { running: ST.running, cur: ST.cur.slice(), done: ST.done, todo: ST.todo, min: Math.round((Date.now() - ST.t0) / 60000), last: ST.log.slice(-6) }; }
  async function results(t, list) { const o = {}; for (const s of list) { const v = await dbGet(KEY(t, s)); if (v) o[s] = v; } return o; }
  async function done(t) { const o = []; for (let s = 1; s <= 114; s++) if (await dbGet(KEY(t, s))) o.push(s); return o; }
  Object.assign(Z, { dtwWin, refine, align1, align, choose, pauses, down, mapTime, toApp, K: { D, FPS, RADIUS, MAX_CELLS, C0, EDGE_S } });
  const W = typeof window !== 'undefined' ? window : globalThis;   // aussi chargeable hors navigateur (Node) pour l'export
  W.ALNZ = Z;
  W.ALN = { run, status, results, done, stop: () => { ST.stop = true; }, version: 7, P0, REFS, TARGETS, loadTarget, loadRef, align, mapTime, pauses, choose, validate, exportApp, dbGet, dbDel, MEM };
})();
'ALN prêt';
