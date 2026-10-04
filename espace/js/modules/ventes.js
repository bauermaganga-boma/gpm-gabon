/* GPM · Espace de gestion — module « Facturation & clients » (Commercial & Finances).
   Grille tarifaire → prestations réalisées (escales, services maritimes, terminal, soutage) → factures (TVA)
   → encaissements → relances / avoirs → encours et balance âgée par armateur ou consignataire.
   Collections : tarifs, prestations (partagée avec les modules d'exploitation), factures, encaissements,
   avoirs, devisClients, paramFacturation. Clients : collection commune « clients ». */
(function () {
  'use strict';
  var E = window.ERP; if (!E) return;
  var S = E.store, U = E.ui, F = E.fmt, esc = E.esc, ic = E.icon, MOD = 'ventes';

  /* Activités facturées (répartition du chiffre d'affaires) */
  var ACTS = [
    { k: 'Manutention', c: '#06284f' }, { k: 'Services maritimes', c: '#3a75c4' }, { k: 'Soutage & eau', c: '#009e60' },
    { k: 'Magasinage', c: '#f2b705' }, { k: 'Redevances', c: '#e8780c' }
  ];
  var ACT_C = {}; ACTS.forEach(function (a) { ACT_C[a.k] = a.c; });
  var MODES = ['Virement', 'Chèque', 'Espèces'];
  var BANQUES = ['BGFIBank Gabon', 'UGB', 'BICIG', 'Orabank Gabon', 'Ecobank Gabon'];
  var FLOW = ['Brouillon', 'Émise', 'Partiellement payée', 'Payée'];
  var DV_TONE = { 'Brouillon': 'grey', 'Envoyé': 'blue', 'Accepté': 'green', 'Refusé': 'red', 'Converti': 'violet', 'Expiré': 'grey' };
  var FA_TONE = { 'Brouillon': 'grey', 'Émise': 'blue', 'Partiellement payée': 'orange', 'Payée': 'green', 'Annulée': 'grey' };

  /* ------------------------------------------------------------------ utilitaires */
  function d(n) { return E.addDays(E.today(), n); }
  function today() { return E.today(); }
  function me() { var u = E.session.user(); return u ? u.name : 'Système'; }
  function prof() { var u = E.session.user(); return u ? u.profile : ''; }
  function canFin() { return prof() === 'admin' || prof() === 'finance'; }
  function M(n) { return F.short(n) + ' FCFA'; }
  function firstOfMonth(k) { return E.iso(new Date(E.TODAY.getFullYear(), E.TODAY.getMonth() + (k || 0), 1)); }
  function cl(id) { return S.get('clients', id) || { id: id, nom: id || '—', type: '', ville: '', plafond: 0, delai: 30 }; }
  function clNom(id) { return cl(id).nom; }
  function tarifs() { return S.all('tarifs').filter(function (t) { return t && t.libelle && t.pu != null; }); }
  function tarif(id) { return S.get('tarifs', id); }
  function cfg() { var c = S.get('paramFacturation', 'cfg'); if (!c) { c = { id: 'cfg', tva: 18 }; S.all('paramFacturation').push(c); S.save(); } return c; }
  function escalesAll() { if (S.has('escales') && S.all('escales').length) return S.all('escales'); return (window.GPM_DATA && window.GPM_DATA.escalesDefaut) || []; }
  function escale(id) { return id ? escalesAll().find(function (x) { return x.id === id; }) : null; }
  function siteNom(id) { return id === 'POG' ? 'Port-Gentil' : id === 'OWE' ? 'Owendo' : (id || '—'); }
  /* Numérotation des factures par port : FAC-OWE-2026-0101, FAC-POG-2026-0101 (les anciennes FAC-2026-xxxx restent valables). */
  function facNum(site) { return S.next('FAC-' + (site === 'POG' ? 'POG' : 'OWE')); }
  function siteDe(clientId) { var c = S.get('clients', clientId); return c && c.ville === 'Port-Gentil' ? 'POG' : 'OWE'; }
  /* Signataire et lieu des documents selon le port */
  function signataire(site) { return site === 'POG' ? { t: 'La Responsable administrative et financière — Port-Gentil', n: 'Gisèle Boukandou', lieu: 'Port-Gentil' } : { t: 'La Directrice administrative et financière', n: 'Christelle Moussounda', lieu: 'Owendo' }; }
  /* Clients utiles dans l'espace actif (référentiel commun) : ceux qui ont une activité sur le site, ou basés dans sa ville */
  function siteClients() {
    var sc = E.scope(), all = S.all('clients'); if (!sc) return all;
    var act = {}; facts().forEach(function (f) { act[f.client] = 1; }); prs().forEach(function (p) { act[p.client] = 1; }); S.all('devisClients').forEach(function (o) { act[o.client] = 1; });
    return all.filter(function (c) { return act[c.id] || (sc === 'POG' ? c.ville === 'Port-Gentil' : c.ville !== 'Port-Gentil'); });
  }

  /* Montant en toutes lettres */
  var UN = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  var DIZ = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
  function lt100(n) { if (n < 20) return UN[n]; var t = Math.floor(n / 10), u = n % 10; if (t === 7 || t === 9) return DIZ[t] + (t === 7 && u === 1 ? ' et ' : '-') + UN[10 + u]; if (u === 0) return DIZ[t] + (t === 8 ? 's' : ''); if (u === 1 && t !== 8) return DIZ[t] + ' et un'; return DIZ[t] + '-' + UN[u]; }
  function lt1000(n) { var c = Math.floor(n / 100), r = n % 100, s = ''; if (c > 1) s = UN[c] + ' cent' + (r === 0 ? 's' : ''); else if (c === 1) s = 'cent'; if (r) s += (s ? ' ' : '') + lt100(r); return s; }
  function enLettres(n) { n = Math.round(Math.abs(n)); if (!n) return 'Zéro'; var p = [], md = Math.floor(n / 1e9), mi = Math.floor(n % 1e9 / 1e6), k = Math.floor(n % 1e6 / 1e3), r = n % 1000; if (md) p.push(lt1000(md) + ' milliard' + (md > 1 ? 's' : '')); if (mi) p.push(lt1000(mi) + ' million' + (mi > 1 ? 's' : '')); if (k) p.push(k === 1 ? 'mille' : lt1000(k).replace(/(cent|vingt)s$/, '$1') + ' mille'); if (r) p.push(lt1000(r)); var s = p.join(' '); return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ------------------------------------------------------------------ grille tarifaire
     Tarifs fictifs de démonstration, à remplacer par le tarif officiel (barème GPM / OPRAG en vigueur). */
  var TARIFS0 = [
    { id: 'T-PIL', libelle: 'Pilotage (entrée ou sortie)', activite: 'Services maritimes', unite: 'GT', pu: 18, base: 'par GT (tonnage de jauge) et par mouvement' },
    { id: 'T-REM', libelle: 'Remorquage', activite: 'Services maritimes', unite: 'heure', pu: 650000, base: 'par remorqueur et par heure engagée' },
    { id: 'T-LAM', libelle: 'Lamanage (amarrage / largage)', activite: 'Services maritimes', unite: 'opération', pu: 185000, base: 'par opération' },
    { id: 'T-EAU', libelle: 'Fourniture d\'eau douce', activite: 'Soutage & eau', unite: 'm³', pu: 2800, base: 'au m³ livré (Port-Gentil)' },
    { id: 'T-MGO', libelle: 'Soutage gasoil marin (MGO)', activite: 'Soutage & eau', unite: 'm³', pu: 690000, marge: 45000, base: 'au m³ livré, marge GPM incluse' },
    { id: 'T-IFO', libelle: 'Soutage fioul marin (IFO 380)', activite: 'Soutage & eau', unite: 'm³', pu: 470000, marge: 38000, base: 'au m³ livré, marge GPM incluse' },
    { id: 'T-EVP', libelle: 'Manutention conteneur plein', activite: 'Manutention', unite: 'EVP', pu: 85000, base: 'par EVP plein (bord ↔ parc)' },
    { id: 'T-EVV', libelle: 'Manutention conteneur vide', activite: 'Manutention', unite: 'EVP', pu: 42000, base: 'par EVP vide (bord ↔ parc)' },
    { id: 'T-ROR', libelle: 'Manutention véhicule roulier (RoRo)', activite: 'Manutention', unite: 'unité', pu: 45000, base: 'par véhicule débarqué ou embarqué' },
    { id: 'T-CONV', libelle: 'Manutention conventionnel / vrac', activite: 'Manutention', unite: 't', pu: 5200, base: 'à la tonne manutentionnée' },
    { id: 'T-MAG', libelle: 'Magasinage conteneur', activite: 'Magasinage', unite: 'EVP/jour', pu: 3500, base: 'par EVP et par jour au-delà de la franchise' },
    { id: 'T-HAN', libelle: 'Magasinage sous hangar', activite: 'Magasinage', unite: 't/jour', pu: 900, base: 'par tonne et par jour (magasin couvert)' },
    { id: 'T-QUA', libelle: 'Redevance d\'usage du quai', activite: 'Redevances', unite: 'm/jour', pu: 4200, base: 'par mètre de longueur hors tout et par jour' }
  ];

  /* ------------------------------------------------------------------ données d'exemple (relatives à aujourd'hui) */
  var NAVIRES = {
    'C-01': ['MV Atlantic Akanda', 'MV Atlantic Mondah', 'MV Atlantic Pongara', 'MV Atlantic Ntem'],
    'C-02': ['MV Gulf Pioneer', 'MV Gulf Trader', 'MV Gulf Spirit'],
    'C-03': ['MV Cap Esterias', 'MV Équateur Star', 'MV Komo River'],
    'C-04': ['MV Ro-Ro Estuaire', 'MV Ro-Ro Libreville'],
    'C-05': ['PSV Offshore Mandji', 'PSV Ogooué Supplier', 'AHTS Cap Lopez'],
    'C-06': ['MV Cap Lopez Express', 'MT Mandji Bunker'],
    'C-07': ['MV Ogooué Cargo', 'MV Nyanga Trader'],
    'C-08': ['MT Ogooué Star', 'MT West Gentil', 'MT Atlantic Breeze']
  };
  function L(tid, qte, lib) { var t = TARIFS0.find(function (x) { return x.id === tid; }); return { tarif: tid, libelle: lib || t.libelle, activite: t.activite, qte: qte, unite: t.unite, pu: t.pu }; }
  function lignesTypes(c, r, navire) {
    var gt, loa, j, out = [];
    function nav(g, lo, days, tugs, h) { out.push(L('T-PIL', g * 2, 'Pilotage entrée et sortie — ' + F.num(g) + ' GT')); out.push(L('T-REM', tugs * h, 'Remorquage — ' + tugs + ' remorqueur(s), entrée et sortie')); out.push(L('T-LAM', 2)); out.push(L('T-QUA', lo * days, 'Redevance de quai — ' + lo + ' m × ' + days + ' j')); }
    if (c === 'C-01' || c === 'C-02' || c === 'C-03') {
      gt = 18000 + Math.round(r() * 14) * 1000; loa = 168 + Math.round(r() * 22); j = 2;
      var evp = 700 + Math.round(r() * 11) * 50, vide = Math.round(evp * (0.15 + r() * 0.1));
      nav(gt, loa, j, 2, 3);
      out.push(L('T-EVP', evp - vide)); out.push(L('T-EVV', vide));
      out.push(L('T-MAG', Math.round(evp * 0.25) * 4, 'Magasinage conteneurs — dépassement de franchise'));
      return { site: 'OWE', lignes: out, evp: evp };
    }
    if (c === 'C-04') { gt = 38000 + Math.round(r() * 8) * 1000; nav(gt, 199, 2, 2, 3); out.push(L('T-ROR', 260 + Math.round(r() * 20) * 10)); return { site: 'OWE', lignes: out }; }
    if (c === 'C-05') { gt = 2400 + Math.round(r() * 12) * 100; nav(gt, 70 + Math.round(r() * 10), 2, 1, 2); out.push(L('T-EAU', 250 + Math.round(r() * 10) * 25)); out.push(L('T-MGO', 60 + Math.round(r() * 8) * 10)); return { site: 'POG', lignes: out }; }
    if (c === 'C-06') { out.push(L('T-MGO', 120 + Math.round(r() * 12) * 10)); out.push(L('T-EAU', 150 + Math.round(r() * 8) * 25)); out.push(L('T-QUA', 132, 'Redevance de quai — appontement soutage')); return { site: 'POG', lignes: out }; }
    if (c === 'C-07') { var t = 1400 + Math.round(r() * 16) * 100; out.push(L('T-CONV', t, 'Manutention marchandises diverses — ' + F.num(t) + ' t')); out.push(L('T-HAN', Math.round(t * 0.4) * 6, 'Magasinage sous hangar — 6 jours')); return { site: 'OWE', lignes: out }; }
    gt = 16000 + Math.round(r() * 10) * 1000; nav(gt, 145, 1, 2, 4); out.push(L('T-IFO', 150 + Math.round(r() * 10) * 10)); return { site: navire.indexOf('Gentil') >= 0 ? 'POG' : 'OWE', lignes: out };
  }

  function seed() {
    if (S.has('factures')) return null;
    var r0 = 20261; function rnd() { r0 = (r0 * 16807) % 2147483647; return r0 / 2147483647; }
    var tva = 18, C = {}; S.all('clients').forEach(function (c) { C[c.id] = c; });
    var ORDER = ['C-01', 'C-02', 'C-05', 'C-03', 'C-06', 'C-04', 'C-08', 'C-01', 'C-07', 'C-02'];
    var PAY = { 'C-01': 'ontime', 'C-02': 'ontime', 'C-03': 'late', 'C-04': 'ontime', 'C-05': 'partial', 'C-06': 'ontime', 'C-07': 'bad', 'C-08': 'ontime' };
    var offs = []; for (var i = 0; i < 27; i++) offs.push(-178 + i * 6 + Math.round(rnd() * 3));
    offs.push(-2, -1, 0);
    var factures = [], enc = [], ki = {}, escN = 330;
    offs.forEach(function (o, i) {
      var c = ORDER[i % ORDER.length], navs = NAVIRES[c]; ki[c] = (ki[c] || 0) + 1;
      var navire = navs[ki[c] % navs.length], t = lignesTypes(c, rnd, navire), date = d(Math.min(0, o));
      var f = { id: S.next('FAC-' + t.site), type: 'Facture', client: c, escale: 'ESC-2026-0' + (escN + i * 2), navire: navire, site: t.site, date: date, echeance: E.addDays(date, (C[c] || {}).delai || 30), tva: tva, lignes: t.lignes, statut: i >= 29 ? 'Brouillon' : 'Émise', relances: [], historique: [{ at: date, user: 'Christelle Moussounda', action: 'Facture créée' }] };
      if (f.statut === 'Émise') f.historique.push({ at: date, user: 'Christelle Moussounda', action: 'Facture validée et émise' });
      factures.push(f);
    });
    function ttc(f) { var ht = E.sum(f.lignes, function (l) { return l.qte * l.pu; }); return Math.round(ht) + Math.round(ht * f.tva / 100); }
    function pay(f, date, mt, mode) { if (date > today()) return; if (date < f.date) date = f.date; var m = mode || (mt < 3e6 ? 'Chèque' : 'Virement'); enc.push({ id: '', site: f.site, facture: f.id, client: f.client, date: date, montant: Math.round(mt), mode: m, banque: BANQUES[enc.length % BANQUES.length], reference: '' }); }
    var badN = 0;
    factures.forEach(function (f) {
      if (f.statut !== 'Émise') return;
      var tt = ttc(f), dl = (C[f.client] || {}).delai || 30, p = PAY[f.client];
      if (p === 'ontime') pay(f, E.addDays(f.date, dl - 4 - Math.round(rnd() * 6)), tt);
      else if (p === 'late') pay(f, E.addDays(f.date, dl + 38), tt);
      else if (p === 'partial') { pay(f, E.addDays(f.date, dl - 2), tt * 0.5); pay(f, E.addDays(f.date, dl + 28), tt * 0.5); }
      else if (p === 'bad') { badN++; if (badN === 1) pay(f, E.addDays(f.date, dl + 45), tt * 0.3, 'Chèque'); }
    });
    enc.sort(function (a, b) { return a.date.localeCompare(b.date); });
    enc.forEach(function (e, i) { e.id = S.next('ENC'); e.reference = e.mode === 'Chèque' ? 'CHQ ' + (402100 + i * 13) : 'VIR-' + e.date.replace(/-/g, '').slice(2) + '-' + String(100 + (i * 37) % 900); });
    /* relances déjà envoyées sur les factures très en retard */
    factures.forEach(function (f) {
      var paid = E.sum(enc.filter(function (e) { return e.facture === f.id; }), 'montant');
      var late = E.daysBetween(f.echeance, today());
      if (f.statut === 'Émise' && paid < ttc(f) - 1 && late > 20) { f.relances.push({ date: E.addDays(f.echeance, 10), niveau: 1, user: 'Irène Matsanga' }); if (late > 60) f.relances.push({ date: E.addDays(f.echeance, 45), niveau: 2, user: 'Christelle Moussounda' }); }
    });
    /* devis armateurs */
    var devis = [
      { c: 'C-02', off: -24, objet: 'Nouvelle rotation hebdomadaire — porte-conteneurs 1 000 EVP', st: 'Accepté', lignes: [L('T-PIL', 52000), L('T-REM', 6), L('T-LAM', 2), L('T-QUA', 360), L('T-EVP', 820), L('T-EVV', 180)] },
      { c: 'C-04', off: -12, objet: 'Escale roulier — 450 véhicules neufs', st: 'Envoyé', lignes: [L('T-PIL', 84000), L('T-REM', 6), L('T-LAM', 2), L('T-QUA', 398), L('T-ROR', 450)] },
      { c: 'C-05', off: -8, objet: 'Ravitaillement mensuel de 3 PSV — eau douce et soutage', st: 'Envoyé', lignes: [L('T-EAU', 1800), L('T-MGO', 360), L('T-QUA', 450)] },
      { c: 'C-08', off: -40, objet: 'Escale pétrolier produits — Owendo poste 4', st: 'Refusé', lignes: [L('T-PIL', 46000), L('T-REM', 8), L('T-LAM', 2), L('T-QUA', 290)] },
      { c: 'C-07', off: -3, objet: 'Lot de 2 400 t de marchandises diverses', st: 'Brouillon', lignes: [L('T-CONV', 2400), L('T-HAN', 5760)] }
    ].map(function (x) { var dt = d(x.off); return { id: S.next('DEV'), site: (C[x.c] || {}).ville === 'Port-Gentil' ? 'POG' : 'OWE', client: x.c, date: dt, validite: E.addDays(dt, 30), objet: x.objet, lignes: x.lignes, statut: x.st, historique: [{ at: dt, user: 'Nadia Ogoula', action: 'Devis créé' }].concat(x.st !== 'Brouillon' ? [{ at: E.addDays(dt, 1), user: 'Nadia Ogoula', action: 'Envoyé au client' }] : []).concat(x.st === 'Accepté' ? [{ at: E.addDays(dt, 6), user: 'Stéphane Ella', action: 'Accepté par le client' }] : x.st === 'Refusé' ? [{ at: E.addDays(dt, 9), user: 'Stéphane Ella', action: 'Refusé : tarif jugé élevé' }] : []) }; });
    return {
      tarifs: TARIFS0.map(function (t) { return Object.assign({}, t, { maj: d(-60) }); }),
      factures: factures, encaissements: enc, avoirs: [], devisClients: devis,
      paramFacturation: [{ id: 'cfg', tva: 18 }],
      prestations: demoPrestations()
    };
  }
  /* Prestations réalisées non encore facturées (alimentées en production par les modules Escales, Services, Terminal, Soutage) */
  function demoPrestations() {
    function p(i, esc, c, off, tid, qte, src, lib) { var t = TARIFS0.find(function (x) { return x.id === tid; }); return { id: 'PRS-D' + String(i).padStart(3, '0'), site: esc === 'ESC-2026-0420' ? 'POG' : 'OWE', escale: esc, client: c, date: d(off), libelle: lib || t.libelle, tarif: tid, activite: t.activite, qte: qte, unite: t.unite, pu: t.pu, statut: 'À facturer', source: src }; }
    return [
      p(1, 'ESC-2026-0409', 'C-01', -4, 'T-PIL', 26500, 'services', 'Pilotage entrée — 26 500 GT'),
      p(2, 'ESC-2026-0409', 'C-01', -2, 'T-PIL', 26500, 'services', 'Pilotage sortie — 26 500 GT'),
      p(3, 'ESC-2026-0409', 'C-01', -2, 'T-REM', 6, 'services', 'Remorquage — 2 remorqueurs, entrée et sortie'),
      p(4, 'ESC-2026-0409', 'C-01', -2, 'T-LAM', 2, 'services'),
      p(5, 'ESC-2026-0409', 'C-01', -2, 'T-QUA', 360, 'escales', 'Redevance de quai — 180 m × 2 j'),
      p(6, 'ESC-2026-0409', 'C-01', -2, 'T-EVP', 1010, 'terminal'),
      p(7, 'ESC-2026-0409', 'C-01', -2, 'T-EVV', 200, 'terminal'),
      p(8, 'ESC-2026-0414', 'C-04', -2, 'T-PIL', 41000, 'services', 'Pilotage entrée — 41 000 GT'),
      p(9, 'ESC-2026-0414', 'C-04', -1, 'T-ROR', 357, 'terminal', 'Débarquement véhicules (RoRo) — situation partielle'),
      p(10, 'ESC-2026-0420', 'C-05', -1, 'T-EAU', 420, 'soutage', 'Eau douce livrée — appontement POG-P3'),
      p(11, 'ESC-2026-0420', 'C-05', -1, 'T-PIL', 5200, 'services', 'Pilotage entrée — 2 600 GT')
    ];
  }
  function init() {
    var c = cfg();
    /* rattachement au bon site : règlements et avoirs suivent leur facture, prestations leur escale */
    var FS = {}, ES = {}, ch = false;
    S.raw('factures').forEach(function (f) { if (f && f.site) FS[f.id] = f.site; });
    S.raw('escales').forEach(function (e) { if (e && e.site) ES[e.id] = e.site; });
    ['encaissements', 'avoirs'].forEach(function (col) { S.raw(col).forEach(function (r) { if (r && FS[r.facture] && r.site !== FS[r.facture]) { r.site = FS[r.facture]; ch = true; } }); });
    S.raw('prestations').forEach(function (p) { if (p && p.escale && ES[p.escale] && p.site !== ES[p.escale]) { p.site = ES[p.escale]; ch = true; } });
    if (ch) S.save();
    if (!c.seedPrs) { var have = {}; S.all('prestations').forEach(function (p) { have[p.id] = 1; }); var arr = S.all('prestations'); demoPrestations().forEach(function (p) { if (!have[p.id]) arr.push(p); }); c.seedPrs = true; S.save(); }
    var T = S.all('tarifs'), ids = {}; T.forEach(function (t) { ids[t.id] = 1; }); var add = TARIFS0.filter(function (t) { return !ids[t.id]; });
    if (add.length) { add.forEach(function (t) { T.push(Object.assign({}, t, { maj: d(-60) })); }); S.save(); }
  }

  /* ------------------------------------------------------------------ calculs */
  function facts() { return S.all('factures'); }
  function encs() { return S.all('encaissements'); }
  function lineHT(l) { return (+l.qte || 0) * (+l.pu || 0); }
  function faHT(f) { return Math.round(E.sum(f.lignes || [], lineHT)); }
  function faTVA(f) { return Math.round(faHT(f) * (f.tva != null ? f.tva : cfg().tva) / 100); }
  function faTTC(f) { return faHT(f) + faTVA(f); }
  function paid(f) { return E.sum(encs().filter(function (e) { return e.facture === f.id; }), 'montant'); }
  function reste(f) { return f.statut === 'Brouillon' || f.statut === 'Annulée' ? 0 : Math.max(0, faTTC(f) - paid(f)); }
  function statut(f) { if (f.statut === 'Brouillon' || f.statut === 'Annulée') return f.statut; var p = paid(f); if (faTTC(f) - p <= 1) return 'Payée'; if (p > 0) return 'Partiellement payée'; return 'Émise'; }
  function retard(f) { return E.daysBetween(f.echeance, today()); }
  function isEchue(f) { return reste(f) > 1 && f.echeance < today(); }
  function lastRel(f) { return (f.relances || []).reduce(function (m, r) { return Math.max(m, r.niveau); }, 0); }
  function relanceDue(f) { if (!isEchue(f)) return false; var j = retard(f), n = j > 60 ? 3 : j > 30 ? 2 : 1; return n > lastRel(f); }
  function emises() { return facts().filter(function (f) { return f.statut !== 'Brouillon' && f.statut !== 'Annulée'; }); }
  function openF(cid) { return emises().filter(function (f) { return reste(f) > 1 && (!cid || f.client === cid); }); }
  function encours(cid) { return E.sum(openF(cid), reste); }
  function echu(cid) { return E.sum(openF(cid).filter(isEchue), reste); }
  function avoirsHT(a, b) { return E.sum(S.all('avoirs').filter(function (x) { return x.date >= a && x.date <= b; }), function (x) { return x.ht || 0; }); }
  function caPeriod(a, b, cid) { return E.sum(emises().filter(function (f) { return f.date >= a && f.date <= b && (!cid || f.client === cid); }), faHT) - (cid ? 0 : avoirsHT(a, b)); }
  function caMois(k) { var a = firstOfMonth(k), b = E.addDays(firstOfMonth(k + 1), -1); return caPeriod(a, b); }
  function actOf(l) {
    if (l.activite) return l.activite; var t = l.tarif && tarif(l.tarif); if (t) return t.activite;
    var s = E.norm((l.libelle || '') + ' ' + (l.source || ''));
    if (/soutage|eau|mgo|ifo|gasoil|fioul|bunker/.test(s)) return 'Soutage & eau';
    if (/magasin|stockage|entrepos|hangar/.test(s)) return 'Magasinage';
    if (/pilot|remorq|laman|amarr|vedette|services/.test(s)) return 'Services maritimes';
    if (/quai|redevance|droit|escales/.test(s)) return 'Redevances';
    return 'Manutention';
  }
  function caParActivite(a, b) { var o = {}; ACTS.forEach(function (x) { o[x.k] = 0; }); emises().filter(function (f) { return f.date >= a && f.date <= b; }).forEach(function (f) { (f.lignes || []).forEach(function (l) { var k = actOf(l); o[k] = (o[k] || 0) + lineHT(l); }); }); return o; }
  var AGES = [{ l: 'Non échu', c: '#3a75c4', f: function (j) { return j <= 0; } }, { l: '0-30 j', c: '#f2b705', f: function (j) { return j > 0 && j <= 30; } }, { l: '31-60 j', c: '#e8780c', f: function (j) { return j > 30 && j <= 60; } }, { l: '61-90 j', c: '#d93636', f: function (j) { return j > 60 && j <= 90; } }, { l: '> 90 j', c: '#7f1d1d', f: function (j) { return j > 90; } }];
  function aging(cid) { var b = AGES.map(function () { return 0; }); openF(cid).forEach(function (f) { var j = retard(f); AGES.forEach(function (a, i) { if (a.f(j)) b[i] += reste(f); }); }); return b; }
  function dso() { var t90 = E.sum(emises().filter(function (f) { return f.date > d(-90); }), faTTC); return t90 ? encours() / t90 * 90 : 0; }
  function prs() { return S.all('prestations'); }
  function prsAF() { return prs().filter(function (p) { return (p.statut || 'À facturer') === 'À facturer'; }); }
  function prsGroups() {
    var g = {}; prsAF().forEach(function (p) { var k = (p.escale || 'Sans escale') + '|' + (p.client || ''); (g[k] = g[k] || { key: k, escale: p.escale, client: p.client, items: [] }).items.push(p); });
    return Object.keys(g).map(function (k) { var x = g[k]; x.ht = E.sum(x.items, lineHT); x.date = x.items.reduce(function (m, p) { return !m || p.date > m ? p.date : m; }, ''); return x; }).sort(function (a, b) { return b.ht - a.ht; });
  }
  function dvHT(o) { return Math.round(E.sum(o.lignes || [], lineHT)); }
  function dvStatut(o) { return o.statut === 'Envoyé' && o.validite < today() ? 'Expiré' : o.statut; }

  function faBadge(f) { var s = statut(f); return U.badge(s, FA_TONE[s]) + (isEchue(f) ? ' <span class="badge tone-red plain fac-late">échue ' + retard(f) + ' j</span>' : ''); }

  /* ------------------------------------------------------------------ documents imprimables */
  function docHead(title, num, rows) {
    return '<div class="fac-doc__head"><div class="fac-doc__brand"><img src="../assets/img/logo.svg" alt="GPM — Gabon Port Management"><div><b>Gabon Port Management S.A.</b><span>Siège : zone portuaire d\'Owendo — B.P. 394 Owendo, Libreville (Gabon)</span><span>Tél. 011 70 32 74 / 011 70 32 75 · Fax 011 70 31 40</span><span>Agence de Port-Gentil : B.P. 932 · Tél. 011 56 42 03</span><span>info.gpm@gpmgabon.com</span></div></div>' +
      '<div class="fac-doc__title"><h4>' + esc(title) + '</h4><div>N° <b>' + esc(num) + '</b></div>' + rows + '</div></div>';
  }
  function clientBlock(c) { return '<div><small>Facturé à</small><b>' + esc(c.nom) + '</b><br>' + esc(c.type || '') + '<br>' + esc(c.ville || '') + ', Gabon<br>Code client : ' + esc(c.id) + ' · paiement à ' + (c.delai || 30) + ' jours</div>'; }
  function linesDoc(lignes) {
    return '<div class="fac-doc__tw"><table class="fac-doc__tbl"><thead><tr><th>#</th><th>Désignation</th><th class="num">Quantité</th><th>Unité</th><th class="num">P.U. HT</th><th class="num">Montant HT</th></tr></thead><tbody>' +
      lignes.map(function (l, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(l.libelle) + '<span class="fac-doc__act">' + esc(actOf(l)) + '</span></td><td class="num">' + F.num(l.qte) + '</td><td>' + esc(l.unite || '') + '</td><td class="num">' + F.num(l.pu) + '</td><td class="num">' + F.num(lineHT(l)) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function totalsDoc(ht, tauxTVA, extra) {
    var tva = Math.round(ht * tauxTVA / 100), ttc = ht + tva;
    return '<div class="fac-doc__tot"><div><span>Total HT</span><b>' + F.money(ht) + '</b></div><div><span>TVA ' + F.num(tauxTVA, tauxTVA % 1 ? 1 : 0) + ' %</span><b>' + F.money(tva) + '</b></div><div class="ttc"><span>Total TTC</span><span>' + F.money(ttc) + '</span></div>' + (extra || '') + '</div>' +
      '<div class="fac-doc__words">Arrêtée à la somme de : <b>' + esc(enLettres(ttc)) + ' francs CFA TTC</b>.</div>';
  }
  function factureDoc(f) {
    var c = cl(f.client), es = escale(f.escale), p = paid(f);
    var ext = p > 0 ? '<div><span>Déjà réglé</span><b>− ' + F.money(p) + '</b></div><div class="due"><span>Reste à payer</span><b>' + F.money(reste(f)) + '</b></div>' : '';
    return '<div class="doc fac-doc">' + docHead(f.statut === 'Brouillon' ? 'FACTURE (PROJET)' : 'FACTURE', f.id, '<div>Date : <b>' + F.date(f.date) + '</b></div><div>Échéance : <b>' + F.date(f.echeance) + '</b></div>') +
      '<div class="fac-doc__parties">' + clientBlock(c) + '<div><small>Escale / objet</small>' + (f.navire ? '<b>' + esc(f.navire) + '</b><br>' : '') + (f.escale ? 'Escale ' + esc(f.escale) + '<br>' : '') + 'Port ' + (f.site === 'POG' ? 'de Port-Gentil' : 'd\'Owendo') + (es && es.poste ? ' · ' + esc(E.posteName(es.poste)) : '') + '<br>' + (f.objet ? esc(f.objet) : 'Prestations portuaires et services aux navires') + '</div></div>' +
      linesDoc(f.lignes || []) + totalsDoc(faHT(f), f.tva != null ? f.tva : cfg().tva, ext) +
      '<div class="fac-doc__cond"><b>Modalités de règlement</b><ul><li>Règlement par virement au compte de Gabon Port Management S.A. (coordonnées bancaires à compléter), en rappelant le numéro de facture.</li><li>Quantités établies d\'après les relevés contradictoires d\'escale (pilotage, remorquage, manutention, bons de livraison).</li><li>Tout retard de paiement peut entraîner des pénalités et la suspension des prestations à crédit.</li><li><span class="fac-demo">Tarifs fictifs de démonstration, à remplacer par le tarif officiel.</span> TVA à ' + F.num(f.tva != null ? f.tva : cfg().tva) + ' % (taux paramétrable).</li></ul></div>' +
      '<div class="fac-doc__sign"><div>' + esc(signataire(f.site).t) + '<br><b>' + esc(signataire(f.site).n) + '</b>' + (f.statut !== 'Brouillon' ? '<em>✓ Facture validée et émise</em>' : '<em class="wait">En attente de validation</em>') + '</div><div>Cachet de la société</div></div>' +
      '<div class="fac-doc__foot">Gabon Port Management S.A. — concessionnaire de l\'exploitation partielle des ports d\'Owendo et de Port-Gentil pour le compte de l\'OPRAG · B.P. 394 Owendo · Document de démonstration</div></div>';
  }
  function devisDoc(o) {
    var c = cl(o.client);
    return '<div class="doc fac-doc">' + docHead('DEVIS', o.id, '<div>Date : <b>' + F.date(o.date) + '</b></div><div>Valable jusqu\'au : <b>' + F.date(o.validite) + '</b></div>') +
      '<div class="fac-doc__parties">' + clientBlock(c).replace('Facturé à', 'Client') + '<div><small>Objet</small><b>' + esc(o.objet) + '</b>' + (o.navire ? '<br>Navire : ' + esc(o.navire) : '') + '</div></div>' +
      linesDoc(o.lignes || []) + totalsDoc(dvHT(o), cfg().tva) +
      '<div class="fac-doc__cond"><b>Conditions</b><ul><li>Devis établi sur la base des caractéristiques déclarées du navire et des volumes prévisionnels ; facturation sur les quantités réellement constatées.</li><li><span class="fac-demo">Tarifs fictifs de démonstration, à remplacer par le tarif officiel.</span></li><li>Offre soumise à l\'acceptation de l\'encours client par la Direction administrative et financière.</li></ul></div>' +
      '<div class="fac-doc__sign"><div>La Directrice commerciale<br><b>Nadia Ogoula</b></div><div>Bon pour accord — le client<br><span class="muted">(date, nom, signature)</span></div></div>' +
      '<div class="fac-doc__foot">Gabon Port Management S.A. · B.P. 394 Owendo · Document de démonstration</div></div>';
  }
  function relanceDoc(f, niv) {
    var c = cl(f.client), lst = openF(f.client).filter(isEchue), tot = E.sum(lst, reste);
    var txt = niv >= 3 ? '<p>Malgré nos relances précédentes, les factures ci-dessous demeurent impayées. Nous vous mettons en demeure de régler la somme de <b>' + F.money(tot) + '</b> sous <b>huit (8) jours</b>. À défaut, les prestations à crédit seront suspendues pour vos prochaines escales.</p>'
      : niv === 2 ? '<p>Sauf erreur de notre part, les factures ci-dessous restent impayées malgré notre premier rappel. Nous vous remercions de procéder à leur règlement, soit <b>' + F.money(tot) + '</b>, sous quinze (15) jours.</p>'
        : '<p>Sauf erreur de notre part, le règlement des factures ci-dessous, arrivées à échéance, ne nous est pas encore parvenu. Nous vous remercions de bien vouloir procéder à leur paiement, soit <b>' + F.money(tot) + '</b>, dans les meilleurs délais.</p>';
    return '<div class="doc fac-doc">' + docHead(niv >= 3 ? 'MISE EN DEMEURE' : 'RELANCE N° ' + niv, f.id + '-R' + niv, '<div>' + signataire(f.site).lieu + ', le <b>' + F.date(today()) + '</b></div>') +
      '<div class="fac-doc__parties">' + clientBlock(c) + '<div><small>Contact</small>Direction administrative et financière — recouvrement<br>' + esc(signataire(f.site).n) + '</div></div>' +
      '<p>Madame, Monsieur,</p>' + txt +
      '<div class="fac-doc__tw"><table class="fac-doc__tbl"><thead><tr><th>Facture</th><th>Navire</th><th>Échéance</th><th class="num">Retard</th><th class="num">Reste dû TTC</th></tr></thead><tbody>' + lst.map(function (x) { return '<tr><td>' + esc(x.id) + '</td><td>' + esc(x.navire || '—') + '</td><td>' + F.dateShort(x.echeance) + '</td><td class="num">' + retard(x) + ' j</td><td class="num">' + F.num(reste(x)) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p style="margin-top:14px">Nous vous prions d\'agréer, Madame, Monsieur, l\'expression de nos salutations distinguées.</p>' +
      '<div class="fac-doc__sign"><div>' + esc(signataire(f.site).t) + '<br><b>' + esc(signataire(f.site).n) + '</b></div></div><div class="fac-doc__foot">Gabon Port Management S.A. · B.P. 394 Owendo · Document de démonstration</div></div>';
  }
  function printModal(m) {
    document.body.classList.add('fac-printing'); m.el.classList.add('fac-print-target');
    try { window.print(); } catch (e) { /* impression indisponible */ }
    setTimeout(function () { document.body.classList.remove('fac-printing'); m.el.classList.remove('fac-print-target'); }, 400);
  }

  /* ------------------------------------------------------------------ éditeur de lignes (grille tarifaire) */
  function lineEditor(id, lines, onChange) {
    var T = tarifs();
    function row(l) {
      l = l || {}; var t = l.tarif ? tarif(l.tarif) : null;
      return '<div class="fac-le__row"><select class="select" data-f="tarif" aria-label="Tarif"><option value="">— Ligne libre —</option>' + T.map(function (x) { return '<option value="' + x.id + '"' + (x.id === l.tarif ? ' selected' : '') + '>' + esc(x.libelle) + '</option>'; }).join('') + '</select>' +
        '<input class="input" data-f="libelle" placeholder="Désignation" value="' + esc(l.libelle || (t ? t.libelle : '')) + '">' +
        '<input class="input" data-f="qte" type="number" min="0" step="any" placeholder="Qté" value="' + (l.qte != null ? l.qte : '') + '">' +
        '<input class="input" data-f="unite" placeholder="Unité" value="' + esc(l.unite || (t ? t.unite : '')) + '">' +
        '<input class="input" data-f="pu" type="number" min="0" step="any" placeholder="P.U. HT" value="' + (l.pu != null ? l.pu : t ? t.pu : '') + '">' +
        '<button type="button" class="btn ghost icon" data-le-del aria-label="Supprimer la ligne">' + ic('trash') + '</button></div>';
    }
    var html = '<div class="fac-le" id="' + id + '"><div class="fac-le__head"><span>Tarif</span><span>Désignation</span><span>Quantité</span><span>Unité</span><span>P.U. HT</span><span></span></div><div class="fac-le__rows">' + (lines && lines.length ? lines : [{}]).map(row).join('') + '</div><div class="fac-le__foot"><button type="button" class="btn sm" data-le-add>' + ic('plus') + 'Ajouter une ligne</button><div class="fac-le__tot">Total HT : <b data-le-tot>—</b></div></div></div>';
    function el() { return document.getElementById(id); }
    function read() {
      return E.$$('.fac-le__row', el()).map(function (r) {
        var tid = r.querySelector('[data-f=tarif]').value, t = tid ? tarif(tid) : null;
        return { tarif: tid || '', activite: t ? t.activite : '', libelle: r.querySelector('[data-f=libelle]').value.trim() || (t ? t.libelle : 'Prestation'), qte: +r.querySelector('[data-f=qte]').value || 0, unite: r.querySelector('[data-f=unite]').value.trim(), pu: +r.querySelector('[data-f=pu]').value || 0 };
      }).filter(function (l) { return l.qte > 0; });
    }
    function upd() { var t = E.sum(read(), lineHT); el().querySelector('[data-le-tot]').textContent = F.money(t); if (onChange) onChange(t); }
    function bind() {
      var root = el(); if (!root) return;
      root.addEventListener('click', function (e) {
        if (e.target.closest('[data-le-add]')) { root.querySelector('.fac-le__rows').insertAdjacentHTML('beforeend', row({})); upd(); }
        var dl = e.target.closest('[data-le-del]'); if (dl) { if (E.$$('.fac-le__row', root).length > 1) dl.closest('.fac-le__row').remove(); else toast('Au moins une ligne est nécessaire.', 'err'); upd(); }
      });
      root.addEventListener('change', function (e) { var s = e.target.closest('[data-f=tarif]'); if (s && s.value) { var t = tarif(s.value), r = s.closest('.fac-le__row'); r.querySelector('[data-f=libelle]').value = t.libelle; r.querySelector('[data-f=unite]').value = t.unite; r.querySelector('[data-f=pu]').value = t.pu; upd(); } });
      root.addEventListener('input', upd); upd();
    }
    return { html: html, bind: bind, read: read };
  }
  function toast(m, k) { U.toast(m, k); }

  /* ------------------------------------------------------------------ vue principale */
  var TABS = [{ k: 'synthese', l: 'Synthèse' }, { k: 'afacturer', l: 'À facturer' }, { k: 'factures', l: 'Factures' }, { k: 'devis', l: 'Devis' }, { k: 'encaissements', l: 'Encaissements' }, { k: 'balance', l: 'Balance âgée' }, { k: 'clients', l: 'Clients' }, { k: 'tarifs', l: 'Grille tarifaire' }];
  var st = { tab: 'synthese', f: { fs: 'Toutes', q: '', cli: '' }, lim: 25 }, viewEl = null;
  function render(view, params) {
    viewEl = view; params = params || [];
    var tab = params[0] || 'synthese'; if (!TABS.some(function (t) { return t.k === tab; })) tab = 'synthese';
    if (st.tab !== tab) st.lim = 25; st.tab = tab;
    if (tab === 'clients' && params[1]) { drawClient(decodeURIComponent(params[1])); return; }
    draw();
    if (params[1]) { var id = decodeURIComponent(params[1]); setTimeout(function () { if (tab === 'devis') openDevis(id); else if (tab === 'factures' || tab === 'encaissements' || tab === 'balance') openFacture(id); }, 30); }
  }
  function here() { return location.hash.replace(/^#\/?/, '').split('/'); }
  function afterClose() { var p = here(); if (p[0] === MOD && p.length > 2) history.replaceState(null, '', '#/' + MOD + '/' + p[1]); }
  function refresh() { var p = here(); if (viewEl && p[0] === MOD) { var y = window.scrollY; if (p[1] === 'clients' && p[2]) drawClient(decodeURIComponent(p[2])); else draw(); window.scrollTo(0, y); } E.renderBadges(); }

  function head(actions) {
    return '<div class="fac-head"><div><h2>Facturation & clients</h2><p>' + (E.scope() ? esc(E.siteName(E.scope())) + ' · ' : '') + 'Armateurs et consignataires · prestations portuaires · factures, encaissements et recouvrement.</p></div><div class="fac-head__acts">' + actions + '</div></div>';
  }
  function draw() {
    var v = viewEl, nAF = prsGroups().length, nBr = facts().filter(function (f) { return f.statut === 'Brouillon'; }).length, nEch = emises().filter(isEchue).length;
    var acts = '';
    if (st.tab === 'synthese' || st.tab === 'factures') acts += '<button class="btn primary" data-act="new-fa">' + ic('plus') + 'Nouvelle facture</button>';
    if (st.tab === 'devis') acts += '<button class="btn primary" data-act="new-dv">' + ic('plus') + 'Nouveau devis</button>';
    if (st.tab === 'afacturer') acts += '<button class="btn primary" data-act="new-prs">' + ic('plus') + 'Ajouter une prestation</button>';
    if (st.tab === 'encaissements' || st.tab === 'factures' || st.tab === 'synthese') acts += '<button class="btn' + (st.tab === 'encaissements' ? ' primary' : '') + '" data-act="new-enc">' + ic('money') + 'Encaissement</button>';
    if (['factures', 'encaissements', 'balance', 'devis', 'tarifs'].indexOf(st.tab) >= 0) acts += '<button class="btn" data-act="csv">' + ic('download') + 'Export CSV</button>';
    v.innerHTML = '<div class="fac-root" id="fac-root">' + head(acts) +
      U.tabs(TABS.map(function (t) { return { k: t.k, l: t.l, n: t.k === 'afacturer' ? nAF || null : t.k === 'factures' ? (nBr + nEch) || null : null }; }), st.tab, function (k) { E.go(MOD + '/' + k); }) + '<div id="fac-body"></div></div>';
    var body = v.querySelector('#fac-body');
    ({ synthese: vSynth, afacturer: vAF, factures: vFact, devis: vDevis, encaissements: vEnc, balance: vBal, clients: vClients, tarifs: vTarifs })[st.tab](body);
    bindRoot(v.querySelector('#fac-root'));
  }
  function bindRoot(root) {
    root.addEventListener('click', function (e) {
      var a = e.target.closest('[data-act]'); if (!a || !root.contains(a)) return;
      var act = a.dataset.act, id = a.dataset.id;
      if (act === 'new-fa') newFacture();
      else if (act === 'new-dv') newDevis();
      else if (act === 'new-enc') newEnc();
      else if (act === 'new-prs') newPrestation();
      else if (act === 'csv') exportTab();
      else if (act === 'go') E.go(MOD + '/' + a.dataset.k);
      else if (act === 'fa') openFacture(id);
      else if (act === 'dv') openDevis(id);
      else if (act === 'cli') E.go(MOD + '/clients/' + id);
      else if (act === 'tar') editTarif(id);
      else if (act === 'bill') billGroup(a.dataset.k);
      else if (act === 'prs-del') delPrestation(id);
      else if (act === 'rel') sendRelance(id);
      else if (act === 'chip') { st.f[a.dataset.g] = a.dataset.v; st.lim = 25; draw(); }
      else if (act === 'more') { st.lim += 25; draw(); }
      else if (act === 'tva') editTVA();
      else if (act === 'edit-cli') editClient(id);
    });
  }

  /* ------------------------------------------------------------------ synthèse */
  function vSynth(body) {
    var caM = caMois(0), caP = caMois(-1), y0 = E.iso(new Date(E.TODAY.getFullYear(), 0, 1)), caY = caPeriod(y0, today());
    var enc = encours(), ech = echu(), groups = prsGroups(), afHT = E.sum(groups, 'ht'), ds = dso();
    var kp = '<div class="fac-kpis">' +
      U.kpi({ label: 'CA facturé · ' + F.month(today()), value: F.short(caM), unit: 'FCFA HT', icon: 'invoice', tone: 'blue', foot: 'mois précédent : ' + M(caP) }) +
      U.kpi({ label: 'CA facturé ' + E.TODAY.getFullYear() + ' (à date)', value: F.short(caY), unit: 'FCFA HT', icon: 'trend', tone: 'navy', foot: emises().filter(function (f) { return f.date >= y0; }).length + ' facture(s) émise(s)' }) +
      U.kpi({ label: 'Prestations à facturer', value: F.short(afHT), unit: 'FCFA HT', icon: 'inbox', tone: groups.length ? 'orange' : 'green', foot: groups.length + ' escale(s) / client(s) en attente' }) +
      U.kpi({ label: 'Encours clients', value: F.short(enc), unit: 'FCFA TTC', icon: 'wallet', tone: 'violet', foot: '<span class="down">' + M(ech) + ' échus</span>' }) +
      U.kpi({ label: 'Délai moyen d\'encaissement', value: F.num(ds), unit: 'jours', icon: 'clock', tone: ds > 40 ? 'red' : 'green', foot: 'objectif ≤ 35 jours' }) + '</div>';
    var labels = [], series = ACTS.map(function (a) { return { name: a.k, color: a.c, values: [] }; });
    for (var k = -5; k <= 0; k++) { var dt = new Date(E.TODAY.getFullYear(), E.TODAY.getMonth() + k, 1); labels.push(E.MOIS[dt.getMonth()]); var o = caParActivite(firstOfMonth(k), E.addDays(firstOfMonth(k + 1), -1)); series.forEach(function (s) { s.values.push(o[s.name] || 0); }); }
    var o6 = caParActivite(firstOfMonth(-5), today()), tot6 = E.sum(ACTS, function (a) { return o6[a.k]; });
    var donut = U.donut(ACTS.map(function (a) { return { label: a.k, value: Math.round(o6[a.k] || 0), color: a.c }; }).filter(function (x) { return x.value > 0; }), { money: true, center: F.short(tot6), sub: 'FCFA HT · 6 mois', size: 140 });
    var ages = aging(), totA = E.sum(ages) || 1;
    var ageBar = '<div class="fac-age big">' + ages.map(function (v, i) { return v ? '<i style="width:' + (v / totA * 100) + '%;background:' + AGES[i].c + '" title="' + esc(AGES[i].l + ' : ' + F.money(v)) + '"></i>' : ''; }).join('') + '</div><div class="legend" style="margin-top:10px">' + AGES.map(function (a, i) { return '<span><i style="background:' + a.c + '"></i>' + a.l + ' · <b>' + F.short(ages[i]) + '</b></span>'; }).join('') + '</div>';
    var fe = emises().filter(isEchue).sort(function (a, b) { return retard(b) - retard(a); });
    var feH = fe.length ? '<div class="list">' + fe.slice(0, 6).map(function (f) { return '<div class="list__item fac-click" data-act="fa" data-id="' + f.id + '"><div class="list__icon ' + (retard(f) > 60 ? 'tone-red' : 'tone-orange') + '">' + ic('alert') + '</div><div class="list__body"><b>' + esc(f.id) + ' · ' + esc(clNom(f.client)) + '</b><div class="small muted">' + esc(f.navire || '') + ' · échue depuis ' + retard(f) + ' j · ' + (lastRel(f) ? 'relance n° ' + lastRel(f) + ' envoyée' : 'non relancée') + '</div></div><div class="right nowrap"><b>' + F.short(reste(f)) + '</b><div class="small muted">FCFA</div></div></div>'; }).join('') + '</div>' : '<div class="empty">' + ic('check') + '<br>Aucune facture échue.</div>';
    var tops = siteClients().map(function (c) { return { c: c, v: caPeriod(firstOfMonth(-5), today(), c.id) }; }).filter(function (t) { return t.v > 0 || !E.scope(); }).sort(function (a, b) { return b.v - a.v; }), maxV = (tops[0] && tops[0].v) || 1;
    var topH = '<div class="list">' + tops.slice(0, 6).map(function (t) { return '<div class="list__item fac-click" data-act="cli" data-id="' + t.c.id + '">' + U.avatar(t.c.nom, null, true) + '<div class="list__body"><b>' + esc(t.c.nom) + '</b><div class="small muted">' + esc(t.c.type) + '</div>' + U.progress(t.v / maxV * 100) + '</div><div class="right nowrap"><b>' + F.short(t.v) + '</b><div class="small muted">FCFA HT</div></div></div>'; }).join('') + '</div>';
    body.innerHTML = '<div class="stack">' + kp +
      '<div class="grid g-2-1"><div class="card"><div class="card__h"><h3>Chiffre d\'affaires mensuel par activité</h3><span class="sub">6 derniers mois · HT · mois en cours partiel</span></div><div class="card__b">' + U.bars({ labels: labels, series: series, stacked: true, money: true, height: 240 }) + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Répartition par activité</h3><span class="sub">6 mois</span></div><div class="card__b">' + donut + '</div></div></div>' +
      '<div class="grid g2 stack-m"><div class="card"><div class="card__h"><h3>Factures échues</h3><span class="sub">' + fe.length + ' · ' + M(ech) + '</span><span class="spacer"></span><button class="btn sm" data-act="go" data-k="balance">Balance âgée</button></div>' + feH + '</div>' +
      '<div class="card"><div class="card__h"><h3>Principaux clients</h3><span class="sub">CA HT · 6 mois</span><span class="spacer"></span><button class="btn sm" data-act="go" data-k="clients">Tous les clients</button></div>' + topH + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Ancienneté de l\'encours</h3><span class="sub">' + M(enc) + ' TTC</span></div><div class="card__b">' + ageBar + '</div></div></div>';
  }

  /* ------------------------------------------------------------------ à facturer */
  function vAF(body) {
    var G = prsGroups(), done = prs().filter(function (p) { return p.statut === 'Facturé'; }).slice(0, 8);
    var SRC = { escales: 'Escales', services: 'Services maritimes', terminal: 'Terminal', soutage: 'Soutage', manuel: 'Saisie manuelle' };
    body.innerHTML = '<div class="stack"><div class="alert tone-blue">' + ic('info') + '<div>Les prestations réalisées remontent automatiquement des modules <b>Escales</b>, <b>Services maritimes</b>, <b>Terminal</b> et <b>Soutage</b>. Elles sont regroupées par escale et par client : une facture se crée en un clic, puis passe en validation.</div></div>' +
      (G.length ? '<div class="fac-groups">' + G.map(function (g) {
        var es = escale(g.escale), nav = es ? es.navire : (g.items[0].navire || '');
        return '<div class="card fac-group"><div class="card__h"><div class="list__icon tone-navy">' + ic('ship') + '</div><div style="min-width:0;flex:1"><h3>' + esc(nav || g.escale || 'Prestations diverses') + '</h3><div class="sub">' + esc(g.escale || 'Sans escale') + ' · ' + esc(clNom(g.client)) + '</div></div><div class="right"><div class="fac-big">' + F.short(g.ht) + '</div><div class="small muted">FCFA HT</div></div></div>' +
          '<div class="fac-group__items">' + g.items.map(function (p) { return '<div class="fac-pl"><div class="fac-pl__l"><b>' + esc(p.libelle) + '</b><span>' + F.dateShort(p.date) + ' · ' + F.num(p.qte) + ' ' + esc(p.unite || '') + ' × ' + F.num(p.pu) + ' · <i class="fac-src">' + esc(SRC[p.source] || p.source || '—') + '</i></span></div><b class="nowrap">' + F.num(lineHT(p)) + '</b><button class="btn ghost icon sm" data-act="prs-del" data-id="' + esc(p.id) + '" aria-label="Retirer cette prestation" title="Retirer">' + ic('x') + '</button></div>'; }).join('') + '</div>' +
          '<div class="fac-group__f"><span class="small muted">' + g.items.length + ' prestation(s) · TVA ' + cfg().tva + ' % en sus</span><button class="btn primary sm" data-act="bill" data-k="' + esc(g.key) + '">' + ic('invoice') + 'Créer la facture</button></div></div>';
      }).join('') + '</div>' : '<div class="card"><div class="empty">' + ic('check') + '<br>Toutes les prestations réalisées sont facturées.</div></div>') +
      (done.length ? '<div class="card"><div class="card__h"><h3>Dernières prestations facturées</h3></div>' + U.table([
        { label: 'Date', render: function (p) { return F.dateShort(p.date); } }, { label: 'Prestation', render: function (p) { return esc(p.libelle) + '<span class="fac-sub">' + esc(p.escale || '') + ' · ' + esc(clNom(p.client)) + '</span>'; } },
        { label: 'Montant HT', num: true, render: function (p) { return F.num(lineHT(p)); } }, { label: 'Facture', render: function (p) { return p.facture ? '<a href="#/ventes/factures/' + esc(p.facture) + '">' + esc(p.facture) + '</a>' : '—'; } }
      ], done) + '</div>' : '') + '</div>';
  }
  function billGroup(key) {
    var g = prsGroups().find(function (x) { return x.key === key; }); if (!g) return toast('Ce regroupement n\'existe plus.', 'err');
    var c = cl(g.client), es = escale(g.escale), date = today();
    var gSite = es ? es.site : (g.items[0].site || E.scope() || siteDe(g.client));
    var f = { id: facNum(gSite), type: 'Facture', client: g.client, escale: g.escale || '', navire: es ? es.navire : '', site: gSite, date: date, echeance: E.addDays(date, c.delai || 30), tva: cfg().tva, statut: 'Brouillon', relances: [],
      lignes: g.items.map(function (p) { return { tarif: p.tarif || '', activite: actOf(p), libelle: p.libelle, qte: p.qte, unite: p.unite, pu: p.pu, prestation: p.id }; }), historique: [{ at: new Date().toISOString(), user: me(), action: 'Facture créée depuis ' + g.items.length + ' prestation(s)' }] };
    S.add('factures', f);
    g.items.forEach(function (p) { p.statut = 'Facturé'; p.facture = f.id; }); S.save();
    E.log('Facture créée', f.id + ' — ' + c.nom + ' — ' + F.money(faTTC(f)) + ' TTC', MOD);
    E.notify('Facture à valider', f.id + ' — ' + c.nom, '#/ventes/factures/' + f.id, 'orange');
    toast('Facture ' + f.id + ' créée en brouillon (' + M(faTTC(f)) + ' TTC).');
    E.go(MOD + '/factures/' + f.id);
  }
  function delPrestation(id) {
    var p = S.get('prestations', id); if (!p) return;
    U.confirm('Retirer la prestation', 'Retirer « ' + esc(p.libelle) + ' » de la liste à facturer ? Elle sera marquée « Non facturable ».', 'Retirer', function () { p.statut = 'Non facturable'; S.save(); E.log('Prestation retirée de la facturation', p.libelle, MOD); toast('Prestation retirée.'); refresh(); }, 'danger');
  }
  function newPrestation() {
    var esL = escalesAll().map(function (x) { return { v: x.id, l: x.id + ' — ' + x.navire }; });
    U.formModal({ title: 'Ajouter une prestation à facturer', sub: 'Saisie manuelle (prestation exceptionnelle)', fields: [
      { name: 'client', label: 'Client', type: 'select', options: E.options('clients'), required: true },
      { name: 'escale', label: 'Escale', type: 'select', options: esL, empty: 'Sans escale' },
      { name: 'tarif', label: 'Tarif', type: 'select', options: tarifs().map(function (t) { return { v: t.id, l: t.libelle + ' (' + F.num(t.pu) + ' / ' + t.unite + ')' }; }), required: true },
      { name: 'qte', label: 'Quantité', type: 'number', required: true, min: 0, step: 'any' },
      { name: 'date', label: 'Date de réalisation', type: 'date', value: today(), required: true },
      { name: 'libelle', label: 'Désignation (facultatif)', placeholder: 'Laisser vide pour reprendre le libellé du tarif' }
    ], okLabel: 'Ajouter', onSubmit: function (v) {
      var t = tarif(v.tarif); if (!(v.qte > 0)) { toast('La quantité doit être positive.', 'err'); return false; }
      var es = escale(v.escale);
      S.add('prestations', { site: es ? es.site : (E.scope() || siteDe(v.client)), escale: v.escale || '', navire: es ? es.navire : '', client: v.client, date: v.date, libelle: v.libelle || t.libelle, tarif: t.id, activite: t.activite, qte: v.qte, unite: t.unite, pu: t.pu, statut: 'À facturer', source: 'manuel' }, 'PRS');
      E.log('Prestation ajoutée', t.libelle + ' — ' + clNom(v.client), MOD); toast('Prestation ajoutée à la liste à facturer.'); refresh();
    } });
  }

  /* ------------------------------------------------------------------ factures */
  var FA_COLS = [
    { label: 'N°', render: function (f) { return '<b>' + esc(f.id) + '</b>'; } },
    { label: 'Date', render: function (f) { return F.dateShort(f.date); } },
    { label: 'Client', render: function (f) { return esc(clNom(f.client)) + '<span class="fac-sub">' + esc(f.navire || '') + (f.escale ? ' · ' + esc(f.escale) : '') + '</span>'; } },
    { label: 'Port', site: true, render: function (f) { return siteNom(f.site); } },
    { label: 'Montant TTC', num: true, render: function (f) { return F.num(faTTC(f)); } },
    { label: 'Reste dû', num: true, render: function (f) { var r = reste(f); return r > 1 ? '<b class="' + (isEchue(f) ? 'fac-red' : '') + '">' + F.num(r) + '</b>' : '<span class="muted">0</span>'; } },
    { label: 'Échéance', render: function (f) { return F.dateShort(f.echeance); } },
    { label: 'Statut', render: faBadge }
  ];
  function faCols() { return E.scope() ? FA_COLS.filter(function (c) { return !c.site; }) : FA_COLS; }
  function faRows() {
    var s = st.f.fs, q = E.norm(st.f.q), c = st.f.cli;
    return facts().filter(function (f) {
      var x = statut(f);
      if (s === 'À valider' && x !== 'Brouillon') return false;
      if (s === 'Échues' && !isEchue(f)) return false;
      if (s === 'Non soldées' && !(reste(f) > 1)) return false;
      if (s === 'Payées' && x !== 'Payée') return false;
      if (c && f.client !== c) return false;
      return !q || E.norm(f.id + ' ' + clNom(f.client) + ' ' + (f.navire || '') + ' ' + (f.escale || '')).indexOf(q) >= 0;
    }).sort(function (a, b) { return b.date.localeCompare(a.date) || b.id.localeCompare(a.id); });
  }
  function vFact(body) {
    var rows = faRows(), shown = rows.slice(0, st.lim);
    var nBr = facts().filter(function (f) { return f.statut === 'Brouillon'; }).length, nE = emises().filter(isEchue).length;
    body.innerHTML = '<div class="card"><div class="card__b"><div class="filters"><input class="input" id="fa-q" type="search" placeholder="N°, client, navire, escale…" value="' + esc(st.f.q) + '"><select class="select" id="fa-cli"><option value="">Tous les clients</option>' + siteClients().map(function (c) { return '<option value="' + c.id + '"' + (st.f.cli === c.id ? ' selected' : '') + '>' + esc(c.nom) + '</option>'; }).join('') + '</select></div>' +
      '<div class="chips">' + ['Toutes', 'À valider', 'Non soldées', 'Échues', 'Payées'].map(function (x) { var n = x === 'À valider' ? nBr : x === 'Échues' ? nE : null; return '<button class="chip' + (st.f.fs === x ? ' is-active' : '') + '" data-act="chip" data-g="fs" data-v="' + x + '">' + x + (n ? ' · ' + n : '') + '</button>'; }).join('') + '</div></div>' +
      U.table(faCols(), shown, { onRow: function (f) { openFacture(f.id); }, empty: 'Aucune facture pour ces critères', footer: function () { return '<td colspan="' + (E.scope() ? 3 : 4) + '">' + rows.length + ' facture(s)</td><td class="num">' + F.num(E.sum(rows, faTTC)) + '</td><td class="num">' + F.num(E.sum(rows, reste)) + '</td><td colspan="2"></td>'; } }) +
      (rows.length > st.lim ? '<div class="fac-more"><button class="btn sm" data-act="more">Afficher plus (' + (rows.length - st.lim) + ')</button></div>' : '') + '</div>';
    body.querySelector('#fa-q').addEventListener('change', function (e) { st.f.q = e.target.value; draw(); });
    body.querySelector('#fa-cli').addEventListener('change', function (e) { st.f.cli = e.target.value; draw(); });
  }
  function factureForm(f, title, onSave) {
    var esL = escalesAll().map(function (x) { return { v: x.id, l: x.id + ' — ' + x.navire }; });
    if (f.escale && !esL.some(function (x) { return x.v === f.escale; })) esL.unshift({ v: f.escale, l: f.escale + (f.navire ? ' — ' + f.navire : '') });
    var ed = lineEditor('fac-le-' + Date.now(), f.lignes);
    var m = U.modal({ title: title, sub: 'Les lignes reprennent la grille tarifaire (modifiable ligne par ligne).', size: 'lg', onClose: afterClose,
      body: U.form([
        { name: 'client', label: 'Client', type: 'select', options: E.options('clients'), required: true },
        { name: 'date', label: 'Date de facture', type: 'date', required: true },
        { name: 'escale', label: 'Escale', type: 'select', options: esL, empty: 'Sans escale' },
        { name: 'navire', label: 'Navire', placeholder: 'ex. MV Atlantic Akanda' },
        { name: 'site', label: 'Port', type: 'select', options: E.scope() ? [{ v: E.scope(), l: siteNom(E.scope()) }] : [{ v: 'OWE', l: 'Owendo' }, { v: 'POG', l: 'Port-Gentil' }] },
        { name: 'objet', label: 'Objet', placeholder: 'Prestations portuaires et services aux navires' }
      ], f) + ed.html,
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer en brouillon', cls: 'primary', icon: 'check', onClick: function (close, el) {
        var v = U.readForm(el); if (!v) return; var lignes = ed.read(); if (!lignes.length) return toast('Ajoutez au moins une ligne avec une quantité.', 'err');
        var es = escale(v.escale); if (es && !v.navire) v.navire = es.navire;
        onSave(v, lignes); close();
      } }] });
    ed.bind();
    var sel = m.el.querySelector('[name=escale]'); if (sel) sel.addEventListener('change', function () { var es = escale(sel.value); if (es) { m.el.querySelector('[name=navire]').value = es.navire; m.el.querySelector('[name=site]').value = es.site || 'OWE'; if (es.client && S.get('clients', es.client)) m.el.querySelector('[name=client]').value = es.client; } });
    return m;
  }
  function newFacture(pre) {
    pre = pre || {};
    factureForm({ client: pre.client || (E.scope() === 'POG' ? 'C-05' : 'C-01'), date: today(), site: E.scope() || (pre.client ? siteDe(pre.client) : 'OWE'), lignes: pre.lignes || [{}], escale: pre.escale || '', navire: pre.navire || '', objet: pre.objet || '' }, 'Nouvelle facture', function (v, lignes) {
      var c = cl(v.client);
      var fSite = E.scope() || v.site || 'OWE';
      var f = { id: facNum(fSite), type: 'Facture', client: v.client, escale: v.escale, navire: v.navire, site: fSite, objet: v.objet, date: v.date, echeance: E.addDays(v.date, c.delai || 30), tva: cfg().tva, lignes: lignes, statut: 'Brouillon', relances: [], devis: pre.devis || '', historique: [{ at: new Date().toISOString(), user: me(), action: pre.devis ? 'Facture créée depuis le devis ' + pre.devis : 'Facture créée' }] };
      S.add('factures', f);
      if (pre.devis) { var o = S.get('devisClients', pre.devis); if (o) { o.statut = 'Converti'; o.facture = f.id; o.historique.push({ at: new Date().toISOString(), user: me(), action: 'Converti en facture ' + f.id }); S.save(); } }
      E.log('Facture créée', f.id + ' — ' + c.nom + ' — ' + F.money(faTTC(f)) + ' TTC', MOD);
      E.notify('Facture à valider', f.id + ' — ' + c.nom, '#/ventes/factures/' + f.id, 'orange');
      toast('Facture ' + f.id + ' enregistrée en brouillon.');
      if (here()[1] !== 'factures') E.go(MOD + '/factures/' + f.id); else { refresh(); openFacture(f.id); }
    });
  }
  function openFacture(id) {
    var f = S.get('factures', id); if (!f) { toast('Facture introuvable : ' + id, 'err'); return; }
    var s = statut(f), c = cl(f.client), es = encs().filter(function (e) { return e.facture === f.id; }), av = S.all('avoirs').filter(function (a) { return a.facture === f.id; });
    var stepI = s === 'Brouillon' ? 0 : s === 'Émise' ? 1 : s === 'Partiellement payée' ? 2 : 3;
    var side = '<div class="fac-side">' +
      '<div class="fac-side__box"><small>Montant TTC</small><b>' + F.money(faTTC(f)) + '</b><span>HT ' + F.money(faHT(f)) + ' · TVA ' + f.tva + ' %</span></div>' +
      (s !== 'Brouillon' ? '<div class="fac-side__box ' + (isEchue(f) ? 'red' : reste(f) > 1 ? '' : 'green') + '"><small>Reste à payer</small><b>' + F.money(reste(f)) + '</b><span>' + (isEchue(f) ? 'échue depuis ' + retard(f) + ' jours' : reste(f) > 1 ? 'échéance le ' + F.date(f.echeance) : 'soldée') + '</span></div>' : '') +
      '<div class="fac-side__sec"><b>Règlements</b>' + (es.length ? es.map(function (e) { return '<div class="fac-mini"><span>' + F.dateShort(e.date) + ' · ' + esc(e.mode) + '<i>' + esc(e.reference || '') + '</i></span><b>' + F.num(e.montant) + '</b></div>'; }).join('') : '<div class="small muted">Aucun règlement</div>') + '</div>' +
      ((f.relances || []).length ? '<div class="fac-side__sec"><b>Relances</b>' + f.relances.map(function (r) { return '<div class="fac-mini"><span>' + F.dateShort(r.date) + ' · ' + (r.niveau >= 3 ? 'Mise en demeure' : 'Relance n° ' + r.niveau) + '</span><i>' + esc(r.user || '') + '</i></div>'; }).join('') + '</div>' : '') +
      (av.length ? '<div class="fac-side__sec"><b>Avoirs</b>' + av.map(function (a) { return '<div class="fac-mini"><span>' + esc(a.id) + ' · ' + esc(a.motif) + '</span><b>−' + F.num(a.montant) + '</b></div>'; }).join('') + '</div>' : '') +
      '<div class="fac-side__sec"><b>Historique</b><div class="timeline">' + (f.historique || []).map(function (h) { return '<div class="tl-item done"><b>' + esc(h.action) + '</b><span>' + esc(h.user) + ' · ' + (String(h.at).length > 10 ? F.datetime(h.at) : F.date(h.at)) + '</span></div>'; }).join('') + '</div></div></div>';
    var acts = [];
    if (s === 'Brouillon') {
      acts.push({ label: 'Supprimer', cls: 'danger', icon: 'trash', onClick: function (close) { U.confirm('Supprimer le brouillon', 'Supprimer définitivement le brouillon ' + esc(f.id) + ' ? Les prestations liées redeviennent « à facturer ».', 'Supprimer', function () { prs().forEach(function (p) { if (p.facture === f.id) { p.statut = 'À facturer'; delete p.facture; } }); S.remove('factures', f.id); E.log('Brouillon supprimé', f.id, MOD); toast('Brouillon ' + f.id + ' supprimé.'); close(); refresh(); }, 'danger'); } });
      acts.push({ label: 'Modifier', icon: 'edit', onClick: function (close) { close(); factureForm(f, 'Modifier ' + f.id, function (v, lignes) { var cc = cl(v.client); Object.assign(f, { client: v.client, escale: v.escale, navire: v.navire, site: E.scope() || v.site || f.site, objet: v.objet, date: v.date, echeance: E.addDays(v.date, cc.delai || 30), lignes: lignes }); f.historique.push({ at: new Date().toISOString(), user: me(), action: 'Brouillon modifié' }); S.save(); E.log('Facture modifiée', f.id, MOD); toast('Brouillon mis à jour.'); refresh(); openFacture(f.id); }); } });
      acts.push({ label: canFin() ? 'Valider et émettre' : 'Valider (DAF)', cls: 'success', icon: 'check', onClick: function (close) {
        if (!canFin()) { toast('La validation des factures relève de la Direction administrative et financière.', 'err'); return; }
        var enc = encours(f.client) + faTTC(f);
        f.statut = 'Émise'; f.historique.push({ at: new Date().toISOString(), user: me(), action: 'Facture validée et émise' }); S.save();
        E.log('Facture émise', f.id + ' — ' + c.nom + ' — ' + F.money(faTTC(f)) + ' TTC', MOD);
        toast('Facture ' + f.id + ' émise. Échéance le ' + F.date(f.echeance) + '.');
        if (c.plafond && enc > c.plafond) { E.notify('Plafond d\'encours dépassé', c.nom + ' : ' + M(enc) + ' pour ' + M(c.plafond), '#/ventes/clients/' + c.id, 'red'); toast('Attention : encours de ' + c.nom + ' au-delà du plafond autorisé.', 'err'); }
        close(); refresh(); openFacture(f.id);
      } });
    } else if (s !== 'Annulée') {
      if (reste(f) > 1) acts.push({ label: 'Encaissement', icon: 'money', cls: 'success', onClick: function (close) { close(); newEnc(f.id); } });
      if (isEchue(f)) acts.push({ label: 'Relancer', icon: 'send', onClick: function (close) { close(); sendRelance(f.id); } });
      if (reste(f) > 1) acts.push({ label: 'Avoir', icon: 'refresh', onClick: function (close) { close(); newAvoir(f.id); } });
    }
    acts.push({ label: 'Imprimer', icon: 'print', cls: 'primary', onClick: function (c2, el) { printModal({ el: el }); } });
    var m = U.modal({ title: (s === 'Brouillon' ? 'Brouillon de facture ' : 'Facture ') + f.id, sub: esc(c.nom) + ' · ' + faBadge(f), size: 'lg', onClose: afterClose,
      body: '<div class="fac-steps">' + U.steps(FLOW, stepI, { finished: s === 'Payée' }) + '</div><div class="fac-detail"><div class="fac-detail__doc">' + factureDoc(f) + '</div>' + side + '</div>', actions: acts });
    return m;
  }

  /* ------------------------------------------------------------------ encaissements, relances, avoirs */
  function newEnc(fid) {
    var open = openF().sort(function (a, b) { return a.echeance.localeCompare(b.echeance); });
    if (!open.length) return toast('Aucune facture en attente de règlement.', 'err');
    var f0 = fid ? S.get('factures', fid) : open[0];
    var m = U.formModal({ title: 'Enregistrer un encaissement', sub: 'Virement, chèque ou espèces', fields: [
      { name: 'facture', label: 'Facture', type: 'select', required: true, full: true, options: open.map(function (f) { return { v: f.id, l: f.id + ' — ' + clNom(f.client) + ' — reste ' + F.num(reste(f)) + ' FCFA' }; }) },
      { name: 'montant', label: 'Montant reçu (FCFA)', type: 'number', required: true, min: 1 },
      { name: 'date', label: 'Date de valeur', type: 'date', value: today(), required: true },
      { name: 'mode', label: 'Mode de règlement', type: 'select', options: MODES },
      { name: 'banque', label: 'Banque', type: 'select', options: BANQUES },
      { name: 'reference', label: 'Référence (n° de virement / chèque / reçu)', full: true }
    ], values: { facture: f0.id, montant: reste(f0) }, okLabel: 'Enregistrer', onSubmit: function (v) {
      var f = S.get('factures', v.facture), r = reste(f);
      if (!(v.montant > 0)) { toast('Montant invalide.', 'err'); return false; }
      if (v.montant > r + 1) { toast('Le montant dépasse le reste dû (' + F.money(r) + ').', 'err'); return false; }
      var e = S.add('encaissements', { id: S.next('ENC'), site: f.site, facture: f.id, client: f.client, date: v.date, montant: Math.round(v.montant), mode: v.mode, banque: v.mode === 'Espèces' ? 'Caisse' : v.banque, reference: v.reference || (v.mode === 'Espèces' ? 'Reçu de caisse' : '') });
      f.historique = f.historique || []; f.historique.push({ at: new Date().toISOString(), user: me(), action: 'Encaissement ' + e.id + ' : ' + F.money(e.montant) + ' (' + e.mode + ')' }); S.save();
      E.log('Encaissement enregistré', e.id + ' — ' + f.id + ' — ' + F.money(e.montant), MOD);
      toast(statut(f) === 'Payée' ? 'Facture ' + f.id + ' soldée.' : 'Encaissement enregistré — reste ' + F.money(reste(f)) + '.');
      refresh();
    } });
    var sel = m.el.querySelector('[name=facture]'); sel.addEventListener('change', function () { var f = S.get('factures', sel.value); m.el.querySelector('[name=montant]').value = reste(f); });
  }
  function sendRelance(id) {
    var f = S.get('factures', id); if (!f) return;
    var niv = Math.min(3, lastRel(f) + 1);
    var m = U.modal({ title: (niv >= 3 ? 'Mise en demeure' : 'Relance n° ' + niv) + ' — ' + clNom(f.client), sub: 'Aperçu du courrier envoyé au client', size: 'lg', onClose: afterClose, body: relanceDoc(f, niv),
      actions: [{ label: 'Fermer' }, { label: 'Imprimer', icon: 'print', onClick: function (c, el) { printModal({ el: el }); } }, { label: 'Envoyer la relance', cls: 'primary', icon: 'send', onClick: function (close) {
        openF(f.client).filter(isEchue).forEach(function (x) { x.relances = x.relances || []; if (lastRel(x) < niv) x.relances.push({ date: today(), niveau: niv, user: me() }); });
        f.historique = f.historique || []; f.historique.push({ at: new Date().toISOString(), user: me(), action: (niv >= 3 ? 'Mise en demeure' : 'Relance n° ' + niv) + ' envoyée' }); S.save();
        E.log('Relance client', clNom(f.client) + ' — niveau ' + niv, MOD); toast('Relance envoyée à ' + clNom(f.client) + ' (simulation).'); close(); refresh();
      } }] });
    return m;
  }
  function newAvoir(id) {
    var f = S.get('factures', id); if (!f) return;
    U.formModal({ title: 'Établir un avoir sur ' + f.id, sub: 'Réduction ou annulation partielle — reste dû ' + F.money(reste(f)), fields: [
      { name: 'montant', label: 'Montant de l\'avoir TTC (FCFA)', type: 'number', required: true, min: 1 },
      { name: 'motif', label: 'Motif', type: 'select', options: ['Erreur de quantité', 'Geste commercial', 'Prestation non réalisée', 'Litige réglé à l\'amiable', 'Erreur de tarif'] },
      { name: 'note', label: 'Commentaire', type: 'textarea' }
    ], values: { montant: Math.round(reste(f) * 0.1) }, okLabel: 'Établir l\'avoir', onSubmit: function (v) {
      if (!(v.montant > 0) || v.montant > reste(f) + 1) { toast('Le montant doit être compris entre 1 et ' + F.money(reste(f)) + '.', 'err'); return false; }
      var a = S.add('avoirs', { id: S.next('AV'), site: f.site, facture: f.id, client: f.client, date: today(), montant: Math.round(v.montant), ht: Math.round(v.montant / (1 + (f.tva || 18) / 100)), motif: v.motif, note: v.note, user: me() });
      S.add('encaissements', { id: S.next('ENC'), site: f.site, facture: f.id, client: f.client, date: today(), montant: a.montant, mode: 'Avoir', banque: '—', reference: a.id });
      f.historique.push({ at: new Date().toISOString(), user: me(), action: 'Avoir ' + a.id + ' : ' + F.money(a.montant) + ' (' + v.motif + ')' }); S.save();
      E.log('Avoir établi', a.id + ' sur ' + f.id + ' — ' + F.money(a.montant), MOD); toast('Avoir ' + a.id + ' établi.'); refresh(); setTimeout(function () { openFacture(f.id); }, 50);
    } });
  }

  /* ------------------------------------------------------------------ devis */
  function vDevis(body) {
    var all = S.all('devisClients').slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    var pipe = all.filter(function (o) { var s = dvStatut(o); return s === 'Envoyé' || s === 'Accepté'; });
    var dec = all.filter(function (o) { return ['Accepté', 'Converti', 'Refusé'].indexOf(o.statut) >= 0; }), won = dec.filter(function (o) { return o.statut !== 'Refusé'; });
    body.innerHTML = '<div class="stack"><div class="fac-kpis">' + U.kpi({ label: 'Devis en cours', value: pipe.length, icon: 'send', tone: 'blue', foot: M(E.sum(pipe, dvHT)) + ' HT' }) + U.kpi({ label: 'Taux de transformation', value: F.num(dec.length ? won.length / dec.length * 100 : 0), unit: '%', icon: 'target', tone: 'green', foot: won.length + ' accepté(s) sur ' + dec.length }) + U.kpi({ label: 'Brouillons', value: all.filter(function (o) { return o.statut === 'Brouillon'; }).length, icon: 'edit', tone: 'grey', foot: 'à finaliser et envoyer' }) + '</div>' +
      '<div class="card">' + U.table([
        { label: 'N°', render: function (o) { return '<b>' + esc(o.id) + '</b>'; } }, { label: 'Date', render: function (o) { return F.dateShort(o.date); } },
        { label: 'Client', render: function (o) { return esc(clNom(o.client)) + '<span class="fac-sub">' + esc(o.objet) + '</span>'; } },
        { label: 'Montant HT', num: true, render: function (o) { return F.num(dvHT(o)); } }, { label: 'Validité', render: function (o) { return F.dateShort(o.validite); } },
        { label: 'Statut', render: function (o) { var s = dvStatut(o); return U.badge(s, DV_TONE[s]); } }
      ], all, { onRow: function (o) { openDevis(o.id); }, empty: 'Aucun devis' }) + '</div></div>';
  }
  function devisForm(o, title, onSave) {
    var ed = lineEditor('dv-le-' + Date.now(), o.lignes);
    var m = U.modal({ title: title, sub: 'Établi à partir de la grille tarifaire', size: 'lg', onClose: afterClose,
      body: U.form([{ name: 'client', label: 'Client', type: 'select', options: E.options('clients'), required: true }, { name: 'validite', label: 'Valable jusqu\'au', type: 'date', required: true }, { name: 'objet', label: 'Objet', required: true, full: true, placeholder: 'ex. Escale porte-conteneurs de 900 EVP' }, { name: 'navire', label: 'Navire (si connu)' }], o) + ed.html,
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', cls: 'primary', icon: 'check', onClick: function (close, el) { var v = U.readForm(el); if (!v) return; var l = ed.read(); if (!l.length) return toast('Ajoutez au moins une ligne.', 'err'); onSave(v, l); close(); } }] });
    ed.bind(); return m;
  }
  function newDevis() {
    devisForm({ client: E.scope() === 'POG' ? 'C-05' : 'C-01', validite: d(30), lignes: [{ tarif: 'T-PIL' }, { tarif: 'T-REM' }, { tarif: 'T-LAM', qte: 2 }, { tarif: 'T-QUA' }] }, 'Nouveau devis armateur', function (v, l) {
      var o = S.add('devisClients', { id: S.next('DEV'), site: E.scope() || siteDe(v.client), client: v.client, date: today(), validite: v.validite, objet: v.objet, navire: v.navire, lignes: l, statut: 'Brouillon', historique: [{ at: new Date().toISOString(), user: me(), action: 'Devis créé' }] });
      E.log('Devis créé', o.id + ' — ' + clNom(o.client), MOD); toast('Devis ' + o.id + ' créé.'); refresh(); openDevis(o.id);
    });
  }
  function openDevis(id) {
    var o = S.get('devisClients', id); if (!o) return toast('Devis introuvable.', 'err');
    var s = dvStatut(o), acts = [];
    function upd(st2, action) { o.statut = st2; o.historique.push({ at: new Date().toISOString(), user: me(), action: action }); S.save(); E.log('Devis ' + st2.toLowerCase(), o.id + ' — ' + clNom(o.client), MOD); toast('Devis ' + o.id + ' : ' + action.toLowerCase() + '.'); refresh(); }
    if (s === 'Brouillon') {
      acts.push({ label: 'Modifier', icon: 'edit', onClick: function (close) { close(); devisForm(o, 'Modifier ' + o.id, function (v, l) { Object.assign(o, v, { lignes: l }); o.historique.push({ at: new Date().toISOString(), user: me(), action: 'Devis modifié' }); S.save(); toast('Devis mis à jour.'); refresh(); openDevis(o.id); }); } });
      acts.push({ label: 'Envoyer au client', cls: 'primary', icon: 'send', onClick: function (close) { close(); upd('Envoyé', 'Envoyé au client'); } });
    }
    if (s === 'Envoyé' || s === 'Expiré') {
      acts.push({ label: 'Refusé', cls: 'danger', icon: 'x', onClick: function (close) { close(); upd('Refusé', 'Refusé par le client'); } });
      acts.push({ label: 'Accepté', cls: 'success', icon: 'check', onClick: function (close) { close(); upd('Accepté', 'Accepté par le client'); openDevis(o.id); } });
    }
    if (s === 'Accepté') acts.push({ label: 'Convertir en facture', cls: 'primary', icon: 'invoice', onClick: function (close) { close(); newFacture({ client: o.client, lignes: o.lignes.map(function (l) { return Object.assign({}, l); }), navire: o.navire || '', objet: o.objet, devis: o.id }); } });
    if (o.facture) acts.push({ label: 'Voir la facture ' + o.facture, icon: 'eye', onClick: function (close) { close(); E.go(MOD + '/factures/' + o.facture); } });
    acts.push({ label: 'Imprimer', icon: 'print', onClick: function (c, el) { printModal({ el: el }); } });
    U.modal({ title: 'Devis ' + o.id, sub: esc(clNom(o.client)) + ' · ' + U.badge(s, DV_TONE[s]), size: 'lg', onClose: afterClose, body: devisDoc(o) + '<div class="fac-hist"><b>Historique</b><div class="timeline">' + o.historique.map(function (h) { return '<div class="tl-item done"><b>' + esc(h.action) + '</b><span>' + esc(h.user) + ' · ' + (String(h.at).length > 10 ? F.datetime(h.at) : F.date(h.at)) + '</span></div>'; }).join('') + '</div></div>', actions: acts });
  }

  /* ------------------------------------------------------------------ encaissements */
  var ENC_COLS = [
    { label: 'N°', render: function (e) { return '<b>' + esc(e.id) + '</b>'; } }, { label: 'Date', render: function (e) { return F.dateShort(e.date); } },
    { label: 'Client', render: function (e) { return esc(clNom(e.client)); } }, { label: 'Facture', render: function (e) { return '<a href="#/ventes/factures/' + esc(e.facture) + '">' + esc(e.facture) + '</a>'; } },
    { label: 'Mode', render: function (e) { return U.badge(e.mode, e.mode === 'Avoir' ? 'violet' : e.mode === 'Espèces' ? 'yellow' : e.mode === 'Chèque' ? 'blue' : 'green'); } },
    { label: 'Référence', render: function (e) { return '<span class="mono">' + esc(e.reference || '') + '</span><span class="fac-sub">' + esc(e.banque || '') + '</span>'; } },
    { label: 'Montant', num: true, render: function (e) { return '<b>' + F.num(e.montant) + '</b>'; } }
  ];
  function vEnc(body) {
    var all = encs().slice().sort(function (a, b) { return b.date.localeCompare(a.date); }), m0 = firstOfMonth(0), m1 = firstOfMonth(-1);
    var cur = all.filter(function (e) { return e.date >= m0 && e.mode !== 'Avoir'; }), prev = all.filter(function (e) { return e.date >= m1 && e.date < m0 && e.mode !== 'Avoir'; });
    var by = {}; all.filter(function (e) { return e.date >= firstOfMonth(-5) && e.mode !== 'Avoir'; }).forEach(function (e) { by[e.mode] = (by[e.mode] || 0) + e.montant; });
    body.innerHTML = '<div class="stack"><div class="fac-kpis">' + U.kpi({ label: 'Encaissé ce mois', value: F.short(E.sum(cur, 'montant')), unit: 'FCFA', icon: 'money', tone: 'green', foot: cur.length + ' règlement(s)' }) + U.kpi({ label: 'Encaissé le mois dernier', value: F.short(E.sum(prev, 'montant')), unit: 'FCFA', icon: 'calendar', tone: 'blue', foot: prev.length + ' règlement(s)' }) + U.kpi({ label: 'Reste à encaisser', value: F.short(encours()), unit: 'FCFA', icon: 'wallet', tone: 'orange', foot: openF().length + ' facture(s) ouvertes' }) + '</div>' +
      '<div class="grid g-2-1"><div class="card">' + U.table(ENC_COLS, all.slice(0, st.lim), { empty: 'Aucun encaissement' }) + (all.length > st.lim ? '<div class="fac-more"><button class="btn sm" data-act="more">Afficher plus (' + (all.length - st.lim) + ')</button></div>' : '') + '</div>' +
      '<div class="card"><div class="card__h"><h3>Modes de règlement</h3><span class="sub">6 derniers mois</span></div><div class="card__b">' + U.donut(MODES.map(function (k, i) { return { label: k, value: by[k] || 0, color: ['#009e60', '#3a75c4', '#f2b705'][i] }; }).filter(function (x) { return x.value; }), { money: true, center: F.short(E.sum(Object.keys(by), function (k) { return by[k]; })), sub: 'FCFA', size: 130 }) + '</div></div></div></div>';
  }

  /* ------------------------------------------------------------------ balance âgée */
  function balRows() {
    return siteClients().map(function (c) { var a = aging(c.id); return { c: c, a: a, tot: E.sum(a), ech: a[1] + a[2] + a[3] + a[4] }; }).filter(function (r) { return r.tot > 1; }).sort(function (x, y) { return y.ech - x.ech || y.tot - x.tot; });
  }
  function vBal(body) {
    var rows = balRows(), all = aging(), tot = E.sum(all) || 1;
    var cols = [{ label: 'Client', render: function (r) { return '<b>' + esc(r.c.nom) + '</b><span class="fac-sub">' + esc(r.c.type) + '</span><div class="fac-age">' + r.a.map(function (v, i) { return v ? '<i style="width:' + (v / r.tot * 100) + '%;background:' + AGES[i].c + '"></i>' : ''; }).join('') + '</div>'; } }]
      .concat(AGES.map(function (a, i) { return { label: a.l, num: true, render: function (r) { return r.a[i] ? '<span class="' + (i >= 3 ? 'fac-red' : '') + '">' + F.num(r.a[i]) + '</span>' : '<span class="muted">—</span>'; } }; }))
      .concat([{ label: 'Total dû', num: true, render: function (r) { return '<b>' + F.num(r.tot) + '</b>'; } }, { label: '', render: function (r) { var f = openF(r.c.id).filter(relanceDue)[0]; return f ? '<button class="btn sm" data-act="rel" data-id="' + f.id + '">' + ic('send') + 'Relancer</button>' : ''; } }]);
    body.innerHTML = '<div class="stack"><div class="fac-ages">' + AGES.map(function (a, i) { return '<div class="fac-ages__c" style="--c:' + a.c + '"><small>' + a.l + '</small><b>' + F.short(all[i]) + '</b><span>' + F.pct(all[i] / tot * 100) + '</span></div>'; }).join('') + '</div>' +
      '<div class="card"><div class="card__h"><h3>Balance âgée par client</h3><span class="sub">au ' + F.date(today()) + ' · montants TTC restant dus · jours de retard après échéance</span></div>' +
      U.table(cols, rows, { onRow: function (r, e) { if (!e.target.closest('button')) E.go(MOD + '/clients/' + r.c.id); }, empty: 'Aucun encours client', footer: function () { return '<td>Total</td>' + all.map(function (v) { return '<td class="num">' + F.num(v) + '</td>'; }).join('') + '<td class="num">' + F.num(E.sum(all)) + '</td><td></td>'; } }) + '</div></div>';
  }

  /* ------------------------------------------------------------------ clients */
  function vClients(body) {
    var y0 = firstOfMonth(-11);
    body.innerHTML = '<div class="fac-cards">' + siteClients().map(function (c) {
      var ca = caPeriod(y0, today(), c.id), en = encours(c.id), ec = echu(c.id), use = c.plafond ? en / c.plafond * 100 : 0;
      return '<div class="card fac-card" data-act="cli" data-id="' + c.id + '"><div class="card__b"><div class="fac-card__top">' + U.avatar(c.nom) + '<div style="min-width:0"><b>' + esc(c.nom) + '</b><span class="small muted">' + esc(c.type) + ' · ' + esc(c.ville) + '</span></div></div>' +
        '<div class="fac-kv2"><div><small>CA 12 mois (HT)</small><b>' + F.short(ca) + '</b></div><div><small>Encours TTC</small><b class="' + (ec ? 'fac-red' : '') + '">' + F.short(en) + '</b></div></div>' +
        '<div><div class="small muted" style="display:flex;justify-content:space-between"><span>Plafond ' + F.short(c.plafond) + '</span><span>' + (ec ? 'dont ' + F.short(ec) + ' échus' : 'à jour') + '</span></div>' + U.progress(use, use > 90 ? 'red' : use > 70 ? 'orange' : 'green') + '</div></div></div>';
    }).join('') + '</div>';
  }
  function drawClient(id) {
    var c = S.get('clients', id); if (!c) { viewEl.innerHTML = '<div class="card"><div class="empty">Client introuvable.<br><a href="#/ventes/clients">Retour aux clients</a></div></div>'; return; }
    var y0 = E.iso(new Date(E.TODAY.getFullYear(), 0, 1)), ca = caPeriod(y0, today(), c.id), en = encours(c.id), ec = echu(c.id), use = c.plafond ? en / c.plafond * 100 : 0;
    var fs = facts().filter(function (f) { return f.client === c.id; }).sort(function (a, b) { return b.date.localeCompare(a.date); });
    var es = encs().filter(function (e) { return e.client === c.id; }).sort(function (a, b) { return b.date.localeCompare(a.date); });
    var hist = {}; fs.forEach(function (f) { if (f.escale) hist[f.escale] = { id: f.escale, navire: f.navire, date: f.date, site: f.site, statut: 'Facturée', montant: (hist[f.escale] ? hist[f.escale].montant : 0) + faHT(f) }; });
    escalesAll().filter(function (x) { return x.client === c.id; }).forEach(function (x) { if (!hist[x.id]) hist[x.id] = { id: x.id, navire: x.navire, date: String(x.ata || x.eta || '').slice(0, 10), site: x.site, statut: x.statut, montant: 0 }; });
    var H = Object.keys(hist).map(function (k) { return hist[k]; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    var ag = aging(c.id), tot = E.sum(ag) || 1;
    viewEl.innerHTML = '<div class="fac-root" id="fac-root"><a class="btn ghost sm fac-back" href="#/ventes/clients">' + ic('back') + 'Tous les clients</a>' +
      '<div class="card fac-client"><div class="card__b"><div class="fac-client__id">' + U.avatar(c.nom) + '<div><h2>' + esc(c.nom) + '</h2><div class="muted">' + esc(c.type) + ' · ' + esc(c.ville) + ' · code ' + esc(c.id) + '</div></div></div><div class="fac-head__acts"><button class="btn" data-act="edit-cli" data-id="' + c.id + '">' + ic('edit') + 'Conditions</button><button class="btn primary" data-act="new-fa-cli" data-id="' + c.id + '">' + ic('plus') + 'Facture</button></div></div></div>' +
      '<div class="fac-kpis">' + U.kpi({ label: 'CA ' + E.TODAY.getFullYear() + ' (HT)', value: F.short(ca), unit: 'FCFA', icon: 'trend', tone: 'navy', foot: fs.filter(function (f) { return f.date >= y0 && f.statut !== 'Brouillon'; }).length + ' facture(s)' }) +
      U.kpi({ label: 'Encours TTC', value: F.short(en), unit: 'FCFA', icon: 'wallet', tone: 'violet', foot: openF(c.id).length + ' facture(s) ouvertes' }) +
      U.kpi({ label: 'Échu', value: F.short(ec), unit: 'FCFA', icon: 'alert', tone: ec ? 'red' : 'green', foot: ec ? 'à recouvrer' : 'aucun retard' }) +
      U.kpi({ label: 'Plafond d\'encours', value: F.short(c.plafond), unit: 'FCFA', icon: 'shield', tone: use > 90 ? 'red' : 'blue', foot: 'utilisé à ' + F.pct(use) + ' · paiement à ' + (c.delai || 30) + ' j' }) + '</div>' +
      '<div class="card"><div class="card__h"><h3>Ancienneté de l\'encours</h3></div><div class="card__b"><div class="fac-age big">' + ag.map(function (v, i) { return v ? '<i style="width:' + (v / tot * 100) + '%;background:' + AGES[i].c + '"></i>' : ''; }).join('') + '</div><div class="legend" style="margin-top:10px">' + AGES.map(function (a, i) { return '<span><i style="background:' + a.c + '"></i>' + a.l + ' · <b>' + F.short(ag[i]) + '</b></span>'; }).join('') + '</div></div></div>' +
      '<div class="grid g-2-1"><div class="card"><div class="card__h"><h3>Factures</h3><span class="sub">' + fs.length + '</span></div>' + U.table(faCols().filter(function (x) { return x.label !== 'Client'; }).concat([]), fs.slice(0, 15), { onRow: function (f) { openFacture(f.id); }, empty: 'Aucune facture' }) + '</div>' +
      '<div class="card"><div class="card__h"><h3>Historique des escales</h3><span class="sub">' + H.length + '</span></div><div class="list">' + (H.length ? H.slice(0, 10).map(function (h) { return '<div class="list__item"><div class="list__icon tone-blue">' + ic('ship') + '</div><div class="list__body"><b>' + esc(h.navire || h.id) + '</b><div class="small muted">' + esc(h.id) + ' · ' + siteNom(h.site) + ' · ' + F.dateShort(h.date) + '</div></div><div class="right">' + U.badge(h.statut) + (h.montant ? '<div class="small muted">' + F.short(h.montant) + ' HT</div>' : '') + '</div></div>'; }).join('') : '<div class="empty">Aucune escale</div>') + '</div></div></div>' +
      '<div class="card"><div class="card__h"><h3>Règlements reçus</h3><span class="sub">' + es.length + '</span></div>' + U.table(ENC_COLS.filter(function (x) { return x.label !== 'Client'; }), es.slice(0, 12), { empty: 'Aucun règlement' }) + '</div></div>';
    var root = viewEl.querySelector('#fac-root');
    bindRoot(root);
    root.addEventListener('click', function (e) { var a = e.target.closest('[data-act=new-fa-cli]'); if (a) newFacture({ client: a.dataset.id }); });
  }
  function editClient(id) {
    var c = S.get('clients', id); if (!c) return;
    if (!canFin() && prof() !== 'commercial') return toast('Modification réservée au commercial et à la DAF.', 'err');
    U.formModal({ title: 'Conditions commerciales — ' + c.nom, fields: [
      { name: 'plafond', label: 'Plafond d\'encours (FCFA)', type: 'number', min: 0, required: true },
      { name: 'delai', label: 'Délai de paiement (jours)', type: 'number', min: 0, required: true },
      { name: 'type', label: 'Type de client', type: 'select', options: ['Armateur conteneurs', 'Armateur roulier', 'Armateur pétrolier', 'Consignataire', 'Offshore pétrolier', 'Soutage (navires)', 'Transitaire'] },
      { name: 'ville', label: 'Ville' }
    ], values: c, onSubmit: function (v) { Object.assign(c, v); S.save(); E.log('Conditions client modifiées', c.nom + ' — plafond ' + F.money(v.plafond) + ', ' + v.delai + ' j', MOD); toast('Conditions de ' + c.nom + ' mises à jour.'); refresh(); } });
  }

  /* ------------------------------------------------------------------ grille tarifaire */
  function vTarifs(body) {
    var T = tarifs();
    body.innerHTML = '<div class="stack"><div class="alert tone-yellow">' + ic('info') + '<div><b>Tarifs fictifs de démonstration, à remplacer par le tarif officiel.</b> La grille alimente les devis, les prestations remontées par l\'exploitation et les factures.</div></div>' +
      '<div class="grid g-2-1"><div class="card">' + U.table([
        { label: 'Prestation', render: function (t) { return '<b>' + esc(t.libelle) + '</b><span class="fac-sub">' + esc(t.base || '') + '</span>'; } },
        { label: 'Activité', render: function (t) { return '<span class="fac-act" style="--c:' + (ACT_C[t.activite] || '#94a3b8') + '">' + esc(t.activite) + '</span>'; } },
        { label: 'Unité', key: 'unite' },
        { label: 'Prix HT', num: true, render: function (t) { return '<b>' + F.num(t.pu) + '</b>' + (t.marge ? '<span class="fac-sub">dont marge ' + F.num(t.marge) + '</span>' : ''); } },
        { label: '', render: function (t) { return '<button class="btn sm" data-act="tar" data-id="' + t.id + '">' + ic('edit') + 'Modifier</button>'; } }
      ], T) + '</div>' +
      '<div class="card"><div class="card__h"><h3>Paramètres de facturation</h3></div><div class="card__b"><dl class="kv"><dt>Taux de TVA</dt><dd><b>' + F.num(cfg().tva, cfg().tva % 1 ? 1 : 0) + ' %</b></dd><dt>Numérotation</dt><dd>' + (E.scope() ? 'FAC-' + E.scope() + '-2026-xxxx' : 'FAC-OWE-2026-xxxx · FAC-POG-2026-xxxx') + ' (séquentielle par port)</dd><dt>Échéance</dt><dd>selon le délai de chaque client</dd><dt>Devise</dt><dd>Franc CFA (XAF)</dd></dl><button class="btn" style="margin-top:14px" data-act="tva">' + ic('settings') + 'Modifier le taux de TVA</button><p class="small muted" style="margin-top:10px">Le taux s\'applique aux nouvelles factures ; les factures déjà émises conservent leur taux.</p></div></div></div></div>';
  }
  function editTarif(id) {
    var t = tarif(id); if (!t) return;
    if (!canFin() && prof() !== 'commercial') return toast('Modification réservée au commercial et à la DAF.', 'err');
    U.formModal({ title: 'Modifier le tarif', sub: esc(t.libelle), fields: [
      { name: 'libelle', label: 'Libellé', required: true, full: true }, { name: 'pu', label: 'Prix unitaire HT (FCFA)', type: 'number', min: 0, step: 'any', required: true },
      { name: 'unite', label: 'Unité', required: true }, { name: 'base', label: 'Base de calcul', full: true }
    ], values: t, onSubmit: function (v) { var old = t.pu; Object.assign(t, v, { maj: today() }); S.save(); E.log('Tarif modifié', t.libelle + ' : ' + F.num(old) + ' → ' + F.num(v.pu) + ' FCFA / ' + v.unite, MOD); toast('Tarif mis à jour.'); refresh(); } });
  }
  function editTVA() {
    if (!canFin()) return toast('Paramètre réservé à la Direction administrative et financière.', 'err');
    var c = cfg();
    U.formModal({ title: 'Taux de TVA', size: 'sm', fields: [{ name: 'tva', label: 'Taux applicable (%)', type: 'number', min: 0, step: '0.1', required: true, full: true }], values: c, onSubmit: function (v) { if (v.tva < 0 || v.tva > 50) { toast('Taux invalide.', 'err'); return false; } c.tva = v.tva; S.save(); E.log('Taux de TVA modifié', v.tva + ' %', MOD); toast('TVA fixée à ' + v.tva + ' % pour les nouvelles factures.'); refresh(); } });
  }

  /* ------------------------------------------------------------------ exports */
  function exportTab() {
    var dt = today();
    if (st.tab === 'factures') U.exportCSV('factures-gpm-' + dt, [{ label: 'N°', key: 'id' }, { label: 'Date', key: 'date' }, { label: 'Client', csv: function (f) { return clNom(f.client); } }, { label: 'Navire', key: 'navire' }, { label: 'Escale', key: 'escale' }, { label: 'Port', csv: function (f) { return siteNom(f.site); } }, { label: 'HT', csv: faHT }, { label: 'TVA', csv: faTVA }, { label: 'TTC', csv: faTTC }, { label: 'Réglé', csv: paid }, { label: 'Reste dû', csv: reste }, { label: 'Échéance', key: 'echeance' }, { label: 'Statut', csv: statut }], faRows());
    else if (st.tab === 'encaissements') U.exportCSV('encaissements-gpm-' + dt, [{ label: 'N°', key: 'id' }, { label: 'Date', key: 'date' }, { label: 'Client', csv: function (e) { return clNom(e.client); } }, { label: 'Facture', key: 'facture' }, { label: 'Mode', key: 'mode' }, { label: 'Banque', key: 'banque' }, { label: 'Référence', key: 'reference' }, { label: 'Montant', key: 'montant' }], encs());
    else if (st.tab === 'balance') U.exportCSV('balance-agee-gpm-' + dt, [{ label: 'Client', csv: function (r) { return r.c.nom; } }].concat(AGES.map(function (a, i) { return { label: a.l, csv: function (r) { return Math.round(r.a[i]); } }; })).concat([{ label: 'Total', csv: function (r) { return Math.round(r.tot); } }]), balRows());
    else if (st.tab === 'devis') U.exportCSV('devis-gpm-' + dt, [{ label: 'N°', key: 'id' }, { label: 'Date', key: 'date' }, { label: 'Client', csv: function (o) { return clNom(o.client); } }, { label: 'Objet', key: 'objet' }, { label: 'Montant HT', csv: dvHT }, { label: 'Statut', csv: dvStatut }], S.all('devisClients'));
    else if (st.tab === 'tarifs') U.exportCSV('grille-tarifaire-demo-gpm', [{ label: 'Code', key: 'id' }, { label: 'Prestation', key: 'libelle' }, { label: 'Activité', key: 'activite' }, { label: 'Unité', key: 'unite' }, { label: 'Prix HT', key: 'pu' }, { label: 'Base', key: 'base' }], tarifs());
  }

  /* ------------------------------------------------------------------ intégration (validations, synthèse, recherche, badge) */
  function pending(u) {
    var out = [], p = u ? u.profile : '';
    if (p === 'admin' || p === 'finance') facts().filter(function (f) { return f.statut === 'Brouillon'; }).forEach(function (f) { out.push({ title: 'Valider la facture ' + f.id, sub: clNom(f.client) + ' · ' + M(faTTC(f)) + ' TTC', href: '#/ventes/factures/' + f.id, date: f.date, tone: 'orange', icon: 'invoice' }); });
    emises().filter(relanceDue).sort(function (a, b) { return retard(b) - retard(a); }).slice(0, 5).forEach(function (f) { out.push({ title: 'Relancer ' + clNom(f.client), sub: f.id + ' échue depuis ' + retard(f) + ' j · ' + M(reste(f)), href: '#/ventes/factures/' + f.id, date: f.echeance, tone: 'red', icon: 'alert' }); });
    var g = prsGroups(); if (g.length && (p === 'admin' || p === 'commercial' || p === 'finance')) out.push({ title: g.length + ' escale(s) à facturer', sub: M(E.sum(g, 'ht')) + ' HT de prestations réalisées', href: '#/ventes/afacturer', date: g[0].date, tone: 'blue', icon: 'inbox' });
    return out;
  }
  function summary() {
    return [
      { label: 'CA facturé · ' + E.MOIS[E.TODAY.getMonth()], value: F.short(caMois(0)), unit: 'FCFA HT', icon: 'invoice', tone: 'blue', foot: 'mois précédent ' + M(caMois(-1)), href: '#/ventes' },
      { label: 'Encours clients', value: F.short(encours()), unit: 'FCFA', icon: 'wallet', tone: 'orange', foot: '<span class="down">' + M(echu()) + ' échus</span>', href: '#/ventes/balance' }
    ];
  }
  function search(q) {
    var out = [];
    facts().forEach(function (f) { if (E.norm(f.id + ' ' + clNom(f.client) + ' ' + (f.navire || '') + ' ' + (f.escale || '')).indexOf(q) >= 0) out.push({ title: f.id + ' — ' + clNom(f.client), sub: (f.navire || '') + ' · ' + F.money(faTTC(f)) + ' · ' + statut(f), href: '#/ventes/factures/' + f.id }); });
    S.all('devisClients').forEach(function (o) { if (E.norm(o.id + ' ' + clNom(o.client) + ' ' + o.objet).indexOf(q) >= 0) out.push({ title: o.id + ' — ' + o.objet, sub: clNom(o.client) + ' · devis ' + dvStatut(o), href: '#/ventes/devis/' + o.id }); });
    S.all('clients').forEach(function (c) { if (E.norm(c.nom + ' ' + c.id).indexOf(q) >= 0) out.push({ title: c.nom, sub: 'Fiche client · encours ' + M(encours(c.id)), href: '#/ventes/clients/' + c.id }); });
    return out;
  }
  function badge() { var p = (E.session.user() || {}).profile, n = emises().filter(isEchue).length; if (p === 'admin' || p === 'finance') n += facts().filter(function (f) { return f.statut === 'Brouillon'; }).length; return n; }

  E.register({ id: MOD, label: 'Facturation & clients', title: 'Facturation & clients', icon: 'invoice', group: 'Commercial & Finances', roles: ['commercial', 'finance'],
    seed: seed, init: init, render: render, pending: pending, summary: summary, search: search, badge: badge,
    api: { caMois: caMois, caParActivite: caParActivite, encours: encours, ACTS: ACTS } });
})();
