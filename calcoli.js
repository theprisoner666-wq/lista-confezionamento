// Lista confezionamento - regole di calcolo, le stesse del database Access.
// Qui non c'e' nessun dato del fornitore: tabelle e impostazioni arrivano da Firebase
// (o dal browser in modalita' prova).

export const norm = v => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(Math.round(v) === v ? v : v) : "";
  return String(v).trim().toUpperCase();
};
export const numero = v => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// ---------------------------------------------------------------- buste e contenitori

// 9380 a 10 -> "938"; 149 a 5 -> "29*5+1*4"
export function contaConf(pezzi, pz) {
  const p = numero(pezzi), z = numero(pz);
  if (!p || !z || p <= 0 || z <= 0) return "";
  const n = Math.floor(p / z), r = p % z;
  if (r === 0) return String(n);
  if (n === 0) return `1*${r}`;
  return `${n}*${z}+1*${r}`;
}

// 9380 a 2500 -> "3*2500+1*1880"; 9999 e 99999 = quantita' libera -> "1"
export const LIBERA = q => q === null || q <= 0 || q === 9999 || q === 99999;
export function contaCont(pezzi, qc) {
  const p = numero(pezzi), z = numero(qc);
  if (!p || p <= 0) return "";
  if (z === null) return "";
  if (LIBERA(z)) return "1";
  const n = Math.floor(p / z), r = p % z;
  if (r === 0) return String(n);
  if (n === 0) return "1";
  return `${n}*${z}+1*${r}`;
}

// ---------------------------------------------------------------- periodo

const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daIso = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// RITARDO, URGENTE, B.O. oppure una data: 23/10, 23-10-2026, 23-ott, 23 ottobre
export function normalizzaPeriodo(v, oggi = new Date()) {
  const s = norm(v);
  if (!s) return "";
  if (["R", "RIT", "RITARDO", "PAST DUE"].includes(s)) return "RITARDO";
  if (["U", "URG", "URGENTE"].includes(s)) return "URGENTE";
  if (["BO", "B.O", "B.O.", "B O", "BACK ORDER"].includes(s)) return "B.O.";
  if (ISO.test(s)) return s;
  const m = s.match(/^(\d{1,2})\s*[\/\-. ]\s*(\d{1,2}|[A-Z]{3})[A-Z]*(?:\s*[\/\-. ]\s*(\d{2}|\d{4}))?$/);
  if (!m) return s;
  const g = +m[1];
  const mese = /\d/.test(m[2]) ? +m[2] - 1 : MESI.indexOf(m[2].slice(0, 3).toLowerCase());
  const anno = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : oggi.getFullYear();
  if (mese < 0 || mese > 11) return s;
  const d = new Date(anno, mese, g);
  if (d.getDate() !== g) return s;
  // una data senza anno scritta a dicembre per gennaio va all'anno dopo
  if (!m[3] && d < new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() - 180)) d.setFullYear(anno + 1);
  return iso(d);
}

export function periodoOrdine(p) {
  if (p === "RITARDO") return 1;
  if (p === "URGENTE") return 2;
  if (p === "B.O.") return 3;
  if (ISO.test(p || "")) return 100 + daIso(p).getTime() / 864e5;
  return 9e12;
}

export function periodoTesto(p) {
  if (ISO.test(p || "")) { const d = daIso(p); return `${String(d.getDate()).padStart(2, "0")}-${MESI[d.getMonth()]}`; }
  return p || "";
}

// ---------------------------------------------------------------- tabelle

// Legge un foglio (righe come array) e riconosce se e' CONFEZIONAMENTI o TRANSCODIFICHE dalle intestazioni.
export function leggiTabella(righe) {
  const testa = (righe[0] || []).map(h => norm(h));
  const col = n => testa.indexOf(n);
  const CONF = ["PARTNBR", "SHORT_DESCRI", "COCONF", "QTACON", "OSSIDO", "TIPOCONT", "QTACONT"];
  if (CONF.every(n => col(n) >= 0)) {
    const ix = CONF.map(col), out = [];
    for (let i = 1; i < righe.length; i++) {
      const r = righe[i] || [], pn = norm(r[ix[0]]);
      if (!pn) continue;
      out.push([pn, norm(r[ix[1]]).replace(/\s+/g, " ").slice(0, 60), norm(r[ix[2]]), numero(r[ix[3]]),
                norm(r[ix[4]]), norm(r[ix[5]]), numero(r[ix[6]])]);
    }
    return { tipo: "confezionamenti", righe: out };
  }
  // transcodifiche: una colonna che comincia con PN (codice del cliente) e una con COD (codice del fornitore)
  const a = testa.findIndex(h => /^PN\b/.test(h)), b = testa.findIndex(h => /^COD/.test(h));
  if (a >= 0 && b >= 0) {
    const visti = new Set(), out = [];
    for (let i = 1; i < righe.length; i++) {
      const r = righe[i] || [], pn = norm(r[a]), vgv = norm(r[b]);
      if (!pn || !vgv || visti.has(pn + "|" + vgv)) continue;
      visti.add(pn + "|" + vgv);
      out.push([pn, vgv]);
    }
    return { tipo: "transcodifiche", righe: out };
  }
  return { tipo: null, mancano: CONF.filter(n => col(n) < 0) };
}

// Impostazioni scritte a righe: "vecchia = nuova", "vecchio = nuovo - 9999", "codice", "parola = sigla".
// Quello che segue un # e' una nota.
const righeTesto = t => String(t || "").split(/\r?\n/).map(r => r.replace(/#.*$/, "").trim()).filter(Boolean);
export function leggiImpostazioni(imp) {
  const coppie = t => righeTesto(t).map(r => r.split("=").map(x => norm(x))).filter(x => x.length === 2 && x[0] && x[1]);
  const sostCont = new Map();
  for (const [v, n] of coppie(imp?.sostContenitori)) {
    const [c, q] = n.split("-").map(x => x.trim());
    sostCont.set(v, { cont: c, qta: numero(q) ?? 9999 });
  }
  return {
    intestazione: String(imp?.intestazione || "").trim(),
    sostBuste: new Map(coppie(imp?.sostBuste)),
    sostCont,
    validi: new Set(righeTesto(imp?.contenitoriValidi).map(r => norm(r.split("=")[0]))),
    abbreviazioni: coppie(imp?.abbreviazioni),
    scelte: righeTesto(imp?.contenitoriValidi).map(r => norm(r.split("=")[0])),
  };
}

export function preparaTabelle(conf, trans) {
  const C = new Map(), doppi = new Set();
  for (const r of conf || []) { if (C.has(r[0])) doppi.add(r[0]); else C.set(r[0], r); }
  const T = new Map();
  for (const [pn, vgv] of trans || []) { if (!T.has(vgv)) T.set(vgv, []); if (!T.get(vgv).includes(pn)) T.get(vgv).push(pn); }
  for (const l of T.values()) l.sort();
  return { C, T, doppi: [...doppi] };
}

// I valori del file con buste e contenitori gia' sostituiti. tipocont null = da scegliere.
export function confAttuale(pn, ctx) {
  const r = ctx.tab.C.get(norm(pn));
  if (!r) return null;
  const [, descr, coconf, qtacon, ossido, tipocont, qtacont] = r;
  const k = ctx.imp.sostCont.get(tipocont);
  let tc = null, qc = null;
  if (k) { tc = k.cont; qc = k.qta; }
  else if (ctx.imp.validi.has(tipocont)) { tc = tipocont; qc = qtacont; }
  return {
    descr, qtacon, ossido,
    coconf: ctx.imp.sostBuste.get(coconf) || coconf, coconfFile: coconf,
    tipocont: tc, qtacont: qc, tipocontFile: tipocont,
  };
}

// TIPO: prima parola della descrizione, salvo le parole delle abbreviazioni (una parola -> la sua sigla)
export function tipoDa(descr, imp) {
  const s = " " + norm(descr).replace(/\s+/g, " ") + " ";
  if (!s.trim()) return "";
  for (const [parola, tipo] of imp.abbreviazioni) if (s.includes(" " + parola + " ")) return tipo;
  return s.trim().split(" ")[0];
}

// ---------------------------------------------------------------- una riga

export function calcola(r, ctx) {
  const vgv = norm(r.vgv), pn = norm(r.pn), scelto = norm(r.cont);
  const possibili = vgv ? (ctx.tab.T.get(vgv) || []) : [];
  const out = { vgv, pn, possibili, info: null, tipo: "", coconf: "", qtacon: null, totconf: "", oss: "",
                contq: "", nrcont: "", stato: "", livello: "" };
  if (!pn) {
    if (!vgv) return out;
    if (possibili.length > 1) { out.stato = "SCEGLI P.N."; out.livello = "scegli"; }
    else if (possibili.length === 0) { out.stato = "NON IN TRANSCODIFICHE"; out.livello = "errore"; }
    return out;
  }
  const info = confAttuale(pn, ctx);
  out.info = info;
  out.tipo = norm(r.tipo) || (info ? tipoDa(info.descr, ctx.imp) : "");
  if (!info) { out.stato = "NON IN CONFEZIONAMENTI"; out.livello = "errore"; return out; }
  out.coconf = info.coconf;
  out.qtacon = info.qtacon;
  out.totconf = contaConf(r.pezzi, info.qtacon);
  out.oss = info.ossido === "C" ? "OSSIDO" : "";
  let tc = info.tipocont, qc = info.qtacont;
  if (scelto) { tc = scelto; qc = numero(r.contQta) ?? 9999; }
  out.contq = tc ? `${tc} - ${qc ?? ""}` : "";
  out.nrcont = tc ? contaCont(r.pezzi, qc) : "";
  const note = [];
  if (info.coconf !== info.coconfFile) note.push(`busta ${info.coconfFile} > ${info.coconf}`);
  if (scelto) note.push(`cont. ${info.tipocontFile || "-"} > ${scelto} (scelto)`);
  else if (!info.tipocont) { out.stato = `SCEGLI CONTENITORE (file: ${info.tipocontFile || "-"})`; out.livello = "scegli"; return out; }
  else if (info.tipocont !== info.tipocontFile) note.push(`cont. ${info.tipocontFile} > ${info.tipocont}`);
  out.stato = note.join("; ");
  out.livello = note.length ? "nota" : "";
  return out;
}

// ---------------------------------------------------------------- la lista

// Un blocco per DDT, nell'ordine in cui compaiono; dentro: RITARDO, URGENTE, B.O., date; poi l'ordine del DDT.
// DDT e periodo solo sulla prima riga del gruppo, riga vuota prima di ogni DDT dopo il primo.
export function lista(righe, ctx) {
  const primo = new Map();
  righe.forEach((r, i) => { const k = norm(r.ddt); if (!primo.has(k)) primo.set(k, i); });
  const el = righe.map((r, i) => ({ r, i, c: calcola(r, ctx) })).filter(x => x.c.pn);
  el.sort((a, b) => (primo.get(norm(a.r.ddt)) - primo.get(norm(b.r.ddt)))
                 || (periodoOrdine(a.r.periodo) - periodoOrdine(b.r.periodo)) || (a.i - b.i));
  const out = [];
  let ddt = null, per = null;
  for (const x of el) {
    const d = norm(x.r.ddt), p = periodoTesto(x.r.periodo);
    const nuovoDdt = d !== ddt;
    if (nuovoDdt && ddt !== null) out.push(null);
    out.push({
      ddt: nuovoDdt ? d : "", periodo: (nuovoDdt || p !== per) ? p : "",
      tipo: x.c.tipo, pn: x.c.pn, pezzi: numero(x.r.pezzi), coconf: x.c.coconf, qtacon: x.c.qtacon,
      totconf: x.c.totconf, oss: x.c.oss, contq: x.c.contq, nrcont: x.c.nrcont,
    });
    ddt = d; per = p;
  }
  return out;
}

export const ddtDella = righe => [...new Set(righe.filter(r => norm(r.pn) || norm(r.vgv)).map(r => norm(r.ddt)).filter(Boolean))];
