/* GPM · Espace de gestion — module « Soutage & eau douce » (Exploitation portuaire, Port-Gentil).
   Port-Gentil est le seul port du pays à proposer le soutage (bunkering) et la fourniture d'eau douce aux navires.
   Collections : cuves (stocks), soutages (commandes → livraison → facturation), receptionsSoutage (réapprovisionnement),
   mouvementsSoutage (journal de stock). À la livraison : la cuve est décrémentée et une ligne « prestations »
   (source : 'soutage') est créée pour le module Facturation. Données fictives de démonstration. */
(function () {
  'use strict';
  var E = window.ERP; if (!E) return;
  var S = E.store, U = E.ui, F = E.fmt, esc = E.esc, ic = E.icon, MOD = 'soutage';

  var PROD = {
    MGO: { l: 'Gasoil marin (MGO)', s: 'MGO', c: '#0b3a6e', c2: '#3a75c4', tarif: 'T-MGO', pu: 690000, dmin: 0.820, dmax: 0.890, d0: 0.845, alpha: 0.00083 },
    IFO: { l: 'Fioul marin IFO 380', s: 'IFO 380', c: '#3b3f46', c2: '#6b7280', tarif: 'T-IFO', pu: 470000, dmin: 0.940, dmax: 0.991, d0: 0.975, alpha: 0.00064 },
    EAU: { l: 'Eau douce', s: 'Eau', c: '#0e7490', c2: '#38bdf8', tarif: 'T-EAU', pu: 2800, dmin: 0.990, dmax: 1.010, d0: 1.000, alpha: 0 }
  };
  var MOYENS = ['Barge BS-01 (Mandji)', 'Appontement POG-P3'];
  var STEPS = ['Demandée', 'Validée', 'En livraison', 'Livrée', 'Facturée'];
  var TONE = { 'Demandée': 'orange', 'Validée': 'blue', 'En livraison': 'violet', 'Livrée': 'green', 'Facturée': 'grey', 'Annulée': 'red', 'Programmée': 'violet', 'Réceptionnée': 'green' };

  function d(n) { return E.addDays(E.today(), n); }
  function dt(n, h, m) { return d(n) + 'T' + String(h).padStart(2, '0') + ':' + String(m || 0).padStart(2, '0'); }
  function today() { return E.today(); }
  function now() { var x = new Date(); return E.iso(x) + 'T' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); }
  function me() { var u = E.session.user(); return u ? u.name : 'Système'; }
  function prof() { var u = E.session.user(); return u ? u.profile : ''; }
  function canExp() { return prof() === 'admin' || prof() === 'exploitation'; }
  function clNom(id) { var c = S.get('clients', id); return c ? c.nom : (id || '—'); }
  function hm(s) { s = String(s || ''); return s.length > 10 ? s.slice(11, 16).replace(':', 'h') : ''; }
  function when(s) { return s ? F.dateShort(s) + (hm(s) ? ' · ' + hm(s) : '') : '—'; }
  function m3(n) { return F.num(n) + ' m³'; }
  function cuves() { return S.all('cuves'); }
  function cuve(id) { return S.get('cuves', id); }
  function cmds() { return S.all('soutages'); }
  function pct(c) { return c.capacite ? c.niveau / c.capacite * 100 : 0; }
  function bas(c) { return c.niveau <= c.seuil; }
  function escalesAll() { if (S.has('escales') && S.all('escales').length) return S.all('escales'); return (window.GPM_DATA && window.GPM_DATA.escalesDefaut) || []; }
  function escale(id) { return id ? escalesAll().find(function (x) { return x.id === id; }) : null; }
  function tarifPU(p) { var t = S.get('tarifs', PROD[p].tarif); return t && t.pu != null ? t.pu : PROD[p].pu; }
  function prestation(o) { return o.prestation ? S.get('prestations', o.prestation) : null; }
  function statut(o) { if (o.statut === 'Livrée') { var p = prestation(o); if (p && p.statut === 'Facturé') return 'Facturée'; } return o.statut; }
  function B(s) { return U.badge(s, TONE[s]); }
  function barge() { return S.get('flotte', 'BS-01'); }

  /* ------------------------------------------------------------------ données d'exemple */
  function seed() {
    if (S.has('soutages')) return null;
    var cv = [
      { id: 'CV-01', nom: 'Cuve MGO n° 1', produit: 'MGO', capacite: 1500, niveau: 965, seuil: 400, site: 'POG', emplacement: 'Parc de stockage — appontement soutage' },
      { id: 'CV-02', nom: 'Cuve MGO n° 2', produit: 'MGO', capacite: 1500, niveau: 352, seuil: 400, site: 'POG', emplacement: 'Parc de stockage — appontement soutage' },
      { id: 'CV-03', nom: 'Cuve IFO 380', produit: 'IFO', capacite: 2000, niveau: 1238, seuil: 500, site: 'POG', emplacement: 'Parc de stockage — cuve réchauffée' },
      { id: 'CV-04', nom: 'Réservoir eau douce', produit: 'EAU', capacite: 1200, niveau: 784, seuil: 300, site: 'POG', emplacement: 'Château d\'eau portuaire' }
    ];
    var N = {}; escalesAll().forEach(function (x) { N[x.id] = x; });
    function o(off, h, esc0, nav, c, p, q, ql, moyen, st, cv0, extra) {
      var e = N[esc0]; var r = { id: S.next('SOU'), escale: esc0 || '', navire: e ? e.navire : nav, imo: e ? e.imo : '', pavillon: e ? e.pavillon : '', client: e ? e.client : c, produit: p, qteDemandee: q, qteLivree: ql || 0, moyen: moyen, creneau: dt(off, h), statut: st, cuve: cv0 || '', historique: [{ at: dt(off - 2, 9), user: 'Linda Nzamba', action: 'Commande reçue du consignataire' }] };
      if (st !== 'Demandée') r.historique.push({ at: dt(off - 1, 11), user: 'Linda Nzamba', action: 'Commande validée — créneau confirmé' });
      if (st === 'En livraison' || st === 'Livrée' || st === 'Facturée') { r.debut = dt(off, h); r.historique.push({ at: r.debut, user: 'Josué Ogandaga', action: 'Début de livraison depuis ' + cv0 }); }
      if (st === 'Livrée' || st === 'Facturée') { var P = PROD[p]; r.fin = dt(off, h + (p === 'EAU' ? 3 : 5)); r.densite = +(P.d0 + ((q * 7) % 9 - 4) / 1000).toFixed(3); r.temperature = p === 'IFO' ? 46 : 29 + (q % 4); r.echantillon = 'GPM-' + String(4100 + q % 900); r.chefBord = ['Capt. A. Mensah', 'C/E P. Dubois', 'C/E R. Santos', 'C/E K. Owusu'][q % 4]; r.historique.push({ at: r.fin, user: 'Josué Ogandaga', action: 'Livraison terminée : ' + ql + ' m³' }); }
      return Object.assign(r, extra || {});
    }
    var list = [
      o(-74, 8, '', 'MV Cap Lopez Express', 'C-06', 'MGO', 160, 159, MOYENS[0], 'Facturée', 'CV-01'),
      o(-69, 10, '', 'PSV Offshore Mandji', 'C-05', 'EAU', 380, 380, MOYENS[1], 'Facturée', 'CV-04'),
      o(-63, 7, '', 'MT Atlantic Breeze', 'C-08', 'IFO', 240, 238, MOYENS[0], 'Facturée', 'CV-03'),
      o(-57, 9, '', 'PSV Ogooué Supplier', 'C-05', 'MGO', 85, 85, MOYENS[1], 'Facturée', 'CV-02'),
      o(-51, 14, '', 'MT Mandji Bunker', 'C-06', 'MGO', 210, 211, MOYENS[0], 'Facturée', 'CV-01'),
      o(-45, 8, '', 'AHTS Cap Lopez', 'C-05', 'EAU', 300, 300, MOYENS[1], 'Facturée', 'CV-04'),
      o(-40, 6, '', 'MT West Gentil', 'C-08', 'IFO', 280, 279, MOYENS[0], 'Facturée', 'CV-03'),
      o(-34, 9, '', 'MV Cap Lopez Express', 'C-06', 'MGO', 175, 174, MOYENS[0], 'Facturée', 'CV-02'),
      o(-29, 13, '', 'PSV Offshore Mandji', 'C-05', 'MGO', 95, 95, MOYENS[1], 'Facturée', 'CV-01'),
      o(-24, 8, '', 'MV Cap Lopez Express', 'C-06', 'EAU', 180, 180, MOYENS[1], 'Facturée', 'CV-04'),
      o(-19, 7, '', 'MT Atlantic Breeze', 'C-08', 'MGO', 150, 149, MOYENS[0], 'Facturée', 'CV-01'),
      o(-14, 10, '', 'PSV Ogooué Supplier', 'C-05', 'EAU', 320, 320, MOYENS[1], 'Facturée', 'CV-04'),
      o(-9, 9, '', 'MT Mandji Bunker', 'C-06', 'MGO', 230, 228, MOYENS[0], 'Livrée', 'CV-02', { prestation: 'PRS-SOU-A1' }),
      o(-4, 15, '', 'AHTS Cap Lopez', 'C-05', 'MGO', 70, 70, MOYENS[1], 'Livrée', 'CV-01', { prestation: 'PRS-SOU-A2' }),
      o(-1, 16, 'ESC-2026-0420', '', 'C-05', 'EAU', 420, 420, MOYENS[1], 'Livrée', 'CV-04', { prestation: 'PRS-D010' }),
      o(0, 10, 'ESC-2026-0422', '', 'C-08', 'MGO', 180, 0, MOYENS[1], 'En livraison', 'CV-01'),
      o(0, 15, 'ESC-2026-0422', '', 'C-08', 'EAU', 250, 0, MOYENS[1], 'Validée'),
      o(0, 18, 'ESC-2026-0420', '', 'C-05', 'MGO', 70, 0, MOYENS[0], 'Validée'),
      o(1, 13, 'ESC-2026-0421', '', 'C-06', 'EAU', 150, 0, MOYENS[1], 'Demandée'),
      o(2, 7, '', 'MT Atlantic Breeze', 'C-08', 'IFO', 300, 0, MOYENS[0], 'Demandée'),
      o(3, 8, 'ESC-2026-0423', '', 'C-05', 'MGO', 110, 0, MOYENS[1], 'Demandée'),
      o(3, 11, 'ESC-2026-0423', '', 'C-05', 'EAU', 300, 0, MOYENS[1], 'Demandée')
    ];
    var rec = [
      { id: S.next('RSO'), date: d(-48), cuve: 'CV-01', produit: 'MGO', qte: 900, fournisseur: 'Dépôt pétrolier de Port-Gentil (démo)', bl: 'BL-DP-77412', transport: 'Pipeline dépôt → parc soutage', statut: 'Réceptionnée', user: 'Linda Nzamba' },
      { id: S.next('RSO'), date: d(-30), cuve: 'CV-03', produit: 'IFO', qte: 700, fournisseur: 'Dépôt pétrolier de Port-Gentil (démo)', bl: 'BL-DP-77598', transport: 'Caboteur pétrolier', statut: 'Réceptionnée', user: 'Linda Nzamba' },
      { id: S.next('RSO'), date: d(-22), cuve: 'CV-02', produit: 'MGO', qte: 600, fournisseur: 'Dépôt pétrolier de Port-Gentil (démo)', bl: 'BL-DP-77655', transport: 'Pipeline dépôt → parc soutage', statut: 'Réceptionnée', user: 'Josué Ogandaga' },
      { id: S.next('RSO'), date: d(-6), cuve: 'CV-04', produit: 'EAU', qte: 650, fournisseur: 'Réseau d\'eau potable de Port-Gentil (démo)', bl: 'REL-EAU-0921', transport: 'Adduction réseau', statut: 'Réceptionnée', user: 'Josué Ogandaga' },
      { id: S.next('RSO'), date: d(2), cuve: 'CV-02', produit: 'MGO', qte: 1000, fournisseur: 'Dépôt pétrolier de Port-Gentil (démo)', bl: '', transport: 'Pipeline dépôt → parc soutage', statut: 'Programmée', user: 'Linda Nzamba' }
    ];
    /* journal de stock reconstruit à rebours depuis les niveaux actuels */
    var mv = [];
    list.forEach(function (x) { if (x.qteLivree && x.cuve) mv.push({ date: x.fin || x.creneau, cuve: x.cuve, type: 'Sortie', qte: -x.qteLivree, ref: x.id, libelle: 'Livraison ' + x.navire }); });
    rec.forEach(function (r) { if (r.statut === 'Réceptionnée') mv.push({ date: r.date + 'T08:00', cuve: r.cuve, type: 'Entrée', qte: r.qte, ref: r.id, libelle: 'Réception — ' + r.fournisseur }); });
    mv.push({ date: dt(-16, 17), cuve: 'CV-03', type: 'Ajustement', qte: -3, ref: 'JAU-' + d(-16).replace(/-/g, ''), libelle: 'Jaugeage contradictoire de fin de quinzaine' });
    cv.forEach(function (c) { var L = c.niveau; mv.filter(function (m) { return m.cuve === c.id; }).sort(function (a, b) { return b.date.localeCompare(a.date); }).forEach(function (m) { m.solde = L; L -= m.qte; }); });
    mv.sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (m) { m.id = S.next('MVS'); });
    return { cuves: cv.map(function (c) { return Object.assign(c, { maj: dt(0, 7) }); }), soutages: list, receptionsSoutage: rec, mouvementsSoutage: mv.reverse() };
  }
  /* Les livraisons non facturées ont leur ligne « prestations » pour le module Facturation */
  function init() {
    var P = S.all('prestations'), changed = false;
    cmds().forEach(function (o) { if (o.statut === 'Livrée' && o.prestation && !S.get('prestations', o.prestation)) { P.push(prsFor(o, o.prestation, String(o.fin || o.creneau).slice(0, 10))); changed = true; } });
    if (changed) S.save();
  }
  function prsFor(o, id, date) {
    var P = PROD[o.produit];
    return { id: id, escale: o.escale || '', navire: o.navire, client: o.client, date: date || today(), libelle: P.l + ' — ' + F.num(o.qteLivree) + ' m³ livrés à ' + o.navire + ' (' + o.id + ')', tarif: P.tarif, activite: 'Soutage & eau', qte: o.qteLivree, unite: 'm³', pu: tarifPU(o.produit), statut: 'À facturer', source: 'soutage', ref: o.id };
  }

  /* ------------------------------------------------------------------ calculs */
  function livreDepuis(a, p) { return E.sum(cmds().filter(function (o) { return o.qteLivree && String(o.fin || o.creneau).slice(0, 10) >= a && (!p || o.produit === p); }), 'qteLivree'); }
  function conso30(cv) { return E.sum(S.all('mouvementsSoutage').filter(function (m) { return m.cuve === cv && m.type === 'Sortie' && m.date >= d(-30); }), function (m) { return -m.qte; }) / 30; }
  function autonomie(c) { var c30 = E.sum(cuves().filter(function (x) { return x.produit === c.produit; }), function (x) { return conso30(x.id); }); var stock = E.sum(cuves().filter(function (x) { return x.produit === c.produit; }), 'niveau'); return c30 ? stock / c30 : null; }
  function densOK(o) { var P = PROD[o.produit]; return o.densite == null ? null : o.densite >= P.dmin && o.densite <= P.dmax; }
  function v15(o) { var P = PROD[o.produit]; return o.temperature == null ? o.qteLivree : o.qteLivree * (1 - P.alpha * (o.temperature - 15)); }
  function addMv(cv, type, qte, ref, lib) { var c = cuve(cv); S.add('mouvementsSoutage', { id: S.next('MVS'), date: now(), cuve: cv, type: type, qte: qte, ref: ref, libelle: lib, solde: c ? c.niveau : 0, user: me() }); }
  function checkSeuil(c) { if (bas(c)) { E.notify('Cuve sous le seuil d\'alerte', c.nom + ' : ' + m3(c.niveau) + ' (seuil ' + m3(c.seuil) + ')', '#/soutage', 'red'); U.toast(c.nom + ' passe sous le seuil d\'alerte : prévoir une réception.', 'err'); } }

  /* ------------------------------------------------------------------ vues */
  var TABS = [{ k: 'apercu', l: 'Vue d\'ensemble' }, { k: 'commandes', l: 'Commandes' }, { k: 'receptions', l: 'Réceptions de produit' }, { k: 'mouvements', l: 'Mouvements de stock' }];
  var st = { tab: 'apercu', fs: 'En cours', cv: '' }, viewEl = null;
  function here() { return location.hash.replace(/^#\/?/, '').split('/'); }
  function afterClose() { var p = here(); if (p[0] === MOD && p.length > 2) history.replaceState(null, '', '#/' + MOD + '/' + p[1]); }
  function refresh() { if (viewEl && here()[0] === MOD) { var y = window.scrollY; draw(); window.scrollTo(0, y); } E.renderBadges(); }
  function render(view, params) {
    viewEl = view; params = params || []; var tab = params[0] || 'apercu'; if (!TABS.some(function (t) { return t.k === tab; })) tab = 'apercu'; st.tab = tab; draw();
    if (params[1]) { var id = decodeURIComponent(params[1]); setTimeout(function () { if (tab === 'commandes') openCmd(id); else if (tab === 'apercu') openCuve(id); }, 30); }
  }
  function draw() {
    var nDem = cmds().filter(function (o) { return o.statut === 'Demandée'; }).length, nBas = cuves().filter(bas).length;
    var acts = '<button class="btn primary" data-act="new-cmd">' + ic('plus') + 'Commande de soutage</button>';
    if (st.tab === 'receptions' || st.tab === 'apercu') acts += '<button class="btn" data-act="new-rec">' + ic('download') + 'Réception de produit</button>';
    if (st.tab === 'mouvements') acts += '<button class="btn" data-act="adj">' + ic('gauge') + 'Jaugeage</button>';
    if (st.tab !== 'apercu') acts += '<button class="btn" data-act="csv">' + ic('download') + 'Export CSV</button>';
    viewEl.innerHTML = '<div class="sou-root" id="sou-root"><div class="sou-head"><div><h2>Soutage & eau douce</h2><p>Port-Gentil · livraison de gasoil marin, de fioul marin et d\'eau douce aux navires.</p></div><div class="sou-head__acts">' + acts + '</div></div>' +
      U.tabs(TABS.map(function (t) { return { k: t.k, l: t.l, n: t.k === 'commandes' ? nDem || null : t.k === 'apercu' ? nBas || null : null }; }), st.tab, function (k) { E.go(MOD + '/' + k); }) + '<div id="sou-body"></div></div>';
    var body = viewEl.querySelector('#sou-body');
    ({ apercu: vApercu, commandes: vCmds, receptions: vRec, mouvements: vMv })[st.tab](body);
    var root = viewEl.querySelector('#sou-root');
    root.addEventListener('click', function (e) {
      var a = e.target.closest('[data-act]'); if (!a || !root.contains(a)) return; var act = a.dataset.act, id = a.dataset.id;
      if (act === 'new-cmd') newCmd();
      else if (act === 'new-rec') newRec(id);
      else if (act === 'adj') adjust(id);
      else if (act === 'csv') exportTab();
      else if (act === 'cmd') openCmd(id);
      else if (act === 'cuve') openCuve(id);
      else if (act === 'rec-ok') receive(id);
      else if (act === 'fs') { st.fs = a.dataset.v; draw(); }
      else if (act === 'go') E.go(a.dataset.k);
    });
    var sel = root.querySelector('#sou-cv'); if (sel) sel.addEventListener('change', function () { st.cv = sel.value; draw(); });
  }

  function tankHTML(c, still) {
    var P = PROD[c.produit], p = pct(c), au = autonomie(c);
    var tg = still ? 'div' : 'button';
    return '<' + tg + ' class="sou-tank' + (bas(c) ? ' low' : '') + (still ? ' still' : '') + '"' + (still ? '' : ' data-act="cuve" data-id="' + c.id + '"') + ' style="--pc:' + P.c + ';--pc2:' + P.c2 + '">' +
      '<div class="sou-tank__top"><b>' + esc(c.nom) + '</b>' + (bas(c) ? '<span class="sou-flag" title="Sous le seuil d\'alerte">' + ic('alert') + '</span>' : '') + '</div>' +
      '<span class="sou-tank__prod">' + esc(P.l) + '</span>' +
      '<div class="sou-vessel"><div class="sou-fill" style="height:' + p.toFixed(1) + '%"></div><div class="sou-mark" style="bottom:' + (c.seuil / c.capacite * 100).toFixed(1) + '%"><span>seuil</span></div><div class="sou-pct' + (p > 55 ? ' light' : '') + '">' + Math.round(p) + '%</div></div>' +
      '<div class="sou-tank__vol"><b>' + F.num(c.niveau) + '</b> / ' + F.num(c.capacite) + ' m³</div>' +
      '<div class="sou-tank__meta">' + (au != null ? 'autonomie ≈ ' + F.num(au) + ' j' : 'pas de sortie récente') + '</div></' + tg + '>';
  }
  function cmdLine(o) {
    var P = PROD[o.produit], s = statut(o);
    return '<div class="sou-slot" data-act="cmd" data-id="' + o.id + '"><div class="sou-slot__t"><b>' + hm(o.creneau) + '</b><span>' + F.dateShort(o.creneau) + '</span></div><i class="sou-dot" style="background:' + P.c + '"></i><div class="sou-slot__b"><b>' + esc(o.navire) + '</b><span>' + esc(P.s) + ' · ' + m3(o.qteDemandee) + ' · ' + esc(o.moyen.replace(' (Mandji)', '')) + '</span></div>' + B(s) + '</div>';
  }
  function vApercu(body) {
    var m0 = E.iso(new Date(E.TODAY.getFullYear(), E.TODAY.getMonth(), 1));
    var hyd = livreDepuis(d(-30), 'MGO') + livreDepuis(d(-30), 'IFO'), eau = livreDepuis(d(-30), 'EAU');
    var dem = cmds().filter(function (o) { return o.statut === 'Demandée'; });
    var next = cmds().filter(function (o) { return ['Validée', 'Demandée', 'En livraison'].indexOf(o.statut) >= 0; }).sort(function (a, b) { return a.creneau.localeCompare(b.creneau); });
    var live = cmds().filter(function (o) { return o.statut === 'En livraison'; });
    var lows = cuves().filter(bas), bs = barge();
    /* volumes livrés par semaine (8 semaines) */
    var labels = [], ser = ['MGO', 'IFO', 'EAU'].map(function (p) { return { name: PROD[p].l, color: PROD[p].c, values: [] }; });
    for (var w = 7; w >= 0; w--) { var a = d(-w * 7 - 6), b = d(-w * 7); labels.push(F.dateShort(a).slice(0, 5)); ['MGO', 'IFO', 'EAU'].forEach(function (p, i) { ser[i].values.push(E.sum(cmds().filter(function (o) { var x = String(o.fin || o.creneau).slice(0, 10); return o.qteLivree && o.produit === p && x >= a && x <= b; }), 'qteLivree')); }); }
    var days = {}; next.forEach(function (o) { var k = o.creneau.slice(0, 10); (days[k] = days[k] || []).push(o); });
    body.innerHTML = '<div class="stack">' +
      '<div class="sou-hero"><div class="sou-hero__img"></div><div class="sou-hero__txt"><span class="sou-tag">' + ic('pin') + 'Port-Gentil</span><h3>Le seul port du Gabon à proposer le soutage et l\'eau douce</h3><p>Livraison par la barge <b>BS-01 Mandji</b> (800 m³) en rade ou à quai, ou directement à l\'<b>appontement POG-P3</b>.</p>' +
      '<div class="sou-hero__st"><span>Barge BS-01 : ' + U.badge(bs ? bs.statut : 'Disponible') + '</span>' + (live.length ? '<span>' + live.length + ' livraison(s) en cours</span>' : '') + '</div></div></div>' +
      (lows.length ? '<div class="alert tone-red">' + ic('alert') + '<div><b>' + lows.length + ' cuve(s) sous le seuil d\'alerte</b> — ' + lows.map(function (c) { return esc(c.nom) + ' (' + m3(c.niveau) + ')'; }).join(', ') + '. <button class="btn sm" data-act="new-rec" data-id="' + lows[0].id + '">Programmer une réception</button></div></div>' : '') +
      '<div class="sou-kpis">' +
      U.kpi({ label: 'Hydrocarbures livrés · 30 jours', value: F.num(hyd), unit: 'm³', icon: 'fuel', tone: 'navy', foot: 'MGO ' + F.num(livreDepuis(d(-30), 'MGO')) + ' · IFO ' + F.num(livreDepuis(d(-30), 'IFO')) + ' · ' + E.MOIS[E.TODAY.getMonth()] + ' : ' + F.num(livreDepuis(m0, 'MGO') + livreDepuis(m0, 'IFO')) }) +
      U.kpi({ label: 'Eau douce livrée · 30 jours', value: F.num(eau), unit: 'm³', icon: 'drop', tone: 'blue', foot: E.MOIS[E.TODAY.getMonth()] + ' : ' + m3(livreDepuis(m0, 'EAU')) }) +
      U.kpi({ label: 'Commandes à valider', value: dem.length, icon: 'inbox', tone: dem.length ? 'orange' : 'green', foot: dem.length ? m3(E.sum(dem, 'qteDemandee')) + ' demandés' : 'aucune en attente' }) +
      U.kpi({ label: 'Prochaine livraison', value: next[0] ? hm(next[0].creneau) || '—' : '—', icon: 'clock', tone: 'violet', foot: next[0] ? esc(next[0].navire) + ' · ' + F.dateShort(next[0].creneau) : 'aucune programmée' }) + '</div>' +
      '<div class="card"><div class="card__h"><h3>Niveau des cuves</h3><span class="sub">stocks en temps réel · seuil d\'alerte en pointillés</span><span class="spacer"></span><button class="btn sm" data-act="go" data-k="soutage/mouvements">' + ic('list') + 'Mouvements</button></div><div class="card__b"><div class="sou-tanks">' + cuves().map(function (c) { return tankHTML(c); }).join('') + '</div></div></div>' +
      '<div class="grid g-2-1"><div class="card"><div class="card__h"><h3>Planning des livraisons</h3><span class="sub">en cours et à venir</span><span class="spacer"></span><button class="btn sm" data-act="go" data-k="soutage/commandes">Toutes les commandes</button></div><div class="card__b">' +
      (next.length ? Object.keys(days).sort().map(function (k) { return '<div class="sou-day"><div class="sou-day__h">' + (k === today() ? 'Aujourd\'hui' : k === d(1) ? 'Demain' : F.date(k)) + '<span>' + days[k].length + ' créneau(x)</span></div>' + days[k].map(cmdLine).join('') + '</div>'; }).join('') : '<div class="empty">Aucune livraison programmée.</div>') + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Volumes livrés</h3><span class="sub">par semaine · m³</span></div><div class="card__b">' + U.bars({ labels: labels, series: ser, stacked: true, height: 220 }) + '</div></div></div></div>';
  }

  var CMD_COLS = [
    { label: 'N°', render: function (o) { return '<b>' + esc(o.id) + '</b>'; } },
    { label: 'Créneau', render: function (o) { return when(o.creneau); } },
    { label: 'Navire', render: function (o) { return '<b>' + esc(o.navire) + '</b><span class="sou-sub">' + esc(clNom(o.client)) + (o.escale ? ' · ' + esc(o.escale) : '') + '</span>'; } },
    { label: 'Produit', render: function (o) { var P = PROD[o.produit]; return '<span class="sou-prod" style="--c:' + P.c + '">' + esc(P.s) + '</span>'; } },
    { label: 'Demandé', num: true, render: function (o) { return m3(o.qteDemandee); } },
    { label: 'Livré', num: true, render: function (o) { return o.qteLivree ? '<b>' + m3(o.qteLivree) + '</b>' : '<span class="muted">—</span>'; } },
    { label: 'Moyen', render: function (o) { return esc(o.moyen); } },
    { label: 'Statut', render: function (o) { return B(statut(o)); } }
  ];
  function cmdRows() {
    var f = st.fs;
    return cmds().filter(function (o) { var s = statut(o); return f === 'Toutes' || (f === 'En cours' ? ['Demandée', 'Validée', 'En livraison'].indexOf(s) >= 0 : s === f); }).sort(function (a, b) { return f === 'En cours' ? a.creneau.localeCompare(b.creneau) : b.creneau.localeCompare(a.creneau); });
  }
  function vCmds(body) {
    var rows = cmdRows();
    body.innerHTML = '<div class="card"><div class="card__b"><div class="chips">' + ['En cours', 'Demandée', 'Validée', 'En livraison', 'Livrée', 'Facturée', 'Annulée', 'Toutes'].map(function (x) { var n = cmds().filter(function (o) { return statut(o) === x; }).length; return '<button class="chip' + (st.fs === x ? ' is-active' : '') + '" data-act="fs" data-v="' + x + '">' + x + (x !== 'Toutes' && x !== 'En cours' && n ? ' · ' + n : '') + '</button>'; }).join('') + '</div></div>' +
      U.table(CMD_COLS, rows, { onRow: function (o) { openCmd(o.id); }, empty: 'Aucune commande pour ce filtre' }) + '</div>';
  }
  function vRec(body) {
    var R = S.all('receptionsSoutage').slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    body.innerHTML = '<div class="card">' + U.table([
      { label: 'N°', render: function (r) { return '<b>' + esc(r.id) + '</b>'; } }, { label: 'Date', render: function (r) { return F.dateShort(r.date); } },
      { label: 'Cuve', render: function (r) { var c = cuve(r.cuve); return esc(c ? c.nom : r.cuve) + '<span class="sou-sub">' + esc(PROD[r.produit].l) + '</span>'; } },
      { label: 'Quantité', num: true, render: function (r) { return '<b>' + m3(r.qte) + '</b>'; } },
      { label: 'Provenance', render: function (r) { return esc(r.fournisseur) + '<span class="sou-sub">' + esc(r.transport || '') + (r.bl ? ' · ' + esc(r.bl) : '') + '</span>'; } },
      { label: 'Statut', render: function (r) { return B(r.statut) + (r.statut === 'Programmée' ? ' <button class="btn sm success" data-act="rec-ok" data-id="' + r.id + '">' + ic('check') + 'Réceptionner</button>' : ''); } }
    ], R, { empty: 'Aucune réception' }) + '</div>';
  }
  function mvRows() { return S.all('mouvementsSoutage').filter(function (m) { return !st.cv || m.cuve === st.cv; }).sort(function (a, b) { return b.date.localeCompare(a.date); }); }
  function vMv(body) {
    var rows = mvRows();
    body.innerHTML = '<div class="card"><div class="card__b"><div class="filters"><select class="select" id="sou-cv"><option value="">Toutes les cuves</option>' + cuves().map(function (c) { return '<option value="' + c.id + '"' + (st.cv === c.id ? ' selected' : '') + '>' + esc(c.nom) + '</option>'; }).join('') + '</select><span class="small muted">' + rows.length + ' mouvement(s)</span></div></div>' +
      U.table([
        { label: 'Date', render: function (m) { return when(m.date); } },
        { label: 'Cuve', render: function (m) { var c = cuve(m.cuve); return esc(c ? c.nom : m.cuve); } },
        { label: 'Type', render: function (m) { return U.badge(m.type, m.type === 'Entrée' ? 'green' : m.type === 'Sortie' ? 'blue' : 'yellow'); } },
        { label: 'Libellé', render: function (m) { return esc(m.libelle) + '<span class="sou-sub mono">' + esc(m.ref || '') + '</span>'; } },
        { label: 'Quantité', num: true, render: function (m) { return '<b class="' + (m.qte < 0 ? 'sou-neg' : 'sou-pos') + '">' + (m.qte > 0 ? '+' : '') + F.num(m.qte) + '</b>'; } },
        { label: 'Stock après', num: true, render: function (m) { return m3(m.solde); } }
      ], rows.slice(0, 80), { empty: 'Aucun mouvement' }) + '</div>';
  }

  /* ------------------------------------------------------------------ fiche commande */
  function openCmd(id) {
    var o = S.get('soutages', id); if (!o) return U.toast('Commande introuvable : ' + id, 'err');
    var s = statut(o), P = PROD[o.produit], c = cuve(o.cuve), es = escale(o.escale), idx = STEPS.indexOf(s);
    var info = '<div class="sou-steps">' + U.steps(STEPS, s === 'Annulée' ? 0 : idx, { finished: s === 'Facturée', rejected: s === 'Annulée' }) + '</div>' +
      '<div class="sou-detail"><dl class="kv"><dt>Navire</dt><dd><b>' + esc(o.navire) + '</b>' + (o.imo ? ' · IMO ' + esc(o.imo) : '') + (o.pavillon ? ' · ' + esc(o.pavillon) : '') + '</dd>' +
      '<dt>Client</dt><dd>' + esc(clNom(o.client)) + '</dd><dt>Escale</dt><dd>' + (o.escale ? esc(o.escale) + (es ? ' · ' + esc(E.posteName(es.poste)) : '') : 'Hors escale programmée (rade)') + '</dd>' +
      '<dt>Produit</dt><dd><span class="sou-prod" style="--c:' + P.c + '">' + esc(P.l) + '</span></dd><dt>Quantité demandée</dt><dd>' + m3(o.qteDemandee) + '</dd>' +
      '<dt>Moyen de livraison</dt><dd>' + esc(o.moyen) + '</dd><dt>Créneau</dt><dd>' + when(o.creneau) + '</dd>' +
      (o.cuve ? '<dt>Cuve de départ</dt><dd>' + esc(c ? c.nom : o.cuve) + (c ? ' · stock ' + m3(c.niveau) : '') + '</dd>' : '') +
      (o.qteLivree ? '<dt>Quantité livrée</dt><dd><b>' + m3(o.qteLivree) + '</b>' + (o.produit !== 'EAU' ? ' · ' + F.num(v15(o), 1) + ' m³ à 15 °C · ' + F.num(v15(o) * o.densite, 1) + ' t' : '') + '</dd>' : '') +
      (o.densite != null ? '<dt>Contrôle qualité</dt><dd>Densité ' + F.num(o.densite, 3) + ' · ' + F.num(o.temperature, 1) + ' °C · ' + (densOK(o) ? U.badge('Conforme', 'green') : U.badge('Non conforme', 'red')) + '</dd><dt>Échantillon scellé</dt><dd class="mono">' + esc(o.echantillon || '—') + '</dd>' : '') +
      (o.prestation ? '<dt>Facturation</dt><dd>' + (s === 'Facturée' ? 'Facturée' + (prestation(o) && prestation(o).facture ? ' — <a href="#/ventes/factures/' + esc(prestation(o).facture) + '">' + esc(prestation(o).facture) + '</a>' : '') : 'Prestation transmise à la facturation (' + F.money(o.qteLivree * tarifPU(o.produit)) + ' HT)') + '</dd>' : '') +
      '</dl><div class="sou-hist"><b>Historique</b><div class="timeline">' + (o.historique || []).map(function (h) { return '<div class="tl-item done"><b>' + esc(h.action) + '</b><span>' + esc(h.user) + ' · ' + when(h.at) + '</span></div>'; }).join('') + '</div></div></div>';
    var acts = [];
    function save(st2, action, patch) { Object.assign(o, patch || {}); o.statut = st2; o.historique.push({ at: now(), user: me(), action: action }); S.save(); E.log('Soutage — ' + action, o.id + ' · ' + o.navire, MOD); }
    function guard() { if (!canExp()) { U.toast('Action réservée à l\'exploitation portuaire.', 'err'); return false; } return true; }
    if (s === 'Demandée') {
      acts.push({ label: 'Annuler la commande', cls: 'danger', icon: 'x', onClick: function (close) { if (!guard()) return; U.confirm('Annuler la commande', 'Annuler la commande ' + esc(o.id) + ' (' + esc(o.navire) + ') ?', 'Annuler la commande', function () { save('Annulée', 'Commande annulée'); U.toast('Commande ' + o.id + ' annulée.'); close(); refresh(); }, 'danger'); } });
      acts.push({ label: 'Valider', cls: 'primary', icon: 'check', onClick: function (close) { if (!guard()) return; save('Validée', 'Commande validée — créneau confirmé'); U.toast('Commande validée : ' + o.navire + ', ' + when(o.creneau) + '.'); close(); refresh(); openCmd(o.id); } });
    }
    if (s === 'Validée') acts.push({ label: 'Démarrer la livraison', cls: 'primary', icon: 'fuel', onClick: function (close) { if (!guard()) return; close(); startDelivery(o); } });
    if (s === 'En livraison') acts.push({ label: 'Clôturer la livraison', cls: 'success', icon: 'check', onClick: function (close) { if (!guard()) return; close(); endDelivery(o); } });
    if (o.qteLivree) acts.push({ label: 'Bon de livraison', cls: 'primary', icon: 'print', onClick: function (close) { close(); openBon(o.id); } });
    if (s === 'Livrée') acts.push({ label: 'Voir à facturer', icon: 'invoice', onClick: function (close) { close(); E.go('ventes/afacturer'); } });
    acts.push({ label: 'Fermer' });
    U.modal({ title: 'Commande ' + o.id, sub: esc(o.navire) + ' · ' + B(s), size: 'lg', onClose: afterClose, body: info, actions: acts });
  }
  function startDelivery(o) {
    var ok = cuves().filter(function (c) { return c.produit === o.produit; }).sort(function (a, b) { return b.niveau - a.niveau; });
    var bs = barge();
    U.formModal({ title: 'Démarrer la livraison', sub: esc(o.navire) + ' · ' + esc(PROD[o.produit].l) + ' · ' + m3(o.qteDemandee), fields: [
      { name: 'cuve', label: 'Cuve de départ', type: 'select', required: true, full: true, options: ok.map(function (c) { return { v: c.id, l: c.nom + ' — stock ' + F.num(c.niveau) + ' m³' + (bas(c) ? ' (sous seuil)' : '') }; }) },
      { name: 'moyen', label: 'Moyen de livraison', type: 'select', options: MOYENS, full: true }
    ], values: { moyen: o.moyen }, okLabel: 'Démarrer', onSubmit: function (v) {
      var c = cuve(v.cuve);
      if (!c || c.niveau < o.qteDemandee) { U.toast('Stock insuffisant dans ' + (c ? c.nom : 'la cuve') + ' pour ' + m3(o.qteDemandee) + '.', 'err'); return false; }
      if (v.moyen === MOYENS[0] && bs && bs.statut !== 'Disponible' && bs.statut !== 'En mission') { U.toast('La barge BS-01 est indisponible (' + bs.statut + ') : livrer à l\'appontement POG-P3.', 'err'); return false; }
      o.cuve = v.cuve; o.moyen = v.moyen; o.debut = now(); o.statut = 'En livraison'; o.historique.push({ at: now(), user: me(), action: 'Début de livraison depuis ' + c.nom + ' (' + v.moyen + ')' }); S.save();
      E.log('Soutage — début de livraison', o.id + ' · ' + o.navire, MOD); U.toast('Livraison démarrée pour ' + o.navire + '.'); refresh(); setTimeout(function () { openCmd(o.id); }, 40);
    } });
  }
  function endDelivery(o) {
    var P = PROD[o.produit], c = cuve(o.cuve);
    var m = U.formModal({ title: 'Clôturer la livraison', sub: esc(o.navire) + ' · ' + esc(P.l), intro: '<div class="alert tone-blue" style="margin-bottom:14px">' + ic('info') + '<div>Relevé contradictoire avec le bord. Plage de densité attendue à 15 °C : <b>' + F.num(P.dmin, 3) + ' – ' + F.num(P.dmax, 3) + '</b>.</div></div>', fields: [
      { name: 'qte', label: 'Quantité livrée (m³)', type: 'number', min: 0, step: 'any', required: true },
      { name: 'densite', label: 'Densité à 15 °C', type: 'number', step: '0.001', required: true },
      { name: 'temperature', label: 'Température (°C)', type: 'number', step: '0.1', required: true },
      { name: 'echantillon', label: 'N° de scellé de l\'échantillon', required: true },
      { name: 'chefBord', label: 'Représentant du navire (chef mécanicien)', required: true, full: true }
    ], values: { qte: o.qteDemandee, densite: P.d0, temperature: o.produit === 'IFO' ? 45 : 29, echantillon: 'GPM-' + String(4000 + Math.floor(Math.random() * 900)) }, okLabel: 'Clôturer et décompter le stock', onSubmit: function (v) {
      if (!(v.qte > 0)) { U.toast('Quantité invalide.', 'err'); return false; }
      if (!c || v.qte > c.niveau) { U.toast('Quantité supérieure au stock de la cuve (' + m3(c ? c.niveau : 0) + ').', 'err'); return false; }
      c.niveau = Math.round((c.niveau - v.qte) * 10) / 10; c.maj = now();
      Object.assign(o, { qteLivree: v.qte, densite: v.densite, temperature: v.temperature, echantillon: v.echantillon, chefBord: v.chefBord, fin: now(), statut: 'Livrée' });
      var pid = 'PRS-' + o.id; o.prestation = pid;
      if (!S.get('prestations', pid)) S.all('prestations').unshift(prsFor(o, pid));
      o.historique.push({ at: now(), user: me(), action: 'Livraison terminée : ' + m3(v.qte) + (densOK(o) ? '' : ' — densité hors plage') }); S.save();
      addMv(c.id, 'Sortie', -v.qte, o.id, 'Livraison ' + o.navire);
      E.log('Soutage livré', o.id + ' · ' + o.navire + ' · ' + m3(v.qte) + ' ' + P.s, MOD);
      E.notify('Soutage livré — à facturer', o.navire + ' : ' + m3(v.qte) + ' ' + P.s, '#/ventes/afacturer', 'green');
      U.toast('Livraison clôturée : ' + m3(v.qte) + ' — stock et facturation mis à jour.');
      if (!densOK(o)) U.toast('Densité hors plage : échantillon à faire analyser.', 'err');
      checkSeuil(c); refresh(); setTimeout(function () { openBon(o.id); }, 40);
    } });
    return m;
  }

  /* ------------------------------------------------------------------ bon de livraison imprimable */
  function bonDoc(o) {
    var P = PROD[o.produit], eau = o.produit === 'EAU', c = cuve(o.cuve);
    return '<div class="doc sou-doc"><div class="sou-doc__head"><div class="sou-doc__brand"><img src="../assets/img/logo.svg" alt="GPM"><div><b>Gabon Port Management S.A.</b><span>Agence de Port-Gentil — B.P. 932 · Tél. 011 56 42 03</span><span>Siège : B.P. 394 Owendo, Libreville</span></div></div><div class="sou-doc__title"><h4>' + (eau ? 'BON DE LIVRAISON — EAU DOUCE' : 'BON DE LIVRAISON DE SOUTE') + '</h4>' + (eau ? '' : '<div class="small">Bunker Delivery Note — MARPOL Annexe VI</div>') + '<div>N° <b>BL-' + esc(o.id) + '</b></div><div>' + F.date(String(o.fin || o.creneau).slice(0, 10)) + '</div></div></div>' +
      '<div class="sou-doc__grid"><div><small>Navire</small><b>' + esc(o.navire) + '</b><br>' + (o.imo ? 'IMO ' + esc(o.imo) + '<br>' : '') + (o.pavillon ? 'Pavillon : ' + esc(o.pavillon) + '<br>' : '') + 'Escale : ' + esc(o.escale || 'rade de Port-Gentil') + '</div><div><small>Client / consignataire</small><b>' + esc(clNom(o.client)) + '</b><br>Commande ' + esc(o.id) + '</div><div><small>Livraison</small>Port-Gentil · ' + esc(o.moyen) + '<br>Début : ' + when(o.debut) + '<br>Fin : ' + when(o.fin) + '<br>Cuve : ' + esc(c ? c.nom : o.cuve) + '</div></div>' +
      '<table class="sou-doc__tbl"><thead><tr><th>Produit</th><th class="num">Volume livré</th>' + (eau ? '' : '<th class="num">Volume à 15 °C</th><th class="num">Masse</th>') + '<th class="num">Densité 15 °C</th><th class="num">Température</th></tr></thead><tbody><tr><td><b>' + esc(P.l) + '</b></td><td class="num">' + F.num(o.qteLivree, 1) + ' m³</td>' + (eau ? '' : '<td class="num">' + F.num(v15(o), 1) + ' m³</td><td class="num">' + F.num(v15(o) * o.densite, 2) + ' t</td>') + '<td class="num">' + F.num(o.densite, 3) + '</td><td class="num">' + F.num(o.temperature, 1) + ' °C</td></tr></tbody></table>' +
      '<div class="sou-doc__checks"><div><small>Échantillon</small>Prélevé en continu au manifold, scellé n° <b class="mono">' + esc(o.echantillon || '—') + '</b> — un exemplaire remis au bord, un conservé par GPM.</div>' +
      (eau ? '<div><small>Qualité</small>Eau potable issue du réseau public, contrôlée avant livraison (aspect, chlore résiduel). Flexibles dédiés à l\'eau.</div>' : '<div><small>Déclaration du fournisseur</small>Produit conforme à la norme ISO 8217 ; teneur en soufre ≤ ' + (o.produit === 'MGO' ? '0,10' : '0,50') + ' % m/m ; point d\'éclair > 60 °C. <span class="sou-demo">valeurs de démonstration</span></div>') +
      '<div><small>Contrôle densité</small>' + (densOK(o) ? '✓ Conforme à la plage attendue (' + F.num(P.dmin, 3) + ' – ' + F.num(P.dmax, 3) + ')' : '✗ Hors plage — réserve émise, analyse de l\'échantillon demandée') + '</div></div>' +
      '<div class="sou-doc__sign"><div>Opérateur de soutage GPM<br><b>Josué Ogandaga</b></div><div>Responsable soutage & eau douce<br><b>Linda Nzamba</b></div><div>Pour le navire (chef mécanicien)<br><b>' + esc(o.chefBord || '') + '</b><br><span class="muted">signature et cachet du bord</span></div></div>' +
      '<div class="sou-doc__foot">Gabon Port Management S.A. — Port-Gentil · Document de démonstration · Quantités et contrôles fictifs</div></div>';
  }
  function openBon(id) {
    var o = S.get('soutages', id); if (!o) return;
    U.modal({ title: 'Bon de livraison — ' + o.navire, sub: o.id, size: 'lg', onClose: afterClose, body: bonDoc(o), actions: [{ label: 'Fermer' }, { label: 'Imprimer', cls: 'primary', icon: 'print', onClick: function (c, el) { document.body.classList.add('sou-printing'); el.classList.add('sou-print-target'); try { window.print(); } catch (e) { /* indisponible */ } setTimeout(function () { document.body.classList.remove('sou-printing'); el.classList.remove('sou-print-target'); }, 400); } }] });
  }

  /* ------------------------------------------------------------------ fiche cuve */
  function openCuve(id) {
    var c = cuve(id); if (!c) return;
    var P = PROD[c.produit], mv = S.all('mouvementsSoutage').filter(function (m) { return m.cuve === c.id; }).sort(function (a, b) { return b.date.localeCompare(a.date); });
    var serie = mv.slice(0, 12).reverse();
    U.modal({ title: c.nom, sub: esc(P.l) + ' · ' + esc(c.emplacement || 'Port-Gentil'), size: 'lg', onClose: afterClose,
      body: '<div class="sou-cuve"><div class="sou-tanks one">' + tankHTML(c, true) + '</div><div style="flex:1;min-width:220px"><dl class="kv"><dt>Capacité</dt><dd>' + m3(c.capacite) + '</dd><dt>Stock actuel</dt><dd><b>' + m3(c.niveau) + '</b> (' + F.pct(pct(c)) + ')</dd><dt>Creux disponible</dt><dd>' + m3(c.capacite - c.niveau) + '</dd><dt>Seuil d\'alerte</dt><dd>' + m3(c.seuil) + (bas(c) ? ' ' + U.badge('Sous le seuil', 'red') : '') + '</dd><dt>Consommation moyenne</dt><dd>' + F.num(conso30(c.id), 1) + ' m³/jour (30 j)</dd><dt>Dernière mise à jour</dt><dd>' + when(c.maj) + '</dd></dl></div></div>' +
        (serie.length > 1 ? '<div class="sou-sect">Évolution du stock (derniers mouvements)</div>' + U.line({ labels: serie.map(function (m) { return F.dateShort(m.date).slice(0, 5); }), series: [{ name: 'Stock (m³)', values: serie.map(function (m) { return m.solde; }), color: P.c }], height: 170 }) : '') +
        '<div class="sou-sect">Derniers mouvements</div>' + U.table([{ label: 'Date', render: function (m) { return when(m.date); } }, { label: 'Libellé', render: function (m) { return esc(m.libelle); } }, { label: 'Quantité', num: true, render: function (m) { return (m.qte > 0 ? '+' : '') + F.num(m.qte); } }, { label: 'Stock après', num: true, render: function (m) { return F.num(m.solde); } }], mv.slice(0, 8), { empty: 'Aucun mouvement' }),
      actions: [{ label: 'Jaugeage', icon: 'gauge', onClick: function (close) { close(); adjust(c.id); } }, { label: 'Seuil d\'alerte', icon: 'settings', onClick: function (close) { close(); editSeuil(c.id); } }, { label: 'Réception de produit', cls: 'primary', icon: 'download', onClick: function (close) { close(); newRec(c.id); } }] });
  }
  function editSeuil(id) {
    var c = cuve(id); if (!c) return;
    U.formModal({ title: 'Seuil d\'alerte — ' + c.nom, size: 'sm', fields: [{ name: 'seuil', label: 'Seuil (m³)', type: 'number', min: 0, required: true, full: true }], values: c, onSubmit: function (v) { if (v.seuil >= c.capacite) { U.toast('Le seuil doit être inférieur à la capacité.', 'err'); return false; } c.seuil = v.seuil; S.save(); E.log('Seuil d\'alerte modifié', c.nom + ' : ' + m3(v.seuil), MOD); U.toast('Seuil mis à jour.'); refresh(); } });
  }

  /* ------------------------------------------------------------------ saisies */
  function newCmd() {
    var esL = escalesAll().filter(function (x) { return x.site === 'POG' && x.statut !== 'Appareillé'; }).map(function (x) { return { v: x.id, l: x.id + ' — ' + x.navire }; });
    var m = U.formModal({ title: 'Nouvelle commande de soutage', sub: 'Demande transmise par le consignataire ou l\'armateur', fields: [
      { name: 'escale', label: 'Escale (Port-Gentil)', type: 'select', options: esL, empty: 'Hors escale (navire en rade)' },
      { name: 'navire', label: 'Navire', required: true, placeholder: 'ex. MT West Gentil' },
      { name: 'client', label: 'Client', type: 'select', options: E.options('clients'), required: true },
      { name: 'produit', label: 'Produit', type: 'select', options: Object.keys(PROD).map(function (k) { return { v: k, l: PROD[k].l }; }) },
      { name: 'qte', label: 'Quantité demandée (m³)', type: 'number', min: 1, required: true },
      { name: 'moyen', label: 'Moyen de livraison', type: 'select', options: MOYENS },
      { name: 'date', label: 'Date du créneau', type: 'date', required: true },
      { name: 'heure', label: 'Heure', type: 'time', required: true }
    ], values: { client: 'C-05', produit: 'MGO', moyen: MOYENS[1], date: d(1), heure: '08:00' }, okLabel: 'Enregistrer la commande', onSubmit: function (v) {
      if (!(v.qte > 0)) { U.toast('Quantité invalide.', 'err'); return false; }
      var es = escale(v.escale);
      var o = S.add('soutages', { id: S.next('SOU'), escale: v.escale || '', navire: v.navire, imo: es ? es.imo : '', pavillon: es ? es.pavillon : '', client: v.client, produit: v.produit, qteDemandee: v.qte, qteLivree: 0, moyen: v.moyen, creneau: v.date + 'T' + v.heure, statut: 'Demandée', cuve: '', historique: [{ at: now(), user: me(), action: 'Commande enregistrée' }] });
      E.log('Commande de soutage', o.id + ' · ' + o.navire + ' · ' + m3(o.qteDemandee) + ' ' + PROD[o.produit].s, MOD);
      E.notify('Commande de soutage à valider', o.navire + ' — ' + PROD[o.produit].l, '#/soutage/commandes/' + o.id, 'orange');
      U.toast('Commande ' + o.id + ' enregistrée, en attente de validation.'); st.fs = 'En cours'; if (st.tab !== 'commandes') E.go(MOD + '/commandes'); else refresh();
    } });
    var sel = m.el.querySelector('[name=escale]');
    sel.addEventListener('change', function () { var es = escale(sel.value); if (es) { m.el.querySelector('[name=navire]').value = es.navire; if (S.get('clients', es.client)) m.el.querySelector('[name=client]').value = es.client; m.el.querySelector('[name=date]').value = String(es.eta).slice(0, 10) < today() ? today() : String(es.eta).slice(0, 10); } });
  }
  function newRec(cid) {
    U.formModal({ title: 'Réception de produit', sub: 'Réapprovisionnement d\'une cuve', fields: [
      { name: 'cuve', label: 'Cuve', type: 'select', required: true, full: true, options: cuves().map(function (c) { return { v: c.id, l: c.nom + ' — creux ' + F.num(c.capacite - c.niveau) + ' m³' }; }) },
      { name: 'qte', label: 'Quantité (m³)', type: 'number', min: 1, required: true },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'fournisseur', label: 'Provenance', full: true, required: true },
      { name: 'bl', label: 'N° de bon de livraison / relevé' },
      { name: 'statut', label: 'Statut', type: 'select', options: ['Réceptionnée', 'Programmée'] }
    ], values: { cuve: cid || cuves()[0].id, date: today(), statut: 'Réceptionnée', fournisseur: 'Dépôt pétrolier de Port-Gentil (démo)' }, okLabel: 'Enregistrer', onSubmit: function (v) {
      var c = cuve(v.cuve); if (!(v.qte > 0)) { U.toast('Quantité invalide.', 'err'); return false; }
      if (v.statut === 'Réceptionnée' && c.niveau + v.qte > c.capacite) { U.toast('Débordement : le creux disponible est de ' + m3(c.capacite - c.niveau) + '.', 'err'); return false; }
      if (c.produit === 'EAU' && /p[ée]trol/i.test(v.fournisseur)) v.fournisseur = 'Réseau d\'eau potable de Port-Gentil (démo)';
      var r = S.add('receptionsSoutage', { id: S.next('RSO'), date: v.date, cuve: c.id, produit: c.produit, qte: v.qte, fournisseur: v.fournisseur, bl: v.bl, transport: c.produit === 'EAU' ? 'Adduction réseau' : 'Pipeline dépôt → parc soutage', statut: v.statut, user: me() });
      if (v.statut === 'Réceptionnée') { c.niveau += v.qte; c.maj = now(); S.save(); addMv(c.id, 'Entrée', v.qte, r.id, 'Réception — ' + v.fournisseur); }
      E.log('Réception de produit ' + v.statut.toLowerCase(), r.id + ' · ' + c.nom + ' · ' + m3(v.qte), MOD);
      U.toast(v.statut === 'Réceptionnée' ? c.nom + ' : +' + m3(v.qte) + ' (stock ' + m3(c.niveau) + ').' : 'Réception programmée le ' + F.date(v.date) + '.'); refresh();
    } });
  }
  function receive(id) {
    var r = S.get('receptionsSoutage', id), c = r && cuve(r.cuve); if (!r || !c) return;
    if (c.niveau + r.qte > c.capacite) return U.toast('Creux insuffisant dans ' + c.nom + ' (' + m3(c.capacite - c.niveau) + ').', 'err');
    U.confirm('Réceptionner le produit', 'Confirmer l\'entrée de <b>' + m3(r.qte) + '</b> dans <b>' + esc(c.nom) + '</b> ?', 'Réceptionner', function () {
      r.statut = 'Réceptionnée'; r.date = today(); if (!r.bl) r.bl = 'BL-DP-' + (78000 + Math.floor(Math.random() * 900)); c.niveau += r.qte; c.maj = now(); S.save();
      addMv(c.id, 'Entrée', r.qte, r.id, 'Réception — ' + r.fournisseur);
      E.log('Réception de produit', r.id + ' · ' + c.nom + ' · ' + m3(r.qte), MOD); U.toast(c.nom + ' réapprovisionnée : ' + m3(c.niveau) + '.'); refresh();
    });
  }
  function adjust(cid) {
    U.formModal({ title: 'Jaugeage d\'une cuve', sub: 'Mesure contradictoire : l\'écart est enregistré en ajustement', fields: [
      { name: 'cuve', label: 'Cuve', type: 'select', required: true, full: true, options: cuves().map(function (c) { return { v: c.id, l: c.nom + ' — stock théorique ' + F.num(c.niveau) + ' m³' }; }) },
      { name: 'mesure', label: 'Volume mesuré (m³)', type: 'number', min: 0, step: 'any', required: true },
      { name: 'motif', label: 'Commentaire', placeholder: 'ex. jaugeage de fin de quinzaine' }
    ], values: { cuve: cid || cuves()[0].id }, okLabel: 'Enregistrer', onSubmit: function (v) {
      var c = cuve(v.cuve); if (v.mesure > c.capacite) { U.toast('Mesure supérieure à la capacité.', 'err'); return false; }
      var ec = Math.round((v.mesure - c.niveau) * 10) / 10; if (!ec) { U.toast('Aucun écart : stock confirmé.'); return; }
      c.niveau = v.mesure; c.maj = now(); S.save(); addMv(c.id, 'Ajustement', ec, 'JAU-' + today().replace(/-/g, ''), v.motif || 'Jaugeage contradictoire');
      E.log('Jaugeage', c.nom + ' : écart ' + F.num(ec, 1) + ' m³', MOD); U.toast('Écart de ' + (ec > 0 ? '+' : '') + F.num(ec, 1) + ' m³ enregistré.'); checkSeuil(c); refresh();
    } });
  }
  function exportTab() {
    if (st.tab === 'commandes') U.exportCSV('soutage-commandes', [{ label: 'N°', key: 'id' }, { label: 'Créneau', key: 'creneau' }, { label: 'Navire', key: 'navire' }, { label: 'Client', csv: function (o) { return clNom(o.client); } }, { label: 'Escale', key: 'escale' }, { label: 'Produit', csv: function (o) { return PROD[o.produit].l; } }, { label: 'Demandé (m³)', key: 'qteDemandee' }, { label: 'Livré (m³)', key: 'qteLivree' }, { label: 'Moyen', key: 'moyen' }, { label: 'Densité', key: 'densite' }, { label: 'Température', key: 'temperature' }, { label: 'Statut', csv: statut }], cmdRows());
    else if (st.tab === 'receptions') U.exportCSV('soutage-receptions', [{ label: 'N°', key: 'id' }, { label: 'Date', key: 'date' }, { label: 'Cuve', key: 'cuve' }, { label: 'Produit', key: 'produit' }, { label: 'Quantité (m³)', key: 'qte' }, { label: 'Provenance', key: 'fournisseur' }, { label: 'BL', key: 'bl' }, { label: 'Statut', key: 'statut' }], S.all('receptionsSoutage'));
    else U.exportCSV('soutage-mouvements', [{ label: 'Date', key: 'date' }, { label: 'Cuve', key: 'cuve' }, { label: 'Type', key: 'type' }, { label: 'Libellé', key: 'libelle' }, { label: 'Référence', key: 'ref' }, { label: 'Quantité (m³)', key: 'qte' }, { label: 'Stock après (m³)', key: 'solde' }], mvRows());
  }

  /* ------------------------------------------------------------------ intégration */
  function pending(u) {
    var out = [], p = u ? u.profile : '';
    if (p === 'admin' || p === 'exploitation') cmds().filter(function (o) { return o.statut === 'Demandée'; }).forEach(function (o) { out.push({ title: 'Valider le soutage — ' + o.navire, sub: PROD[o.produit].l + ' · ' + m3(o.qteDemandee) + ' · ' + when(o.creneau), href: '#/soutage/commandes/' + o.id, date: o.creneau.slice(0, 10), tone: 'orange', icon: 'fuel' }); });
    cuves().filter(bas).forEach(function (c) { out.push({ title: c.nom + ' sous le seuil d\'alerte', sub: m3(c.niveau) + ' pour un seuil de ' + m3(c.seuil) + ' — programmer une réception', href: '#/soutage', date: today(), tone: 'red', icon: 'alert' }); });
    return out;
  }
  function summary() {
    var m0 = E.iso(new Date(E.TODAY.getFullYear(), E.TODAY.getMonth(), 1));
    return [{ label: 'Soutage livré · 30 jours', value: F.num(livreDepuis(d(-30), 'MGO') + livreDepuis(d(-30), 'IFO')), unit: 'm³', icon: 'fuel', tone: 'navy', foot: 'eau douce ' + m3(livreDepuis(d(-30), 'EAU')) + ' · ' + E.MOIS[E.TODAY.getMonth()] + ' : ' + m3(livreDepuis(m0, 'MGO') + livreDepuis(m0, 'IFO')), href: '#/soutage' },
      { label: 'Stock gasoil marin', value: F.num(E.sum(cuves().filter(function (c) { return c.produit === 'MGO'; }), 'niveau')), unit: 'm³', icon: 'tank', tone: cuves().some(bas) ? 'red' : 'green', foot: cuves().filter(bas).length ? cuves().filter(bas).length + ' cuve(s) sous seuil' : 'stocks au-dessus des seuils', href: '#/soutage' }];
  }
  function search(q) {
    return cmds().filter(function (o) { return E.norm(o.id + ' ' + o.navire + ' ' + clNom(o.client) + ' ' + (o.escale || '')).indexOf(q) >= 0; }).map(function (o) { return { title: o.id + ' — ' + o.navire, sub: PROD[o.produit].l + ' · ' + m3(o.qteDemandee) + ' · ' + statut(o), href: '#/soutage/commandes/' + o.id }; });
  }
  function badge() { return cmds().filter(function (o) { return o.statut === 'Demandée'; }).length + cuves().filter(bas).length; }

  E.register({ id: MOD, label: 'Soutage & eau douce', title: 'Soutage & eau douce', icon: 'fuel', group: 'Exploitation portuaire', roles: ['exploitation', 'commercial'],
    seed: seed, init: init, render: render, pending: pending, summary: summary, search: search, badge: badge });
})();
