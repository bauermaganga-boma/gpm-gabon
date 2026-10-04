/* GPM · Espace de gestion — module « Terminal & conteneurs »
   Parc à conteneurs (carte des blocs, occupation instantanée en EVP), cadences des grues mobiles portuaires,
   recherche de conteneurs, entrées / sorties au gate, magasin cale et parc véhicules, alertes de stationnement
   (> 10 jours) avec création des prestations de magasinage. Données de démonstration (conteneurs fictifs). */
(function () {
  'use strict';
  var E = window.ERP; if (!E) return;
  var U = E.ui, F = E.fmt, S = E.store, esc = E.esc, sum = E.sum;

  /* ------------------------------------------------------------------ référentiels */
  /* Parc d'Owendo : 11,2 ha et 130 000 EVP/an de capacité de traitement (chiffres publiés par le groupe Portek).
     Le découpage en blocs ci-dessous et sa capacité de stockage sont des HYPOTHÈSES DE DÉMONSTRATION. */
  var BLOCS = [
    { id: 'A', site: 'OWE', nom: 'Bloc A', usage: 'Frigorifiques (prises reefer)', rows: 2, bays: 3, tiers: 2 },
    { id: 'B', site: 'OWE', nom: 'Bloc B', usage: 'Import pleins', rows: 3, bays: 5, tiers: 3 },
    { id: 'C', site: 'OWE', nom: 'Bloc C', usage: 'Import pleins', rows: 2, bays: 4, tiers: 3 },
    { id: 'D', site: 'OWE', nom: 'Bloc D', usage: 'Export — à embarquer', rows: 2, bays: 4, tiers: 3 },
    { id: 'E', site: 'OWE', nom: 'Bloc E', usage: 'Conteneurs vides', rows: 2, bays: 4, tiers: 4 },
    { id: 'F', site: 'OWE', nom: 'Bloc F', usage: 'Transbordement', rows: 1, bays: 4, tiers: 3 },
    { id: 'P1', site: 'POG', nom: 'Bloc P1', usage: 'Pleins import / export', rows: 2, bays: 4, tiers: 3 },
    { id: 'P2', site: 'POG', nom: 'Bloc P2', usage: 'Conteneurs vides', rows: 2, bays: 3, tiers: 3 }
  ];
  var EVP_SLOT = 1.6; /* hypothèse de démonstration : 1,6 EVP par emplacement (mix 20'/40') */
  var SITE_INFO = { OWE: { ha: 11.2, annuel: 130000, magasin: 4000, vehicules: 12000 }, POG: { ha: null, annuel: null, magasin: 1500, vehicules: 3000 } };
  var FRANCHISE = 10; /* jours de stationnement inclus avant magasinage */
  /* Tarifs FICTIFS de démonstration (magasinage au-delà de la franchise) — à remplacer par le tarif officiel. */
  var TARIFS = { j20: 6500, j40: 13000, reeferJour: 18000 };
  var M2_VEHICULE = 15; /* surface moyenne par véhicule, circulations comprises (hypothèse) */
  var OBJ_MIN = 25, OBJ_MAX = 30; /* cadence objectif, mouvements par heure et par grue */
  var PREFIX = { 'C-01': 'ATLU', 'C-02': 'GGSU', 'C-03': 'EQMU', 'C-04': 'RRAU', 'C-05': 'OSGU', 'C-06': 'CLSU', 'C-07': 'TOLU', 'C-08': 'WATU' };
  var ST_TONE = { 'Sur parc': 'blue', 'À embarquer': 'orange', 'Sorti': 'grey' };
  var SENS_COL = { 'Import': '#2563eb', 'Export': '#e8780c', 'Transbordement': '#7c3aed' };

  /* ------------------------------------------------------------------ utilitaires */
  function pad(n) { return String(n).padStart(2, '0'); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function isoDT(d) { return E.iso(d) + 'T' + hm(d); }
  function nowISO() { return isoDT(new Date()); }
  function dt(day, h, m) { var d = new Date(E.TODAY); d.setDate(d.getDate() + day); d.setHours(h || 0, m || 0, 0, 0); return isoDT(d); }
  function fdt(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + ' ' + s.slice(11, 16) : '—'; }
  function user() { var u = E.session.user(); return u ? u.name : 'Système'; }
  function clientNom(id) { var c = S.get('clients', id); return c ? c.nom : id || '—'; }
  function navire(id) { var e = S.get('escales', id); return e ? e.navire : id || '—'; }
  function siteCourt(id) { return id === 'POG' ? 'Port-Gentil' : 'Owendo'; }
  function evp(c) { return +c.taille === 40 ? 2 : 1; }
  function jours(c) { return Math.max(0, E.daysBetween(String(c.entree).slice(0, 10), c.statut === 'Sorti' && c.sortie ? String(c.sortie).slice(0, 10) : E.today())); }
  function bloc(id) { return BLOCS.find(function (b) { return b.id === id; }); }
  function slots(b) { return b.rows * b.bays * b.tiers; }
  function capEVP(b) { return Math.round(slots(b) * EVP_SLOT); }
  function fmtLoc(b, r, t, n) { return b + '-' + pad(r) + '-' + pad(t) + '-' + n; }
  function parseLoc(s) { var p = String(s || '').split('-'); return { b: p[0], r: +p[1], t: +p[2], n: +p[3] }; }
  function isoTxt(id) { return String(id).slice(0, 4) + ' ' + String(id).slice(4, 10) + '-' + String(id).slice(10); }
  /* Chiffre de contrôle ISO 6346 */
  var LV = {}; (function () { var v = 10; 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(function (ch) { if (v % 11 === 0) v++; LV[ch] = v; v++; }); })();
  function checkDigit(s10) { var t = 0; for (var i = 0; i < 10; i++) { var ch = s10[i]; t += (/\d/.test(ch) ? +ch : LV[ch]) * Math.pow(2, i); } return t % 11 % 10; }
  function isoValide(id) { id = String(id || '').toUpperCase().replace(/[\s-]/g, ''); return /^[A-Z]{3}[UJZ]\d{7}$/.test(id) && checkDigit(id.slice(0, 10)) === +id[10]; }
  function makeIso(prefix, serial) { var s = prefix + String(serial).padStart(6, '0'); return s + checkDigit(s); }

  /* ------------------------------------------------------------------ calculs */
  function ctns() { return S.all('conteneurs'); }
  function siteCtns() { return ctns().filter(function (c) { return c.site === state.site; }); }
  function onPark(list) { return (list || ctns()).filter(function (c) { return c.statut !== 'Sorti'; }); }
  function blocCtns(b) { return onPark().filter(function (c) { return c.bloc === b.id; }); }
  function blocFill(b) { var l = blocCtns(b), e = sum(l, evp); return { n: l.length, evp: e, cap: capEVP(b), pct: Math.min(100, e / capEVP(b) * 100) }; }
  function siteFill(site) { var bs = BLOCS.filter(function (b) { return b.site === site; }), e = sum(onPark().filter(function (c) { return c.site === site; }), evp), cap = sum(bs, capEVP); return { evp: e, cap: cap, pct: cap ? e / cap * 100 : 0 }; }
  function aFacturer(c) { return Math.max(0, jours(c) - FRANCHISE - (c.magJours || 0)); }
  function alertes(site) { return onPark().filter(function (c) { return (!site || c.site === site) && jours(c) > FRANCHISE; }).sort(function (a, b) { return jours(b) - jours(a); }); }
  function fillColor(p) { return p >= 90 ? '#d93636' : p >= 75 ? '#e8780c' : p >= 50 ? '#f2b705' : p > 0 ? '#1e9e4a' : '#cbd5e1'; }
  function stacks(b) {
    var m = {}; blocCtns(b).forEach(function (c) { var l = parseLoc(c.emplacement), k = l.r + '-' + l.t; (m[k] = m[k] || []).push(c); });
    Object.keys(m).forEach(function (k) { m[k].sort(function (x, y) { return parseLoc(x.emplacement).n - parseLoc(y.emplacement).n; }); });
    return m;
  }
  /* Premier emplacement libre (haut de pile) dans un bloc */
  function freeSlot(bid) {
    var b = bloc(bid); if (!b) return null; var st = stacks(b), best = null;
    for (var r = 1; r <= b.rows; r++) for (var t = 1; t <= b.bays; t++) {
      var l = st[r + '-' + t] || [], top = l.length ? parseLoc(l[l.length - 1].emplacement).n : 0;
      if (top < b.tiers && (!best || top < best.top)) best = { r: r, t: t, top: top };
    }
    return best ? fmtLoc(b.id, best.r, best.t, best.top + 1) : null;
  }
  function blocPour(c) {
    var site = c.site, pref = c.type === 'REEFER' ? ['A'] : c.etat === 'Vide' ? ['E'] : c.sens === 'Transbordement' ? ['F'] : c.sens === 'Export' ? ['D'] : ['B', 'C'];
    if (site === 'POG') pref = c.etat === 'Vide' ? ['P2', 'P1'] : ['P1', 'P2'];
    var all = pref.concat(BLOCS.filter(function (b) { return b.site === site && pref.indexOf(b.id) < 0; }).map(function (b) { return b.id; }));
    for (var i = 0; i < all.length; i++) { var s = freeSlot(all[i]); if (s) return s; }
    return null;
  }
  function addMvt(m) { m.id = m.id || 'MVT-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase(); m.user = m.user || user(); S.all('mouvementsTerminal').unshift(m); S.save(); return m; }
  function cad() { return S.all('cadencesGrues'); }

  /* ------------------------------------------------------------------ données d'exemple */
  function seed() {
    var n = 20260417; function rnd() { n = (n * 16807) % 2147483647; return (n - 1) / 2147483646; }
    function pick(a) { return a[Math.floor(rnd() * a.length)]; }
    var out = [], mv = [], used = {};
    /* site, nb, sens, état, escale, client, blocs, jour d'entrée min/max, nb sortis, types */
    var G = [
      ['OWE', 24, 'Import', 'Plein', 'ESC-2026-0412', 'C-01', ['B'], -1, 0, 3, ['DRY', 'DRY', 'DRY', 'DRY', 'OPEN TOP']],
      ['OWE', 12, 'Import', 'Plein', 'ESC-2026-0407', 'C-01', ['C'], -7, -7, 5, ['DRY']],
      ['OWE', 9, 'Import', 'Plein', 'ESC-2026-0404', 'C-01', ['B'], -13, -13, 3, ['DRY', 'OPEN TOP']],
      ['OWE', 7, 'Import', 'Plein', 'ESC-2026-0398', 'C-01', ['B', 'C'], -23, -23, 2, ['DRY']],
      ['OWE', 8, 'Import', 'Plein', 'ESC-2026-0406', 'C-02', ['C'], -10, -10, 3, ['DRY']],
      ['OWE', 7, 'Import', 'Plein', 'ESC-2026-0412', 'C-02', ['A'], -1, 0, 0, ['REEFER']],
      ['OWE', 14, 'Export', 'Plein', 'ESC-2026-0413', 'C-02', ['D'], -4, 0, 0, ['DRY', 'DRY', 'REEFER']],
      ['OWE', 16, 'Export', 'Vide', 'ESC-2026-0417', 'C-01', ['E'], -16, -1, 0, ['DRY']],
      ['OWE', 6, 'Transbordement', 'Plein', 'ESC-2026-0412', 'C-06', ['F'], -1, 0, 0, ['DRY']],
      ['POG', 6, 'Import', 'Plein', 'ESC-2026-0403', 'C-06', ['P1'], -14, -14, 2, ['DRY', 'OPEN TOP']],
      ['POG', 5, 'Export', 'Plein', 'ESC-2026-0421', 'C-06', ['P1'], -3, 0, 0, ['DRY']],
      ['POG', 7, 'Export', 'Vide', 'ESC-2026-0421', 'C-05', ['P2'], -12, -2, 0, ['DRY', 'OPEN TOP']]
    ];
    var occ = {}; /* emplacements occupés : bloc -> {r-t: hauteur} */
    function place(bid) {
      var b = bloc(bid), m = occ[bid] = occ[bid] || {}, cands = [];
      for (var r = 1; r <= b.rows; r++) for (var t = 1; t <= b.bays; t++) { var h = m[r + '-' + t] || 0; if (h < b.tiers) cands.push({ r: r, t: t, h: h }); }
      if (!cands.length) return null;
      var started = cands.filter(function (c) { return c.h > 0 && rnd() < 0.7; }), c = (started.length && rnd() < 0.55 ? pick(started) : pick(cands));
      m[c.r + '-' + c.t] = c.h + 1; return fmtLoc(bid, c.r, c.t, c.h + 1);
    }
    var trucks = 0;
    function immat(site) { trucks++; return (1000 + (trucks * 487) % 8999) + ' ' + (site === 'POG' ? 'G8' : 'G1') + ' ' + 'ABCDEFGHJKLMNPRST'[trucks % 17]; }
    G.forEach(function (g) {
      for (var i = 0; i < g[1]; i++) {
        var serial; do { serial = 100000 + Math.floor(rnd() * 899999); } while (used[serial]); used[serial] = 1;
        var type = pick(g[10]), taille = type === 'REEFER' ? 40 : (rnd() < 0.58 ? 40 : 20), day = g[7] + Math.floor(rnd() * (g[8] - g[7] + 1));
        var h = day === 0 ? Math.min(new Date().getHours(), 6 + Math.floor(rnd() * 10)) : 6 + Math.floor(rnd() * 14);
        var entree = dt(day, h, Math.floor(rnd() * 60)), sorti = i < g[9];
        var id = makeIso(PREFIX[g[5]] || 'TXGU', serial);
        var c = { id: id, taille: taille, type: type, etat: g[3], sens: g[2], escale: g[4], client: g[5], site: g[0], bloc: '', emplacement: '', entree: entree, statut: g[2] === 'Export' && g[3] === 'Plein' ? 'À embarquer' : 'Sur parc', sortie: '', poids: g[3] === 'Vide' ? (taille === 40 ? 3.8 : 2.2) : Math.round((taille === 40 ? 14 + rnd() * 14 : 8 + rnd() * 14) * 10) / 10, plomb: g[3] === 'Plein' ? 'SL' + (480000 + Math.floor(rnd() * 99999)) : '', magJours: 0 };
        if (sorti) { var sd = Math.min(0, day + 1 + Math.floor(rnd() * Math.max(1, -day))); c.statut = 'Sorti'; c.sortie = sd === 0 ? dt(0, Math.max(7, Math.min(new Date().getHours(), 7 + Math.floor(rnd() * 8))), Math.floor(rnd() * 60)) : dt(sd, 8 + Math.floor(rnd() * 9), Math.floor(rnd() * 60)); if (c.sortie < c.entree) c.sortie = c.entree; }
        else { var loc = place(pick(g[6])) || place(g[6][0]); if (!loc) { var alt = BLOCS.filter(function (b) { return b.site === g[0]; }); for (var k = 0; k < alt.length && !loc; k++) loc = place(alt[k].id); } c.emplacement = loc || ''; c.bloc = parseLoc(loc).b || ''; }
        if (c.sens === 'Export' && c.etat === 'Vide' && i % 4 === 0 && !sorti) c.statut = 'À embarquer';
        out.push(c);
        var debarq = g[2] !== 'Export';
        mv.push({ id: 'MVT-S' + (mv.length + 1001), date: entree, type: debarq ? 'Débarquement' : 'Entrée gate', conteneur: id, site: g[0], escale: g[4], camion: debarq ? '' : immat(g[0]), grue: debarq && g[0] === 'OWE' ? pick(['GR-01', 'GR-02']) : '', user: debarq ? 'Pointage navire' : 'Gate ' + siteCourt(g[0]) });
        if (sorti) mv.push({ id: 'MVT-S' + (mv.length + 1001), date: c.sortie, type: 'Sortie gate', conteneur: id, site: g[0], escale: g[4], camion: immat(g[0]), grue: '', user: 'Gate ' + siteCourt(g[0]), ref: 'BAE-' + (7700 + mv.length) });
      }
    });
    mv.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    /* Cadences horaires des grues sur l'escale ESC-2026-0412 (MV Atlantic Akanda, poste 1) */
    var cads = [], nowH = new Date().getHours();
    [-1, 0].forEach(function (d) {
      for (var hh = 7; hh <= 18; hh++) {
        if (d === -1 && hh < 9) continue; if (d === 0 && hh >= nowH) continue;
        ['GR-01', 'GR-02'].concat(d === 0 && hh >= 8 && hh <= 11 ? ['GR-03'] : []).forEach(function (g) {
          var base = g === 'GR-03' ? 22 : g === 'GR-02' ? 26 : 28, v = Math.round(base + (rnd() - 0.5) * 8);
          if (hh === 12) v = Math.round(v * 0.55); /* relève et pause de mi-journée */
          cads.push({ id: 'CAD-' + d + '-' + hh + '-' + g, grue: g, escale: 'ESC-2026-0412', date: E.addDays(E.today(), d), heure: pad(hh), mvts: Math.max(8, v) });
        });
      }
    });
    var ent = [
      ['OWE', 'Parc véhicules', 'Véhicules neufs (lot 1)', 'C-04', 'ESC-2026-0414', 180, 'véhicules', 180 * M2_VEHICULE, -1],
      ['OWE', 'Parc véhicules', 'Véhicules d\'occasion', 'C-04', 'ESC-2026-0414', 125, 'véhicules', 125 * M2_VEHICULE, 0],
      ['OWE', 'Parc véhicules', 'Engins de chantier', 'C-07', 'ESC-2026-0414', 22, 'engins', 22 * 40, 0],
      ['OWE', 'Parc véhicules', 'Véhicules — reliquat', 'C-04', 'ESC-2026-0402', 38, 'véhicules', 38 * M2_VEHICULE, -16],
      ['OWE', 'Magasin cale', 'Riz en sacs de 50 kg', 'C-07', 'ESC-2026-0410', 1200, 't', 950, -5],
      ['OWE', 'Magasin cale', 'Ciment en sacs', 'C-03', 'ESC-2026-0410', 640, 't', 520, -5],
      ['OWE', 'Magasin cale', 'Colis lourds — matériel électrique', 'C-07', 'ESC-2026-0400', 14, 'colis', 260, -20],
      ['OWE', 'Magasin cale', 'Pièces détachées industrielles', 'C-03', 'ESC-2026-0407', 85, 'palettes', 180, -7],
      ['POG', 'Magasin cale', 'Matériel offshore (paniers et colis)', 'C-05', 'ESC-2026-0411', 42, 'colis', 420, -4],
      ['POG', 'Parc véhicules', 'Pick-up de chantier', 'C-05', 'ESC-2026-0411', 16, 'véhicules', 16 * M2_VEHICULE, -4]
    ].map(function (r, i) { return { id: 'LOT-2026-' + (311 + i), site: r[0], zone: r[1], libelle: r[2], client: r[3], escale: r[4], quantite: r[5], unite: r[6], surface: r[7], entree: E.addDays(E.today(), r[8]), statut: 'En stock' }; });
    return { conteneurs: out, mouvementsTerminal: mv, cadencesGrues: cads, entreposage: ent };
  }

  /* ------------------------------------------------------------------ vues */
  var TABS = [{ k: 'parc', l: 'Occupation du parc' }, { k: 'cadences', l: 'Cadences des grues' }, { k: 'conteneurs', l: 'Conteneurs' }, { k: 'gate', l: 'Gate' }, { k: 'entrepots', l: 'Magasin & parc véhicules' }, { k: 'alertes', l: 'Stationnement > 10 j' }];
  var state = { tab: 'parc', site: 'OWE', q: '', fSt: 'parc', fSens: '' };

  /* En espace de site : parc du site actif uniquement (pas de bascule Owendo / Port-Gentil). */
  function tabsFor() { return E.scope() === 'POG' ? TABS.filter(function (t) { return t.k !== 'cadences'; }) : TABS; }
  function render(view, params) {
    var p0 = params[0], openC = null, sc = E.scope();
    if (sc) state.site = sc;
    if (sc === 'POG' && (state.tab === 'cadences' || p0 === 'cadences')) { state.tab = 'parc'; if (p0 === 'cadences') p0 = 'parc'; }
    if (p0 === 'escale' && params[1]) { state.tab = 'conteneurs'; state.q = params[1]; state.fSt = ''; var es = S.get('escales', params[1]); if (es) state.site = es.site; }
    else if (p0 === 'conteneurs' && params[1]) { state.tab = 'conteneurs'; openC = params[1]; var c0 = S.get('conteneurs', openC); if (c0) state.site = c0.site; }
    else if (p0 && TABS.some(function (t) { return t.k === p0; })) state.tab = p0;
    var sf = siteFill(state.site), list = siteCtns(), park = onPark(list), al = alertes(state.site);
    var gToday = S.all('mouvementsTerminal').filter(function (m) { return m.site === state.site && String(m.date).slice(0, 10) === E.today(); });
    var head =
      '<div class="ter-bar">' + (sc ? '<div class="esc-port">' + E.icon('pin') + '<b>' + esc(E.siteName(sc)) + '</b><span>' + (sc === 'POG' ? 'parc conteneurs, magasin et parc offshore' : 'terminal à conteneurs, magasin cale et parc véhicules') + '</span></div>' : '<div class="chips" id="tr-site">' + [['OWE', 'Owendo'], ['POG', 'Port-Gentil']].map(function (c) { return '<button class="chip' + (state.site === c[0] ? ' is-active' : '') + '" data-k="' + c[0] + '">' + E.icon('pin').replace('<svg ', '<svg style="width:13px;height:13px;vertical-align:-2px;margin-right:4px" ') + c[1] + '</button>'; }).join('') + '</div>') + '<span class="spacer"></span>' +
      '<button class="btn" id="tr-out">' + E.icon('logout') + 'Sortie gate</button><button class="btn primary" id="tr-in">' + E.icon('plus') + 'Entrée gate</button></div>' +
      '<div class="grid g4 ter-kpis">' +
        U.kpi({ label: 'Occupation du parc', value: F.num(sf.pct), unit: '%', icon: 'container', tone: sf.pct >= 85 ? 'red' : sf.pct >= 70 ? 'orange' : 'green', foot: F.num(sf.evp) + ' EVP sur ' + F.num(sf.cap) + ' EVP de capacité (démo)' }) +
        U.kpi({ label: 'Conteneurs sur parc', value: park.length, icon: 'layers', tone: 'blue', foot: park.filter(function (c) { return c.etat === 'Plein'; }).length + ' pleins · ' + park.filter(function (c) { return c.etat === 'Vide'; }).length + ' vides · ' + park.filter(function (c) { return c.statut === 'À embarquer'; }).length + ' à embarquer' }) +
        U.kpi({ label: 'Séjour > 10 jours', value: al.length, icon: 'clock', tone: al.length ? 'red' : 'green', foot: al.filter(function (c) { return aFacturer(c) > 0; }).length + ' prestation(s) de magasinage à créer' }) +
        U.kpi({ label: 'Mouvements du jour', value: gToday.length, icon: 'truck', tone: 'violet', foot: gToday.filter(function (m) { return m.type === 'Entrée gate'; }).length + ' entrées · ' + gToday.filter(function (m) { return m.type === 'Sortie gate'; }).length + ' sorties gate · ' + gToday.filter(function (m) { return m.type === 'Débarquement' || m.type === 'Embarquement'; }).length + ' bord' }) +
      '</div>';
    var counts = { conteneurs: park.length, alertes: al.length || null };
    view.innerHTML = head + U.tabs(tabsFor().map(function (t) { return { k: t.k, l: t.l, n: counts[t.k] }; }), state.tab, function (k) { state.tab = k; E.go('terminal/' + k); }) + '<div id="tr-body"></div>';
    var trSite = view.querySelector('#tr-site'); if (trSite) trSite.addEventListener('click', function (ev) { var b = ev.target.closest('.chip'); if (b) { state.site = b.dataset.k; E.rerender(); } });
    view.querySelector('#tr-in').onclick = function () { gateIn(); };
    view.querySelector('#tr-out').onclick = function () { gateOut(); };
    var body = view.querySelector('#tr-body');
    ({ parc: vParc, cadences: vCad, conteneurs: vCtn, gate: vGate, entrepots: vEnt, alertes: vAlertes })[state.tab](body);
    var ta = view.querySelector('.tabs .tab.is-active'); if (ta && ta.parentNode.scrollWidth > ta.parentNode.clientWidth) ta.parentNode.scrollLeft = ta.offsetLeft - 16;
    if (openC) openCtn(openC, true);
  }
  function clearDeep() { if (location.hash.split('/').length > 3) history.replaceState(null, '', '#/terminal/' + state.tab); }

  /* ---------- occupation du parc & carte ---------- */
  function blockHTML(b) {
    var f = blocFill(b), st = stacks(b), cells = '';
    for (var r = 1; r <= b.rows; r++) for (var t = 1; t <= b.bays; t++) {
      var l = st[r + '-' + t] || [], h = l.length;
      cells += '<i class="ter-cell h' + Math.min(4, h) + '" style="--f:' + (h / b.tiers) + '" title="Rangée ' + r + ' · travée ' + t + ' : ' + h + '/' + b.tiers + ' niveau(x)">' + (h ? '<b>' + h + '</b>' : '') + '</i>';
    }
    return '<button class="ter-block" data-bloc="' + b.id + '" style="--c:' + fillColor(f.pct) + '"><div class="ter-block__h"><b>' + esc(b.nom) + '</b><span>' + F.num(f.pct) + ' %</span></div><div class="ter-block__u">' + esc(b.usage) + '</div>' +
      '<div class="ter-block__g" style="grid-template-columns:repeat(' + b.bays + ',1fr)">' + cells + '</div>' +
      '<div class="ter-block__f"><span>' + f.n + ' conteneurs · ' + f.evp + ' EVP</span><span>cap. ' + f.cap + ' EVP</span></div><div class="ter-block__bar"><i style="width:' + f.pct + '%"></i></div></button>';
  }
  function vParc(el) {
    var site = state.site, bs = BLOCS.filter(function (b) { return b.site === site; }), park = onPark(siteCtns()), info = SITE_INFO[site];
    var parSens = ['Import', 'Export', 'Transbordement'].map(function (s) { return { label: s, value: sum(park.filter(function (c) { return c.sens === s && c.etat === 'Plein'; }), evp), color: SENS_COL[s] }; }).concat([{ label: 'Vides', value: sum(park.filter(function (c) { return c.etat === 'Vide'; }), evp), color: '#94a3b8' }]);
    var parType = ['DRY', 'REEFER', 'OPEN TOP'].map(function (t) { return { t: t, n: park.filter(function (c) { return c.type === t; }).length }; });
    var dwell = park.length ? sum(park, jours) / park.length : 0;
    el.innerHTML =
      '<div class="card"><div class="card__h"><h3>Carte du parc — ' + esc(E.siteName(site)) + '</h3><span class="sub">Blocs colorés selon le remplissage · cliquez sur un bloc pour voir les piles</span></div><div class="card__b">' +
        '<div class="ter-map ter-map--' + site + '">' + (site === 'OWE' ? '<div class="ter-quay">' + E.icon('wave') + '<span>Quai — 600 m · postes 1 à 4</span></div>' : '<div class="ter-quay">' + E.icon('wave') + '<span>Quai commercial</span></div>') + '<div class="ter-blocks">' + bs.map(blockHTML).join('') + '</div><div class="ter-gate">' + E.icon('truck') + '<span>Gate d\'entrée / sortie</span></div></div>' +
        '<div class="legend" style="margin-top:12px"><span><i style="background:#1e9e4a"></i>&lt; 50 %</span><span><i style="background:#f2b705"></i>50–75 %</span><span><i style="background:#e8780c"></i>75–90 %</span><span><i style="background:#d93636"></i>≥ 90 %</span><span class="muted">Chiffre dans une case = nombre de niveaux gerbés</span></div>' +
      '</div></div>' +
      '<div class="grid g3" style="margin-top:16px">' +
        '<div class="card"><div class="card__h"><h3>Répartition sur parc</h3><span class="sub">EVP</span></div><div class="card__b">' + U.donut(parSens, { center: F.num(sum(parSens, 'value')), sub: 'EVP' }) + '</div></div>' +
        '<div class="card"><div class="card__h"><h3>Indicateurs</h3></div><div class="card__b"><div class="ter-stats">' +
          '<div><span>Temps moyen de séjour</span><b>' + F.num(dwell, 1) + ' j</b></div>' +
          parType.map(function (p) { return '<div><span>' + p.t + '</span><b>' + p.n + '</b></div>'; }).join('') +
          '<div><span>20 pieds / 40 pieds</span><b>' + park.filter(function (c) { return +c.taille === 20; }).length + ' / ' + park.filter(function (c) { return +c.taille === 40; }).length + '</b></div>' +
        '</div></div></div>' +
        '<div class="card"><div class="card__h"><h3>Capacités</h3></div><div class="card__b"><dl class="kv">' +
          (info.ha ? '<dt>Surface du parc</dt><dd><b>' + F.num(info.ha, 1) + ' ha</b></dd><dt>Capacité de traitement</dt><dd><b>' + F.num(info.annuel) + ' EVP / an</b></dd>' : '') +
          '<dt>Stockage instantané (démo)</dt><dd>' + F.num(sum(bs, capEVP)) + ' EVP · ' + sum(bs, slots) + ' emplacements</dd><dt>Magasin cale</dt><dd>' + F.num(info.magasin) + ' m²' + (site === 'POG' ? ' (démo)' : '') + '</dd><dt>Parc véhicules</dt><dd>' + (site === 'OWE' ? '1,2 ha' : F.num(info.vehicules) + ' m² (démo)') + '</dd></dl>' +
          '<p class="small muted" style="margin:10px 0 0">' + (site === 'OWE' ? 'Surface et capacité annuelle : chiffres publiés par le groupe Portek. ' : '') + 'Découpage en blocs et capacité de stockage : hypothèses de démonstration (' + F.num(EVP_SLOT, 1) + ' EVP par emplacement).</p></div></div>' +
      '</div>';
    E.$$('[data-bloc]', el).forEach(function (b) { b.onclick = function () { openBloc(b.dataset.bloc); }; });
  }
  function openBloc(id) {
    var b = bloc(id), st = stacks(b), f = blocFill(b), html = '<div class="ter-bmat" style="grid-template-columns:auto repeat(' + b.bays + ',minmax(92px,1fr))"><div></div>';
    for (var t = 1; t <= b.bays; t++) html += '<div class="ter-bmat__h">Travée ' + pad(t) + '</div>';
    for (var r = 1; r <= b.rows; r++) {
      html += '<div class="ter-bmat__h">R' + pad(r) + '</div>';
      for (var t2 = 1; t2 <= b.bays; t2++) {
        var l = (st[r + '-' + t2] || []).slice().reverse();
        html += '<div class="ter-bmat__c">' + (l.length ? l.map(function (c) { return '<button class="ter-chip' + (jours(c) > FRANCHISE ? ' is-late' : '') + '" data-ctn="' + c.id + '" style="--c:' + (c.etat === 'Vide' ? '#94a3b8' : SENS_COL[c.sens]) + '" title="' + esc(isoTxt(c.id) + ' · ' + c.taille + '\' ' + c.type + ' · niveau ' + parseLoc(c.emplacement).n) + '"><b>' + esc(c.id.slice(0, 4)) + ' ' + esc(c.id.slice(4, 10)) + '</b><span>N' + parseLoc(c.emplacement).n + ' · ' + c.taille + '\'</span></button>'; }).join('') : '<span class="muted small">libre</span>') + '</div>';
      }
    }
    html += '</div>';
    var m = U.modal({ title: b.nom + ' — ' + b.usage, sub: f.n + ' conteneurs · ' + f.evp + ' / ' + f.cap + ' EVP (' + F.num(f.pct) + ' %) · ' + b.rows + ' rangées × ' + b.bays + ' travées × ' + b.tiers + ' niveaux', size: 'lg', body: '<div class="ter-bmat-wrap">' + html + '</div><div class="legend" style="margin-top:12px">' + Object.keys(SENS_COL).map(function (s) { return '<span><i style="background:' + SENS_COL[s] + '"></i>' + s + '</span>'; }).join('') + '<span><i style="background:#94a3b8"></i>Vide</span><span><i class="ter-lg-late"></i>&gt; 10 jours</span></div>', actions: [{ label: 'Fermer' }] });
    E.$$('[data-ctn]', m.el).forEach(function (x) { x.onclick = function () { m.close(); openCtn(x.dataset.ctn); }; });
  }

  /* ---------- cadences ---------- */
  function vCad(el) {
    if (state.site === 'POG') { el.innerHTML = '<div class="card"><div class="empty">' + E.icon('crane') + '<div><b>Pas de grue mobile portuaire suivie à Port-Gentil</b></div><div class="small">Les opérations y sont réalisées aux apparaux de bord (démonstration).' + (E.scope() ? '' : ' Sélectionnez Owendo pour suivre les cadences des 3 grues mobiles.') + '</div></div></div>'; return; }
    var grues = S.all('flotte').filter(function (f) { return f.type === 'Grue mobile portuaire'; });
    var hours = []; var now = new Date(); for (var i = 11; i >= 0; i--) { var d = new Date(now.getTime() - (i + 1) * 36e5); hours.push({ date: E.iso(d), heure: pad(d.getHours()) }); }
    var val = function (g, h) { var r = cad().filter(function (c) { return c.grue === g && c.date === h.date && c.heure === h.heure; }); return sum(r, 'mvts'); };
    var series = grues.map(function (g, i) { return { name: g.nom.replace('Grue mobile portuaire', 'Grue'), color: ['#0b3a6e', '#2563eb', '#f2b705'][i % 3], values: hours.map(function (h) { return val(g.id, h); }) }; });
    var stats = grues.map(function (g) {
      var l = cad().filter(function (c) { return c.grue === g.id; }).sort(function (a, b) { return (b.date + b.heure).localeCompare(a.date + a.heure); });
      var today = l.filter(function (c) { return c.date === E.today(); }), last4 = l.slice(0, 4), act = l.filter(function (c) { return c.mvts > 0; });
      var avg = last4.length ? sum(last4, 'mvts') / last4.length : 0, recent = l[0] && (l[0].date === E.today() && +l[0].heure >= now.getHours() - 2);
      return { g: g, today: sum(today, 'mvts'), heuresJ: today.length, avg: avg, avgAll: act.length ? sum(act, 'mvts') / act.length : 0, recent: recent, esc: l[0] ? l[0].escale : '' };
    });
    var rows = cad().slice().sort(function (a, b) { return (b.date + b.heure + b.grue).localeCompare(a.date + a.heure + a.grue); }).slice(0, 40);
    var cols = [
      { key: 'date', label: 'Date', render: function (c) { return F.dateShort(c.date); } },
      { key: 'heure', label: 'Heure', render: function (c) { return c.heure + 'h – ' + pad((+c.heure + 1) % 24) + 'h'; } },
      { key: 'grue', label: 'Grue', render: function (c) { var f = S.get('flotte', c.grue); return f ? esc(f.nom) : esc(c.grue); } },
      { key: 'escale', label: 'Navire', render: function (c) { return esc(navire(c.escale)); }, csv: function (c) { return navire(c.escale); } },
      { key: 'mvts', label: 'Mouvements / h', num: 1, render: function (c) { return '<b class="' + (c.mvts < OBJ_MIN ? 'ter-neg' : c.mvts >= OBJ_MIN ? 'ter-pos' : '') + '">' + c.mvts + '</b>'; } }
    ];
    el.innerHTML =
      '<div class="grid g3">' + stats.map(function (s) {
        var col = s.avg >= OBJ_MIN ? '#1e9e4a' : s.avg >= 20 ? '#e8780c' : '#d93636';
        return '<div class="card ter-crane"><div class="card__h"><div class="list__icon tone-navy">' + E.icon('crane') + '</div><div><h3>' + esc(s.g.nom) + '</h3><span class="sub">' + esc(s.g.puissance) + ' · ' + F.num(s.g.heures) + ' h de service</span></div><span class="spacer"></span>' + (s.g.statut !== 'Disponible' ? U.badge(s.g.statut, 'red') : s.recent ? U.badge('En opération', 'blue') : U.badge('À l\'arrêt', 'grey')) + '</div>' +
          '<div class="card__b">' + U.gauge(Math.min(100, s.avg / 35 * 100), '', col).replace(/>\d+%<\/text>/, '>' + F.num(s.avg, 1) + '</text>') + '<div class="center small muted">mouvements / heure (4 derniers relevés) · objectif ' + OBJ_MIN + '–' + OBJ_MAX + '</div>' +
          '<div class="ter-stats sm"><div><span>Aujourd\'hui</span><b>' + F.num(s.today) + ' mvts</b></div><div><span>Heures travaillées</span><b>' + s.heuresJ + ' h</b></div><div><span>Moyenne escale</span><b>' + F.num(s.avgAll, 1) + '</b></div></div>' + (s.esc && s.recent ? '<div class="small muted" style="margin-top:8px">Sur ' + esc(navire(s.esc)) + ' (' + esc(s.esc) + ')</div>' : '') + '</div></div>';
      }).join('') + '</div>' +
      '<div class="card" style="margin-top:16px"><div class="card__h"><h3>Mouvements par heure — 12 dernières heures</h3><span class="sub">objectif ' + OBJ_MIN + '–' + OBJ_MAX + ' mouvements / heure / grue</span></div><div class="card__b">' + U.bars({ labels: hours.map(function (h) { return h.heure + 'h'; }), series: series, height: 230 }) + '</div></div>' +
      '<div class="card" style="margin-top:16px"><div class="card__h"><h3>Relevés horaires</h3><span class="sub">pointage par grue</span><span class="spacer"></span><button class="btn sm" id="cd-csv">' + E.icon('download') + 'CSV</button><button class="btn sm primary" id="cd-new">' + E.icon('plus') + 'Saisir un relevé</button></div>' + U.table(cols, rows, { empty: 'Aucun relevé' }) + '</div>';
    el.querySelector('#cd-csv').onclick = function () { U.exportCSV('cadences-grues-' + E.today(), cols, cad()); };
    el.querySelector('#cd-new').onclick = function () {
      var escs = S.all('escales').filter(function (e) { return e.site === 'OWE' && (e.statut === 'À quai' || e.statut === 'En opérations'); });
      if (!escs.length) { U.toast('Aucun navire en opérations à Owendo.', 'err'); return; }
      var h = new Date(Date.now() - 36e5);
      U.formModal({ title: 'Relevé de cadence', sub: 'Mouvements réalisés par une grue pendant une heure', size: 'sm', okLabel: 'Enregistrer', fields: [
        { name: 'grue', label: 'Grue', type: 'select', options: grues.map(function (g) { return { v: g.id, l: g.nom }; }), required: true, full: true },
        { name: 'escale', label: 'Navire', type: 'select', options: escs.map(function (e) { return { v: e.id, l: e.navire + ' · ' + e.id }; }), required: true, full: true },
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'heure', label: 'Heure de début', type: 'select', options: Array.apply(null, Array(24)).map(function (_, i) { return { v: pad(i), l: pad(i) + 'h' }; }), required: true },
        { name: 'mvts', label: 'Mouvements réalisés', type: 'number', step: '1', required: true, full: true }
      ], values: { date: E.iso(h), heure: pad(h.getHours()), escale: escs[0].id }, onSubmit: function (v) {
        if (!(+v.mvts >= 0 && +v.mvts <= 60)) { U.toast('Nombre de mouvements invalide (0 à 60).', 'err'); return false; }
        var ex = cad().find(function (c) { return c.grue === v.grue && c.date === v.date && c.heure === v.heure; });
        if (ex) { ex.mvts = +v.mvts; ex.escale = v.escale; S.save(); } else S.add('cadencesGrues', { id: 'CAD-' + Date.now().toString(36), grue: v.grue, escale: v.escale, date: v.date, heure: v.heure, mvts: +v.mvts });
        E.log('Relevé de cadence ' + v.grue, v.date + ' ' + v.heure + 'h · ' + v.mvts + ' mvts/h', 'terminal');
        if (+v.mvts < 20) E.notify('Cadence faible — ' + v.grue, v.mvts + ' mouvements/heure à ' + v.heure + 'h (objectif ' + OBJ_MIN + '–' + OBJ_MAX + ')', '#/terminal/cadences', 'orange');
        U.toast(+v.mvts < OBJ_MIN ? 'Relevé enregistré — sous l\'objectif de ' + OBJ_MIN + ' mvts/h' : 'Relevé enregistré', +v.mvts < OBJ_MIN ? 'err' : 'ok'); E.rerender();
      } });
    };
  }

  /* ---------- liste & recherche des conteneurs ---------- */
  function ctnCols() {
    return [
      { key: 'id', label: 'Conteneur', render: function (c) { return '<b class="mono">' + esc(isoTxt(c.id)) + '</b><div class="small muted">' + c.taille + '\' ' + esc(c.type) + ' · ' + esc(c.etat) + '</div>'; }, csv: function (c) { return c.id; } },
      { key: 'taille', label: 'Taille', csv: function (c) { return c.taille; }, render: function (c) { return c.taille + '\''; }, cls: 'ter-hm' },
      { key: 'sens', label: 'Trafic', render: function (c) { return '<span class="ter-sens" style="--c:' + SENS_COL[c.sens] + '">' + esc(c.sens) + '</span>'; }, csv: function (c) { return c.sens + ' ' + c.etat; } },
      { key: 'escale', label: 'Navire', render: function (c) { return esc(navire(c.escale)) + '<div class="small muted">' + esc(c.escale) + '</div>'; }, csv: function (c) { return navire(c.escale) + ' (' + c.escale + ')'; } },
      { key: 'client', label: 'Client', render: function (c) { return esc(clientNom(c.client)); }, csv: function (c) { return clientNom(c.client); } },
      { key: 'emplacement', label: 'Emplacement', render: function (c) { return c.statut === 'Sorti' ? '<span class="muted">—</span>' : '<span class="mono">' + esc(c.emplacement) + '</span>'; } },
      { key: 'entree', label: 'Entrée', render: function (c) { return fdt(c.entree); } },
      { key: 'jours', label: 'Jours', num: 1, render: function (c) { var j = jours(c); return '<b class="' + (j > FRANCHISE && c.statut !== 'Sorti' ? 'ter-neg' : '') + '">' + j + '</b>'; }, csv: function (c) { return jours(c); } },
      { key: 'statut', label: 'Statut', render: function (c) { return U.badge(c.statut, ST_TONE[c.statut]); } }
    ];
  }
  function vCtn(el) {
    var q = E.norm(state.q).replace(/[\s-]/g, '');
    var list = siteCtns().filter(function (c) {
      if (state.fSt === 'parc' && c.statut === 'Sorti') return false;
      if (state.fSt && state.fSt !== 'parc' && c.statut !== state.fSt) return false;
      if (state.fSens && (state.fSens === 'Vide' ? c.etat !== 'Vide' : c.sens !== state.fSens || c.etat === 'Vide')) return false;
      return !q || E.norm(c.id + c.escale + navire(c.escale) + clientNom(c.client) + c.emplacement + c.type).replace(/[\s-]/g, '').indexOf(q) >= 0;
    }).sort(function (a, b) { return String(b.entree).localeCompare(String(a.entree)); });
    var cols = ctnCols();
    el.innerHTML = '<div class="card"><div class="card__h"><h3>Conteneurs — ' + esc(E.siteName(state.site)) + '</h3><span class="sub">' + list.length + ' résultat(s) · ' + F.num(sum(list, evp)) + ' EVP</span><span class="spacer"></span><button class="btn sm" id="ct-csv">' + E.icon('download') + 'Export CSV</button></div>' +
      '<div class="card__b" style="padding-bottom:0"><div class="filters"><label class="ter-search">' + E.icon('search') + '<input class="input" id="ct-q" type="search" placeholder="N° de conteneur, navire, client, bloc…" value="' + esc(state.q) + '"></label>' +
      '<select class="select" id="ct-st">' + [['parc', 'Sur parc (y c. à embarquer)'], ['', 'Tous les statuts'], ['Sur parc', 'Sur parc'], ['À embarquer', 'À embarquer'], ['Sorti', 'Sortis']].map(function (o) { return '<option value="' + o[0] + '"' + (state.fSt === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<select class="select" id="ct-se">' + [['', 'Tous les trafics'], ['Import', 'Import (pleins)'], ['Export', 'Export (pleins)'], ['Transbordement', 'Transbordement'], ['Vide', 'Vides']].map(function (o) { return '<option value="' + o[0] + '"' + (state.fSens === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div></div>' +
      U.table(cols, list.slice(0, 200), { onRow: function (c) { openCtn(c.id); }, empty: 'Aucun conteneur ne correspond à la recherche' }) + '</div>';
    var inp = el.querySelector('#ct-q');
    inp.addEventListener('input', function () { state.q = inp.value; clearTimeout(vCtn.t); vCtn.t = setTimeout(function () { vCtn(el); var i2 = el.querySelector('#ct-q'); i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); }, 250); });
    el.querySelector('#ct-st').onchange = function (e) { state.fSt = e.target.value; vCtn(el); };
    el.querySelector('#ct-se').onchange = function (e) { state.fSens = e.target.value; vCtn(el); };
    el.querySelector('#ct-csv').onclick = function () { U.exportCSV('conteneurs-' + state.site.toLowerCase() + '-' + E.today(), cols, list); };
  }
  function openCtn(id, deep) {
    var c = S.get('conteneurs', id); if (!c) { U.toast('Conteneur introuvable', 'err'); return; }
    var mv = S.all('mouvementsTerminal').filter(function (m) { return m.conteneur === id; }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    var e = S.get('escales', c.escale), j = jours(c), af = aFacturer(c);
    var body = (j > FRANCHISE && c.statut !== 'Sorti' ? '<div class="alert tone-' + (af > 0 ? 'red' : 'green') + '" style="margin-bottom:12px">' + E.icon(af > 0 ? 'clock' : 'check') + '<div>' + j + ' jours de stationnement (franchise ' + FRANCHISE + ' j). ' + (af > 0 ? '<b>' + af + ' jour(s) de magasinage à facturer</b> — ' + F.money(af * pu(c)) + ' HT (tarif fictif de démonstration).' : 'Magasinage facturé jusqu\'à ce jour.') + '</div></div>' : '') +
      '<div class="ter-ctn"><div class="ter-ctn__box" style="--c:' + (c.etat === 'Vide' ? '#94a3b8' : SENS_COL[c.sens]) + '"><b>' + esc(isoTxt(c.id)) + '</b><span>' + c.taille + '\' ' + esc(c.type) + ' · ' + esc(c.etat) + '</span>' + (isoValide(c.id) ? '<em>' + E.icon('check').replace('<svg ', '<svg style="width:12px;height:12px" ') + ' n° ISO 6346 valide</em>' : '') + '</div>' +
      '<dl class="kv"><dt>Statut</dt><dd>' + U.badge(c.statut, ST_TONE[c.statut]) + '</dd><dt>Trafic</dt><dd>' + esc(c.sens) + '</dd><dt>Navire / escale</dt><dd>' + (e ? '<a href="#/escales/' + esc(c.escale) + '">' + esc(e.navire) + '</a>' : esc(c.escale)) + ' <span class="small muted">' + esc(c.escale) + '</span></dd><dt>Client</dt><dd>' + esc(clientNom(c.client)) + '</dd>' +
      '<dt>Emplacement</dt><dd>' + (c.statut === 'Sorti' ? '—' : '<b class="mono">' + esc(c.emplacement) + '</b> <span class="small muted">bloc ' + esc(parseLoc(c.emplacement).b) + ', rangée ' + parseLoc(c.emplacement).r + ', travée ' + parseLoc(c.emplacement).t + ', niveau ' + parseLoc(c.emplacement).n + '</span>') + '</dd>' +
      '<dt>Entrée sur parc</dt><dd>' + fdt(c.entree) + '</dd>' + (c.sortie ? '<dt>Sortie</dt><dd>' + fdt(c.sortie) + '</dd>' : '') + '<dt>Stationnement</dt><dd>' + j + ' jour(s)</dd><dt>Poids brut</dt><dd>' + F.num(c.poids, 1) + ' t</dd>' + (c.plomb ? '<dt>Plomb</dt><dd class="mono">' + esc(c.plomb) + '</dd>' : '') + '</dl></div>' +
      '<div class="small muted" style="font-weight:600;margin:14px 0 6px">Mouvements</div><div class="timeline">' + (mv.length ? mv.map(function (m) { return '<div class="tl-item done"><b>' + esc(m.type) + '</b><span>' + fdt(m.date) + (m.grue ? ' · ' + esc(m.grue) : '') + (m.camion ? ' · camion ' + esc(m.camion) : '') + (m.ref ? ' · ' + esc(m.ref) : '') + ' · ' + esc(m.user || '') + '</span></div>'; }).join('') : '<div class="tl-item"><b>Aucun mouvement enregistré</b></div>') + '</div>';
    var acts = [];
    if (af > 0) acts.push({ label: 'Créer la prestation de magasinage', cls: 'accent', icon: 'invoice', onClick: function (cl) { factMag(c); cl(); E.rerender(); } });
    if (c.statut !== 'Sorti') acts.push({ label: 'Déplacer', icon: 'refresh', onClick: function (cl) { cl(); moveForm(c); } });
    if (c.statut === 'Sur parc' && c.sens === 'Export') acts.push({ label: 'Préparer pour embarquement', icon: 'ship', onClick: function (cl) { c.statut = 'À embarquer'; S.save(); E.log('Conteneur à embarquer ' + c.id, navire(c.escale), 'terminal'); U.toast('Conteneur prêt à embarquer'); cl(); E.rerender(); } });
    if (c.statut === 'À embarquer') acts.push({ label: 'Embarquer', cls: 'primary', icon: 'ship', onClick: function (cl) { cl(); embarquer(c); } });
    if (c.statut === 'Sur parc' && c.sens !== 'Export') acts.push({ label: 'Sortie gate', cls: 'primary', icon: 'logout', onClick: function (cl) { cl(); gateOut(c.id); } });
    if (!acts.length) acts.push({ label: 'Fermer' });
    U.modal({ title: 'Conteneur ' + isoTxt(c.id), sub: esc(E.siteName(c.site)), body: body, actions: acts, onClose: deep ? clearDeep : null });
  }
  function pu(c) { return (+c.taille === 40 ? TARIFS.j40 : TARIFS.j20) + (c.type === 'REEFER' ? TARIFS.reeferJour : 0); }
  function factMag(c) {
    var d = aFacturer(c); if (d <= 0) return 0;
    var from = FRANCHISE + (c.magJours || 0) + 1, to = FRANCHISE + (c.magJours || 0) + d, e = S.get('escales', c.escale);
    S.add('prestations', { id: S.next('PRS'), escale: c.escale, client: c.client || (e ? e.client : ''), date: E.today(), libelle: 'Magasinage conteneur ' + isoTxt(c.id) + ' (' + c.taille + '\' ' + c.type + ') — jours ' + from + ' à ' + to, qte: d, unite: 'jour', pu: pu(c), statut: 'À facturer', source: 'terminal', ref: c.id, site: c.site });
    c.magJours = (c.magJours || 0) + d; S.save();
    E.log('Prestation de magasinage ' + c.id, d + ' j · ' + F.money(d * pu(c)), 'terminal');
    U.toast('Magasinage : ' + d + ' j transmis à la facturation (' + F.money(d * pu(c)) + ')');
    return d * pu(c);
  }
  function moveForm(c) {
    var bs = BLOCS.filter(function (b) { return b.site === c.site && b.id !== c.bloc && freeSlot(b.id); });
    if (!bs.length) { U.toast('Aucun autre bloc disponible.', 'err'); return; }
    U.formModal({ title: 'Déplacer ' + isoTxt(c.id), sub: 'Emplacement actuel : ' + c.emplacement, size: 'sm', okLabel: 'Déplacer', fields: [{ name: 'bloc', label: 'Bloc de destination', type: 'select', options: bs.map(function (b) { return { v: b.id, l: b.nom + ' — ' + b.usage + ' (' + F.num(blocFill(b).pct) + ' %)' }; }), required: true, full: true }], onSubmit: function (v) {
      var loc = freeSlot(v.bloc); if (!loc) { U.toast('Bloc plein.', 'err'); return false; }
      var old = c.emplacement; c.emplacement = loc; c.bloc = v.bloc; S.save();
      addMvt({ date: nowISO(), type: 'Transfert', conteneur: c.id, site: c.site, escale: c.escale, camion: '', grue: '', ref: old + ' → ' + loc });
      E.log('Transfert de conteneur ' + c.id, old + ' → ' + loc, 'terminal'); U.toast('Conteneur déplacé en ' + loc); E.rerender();
    } });
  }
  function embarquer(c) {
    var e = S.get('escales', c.escale);
    if (!e || ['À quai', 'En opérations'].indexOf(e.statut) < 0) {
      var alt = S.all('escales').filter(function (x) { return x.site === c.site && ['À quai', 'En opérations'].indexOf(x.statut) >= 0; });
      if (!alt.length) { U.toast('Le navire ' + navire(c.escale) + ' n\'est pas à quai : embarquement impossible pour l\'instant.', 'err'); return; }
      return U.formModal({ title: 'Embarquer ' + isoTxt(c.id), sub: navire(c.escale) + ' n\'est pas à quai — choisir le navire', size: 'sm', okLabel: 'Embarquer', fields: [{ name: 'escale', label: 'Navire à quai', type: 'select', options: alt.map(function (x) { return { v: x.id, l: x.navire + ' · ' + x.id }; }), required: true, full: true }], onSubmit: function (v) { doEmb(c, v.escale); } });
    }
    U.confirm('Embarquer ' + isoTxt(c.id), 'Chargement à bord de <b>' + esc(e.navire) + '</b>. Le conteneur quitte le parc.', 'Embarquer', function () { doEmb(c, c.escale); });
  }
  function doEmb(c, escId) {
    c.statut = 'Sorti'; c.sortie = nowISO(); c.escaleSortie = escId; var old = c.emplacement; S.save();
    addMvt({ date: nowISO(), type: 'Embarquement', conteneur: c.id, site: c.site, escale: escId, camion: '', grue: c.site === 'OWE' ? 'GR-01' : '', ref: old });
    E.log('Embarquement ' + c.id, navire(escId), 'terminal'); U.toast('Conteneur embarqué sur ' + navire(escId)); E.rerender();
  }

  /* ---------- gate ---------- */
  function gateIn() {
    var escs = S.all('escales').filter(function (e) { return e.site === state.site && e.statut !== 'Annulée' && (e.statut !== 'Appareillé' || (Date.now() - new Date(e.atd).getTime()) < 30 * 864e5); }).sort(function (a, b) { return String(b.eta).localeCompare(String(a.eta)); });
    var m = U.formModal({ title: 'Entrée gate — ' + siteCourt(state.site), sub: 'Réception d\'un conteneur par camion · contrôle du numéro ISO 6346', okLabel: 'Enregistrer l\'entrée',
      intro: '<div id="gi-chk"></div>',
      fields: [
        { name: 'id', label: 'N° de conteneur', required: true, placeholder: 'ex. ATLU 123456-7' },
        { name: 'camion', label: 'Immatriculation du camion', required: true, placeholder: '1234 G1 A' },
        { name: 'taille', label: 'Taille', type: 'select', options: [{ v: 20, l: '20 pieds' }, { v: 40, l: '40 pieds' }], required: true },
        { name: 'type', label: 'Type', type: 'select', options: ['DRY', 'REEFER', 'OPEN TOP'], required: true },
        { name: 'etat', label: 'État', type: 'select', options: ['Plein', 'Vide'], required: true },
        { name: 'sens', label: 'Trafic', type: 'select', options: ['Export', 'Import', 'Transbordement'], required: true },
        { name: 'escale', label: 'Escale de rattachement', type: 'select', options: escs.map(function (e) { return { v: e.id, l: e.navire + ' · ' + e.statut + ' · ' + e.id }; }), required: true, full: true },
        { name: 'client', label: 'Client', type: 'select', options: E.options('clients'), required: true },
        { name: 'poids', label: 'Poids brut (t)', type: 'number', step: '0.1' },
        { name: 'plomb', label: 'N° de plomb', placeholder: 'SL…' },
        { name: 'emplacement', label: 'Emplacement proposé', help: 'calculé selon le type de conteneur — modifiable' }
      ], values: { taille: 40, type: 'DRY', etat: 'Plein', sens: 'Export', client: state.site === 'POG' ? 'C-06' : 'C-01', escale: escs[0] ? escs[0].id : '' },
      onSubmit: function (v) {
        var id = String(v.id).toUpperCase().replace(/[\s-]/g, '');
        if (!/^[A-Z]{4}\d{7}$/.test(id)) { U.toast('Format attendu : 4 lettres + 7 chiffres.', 'err'); return false; }
        if (!isoValide(id)) { U.toast('Chiffre de contrôle ISO incorrect (attendu : ' + checkDigit(id.slice(0, 10)) + ').', 'err'); return false; }
        var ex = S.get('conteneurs', id); if (ex && ex.statut !== 'Sorti') { U.toast('Ce conteneur est déjà sur parc (' + ex.emplacement + ').', 'err'); return false; }
        var rec = { id: id, taille: +v.taille, type: v.type, etat: v.etat, sens: v.sens, escale: v.escale, client: v.client, site: state.site, poids: +v.poids || (v.etat === 'Vide' ? (+v.taille === 40 ? 3.8 : 2.2) : 0), plomb: v.plomb || '', entree: nowISO(), sortie: '', statut: v.sens === 'Export' && v.etat === 'Plein' ? 'À embarquer' : 'Sur parc', magJours: 0 };
        var loc = String(v.emplacement || '').toUpperCase().trim(); var pl = parseLoc(loc), b = bloc(pl.b);
        if (!loc) loc = blocPour(rec);
        else if (!b || b.site !== state.site || !(pl.r >= 1 && pl.r <= b.rows && pl.t >= 1 && pl.t <= b.bays && pl.n >= 1 && pl.n <= b.tiers) || onPark().some(function (c) { return c.emplacement === loc; })) { U.toast('Emplacement invalide ou occupé : ' + loc, 'err'); return false; }
        if (!loc) { U.toast('Parc plein : aucun emplacement libre.', 'err'); return false; }
        rec.emplacement = loc; rec.bloc = parseLoc(loc).b;
        if (ex) S.remove('conteneurs', id);
        S.add('conteneurs', rec);
        addMvt({ date: rec.entree, type: 'Entrée gate', conteneur: id, site: state.site, escale: v.escale, camion: v.camion, grue: '' });
        E.log('Entrée gate ' + id, rec.taille + '\' ' + rec.type + ' ' + rec.etat + ' → ' + loc, 'terminal');
        U.toast('Conteneur ' + isoTxt(id) + ' reçu — emplacement ' + loc); E.rerender();
      } });
    var f = m.el.querySelector('form'), box = m.el.querySelector('#gi-chk');
    function upd(ev) {
      var v = {}; E.$$('input,select', f).forEach(function (i) { v[i.name] = i.value; });
      if (!ev || ev.target.name !== 'emplacement') { var sug = blocPour({ site: state.site, type: v.type, etat: v.etat, sens: v.sens }); f.querySelector('[name=emplacement]').value = sug || ''; }
      var id = String(v.id || '').toUpperCase().replace(/[\s-]/g, '');
      box.innerHTML = !id ? '' : /^[A-Z]{4}\d{7}$/.test(id) ? (isoValide(id) ? '<div class="alert tone-green" style="margin-bottom:12px">' + E.icon('check') + '<div>N° ' + esc(isoTxt(id)) + ' valide (ISO 6346).</div></div>' : '<div class="alert tone-red" style="margin-bottom:12px">' + E.icon('alert') + '<div>Chiffre de contrôle incorrect : attendu <b>' + checkDigit(id.slice(0, 10)) + '</b>.</div></div>') : '<div class="alert tone-orange" style="margin-bottom:12px">' + E.icon('info') + '<div>Format : 4 lettres (propriétaire + U) et 7 chiffres.</div></div>';
    }
    f.addEventListener('input', upd); f.addEventListener('change', upd); upd();
  }
  function gateOut(preId) {
    var cand = onPark().filter(function (c) { return c.site === state.site && c.statut === 'Sur parc'; }).sort(function (a, b) { return a.id.localeCompare(b.id); });
    if (preId) { var pc = S.get('conteneurs', preId); if (pc && cand.indexOf(pc) < 0) cand.unshift(pc); }
    if (!cand.length) { U.toast('Aucun conteneur sur parc à livrer.', 'err'); return; }
    var m = U.formModal({ title: 'Sortie gate — ' + siteCourt(state.site), sub: 'Livraison d\'un conteneur au destinataire (bon à enlever)', okLabel: 'Valider la sortie',
      intro: '<div id="go-info"></div>',
      fields: [
        { name: 'id', label: 'Conteneur', type: 'select', options: cand.map(function (c) { return { v: c.id, l: isoTxt(c.id) + ' · ' + c.taille + '\' ' + c.etat + ' · ' + c.emplacement + ' · ' + jours(c) + ' j' }; }), required: true, full: true },
        { name: 'camion', label: 'Immatriculation du camion', required: true, placeholder: '1234 G1 A' },
        { name: 'bae', label: 'N° du bon à enlever', required: true, placeholder: 'BAE-…' }
      ], values: { id: preId || cand[0].id },
      onSubmit: function (v) {
        var c = S.get('conteneurs', v.id); if (!c) return false;
        if (aFacturer(c) > 0) { factMag(c); }
        var old = c.emplacement; c.statut = 'Sorti'; c.sortie = nowISO(); S.save();
        addMvt({ date: c.sortie, type: 'Sortie gate', conteneur: c.id, site: c.site, escale: c.escale, camion: v.camion, grue: '', ref: v.bae });
        E.log('Sortie gate ' + c.id, 'camion ' + v.camion + ' · ' + v.bae + ' · libère ' + old, 'terminal');
        U.toast('Sortie validée — ' + isoTxt(c.id)); E.rerender();
      } });
    var f = m.el.querySelector('form'), box = m.el.querySelector('#go-info');
    function upd() { var c = S.get('conteneurs', f.querySelector('[name=id]').value); if (!c) return; var af = aFacturer(c); box.innerHTML = '<div class="alert tone-' + (af > 0 ? 'orange' : 'blue') + '" style="margin-bottom:12px">' + E.icon(af > 0 ? 'clock' : 'info') + '<div>' + esc(clientNom(c.client)) + ' · ' + esc(navire(c.escale)) + ' · ' + jours(c) + ' j sur parc.' + (af > 0 ? ' <b>' + af + ' j de magasinage</b> seront transmis à la facturation (' + F.money(af * pu(c)) + ').' : '') + '</div></div>'; }
    f.addEventListener('change', upd); upd();
  }
  function vGate(el) {
    var mv = S.all('mouvementsTerminal').filter(function (m) { return m.site === state.site; }).slice(0, 60);
    var td = S.all('mouvementsTerminal').filter(function (m) { return m.site === state.site && String(m.date).slice(0, 10) === E.today(); });
    var hours = []; for (var h = 6; h <= 20; h += 2) hours.push(h);
    var cnt = function (type) { return hours.map(function (h) { return td.filter(function (m) { return m.type === type && +String(m.date).slice(11, 13) >= h && +String(m.date).slice(11, 13) < h + 2; }).length; }); };
    var cols = [
      { key: 'date', label: 'Date', render: function (m) { return '<span class="nowrap">' + fdt(m.date) + '</span>'; } },
      { key: 'type', label: 'Mouvement', render: function (m) { var t = { 'Entrée gate': 'green', 'Sortie gate': 'orange', 'Débarquement': 'blue', 'Embarquement': 'violet', 'Transfert': 'grey' }[m.type]; return U.badge(m.type, t); }, csv: function (m) { return m.type; } },
      { key: 'conteneur', label: 'Conteneur', render: function (m) { return '<a class="mono" href="#/terminal/conteneurs/' + esc(m.conteneur) + '">' + esc(isoTxt(m.conteneur)) + '</a>'; }, csv: function (m) { return m.conteneur; } },
      { key: 'escale', label: 'Navire', render: function (m) { return esc(navire(m.escale)); }, csv: function (m) { return navire(m.escale); } },
      { key: 'camion', label: 'Camion / grue', render: function (m) { return esc(m.camion || m.grue || ''); }, csv: function (m) { return m.camion || m.grue || ''; } },
      { key: 'ref', label: 'Référence', render: function (m) { return esc(m.ref || ''); } },
      { key: 'user', label: 'Agent' }
    ];
    el.innerHTML =
      '<div class="grid g-2-1">' +
        '<div class="card"><div class="card__h"><h3>Passages au gate aujourd\'hui</h3><span class="sub">par tranche de 2 heures</span></div><div class="card__b">' + U.bars({ labels: hours.map(function (h) { return pad(h) + 'h'; }), series: [{ name: 'Entrées', values: cnt('Entrée gate'), color: '#1e9e4a' }, { name: 'Sorties', values: cnt('Sortie gate'), color: '#e8780c' }], height: 200 }) + '</div></div>' +
        '<div class="card"><div class="card__h"><h3>Opérations gate</h3></div><div class="card__b stack">' +
          '<button class="ter-gbtn in" id="g-in">' + E.icon('plus') + '<div><b>Entrée gate</b><span>Conteneur export ou vide reçu par camion</span></div></button>' +
          '<button class="ter-gbtn out" id="g-out">' + E.icon('logout') + '<div><b>Sortie gate</b><span>Livraison import sur bon à enlever</span></div></button>' +
          '<div class="ter-stats sm"><div><span>Entrées</span><b>' + td.filter(function (m) { return m.type === 'Entrée gate'; }).length + '</b></div><div><span>Sorties</span><b>' + td.filter(function (m) { return m.type === 'Sortie gate'; }).length + '</b></div><div><span>Navire</span><b>' + td.filter(function (m) { return m.type === 'Débarquement' || m.type === 'Embarquement'; }).length + '</b></div></div>' +
        '</div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:16px"><div class="card__h"><h3>Journal des mouvements</h3><span class="sub">60 derniers · ' + esc(siteCourt(state.site)) + '</span><span class="spacer"></span><button class="btn sm" id="g-csv">' + E.icon('download') + 'CSV</button></div>' + U.table(cols, mv, { empty: 'Aucun mouvement' }) + '</div>';
    el.querySelector('#g-in').onclick = function () { gateIn(); };
    el.querySelector('#g-out').onclick = function () { gateOut(); };
    el.querySelector('#g-csv').onclick = function () { U.exportCSV('mouvements-terminal-' + state.site.toLowerCase() + '-' + E.today(), cols, S.all('mouvementsTerminal').filter(function (m) { return m.site === state.site; })); };
  }

  /* ---------- magasin cale & parc véhicules ---------- */
  function vEnt(el) {
    var site = state.site, info = SITE_INFO[site], lots = S.all('entreposage').filter(function (l) { return l.site === site; });
    var zone = function (z) { return lots.filter(function (l) { return l.zone === z && l.statut === 'En stock'; }); };
    var mag = zone('Magasin cale'), veh = zone('Parc véhicules'), sm = sum(mag, 'surface'), sv = sum(veh, 'surface');
    var pm = sm / info.magasin * 100, pv = sv / info.vehicules * 100, nVeh = sum(veh.filter(function (l) { return l.unite === 'véhicules'; }), 'quantite');
    var cols = function () {
      return [
        { key: 'libelle', label: 'Lot', render: function (l) { return '<b>' + esc(l.libelle) + '</b><div class="small muted mono">' + esc(l.id) + '</div>'; }, csv: function (l) { return l.libelle; } },
        { key: 'quantite', label: 'Quantité', num: 1, render: function (l) { return F.num(l.quantite) + ' ' + esc(l.unite); } },
        { key: 'surface', label: 'Surface', num: 1, render: function (l) { return F.num(l.surface) + ' m²'; } },
        { key: 'client', label: 'Client', render: function (l) { return esc(clientNom(l.client)); }, csv: function (l) { return clientNom(l.client); } },
        { key: 'escale', label: 'Navire', render: function (l) { return esc(navire(l.escale)); }, csv: function (l) { return navire(l.escale); } },
        { key: 'entree', label: 'Entrée', render: function (l) { var j = E.daysBetween(l.entree, E.today()); return F.dateShort(l.entree) + ' <span class="small ' + (j > FRANCHISE ? 'ter-neg' : 'muted') + '">' + j + ' j</span>'; } },
        { key: 'act', label: '', render: function (l) { return '<button class="btn sm" data-lot="' + l.id + '">Sortie</button>'; }, csv: function () { return ''; } }
      ];
    };
    el.innerHTML =
      '<div class="grid g2 stack-m">' +
        '<div class="card"><div class="card__h"><div class="list__icon tone-blue">' + E.icon('box') + '</div><div><h3>Magasin cale</h3><span class="sub">' + F.num(info.magasin) + ' m² couverts' + (site === 'POG' ? ' (démo)' : '') + '</span></div></div><div class="card__b ter-zone">' + U.gauge(pm, F.num(sm) + ' m² occupés sur ' + F.num(info.magasin) + ' m²', pm > 85 ? '#d93636' : pm > 65 ? '#e8780c' : '#1e9e4a') + '<div class="ter-stats sm"><div><span>Lots</span><b>' + mag.length + '</b></div><div><span>Libre</span><b>' + F.num(Math.max(0, info.magasin - sm)) + ' m²</b></div></div></div></div>' +
        '<div class="card"><div class="card__h"><div class="list__icon tone-violet">' + E.icon('truck') + '</div><div><h3>Parc véhicules</h3><span class="sub">' + (site === 'OWE' ? '1,2 ha' : F.num(info.vehicules) + ' m² (démo)') + ' · ' + M2_VEHICULE + ' m² par véhicule (hypothèse)</span></div></div><div class="card__b ter-zone">' + U.gauge(pv, F.num(sv) + ' m² occupés sur ' + F.num(info.vehicules) + ' m²', pv > 85 ? '#d93636' : pv > 65 ? '#e8780c' : '#1e9e4a') + '<div class="ter-stats sm"><div><span>Véhicules</span><b>' + F.num(nVeh) + '</b></div><div><span>Places libres (est.)</span><b>' + F.num(Math.max(0, Math.floor((info.vehicules - sv) / M2_VEHICULE))) + '</b></div></div></div></div>' +
      '</div>' +
      ['Magasin cale', 'Parc véhicules'].map(function (z) { var l = zone(z); return '<div class="card" style="margin-top:16px"><div class="card__h"><h3>' + z + ' — lots en stock</h3><span class="sub">' + l.length + '</span><span class="spacer"></span><button class="btn sm primary" data-new="' + z + '">' + E.icon('plus') + 'Entrée de lot</button></div>' + U.table(cols(), l, { empty: 'Aucun lot en stock' }) + '</div>'; }).join('');
    E.$$('[data-lot]', el).forEach(function (b) { b.onclick = function () { lotOut(b.dataset.lot); }; });
    E.$$('[data-new]', el).forEach(function (b) { b.onclick = function () { lotIn(b.dataset.new); }; });
  }
  function lotIn(zone) {
    var info = SITE_INFO[state.site], escs = S.all('escales').filter(function (e) { return e.site === state.site && e.statut !== 'Annulée' && e.statut !== 'Annoncée'; }).sort(function (a, b) { return String(b.eta).localeCompare(String(a.eta)); });
    U.formModal({ title: 'Entrée de lot — ' + zone, sub: siteCourt(state.site), okLabel: 'Enregistrer', fields: [
      { name: 'libelle', label: 'Désignation', required: true, full: true, placeholder: zone === 'Parc véhicules' ? 'Véhicules neufs…' : 'Marchandise…' },
      { name: 'quantite', label: 'Quantité', type: 'number', step: '1', required: true },
      { name: 'unite', label: 'Unité', type: 'select', options: zone === 'Parc véhicules' ? ['véhicules', 'engins'] : ['t', 'colis', 'palettes', 'sacs'], required: true },
      { name: 'surface', label: 'Surface occupée (m²)', type: 'number', step: '1', help: zone === 'Parc véhicules' ? 'laisser vide : ' + M2_VEHICULE + ' m² par véhicule' : '' },
      { name: 'client', label: 'Client', type: 'select', options: E.options('clients'), required: true },
      { name: 'escale', label: 'Navire', type: 'select', options: escs.map(function (e) { return { v: e.id, l: e.navire + ' · ' + e.id }; }), required: true, full: true }
    ], onSubmit: function (v) {
      var surf = +v.surface || (zone === 'Parc véhicules' ? +v.quantite * (v.unite === 'engins' ? 40 : M2_VEHICULE) : 0);
      if (!(surf > 0)) { U.toast('Indiquez la surface occupée.', 'err'); return false; }
      var used = sum(S.all('entreposage').filter(function (l) { return l.site === state.site && l.zone === zone && l.statut === 'En stock'; }), 'surface'), cap = zone === 'Magasin cale' ? info.magasin : info.vehicules;
      if (used + surf > cap) { U.toast('Capacité dépassée : ' + F.num(cap - used) + ' m² disponibles.', 'err'); return false; }
      var n = Math.max.apply(null, S.raw('entreposage').map(function (l) { return +String(l.id).slice(-3) || 0; }).concat([310])) + 1;
      S.add('entreposage', { id: 'LOT-2026-' + n, site: state.site, zone: zone, libelle: v.libelle, client: v.client, escale: v.escale, quantite: +v.quantite, unite: v.unite, surface: surf, entree: E.today(), statut: 'En stock' });
      E.log('Entrée ' + zone.toLowerCase() + ' LOT-2026-' + n, v.libelle + ' · ' + F.num(surf) + ' m²', 'terminal'); U.toast('Lot enregistré — ' + F.num(surf) + ' m²'); E.rerender();
    } });
  }
  function lotOut(id) {
    var l = S.get('entreposage', id); if (!l) return;
    U.formModal({ title: 'Sortie — ' + l.libelle, sub: l.id + ' · ' + F.num(l.quantite) + ' ' + l.unite + ' en stock', size: 'sm', okLabel: 'Valider la sortie', fields: [{ name: 'q', label: 'Quantité sortie (' + l.unite + ')', type: 'number', step: '1', required: true, full: true }], values: { q: l.quantite }, onSubmit: function (v) {
      var q = +v.q; if (!(q > 0 && q <= l.quantite)) { U.toast('Quantité invalide (1 à ' + l.quantite + ').', 'err'); return false; }
      var ratio = q / l.quantite; l.surface = Math.round(l.surface * (1 - ratio)); l.quantite -= q; if (l.quantite <= 0) { l.statut = 'Sorti'; l.sortie = E.today(); } S.save();
      E.log('Sortie ' + l.zone.toLowerCase() + ' ' + id, F.num(q) + ' ' + l.unite + ' · ' + l.libelle, 'terminal'); U.toast(l.statut === 'Sorti' ? 'Lot entièrement sorti' : 'Sortie partielle enregistrée — reste ' + F.num(l.quantite) + ' ' + l.unite); E.rerender();
    } });
  }

  /* ---------- alertes de stationnement ---------- */
  function vAlertes(el) {
    var list = alertes(state.site), af = list.filter(function (c) { return aFacturer(c) > 0; }), tot = sum(af, function (c) { return aFacturer(c) * pu(c); });
    var cols = [
      { key: 'id', label: 'Conteneur', render: function (c) { return '<b class="mono">' + esc(isoTxt(c.id)) + '</b><div class="small muted">' + c.taille + '\' ' + esc(c.type) + ' · ' + esc(c.etat) + '</div>'; }, csv: function (c) { return c.id; } },
      { key: 'client', label: 'Client', render: function (c) { return esc(clientNom(c.client)); }, csv: function (c) { return clientNom(c.client); } },
      { key: 'escale', label: 'Navire', render: function (c) { return esc(navire(c.escale)); }, csv: function (c) { return navire(c.escale); } },
      { key: 'emplacement', label: 'Emplacement', render: function (c) { return '<span class="mono">' + esc(c.emplacement) + '</span>'; } },
      { key: 'entree', label: 'Entrée', render: function (c) { return F.dateShort(c.entree.slice(0, 10)); } },
      { key: 'jours', label: 'Jours', num: 1, render: function (c) { var j = jours(c); return '<b class="ter-neg">' + j + '</b>' + U.progress(Math.min(100, j / 30 * 100), j > 20 ? 'red' : 'orange').replace('class="pbar"', 'class="pbar ter-jbar"'); }, csv: function (c) { return jours(c); } },
      { key: 'mag', label: 'À facturer', num: 1, render: function (c) { var d = aFacturer(c); return d > 0 ? '<b>' + d + ' j</b><div class="small muted">' + F.money(d * pu(c)) + '</div>' : U.badge('Facturé', 'green'); }, csv: function (c) { return aFacturer(c) * pu(c); } },
      { key: 'act', label: '', render: function (c) { return aFacturer(c) > 0 ? '<button class="btn sm accent" data-mag="' + c.id + '">' + E.icon('invoice') + 'Prestation</button>' : ''; }, csv: function () { return ''; } }
    ];
    el.innerHTML =
      '<div class="alert tone-orange" style="margin-bottom:16px">' + E.icon('clock') + '<div>Franchise de <b>' + FRANCHISE + ' jours</b> de stationnement ; au-delà, chaque jour est facturé en magasinage (tarifs fictifs de démonstration : ' + F.money(TARIFS.j20) + ' / jour pour un 20\', ' + F.money(TARIFS.j40) + ' pour un 40\', + ' + F.money(TARIFS.reeferJour) + ' de branchement frigorifique).</div></div>' +
      '<div class="card"><div class="card__h"><h3>Conteneurs en stationnement prolongé</h3><span class="sub">' + list.length + ' conteneur(s) · ' + F.money(tot) + ' de magasinage à facturer</span><span class="spacer"></span><button class="btn sm" id="al-csv">' + E.icon('download') + 'CSV</button>' + (af.length ? '<button class="btn sm primary" id="al-all">' + E.icon('invoice') + 'Tout transmettre (' + af.length + ')</button>' : '') + '</div>' +
      U.table(cols, list, { onRow: function (c) { openCtn(c.id); }, empty: 'Aucun conteneur au-delà de ' + FRANCHISE + ' jours' }) + '</div>';
    E.$$('[data-mag]', el).forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); factMag(S.get('conteneurs', b.dataset.mag)); E.rerender(); }; });
    el.querySelector('#al-csv').onclick = function () { U.exportCSV('stationnement-prolonge-' + state.site.toLowerCase() + '-' + E.today(), cols, list); };
    var all = el.querySelector('#al-all'); if (all) all.onclick = function () {
      U.confirm('Transmettre le magasinage', af.length + ' prestation(s) de magasinage pour <b>' + F.money(tot) + '</b> HT seront transmises au module Finances.', 'Transmettre', function () {
        var t = 0; af.forEach(function (c) { var d = aFacturer(c); if (d <= 0) return; t += d * pu(c); S.add('prestations', { id: S.next('PRS'), escale: c.escale, client: c.client, date: E.today(), libelle: 'Magasinage conteneur ' + isoTxt(c.id) + ' (' + c.taille + '\' ' + c.type + ') — jours ' + (FRANCHISE + (c.magJours || 0) + 1) + ' à ' + (FRANCHISE + (c.magJours || 0) + d), qte: d, unite: 'jour', pu: pu(c), statut: 'À facturer', source: 'terminal', ref: c.id, site: c.site }); c.magJours = (c.magJours || 0) + d; });
        S.save(); E.log('Magasinage transmis en lot', af.length + ' conteneurs · ' + F.money(t), 'terminal'); E.notify('Magasinage à facturer', af.length + ' conteneurs · ' + F.money(t) + ' HT', '#/terminal/alertes', 'orange');
        U.toast(af.length + ' prestations de magasinage transmises'); E.rerender();
      });
    };
  }

  /* ------------------------------------------------------------------ enregistrement */
  E.register({
    id: 'terminal', label: 'Terminal & conteneurs', title: 'Terminal & conteneurs', icon: 'container', group: 'Exploitation portuaire', roles: ['exploitation', 'commercial'],
    seed: seed,
    render: render,
    summary: function () {
      var sc = E.scope(), today = cad().filter(function (c) { return c.date === E.today(); });
      var f = sc ? siteFill(sc) : (function () { var a = siteFill('OWE'), b = siteFill('POG'), cap = a.cap + b.cap; return { evp: a.evp + b.evp, cap: cap, pct: cap ? (a.evp + b.evp) / cap * 100 : 0 }; })();
      var parc = onPark().length;
      return [
        { label: sc === 'POG' ? 'Occupation du parc de Port-Gentil' : sc === 'OWE' ? 'Occupation du parc d\'Owendo' : 'Occupation des parcs à conteneurs', value: F.num(f.pct), unit: '%', icon: 'container', tone: f.pct > 85 ? 'red' : 'blue', foot: F.num(f.evp) + ' EVP sur parc · ' + alertes().length + ' conteneur(s) > 10 j', href: '#/terminal/parc' },
        sc === 'POG' ? { label: 'Conteneurs sur parc', value: String(parc), icon: 'layers', tone: 'blue', foot: 'opérations aux apparaux de bord · pas de grue mobile', href: '#/terminal/conteneurs' } : { label: 'Cadence moyenne des grues', value: today.length ? F.num(sum(today, 'mvts') / today.length, 1) : '—', unit: 'mvts/h', icon: 'crane', tone: today.length && sum(today, 'mvts') / today.length >= OBJ_MIN ? 'green' : 'orange', foot: 'objectif ' + OBJ_MIN + '–' + OBJ_MAX + ' · aujourd\'hui', href: '#/terminal/cadences' }
      ];
    },
    pending: function () {
      var al = alertes().filter(function (c) { return aFacturer(c) > 0; });
      return al.length ? [{ title: 'Magasinage à facturer · ' + al.length + ' conteneur(s)', sub: 'Stationnement au-delà de ' + FRANCHISE + ' jours · ' + F.money(sum(al, function (c) { return aFacturer(c) * pu(c); })) + ' HT', date: E.today(), href: '#/terminal/alertes', tone: 'orange' }] : [];
    },
    search: function (q) {
      var qq = q.replace(/[\s-]/g, '');
      return ctns().filter(function (c) { return E.norm(c.id).indexOf(qq) >= 0; }).slice(0, 8).map(function (c) { return { title: 'Conteneur ' + isoTxt(c.id), sub: c.statut + ' · ' + (c.emplacement || '—') + ' · ' + siteCourt(c.site), href: '#/terminal/conteneurs/' + c.id }; });
    },
    badge: function () { return alertes().filter(function (c) { return aFacturer(c) > 0; }).length; }
  });
})();
