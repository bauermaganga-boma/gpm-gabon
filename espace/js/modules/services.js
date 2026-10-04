/* GPM · Espace de gestion — module « Services maritimes »
   Ordres de service liés aux escales : pilotage, remorquage, lamanage (amarrage / largage), avitaillement en eau.
   Tableau de bord du jour (timeline des mouvements), planning des pilotes et des moyens nautiques avec détection
   des conflits horaires, fiche de pilotage imprimable, transmission automatique des prestations à facturer.
   Données de démonstration (navires fictifs). */
(function () {
  'use strict';
  var E = window.ERP; if (!E) return;
  var U = E.ui, F = E.fmt, S = E.store, esc = E.esc, sum = E.sum;

  /* ------------------------------------------------------------------ référentiels */
  var TYPES = ['Pilotage', 'Remorquage', 'Lamanage', 'Avitaillement en eau'];
  var MOUV = ['Entrée', 'Sortie', 'Déhalage'];
  var ST = ['Demandé', 'Planifié', 'En cours', 'Réalisé', 'Facturé'];
  var ST_TONE = { 'Demandé': 'orange', 'Planifié': 'violet', 'En cours': 'blue', 'Réalisé': 'green', 'Facturé': 'navy', 'Annulé': 'red' };
  var T_COL = { 'Pilotage': '#2563eb', 'Remorquage': '#e8780c', 'Lamanage': '#7c3aed', 'Avitaillement en eau': '#0e7490' };
  var T_ICON = { 'Pilotage': 'compass', 'Remorquage': 'tug', 'Lamanage': 'anchor', 'Avitaillement en eau': 'drop' };
  var T_SHORT = { 'Pilotage': 'Pilotage', 'Remorquage': 'Remorquage', 'Lamanage': 'Lamanage', 'Avitaillement en eau': 'Eau douce' };
  var DUREE = { 'Pilotage': 90, 'Remorquage': 60, 'Lamanage': 30, 'Avitaillement en eau': 120 };
  var MOYEN_TYPES = { 'Pilotage': ['Vedette de pilotage'], 'Remorquage': ['Remorqueur'], 'Lamanage': ['Vedette d\'amarrage'], 'Avitaillement en eau': [] };
  var INDISPO = ['En maintenance', 'Hors service', 'Immobilisé'];

  /* ------------------------------------------------------------------
     TARIFS FICTIFS DE DÉMONSTRATION — utilisés pour pré-remplir les prestations à facturer.
     Ils ne correspondent à aucun barème officiel de GPM ou de l'OPRAG et doivent être remplacés par le tarif en vigueur. */
  var TARIFS = {
    pilotage: function (loa) { return loa < 100 ? 250000 : loa < 150 ? 420000 : 600000; }, /* FCFA par mouvement, selon la longueur du navire */
    deplacementCoef: 0.6,          /* déhalage : 60 % du tarif de pilotage */
    remorqueurHeure: 380000,       /* FCFA par heure et par remorqueur (minimum 1 h, par demi-heure ensuite) */
    lamanage: 120000,              /* FCFA par opération d'amarrage ou de largage */
    eauM3: 2500                    /* FCFA par m³ d'eau douce livrée */
  };

  /* ------------------------------------------------------------------ utilitaires */
  function pad(n) { return String(n).padStart(2, '0'); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function isoDT(d) { return E.iso(d) + 'T' + hm(d); }
  function nowISO() { return isoDT(new Date()); }
  function ms(s) { return s ? new Date(String(s).slice(0, 16)).getTime() : null; }
  function dt(day, h, m) { var d = new Date(E.TODAY); d.setDate(d.getDate() + day); d.setHours(h || 0, m || 0, 0, 0); return isoDT(d); }
  function fdt(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + ' ' + s.slice(11, 16) : '—'; }
  function fh(s) { return s ? s.slice(11, 16) : '—'; }
  function hmDur(m) { if (m == null) return '—'; m = Math.round(m); return m >= 60 ? Math.floor(m / 60) + ' h ' + pad(m % 60) : m + ' min'; }
  function dayLong(d) { var x = E.parseDate(d), j = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][x.getDay()]; return j + ' ' + F.date(d); }
  function dayRel(d) { var n = E.daysBetween(E.today(), d); return n === 0 ? 'Aujourd\'hui' : n === -1 ? 'Hier' : n === 1 ? 'Demain' : dayLong(d); }
  function user() { var u = E.session.user(); return u ? u.name : 'Système'; }
  function esca(id) { return S.get('escales', id); }
  function navire(s) { var e = esca(s.escale); return e ? e.navire : s.escale || '—'; }
  function siteCourt(id) { return id === 'POG' ? 'Port-Gentil' : 'Owendo'; }
  function posteCourt(id) { var p = S.get('postes', id); return p ? p.nom.replace('Owendo · ', '').replace('Port-Gentil · ', '') : id || '—'; }
  function flotte(id) { return S.get('flotte', id); }
  function moyNom(id) { var f = flotte(id); return f ? f.nom : id; }
  function pilotes(site) { return S.all('employes').filter(function (e) { return e.direction === 'MAR' && e.poste === 'Pilote maritime' && (!site || e.site === site); }); }
  function moyensDispo(site, types) { return S.all('flotte').filter(function (f) { return (!site || f.site === site) && (!types || types.indexOf(f.type) >= 0); }); }
  function empId(prefix) { var e = S.all('employes').find(function (x) { return x.nom.indexOf(prefix) === 0; }); return e ? e.id : ''; }
  function nextId() { var n = Math.max.apply(null, srvs().map(function (x) { var m = String(x.id).match(/(\d+)$/); return m ? +m[1] : 0; }).concat([300])) + 1; return 'OS-2026-' + String(n).padStart(4, '0'); }
  function addHisto(s, txt) { s.histo = s.histo || []; s.histo.push({ at: nowISO(), txt: txt, user: user() }); }
  function badge(st) { return U.badge(st, ST_TONE[st] || 'grey'); }
  function tIcon(t, sz) { return E.icon(T_ICON[t] || 'info').replace('<svg ', '<svg style="width:' + (sz || 15) + 'px;height:' + (sz || 15) + 'px" '); }

  /* ------------------------------------------------------------------ calculs */
  function srvs() { return S.all('services'); }
  function startMs(s) { return ms(s.debut || s.heure); }
  function endMs(s) { if (s.fin) return ms(s.fin); var st = startMs(s), d = (s.duree || DUREE[s.type] || 60) * 6e4; if (s.statut === 'En cours') return Math.max(st + d, Date.now()); return st + d; }
  function onDay(d) { return srvs().filter(function (s) { return String(s.heure).slice(0, 10) === d && (!state.site || s.site === state.site); }); }
  function actif(s) { return ['Demandé', 'Planifié', 'En cours'].indexOf(s.statut) >= 0; }
  function late(s) { return (s.statut === 'Planifié' || s.statut === 'Demandé') && ms(s.heure) < Date.now() - 30 * 6e4; }
  function ressources(s) { return (s.pilote ? [s.pilote] : []).concat(s.moyens || []); }
  /* Conflits : une même ressource (pilote ou moyen nautique) affectée à deux ordres dont les horaires se chevauchent */
  function conflits(list) {
    list = (list || srvs()).filter(function (s) { return s.statut !== 'Annulé' && s.statut !== 'Facturé' && s.statut !== 'Réalisé'; });
    var out = {};
    for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) {
      var a = list[i], b = list[j];
      if (!(startMs(a) < endMs(b) && startMs(b) < endMs(a))) continue;
      ressources(a).forEach(function (r) {
        if (ressources(b).indexOf(r) < 0) return;
        var nm = S.get('employes', r) ? E.empName(r) : moyNom(r);
        (out[a.id] = out[a.id] || []).push({ r: r, nom: nm, avec: b }); (out[b.id] = out[b.id] || []).push({ r: r, nom: nm, avec: a });
      });
    }
    return out;
  }
  function conflitsListe() {
    var c = conflits(), seen = {}, out = [];
    Object.keys(c).forEach(function (id) { c[id].forEach(function (x) { var k = [id, x.avec.id].sort().join('|') + x.r; if (seen[k]) return; seen[k] = 1; out.push({ a: S.get('services', id), b: x.avec, nom: x.nom }); }); });
    return out.sort(function (p, q) { return startMs(p.a) - startMs(q.a); });
  }
  function controleRessources(v, ignoreId) {
    var err = [], warn = [], st = ms(v.heure), en = st + (+v.duree || DUREE[v.type]) * 6e4;
    (v.moyens || []).forEach(function (m) { var f = flotte(m); if (f && INDISPO.indexOf(f.statut) >= 0) err.push(f.nom + ' est indisponible (' + f.statut.toLowerCase() + ').'); });
    srvs().forEach(function (o) {
      if (o.id === ignoreId || !actif(o)) return;
      if (!(st < endMs(o) && startMs(o) < en)) return;
      ressources(v).forEach(function (r) { if (ressources(o).indexOf(r) >= 0) warn.push('Conflit horaire : ' + (S.get('employes', r) ? E.empName(r) : moyNom(r)) + ' est déjà affecté à ' + o.id + ' (' + T_SHORT[o.type] + ' ' + navire(o) + ', ' + fh(o.heure) + ').'); });
    });
    return { err: err, warn: warn };
  }
  function lignes(s) {
    var e = esca(s.escale) || { loa: 120, navire: s.escale }, L = [];
    if (s.type === 'Pilotage') L.push({ libelle: 'Pilotage — ' + s.mouvement.toLowerCase() + ' — ' + e.navire + ' (LOA ' + e.loa + ' m)', qte: 1, unite: 'mouvement', pu: Math.round(TARIFS.pilotage(e.loa) * (s.mouvement === 'Déhalage' ? TARIFS.deplacementCoef : 1)) });
    if (s.type === 'Remorquage') { var h = Math.max(1, Math.ceil(((s.fin && s.debut ? (ms(s.fin) - ms(s.debut)) / 6e4 : s.duree) || 60) / 30) / 2), n = Math.max(1, (s.moyens || []).length); L.push({ libelle: 'Remorquage — ' + s.mouvement.toLowerCase() + ' — ' + e.navire + ' (' + n + ' remorqueur' + (n > 1 ? 's' : '') + ' × ' + F.num(h, 1) + ' h)', qte: n * h, unite: 'h·remorqueur', pu: TARIFS.remorqueurHeure }); }
    if (s.type === 'Lamanage') L.push({ libelle: (s.mouvement === 'Sortie' ? 'Lamanage — largage' : 'Lamanage — amarrage') + ' — ' + e.navire, qte: s.mouvement === 'Déhalage' ? 2 : 1, unite: 'opération', pu: TARIFS.lamanage });
    if (s.type === 'Avitaillement en eau') L.push({ libelle: 'Avitaillement en eau douce — ' + e.navire, qte: +s.eauLivree || +s.eau || 0, unite: 'm³', pu: TARIFS.eauM3 });
    return L;
  }
  function transmettre(s, silent) {
    var e = esca(s.escale), L = lignes(s), ids = [];
    L.forEach(function (l) { var id = S.next('PRS'); ids.push(id); S.add('prestations', { id: id, escale: s.escale, client: e ? e.client : '', date: E.today(), libelle: l.libelle, qte: l.qte, unite: l.unite, pu: l.pu, statut: 'À facturer', source: 'services', ref: s.id, site: s.site }); });
    s.prestation = ids[0]; addHisto(s, 'Prestation transmise à la facturation (' + F.money(sum(L, function (l) { return l.qte * l.pu; })) + ' HT)'); S.save();
    E.log('Prestation de service maritime à facturer ' + s.id, L.map(function (l) { return l.libelle; }).join(' / '), 'services');
    if (!silent) U.toast('Prestation transmise à la facturation');
    return L;
  }
  /* Passe en « Facturé » les ordres dont la prestation a été facturée par le module Finances */
  function sync() {
    var ch = false;
    srvs().forEach(function (s) { if (s.statut === 'Réalisé' && s.prestation) { var p = S.get('prestations', s.prestation); if (p && p.statut && p.statut !== 'À facturer') { s.statut = 'Facturé'; ch = true; } } });
    if (ch) S.save();
  }

  /* ------------------------------------------------------------------ données d'exemple (cohérentes avec les escales de démonstration) */
  function seed() {
    var NG = empId('Nguema'), MI = empId('Mintsa'), MB = empId('Mba Nziengui');
    var R = [
      ['0412', 'Pilotage', 'Entrée', -1, 6, 0, 'Facturé', NG, ['VP-01'], 0, 95],
      ['0412', 'Remorquage', 'Entrée', -1, 6, 30, 'Facturé', '', ['RM-01', 'RM-02'], 0, 60],
      ['0412', 'Lamanage', 'Entrée', -1, 7, 15, 'Facturé', '', ['VA-01'], 0, 35],
      ['0420', 'Pilotage', 'Entrée', -1, 14, 20, 'Réalisé', MB, [], 0, 70],
      ['0420', 'Lamanage', 'Entrée', -1, 15, 10, 'Réalisé', '', [], 0, 30],
      ['0412', 'Avitaillement en eau', '', -1, 16, 0, 'Réalisé', '', [], 150, 150],
      ['0422', 'Pilotage', 'Entrée', 0, 8, 0, 'Réalisé', MB, [], 0, 80],
      ['0422', 'Remorquage', 'Entrée', 0, 8, 30, 'Réalisé', '', ['RM-03'], 0, 45],
      ['0422', 'Lamanage', 'Entrée', 0, 9, 5, 'Réalisé', '', [], 0, 25],
      ['0420', 'Avitaillement en eau', '', 0, 7, 30, 'auto', '', [], 250, 180],
      ['0412', 'Avitaillement en eau', '', 0, 10, 0, 'auto', '', [], 120, 120],
      ['0422', 'Avitaillement en eau', '', 0, 13, 0, 'auto', '', [], 180, 150],
      ['0413', 'Pilotage', 'Entrée', 0, 14, 0, 'Planifié', MI, ['VP-02'], 0, 90],
      ['0413', 'Remorquage', 'Entrée', 0, 14, 15, 'Planifié', '', ['RM-01', 'RM-02'], 0, 60],
      ['0413', 'Lamanage', 'Entrée', 0, 14, 50, 'Planifié', '', ['VA-01'], 0, 30],
      ['0414', 'Lamanage', 'Sortie', 0, 19, 30, 'Demandé', '', [], 0, 30],
      ['0414', 'Pilotage', 'Sortie', 0, 20, 0, 'Planifié', NG, ['VP-01'], 0, 90],
      ['0414', 'Remorquage', 'Sortie', 0, 20, 0, 'Planifié', '', ['RM-01'], 0, 60],
      ['0422', 'Pilotage', 'Sortie', 0, 21, 0, 'Planifié', MB, [], 0, 90],
      ['0422', 'Remorquage', 'Sortie', 0, 21, 0, 'Planifié', '', ['RM-03'], 0, 60],
      ['0420', 'Pilotage', 'Sortie', 0, 21, 45, 'Planifié', MB, [], 0, 90],
      ['0420', 'Remorquage', 'Sortie', 0, 21, 45, 'Planifié', '', ['RM-03'], 0, 60],
      ['0415', 'Pilotage', 'Entrée', 1, 5, 0, 'Demandé', '', [], 0, 90],
      ['0415', 'Remorquage', 'Entrée', 1, 5, 15, 'Demandé', '', [], 0, 60],
      ['0415', 'Lamanage', 'Entrée', 1, 5, 50, 'Demandé', '', [], 0, 30],
      ['0421', 'Pilotage', 'Entrée', 1, 11, 0, 'Demandé', '', [], 0, 80],
      ['0421', 'Lamanage', 'Entrée', 1, 11, 45, 'Demandé', '', [], 0, 30],
      ['0412', 'Pilotage', 'Sortie', 1, 18, 0, 'Demandé', '', [], 0, 90],
      ['0412', 'Remorquage', 'Sortie', 1, 18, 0, 'Demandé', '', [], 0, 60]
    ];
    var SITE = { '0412': 'OWE', '0413': 'OWE', '0414': 'OWE', '0415': 'OWE', '0420': 'POG', '0421': 'POG', '0422': 'POG' };
    var now = Date.now();
    return { services: R.map(function (r, i) {
      var h = dt(r[3], r[4], r[5]), st = r[6], start = ms(h), end = start + r[10] * 6e4;
      if (st === 'auto') st = end <= now ? 'Réalisé' : start <= now ? 'En cours' : 'Planifié';
      var done = st === 'Réalisé' || st === 'Facturé';
      return { id: 'OS-2026-' + String(301 + i).padStart(4, '0'), escale: 'ESC-2026-' + r[0], site: SITE[r[0]], type: r[1], mouvement: r[2] || 'Entrée', heure: h, duree: r[10], pilote: r[7], moyens: r[8], eau: r[9] || 0, eauLivree: done && r[9] ? r[9] - (i % 3) * 5 : null,
        statut: st, debut: st === 'En cours' || done ? isoDT(new Date(start + 5 * 6e4)) : '', fin: done ? isoDT(new Date(end + 5 * 6e4)) : '', obs: '', prestation: st === 'Facturé' ? 'facturé' : '', histo: [] };
    }) };
  }

  /* ------------------------------------------------------------------ vues */
  var TABS = [{ k: 'jour', l: 'Tableau du jour' }, { k: 'planning', l: 'Planning pilotes & moyens' }, { k: 'ordres', l: 'Ordres de service' }];
  var state = { tab: 'jour', day: null, site: '', fType: '', fSt: '' };

  function render(view, params) {
    sync();
    if (!state.day) state.day = E.today();
    var p0 = params[0], openId = null, newFor = null;
    if (p0 === 'nouveau') newFor = params[1] || '';
    else if (p0 && S.get('services', p0)) openId = p0;
    else if (p0 && TABS.some(function (t) { return t.k === p0; })) state.tab = p0;
    if (openId) state.day = String(S.get('services', openId).heure).slice(0, 10);
    var d = state.day, list = onDay(d), conf = conflitsListe().filter(function (c) { return (!state.site || c.a.site === state.site); });
    var mvts = list.filter(function (s) { return s.type === 'Pilotage' && s.statut !== 'Annulé'; });
    var rem = list.filter(function (s) { return s.type === 'Remorquage' && s.statut !== 'Annulé'; });
    var eau = list.filter(function (s) { return s.type === 'Avitaillement en eau' && s.statut !== 'Annulé'; });
    var dem = srvs().filter(function (s) { return s.statut === 'Demandé' && (!state.site || s.site === state.site); });
    var head =
      '<div class="srv-bar"><div class="srv-daynav"><button class="btn icon" id="sv-prev" aria-label="Jour précédent">' + E.icon('back') + '</button><div><b>' + dayRel(d) + '</b><span>' + (E.daysBetween(E.today(), d) >= -1 && E.daysBetween(E.today(), d) <= 1 ? dayLong(d) : '') + '</span></div><button class="btn icon" id="sv-next" aria-label="Jour suivant">' + E.icon('arrow') + '</button>' + (d !== E.today() ? '<button class="btn sm ghost" id="sv-today">Aujourd\'hui</button>' : '') + '</div>' +
      '<div class="chips" id="sv-site">' + [['', 'Tous les ports'], ['OWE', 'Owendo'], ['POG', 'Port-Gentil']].map(function (c) { return '<button class="chip' + (state.site === c[0] ? ' is-active' : '') + '" data-k="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div><span class="spacer"></span>' +
      '<button class="btn primary" id="sv-new">' + E.icon('plus') + 'Nouvel ordre de service</button></div>' +
      '<div class="grid g4 srv-kpis">' +
        U.kpi({ label: 'Mouvements de navires', value: mvts.length, icon: 'compass', tone: 'blue', foot: mvts.filter(function (s) { return s.mouvement === 'Entrée'; }).length + ' entrées · ' + mvts.filter(function (s) { return s.mouvement === 'Sortie'; }).length + ' sorties · ' + mvts.filter(function (s) { return s.mouvement === 'Déhalage'; }).length + ' déhalages' }) +
        U.kpi({ label: 'Remorquage', value: F.num(sum(rem, function (s) { return (s.duree || 60) * Math.max(1, (s.moyens || []).length) / 60; }), 1), unit: 'h', icon: 'tug', tone: 'orange', foot: rem.length + ' assistances · heures × remorqueurs' }) +
        U.kpi({ label: 'Eau douce', value: F.num(sum(eau, function (s) { return s.eauLivree != null ? s.eauLivree : s.eau; })), unit: 'm³', icon: 'drop', tone: 'green', foot: eau.filter(function (s) { return s.statut === 'Réalisé' || s.statut === 'Facturé'; }).length + ' livraisons terminées sur ' + eau.length }) +
        U.kpi({ label: 'À planifier', value: dem.length, icon: 'calendar', tone: dem.length ? 'orange' : 'green', foot: conf.length ? '<span class="down">' + conf.length + ' conflit(s) horaire(s)</span>' : 'aucun conflit horaire' }) +
      '</div>';
    var counts = { jour: list.length, planning: conf.length || null, ordres: srvs().filter(actif).length };
    view.innerHTML = head + U.tabs(TABS.map(function (t) { return { k: t.k, l: t.l, n: counts[t.k] }; }), state.tab, function (k) { state.tab = k; E.go('services/' + k); }) + '<div id="sv-body"></div>';
    view.querySelector('#sv-prev').onclick = function () { state.day = E.addDays(state.day, -1); E.rerender(); };
    view.querySelector('#sv-next').onclick = function () { state.day = E.addDays(state.day, 1); E.rerender(); };
    var t = view.querySelector('#sv-today'); if (t) t.onclick = function () { state.day = E.today(); E.rerender(); };
    view.querySelector('#sv-site').addEventListener('click', function (ev) { var b = ev.target.closest('.chip'); if (b) { state.site = b.dataset.k; E.rerender(); } });
    view.querySelector('#sv-new').onclick = function () { osForm(null, {}); };
    var body = view.querySelector('#sv-body');
    ({ jour: vJour, planning: vPlanning, ordres: vOrdres })[state.tab](body);
    var ta = view.querySelector('.tabs .tab.is-active'); if (ta && ta.parentNode.scrollWidth > ta.parentNode.clientWidth) ta.parentNode.scrollLeft = ta.offsetLeft - 16;
    if (openId) openOS(openId, true);
    if (newFor != null) { history.replaceState(null, '', '#/services/' + state.tab); osForm(null, { escale: newFor }); }
  }
  function clearDeep() { if (location.hash.split('/').length > 2 && !TABS.some(function (t) { return location.hash === '#/services/' + t.k; })) history.replaceState(null, '', '#/services/' + state.tab); }

  /* ---------- timeline 24 h ---------- */
  function timeline(rows, opt) {
    opt = opt || {};
    var d = state.day, f0 = new Date(E.parseDate(d)).getTime(), span = 864e5, mobile = window.innerWidth <= 640;
    var labW = mobile ? 118 : 200, hourW = mobile ? 40 : 46, x = function (t) { return Math.max(0, Math.min(100, (t - f0) / span * 100)); };
    var nowX = d === E.today() ? (Date.now() - f0) / span * 100 : null;
    var head = '<div class="srv-tl__head"><div class="srv-tl__lab">' + esc(opt.title || 'Navire') + '</div><div class="srv-tl__hours">';
    for (var h = 0; h < 24; h++) head += '<span style="left:' + (h / 24 * 100) + '%">' + pad(h) + 'h</span>';
    head += (nowX != null ? '<div class="srv-tl__now" style="left:' + nowX + '%"><em>' + hm(new Date()) + '</em></div>' : '') + '</div></div>';
    var grid = ''; for (var g = 0; g < 24; g++) grid += '<i class="srv-tl__g' + (g % 6 === 0 ? ' major' : '') + (g < 6 || g >= 19 ? ' night' : '') + '" style="left:' + (g / 24 * 100) + '%;width:' + (100 / 24) + '%"></i>';
    var conf = conflits();
    var body = rows.map(function (r) {
      var lanes = [], blocks = '';
      r.items.sort(function (a, b) { return startMs(a) - startMs(b); }).forEach(function (s) {
        var a = startMs(s), b = endMs(s), lane = 0; while (lanes[lane] != null && lanes[lane] > a) lane++; lanes[lane] = b;
        var l = x(a), w = Math.max(1.2, x(b) - l), c = conf[s.id] && opt.conflicts !== false;
        blocks += '<button class="srv-blk st-' + E.norm(s.statut).replace(/\s/g, '-') + (c ? ' is-conf' : '') + (late(s) ? ' is-late' : '') + '" data-os="' + s.id + '" style="left:' + l + '%;width:' + w + '%;top:' + (6 + lane * 30) + 'px;--c:' + T_COL[s.type] + '" title="' + esc(s.id + ' · ' + s.type + ' ' + (s.type !== 'Avitaillement en eau' ? s.mouvement : '') + ' · ' + navire(s) + ' · ' + fh(s.heure) + ' (' + hmDur(s.duree) + ') · ' + s.statut + (c ? ' · CONFLIT' : '')) + '">' + tIcon(s.type, 12) + '<span>' + esc(opt.blockLabel ? opt.blockLabel(s) : T_SHORT[s.type]) + '</span></button>';
      });
      return '<div class="srv-tl__row' + (r.off ? ' is-off' : '') + '"><div class="srv-tl__lab"><b>' + esc(r.label) + '</b><span>' + esc(r.sub || '') + '</span></div><div class="srv-tl__track" style="height:' + (Math.max(1, lanes.length) * 30 + 12) + 'px">' + grid + blocks + (r.off ? '<div class="srv-tl__offmsg">' + esc(r.off) + '</div>' : '') + (nowX != null ? '<div class="srv-tl__nowl" style="left:' + nowX + '%"></div>' : '') + '</div></div>';
    }).join('');
    var id = 'tl' + Math.random().toString(36).slice(2, 7);
    setTimeout(function () { var el = document.getElementById(id); if (!el) return; var nx = nowX != null ? nowX / 100 : 7 / 24; el.scrollLeft = Math.max(0, (el.scrollWidth - labW) * nx - (el.clientWidth - labW) * 0.35); });
    return '<div class="srv-tl" id="' + id + '"><div class="srv-tl__in" style="min-width:' + (labW + 24 * hourW) + 'px;--lab:' + labW + 'px">' + head + (body || '<div class="empty">Aucun ordre de service ce jour.</div>') + '</div></div>';
  }
  function wireBlocks(el) { E.$$('[data-os]', el).forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); openOS(b.dataset.os); }; }); }
  function legend() { return '<div class="legend">' + TYPES.map(function (t) { return '<span><i style="background:' + T_COL[t] + '"></i>' + T_SHORT[t] + '</span>'; }).join('') + '<span><i class="srv-lg-plan"></i>Demandé / planifié</span><span><i class="srv-lg-conf"></i>Conflit</span><span><i style="background:var(--red);width:2px"></i>Maintenant</span></div>'; }

  /* ---------- tableau du jour ---------- */
  function vJour(el) {
    var list = onDay(state.day).filter(function (s) { return s.statut !== 'Annulé'; }), groups = {};
    list.forEach(function (s) { (groups[s.escale] = groups[s.escale] || []).push(s); });
    var rows = Object.keys(groups).map(function (k) { var e = esca(k); return { label: e ? e.navire : k, sub: e ? posteCourt(e.poste) + ' · ' + siteCourt(e.site) : '', items: groups[k], t: Math.min.apply(null, groups[k].map(startMs)) }; }).sort(function (a, b) { return a.t - b.t; });
    var conf = conflitsListe().filter(function (c) { return String(c.a.heure).slice(0, 10) === state.day || String(c.b.heure).slice(0, 10) === state.day; }).filter(function (c) { return !state.site || c.a.site === state.site; });
    var agenda = list.slice().sort(function (a, b) { return startMs(a) - startMs(b); });
    var nowT = Date.now(), nextIdx = agenda.findIndex(function (s) { return startMs(s) >= nowT; });
    var fl = moyensDispo(state.site, ['Remorqueur', 'Vedette de pilotage', 'Vedette d\'amarrage']);
    el.innerHTML =
      '<div class="card"><div class="card__h"><h3>Timeline des mouvements</h3><span class="sub">' + list.length + ' ordre(s) · cliquez sur un bloc pour ouvrir l\'ordre</span></div>' + timeline(rows) + '<div class="card__b">' + legend() + '</div></div>' +
      '<div class="grid g-2-1" style="margin-top:16px">' +
        '<div class="card"><div class="card__h"><h3>Programme de la journée</h3><span class="sub">' + dayLong(state.day) + '</span></div>' +
          (agenda.length ? '<div class="srv-agenda">' + agenda.map(function (s, i) {
            var e = esca(s.escale), c = conflits()[s.id];
            return (i === nextIdx && state.day === E.today() ? '<div class="srv-agenda__now"><span>Maintenant · ' + hm(new Date()) + '</span></div>' : '') +
              '<div class="srv-ag" data-os="' + s.id + '" style="--c:' + T_COL[s.type] + '"><div class="srv-ag__h"><b>' + fh(s.heure) + '</b><span>' + hmDur(s.duree) + '</span></div><div class="srv-ag__i">' + tIcon(s.type, 17) + '</div><div class="srv-ag__b"><b>' + esc(T_SHORT[s.type]) + (s.type !== 'Avitaillement en eau' ? ' · ' + esc(s.mouvement) : ' · ' + F.num(s.eauLivree != null ? s.eauLivree : s.eau) + ' m³') + ' — ' + esc(e ? e.navire : s.escale) + '</b><div class="small muted">' + esc(e ? posteCourt(e.poste) : '') + (s.pilote ? ' · ' + esc(E.empName(s.pilote)) : '') + ((s.moyens || []).length ? ' · ' + s.moyens.map(moyNom).map(esc).join(', ') : '') + '</div>' + (c ? '<div class="small srv-neg">' + E.icon('alert').replace('<svg ', '<svg style="width:12px;vertical-align:-2px" ') + ' Conflit : ' + esc(c[0].nom) + ' (' + esc(c[0].avec.id) + ')</div>' : '') + (late(s) ? '<div class="small srv-warn">En retard sur l\'horaire demandé</div>' : '') + '</div><div class="srv-ag__s">' + badge(s.statut) + quickBtn(s) + '</div></div>';
          }).join('') + (nextIdx < 0 && state.day === E.today() ? '<div class="srv-agenda__now"><span>Maintenant · ' + hm(new Date()) + '</span></div>' : '') + '</div>' : '<div class="empty">Aucun ordre de service ce jour.</div>') + '</div>' +
        '<div class="stack">' +
          '<div class="card"><div class="card__h"><h3>Conflits horaires</h3><span class="badge ' + (conf.length ? 'tone-red' : 'tone-green') + '">' + conf.length + '</span></div>' +
            (conf.length ? '<div class="list">' + conf.map(function (c) { return '<div class="list__item"><div class="list__icon tone-red">' + E.icon('alert') + '</div><div class="list__body"><b>' + esc(c.nom) + '</b><div class="small muted">' + esc(c.a.id) + ' ' + T_SHORT[c.a.type] + ' ' + esc(navire(c.a)) + ' à ' + fh(c.a.heure) + '<br>' + esc(c.b.id) + ' ' + T_SHORT[c.b.type] + ' ' + esc(navire(c.b)) + ' à ' + fh(c.b.heure) + '</div><button class="btn sm" style="margin-top:6px" data-plan="' + c.b.id + '">' + E.icon('calendar') + 'Replanifier ' + esc(c.b.id) + '</button></div></div>'; }).join('') + '</div>' : '<div class="empty">' + E.icon('check') + '<div>Aucun conflit sur les pilotes et moyens nautiques.</div></div>') + '</div>' +
          '<div class="card"><div class="card__h"><h3>Moyens nautiques</h3><span class="spacer"></span><button class="btn sm ghost" id="sv-goplan">Planning</button></div><div class="list">' +
            fl.map(function (f) { var busy = srvs().find(function (s) { return actif(s) && (s.moyens || []).indexOf(f.id) >= 0 && startMs(s) <= Date.now() && endMs(s) >= Date.now(); }); var nxt = srvs().filter(function (s) { return actif(s) && (s.moyens || []).indexOf(f.id) >= 0 && startMs(s) > Date.now(); }).sort(function (a, b) { return startMs(a) - startMs(b); })[0]; var off = INDISPO.indexOf(f.statut) >= 0;
              return '<div class="list__item"><div class="list__icon ' + (off ? 'tone-red' : busy ? 'tone-blue' : 'tone-green') + '">' + E.icon(f.type === 'Remorqueur' ? 'tug' : 'ship') + '</div><div class="list__body"><b>' + esc(f.nom) + '</b><div class="small muted">' + esc(f.type) + ' · ' + siteCourt(f.site) + (nxt ? ' · prochain : ' + fdt(nxt.heure) : '') + '</div></div>' + (off ? U.badge(f.statut, 'red') : busy ? U.badge('En mission', 'blue') : U.badge('Disponible', 'green')) + '</div>'; }).join('') + '</div></div>' +
        '</div>' +
      '</div>';
    wireBlocks(el); wireQuick(el);
    E.$$('[data-plan]', el).forEach(function (b) { b.onclick = function () { planForm(S.get('services', b.dataset.plan)); }; });
    el.querySelector('#sv-goplan').onclick = function () { state.tab = 'planning'; E.go('services/planning'); };
  }
  function quickBtn(s) {
    if (s.statut === 'Demandé') return '<button class="btn sm" data-q="plan" data-id="' + s.id + '">Planifier</button>';
    if (s.statut === 'Planifié') return '<button class="btn sm" data-q="start" data-id="' + s.id + '">Démarrer</button>';
    if (s.statut === 'En cours') return '<button class="btn sm primary" data-q="end" data-id="' + s.id + '">Terminer</button>';
    return '';
  }
  function wireQuick(el) { E.$$('[data-q]', el).forEach(function (b) { b.onclick = function (ev) { ev.stopPropagation(); action(b.dataset.id, b.dataset.q); }; }); }

  /* ---------- planning pilotes & moyens ---------- */
  function vPlanning(el) {
    var d = state.day, list = srvs().filter(function (s) { return String(s.heure).slice(0, 10) === d && s.statut !== 'Annulé'; });
    var rows = [{ grp: 'Pilotes maritimes' }];
    pilotes(state.site).forEach(function (p) { rows.push({ label: p.nom, sub: 'Pilote · ' + siteCourt(p.site), items: list.filter(function (s) { return s.pilote === p.id; }) }); });
    rows.push({ grp: 'Remorqueurs & vedettes' });
    moyensDispo(state.site, ['Remorqueur', 'Vedette de pilotage', 'Vedette d\'amarrage']).forEach(function (f) { rows.push({ label: f.nom, sub: f.type + ' · ' + siteCourt(f.site), items: list.filter(function (s) { return (s.moyens || []).indexOf(f.id) >= 0; }), off: INDISPO.indexOf(f.statut) >= 0 ? f.statut : '' }); });
    var nonAff = list.filter(function (s) { return s.statut === 'Demandé' && (!state.site || s.site === state.site); });
    var html = '', chunk = [];
    function flush(title) { if (chunk.length) html += timeline(chunk, { title: title, blockLabel: function (s) { return fh(s.heure) + ' ' + navire(s).replace(/^(MV|MT|PSV) /, ''); } }); chunk = []; }
    var curTitle = '';
    rows.forEach(function (r) { if (r.grp) { flush(curTitle); curTitle = r.grp; html += '<div class="srv-grp">' + esc(r.grp) + '</div>'; } else chunk.push(r); });
    flush(curTitle);
    var charge = pilotes(state.site).map(function (p) { var l = list.filter(function (s) { return s.pilote === p.id; }); return { p: p, n: l.length, m: sum(l, 'duree') }; });
    el.innerHTML =
      '<div class="card"><div class="card__h"><h3>Planning des pilotes et des moyens nautiques</h3><span class="sub">' + dayLong(d) + ' · disponibilités et conflits horaires</span></div>' + html + '<div class="card__b">' + legend() + '</div></div>' +
      '<div class="grid g2 stack-m" style="margin-top:16px">' +
        '<div class="card"><div class="card__h"><h3>Ordres non affectés</h3><span class="badge ' + (nonAff.length ? 'tone-orange' : 'tone-green') + '">' + nonAff.length + '</span></div>' +
          (nonAff.length ? '<div class="list">' + nonAff.sort(function (a, b) { return startMs(a) - startMs(b); }).map(function (s) { return '<div class="list__item"><div class="list__icon" style="background:' + T_COL[s.type] + '1a;color:' + T_COL[s.type] + '">' + tIcon(s.type, 17) + '</div><div class="list__body"><b>' + fh(s.heure) + ' · ' + esc(T_SHORT[s.type]) + ' ' + esc(s.type !== 'Avitaillement en eau' ? s.mouvement.toLowerCase() : '') + ' — ' + esc(navire(s)) + '</b><div class="small muted"><span class="mono">' + esc(s.id) + '</span> · ' + siteCourt(s.site) + '</div></div><button class="btn sm primary" data-q="plan" data-id="' + s.id + '">Affecter</button></div>'; }).join('') + '</div>' : '<div class="empty">' + E.icon('check') + '<div>Tous les ordres du jour sont affectés.</div></div>') + '</div>' +
        '<div class="card"><div class="card__h"><h3>Charge des pilotes</h3><span class="sub">' + dayRel(d) + '</span></div><div class="card__b stack">' +
          charge.map(function (c) { return '<div><div class="row small" style="justify-content:space-between"><span><b>' + esc(c.p.nom) + '</b> · ' + siteCourt(c.p.site) + '</span><span>' + c.n + ' mouvement(s) · ' + hmDur(c.m) + '</span></div>' + U.progress(Math.min(100, c.m / 480 * 100), c.m > 420 ? 'orange' : '') + '</div>'; }).join('') +
          '<div class="small muted">Référence : 8 h de pilotage effectif par jour et par pilote (démonstration).</div></div></div>' +
      '</div>';
    wireBlocks(el); wireQuick(el);
  }

  /* ---------- liste des ordres ---------- */
  function cols() {
    return [
      { key: 'id', label: 'N°', render: function (s) { return '<span class="mono">' + esc(s.id) + '</span>'; } },
      { key: 'heure', label: 'Horaire', render: function (s) { return '<span class="nowrap">' + fdt(s.heure) + '</span>' + (late(s) ? '<div class="small srv-warn">en retard</div>' : ''); } },
      { key: 'type', label: 'Service', render: function (s) { return '<span class="srv-type" style="--c:' + T_COL[s.type] + '">' + tIcon(s.type, 13) + esc(T_SHORT[s.type]) + '</span>' + (s.type !== 'Avitaillement en eau' ? '<div class="small muted">' + esc(s.mouvement) + '</div>' : '<div class="small muted">' + F.num(s.eauLivree != null ? s.eauLivree : s.eau) + ' m³</div>'); }, csv: function (s) { return s.type + (s.type !== 'Avitaillement en eau' ? ' ' + s.mouvement : ''); } },
      { key: 'escale', label: 'Navire', render: function (s) { var e = esca(s.escale); return '<b>' + esc(navire(s)) + '</b><div class="small muted">' + esc(s.escale) + (e ? ' · ' + esc(posteCourt(e.poste)) : '') + '</div>'; }, csv: function (s) { return navire(s) + ' (' + s.escale + ')'; } },
      { key: 'pilote', label: 'Pilote / moyens', render: function (s) { var t = []; if (s.pilote) t.push(esc(E.empName(s.pilote))); (s.moyens || []).forEach(function (m) { t.push(esc(moyNom(m))); }); return t.length ? t.join('<br>') : '<span class="muted">à affecter</span>'; }, csv: function (s) { return [s.pilote ? E.empName(s.pilote) : ''].concat((s.moyens || []).map(moyNom)).filter(Boolean).join(' / '); } },
      { key: 'duree', label: 'Durée', num: 1, render: function (s) { return hmDur(s.fin && s.debut ? (ms(s.fin) - ms(s.debut)) / 6e4 : s.duree); } },
      { key: 'statut', label: 'Statut', render: function (s) { return badge(s.statut) + (conflits()[s.id] ? ' ' + U.badge('Conflit', 'red') : ''); }, csv: function (s) { return s.statut; } }
    ];
  }
  function vOrdres(el) {
    var list = srvs().filter(function (s) { return (!state.site || s.site === state.site) && (!state.fType || s.type === state.fType) && (!state.fSt || s.statut === state.fSt); }).sort(function (a, b) { return String(b.heure).localeCompare(String(a.heure)); });
    var c = cols();
    el.innerHTML = '<div class="card"><div class="card__h"><h3>Ordres de service</h3><span class="sub">' + list.length + ' ordre(s)</span><span class="spacer"></span><button class="btn sm" id="sv-csv">' + E.icon('download') + 'Export CSV</button></div>' +
      '<div class="card__b" style="padding-bottom:0"><div class="filters"><div class="chips" id="sv-ft">' + [['', 'Tous']].concat(TYPES.map(function (t) { return [t, T_SHORT[t]]; })).map(function (x) { return '<button class="chip' + (state.fType === x[0] ? ' is-active' : '') + '" data-k="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<select class="select" id="sv-fs"><option value="">Tous les statuts</option>' + ST.concat(['Annulé']).map(function (s) { return '<option' + (state.fSt === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div></div>' +
      U.table(c, list, { onRow: function (s) { openOS(s.id); }, empty: 'Aucun ordre de service pour ces filtres' }) + '</div>';
    el.querySelector('#sv-ft').addEventListener('click', function (ev) { var b = ev.target.closest('.chip'); if (b) { state.fType = b.dataset.k; vOrdres(el); } });
    el.querySelector('#sv-fs').onchange = function (ev) { state.fSt = ev.target.value; vOrdres(el); };
    el.querySelector('#sv-csv').onclick = function () { U.exportCSV('ordres-services-maritimes-' + E.today(), c, list); };
  }

  /* ------------------------------------------------------------------ détail d'un ordre */
  function openOS(id, deep) {
    var s = S.get('services', id); if (!s) return;
    var e = esca(s.escale), idx = ST.indexOf(s.statut), c = conflits()[s.id];
    var body = (s.statut === 'Annulé' ? '<div class="alert tone-red" style="margin-bottom:12px">' + E.icon('x') + '<div>Ordre annulé' + (s.motif ? ' : ' + esc(s.motif) : '') + '</div></div>' : U.steps(ST, idx, { finished: s.statut === 'Facturé' })) +
      (c ? '<div class="alert tone-red" style="margin:10px 0">' + E.icon('alert') + '<div><b>Conflit horaire</b> — ' + c.map(function (x) { return esc(x.nom) + ' est aussi affecté à ' + esc(x.avec.id) + ' (' + T_SHORT[x.avec.type] + ' ' + esc(navire(x.avec)) + ' à ' + fh(x.avec.heure) + ')'; }).join(' ; ') + '.</div></div>' : '') +
      (late(s) ? '<div class="alert tone-orange" style="margin:10px 0">' + E.icon('clock') + '<div>Horaire demandé dépassé (' + fdt(s.heure) + ') : démarrer l\'ordre ou le replanifier.</div></div>' : '') +
      '<dl class="kv" style="margin-top:12px"><dt>Service</dt><dd><b>' + esc(s.type) + '</b>' + (s.type !== 'Avitaillement en eau' ? ' — ' + esc(s.mouvement) : '') + '</dd>' +
      '<dt>Navire</dt><dd><a href="#/escales/' + esc(s.escale) + '"><b>' + esc(navire(s)) + '</b></a><div class="small muted">' + esc(s.escale) + (e ? ' · ' + esc(E.posteName(e.poste)) + ' · LOA ' + e.loa + ' m · TE ' + F.num(e.te, 1) + ' m' : '') + '</div></dd>' +
      '<dt>Horaire demandé</dt><dd>' + fdt(s.heure) + ' · durée prévue ' + hmDur(s.duree) + '</dd>' +
      (s.debut ? '<dt>Réalisation</dt><dd>' + fh(s.debut) + ' → ' + (s.fin ? fh(s.fin) + ' (' + hmDur((ms(s.fin) - ms(s.debut)) / 6e4) + ')' : 'en cours') + '</dd>' : '') +
      (s.type === 'Pilotage' ? '<dt>Pilote</dt><dd>' + (s.pilote ? esc(E.empName(s.pilote)) : '<span class="muted">à affecter</span>') + '</dd>' : '') +
      '<dt>Moyens nautiques</dt><dd>' + ((s.moyens || []).length ? s.moyens.map(function (m) { var f = flotte(m); return esc(moyNom(m)) + (f ? ' <span class="small muted">(' + esc(f.puissance) + ')</span>' : ''); }).join('<br>') : '<span class="muted">' + (s.type === 'Avitaillement en eau' ? 'bouche d\'eau à quai' : s.type === 'Lamanage' ? 'équipe de lamaneurs à quai' : 'à affecter') + '</span>') + '</dd>' +
      (s.type === 'Avitaillement en eau' ? '<dt>Eau douce</dt><dd>' + F.num(s.eau) + ' m³ demandés' + (s.eauLivree != null ? ' · <b>' + F.num(s.eauLivree) + ' m³ livrés</b>' : '') + '</dd>' : '') +
      (s.obs ? '<dt>Observations</dt><dd>' + esc(s.obs) + '</dd>' : '') +
      '<dt>Facturation</dt><dd>' + (s.statut === 'Facturé' ? U.badge('Facturé', 'navy') : s.prestation ? U.badge('Transmise (' + s.prestation + ')', 'green') : s.statut === 'Réalisé' ? U.badge('À transmettre', 'orange') : '<span class="muted">après réalisation</span>') + '</dd></dl>' +
      ((s.histo || []).length ? '<div class="srv-journal">' + s.histo.slice().reverse().map(function (h) { return '<div><span class="mono">' + fdt(h.at) + '</span><span>' + esc(h.txt) + ' <em>· ' + esc(h.user) + '</em></span></div>'; }).join('') + '</div>' : '');
    var acts = [];
    if (s.type === 'Pilotage' && s.statut !== 'Annulé') acts.push({ label: 'Fiche de pilotage', icon: 'print', onClick: function (cl) { cl(); fiche(s.id); } });
    if (actif(s)) acts.push({ label: 'Annuler l\'ordre', cls: 'danger', icon: 'x', onClick: function (cl) { cl(); action(s.id, 'cancel'); } });
    if (s.statut === 'Demandé') acts.push({ label: 'Planifier / affecter', cls: 'primary', icon: 'calendar', onClick: function (cl) { cl(); action(s.id, 'plan'); } });
    if (s.statut === 'Planifié') { acts.push({ label: 'Replanifier', icon: 'calendar', onClick: function (cl) { cl(); action(s.id, 'plan'); } }); acts.push({ label: 'Démarrer', cls: 'primary', icon: 'arrow', onClick: function (cl) { cl(); action(s.id, 'start'); } }); }
    if (s.statut === 'En cours') acts.push({ label: 'Terminer', cls: 'primary', icon: 'check', onClick: function (cl) { cl(); action(s.id, 'end'); } });
    if (s.statut === 'Réalisé' && !s.prestation) acts.push({ label: 'Transmettre à la facturation', cls: 'primary', icon: 'invoice', onClick: function (cl) { transmettre(s); cl(); E.rerender(); } });
    if (!acts.length || acts.every(function (a) { return a.cls === 'danger'; })) acts.push({ label: 'Fermer' });
    U.modal({ title: 'Ordre de service ' + s.id, sub: esc(s.type) + ' · ' + esc(navire(s)) + ' · ' + badge(s.statut), body: body, actions: acts, onClose: deep ? clearDeep : null });
  }

  /* ------------------------------------------------------------------ actions */
  function action(id, k) {
    var s = S.get('services', id); if (!s) return;
    if (k === 'plan') return planForm(s);
    if (k === 'start') {
      if (s.type === 'Pilotage' && !s.pilote) { U.toast('Affectez un pilote avant de démarrer.', 'err'); return planForm(s); }
      if (s.type === 'Remorquage' && !(s.moyens || []).length) { U.toast('Affectez au moins un remorqueur.', 'err'); return planForm(s); }
      s.statut = 'En cours'; s.debut = nowISO(); addHisto(s, 'Démarré'); S.save(); E.log('Service démarré ' + s.id, s.type + ' · ' + navire(s), 'services'); U.toast(T_SHORT[s.type] + ' démarré — ' + navire(s)); return E.rerender();
    }
    if (k === 'end') {
      var fields = [{ name: 'fin', label: 'Heure de fin', type: 'datetime-local', required: true, full: true }];
      if (s.type === 'Avitaillement en eau') fields.push({ name: 'eauLivree', label: 'Quantité d\'eau livrée (m³)', type: 'number', step: '1', required: true, full: true });
      fields.push({ name: 'obs', label: 'Observations (conditions, incident…)', type: 'textarea', full: true });
      return U.formModal({ title: 'Terminer — ' + s.id, sub: esc(s.type) + ' · ' + esc(navire(s)), size: 'sm', okLabel: 'Terminer et facturer', fields: fields, values: { fin: nowISO(), eauLivree: s.eau, obs: s.obs },
        intro: '<p class="small muted" style="margin:0 0 12px">À la réalisation, la prestation est transmise automatiquement au module Finances (tarifs fictifs de démonstration).</p>',
        onSubmit: function (v) {
          if (ms(v.fin) < ms(s.debut || s.heure)) { U.toast('L\'heure de fin doit suivre le début (' + fh(s.debut || s.heure) + ').', 'err'); return false; }
          if (s.type === 'Avitaillement en eau' && !(+v.eauLivree > 0)) { U.toast('Quantité livrée invalide.', 'err'); return false; }
          s.fin = v.fin; if (!s.debut) s.debut = s.heure; if (v.eauLivree !== undefined) s.eauLivree = +v.eauLivree; s.obs = v.obs || ''; s.statut = 'Réalisé'; addHisto(s, 'Réalisé'); S.save();
          var L = transmettre(s, true);
          E.log('Service réalisé ' + s.id, s.type + ' · ' + navire(s), 'services');
          U.toast('Réalisé — ' + F.money(sum(L, function (l) { return l.qte * l.pu; })) + ' HT transmis à la facturation'); E.rerender();
        } });
    }
    if (k === 'cancel') return U.formModal({ title: 'Annuler l\'ordre ' + s.id, sub: esc(s.type) + ' · ' + esc(navire(s)), size: 'sm', okLabel: 'Annuler l\'ordre', fields: [{ name: 'motif', label: 'Motif', type: 'select', options: ['Report de l\'escale', 'Demande du consignataire', 'Conditions météo défavorables', 'Doublon', 'Autre'], required: true, full: true }], onSubmit: function (v) {
      s.statut = 'Annulé'; s.motif = v.motif; addHisto(s, 'Annulé : ' + v.motif); S.save(); E.log('Ordre de service annulé ' + s.id, v.motif, 'services'); U.toast('Ordre annulé'); E.rerender();
    } });
  }
  function moyenOpts(s) {
    var types = MOYEN_TYPES[s.type] || [];
    var list = S.all('flotte').filter(function (f) { return f.site === s.site && (types.indexOf(f.type) >= 0 || (s.type === 'Pilotage' && f.type === 'Remorqueur' && s.site === 'POG')); });
    return list.map(function (f) { return { v: f.id, l: f.nom + (INDISPO.indexOf(f.statut) >= 0 ? ' — ' + f.statut.toLowerCase() : '') }; });
  }
  function planForm(s) {
    var fields = [
      { name: 'heure', label: 'Horaire', type: 'datetime-local', required: true },
      { name: 'duree', label: 'Durée prévue (min)', type: 'number', step: '5', required: true }
    ];
    if (s.type === 'Pilotage') fields.push({ name: 'pilote', label: 'Pilote', type: 'select', options: pilotes(s.site).map(function (p) { return { v: p.id, l: p.nom }; }), empty: '— Choisir —', required: true, full: true });
    var mo = moyenOpts(s);
    if (mo.length) { fields.push({ name: 'm1', label: s.type === 'Remorquage' ? 'Remorqueur 1' : 'Moyen nautique', type: 'select', options: mo, empty: '— Aucun —', required: s.type === 'Remorquage' }); if (s.type === 'Remorquage') fields.push({ name: 'm2', label: 'Remorqueur 2 (optionnel)', type: 'select', options: mo, empty: '— Aucun —' }); }
    if (s.type === 'Avitaillement en eau') fields.push({ name: 'eau', label: 'Quantité demandée (m³)', type: 'number', step: '1', required: true });
    var m = U.formModal({ title: (s.statut === 'Demandé' ? 'Planifier ' : 'Replanifier ') + s.id, sub: esc(s.type) + (s.type !== 'Avitaillement en eau' ? ' — ' + esc(s.mouvement) : '') + ' · ' + esc(navire(s)), okLabel: 'Enregistrer le planning',
      intro: '<div id="sv-chk"></div>', fields: fields, values: { heure: s.heure, duree: s.duree || DUREE[s.type], pilote: s.pilote, m1: (s.moyens || [])[0] || '', m2: (s.moyens || [])[1] || '', eau: s.eau },
      onSubmit: function (v) {
        var moy = [v.m1, v.m2].filter(Boolean).filter(function (x, i, a) { return a.indexOf(x) === i; });
        var cand = { heure: v.heure, duree: +v.duree, type: s.type, pilote: v.pilote || '', moyens: moy };
        var chk = controleRessources(cand, s.id);
        if (chk.err.length) { U.toast(chk.err[0], 'err'); return false; }
        var was = s.statut;
        s.heure = v.heure; s.duree = +v.duree || DUREE[s.type]; if (s.type === 'Pilotage') s.pilote = v.pilote; s.moyens = moy; if (v.eau !== undefined) s.eau = +v.eau || 0;
        if (s.statut === 'Demandé') s.statut = 'Planifié';
        addHisto(s, (was === 'Demandé' ? 'Planifié' : 'Replanifié') + ' : ' + fdt(s.heure) + (s.pilote ? ' · ' + E.empName(s.pilote) : '') + (moy.length ? ' · ' + moy.map(moyNom).join(', ') : '')); S.save();
        E.log((was === 'Demandé' ? 'Ordre planifié ' : 'Ordre replanifié ') + s.id, T_SHORT[s.type] + ' · ' + navire(s) + ' · ' + fdt(s.heure), 'services');
        if (chk.warn.length) { E.notify('Conflit horaire — services maritimes', chk.warn[0], '#/services/' + s.id, 'red'); U.toast('Enregistré avec un conflit : ' + chk.warn[0], 'err'); }
        else U.toast('Planning enregistré — ' + fdt(s.heure));
        state.day = s.heure.slice(0, 10); E.rerender();
      } });
    var box = m.el.querySelector('#sv-chk'), f = m.el.querySelector('form');
    function live() {
      var v = {}; E.$$('input,select', f).forEach(function (i) { v[i.name] = i.value; });
      var c = controleRessources({ heure: v.heure, duree: +v.duree, type: s.type, pilote: v.pilote || '', moyens: [v.m1, v.m2].filter(Boolean) }, s.id);
      box.innerHTML = c.err.length ? '<div class="alert tone-red" style="margin-bottom:12px">' + E.icon('alert') + '<div>' + c.err.map(esc).join('<br>') + '</div></div>' : c.warn.length ? '<div class="alert tone-orange" style="margin-bottom:12px">' + E.icon('alert') + '<div>' + c.warn.map(esc).join('<br>') + '</div></div>' : '<div class="alert tone-green" style="margin-bottom:12px">' + E.icon('check') + '<div>Ressources disponibles sur ce créneau.</div></div>';
    }
    f.addEventListener('change', live); f.addEventListener('input', live); live();
  }
  function osForm(s, preset) {
    var esOpts = S.all('escales').filter(function (e) { return e.statut !== 'Appareillé' && e.statut !== 'Annulée' && (!state.site || e.site === state.site || e.id === preset.escale); }).sort(function (a, b) { return String(a.eta).localeCompare(String(b.eta)); }).map(function (e) { return { v: e.id, l: e.navire + ' · ' + posteCourt(e.poste) + ' · ' + e.statut + ' · ETA ' + fdt(e.eta) }; });
    if (!esOpts.length) { U.toast('Aucune escale active pour commander un service.', 'err'); return; }
    var e0 = esca(preset.escale);
    var defH = e0 ? (e0.ata ? (e0.etd > nowISO() ? e0.etd : nowISO()) : e0.eta) : dt(0, new Date().getHours() + 2);
    U.formModal({ title: 'Nouvel ordre de service', sub: 'Pilotage, remorquage, lamanage ou avitaillement en eau', okLabel: 'Créer l\'ordre',
      fields: [
        { name: 'escale', label: 'Escale', type: 'select', options: esOpts, required: true, full: true },
        { name: 'type', label: 'Service', type: 'select', options: TYPES, required: true },
        { name: 'mouvement', label: 'Mouvement', type: 'select', options: MOUV, required: true },
        { name: 'heure', label: 'Horaire demandé', type: 'datetime-local', required: true },
        { name: 'duree', label: 'Durée prévue (min)', type: 'number', step: '5' },
        { name: 'eau', label: 'Eau douce (m³) — avitaillement uniquement', type: 'number', step: '1' },
        { name: 'obs', label: 'Observations', type: 'textarea', full: true }
      ], values: { escale: preset.escale || esOpts[0].v, type: preset.type || 'Pilotage', mouvement: e0 && e0.ata ? 'Sortie' : 'Entrée', heure: defH, duree: '' },
      intro: '<p class="small muted" style="margin:0 0 12px">L\'ordre est créé au statut « Demandé » ; l\'affectation du pilote et des moyens se fait ensuite (planning).</p>',
      onSubmit: function (v) {
        var e = esca(v.escale);
        if (v.type === 'Avitaillement en eau' && !(+v.eau > 0)) { U.toast('Indiquez la quantité d\'eau demandée.', 'err'); return false; }
        var rec = { id: nextId(), escale: v.escale, site: e ? e.site : 'OWE', type: v.type, mouvement: v.mouvement, heure: v.heure, duree: +v.duree || DUREE[v.type], pilote: '', moyens: [], eau: v.type === 'Avitaillement en eau' ? +v.eau : 0, eauLivree: null, statut: 'Demandé', debut: '', fin: '', obs: v.obs || '', prestation: '', histo: [] };
        addHisto(rec, 'Ordre créé'); S.add('services', rec);
        E.log('Ordre de service créé ' + rec.id, rec.type + ' · ' + navire(rec) + ' · ' + fdt(rec.heure), 'services');
        E.notify(rec.type + ' demandé à ' + fh(rec.heure), navire(rec) + ' — ' + (e ? E.posteName(e.poste) : ''), '#/services/' + rec.id, 'violet');
        U.toast('Ordre ' + rec.id + ' créé'); state.day = rec.heure.slice(0, 10); E.rerender();
        setTimeout(function () { planForm(rec); }, 60);
      } });
  }

  /* ------------------------------------------------------------------ fiche de pilotage imprimable */
  function fiche(id) {
    var s = S.get('services', id), e = esca(s.escale) || {}, p = S.get('postes', e.poste) || {};
    var de = s.mouvement === 'Entrée' ? 'Zone d\'embarquement pilote (rade)' : p.nom || '—', vers = s.mouvement === 'Entrée' ? p.nom || '—' : s.mouvement === 'Sortie' ? 'Zone de débarquement pilote (rade)' : 'Poste à préciser';
    var rem = (s.moyens || []).map(moyNom).join(', ') || '—';
    var assoc = srvs().filter(function (o) { return o.escale === s.escale && o.type === 'Remorquage' && o.mouvement === s.mouvement && o.statut !== 'Annulé'; });
    if (assoc.length) rem = assoc.map(function (o) { return (o.moyens || []).map(moyNom).join(', '); }).filter(Boolean).join(', ') || rem;
    var line = function (l, v) { return '<tr><th>' + esc(l) + '</th><td>' + (v || '<span class="srv-fill"></span>') + '</td></tr>'; };
    var html = '<div class="doc__head"><div class="row" style="gap:12px"><img src="../assets/img/logo.png" alt="GPM"><div><b style="font-family:Sora,sans-serif;font-size:15px;color:var(--navy)">Gabon Port Management</b><div class="small muted">Services maritimes — ' + esc(E.siteName(s.site)) + '</div></div></div><div style="text-align:right"><h4>Fiche de pilotage</h4><div class="mono">' + esc(s.id) + '</div><div class="small muted">Édition du ' + F.date(E.today()) + '</div></div></div>' +
      '<table class="srv-ftab"><tbody>' +
      line('Navire', '<b>' + esc(e.navire || s.escale) + '</b> — IMO ' + esc(e.imo || '—') + ' — pavillon ' + esc(e.pavillon || '—')) +
      line('Type / dimensions', esc(e.type || '—') + ' — LOA ' + (e.loa || '—') + ' m — tirant d\'eau ' + (e.te != null ? F.num(e.te, 1) : '—') + ' m') +
      line('Escale / consignataire', esc(s.escale) + ' — ' + esc(e.consignataire || '—')) +
      line('Mouvement', '<b>' + esc(s.mouvement) + '</b> — de ' + esc(de) + ' vers ' + esc(vers)) +
      line('Horaire demandé', fdt(s.heure)) +
      line('Pilote', s.pilote ? esc(E.empName(s.pilote)) : '') +
      line('Remorqueurs', esc(rem)) +
      line('Embarquement du pilote', s.debut ? fh(s.debut) : '') +
      line('Débarquement du pilote', s.fin ? fh(s.fin) : '') +
      line('Vent / houle / visibilité', '') +
      line('Observations', esc(s.obs || '')) +
      '</tbody></table>' +
      '<div class="srv-sign"><div><span>Le commandant du navire</span><i></i></div><div><span>Le pilote</span><i></i></div></div>' +
      '<p class="small muted" style="margin-top:14px">Document de démonstration — modèle de fiche à adapter aux procédures de la capitainerie et de GPM.</p>';
    U.modal({ title: 'Fiche de pilotage ' + s.id, size: 'lg', body: '<div class="doc srv-doc">' + html + '</div>', actions: [{ label: 'Fermer' }, { label: 'Imprimer', cls: 'primary', icon: 'print', onClick: function () { document.body.classList.add('srv-print'); E.log('Fiche de pilotage imprimée ' + s.id, navire(s), 'services'); setTimeout(function () { window.print(); document.body.classList.remove('srv-print'); }, 30); } }] });
  }

  /* ------------------------------------------------------------------ enregistrement */
  E.register({
    id: 'services', label: 'Services maritimes', title: 'Services maritimes', icon: 'tug', group: 'Exploitation portuaire', roles: ['exploitation'],
    seed: seed,
    render: render,
    summary: function () {
      var td = srvs().filter(function (s) { return String(s.heure).slice(0, 10) === E.today() && s.statut !== 'Annulé'; });
      return [
        { label: 'Mouvements de navires aujourd\'hui', value: String(td.filter(function (s) { return s.type === 'Pilotage'; }).length), icon: 'tug', tone: 'blue', foot: td.filter(function (s) { return s.type === 'Pilotage' && (s.statut === 'Réalisé' || s.statut === 'Facturé'); }).length + ' réalisés · ' + conflitsListe().length + ' conflit(s)', href: '#/services/jour' },
        { label: 'Eau douce livrée aujourd\'hui', value: F.num(sum(td.filter(function (s) { return s.type === 'Avitaillement en eau' && s.eauLivree != null; }), 'eauLivree')), unit: 'm³', icon: 'drop', tone: 'green', foot: td.filter(function (s) { return s.type === 'Avitaillement en eau'; }).length + ' avitaillement(s) programmé(s)', href: '#/services/jour' }
      ];
    },
    pending: function () {
      var out = [], lim = E.addDays(E.today(), 1);
      srvs().filter(function (s) { return s.statut === 'Demandé' && String(s.heure).slice(0, 10) <= lim; }).forEach(function (s) { out.push({ title: T_SHORT[s.type] + ' à planifier · ' + navire(s), sub: s.id + ' · ' + (s.type !== 'Avitaillement en eau' ? s.mouvement + ' · ' : '') + fdt(s.heure), date: String(s.heure).slice(0, 10), href: '#/services/' + s.id, tone: 'orange' }); });
      conflitsListe().forEach(function (c) { out.push({ title: 'Conflit horaire · ' + c.nom, sub: c.a.id + ' et ' + c.b.id + ' · ' + fdt(c.a.heure), date: String(c.a.heure).slice(0, 10), href: '#/services/' + c.b.id, tone: 'red' }); });
      srvs().filter(function (s) { return s.statut === 'Réalisé' && !s.prestation; }).forEach(function (s) { out.push({ title: 'Prestation à transmettre · ' + T_SHORT[s.type] + ' ' + navire(s), sub: s.id + ' · réalisé le ' + fdt(s.fin), date: String(s.fin || s.heure).slice(0, 10), href: '#/services/' + s.id, tone: 'grey' }); });
      return out;
    },
    search: function (q) {
      return srvs().filter(function (s) { return E.norm(s.id + ' ' + navire(s) + ' ' + s.escale + ' ' + s.type).indexOf(q) >= 0; }).map(function (s) { return { title: s.id + ' · ' + s.type + ' — ' + navire(s), sub: fdt(s.heure) + ' · ' + s.statut, href: '#/services/' + s.id }; });
    },
    badge: function () { var lim = E.addDays(E.today(), 1); return srvs().filter(function (s) { return s.statut === 'Demandé' && String(s.heure).slice(0, 10) <= lim; }).length + conflitsListe().length; }
  });
})();
