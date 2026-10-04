/* GPM · Espace de gestion — module « Escales & plan de quai »
   Escales des navires (Owendo, Port-Gentil) : demandes reçues par le site, confirmation, contrôle tirant d'eau / poste
   et chevauchements, cycle Annoncée → Confirmée → En rade → À quai → En opérations → Appareillé, plan de quai (Gantt
   par poste), fiche escale (chronologie, services maritimes, conteneurs, génération des prestations à facturer),
   avis aux navigateurs publiés sur le site. Données de démonstration (navires fictifs). */
(function () {
  'use strict';
  var E = window.ERP; if (!E) return;
  var U = E.ui, F = E.fmt, S = E.store, esc = E.esc, sum = E.sum;
  var GD = window.GPM_DATA || null;

  /* ------------------------------------------------------------------ référentiels */
  var CYCLE = ['Annoncée', 'Confirmée', 'En rade', 'À quai', 'En opérations', 'Appareillé'];
  var TONE = { 'Annoncée': 'grey', 'Confirmée': 'blue', 'En rade': 'orange', 'À quai': 'violet', 'En opérations': 'navy', 'Appareillé': 'green', 'Annulée': 'red' };
  var COL = { 'Annoncée': '#94a3b8', 'Confirmée': '#2563eb', 'En rade': '#e8780c', 'À quai': '#7c3aed', 'En opérations': '#0b3a6e', 'Appareillé': '#1e9e4a', 'Annulée': '#d93636' };
  var ONQUAY = ['À quai', 'En opérations'];
  var TYPES = ['Porte-conteneurs', 'Porte-conteneurs feeder', 'Roulier (RoRo)', 'Navire conventionnel', 'Vraquier', 'Pétrolier', 'Pétrolier produits', 'Gazier', 'Ravitailleur offshore', 'Autre'];
  var NIVEAUX = ['Information', 'Prudence', 'Danger'];
  var NIV_TONE = { 'Information': 'blue', 'Prudence': 'orange', 'Danger': 'red' };
  /* Tarifs FICTIFS de démonstration utilisés pour préparer les prestations d'escale (à remplacer par le tarif officiel GPM). */
  var TARIFS = {
    sejourParMetreHeure: 450,     /* séjour à quai : FCFA par mètre de longueur hors tout et par heure */
    evp: 95000,                   /* manutention conteneurs : FCFA par EVP */
    vehicule: 28000,              /* manutention roulier : FCFA par véhicule */
    forfaits: { 'Vraquier': 6500000, 'Navire conventionnel': 4800000, 'Pétrolier': 3200000, 'Pétrolier produits': 3200000, 'Gazier': 3500000, 'Ravitailleur offshore': 1800000, 'Autre': 1500000 },
    gestion: 250000               /* frais d'escale et de gestion administrative : forfait */
  };

  E.addIcons({ berth: '<path d="M3 20h18M5 20v-5h14v5"/><path d="M7 15l1-5h8l1 5M10 10V6h4v4M12 6V3"/>' });

  /* ------------------------------------------------------------------ utilitaires */
  function pad(n) { return String(n).padStart(2, '0'); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function isoDT(d) { return E.iso(d) + 'T' + hm(d); }
  function nowISO() { return isoDT(new Date()); }
  function ms(s) { if (!s) return null; s = String(s); return new Date(s.length <= 10 ? s + 'T00:00' : s.slice(0, 16)).getTime(); }
  function dt(day, h, m) { var d = new Date(E.TODAY); d.setDate(d.getDate() + day); d.setHours(h || 0, m || 0, 0, 0); return isoDT(d); }
  function fdt(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + ' ' + s.slice(11, 16) : '—'; }
  function fdtL(s) { return s ? F.date(s.slice(0, 10)) + ' à ' + s.slice(11, 13) + 'h' + s.slice(14, 16) : '—'; }
  function dur(h) { if (h == null || isNaN(h)) return '—'; return h >= 48 ? F.num(h / 24, 1) + ' j' : Math.round(h) + ' h'; }
  function rel(s) { var d = (ms(s) - Date.now()) / 36e5; if (Math.abs(d) < 1) return d >= 0 ? 'dans moins d\'1 h' : 'il y a moins d\'1 h'; if (d > 0) return 'dans ' + (d >= 48 ? Math.round(d / 24) + ' j' : Math.round(d) + ' h'); return 'il y a ' + (-d >= 48 ? Math.round(-d / 24) + ' j' : Math.round(-d) + ' h'); }
  function dayLabel(d) { var j = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][d.getDay()]; return j + ' ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1); }
  function clientNom(id) { var c = S.get('clients', id); return c ? c.nom : id || '—'; }
  function poste(id) { return S.get('postes', id); }
  function posteCourt(id) { var p = poste(id); return p ? p.nom.replace('Owendo · ', '').replace('Port-Gentil · ', '') : id || '—'; }
  function siteCourt(id) { return id === 'POG' ? 'Port-Gentil' : id === 'OWE' ? 'Owendo' : id || '—'; }
  function user() { var u = E.session.user(); return u ? u.name : 'Système'; }
  function nextId() { var n = Math.max.apply(null, S.all('escales').map(function (x) { var m = String(x.id).match(/(\d+)$/); return m ? +m[1] : 0; }).concat([423])) + 1; return 'ESC-2026-' + String(n).padStart(4, '0'); }
  function addHisto(e, txt) { e.histo = e.histo || []; e.histo.push({ at: nowISO(), txt: txt, user: user() }); }
  function tone(st) { return TONE[st] || 'grey'; }
  function badge(st) { return U.badge(st, tone(st)); }

  /* ------------------------------------------------------------------ calculs */
  function escales() { return S.all('escales'); }
  function bySite(list) { return state.site ? list.filter(function (e) { return e.site === state.site; }) : list; }
  function startOf(e) { return ms(e.ata || e.eta); }
  function endOf(e) { if (e.atd) return ms(e.atd); var t = ms(e.etd); if (ONQUAY.indexOf(e.statut) >= 0 && t < Date.now()) return Date.now() + 36e5; return t; }
  function actives() { return escales().filter(function (e) { return e.statut !== 'Appareillé' && e.statut !== 'Annulée'; }); }
  function aQuai() { return escales().filter(function (e) { return ONQUAY.indexOf(e.statut) >= 0; }); }
  function enRade() { return escales().filter(function (e) { return e.statut === 'En rade'; }); }
  function attendus(h) { var lim = Date.now() + (h || 72) * 36e5; return escales().filter(function (e) { return (e.statut === 'Annoncée' || e.statut === 'Confirmée') && ms(e.eta) <= lim; }); }
  function historique() { return escales().filter(function (e) { return e.statut === 'Appareillé' || e.statut === 'Annulée'; }); }
  function sejour(e) { if (!e.ata) return null; var end = e.atd ? ms(e.atd) : Date.now(); return (end - ms(e.ata)) / 36e5; }
  function dureeMoyenne(site) { var l = escales().filter(function (e) { return e.statut === 'Appareillé' && e.ata && e.atd && (!site || e.site === site) && (Date.now() - ms(e.atd)) < 60 * 864e5; }); return { h: l.length ? sum(l, sejour) / l.length : null, n: l.length }; }
  function occupation(site, days) {
    var from = Date.now(), to = from + (days || 7) * 864e5, ps = S.all('postes').filter(function (p) { return !site || p.site === site; });
    var per = ps.map(function (p) {
      var occ = 0; actives().concat(escales().filter(function (e) { return e.statut === 'Appareillé'; })).forEach(function (e) {
        if (e.poste !== p.id) return; var a = Math.max(from, startOf(e)), b = Math.min(to, endOf(e)); if (b > a) occ += b - a;
      });
      return { p: p, pct: Math.min(100, occ / (to - from) * 100) };
    });
    return { per: per, pct: per.length ? sum(per, 'pct') / per.length : 0 };
  }
  /* Demandes reçues par le formulaire du site public (localStorage gpm_demandes_escale_site) */
  function demandes() { try { return GD && GD.demandesEscale ? GD.demandesEscale() : []; } catch (e) { return []; } }
  function traitees() { return S.all('demandesTraitees'); }
  function demandesOuvertes() { var ids = traitees().map(function (t) { return t.id; }); return demandes().filter(function (d) { return ids.indexOf(d.id) < 0; }); }
  function aConfirmer() { return escales().filter(function (e) { return e.statut === 'Annoncée'; }); }

  /* Contrôles : compatibilité tirant d'eau / poste, chevauchement sur un même poste */
  function controle(v, ignoreId) {
    var err = [], warn = [], p = poste(v.poste);
    if (!p) { err.push('Poste inconnu.'); return { err: err, warn: warn }; }
    if (+v.te > p.te) err.push('Tirant d\'eau du navire (' + F.num(+v.te, 1) + ' m) supérieur au tirant d\'eau admissible du ' + p.nom + ' (' + F.num(p.te, 1) + ' m).');
    var a = ms(v.ata || v.eta), b = ms(v.atd || v.etd);
    if (!(a < b)) err.push('La date de départ prévue doit être postérieure à l\'arrivée.');
    escales().forEach(function (o) {
      if (o.id === ignoreId || o.poste !== v.poste || o.statut === 'Annulée') return;
      if (o.statut === 'Appareillé' && ms(o.atd) <= a) return;
      if (a < endOf(o) && startOf(o) < b) err.push('Chevauchement au ' + p.nom + ' avec ' + o.navire + ' (' + o.id + ', ' + fdt(o.ata || o.eta) + ' → ' + fdt(o.atd || o.etd) + ').');
    });
    var tanker = /pétrolier|gazier/i.test(v.type || '');
    if (tanker && !/pétrolier|soutage/i.test(p.type)) warn.push('Navire-citerne sur un poste non dédié aux produits pétroliers.');
    if (!tanker && /Pétrolier et gazier/.test(p.type)) warn.push('Le poste 4 est réservé en priorité aux navires pétroliers et gaziers.');
    if (+v.loa > p.long + 45) warn.push('Longueur (' + v.loa + ' m) supérieure à celle du poste (' + p.long + ' m) : empiète sur le poste voisin.');
    return { err: err, warn: warn };
  }
  function showCheck(r) {
    if (r.err.length) { U.toast(r.err[0], 'err'); return false; }
    if (r.warn.length) setTimeout(function () { U.toast('Attention : ' + r.warn[0], 'warn'); }, 350);
    return true;
  }

  /* ------------------------------------------------------------------ données d'exemple */
  function seed() {
    var base = (GD && GD.escalesDefaut ? E.clone(GD.escalesDefaut) : []);
    /* Historique des escales des dernières semaines (démonstration) : sert à la durée moyenne d'escale et aux conteneurs en parc. */
    var H = [
      ['ESC-2026-0398', 'MV Atlantic Ntoum', '9700021', 'Libéria', 'Porte-conteneurs', 'C-01', 'Équateur Maritime Agency (démo)', 'OWE-P1', 184, 9.0, -24, 6, 40, 'Déchargement / chargement conteneurs', 1120],
      ['ESC-2026-0400', 'MV Gulf Navigator', '9700022', 'Malte', 'Porte-conteneurs', 'C-02', 'Gulf of Guinea Shipping (démo)', 'OWE-P2', 176, 8.9, -21, 13, 34, 'Déchargement / chargement conteneurs', 980],
      ['ESC-2026-0401', 'PSV Ogooué Supplier', '9700012', 'Gabon', 'Ravitailleur offshore', 'C-05', 'Offshore Supply Gabon (démo)', 'POG-P2', 70, 5.9, -20, 7, 12, 'Eau douce et soutage', 0],
      ['ESC-2026-0402', 'MV Ro-Ro Komo', '9700023', 'Panama', 'Roulier (RoRo)', 'C-04', 'Ro-Ro Africa Lines (démo)', 'OWE-P3', 190, 8.4, -17, 9, 30, 'Débarquement de 380 véhicules', 0],
      ['ESC-2026-0403', 'MV Cap Lopez Express', '9700010', 'Cameroun', 'Porte-conteneurs feeder', 'C-06', 'Cap Lopez Shipping (démo)', 'POG-P1', 132, 7.4, -15, 10, 26, 'Déchargement / chargement conteneurs', 390],
      ['ESC-2026-0404', 'MV Atlantic Akanda', '9700001', 'Libéria', 'Porte-conteneurs', 'C-01', 'Équateur Maritime Agency (démo)', 'OWE-P1', 186, 9.1, -14, 5, 38, 'Déchargement / chargement conteneurs', 1150],
      ['ESC-2026-0405', 'MT Ogooué Star', '9700004', 'Îles Marshall', 'Pétrolier produits', 'C-08', 'West Africa Tankers (démo)', 'OWE-P4', 145, 8.9, -12, 8, 22, 'Déchargement produits pétroliers', 0],
      ['ESC-2026-0406', 'MV Gulf Pioneer', '9700002', 'Malte', 'Porte-conteneurs', 'C-02', 'Gulf of Guinea Shipping (démo)', 'OWE-P2', 172, 8.8, -11, 15, 36, 'Déchargement / chargement conteneurs', 910],
      ['ESC-2026-0407', 'MV Atlantic Mondah', '9700006', 'Malte', 'Porte-conteneurs', 'C-01', 'Équateur Maritime Agency (démo)', 'OWE-P1', 182, 9.0, -8, 6, 42, 'Déchargement / chargement conteneurs', 1080],
      ['ESC-2026-0408', 'MT West Gentil', '9700011', 'Îles Marshall', 'Pétrolier', 'C-08', 'West Africa Tankers (démo)', 'POG-P3', 120, 7.2, -7, 9, 11, 'Soutage gasoil marin + eau douce', 0],
      ['ESC-2026-0410', 'MV Gulf Trader', '9700007', 'Portugal', 'Navire conventionnel', 'C-02', 'Gulf of Guinea Shipping (démo)', 'OWE-P3', 138, 7.8, -6, 8, 44, 'Marchandises diverses', 0],
      ['ESC-2026-0411', 'PSV Offshore Mandji', '9700009', 'Gabon', 'Ravitailleur offshore', 'C-05', 'Offshore Supply Gabon (démo)', 'POG-P2', 78, 6.2, -5, 14, 15, 'Chargement matériel offshore, eau douce', 0]
    ];
    H.forEach(function (r) {
      var ata = dt(r[10], r[11], 0), atdD = new Date(ms(ata) + r[12] * 36e5), eta = isoDT(new Date(ms(ata) - 90 * 6e4)), etd = isoDT(new Date(atdD.getTime() - 60 * 6e4));
      base.push({ id: r[0], navire: r[1], imo: r[2], pavillon: r[3], type: r[4], client: r[5], consignataire: r[6], site: r[7].slice(0, 3), poste: r[7], loa: r[8], te: r[9], eta: eta, etd: etd, ata: ata, atd: isoDT(atdD), statut: 'Appareillé', operations: r[13], evp: r[14], fait: 100 });
    });
    base.forEach(function (e) {
      if (ONQUAY.indexOf(e.statut) >= 0 && e.ata && !e.debutOps) e.debutOps = isoDT(new Date(ms(e.ata) + 75 * 6e4));
      if (e.statut === 'En rade' && !e.rade) e.rade = dt(0, 6, 40);
    });
    var avis = GD && GD.avisDefaut ? E.clone(GD.avisDefaut) : [];
    return {
      escales: base, avis: avis, demandesTraitees: [], avisArchives: [],
      avisBrouillons: [{ id: 'AVN-2026-032', date: E.today(), site: 'OWE', titre: 'Indisponibilité temporaire du poste 4', texte: 'Inspection des bras de déchargement du poste pétrolier et gazier : aucune escale ne sera programmée au poste 4 pendant la durée des contrôles. Les consignataires sont invités à se rapprocher du service exploitation.', niveau: 'Prudence', jusqu: E.addDays(E.today(), 9) }]
    };
  }

  /* ------------------------------------------------------------------ état de vue */
  var TABS = [
    { k: 'plan', l: 'Plan de quai' }, { k: 'quai', l: 'À quai & en rade' }, { k: 'attendus', l: 'Attendus' },
    { k: 'historique', l: 'Historique' }, { k: 'demandes', l: 'Demandes du site' }, { k: 'avis', l: 'Avis aux navigateurs' }
  ];
  var state = { tab: 'plan', site: '', days: 10, att: 72, hq: '' };

  function render(view, params) {
    var p0 = params[0];
    if (p0 && S.get('escales', p0)) return renderDetail(view, S.get('escales', p0));
    if (p0 && TABS.some(function (t) { return t.k === p0; })) state.tab = p0;
    else if (p0) { view.innerHTML = '<div class="card"><div class="empty">' + E.icon('alert') + '<div>Escale « ' + esc(p0) + ' » introuvable.</div><a class="btn" style="margin-top:12px" href="#/escales">Retour aux escales</a></div></div>'; return; }
    var tab = state.tab;
    var site = state.site, q = bySite(aQuai()), r = bySite(enRade()), att = bySite(attendus(72)), occ = occupation(site, 7), dm = dureeMoyenne(site);
    var occNow = S.all('postes').filter(function (p) { return (!site || p.site === site) && aQuai().some(function (e) { return e.poste === p.id; }); }).length;
    var nPostes = S.all('postes').filter(function (p) { return !site || p.site === site; }).length;
    var dem = demandesOuvertes().length;
    var head =
      '<div class="esc-head"><div class="chips" id="esc-site">' + [['', 'Tous les ports'], ['OWE', 'Owendo'], ['POG', 'Port-Gentil']].map(function (c) { return '<button class="chip' + (state.site === c[0] ? ' is-active' : '') + '" data-k="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div><span class="spacer"></span>' +
      '<button class="btn primary" id="esc-new">' + E.icon('plus') + 'Nouvelle escale</button></div>' +
      '<div class="grid g4 esc-kpis">' +
        U.kpi({ label: 'Navires à quai', value: q.length, icon: 'anchor', tone: 'violet', foot: r.length ? r.length + ' en rade en attente de poste' : 'aucun navire en rade' }) +
        U.kpi({ label: 'Attendus sous 72 h', value: att.length, icon: 'ship', tone: 'blue', foot: att.filter(function (e) { return e.statut === 'Annoncée'; }).length + ' encore à confirmer' }) +
        U.kpi({ label: 'Occupation postes', value: F.num(occ.pct), unit: '%', icon: 'berth', tone: occ.pct > 85 ? 'red' : occ.pct > 60 ? 'orange' : 'green', foot: occNow + ' / ' + nPostes + ' postes occupés en ce moment · 7 j' }) +
        U.kpi({ label: 'Durée moy. d\'escale', value: dm.h == null ? '—' : F.num(dm.h / 24, 1), unit: 'j', icon: 'clock', tone: dm.h != null && dm.h > 48 ? 'orange' : 'green', foot: dm.n + ' escales sur 60 j · repère ~1,5 j' }) +
      '</div>';
    var counts = { quai: q.length + r.length, attendus: bySite(escales().filter(function (e) { return e.statut === 'Annoncée' || e.statut === 'Confirmée'; })).length, demandes: dem || null, avis: S.all('avis').length };
    view.innerHTML = head + U.tabs(TABS.map(function (t) { return { k: t.k, l: t.l, n: counts[t.k] }; }), tab, function (k) { state.tab = k; E.go('escales/' + k); }) + '<div id="esc-body"></div>';
    view.querySelector('#esc-site').addEventListener('click', function (ev) { var b = ev.target.closest('.chip'); if (b) { state.site = b.dataset.k; E.rerender(); } });
    view.querySelector('#esc-new').onclick = function () { escaleForm(null, state.site ? { site: state.site } : {}); };
    var body = view.querySelector('#esc-body');
    ({ plan: vPlan, quai: vQuai, attendus: vAttendus, historique: vHisto, demandes: vDemandes, avis: vAvis })[tab](body);
    tabIntoView(view);
  }
  function tabIntoView(view) { var t = view.querySelector('.tabs .tab.is-active'), bar = t && t.parentNode; if (t && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = t.offsetLeft - 16; }

  /* ------------------------------------------------------------------ plan de quai (Gantt par poste, heures sur 7–10 jours) */
  function planHTML(site, days) {
    var from = new Date(E.TODAY); from.setDate(from.getDate() - 2); var f0 = from.getTime(), span = days * 864e5, t1 = f0 + span;
    var mobile = window.innerWidth <= 640, dayW = mobile ? 104 : 132, labW = mobile ? 112 : 190;
    var minW = labW + days * dayW, now = Date.now(), nowX = (now - f0) / span * 100;
    var x = function (t) { return Math.max(0, Math.min(100, (t - f0) / span * 100)); };
    var head = '<div class="esc-plan__head"><div class="esc-plan__lab">Poste</div><div class="esc-plan__days">';
    for (var i = 0; i < days; i++) {
      var d = new Date(f0 + i * 864e5), isT = E.iso(d) === E.today(), we = d.getDay() === 0 || d.getDay() === 6;
      head += '<div class="esc-plan__day' + (isT ? ' is-today' : '') + (we ? ' is-we' : '') + '" style="left:' + (i / days * 100) + '%;width:' + (100 / days) + '%"><b>' + (isT ? 'Aujourd\'hui' : dayLabel(d)) + '</b><span><i style="left:25%">6h</i><i style="left:50%">12h</i><i style="left:75%">18h</i></span></div>';
    }
    head += (nowX >= 0 && nowX <= 100 ? '<div class="esc-plan__now" style="left:' + nowX + '%"><em>' + hm(new Date()) + '</em></div>' : '') + '</div></div>';
    var grid = ''; for (var g = 0; g < days; g++) grid += '<div class="esc-plan__grid' + ([0, 6].indexOf(new Date(f0 + g * 864e5).getDay()) >= 0 ? ' we' : '') + '" style="left:' + (g / days * 100) + '%;width:' + (100 / days) + '%"></div>';
    var rows = '', sites = site ? [site] : ['OWE', 'POG'];
    sites.forEach(function (s) {
      var ps = S.all('postes').filter(function (p) { return p.site === s; });
      if (!site) rows += '<div class="esc-plan__group"><div class="esc-plan__lab">' + E.icon('pin') + esc(E.siteName(s)) + '</div><div></div></div>';
      ps.forEach(function (p) {
        var list = escales().filter(function (e) { return e.poste === p.id && e.statut !== 'Annulée' && startOf(e) < t1 && endOf(e) > f0; }).sort(function (a, b) { return startOf(a) - startOf(b); });
        var lanes = [], bars = '';
        list.forEach(function (e) {
          var a = startOf(e), b = endOf(e), lane = 0;
          while (lanes[lane] != null && lanes[lane] > a) lane++;
          lanes[lane] = b;
          var l = x(a), w = Math.max(0.8, x(b) - l), clash = lane > 0;
          var planned = !e.ata, lbl = esc(e.navire.replace(/^(MV|MT|PSV) /, ''));
          bars += '<a class="esc-bar' + (planned ? ' is-plan' : '') + (clash ? ' is-clash' : '') + '" href="#/escales/' + e.id + '" style="left:' + l + '%;width:' + w + '%;top:' + (8 + lane * 34) + 'px;--c:' + COL[e.statut] + '" title="' + esc(e.navire + ' · ' + e.statut + ' · ' + fdt(e.ata || e.eta) + ' → ' + fdt(e.atd || e.etd) + ' · TE ' + e.te + ' m' + (clash ? ' · CHEVAUCHEMENT' : '')) + '">' +
            (ONQUAY.indexOf(e.statut) >= 0 ? '<i style="width:' + (e.fait || 0) + '%"></i>' : '') + '<b>' + lbl + '</b><span>' + esc(e.statut) + (e.evp ? ' · ' + F.num(e.evp) + ' EVP' : '') + '</span></a>';
        });
        var h = Math.max(1, lanes.length) * 34 + 14;
        rows += '<div class="esc-plan__row"><div class="esc-plan__lab"><b>' + esc(posteCourt(p.id)) + '</b><span>' + esc(p.type) + ' · TE ' + F.num(p.te, 1) + ' m</span></div><div class="esc-plan__track" data-poste="' + p.id + '" style="height:' + h + 'px">' + grid + bars +
          (nowX >= 0 && nowX <= 100 ? '<div class="esc-plan__nowl" style="left:' + nowX + '%"></div>' : '') + '</div></div>';
      });
    });
    return '<div class="esc-plan" id="esc-plan" data-from="' + f0 + '" data-span="' + span + '"><div class="esc-plan__in" style="min-width:' + minW + 'px;--lab:' + labW + 'px">' + head + rows + '</div></div>';
  }
  function wirePlan(el) {
    var pl = el.querySelector('#esc-plan'); if (!pl) return;
    var f0 = +pl.dataset.from, span = +pl.dataset.span;
    E.$$('.esc-plan__track', pl).forEach(function (t) {
      t.addEventListener('click', function (ev) {
        if (ev.target.closest('.esc-bar')) return;
        var r = t.getBoundingClientRect(), when = f0 + (ev.clientX - r.left) / r.width * span;
        var d = new Date(when); d.setMinutes(0, 0, 0);
        if (d.getTime() < Date.now()) { U.toast('Choisissez un créneau futur pour programmer une escale.', 'err'); return; }
        var etd = new Date(d.getTime() + 36 * 36e5), p = poste(t.dataset.poste);
        escaleForm(null, { poste: p.id, site: p.site, eta: isoDT(d), etd: isoDT(etd) });
      });
    });
    var nowX = (Date.now() - f0) / span;
    setTimeout(function () { var lab = window.innerWidth <= 640 ? 112 : 190; pl.scrollLeft = Math.max(0, (pl.scrollWidth - lab) * nowX - (pl.clientWidth - lab) * 0.3); });
  }
  function vPlan(el) {
    var site = state.site, occ = occupation(site, 7);
    el.innerHTML =
      '<div class="card"><div class="card__h"><h3>Plan de quai</h3><span class="sub">Escales par poste · cliquez sur une escale pour l\'ouvrir, sur un espace libre pour programmer</span><span class="spacer"></span>' +
        '<div class="chips" id="esc-days">' + [7, 10].map(function (n) { return '<button class="chip' + (state.days === n ? ' is-active' : '') + '" data-k="' + n + '">' + n + ' jours</button>'; }).join('') + '</div></div>' +
        planHTML(site, state.days) +
        '<div class="card__b"><div class="legend">' + CYCLE.map(function (s) { return '<span><i style="background:' + COL[s] + '"></i>' + esc(s) + '</span>'; }).join('') + '<span><i class="esc-lg-plan"></i>Prévu (non arrivé)</span><span><i style="background:var(--red);width:2px"></i>Maintenant</span><span><i class="esc-lg-clash"></i>Chevauchement</span></div></div></div>' +
      '<div class="grid g-2-1" style="margin-top:16px">' +
        '<div class="card"><div class="card__h"><h3>Occupation des postes</h3><span class="sub">7 prochains jours · temps réservé par les escales</span></div><div class="card__b esc-occ">' +
          occ.per.map(function (o) { return '<div class="esc-occ__row"><div><b>' + esc(posteCourt(o.p.id)) + '</b><span>' + esc(siteCourt(o.p.site)) + ' · ' + esc(o.p.type) + '</span></div>' + U.progress(o.pct, o.pct > 85 ? 'red' : o.pct > 60 ? 'orange' : 'green') + '</div>'; }).join('') + '</div></div>' +
        '<div class="card"><div class="card__h"><h3>Mouvements à venir</h3><span class="sub">48 h</span></div>' + mouvementsList(site) + '</div>' +
      '</div>';
    el.querySelector('#esc-days').addEventListener('click', function (ev) { var b = ev.target.closest('.chip'); if (b) { state.days = +b.dataset.k; vPlan(el); } });
    wirePlan(el);
  }
  function mouvementsList(site) {
    var now = Date.now(), lim = now + 48 * 36e5, ev = [];
    bySite(actives()).forEach(function (e) {
      if (!e.ata && ms(e.eta) >= now - 6 * 36e5 && ms(e.eta) <= lim) ev.push({ t: ms(e.eta), s: e.eta, e: e, k: 'Arrivée', icon: 'anchor', tone: 'blue' });
      if (!e.atd && ms(e.etd) >= now - 6 * 36e5 && ms(e.etd) <= lim) ev.push({ t: ms(e.etd), s: e.etd, e: e, k: 'Départ', icon: 'ship', tone: 'green' });
    });
    ev.sort(function (a, b) { return a.t - b.t; });
    if (!ev.length) return '<div class="empty">Aucun mouvement prévu sous 48 h.</div>';
    return '<div class="list">' + ev.slice(0, 8).map(function (m) { var late = m.t < now; return '<a class="list__item" href="#/escales/' + m.e.id + '" style="color:inherit"><div class="list__icon tone-' + (late ? 'orange' : m.tone) + '">' + E.icon(m.icon) + '</div><div class="list__body"><b>' + m.k + ' · ' + esc(m.e.navire) + '</b><div class="small muted">' + fdt(m.s) + ' (' + rel(m.s) + ') · ' + esc(posteCourt(m.e.poste)) + '</div></div>' + badge(m.e.statut) + '</a>'; }).join('') + '</div>';
  }

  /* ------------------------------------------------------------------ À quai & en rade */
  function actBtns(e, small) {
    return actionsFor(e).map(function (a) { return '<button class="btn ' + (small ? 'sm ' : '') + (a.cls || '') + '" data-act="' + a.k + '" data-id="' + e.id + '">' + E.icon(a.icon) + esc(a.l) + '</button>'; }).join('');
  }
  function shipCard(e) {
    var p = poste(e.poste), late = !e.atd && ms(e.etd) < Date.now();
    return '<div class="esc-card" style="--c:' + COL[e.statut] + '"><a class="esc-card__top" href="#/escales/' + e.id + '"><div class="esc-ship">' + E.icon('ship') + '</div><div class="esc-card__t"><b>' + esc(e.navire) + '</b><span>' + esc(e.type) + ' · ' + esc(e.pavillon) + ' · <span class="mono">' + esc(e.id) + '</span></span></div>' + badge(e.statut) + '</a>' +
      '<div class="esc-card__meta"><div><span>Poste</span><b>' + esc(posteCourt(e.poste)) + '</b></div><div><span>' + (e.ata ? 'Accosté' : 'ETA') + '</span><b>' + fdt(e.ata || e.eta) + '</b></div><div><span>ETD</span><b class="' + (late ? 'esc-neg' : '') + '">' + fdt(e.etd) + '</b></div><div><span>Client</span><b>' + esc(clientNom(e.client).replace(' (démo)', '')) + '</b></div></div>' +
      '<div class="esc-card__ops"><span>' + esc(e.operations || '—') + '</span>' + (ONQUAY.indexOf(e.statut) >= 0 ? U.progress(e.fait || 0, (e.fait || 0) >= 100 ? 'green' : '') : '<span class="small muted">' + (p ? 'TE navire ' + F.num(e.te, 1) + ' m · poste ' + F.num(p.te, 1) + ' m' : '') + '</span>') + '</div>' +
      (late ? '<div class="esc-card__warn">' + E.icon('alert') + 'ETD dépassée — mettre à jour le départ prévu</div>' : '') +
      '<div class="esc-card__act">' + actBtns(e, true) + '</div></div>';
  }
  function vQuai(el) {
    var q = bySite(aQuai()).sort(function (a, b) { return ms(a.etd) - ms(b.etd); }), r = bySite(enRade()).sort(function (a, b) { return ms(a.eta) - ms(b.eta); });
    el.innerHTML =
      '<div class="section-title"><h2>À quai</h2><p>' + q.length + ' navire(s) aux postes</p></div>' +
      (q.length ? '<div class="esc-cards">' + q.map(shipCard).join('') + '</div>' : '<div class="card"><div class="empty">Aucun navire à quai.</div></div>') +
      '<div class="section-title" style="margin-top:22px"><h2>En rade</h2><p>' + r.length + ' navire(s) en attente d\'accostage</p></div>' +
      (r.length ? '<div class="esc-cards">' + r.map(shipCard).join('') + '</div>' : '<div class="card"><div class="empty">Aucun navire en rade.</div></div>');
    wireActs(el);
  }

  /* ------------------------------------------------------------------ Attendus */
  function vAttendus(el) {
    var lim = state.att ? Date.now() + state.att * 36e5 : Infinity;
    var list = bySite(escales().filter(function (e) { return (e.statut === 'Annoncée' || e.statut === 'Confirmée') && ms(e.eta) <= lim; })).sort(function (a, b) { return ms(a.eta) - ms(b.eta); });
    var cols = [
      { key: 'navire', label: 'Navire', render: function (e) { return '<b>' + esc(e.navire) + '</b><div class="small muted">' + esc(e.type) + ' · IMO ' + esc(e.imo) + '</div>'; }, csv: function (e) { return e.navire; } },
      { key: 'id', label: 'Escale', render: function (e) { return '<span class="mono">' + esc(e.id) + '</span>'; } },
      { key: 'eta', label: 'ETA', render: function (e) { return '<span class="nowrap">' + fdt(e.eta) + '</span><div class="small muted">' + rel(e.eta) + '</div>'; } },
      { key: 'etd', label: 'ETD', render: function (e) { return '<span class="nowrap">' + fdt(e.etd) + '</span>'; } },
      { key: 'poste', label: 'Poste', render: function (e) { return esc(posteCourt(e.poste)) + '<div class="small muted">' + siteCourt(e.site) + '</div>'; }, csv: function (e) { return E.posteName(e.poste); } },
      { key: 'te', label: 'LOA / TE', num: 1, render: function (e) { return e.loa + ' m · ' + F.num(e.te, 1) + ' m'; } },
      { key: 'client', label: 'Client', render: function (e) { return esc(clientNom(e.client)); }, csv: function (e) { return clientNom(e.client); } },
      { key: 'statut', label: 'Statut', render: function (e) { return badge(e.statut); } },
      { key: 'act', label: 'Action', render: function (e) { return '<div class="row esc-tact">' + actBtns(e, true) + '</div>'; }, csv: function () { return ''; } }
    ];
    el.innerHTML = '<div class="card"><div class="card__h"><h3>Navires attendus</h3><span class="sub">' + list.length + ' escale(s)</span><span class="spacer"></span><div class="chips" id="esc-att">' + [[72, '72 h'], [168, '7 jours'], [0, 'Toutes']].map(function (c) { return '<button class="chip' + (state.att === c[0] ? ' is-active' : '') + '" data-k="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div><button class="btn sm" id="esc-att-csv">' + E.icon('download') + 'CSV</button></div>' +
      U.table(cols, list, { onRow: function (e) { E.go('escales/' + e.id); }, empty: 'Aucun navire attendu sur la période' }) + '</div>';
    el.querySelector('#esc-att').addEventListener('click', function (ev) { var b = ev.target.closest('.chip'); if (b) { state.att = +b.dataset.k; vAttendus(el); } });
    el.querySelector('#esc-att-csv').onclick = function () { U.exportCSV('escales-attendues-' + E.today(), cols.slice(0, 8), list); };
    wireActs(el);
  }

  /* ------------------------------------------------------------------ Historique */
  function vHisto(el) {
    var q = E.norm(state.hq).trim();
    var list = bySite(historique()).filter(function (e) { return !q || E.norm(e.navire + ' ' + e.imo + ' ' + e.id + ' ' + clientNom(e.client)).indexOf(q) >= 0; }).sort(function (a, b) { return ms(b.atd || b.etd) - ms(a.atd || a.etd); });
    var cols = [
      { key: 'id', label: 'Escale', render: function (e) { return '<span class="mono">' + esc(e.id) + '</span>'; } },
      { key: 'navire', label: 'Navire', render: function (e) { return '<b>' + esc(e.navire) + '</b><div class="small muted">' + esc(e.type) + '</div>'; }, csv: function (e) { return e.navire; } },
      { key: 'poste', label: 'Poste', render: function (e) { return esc(posteCourt(e.poste)) + '<div class="small muted">' + siteCourt(e.site) + '</div>'; }, csv: function (e) { return E.posteName(e.poste); } },
      { key: 'ata', label: 'Accostage', render: function (e) { return fdt(e.ata); } },
      { key: 'atd', label: 'Appareillage', render: function (e) { return fdt(e.atd); } },
      { key: 'duree', label: 'Durée', num: 1, render: function (e) { return dur(sejour(e)); }, csv: function (e) { var s = sejour(e); return s == null ? '' : Math.round(s); } },
      { key: 'evp', label: 'EVP', num: 1, render: function (e) { return e.evp ? F.num(e.evp) : ''; } },
      { key: 'client', label: 'Client', render: function (e) { return esc(clientNom(e.client)); }, csv: function (e) { return clientNom(e.client); } },
      { key: 'fact', label: 'Facturation', render: function (e) { return e.statut === 'Annulée' ? badge('Annulée') : e.facture ? U.badge('Transmise', 'green') : U.badge('À préparer', 'orange'); }, csv: function (e) { return e.facture ? 'Transmise' : ''; } }
    ];
    var totEvp = sum(list, 'evp'), dm = list.filter(function (e) { return sejour(e) != null && e.statut === 'Appareillé'; });
    el.innerHTML = '<div class="card"><div class="card__h"><h3>Historique des escales</h3><span class="sub">' + list.length + ' escale(s) · ' + F.num(totEvp) + ' EVP · durée moyenne ' + dur(dm.length ? sum(dm, sejour) / dm.length : null) + '</span><span class="spacer"></span><input class="input esc-search" id="esc-hq" type="search" placeholder="Navire, IMO, n° d\'escale…" value="' + esc(state.hq) + '"><button class="btn sm" id="esc-h-csv">' + E.icon('download') + 'CSV</button></div>' +
      U.table(cols, list, { onRow: function (e) { E.go('escales/' + e.id); }, empty: 'Aucune escale terminée pour ce filtre' }) + '</div>';
    var inp = el.querySelector('#esc-hq');
    inp.addEventListener('input', function () { state.hq = inp.value; clearTimeout(vHisto.t); vHisto.t = setTimeout(function () { vHisto(el); var i2 = el.querySelector('#esc-hq'); i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); }, 250); });
    el.querySelector('#esc-h-csv').onclick = function () { U.exportCSV('historique-escales-' + E.today(), cols, list); };
  }

  /* ------------------------------------------------------------------ Demandes du site */
  var DEM_KEYS = { societe: 'Société', entreprise: 'Société', armateur: 'Armateur', consignataire: 'Consignataire', nom: 'Contact', contact: 'Contact', email: 'E-mail', tel: 'Téléphone', telephone: 'Téléphone', navire: 'Navire', imo: 'IMO', type: 'Type de navire', typeNavire: 'Type de navire', port: 'Port', site: 'Port', eta: 'Arrivée souhaitée', dateArrivee: 'Arrivée souhaitée', etd: 'Départ prévu', loa: 'Longueur (LOA)', longueur: 'Longueur (LOA)', te: 'Tirant d\'eau', tirant: 'Tirant d\'eau', operations: 'Opérations', marchandise: 'Marchandise', evp: 'EVP', volume: 'Volume', pavillon: 'Pavillon', message: 'Message', services: 'Services demandés' };
  var DEM_HIDE = ['id', 'date', 'statut', 'source', 'site'];
  function demField(d, keys) { for (var i = 0; i < keys.length; i++) if (d[keys[i]] != null && d[keys[i]] !== '') return d[keys[i]]; return ''; }
  function demSite(d) { if (d.site === 'OWE' || d.site === 'POG') return d.site; var p = String(demField(d, ['port', 'site'])).toLowerCase(); return p.indexOf('gentil') >= 0 || p === 'pog' ? 'POG' : 'OWE'; }
  function demDate(v) { if (!v) return ''; v = String(v); return v.length === 10 ? v + 'T08:00' : v.slice(0, 16); }
  function vDemandes(el) {
    var open = demandesOuvertes().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }), done = traitees().slice().sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    var cards = open.map(function (d) {
      var kv = Object.keys(d).filter(function (k) { return DEM_HIDE.indexOf(k) < 0 && d[k] !== '' && d[k] != null && (typeof d[k] !== 'object' || Array.isArray(d[k])) && !(Array.isArray(d[k]) && !d[k].length); }).map(function (k) { var v = Array.isArray(d[k]) ? d[k].join(', ') : /^(eta|etd|dateArrivee)$/.test(k) && String(d[k]).length >= 16 ? fdtL(String(d[k]).slice(0, 16)) : d[k]; return '<dt>' + esc(DEM_KEYS[k] || k) + '</dt><dd>' + esc(v) + '</dd>'; }).join('');
      return '<div class="card esc-dem"><div class="card__h"><div class="list__icon tone-blue">' + E.icon('inbox') + '</div><div><h3>' + esc(demField(d, ['navire']) || 'Navire non précisé') + '</h3><span class="sub">' + esc(demField(d, ['consignataire', 'societe', 'entreprise', 'armateur', 'contact', 'nom'])) + ' · reçue ' + (d.date ? F.ago(d.date) : '') + ' · <span class="mono">' + esc(d.id) + '</span></span></div><span class="spacer"></span>' + U.badge('À traiter', 'orange') + '</div>' +
        '<div class="card__b"><dl class="kv">' + kv + '</dl></div><div class="esc-dem__f"><button class="btn danger" data-ref="' + esc(d.id) + '">' + E.icon('x') + 'Refuser</button><button class="btn success" data-acc="' + esc(d.id) + '">' + E.icon('check') + 'Accepter et programmer</button></div></div>';
    }).join('');
    el.innerHTML =
      '<div class="alert tone-blue" style="margin-bottom:16px">' + E.icon('globe') + '<div>Les demandes d\'escale envoyées par le formulaire du site public arrivent ici. <b>Accepter</b> crée l\'escale au statut « Confirmée » sur le poste choisi (contrôle du tirant d\'eau et des chevauchements) ; <b>Refuser</b> enregistre le motif.</div></div>' +
      (open.length ? '<div class="esc-dems">' + cards + '</div>' : '<div class="card"><div class="empty">' + E.icon('check') + '<div><b>Aucune demande en attente.</b></div><div class="small" style="margin:6px 0 14px">Les nouvelles demandes du site s\'afficheront ici.</div><button class="btn" id="esc-sim">' + E.icon('send') + 'Simuler une demande reçue du site</button></div></div>') +
      '<div class="card" style="margin-top:16px"><div class="card__h"><h3>Demandes traitées</h3><span class="sub">' + done.length + '</span></div>' +
      U.table([
        { key: 'id', label: 'Demande', render: function (t) { return '<span class="mono">' + esc(t.id) + '</span>'; } },
        { key: 'navire', label: 'Navire', render: function (t) { return '<b>' + esc(t.navire || '—') + '</b><div class="small muted">' + esc(t.demandeur || '') + '</div>'; } },
        { key: 'decision', label: 'Décision', render: function (t) { return U.badge(t.decision, t.decision === 'Acceptée' ? 'green' : 'red'); } },
        { key: 'escale', label: 'Escale / motif', render: function (t) { return t.escale ? '<a href="#/escales/' + esc(t.escale) + '" class="mono">' + esc(t.escale) + '</a>' : esc(t.motif || ''); } },
        { key: 'at', label: 'Traitée le', render: function (t) { return F.datetime(t.at); } },
        { key: 'user', label: 'Par' }
      ], done, { empty: 'Aucune demande traitée pour le moment' }) + '</div>';
    E.$$('[data-acc]', el).forEach(function (b) { b.onclick = function () { accepter(b.dataset.acc); }; });
    E.$$('[data-ref]', el).forEach(function (b) { b.onclick = function () { refuser(b.dataset.ref); }; });
    var sim = el.querySelector('#esc-sim'); if (sim) sim.onclick = function () {
      if (!GD || !GD.demanderEscale) { U.toast('Données du site indisponibles.', 'err'); return; }
      GD.demanderEscale({ navire: 'MV Atlantic Lambaréné', imo: '9700031', pavillon: 'Libéria', type: 'Porte-conteneurs', loa: 178, te: 9.2, site: 'OWE', port: 'Owendo (Libreville)', eta: dt(6, 6), etd: dt(7, 18), operations: 'Déchargement / chargement conteneurs', volume: '860 EVP', services: ['pilotage', 'remorquage', 'amarrage', 'manutention'], consignataire: 'Équateur Maritime Agency (démo)', contact: 'Mireille Ondo', email: 'operations@ema-demo.ga', telephone: '+241 07 45 12 88', message: 'Merci de confirmer le poste et le pilotage d\'entrée.', statut: 'Nouvelle', source: 'site' });
      E.log('Demande d\'escale simulée (site public)', 'MV Atlantic Lambaréné', 'escales'); U.toast('Demande d\'escale reçue du site (simulation)'); E.renderBadges(); vDemandes(el);
    };
  }
  function accepter(id) {
    var d = demandes().find(function (x) { return x.id === id; }); if (!d) return;
    var site = demSite(d), cli = S.all('clients').find(function (c) { return E.norm(c.nom).indexOf(E.norm(String(demField(d, ['societe', 'entreprise', 'armateur', 'consignataire'])).replace(' (démo)', '')).slice(0, 12)) >= 0; });
    var t = String(demField(d, ['type', 'typeNavire']));
    var v = { navire: demField(d, ['navire']), imo: demField(d, ['imo']), type: TYPES.indexOf(t) >= 0 ? t : 'Autre', client: cli ? cli.id : '', consignataire: demField(d, ['consignataire', 'societe', 'entreprise']), site: site, loa: +demField(d, ['loa', 'longueur']) || '', te: +String(demField(d, ['te', 'tirant'])).replace(',', '.') || '', eta: demDate(demField(d, ['eta', 'dateArrivee'])) || dt(3, 8), etd: demDate(demField(d, ['etd'])) || '', operations: demField(d, ['operations', 'marchandise']) + (d.volume && !/evp/i.test(String(d.volume)) ? ' (' + d.volume + ')' : ''), evp: +demField(d, ['evp']) || (/evp|conteneur/i.test(String(d.volume || '')) ? parseInt(String(d.volume).replace(/\s/g, ''), 10) || 0 : 0), pavillon: demField(d, ['pavillon']) };
    if (!v.etd) v.etd = isoDT(new Date(ms(v.eta) + 36 * 36e5));
    v.poste = proposerPoste(v);
    escaleForm(null, v, { title: 'Accepter la demande ' + id, ok: 'Accepter et confirmer', statut: 'Confirmée', onDone: function (e) {
      S.add('demandesTraitees', { id: id, navire: e.navire, demandeur: demField(d, ['consignataire', 'societe', 'entreprise', 'contact', 'nom']), decision: 'Acceptée', escale: e.id, at: new Date().toISOString(), user: user() });
      E.notify('Demande d\'escale acceptée', e.navire + ' — ' + E.posteName(e.poste) + ' · ETA ' + fdt(e.eta), '#/escales/' + e.id, 'green');
      E.log('Demande d\'escale acceptée ' + id, e.navire + ' → ' + e.id, 'escales');
    } });
  }
  function refuser(id) {
    var d = demandes().find(function (x) { return x.id === id; }); if (!d) return;
    U.formModal({ title: 'Refuser la demande ' + id, sub: esc(demField(d, ['navire']) || '') + ' · ' + esc(demField(d, ['consignataire', 'societe', 'entreprise', 'contact', 'nom'])), size: 'sm', okLabel: 'Refuser la demande',
      fields: [{ name: 'motif', label: 'Motif communiqué au demandeur', type: 'select', options: ['Aucun poste compatible disponible à la date demandée', 'Tirant d\'eau incompatible avec les postes', 'Informations incomplètes — merci de renouveler la demande', 'Demande en doublon', 'Autre motif'], required: true, full: true },
        { name: 'detail', label: 'Précisions', type: 'textarea', full: true }],
      onSubmit: function (v) {
        S.add('demandesTraitees', { id: id, navire: demField(d, ['navire']), demandeur: demField(d, ['consignataire', 'societe', 'entreprise', 'contact', 'nom']), decision: 'Refusée', motif: v.motif + (v.detail ? ' — ' + v.detail : ''), at: new Date().toISOString(), user: user() });
        E.log('Demande d\'escale refusée ' + id, v.motif, 'escales'); U.toast('Demande refusée — motif enregistré'); E.rerender();
      } });
  }
  function proposerPoste(v) {
    var ps = S.all('postes').filter(function (p) { return p.site === v.site && (!v.te || +v.te <= p.te); });
    var tanker = /pétrolier|gazier/i.test(v.type || '');
    ps.sort(function (a, b) { var sa = /pétrolier|soutage/i.test(a.type) === tanker ? 0 : 1, sb = /pétrolier|soutage/i.test(b.type) === tanker ? 0 : 1; return sa - sb; });
    var free = ps.find(function (p) { return !controle(Object.assign({}, v, { poste: p.id })).err.length; });
    return (free || ps[0] || S.all('postes')[0]).id;
  }

  /* ------------------------------------------------------------------ Avis aux navigateurs */
  function nextAvis() { var all = S.all('avis').concat(S.all('avisBrouillons'), S.all('avisArchives')); var n = Math.max.apply(null, all.map(function (a) { var m = String(a.id).match(/(\d+)$/); return m ? +m[1] : 0; }).concat([30])) + 1; return 'AVN-2026-' + String(n).padStart(3, '0'); }
  function avisCard(a, kind) {
    var exp = a.jusqu && a.jusqu < E.today();
    return '<div class="esc-avis' + (exp ? ' is-exp' : '') + '" style="--c:var(--' + ({ blue: 'blue', orange: 'orange', red: 'red' })[NIV_TONE[a.niveau] || 'blue'] + ')"><div class="esc-avis__h">' + U.badge(a.niveau || 'Information', NIV_TONE[a.niveau] || 'blue') + '<span class="small muted">' + esc(siteCourt(a.site)) + ' · <span class="mono">' + esc(a.id) + '</span></span>' + (exp ? U.badge('Échu', 'grey') : '') + '</div>' +
      '<b>' + esc(a.titre) + '</b><p>' + esc(a.texte) + '</p><div class="small muted">Du ' + F.date(a.date) + (a.jusqu ? ' au ' + F.date(a.jusqu) : '') + '</div><div class="esc-avis__f">' +
      (kind === 'pub' ? '<button class="btn sm" data-av="edit" data-id="' + a.id + '" data-c="avis">' + E.icon('edit') + 'Modifier</button><button class="btn sm danger" data-av="retirer" data-id="' + a.id + '">' + E.icon('x') + 'Retirer du site</button>' :
        kind === 'draft' ? '<button class="btn sm" data-av="edit" data-id="' + a.id + '" data-c="avisBrouillons">' + E.icon('edit') + 'Modifier</button><button class="btn sm ghost" data-av="suppr" data-id="' + a.id + '">' + E.icon('trash') + 'Supprimer</button><button class="btn sm success" data-av="publier" data-id="' + a.id + '">' + E.icon('globe') + 'Publier</button>' :
        '<button class="btn sm" data-av="republier" data-id="' + a.id + '">' + E.icon('refresh') + 'Republier</button>') + '</div></div>';
  }
  function vAvis(el) {
    var pub = bySite(S.all('avis')).slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }), dr = bySite(S.all('avisBrouillons')), ar = bySite(S.all('avisArchives'));
    el.innerHTML =
      '<div class="esc-head" style="margin-bottom:14px"><div class="alert tone-green" style="flex:1;min-width:240px;margin:0">' + E.icon('globe') + '<div>Les avis <b>publiés</b> apparaissent immédiatement sur le site public (rubrique « Avis aux navigateurs »). Les brouillons et les avis retirés restent internes.</div></div><button class="btn primary" id="av-new">' + E.icon('plus') + 'Nouvel avis</button></div>' +
      '<div class="section-title"><h2>Publiés sur le site</h2><p>' + pub.length + '</p></div>' +
      (pub.length ? '<div class="esc-avis-grid">' + pub.map(function (a) { return avisCard(a, 'pub'); }).join('') + '</div>' : '<div class="card"><div class="empty">Aucun avis publié.</div></div>') +
      '<div class="section-title" style="margin-top:20px"><h2>Brouillons</h2><p>' + dr.length + '</p></div>' +
      (dr.length ? '<div class="esc-avis-grid">' + dr.map(function (a) { return avisCard(a, 'draft'); }).join('') + '</div>' : '<div class="card"><div class="empty">Aucun brouillon.</div></div>') +
      (ar.length ? '<div class="section-title" style="margin-top:20px"><h2>Retirés du site</h2><p>' + ar.length + '</p></div><div class="esc-avis-grid">' + ar.map(function (a) { return avisCard(a, 'arch'); }).join('') + '</div>' : '');
    el.querySelector('#av-new').onclick = function () { avisForm(null); };
    E.$$('[data-av]', el).forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.id, k = b.dataset.av;
        if (k === 'edit') return avisForm(S.get(b.dataset.c, id), b.dataset.c);
        if (k === 'retirer') return U.confirm('Retirer l\'avis du site', 'L\'avis <b>' + esc(S.get('avis', id).titre) + '</b> ne sera plus visible sur le site public.', 'Retirer', function () { moveAvis(id, 'avis', 'avisArchives'); E.log('Avis retiré du site ' + id, '', 'escales'); U.toast('Avis retiré du site'); vAvis(el); }, 'danger');
        if (k === 'publier' || k === 'republier') { var from = k === 'publier' ? 'avisBrouillons' : 'avisArchives'; var a = moveAvis(id, from, 'avis'); a.date = E.today(); S.save(); E.log('Avis publié ' + id, a.titre, 'escales'); E.notify('Avis aux navigateurs publié', a.titre, '#/escales/avis', 'green'); U.toast('Avis publié sur le site'); return vAvis(el); }
        if (k === 'suppr') return U.confirm('Supprimer le brouillon', 'Ce brouillon sera supprimé.', 'Supprimer', function () { S.remove('avisBrouillons', id); U.toast('Brouillon supprimé'); vAvis(el); }, 'danger');
      };
    });
  }
  function moveAvis(id, from, to) { var a = S.get(from, id); S.remove(from, id); S.all(to).unshift(a); S.save(); return a; }
  function avisForm(a, col) {
    var isNew = !a;
    U.formModal({ title: isNew ? 'Nouvel avis aux navigateurs' : 'Modifier l\'avis ' + a.id, sub: isNew ? 'Information nautique destinée aux capitaines, pilotes et consignataires' : (col === 'avis' ? 'Avis publié — la modification est visible immédiatement sur le site' : 'Brouillon'), okLabel: isNew ? 'Enregistrer' : 'Enregistrer les modifications',
      fields: [
        { name: 'titre', label: 'Titre', required: true, full: true },
        { name: 'site', label: 'Port', type: 'select', options: [{ v: 'OWE', l: 'Owendo' }, { v: 'POG', l: 'Port-Gentil' }], required: true },
        { name: 'niveau', label: 'Niveau', type: 'select', options: NIVEAUX, required: true },
        { name: 'date', label: 'En vigueur à partir du', type: 'date', required: true },
        { name: 'jusqu', label: 'Jusqu\'au', type: 'date' },
        { name: 'texte', label: 'Texte de l\'avis', type: 'textarea', required: true, full: true }
      ].concat(isNew ? [{ name: 'pub', label: 'Publication', type: 'select', options: [{ v: 'oui', l: 'Publier immédiatement sur le site' }, { v: 'non', l: 'Enregistrer comme brouillon' }], full: true }] : []),
      values: a || { site: state.site || 'OWE', niveau: 'Information', date: E.today(), jusqu: E.addDays(E.today(), 7), pub: 'oui' },
      onSubmit: function (v) {
        if (v.jusqu && v.jusqu < v.date) { U.toast('La date de fin doit suivre la date de début.', 'err'); return false; }
        var rec = { titre: v.titre, site: v.site, niveau: v.niveau, date: v.date, jusqu: v.jusqu, texte: v.texte };
        if (isNew) { rec.id = nextAvis(); S.add(v.pub === 'oui' ? 'avis' : 'avisBrouillons', rec); E.log((v.pub === 'oui' ? 'Avis publié ' : 'Brouillon d\'avis créé ') + rec.id, rec.titre, 'escales'); if (v.pub === 'oui') E.notify('Avis aux navigateurs publié', rec.titre, '#/escales/avis', 'green'); U.toast(v.pub === 'oui' ? 'Avis publié sur le site' : 'Brouillon enregistré'); }
        else { S.update(col, a.id, rec); E.log('Avis modifié ' + a.id, rec.titre, 'escales'); U.toast('Avis mis à jour'); }
        state.tab = 'avis'; E.rerender();
      } });
  }

  /* ------------------------------------------------------------------ formulaire escale */
  function posteOpts() { return S.all('postes').map(function (p) { return { v: p.id, l: p.nom + ' — TE ' + F.num(p.te, 1) + ' m' }; }); }
  function escaleForm(e, preset, opt) {
    opt = opt || {}; var isNew = !e;
    var vals = e ? E.clone(e) : Object.assign({ type: 'Porte-conteneurs', pavillon: '', evp: 0, eta: dt(2, 8), etd: dt(3, 18), poste: (preset && preset.site === 'POG') ? 'POG-P1' : 'OWE-P1' }, preset || {});
    var m = U.formModal({ title: opt.title || (isNew ? 'Nouvelle escale' : 'Modifier l\'escale ' + e.id), sub: isNew ? 'Contrôles automatiques : tirant d\'eau admissible du poste et chevauchement des escales' : esc(e.navire) + ' · ' + esc(e.statut), size: 'lg', okLabel: opt.ok || (isNew ? 'Créer l\'escale' : 'Enregistrer'),
      intro: '<div id="esc-chk" class="esc-chk"></div>',
      fields: [
        { name: 'navire', label: 'Nom du navire', required: true, placeholder: 'MV …' },
        { name: 'imo', label: 'N° IMO', placeholder: '7 chiffres' },
        { name: 'type', label: 'Type de navire', type: 'select', options: TYPES, required: true },
        { name: 'pavillon', label: 'Pavillon' },
        { name: 'client', label: 'Client (armateur)', type: 'select', options: E.options('clients'), empty: '— Choisir —', required: true },
        { name: 'consignataire', label: 'Consignataire' },
        { name: 'loa', label: 'Longueur hors tout (m)', type: 'number', step: '1', required: true },
        { name: 'te', label: 'Tirant d\'eau (m)', type: 'number', step: '0.1', required: true },
        { name: 'poste', label: 'Poste à quai', type: 'select', options: posteOpts(), required: true, full: true },
        { name: 'eta', label: 'Arrivée prévue (ETA)', type: 'datetime-local', required: true },
        { name: 'etd', label: 'Départ prévu (ETD)', type: 'datetime-local', required: true },
        { name: 'operations', label: 'Opérations prévues', full: true, placeholder: 'Déchargement / chargement conteneurs…' },
        { name: 'evp', label: 'Conteneurs prévus (EVP)', type: 'number', step: '1' }
      ], values: vals,
      onSubmit: function (v) {
        if (v.imo && !/^\d{7}$/.test(String(v.imo))) { U.toast('Le numéro IMO comporte 7 chiffres.', 'err'); return false; }
        var p = poste(v.poste); v.site = p.site; v.evp = +v.evp || 0;
        var chk = controle(Object.assign({}, v, e ? { ata: e.ata, atd: e.atd } : {}), e ? e.id : null);
        if (!showCheck(chk)) return false;
        if (isNew) {
          var rec = Object.assign({ id: nextId(), ata: '', atd: '', statut: opt.statut || 'Annoncée', fait: 0 }, v);
          addHisto(rec, (opt.statut === 'Confirmée' ? 'Escale créée depuis une demande du site et confirmée' : 'Escale créée') + ' — ' + E.posteName(rec.poste));
          S.add('escales', rec);
          E.log('Escale créée ' + rec.id, rec.navire + ' · ' + E.posteName(rec.poste) + ' · ETA ' + fdt(rec.eta), 'escales');
          if (opt.onDone) opt.onDone(rec);
          U.toast('Escale ' + rec.id + ' créée — ' + rec.navire);
          setTimeout(function () { E.go('escales/' + rec.id); });
        } else {
          var changes = []; ['poste', 'eta', 'etd', 'te'].forEach(function (k) { if (String(e[k]) !== String(v[k])) changes.push(k.toUpperCase() + ' ' + (k === 'poste' ? posteCourt(v[k]) : k === 'te' ? v[k] + ' m' : fdt(v[k]))); });
          Object.assign(e, v); addHisto(e, 'Escale modifiée' + (changes.length ? ' : ' + changes.join(', ') : '')); S.save();
          E.log('Escale modifiée ' + e.id, e.navire + (changes.length ? ' · ' + changes.join(', ') : ''), 'escales');
          U.toast('Escale mise à jour'); E.rerender();
        }
      } });
    /* contrôle en direct dans la modale */
    var box = m.el.querySelector('#esc-chk');
    function live() {
      var f = m.el.querySelector('form'), v = {};
      E.$$('input,select', f).forEach(function (i) { v[i.name] = i.value; });
      var p = poste(v.poste); if (!p) return;
      var c = controle(Object.assign({}, v, e ? { ata: e.ata, atd: e.atd } : {}), e ? e.id : null);
      box.innerHTML = c.err.length ? '<div class="alert tone-red">' + E.icon('alert') + '<div>' + c.err.map(esc).join('<br>') + '</div></div>' : c.warn.length ? '<div class="alert tone-orange">' + E.icon('info') + '<div>' + c.warn.map(esc).join('<br>') + '</div></div>' : (v.te ? '<div class="alert tone-green">' + E.icon('check') + '<div>Poste compatible : TE navire ' + F.num(+v.te, 1) + ' m ≤ TE admissible ' + F.num(p.te, 1) + ' m · aucun chevauchement.</div></div>' : '');
    }
    m.el.querySelector('form').addEventListener('input', live); m.el.querySelector('form').addEventListener('change', live); live();
  }

  /* ------------------------------------------------------------------ actions du cycle */
  function actionsFor(e) {
    var a = [];
    if (e.statut === 'Annoncée') a.push({ k: 'confirm', l: 'Confirmer', icon: 'check', cls: 'primary' });
    if (e.statut === 'Confirmée') { a.push({ k: 'rade', l: 'Arrivée en rade', icon: 'anchor' }); a.push({ k: 'berth', l: 'Accoster', icon: 'berth', cls: 'primary' }); }
    if (e.statut === 'En rade') a.push({ k: 'berth', l: 'Accoster', icon: 'berth', cls: 'primary' });
    if (e.statut === 'À quai') a.push({ k: 'ops', l: 'Démarrer les opérations', icon: 'crane', cls: 'primary' });
    if (e.statut === 'En opérations') { a.push({ k: 'progress', l: 'Avancement', icon: 'gauge' }); a.push({ k: 'depart', l: 'Appareiller', icon: 'ship', cls: 'primary' }); }
    return a;
  }
  function wireActs(el) { E.$$('[data-act]', el).forEach(function (b) { b.onclick = function (ev) { ev.preventDefault(); ev.stopPropagation(); doAction(b.dataset.id, b.dataset.act); }; }); }
  function setStatut(e, st, txt, patch) {
    Object.assign(e, patch || {}); e.statut = st; addHisto(e, txt); S.save();
    E.log(txt + ' — ' + e.id, e.navire, 'escales');
  }
  function doAction(id, k) {
    var e = S.get('escales', id); if (!e) return;
    if (k === 'confirm') return U.confirm('Confirmer l\'escale ' + e.id, '<b>' + esc(e.navire) + '</b> au <b>' + esc(E.posteName(e.poste)) + '</b>, ETA ' + fdtL(e.eta) + '.<br><span class="small muted">Le consignataire est informé et l\'escale devient visible comme confirmée sur le site.</span>', 'Confirmer', function () {
      var c = controle(e, e.id); if (!showCheck(c)) return;
      setStatut(e, 'Confirmée', 'Escale confirmée'); E.notify('Escale confirmée', e.navire + ' — ' + E.posteName(e.poste), '#/escales/' + e.id, 'blue'); U.toast('Escale confirmée'); E.rerender();
    });
    if (k === 'rade') return U.formModal({ title: 'Arrivée en rade', sub: esc(e.navire), size: 'sm', okLabel: 'Enregistrer', fields: [{ name: 'rade', label: 'Heure d\'arrivée en rade', type: 'datetime-local', required: true, full: true }], values: { rade: nowISO() }, onSubmit: function (v) { setStatut(e, 'En rade', 'Arrivée en rade (' + fdt(v.rade) + ')', { rade: v.rade }); U.toast(e.navire + ' en rade'); E.rerender(); } });
    if (k === 'berth') return U.formModal({ title: 'Accostage — ' + e.navire, sub: 'Heure réelle d\'arrivée à quai (ATA)', size: 'sm', okLabel: 'Accoster', fields: [{ name: 'poste', label: 'Poste', type: 'select', options: posteOpts().filter(function (o) { return o.v.slice(0, 3) === e.site; }), required: true, full: true }, { name: 'ata', label: 'Heure d\'accostage (ATA)', type: 'datetime-local', required: true, full: true }], values: { poste: e.poste, ata: nowISO() }, onSubmit: function (v) {
      var occ = aQuai().find(function (o) { return o.poste === v.poste && o.id !== e.id; });
      if (occ) { U.toast('Le ' + E.posteName(v.poste) + ' est occupé par ' + occ.navire + '.', 'err'); return false; }
      var p = poste(v.poste); if (+e.te > p.te) { U.toast('Tirant d\'eau incompatible avec le ' + p.nom + '.', 'err'); return false; }
      setStatut(e, 'À quai', 'Accostage au ' + E.posteName(v.poste), { poste: v.poste, ata: v.ata });
      E.notify('Navire à quai', e.navire + ' — ' + E.posteName(v.poste), '#/escales/' + e.id, 'violet'); U.toast(e.navire + ' à quai'); E.rerender();
    } });
    if (k === 'ops') { setStatut(e, 'En opérations', 'Début des opérations commerciales', { debutOps: nowISO() }); U.toast('Opérations démarrées'); return E.rerender(); }
    if (k === 'progress') return U.formModal({ title: 'Avancement des opérations', sub: esc(e.navire) + ' · ' + esc(e.operations || ''), size: 'sm', okLabel: 'Mettre à jour', fields: [{ name: 'fait', label: 'Avancement (%)', type: 'number', step: '1', min: 0, required: true, full: true }, { name: 'etd', label: 'Départ prévu (ETD) actualisé', type: 'datetime-local', required: true, full: true }], values: { fait: e.fait || 0, etd: e.etd }, onSubmit: function (v) {
      var f = Math.max(0, Math.min(100, Math.round(+v.fait))); if (isNaN(f)) { U.toast('Valeur invalide', 'err'); return false; }
      var old = e.fait; e.fait = f; var chg = v.etd !== e.etd; e.etd = v.etd; addHisto(e, 'Avancement ' + old + ' % → ' + f + ' %' + (chg ? ' · ETD ' + fdt(v.etd) : '')); S.save();
      E.log('Avancement escale ' + e.id, f + ' %', 'escales'); U.toast('Avancement : ' + f + ' %'); E.rerender();
    } });
    if (k === 'depart') return U.formModal({ title: 'Appareillage — ' + e.navire, sub: 'Heure réelle de départ (ATD)', size: 'sm', okLabel: 'Appareiller', fields: [{ name: 'atd', label: 'Heure d\'appareillage (ATD)', type: 'datetime-local', required: true, full: true }], values: { atd: nowISO() }, onSubmit: function (v) {
      if (ms(v.atd) < ms(e.ata)) { U.toast('L\'appareillage doit suivre l\'accostage.', 'err'); return false; }
      setStatut(e, 'Appareillé', 'Appareillage — poste libéré', { atd: v.atd, fait: 100 });
      E.notify('Navire appareillé', e.navire + ' — ' + E.posteName(e.poste) + ' libéré · prestations à facturer', '#/escales/' + e.id, 'green'); U.toast(e.navire + ' a appareillé — poste libéré'); E.rerender();
    } });
    if (k === 'edit') return escaleForm(e);
    if (k === 'cancel') return U.formModal({ title: 'Annuler l\'escale ' + e.id, sub: esc(e.navire), size: 'sm', okLabel: 'Annuler l\'escale', fields: [{ name: 'motif', label: 'Motif', type: 'textarea', required: true, full: true }], onSubmit: function (v) { setStatut(e, 'Annulée', 'Escale annulée : ' + v.motif); U.toast('Escale annulée'); E.rerender(); } });
    if (k === 'facture') return factureModal(e);
  }

  /* ------------------------------------------------------------------ fiche détail */
  function lignesFacture(e) {
    var L = [], h = Math.max(1, Math.ceil(sejour(e) || (ms(e.etd) - ms(e.eta)) / 36e5));
    L.push({ libelle: 'Séjour à quai — ' + E.posteName(e.poste) + ' (LOA ' + e.loa + ' m)', qte: h, unite: 'heure', pu: Math.round(e.loa * TARIFS.sejourParMetreHeure) });
    var veh = String(e.operations || '').match(/(\d[\d\s]*)\s*véhicules/);
    if (e.evp > 0) L.push({ libelle: 'Manutention conteneurs', qte: e.evp, unite: 'EVP', pu: TARIFS.evp });
    else if (veh) L.push({ libelle: 'Manutention roulier — véhicules', qte: +veh[1].replace(/\s/g, ''), unite: 'véhicule', pu: TARIFS.vehicule });
    else L.push({ libelle: 'Opérations portuaires — ' + (e.operations || e.type), qte: 1, unite: 'forfait', pu: TARIFS.forfaits[e.type] || TARIFS.forfaits.Autre });
    L.push({ libelle: 'Frais d\'escale et de gestion administrative', qte: 1, unite: 'forfait', pu: TARIFS.gestion });
    return L;
  }
  function factureModal(e) {
    var L = lignesFacture(e), tot = sum(L, function (l) { return l.qte * l.pu; });
    U.modal({ title: 'Générer la facture — ' + e.navire, sub: e.id + ' · ' + esc(clientNom(e.client)), size: 'lg',
      body: (e.statut !== 'Appareillé' ? '<div class="alert tone-orange" style="margin-bottom:12px">' + E.icon('info') + '<div>Le navire n\'a pas encore appareillé : la durée de séjour est calculée jusqu\'à maintenant (facturation provisoire).</div></div>' : '') +
        U.table([{ key: 'libelle', label: 'Prestation' }, { key: 'qte', label: 'Qté', num: 1, render: function (l) { return F.num(l.qte) + ' ' + esc(l.unite); } }, { key: 'pu', label: 'Prix unitaire', num: 1, render: function (l) { return F.money(l.pu); } }, { key: 'tot', label: 'Montant HT', num: 1, render: function (l) { return '<b>' + F.money(l.qte * l.pu) + '</b>'; } }], L, { footer: function () { return '<td colspan="3">Total HT</td><td class="num">' + F.money(tot) + '</td>'; } }) +
        '<p class="small muted" style="margin:12px 0 0">Tarifs fictifs de démonstration. Les lignes sont transmises au module Finances (prestations « À facturer »), qui établit la facture client. Les services maritimes et le magasinage sont transmis séparément par leurs modules.</p>',
      actions: [{ label: 'Annuler' }, { label: 'Transmettre à la facturation', cls: 'primary', icon: 'invoice', onClick: function (c) {
        L.forEach(function (l) { S.add('prestations', { id: S.next('PRS'), escale: e.id, client: e.client, date: E.today(), libelle: l.libelle, qte: l.qte, unite: l.unite, pu: l.pu, statut: 'À facturer', source: 'escales', site: e.site }); });
        e.facture = { date: new Date().toISOString(), lignes: L.length, total: tot }; addHisto(e, 'Prestations d\'escale transmises à la facturation (' + F.money(tot) + ' HT)'); S.save();
        E.log('Prestations d\'escale générées ' + e.id, L.length + ' lignes · ' + F.money(tot), 'escales');
        E.notify('Prestations à facturer', e.navire + ' — ' + F.money(tot) + ' HT', '#/escales/' + e.id, 'orange');
        c(); U.toast(L.length + ' prestations transmises à la facturation'); E.rerender();
      } }] });
  }
  function chrono(e) {
    var items = [
      { t: e.eta, l: 'Arrivée prévue (ETA)', done: !!(e.rade || e.ata), sub: fdtL(e.eta) },
      { t: e.rade, l: 'Arrivée en rade', done: !!e.rade, sub: e.rade ? fdtL(e.rade) : 'en attente', hide: !e.rade && e.statut !== 'Confirmée' && e.statut !== 'Annoncée' },
      { t: e.ata, l: 'Accostage (ATA)', done: !!e.ata, sub: e.ata ? fdtL(e.ata) + ' · ' + posteCourt(e.poste) : 'à venir' },
      { t: e.debutOps, l: 'Début des opérations', done: !!e.debutOps, sub: e.debutOps ? fdtL(e.debutOps) : 'à venir' },
      { t: e.atd || e.etd, l: e.atd ? 'Appareillage (ATD)' : 'Départ prévu (ETD)', done: !!e.atd, sub: fdtL(e.atd || e.etd) + (e.atd && e.ata ? ' · séjour ' + dur(sejour(e)) : '') }
    ].filter(function (i) { return !i.hide; });
    var cur = items.findIndex(function (i) { return !i.done; });
    var html = '<div class="timeline">' + items.map(function (i, k) { return '<div class="tl-item ' + (i.done ? 'done' : k === cur && e.statut !== 'Annulée' ? 'current' : '') + '"><b>' + esc(i.l) + '</b><span>' + esc(i.sub) + '</span></div>'; }).join('') + '</div>';
    var h = (e.histo || []).slice().reverse();
    if (h.length) html += '<div class="esc-journal"><div class="small muted" style="font-weight:600;margin:4px 0 6px">Journal de l\'escale</div>' + h.map(function (x) { return '<div><span class="mono">' + fdt(x.at) + '</span><span>' + esc(x.txt) + '<em> · ' + esc(x.user) + '</em></span></div>'; }).join('') + '</div>';
    return html;
  }
  function renderDetail(view, e) {
    var p = poste(e.poste), idx = CYCLE.indexOf(e.statut), cancelled = e.statut === 'Annulée';
    var srv = S.has('services') ? S.all('services').filter(function (s) { return s.escale === e.id; }).sort(function (a, b) { return String(a.heure).localeCompare(String(b.heure)); }) : null;
    var ctn = S.has('conteneurs') ? S.all('conteneurs').filter(function (c) { return c.escale === e.id; }) : null;
    var prs = S.all('prestations').filter(function (x) { return x.escale === e.id; });
    var extra = [];
    if (['Annoncée', 'Confirmée', 'En rade'].indexOf(e.statut) >= 0 || ONQUAY.indexOf(e.statut) >= 0) extra.push('<button class="btn" data-act="edit" data-id="' + e.id + '">' + E.icon('edit') + 'Modifier</button>');
    if (['Annoncée', 'Confirmée'].indexOf(e.statut) >= 0) extra.push('<button class="btn danger" data-act="cancel" data-id="' + e.id + '">' + E.icon('x') + 'Annuler</button>');
    var canFact = ['À quai', 'En opérations', 'Appareillé'].indexOf(e.statut) >= 0 && !e.facture;
    var c = (ctn || []), cSur = c.filter(function (x) { return x.statut === 'Sur parc'; }).length, cEmb = c.filter(function (x) { return x.statut === 'À embarquer'; }).length, cOut = c.filter(function (x) { return x.statut === 'Sorti'; }).length;
    view.innerHTML =
      '<div class="esc-dhead"><a class="btn ghost sm" href="#/escales/' + (ONQUAY.indexOf(e.statut) >= 0 || e.statut === 'En rade' ? 'quai' : e.statut === 'Appareillé' || cancelled ? 'historique' : 'attendus') + '">' + E.icon('back') + 'Escales</a></div>' +
      '<div class="card esc-hero" style="--c:' + COL[e.statut] + '"><div class="esc-hero__top"><div class="esc-ship lg">' + E.icon('ship') + '</div><div class="esc-hero__t"><div class="small muted"><span class="mono">' + esc(e.id) + '</span> · ' + esc(E.siteName(e.site)) + '</div><h2>' + esc(e.navire) + '</h2><div class="row" style="gap:6px;margin-top:6px">' + badge(e.statut) + '<span class="badge tone-grey plain">' + esc(e.type) + '</span><span class="badge tone-grey plain">Pavillon ' + esc(e.pavillon || '—') + '</span><span class="badge tone-grey plain">IMO ' + esc(e.imo || '—') + '</span></div></div>' +
        '<div class="esc-hero__act">' + actBtns(e) + extra.join('') + '</div></div>' +
        (cancelled ? '' : '<div class="esc-hero__steps">' + U.steps(CYCLE, idx, { finished: e.statut === 'Appareillé' }) + '</div>') + '</div>' +
      '<div class="grid g-2-1" style="margin-top:16px"><div class="stack">' +
        '<div class="card"><div class="card__h"><h3>Informations</h3></div><div class="card__b"><dl class="kv">' +
          '<dt>Client (armateur)</dt><dd>' + esc(clientNom(e.client)) + '</dd><dt>Consignataire</dt><dd>' + esc(e.consignataire || '—') + '</dd>' +
          '<dt>Poste</dt><dd><b>' + esc(E.posteName(e.poste)) + '</b>' + (p ? '<div class="small muted">' + esc(p.type) + ' · ' + p.long + ' m · TE admissible ' + F.num(p.te, 1) + ' m</div>' : '') + '</dd>' +
          '<dt>Dimensions</dt><dd>LOA ' + e.loa + ' m · tirant d\'eau ' + F.num(e.te, 1) + ' m ' + (p ? (+e.te <= p.te ? U.badge('compatible', 'green') : U.badge('incompatible', 'red')) : '') + '</dd>' +
          '<dt>Fenêtre prévue</dt><dd>' + fdtL(e.eta) + ' → ' + fdtL(e.etd) + '</dd>' +
          '<dt>Opérations</dt><dd>' + esc(e.operations || '—') + (e.evp ? ' · <b>' + F.num(e.evp) + ' EVP</b>' : '') + '</dd></dl></div></div>' +
        '<div class="card"><div class="card__h"><h3>Avancement des opérations</h3><span class="spacer"></span>' + (e.statut === 'En opérations' ? '<button class="btn sm" data-act="progress" data-id="' + e.id + '">' + E.icon('gauge') + 'Mettre à jour</button>' : '') + '</div><div class="card__b"><div class="esc-big"><b>' + (e.fait || 0) + ' %</b><span>' + esc(e.operations || '') + '</span></div>' + U.progress(e.fait || 0, (e.fait || 0) >= 100 ? 'green' : '') +
          (e.evp ? '<div class="esc-mini"><div><span>EVP prévus</span><b>' + F.num(e.evp) + '</b></div><div><span>EVP traités</span><b>' + F.num(Math.round(e.evp * (e.fait || 0) / 100)) + '</b></div><div><span>Reste</span><b>' + F.num(e.evp - Math.round(e.evp * (e.fait || 0) / 100)) + '</b></div></div>' : '') + '</div></div>' +
        '<div class="card"><div class="card__h"><h3>Services maritimes</h3><span class="sub">pilotage, remorquage, lamanage, eau</span><span class="spacer"></span>' + (srv && !cancelled && e.statut !== 'Appareillé' ? '<a class="btn sm" href="#/services/nouveau/' + e.id + '">' + E.icon('plus') + 'Commander</a>' : '') + '</div>' +
          (srv == null ? '<div class="empty">Module Services maritimes non disponible.</div>' : srv.length ? '<div class="list">' + srv.map(function (s) { return '<a class="list__item" href="#/services/' + s.id + '" style="color:inherit"><div class="list__icon tone-blue">' + E.icon(s.type === 'Avitaillement en eau' ? 'drop' : s.type === 'Remorquage' ? 'tug' : s.type === 'Pilotage' ? 'compass' : 'anchor') + '</div><div class="list__body"><b>' + esc(s.type) + (s.mouvement && s.type !== 'Avitaillement en eau' ? ' — ' + esc(s.mouvement) : '') + '</b><div class="small muted">' + fdt(s.heure) + ' · <span class="mono">' + esc(s.id) + '</span>' + (s.eau ? ' · ' + F.num(s.eau) + ' m³' : '') + '</div></div>' + U.badge(s.statut) + '</a>'; }).join('') + '</div>' : '<div class="empty">Aucun ordre de service pour cette escale.</div>') + '</div>' +
      '</div><div class="stack">' +
        '<div class="card"><div class="card__h"><h3>Chronologie</h3></div><div class="card__b">' + chrono(e) + '</div></div>' +
        '<div class="card"><div class="card__h"><h3>Conteneurs</h3><span class="spacer"></span>' + (ctn && ctn.length ? '<a class="btn sm ghost" href="#/terminal/escale/' + e.id + '">Voir au terminal</a>' : '') + '</div><div class="card__b">' +
          (ctn == null ? '<div class="small muted">Module Terminal non disponible.</div>' : ctn.length ? '<div class="esc-mini"><div><span>Sur parc</span><b>' + cSur + '</b></div><div><span>À embarquer</span><b>' + cEmb + '</b></div><div><span>Sortis</span><b>' + cOut + '</b></div></div><div class="small muted" style="margin-top:8px">' + ctn.length + ' conteneur(s) suivis · ' + F.num(sum(ctn, function (x) { return x.taille === 40 ? 2 : 1; })) + ' EVP</div>' : '<div class="small muted">Aucun conteneur rattaché à cette escale dans le parc.</div>') + '</div></div>' +
        '<div class="card"><div class="card__h"><h3>Facturation</h3></div><div class="card__b">' +
          (prs.length ? '<div class="esc-prs">' + prs.map(function (x) { return '<div><span>' + esc(x.libelle) + '<em>' + esc(x.source || '') + '</em></span><b>' + F.money(x.qte * x.pu) + '</b></div>'; }).join('') + '<div class="esc-prs__t"><span>Total des prestations</span><b>' + F.money(sum(prs, function (x) { return x.qte * x.pu; })) + '</b></div></div>' : '<div class="small muted">Aucune prestation transmise pour l\'instant.</div>') +
          (canFact ? '<button class="btn accent" style="margin-top:12px;width:100%" data-act="facture" data-id="' + e.id + '">' + E.icon('invoice') + 'Générer la facture</button>' : e.facture ? '<div class="alert tone-green" style="margin-top:12px">' + E.icon('check') + '<div>Prestations d\'escale transmises le ' + F.datetime(e.facture.date) + ' (' + F.money(e.facture.total) + ' HT).</div></div>' : '<div class="small muted" style="margin-top:10px">La facture pourra être générée dès l\'accostage du navire.</div>') +
        '</div></div>' +
      '</div></div>';
    wireActs(view);
  }

  /* ------------------------------------------------------------------ enregistrement */
  E.register({
    id: 'escales', label: 'Escales & plan de quai', title: 'Escales & plan de quai', icon: 'anchor', group: 'Exploitation portuaire', roles: ['exploitation', 'commercial'],
    seed: seed,
    render: render,
    summary: function () {
      var q = aQuai(), a = attendus(72), occ = occupation('', 7);
      return [
        { label: 'Navires à quai', value: String(q.length), icon: 'anchor', tone: 'violet', foot: enRade().length + ' en rade · occupation des postes ' + F.pct(occ.pct), href: '#/escales/quai' },
        { label: 'Attendus sous 72 h', value: String(a.length), icon: 'ship', tone: 'blue', foot: aConfirmer().length + ' escale(s) à confirmer · ' + demandesOuvertes().length + ' demande(s) du site', href: '#/escales/attendus' }
      ];
    },
    pending: function () {
      var out = [];
      demandesOuvertes().forEach(function (d) { out.push({ title: 'Demande d\'escale du site · ' + (demField(d, ['navire']) || d.id), sub: demField(d, ['consignataire', 'societe', 'entreprise', 'contact', 'nom']) + (demField(d, ['eta', 'dateArrivee']) ? ' · arrivée ' + fdt(demDate(demField(d, ['eta', 'dateArrivee']))) : ''), date: String(d.date || '').slice(0, 10), href: '#/escales/demandes', tone: 'blue' }); });
      aConfirmer().forEach(function (e) { out.push({ title: 'Escale à confirmer · ' + e.navire, sub: e.id + ' · ' + E.posteName(e.poste) + ' · ETA ' + fdt(e.eta), date: e.eta.slice(0, 10), href: '#/escales/' + e.id, tone: ms(e.eta) - Date.now() < 72 * 36e5 ? 'orange' : 'grey' }); });
      return out;
    },
    search: function (q) {
      var r = [];
      escales().forEach(function (e) { if (E.norm(e.id + ' ' + e.navire + ' ' + e.imo + ' ' + e.consignataire).indexOf(q) >= 0) r.push({ title: e.navire + ' · ' + e.id, sub: e.statut + ' · ' + E.posteName(e.poste) + ' · IMO ' + e.imo, href: '#/escales/' + e.id }); });
      S.all('avis').forEach(function (a) { if (E.norm(a.id + ' ' + a.titre).indexOf(q) >= 0) r.push({ title: 'Avis ' + a.id + ' · ' + a.titre, sub: siteCourt(a.site) + ' · ' + a.niveau, href: '#/escales/avis' }); });
      return r;
    },
    badge: function () { return demandesOuvertes().length + aConfirmer().length; }
  });
})();
