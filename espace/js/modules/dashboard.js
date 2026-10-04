/* GPM · Espace de gestion — Tableau de bord portuaire (Pilotage).
   Navires à quai et attendus, EVP traités, chiffre d'affaires facturé, cadence des grues, trafic mensuel,
   répartition du CA par activité, Owendo / Port-Gentil, situation du jour, validations, activité récente.
   Robuste : chaque bloc fonctionne même si un module ou une collection est absent (valeurs de simulation). */
(function () {
  'use strict';
  var E = window.ERP; if (!E) return;
  var S = E.store, U = E.ui, F = E.fmt, esc = E.esc, ic = E.icon;

  /* Trafic mensuel de l'année — valeurs de SIMULATION (démonstration), coupées au mois courant. */
  var SIM = {
    evp: [9120, 8460, 9780, 9350, 10120, 10480, 9860, 10940, 11230, 10850, 11400, 11900],
    escales: [41, 38, 44, 42, 46, 47, 45, 49, 51, 48, 50, 53],
    pog: [0.24, 0.23, 0.25, 0.26, 0.24, 0.25, 0.27, 0.26, 0.25, 0.26, 0.25, 0.26], /* part des escales à Port-Gentil */
    caMois: 1480000000, /* CA HT simulé d'un mois complet (si aucune facture) */
    cadence: [26.4, 27.1, 25.8, 28.2, 27.6, 26.9, 28.4, 27.8, 28.9, 28.1, 28.5, 28.8]
  };
  var ACTS = [
    { k: 'Manutention', c: '#06284f', sim: 0.52 }, { k: 'Services maritimes', c: '#3a75c4', sim: 0.18 }, { k: 'Soutage & eau', c: '#009e60', sim: 0.14 },
    { k: 'Magasinage', c: '#f2b705', sim: 0.07 }, { k: 'Redevances', c: '#e8780c', sim: 0.09 }
  ];

  /* Profil de chaque espace : part du trafic et du CA simulés, répartition par activité.
     Port-Gentil est bien plus petit qu'Owendo et tourné vers l'offshore pétrolier, le soutage et l'eau douce. */
  var PROFIL = {
    OWE: { evp: 0.83, ca: 0.71, acts: { 'Manutention': 0.64, 'Services maritimes': 0.17, 'Soutage & eau': 0, 'Magasinage': 0.09, 'Redevances': 0.10 } },
    POG: { evp: 0.17, ca: 0.29, acts: { 'Manutention': 0.22, 'Services maritimes': 0.21, 'Soutage & eau': 0.43, 'Magasinage': 0.04, 'Redevances': 0.10 } }
  };
  function sc() { return E.scope(); }
  function escPart(i) { var s = sc(); return s === 'POG' ? SIM.pog[i] : s === 'OWE' ? 1 - SIM.pog[i] : 1; }
  function evpK() { var s = sc(); return s ? PROFIL[s].evp : 1; }
  function caK() { var s = sc(); return s ? PROFIL[s].ca : 1; }
  function actShare(a) { var s = sc(); return s ? PROFIL[s].acts[a.k] || 0 : a.sim; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function greeting() { var hr = new Date().getHours(); return hr < 12 ? 'Bonjour' : hr < 18 ? 'Bon après-midi' : 'Bonsoir'; }
  function today() { return E.today(); }
  function safe(fn, def) { try { var v = fn(); return v == null ? def : v; } catch (e) { console.warn(e); return def; } }
  function escales() { if (S.has('escales') && S.all('escales').length) return S.all('escales'); return (window.GPM_DATA && window.GPM_DATA.escalesDefaut) || []; }
  function day(s) { return String(s || '').slice(0, 10); }
  function hm(s) { s = String(s || ''); return s.length > 10 ? s.slice(11, 16).replace(':', 'h') : ''; }
  var AQUAI = ['À quai', 'En opérations', 'En opération'];
  function monthFrac() { var t = E.TODAY, n = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); return Math.min(1, t.getDate() / n); }

  /* ------------------------------------------------------------------ indicateurs */
  function trafic() {
    var m = E.TODAY.getMonth(), labels = [], evp = [], esc0 = [], f = monthFrac();
    for (var i = 0; i <= m; i++) { labels.push(E.MOIS[i]); var k = i === m ? f : 1; evp.push(Math.round(SIM.evp[i] * k * evpK())); esc0.push(Math.round(SIM.escales[i] * k * escPart(i))); }
    return { labels: labels, evp: evp, escales: esc0, partial: f < 1 };
  }
  function factures() { return S.has('factures') ? S.all('factures').filter(function (f) { return f.statut !== 'Brouillon' && f.statut !== 'Annulée'; }) : []; }
  function ht(f) { return E.sum(f.lignes || [], function (l) { return (+l.qte || 0) * (+l.pu || 0); }); }
  function caMois() {
    var a = E.iso(new Date(E.TODAY.getFullYear(), E.TODAY.getMonth(), 1)), fs = factures().filter(function (f) { return f.date >= a && f.date <= today(); });
    if (fs.length || factures().length) return { v: E.sum(fs, ht), n: fs.length, sim: false };
    return { v: Math.round(SIM.caMois * caK() * monthFrac()), n: 0, sim: true };
  }
  function actOf(l) {
    if (l.activite) return l.activite;
    var s = E.norm(l.libelle || '');
    if (/soutage|eau|mgo|ifo|gasoil|fioul/.test(s)) return 'Soutage & eau';
    if (/magasin|hangar|stockage/.test(s)) return 'Magasinage';
    if (/pilot|remorq|laman|amarr/.test(s)) return 'Services maritimes';
    if (/quai|redevance/.test(s)) return 'Redevances';
    return 'Manutention';
  }
  function caActivites() {
    var a = E.iso(new Date(E.TODAY.getFullYear(), 0, 1)), o = {}, fs = factures().filter(function (f) { return f.date >= a; });
    ACTS.forEach(function (x) { o[x.k] = 0; });
    if (!fs.length) { var tot = SIM.caMois * caK() * (E.TODAY.getMonth() + monthFrac()); ACTS.forEach(function (x) { o[x.k] = tot * actShare(x); }); return { o: o, sim: true }; }
    fs.forEach(function (f) { (f.lignes || []).forEach(function (l) { var k = actOf(l); o[k] = (o[k] || 0) + (+l.qte || 0) * (+l.pu || 0); }); });
    return { o: o, sim: false };
  }
  function sites() {
    var t = trafic(), n = t.evp.length, esc = E.sum(t.escales), pogEsc = 0;
    for (var i = 0; i < n; i++) pogEsc += Math.round(t.escales[i] * SIM.pog[i]);
    var evp = E.sum(t.evp), pogEvp = Math.round(evp * 0.17);
    var fs = factures().filter(function (f) { return f.date >= E.iso(new Date(E.TODAY.getFullYear(), 0, 1)); });
    var caO = E.sum(fs.filter(function (f) { return f.site !== 'POG'; }), ht), caP = E.sum(fs.filter(function (f) { return f.site === 'POG'; }), ht);
    if (!fs.length) { var tot = SIM.caMois * (E.TODAY.getMonth() + monthFrac()); caO = tot * 0.71; caP = tot * 0.29; }
    var fl = S.all('flotte');
    return [
      { l: 'Escales', o: esc - pogEsc, p: pogEsc, f: F.num },
      { l: 'EVP manutentionnés', o: evp - pogEvp, p: pogEvp, f: F.num },
      { l: 'CA facturé (HT)', o: caO, p: caP, f: function (v) { return F.short(v); } },
      { l: 'Équipements de la flotte', o: fl.filter(function (e) { return e.site !== 'POG'; }).length, p: fl.filter(function (e) { return e.site === 'POG'; }).length, f: F.num }
    ];
  }

  /* graphique combiné : barres EVP + courbe nombre d'escales (axe secondaire) */
  function combo(t) {
    var W = window.innerWidth < 700 ? Math.max(300, window.innerWidth - 60) : 680, H = 240, pl = 48, pr = 34, pt = 14, pb = 26, n = t.labels.length;
    var rawE = Math.max.apply(null, t.evp.concat([1])) * 1.15, magE = Math.pow(10, Math.floor(Math.log10(rawE))), maxE = Math.ceil(rawE / magE) * magE, maxS = Math.max.apply(null, t.escales.concat([1])) * 1.25;
    var cw = (W - pl - pr) / n, bw = Math.min(34, cw * 0.58), g = '';
    for (var k = 0; k <= 4; k++) { var y = pt + (H - pt - pb) * (1 - k / 4); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '" stroke="#eef1f5"/><text x="' + (pl - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + (maxE >= 10000 ? F.short(maxE * k / 4) : F.num(maxE * k / 4)) + '</text><text x="' + (W - pr + 6) + '" y="' + (y + 4) + '">' + Math.round(maxS * k / 4) + '</text>'; }
    var pts = [];
    t.labels.forEach(function (l, i) {
      var cx = pl + cw * i + cw / 2, bh = (H - pt - pb) * t.evp[i] / maxE, last = i === n - 1;
      g += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + (H - pb - bh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="4" fill="' + (last ? 'url(#dshHatch)' : '#0b3a6e') + '"><title>' + esc(l + ' : ' + F.num(t.evp[i]) + ' EVP' + (last ? ' · ' + t.escales[i] + ' escales (mois en cours)' : '')) + '</title></rect>';
      g += '<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(cw < 40 ? l.charAt(0).toUpperCase() : l) + '</text>';
      if (!(last && t.partial)) pts.push([cx, pt + (H - pt - pb) * (1 - t.escales[i] / maxS)]);
    });
    g += '<polyline points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '" fill="none" stroke="#f2b705" stroke-width="2.5" stroke-linejoin="round"/>';
    pts.forEach(function (p, i) { g += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.5" fill="#fff" stroke="#f2b705" stroke-width="2"><title>' + esc(t.labels[i] + ' : ' + t.escales[i] + ' escales') + '</title></circle>'; });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="height:' + H + 'px"><defs><pattern id="dshHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#3a75c4"/><line x1="0" y1="0" x2="0" y2="6" stroke="#0b3a6e" stroke-width="3"/></pattern></defs>' + g + '</svg>' +
      '<div class="legend" style="margin-top:8px"><span><i style="background:#0b3a6e"></i>EVP manutentionnés (axe gauche)</span><span><i style="background:#f2b705"></i>Nombre d\'escales (axe droit)</span><span><i style="background:#3a75c4"></i>Mois en cours (partiel)</span></div>';
  }

  /* ------------------------------------------------------------------ rendu */
  function render(view) {
    var u = E.session.user() || { name: '' }, pend = safe(E.pendingAll, []);
    var L = escales(), t0 = today();
    var aQuai = L.filter(function (x) { return AQUAI.indexOf(x.statut) >= 0; });
    var lim72 = Date.now() + 72 * 36e5; /* même règle que le module Escales */
    var attendus = L.filter(function (x) { return ['Annoncée', 'Confirmée'].indexOf(x.statut) >= 0 && new Date(x.eta).getTime() <= lim72; });
    var s0 = sc(), sp = E.space();
    var tr = trafic(), evpM = tr.evp[tr.evp.length - 1], evpP = tr.evp.length > 1 ? Math.round(SIM.evp[tr.evp.length - 2] * evpK()) : 0, ca = safe(caMois, { v: 0, n: 0, sim: true });
    var cad = SIM.cadence[E.TODAY.getMonth()], grues = S.all('flotte').filter(function (e) { return e.type === 'Grue mobile portuaire'; }), gOk = grues.filter(function (e) { return e.statut !== 'En maintenance' && e.statut !== 'Hors service'; }).length;
    var sums = [];
    E.modules.forEach(function (m) { if (m.summary && m.id !== 'dashboard' && E.session.can(m)) { try { (m.summary() || []).slice(0, 1).forEach(function (s) { s.mod = m; sums.push(s); }); } catch (e) { console.warn(e); } } });
    var act = safe(caActivites, { o: {}, sim: true }), totA = E.sum(ACTS, function (a) { return act.o[a.k] || 0; });
    var sou = s0 === 'POG' ? safe(function () { var m = E.mod('soutage'); return m && E.session.can(m) && m.summary ? m.summary()[0] : null; }, null) : null;

    view.innerHTML = '<div class="dsh-root">' +
      '<section class="dsh-hero' + (s0 ? ' dsh-hero--' + s0 : '') + '"><div class="dsh-hero__bg"></div><div class="dsh-hero__in">' +
        '<div class="dsh-hero__txt">' + (s0 ? '<div class="dsh-hero__site">' + ic('pin') + esc(sp.court) + (sp.court.indexOf(sp.ville) < 0 ? ' · ' + esc(sp.ville) : '') + '</div>' : '') + '<div class="dsh-hero__date">' + esc(cap(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))) + '</div>' +
        '<h2>' + greeting() + ', ' + esc(u.civilite || String(u.name).split(' ')[0]) + '</h2>' +
        '<p>' + (pend.length ? 'Vous avez <b>' + pend.length + ' élément' + (pend.length > 1 ? 's' : '') + ' à traiter</b> aujourd\'hui.' : 'Aucune validation en attente : tout est à jour.') + (s0 === 'POG' ? ' Port de Port-Gentil : offshore pétrolier, soutage et eau douce.' : s0 === 'OWE' ? ' Port d\'Owendo : conteneurs, roulier et marchandises diverses.' : ' Ports d\'Owendo et de Port-Gentil.') + '</p></div>' +
        '<div class="dsh-hero__st">' + hs(aQuai.length, '', 'navires à quai') + hs(attendus.length, '', 'attendus sous 72 h') + hs(F.num(evpM), 'EVP', 'traités ce mois') + '</div>' +
      '</div></section>' +

      '<div class="dsh-kpis">' +
        U.kpi({ label: 'Navires à quai / attendus', value: aQuai.length + '<small> / ' + attendus.length + '</small>', icon: 'ship', tone: 'navy', foot: L.filter(function (x) { return x.statut === 'En rade'; }).length + ' en rade · ' + (s0 ? S.all('postes').length + ' postes à quai' : L.filter(function (x) { return x.site === 'POG' && AQUAI.indexOf(x.statut) >= 0; }).length + ' à Port-Gentil') }) +
        U.kpi({ label: 'EVP traités · ' + E.MOIS[E.TODAY.getMonth()], value: F.num(evpM), unit: 'EVP', icon: 'container', tone: 'blue', foot: 'mois précédent : ' + F.num(evpP) + ' EVP' }) +
        U.kpi({ label: 'CA facturé · ' + E.MOIS[E.TODAY.getMonth()], value: F.short(ca.v), unit: 'FCFA HT', icon: 'invoice', tone: 'green', foot: ca.sim ? 'valeur de simulation' : ca.n + ' facture(s) émise(s)' }) +
        (s0 === 'POG' ? (sou ? U.kpi({ label: sou.label, value: sou.value, unit: sou.unit, icon: 'fuel', tone: 'yellow', foot: sou.foot }) : U.kpi({ label: 'Postes à quai', value: S.all('postes').length, icon: 'anchor', tone: 'yellow', foot: 'quais commerciaux et appontement soutage' }))
          : U.kpi({ label: 'Cadence moyenne des grues', value: F.num(cad, 1), unit: 'mvts/h', icon: 'crane', tone: 'yellow', foot: gOk + ' / ' + (grues.length || 3) + ' grues disponibles · objectif 25–30' })) +
      '</div>' +

      '<div class="grid g-2-1">' +
        '<div class="card"><div class="card__h"><h3>Trafic mensuel ' + E.TODAY.getFullYear() + '</h3><span class="sub">EVP et nombre d\'escales · ' + (s0 ? esc(sp.court) + ' · ' : '') + 'valeurs de simulation</span></div><div class="card__b">' + combo(tr) + '</div></div>' +
        '<div class="card"><div class="card__h"><h3>Chiffre d\'affaires par activité</h3><span class="sub">' + E.TODAY.getFullYear() + ' à date · HT' + (act.sim ? ' · simulation' : '') + '</span></div><div class="card__b">' + U.donut(ACTS.map(function (a) { return { label: a.k, value: Math.round(act.o[a.k] || 0), color: a.c }; }).filter(function (x) { return x.value > 0 || !s0; }), { money: true, center: F.short(totA), sub: 'FCFA HT', size: 140 }) + '</div></div>' +
      '</div>' +

      '<div class="grid g-1-2">' +
        (s0 ? '<div class="card"><div class="card__h"><h3>Postes à quai</h3><span class="sub">' + esc(sp.court) + ' · en ce moment</span></div>' + safe(function () { return berths(L); }, '') + '</div>'
          : '<div class="card"><div class="card__h"><h3>Owendo / Port-Gentil</h3><span class="sub">cumul ' + E.TODAY.getFullYear() + '</span></div><div class="card__b">' + safe(function () { return sites().map(siteRow).join(''); }, '') + '<div class="legend" style="margin-top:12px"><span><i style="background:#0b3a6e"></i>Owendo</span><span><i style="background:#009e60"></i>Port-Gentil</span></div></div></div>') +
        '<div class="card"><div class="card__h"><h3>Situation du jour</h3><span class="sub">mouvements de navires · ' + F.date(t0) + '</span><span class="spacer"></span>' + (E.mod('escales') && E.session.can(E.mod('escales')) ? '<a class="btn sm" href="#/escales">Escales ' + ic('arrow') + '</a>' : '') + '</div>' + situation(L) + '</div>' +
      '</div>' +

      (sums.length ? '<div class="dsh-sums">' + sums.slice(0, 8).map(function (s) { return '<a href="' + (s.href || '#/' + s.mod.id) + '" class="dsh-sum">' + U.kpi({ label: s.label, value: s.value, unit: s.unit, icon: s.icon || s.mod.icon, tone: s.tone || 'blue', foot: s.foot }) + '</a>'; }).join('') + '</div>' : '') +

      '<div class="grid g-2-1">' +
        '<div class="card"><div class="card__h"><h3>Mes validations</h3><span class="sub">' + pend.length + ' en attente</span></div><div class="card__b flush">' +
          (pend.length ? '<div class="list">' + pend.slice(0, 8).map(function (p) {
            return '<a class="list__item dsh-li" href="' + (p.href || '#') + '"><div class="list__icon ' + (U.TONES[p.tone || 'orange']) + '">' + ic(p.icon || 'check') + '</div><div class="list__body"><b>' + esc(p.title) + '</b><div class="small muted">' + esc(p.module || '') + (p.sub ? ' · ' + esc(p.sub) : '') + '</div></div>' + (p.date ? '<span class="small muted nowrap">' + F.dateShort(p.date) + '</span>' : '') + '</a>';
          }).join('') + (pend.length > 8 ? '<div class="list__item small muted">… et ' + (pend.length - 8) + ' autre(s)</div>' : '') + '</div>' : '<div class="empty">' + ic('check') + '<br>Rien à valider pour le moment.</div>') +
        '</div></div>' +
        '<div class="card"><div class="card__h"><h3>Activité récente</h3></div><div class="card__b flush"><div class="list">' + activity() + '</div></div></div>' +
      '</div>' +

      '<div class="dsh-quick">' + quick() + '</div>' +
      '<p class="dsh-note">Données de démonstration (navires, montants et volumes fictifs). ' + (s0 === 'POG' ? 'Photo d\'illustration du port de Port-Gentil' : 'Photo : groupe Portek') + ' — à remplacer par les photos officielles de GPM.</p>' +
    '</div>';
  }
  function hs(v, unit, label) { return '<div><b>' + v + (unit ? '<small>' + unit + '</small>' : '') + '</b><span>' + label + '</span></div>'; }
  function siteRow(r) {
    var tot = (r.o + r.p) || 1, po = r.o / tot * 100;
    return '<div class="dsh-site"><div class="dsh-site__h"><span>' + esc(r.l) + '</span><span><b>' + r.f(r.o) + '</b> · <b class="pog">' + r.f(r.p) + '</b></span></div><div class="dsh-site__bar"><i style="width:' + po.toFixed(1) + '%"></i><i class="pog" style="width:' + (100 - po).toFixed(1) + '%"></i></div></div>';
  }
  /* Postes à quai du site actif : navire présent ou prochaine arrivée */
  function berths(L) {
    var ps = S.all('postes'); if (!ps.length) return '<div class="empty">Aucun poste à quai paramétré pour ce site.</div>';
    return '<div class="list">' + ps.map(function (p) {
      var occ = L.find(function (x) { return x.poste === p.id && AQUAI.indexOf(x.statut) >= 0; });
      var nxt = L.filter(function (x) { return x.poste === p.id && ['Annoncée', 'Confirmée', 'En rade'].indexOf(x.statut) >= 0; }).sort(function (a, b) { return String(a.eta).localeCompare(String(b.eta)); })[0];
      var nom = p.nom.replace(/^(Owendo|Port-Gentil) · /, '');
      return '<a class="list__item dsh-li" href="#/escales/' + (occ ? occ.id : nxt ? nxt.id : 'plan') + '"><div class="list__icon ' + (occ ? 'tone-violet' : 'tone-green') + '">' + ic(occ ? 'ship' : 'anchor') + '</div><div class="list__body"><b>' + esc(nom) + '</b><div class="small muted">' + esc(p.type) + ' · TE ' + F.num(p.te, 1) + ' m' + (occ ? ' · ' + esc(occ.navire) : nxt ? ' · prochain : ' + esc(nxt.navire) + ' (' + F.dateShort(day(nxt.eta)) + ')' : '') + '</div></div>' + U.badge(occ ? (occ.statut || 'À quai') : 'Libre', occ ? 'violet' : 'green') + '</a>';
    }).join('') + '</div>';
  }
  function situation(L) {
    var t = today(), rows = [];
    L.forEach(function (x) {
      var arr = day(x.ata || x.eta) === t, dep = day(x.atd || x.etd) === t;
      if (arr) rows.push({ h: x.ata || x.eta, x: x, m: x.ata ? 'Arrivé' : 'Arrivée prévue', k: 'in' });
      if (dep) rows.push({ h: x.atd || x.etd, x: x, m: x.atd ? 'Appareillé' : 'Départ prévu', k: 'out' });
      if (!arr && !dep && AQUAI.indexOf(x.statut) >= 0) rows.push({ h: '', x: x, m: 'À quai — opérations', k: 'quai' });
    });
    rows.sort(function (a, b) { return (a.h ? hm(a.h) : '99').localeCompare(b.h ? hm(b.h) : '99'); });
    if (!rows.length) return '<div class="empty">Aucun mouvement de navire aujourd\'hui.</div>';
    return '<div class="dsh-moves">' + rows.map(function (r) {
      var x = r.x, pc = x.fait != null ? Math.max(0, Math.min(100, +x.fait)) : null;
      return '<div class="dsh-move ' + r.k + '"><div class="dsh-move__t">' + (r.h ? hm(r.h) : '—') + '</div><div class="dsh-move__i">' + ic(r.k === 'out' ? 'logout' : r.k === 'in' ? 'anchor' : 'crane') + '</div><div class="dsh-move__b"><b>' + esc(x.navire) + '</b><span>' + esc(r.m) + ' · ' + esc(x.poste ? E.posteName(x.poste) : (x.site === 'POG' ? 'Port-Gentil' : 'Owendo')) + '</span>' + (pc != null && r.k !== 'in' && pc > 0 ? '<div class="dsh-move__p">' + U.progress(pc, pc >= 100 ? 'green' : '') + '</div>' : '') + '</div>' + U.badge(x.statut || '—') + '</div>';
    }).join('') + '</div>';
  }
  function activity() {
    var a = safe(E.audit, []).slice(0, 7);
    if (!a.length) {
      var b = Date.now();
      a = [
        { at: new Date(b - 14 * 60000), user: 'Rodrigue Ndong Ella', action: 'Escale confirmée', detail: 'MV Gulf Pioneer — Owendo poste 2', site: 'OWE' },
        { at: new Date(b - 40 * 60000), user: 'Christian Bivigou', action: 'Escale confirmée', detail: 'PSV Offshore Mandji — quai commercial B', site: 'POG' },
        { at: new Date(b - 70 * 60000), user: 'Linda Nzamba', action: 'Livraison de soutage démarrée', detail: 'MT West Gentil — 180 m³ de gasoil marin', site: 'POG' },
        { at: new Date(b - 3 * 3600000), user: 'Christelle Moussounda', action: 'Facture émise', detail: 'Atlantic Container Line (démo)', site: 'OWE' },
        { at: new Date(b - 4 * 3600000), user: 'Gisèle Boukandou', action: 'Facture émise', detail: 'Offshore Supply Gabon (démo)', site: 'POG' },
        { at: new Date(b - 6 * 3600000), user: 'Fabrice Mbadinga', action: 'OT créé', detail: 'GR-03 — entretien 500 h', site: 'OWE' },
        { at: new Date(b - 9 * 3600000), user: 'Arnaud Moussavou', action: 'OT planifié', detail: 'BS-01 — visite annuelle de classification', site: 'POG' },
        { at: new Date(b - 26 * 3600000), user: 'Patrick Koumba', action: 'Avis aux navigateurs publié', detail: 'Travaux de défenses au poste 3', site: 'OWE' }
      ].filter(function (x) { return !sc() || x.site === sc(); });
    }
    return a.map(function (x) { return '<div class="list__item">' + U.avatar(x.user, null, true) + '<div class="list__body"><b>' + esc(x.action) + '</b><div class="small muted">' + esc(x.detail) + '</div><div class="small muted">' + esc(x.user) + ' · ' + F.ago(x.at) + '</div></div></div>'; }).join('');
  }
  function quick() {
    var Q = [
      ['escales', 'ship', 'Escales & plan de quai', 'Demandes, annonces, postes à quai, mouvements.'],
      ['services', 'tug', 'Pilotage & remorquage', 'Affectation des pilotes, remorqueurs et lamaneurs.'],
      ['terminal', 'container', 'Terminal à conteneurs', 'Parc, mouvements, cadence des grues.'],
      ['soutage', 'fuel', 'Soutage & eau douce', 'Commandes, niveau des cuves, bons de livraison.'],
      ['ventes', 'invoice', 'Facturation & clients', 'Prestations à facturer, factures, encours.'],
      ['maintenance', 'wrench', 'Flotte & maintenance', 'Disponibilité, préventif, ordres de travail.'],
      ['achats', 'cart', 'Achats', 'Demandes d\'achat, devis, bons de commande.'],
      ['hse', 'shield', 'HSE & sûreté', 'Accès ISPS, permis de travail, incidents.'],
      ['recrutement', 'userplus', 'Recrutement & stages', 'Candidatures reçues depuis le site.']
    ];
    /* Port-Gentil : le soutage et l'eau douce passent en tête des raccourcis */
    if (sc() === 'POG') { Q.sort(function (a, b) { var o = ['escales', 'soutage', 'services', 'ventes', 'maintenance', 'terminal']; var x = o.indexOf(a[0]), y = o.indexOf(b[0]); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); }); Q.forEach(function (q) { if (q[0] === 'terminal') q[3] = 'Parc conteneurs, magasin et parc offshore.'; if (q[0] === 'services') q[3] = 'Pilotage, remorquage et lamanage des navires.'; }); }
    Q = Q.filter(function (q) { var m = E.mod(q[0]); return m && E.session.can(m); }).slice(0, 6);
    return Q.map(function (q) { return '<a class="card dsh-q" href="#/' + q[0] + '"><div class="list__icon tone-navy">' + ic(q[1]) + '</div><div><b>' + esc(q[2]) + '</b><span>' + esc(q[3]) + '</span></div>' + ic('arrow', 'dsh-q__a') + '</a>'; }).join('');
  }

  E.register({ id: 'dashboard', label: 'Tableau de bord', title: 'Tableau de bord', icon: 'home', group: 'Pilotage', render: render });
})();
