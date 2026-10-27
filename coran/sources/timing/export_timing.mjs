#!/usr/bin/env node
/* Repères par verset de Mohamed Al-Luhaidan pour l'appli, à partir des résultats bruts de align_dtw.js.

   Les résultats bruts (positions prédites par chaque référence + pauses détectées, pour chaque fichier exact)
   sont archivés dans dtw-*.json.gz. Ce script recharge align_dtw.js hors navigateur et applique exactement
   le même choix des limites (choose) :
     1. validation sur Yasser Al-Dossari, dont MP3Quran publie les repères (jamais utilisés pour Al-Luhaidan) ;
     2. export de coran/data/timing/luhaidan.json (format 1 : v = [début, fin] en ms par verset,
        u = limites non confirmées, intro = basmala, bytes = taille du fichier exact).

   Usage : node export_timing.mjs dtw-a.json.gz [dtw-b.json.gz …] [--tune] */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';
import zlib from 'node:zlib';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..', '..');
const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith('--'));
const TUNE = args.includes('--tune');

const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here, 'align_dtw.js'), 'utf8'), ctx);
const { ALN, ALNZ } = ctx;

const raw = {};
for (const f of files) Object.assign(raw, JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString('utf8')));
const get = async (k) => raw[k] || null;
const listOf = (t) => Object.keys(raw).filter((k) => k.startsWith(t + ':')).map((k) => Number(k.split(':')[1])).sort((a, b) => a - b);
const ayas = (s) => JSON.parse(fs.readFileSync(path.join(ROOT, 'coran', 'data', 's', String(s).padStart(3, '0') + '.json'), 'utf8')).ar.length;

/* Règle retenue : 3 références sur 3 dans la même pause, ou 2 sur 3 avec la 3e à moins de 3 s ; début du
   verset 1 : 2 sur 3 d'accord à 0,25 s près suffisent ; une référence égarée sur au moins 3 limites de suite ne
   fait plus douter des deux autres. Comparaison (--tune) sur les repères publiés d'Al-Dossari : accepter partout
   « 2 sur 3 d'accord à 0,25 s près » confirme 4 % de limites en plus mais fait passer les écarts de plus d'une
   seconde de 0,8 % à 1,2 % : refusé ; la règle « référence égarée » ajoute 21 limites dont 20 exactes. */
const RULE = { maxDissent: 3, tight: 0, tight0: 0.25, lost: 3, lostTight: 0.5 };

async function bigErrors(P, list) {
  // limites confirmées dont l'écart aux repères publiés dépasse 1 s (les seules qui gêneraient le suivi)
  const out = [];
  for (const s of list) {
    const res = raw['dossari:' + s]; if (!res || !res.official) continue;
    const ch = ALNZ.choose(res, s !== 1 && s !== 9, P); if (!ch || res.official.length !== ch.n) continue;
    for (let k = 1; k < ch.n; k++) {
      const b = ch.bounds[k]; if (!b.ok) continue;
      const t = res.official[k - 1][1];
      const e = t >= b.a - 0.05 && t <= b.b + 0.05 ? 0 : Math.min(Math.abs(t - b.a), Math.abs(t - b.b));
      if (e > 1) out.push(`${s}:${k}=${e.toFixed(1)}s`);
    }
  }
  return out;
}

const dos = listOf('dossari');
const luh = listOf('luhaidan');
console.log(`résultats bruts : Al-Dossari ${dos.length} sourates, Al-Luhaidan ${luh.length} sourates`);

if (TUNE) {
  const rows = [];
  for (const P of [{ tight0: 0, lost: 0 }, { tight0: 0.25, lost: 0 }, { tight: 0.25, tight0: 0.25, lost: 0 }, { lost: 2 }, { lost: 3 }, { lost: 4 }, { lost: 6 }, { lost: 3, lostTight: 0.25 }]) {
    const v = await ALN.validate(P, dos, get); const big = await bigErrors(P, dos);
    const ex = await ALN.exportApp('luhaidan', P, luh, get);
    const lok = Object.values(ex).filter((e) => e.ok); const lu = lok.reduce((a, e) => a + e.u.length, 0); const lb = lok.reduce((a, e) => a + e.v.length - 1, 0);
    rows.push({ P: JSON.stringify(P), D_utilisables: v.utilisables + '/' + v.sourates, D_confirmees: v.confirmees + '/' + v.limites_des_sourates_utilisables, D_300: v.confirmees_300ms, D_500: v.confirmees_500ms, D_1s: v.confirmees_1s, D_plus1s: big.length, L_ok: lok.length + '/' + luh.length, L_incertaines: lu + '/' + lb });
  }
  console.table(rows);
}

const val = await ALN.validate(RULE, dos, get);
const big = await bigErrors(RULE, dos);
const ex = await ALN.exportApp('luhaidan', RULE, luh, get);

// contrôles supplémentaires sur chaque sourate exportée
const controls = { checked: 0, rejected: {} };
for (const [s, e] of Object.entries(ex)) {
  const n = Number(s);
  if (!e.ok) continue;
  controls.checked++;
  const why = [];
  if (e.v.length !== ayas(n)) why.push('nombre de versets');
  for (let k = 0; k < e.v.length; k++) {
    const [a, b] = e.v[k];
    if (!(b > a)) why.push(`verset ${k + 1} vide`);
    if (k && a < e.v[k - 1][1]) why.push(`versets ${k} et ${k + 1} se chevauchent`);
  }
  if (e.v[e.v.length - 1][1] > e.dur * 1000 + 50) why.push('fin après le fichier');
  // basmala (sourates autres que 1 et 9) : présente dans ces fichiers, entre 1,2 et 8 s, juste avant le verset 1
  if (n !== 1 && n !== 9) {
    if (!e.intro) why.push('basmala non repérée');
    else { const d = (e.intro[1] - e.intro[0]) / 1000; if (d < 1.2 || d > 8 || e.intro[1] > e.v[0][0]) why.push(`basmala ${d.toFixed(1)} s`); }
  }
  if (why.length) { e.ok = false; e.why = why.slice(0, 3).join(', '); controls.rejected[s] = e.why; }
}

const okS = Object.entries(ex).filter(([, e]) => e.ok);
const verses = okS.reduce((a, [, e]) => a + e.v.length, 0);
let isolable = 0;
for (const [, e] of okS) { const u = new Set(e.u); for (let a = 1; a <= e.v.length; a++) if (!u.has(a - 1) && !u.has(a)) isolable++; }
const out = {
  format: 1,
  reciter: 'luhaidan',
  file_base: 'https://cdn.mp3quran.net/audio/muhammad-luhaidan/r1/',
  generated: new Date().toISOString().slice(0, 10),
  method: 'Alignement audio sur audio (MFCC + énergie, DTW multi-échelle) du fichier exact avec trois récitations découpées verset par verset (EveryAyah : Saoud Al-Shuraim, Abdurrahman As-Sudais, Maher Al-Muaiqly) ; chaque limite est placée dans une pause réelle du fichier et n’est confirmée que si les références concordent. Limite non confirmée : les deux versets sont surlignés ensemble, jamais séparés.',
  rule: RULE,
  validation: {
    reference: 'Yasser Al-Dossari (MP3Quran, read=92) : mêmes calculs, comparés à ses repères publiés',
    suras: val.sourates, usable_suras: val.utilisables,
    boundaries: val.limites_des_sourates_utilisables, confirmed: val.confirmees,
    confirmed_within_300ms_pct: val.confirmees_300ms, confirmed_within_500ms_pct: val.confirmees_500ms, confirmed_within_1s_pct: val.confirmees_1s,
    confirmed_over_1s: big.length, all_within_300ms_pct: val.toutes_300ms, verse1_start_within_500ms_pct: val.debut_v1_500ms,
  },
  coverage: { suras_with_verse_sync: okS.length, suras_total: 114, verses: verses, verses_isolable: isolable, word_level_pct: 0 },
  controls,
  s: {},
};
for (const [s, e] of Object.entries(ex)) {
  out.s[s] = e.ok ? { bytes: e.bytes, dur: e.dur, ok: true, v: e.v, intro: e.intro, u: e.u } : { bytes: e.bytes, dur: e.dur, ok: false, why: e.why || 'limites trop incertaines' };
}
const dest = path.join(ROOT, 'coran', 'data', 'timing', 'luhaidan.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log('validation Al-Dossari :', JSON.stringify(out.validation));
console.log('erreurs > 1 s parmi les limites confirmées :', big.join(' ') || 'aucune');
console.log('couverture Al-Luhaidan :', JSON.stringify(out.coverage));
console.log('refusées par les contrôles :', JSON.stringify(controls.rejected));
console.log('non utilisables :', Object.entries(ex).filter(([, e]) => !e.ok).map(([s]) => s).join(' ') || 'aucune');
console.log('écrit :', path.relative(ROOT, dest), fs.statSync(dest).size, 'octets');
