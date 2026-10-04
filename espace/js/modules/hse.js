/* GPM · Espace de gestion — Module HSE & sûreté portuaire
   Sûreté portuaire (code ISPS : niveau de sûreté 1/2/3, badges d'accès, registre des visiteurs et véhicules,
   déclarations de sûreté navire/port, exercices et entraînements), permis de travail portuaires (travaux à quai,
   levage, travail à bord, hauteur, plongée, point chaud, espace confiné — contrôles bloquants et mesures de gaz),
   plans de prévention, événements (chute de charge, abordage, pollution, homme à la mer…) & actions correctives,
   indicateurs, visites & audits, environnement (MARPOL, déchets des navires, qualité des eaux, mangrove). */
(function () {
  'use strict';
  var E = window.ERP; if (!E) return;
  var ui = E.ui, fmt = E.fmt, esc = E.esc, icon = E.icon, S = E.store;

  /* feuille de style propre au module */
  if (!document.querySelector('link[data-hse]')) { var lk = document.createElement('link'); lk.rel = 'stylesheet'; lk.href = 'css/hse.css'; lk.setAttribute('data-hse', ''); document.head.appendChild(lk); }

  /* ================================================================== utilitaires */
  function M(i) { return 'MAT-' + (2041 + i * 7); }
  function N(i) { return E.empName(M(i)); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function localISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function toDate(s) { return s ? new Date(String(s).length <= 10 ? s + 'T00:00' : s) : null; }
  function nowISO() { return localISO(new Date()); }
  function shift(s, h) { return localISO(new Date(toDate(s).getTime() + h * 36e5)); }
  function dayAt(off, hh, mm) { var d = new Date(E.TODAY); d.setDate(d.getDate() + off); d.setHours(hh, mm || 0, 0, 0); return localISO(d); }
  function D(off) { return E.addDays(E.today(), off); }
  function hoursBetween(a, b) { return (toDate(b) - toDate(a)) / 36e5; }
  function fDT(s) { var d = toDate(s); if (!d) return '—'; return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + 'h' + pad(d.getMinutes()); }
  function fH(s) { var d = toDate(s); return d ? pad(d.getHours()) + 'h' + pad(d.getMinutes()) : '—'; }
  function dur(h) { var neg = h < 0; h = Math.abs(h); var hh = Math.floor(h), mm = Math.round((h - hh) * 60); if (mm === 60) { hh++; mm = 0; } return (neg ? '-' : '') + (hh ? hh + ' h' + (mm ? ' ' + pad(mm) : '') : mm + ' min'); }
  function num(v, d) { return fmt.num(v, d == null ? (v % 1 ? 1 : 0) : d); }
  function user() { return E.session.user() || { name: 'Utilisateur', profile: '' }; }
  function isHSE() { var u = user(); return u.profile === 'hse' || u.profile === 'admin'; }
  /* zones portuaires (postes à quai de la collection commune `postes` + terre-pleins, ateliers, rade) */
  var ZP = [
    { id: 'OWE-P1', nom: 'Owendo · Poste 1 (conteneurs)' }, { id: 'OWE-P2', nom: 'Owendo · Poste 2 (conteneurs)' }, { id: 'OWE-P3', nom: 'Owendo · Poste 3 (roulier)' }, { id: 'OWE-P4', nom: 'Owendo · Poste 4 (pétrolier et gazier)' },
    { id: 'OWE-PARC', nom: 'Owendo · Parc à conteneurs' }, { id: 'OWE-MAG', nom: 'Owendo · Magasin, bureaux et parc véhicules' }, { id: 'OWE-ATL', nom: 'Owendo · Atelier engins et flotte' }, { id: 'OWE-RADE', nom: 'Owendo · Rade, chenal et navires à flot' },
    { id: 'POG-QC', nom: 'Port-Gentil · Quai commercial A' }, { id: 'POG-QB', nom: 'Port-Gentil · Quai commercial B (offshore)' }, { id: 'POG-SOUT', nom: 'Port-Gentil · Appontement de soutage' },
    { id: 'POG-MAG', nom: 'Port-Gentil · Magasin & bureaux de l\'agence' }, { id: 'POG-RADE', nom: 'Port-Gentil · Rade du Cap Lopez' }
  ];
  function uName(id) { var u = ZP.find(function (z) { return z.id === id; }) || S.get('postes', id); return u ? u.nom : (id || '—'); }
  function ent(id) { if (!id || id === 'INT') return 'GPM (interne)'; var f = S.get('fournisseurs', id); return f ? f.nom : id; }
  function empOpts() { return S.all('employes').map(function (e) { return { v: e.id, l: e.nom + ' · ' + e.poste }; }); }
  function entOpts() { return [{ v: 'INT', l: 'GPM (interne)' }].concat(E.options('fournisseurs')); }
  /* ---------- espaces par site ---------- */
  function SC() { return E.scope(); }
  function siteOf(z) { return String(z || '').slice(0, 4) === 'POG-' ? 'POG' : 'OWE'; }
  function portName(s) { return s === 'POG' ? 'Port-Gentil' : 'Owendo'; }
  function portLong(s) { return s === 'POG' ? 'Port de Port-Gentil' : s === 'OWE' ? 'Port d\'Owendo' : 'Ports d\'Owendo et de Port-Gentil'; }
  var PORT_OPTS = [{ v: 'OWE', l: 'Owendo (Libreville)' }, { v: 'POG', l: 'Port-Gentil' }];
  function zonesOf(site) { return ZP.filter(function (z) { return !site || siteOf(z.id) === site; }); }
  function uniteOpts(site) { return zonesOf(site === undefined ? SC() : site).map(function (u) { return { v: u.id, l: u.nom }; }); }
  function shortZ(id) { return uName(id).replace(/^(Owendo|Port-Gentil) · /, ''); }
  /* valeurs par défaut des formulaires selon le site actif (employés du site) */
  var DEFS = {
    OWE: { zone: 'OWE-P1', dem: M(25), emi: M(34), resp: M(14), aud: M(34), act: M(12), sog: M(25) },
    POG: { zone: 'POG-QC', dem: M(37), emi: M(36), resp: M(41), aud: M(36), act: M(41), sog: M(36) }
  };
  function def(k) { return DEFS[SC() || 'OWE'][k]; }
  /* numéros séquentiels calculés sur toute la collection (les deux sites) pour éviter les doublons */
  function nextId(col, prefix, width) {
    var max = 0; S.raw(col).forEach(function (x) { if (String(x.id).indexOf(prefix) === 0) { var n = parseInt(String(x.id).slice(prefix.length), 10); if (n > max) max = n; } });
    return prefix + String(max + 1).padStart(width, '0');
  }
  function yr() { return E.TODAY.getFullYear(); }
  function after(fn) { setTimeout(fn, 0); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function stamp(note) { var u = user(); return { at: nowISO(), par: u.name, note: note || '' }; }
  function alertBox(tone, ic, html) { return '<div class="alert tone-' + tone + '">' + icon(ic) + '<div>' + html + '</div></div>'; }

  /* ================================================================== référentiels HSE */
  var TYPES = {
    GEN: { l: 'Permis général — travaux à quai', s: 'Travaux à quai', c: '#2563eb', ic: 'wrench' },
    LEV: { l: 'Levage (grue, colis lourd, élingage)', s: 'Levage', c: '#0e7490', ic: 'crane' },
    BORD: { l: 'Travail à bord d\'un navire', s: 'Travail à bord', c: '#145091', ic: 'ship' },
    HAU: { l: 'Travail en hauteur (grue, mât, nacelle)', s: 'Travail en hauteur', c: '#e8780c', ic: 'layers' },
    PLG: { l: 'Plongée / travaux sous-marins', s: 'Plongée', c: '#0891b2', ic: 'wave' },
    FEU: { l: 'Permis de feu (point chaud à quai ou à bord)', s: 'Permis de feu', c: '#d93636', ic: 'fire' },
    ESP: { l: 'Espace confiné (cale, ballast, citerne)', s: 'Espace confiné', c: '#7c3aed', ic: 'tank' },
    H2S: { l: 'Intervention sur hydrocarbures / produits dangereux (poste pétrolier, soutage)', s: 'Hydrocarbures', c: '#0f2d5c', ic: 'fuel' },
    LOTO: { l: 'Consignation électrique / mécanique (LOTO)', s: 'Consignation LOTO', c: '#a16207', ic: 'lock' },
    FOU: { l: 'Fouille / génie civil sur terre-plein', s: 'Fouille', c: '#78552b', ic: 'box' }
  };
  var TYPE_KEYS = Object.keys(TYPES);
  var GAS_REQ = { FEU: 1, ESP: 1, H2S: 1 };
  var ST_TONE = { 'Demandé': 'orange', 'Préparé': 'violet', 'Autorisé': 'green', 'En cours': 'blue', 'Suspendu': 'red', 'Clôturé': 'grey', 'Annulé': 'grey' };
  var ACTIFS = ['Autorisé', 'En cours', 'Suspendu'];
  var FLOW = ['Demandé', 'Préparé', 'Autorisé', 'En cours', 'Clôturé'];
  var DANGERS = [
    ['noyade', 'Chute à l\'eau / noyade'], ['charge', 'Charge suspendue / chute de charge'], ['circulation', 'Circulation des engins (reach stackers, camions)'], ['amarres', 'Rupture d\'aussière / effet de fouet'],
    ['chute', 'Chute de hauteur'], ['objets', 'Chute d\'objets (twistlocks, outillage)'], ['elec', 'Électrisation / électrocution'], ['energie', 'Énergie résiduelle (hydraulique, mécanique)'],
    ['hc', 'Hydrocarbures / produits inflammables'], ['atex', 'Atmosphère explosive (pétroliers, soutage)'], ['anoxie', 'Anoxie (cales, ballasts, citernes)'], ['h2s', 'Gaz toxiques (H₂S, fumigation)'],
    ['brulure', 'Brûlure / surfaces chaudes'], ['coactivite', 'Coactivité navire / quai / entreprises'], ['meteo', 'Houle, vent fort, orage'], ['chimique', 'Marchandises dangereuses (code IMDG)']
  ];
  var SECU = [
    ['consignation', 'Consignation électrique / mécanique (LOTO) effectuée'],
    ['isolement', 'Isolement : vannes cadenassées, lignes et flexibles purgés'],
    ['purge', 'Vidange, purge et inertage (citernes, soutes, lignes)'],
    ['degazage', 'Dégazage et ventilation forcée'],
    ['gaz', 'Mesures de gaz réalisées (explosimètre 4 gaz étalonné)'],
    ['detecteur', 'Détecteur 4 gaz portatif en continu sur la zone'],
    ['surveillant', 'Surveillant / veilleur désigné en permanence'],
    ['extincteurs', 'Extincteurs et lance incendie en place'],
    ['bache', 'Bâches ignifugées, regards et caniveaux obturés'],
    ['balisage', 'Zone balisée et signalisée'],
    ['ari', 'ARI (appareil respiratoire isolant) disponible sur place'],
    ['harnais', 'Harnais, ligne de vie, échafaudage réceptionné (étiquette verte)'],
    ['radio', 'Liaison radio avec le bureau d\'exploitation / la capitainerie'],
    ['sauvetage', 'Moyens de sauvetage et d\'évacuation (trépied, treuil, embarcation)'],
    ['reseaux', 'Réseaux enterrés repérés, déviation des engins de parc'],
    ['levage', 'Plan de levage validé, élingues et grue contrôlées (charge < CMU)'],
    ['bord', 'Accord écrit du commandant et liaison avec l\'officier de quart'],
    ['gilet', 'Gilets de sauvetage portés, bouée et embarcation de sécurité à poste'],
    ['plongee', 'Équipe de plongée certifiée (3 plongeurs minimum), matériel vérifié'],
    ['helices', 'Hélices et propulseurs consignés, aucun mouvement de navire au poste'],
    ['vhf', 'Veille VHF et information de la capitainerie / des pilotes']
  ];
  var REQ = {
    GEN: ['balisage', 'radio'],
    FEU: ['isolement', 'purge', 'gaz', 'detecteur', 'surveillant', 'extincteurs', 'bache', 'balisage'],
    ESP: ['consignation', 'isolement', 'purge', 'degazage', 'gaz', 'detecteur', 'surveillant', 'ari', 'radio', 'sauvetage'],
    HAU: ['harnais', 'balisage', 'sauvetage'],
    LOTO: ['consignation', 'balisage'],
    FOU: ['reseaux', 'balisage'],
    LEV: ['levage', 'balisage', 'radio'],
    BORD: ['bord', 'balisage', 'radio', 'gilet'],
    PLG: ['plongee', 'helices', 'vhf', 'surveillant', 'sauvetage'],
    H2S: ['isolement', 'purge', 'gaz', 'detecteur', 'surveillant', 'extincteurs', 'balisage', 'radio']
  };
  var EPI = [['casque', 'Casque'], ['lunettes', 'Lunettes de sécurité'], ['chaussures', 'Chaussures de sécurité'], ['hv', 'Gilet haute visibilité'], ['gants', 'Gants adaptés'], ['combi', 'Combinaison ignifugée'],
    ['gilet', 'Gilet de sauvetage'], ['auditif', 'Protection auditive'], ['masque', 'Masque à cartouche'], ['ari', 'ARI'], ['harnais', 'Harnais antichute'], ['ecran', 'Écran / cagoule de soudeur'], ['detect', 'Détecteur 4 gaz individuel'], ['plongee', 'Équipement de plongée']];
  var EPI_BASE = ['casque', 'chaussures', 'hv', 'gants'];
  var EPI_TYPE = { FEU: ['combi', 'ecran', 'detect'], ESP: ['ari', 'detect', 'harnais'], HAU: ['harnais'], H2S: ['combi', 'detect', 'lunettes'], LEV: [], LOTO: [], FOU: [], GEN: [], BORD: ['gilet'], PLG: ['plongee'] };
  var RETOUR = [['travaux', 'Travaux terminés'], ['propre', 'Zone propre et rangée, déchets évacués'], ['materiel', 'Matériel, outillage et échafaudages retirés'], ['deconsig', 'Déconsignation / remise en service effectuée'], ['restitue', 'Installation restituée à l\'exploitation']];
  function lbl(list, k) { var x = list.find(function (a) { return a[0] === k; }); return x ? x[1] : k; }

  /* Mesures de gaz : seuils & couleurs */
  var GAS = [
    { k: 'o2', l: 'O₂', u: '%', step: '0.1', lvl: function (v) { return v < 19.5 || v > 23.5 ? 'bad' : v < 20.5 ? 'warn' : 'ok'; }, seuil: '19,5 – 23,5 %' },
    { k: 'lie', l: 'LIE', u: '%', step: '1', lvl: function (v) { return v >= 10 ? 'bad' : v > 0 ? 'warn' : 'ok'; }, seuil: '0 % (feu) · < 10 %' },
    { k: 'h2s', l: 'H₂S', u: 'ppm', step: '0.1', lvl: function (v) { return v >= 5 ? 'bad' : v >= 1 ? 'warn' : 'ok'; }, seuil: '< 1 ppm (5 ppm sous ARI)' },
    { k: 'co', l: 'CO', u: 'ppm', step: '1', lvl: function (v) { return v >= 50 ? 'bad' : v >= 20 ? 'warn' : 'ok'; }, seuil: '< 20 ppm (VME)' }
  ];
  function gasPills(m) {
    if (!m) return '<span class="muted small">Aucune mesure</span>';
    return '<span class="gzs">' + GAS.map(function (g) { return '<span class="gz ' + g.lvl(m[g.k]) + '">' + g.l + ' ' + num(m[g.k]) + '</span>'; }).join('') + '</span>';
  }
  function gasWorst(m) { if (!m) return null; var l = GAS.map(function (g) { return g.lvl(m[g.k]); }); return l.indexOf('bad') >= 0 ? 'bad' : l.indexOf('warn') >= 0 ? 'warn' : 'ok'; }
  function lastGas(p) { return p.gaz && p.gaz.length ? p.gaz[p.gaz.length - 1] : null; }
  /* règles bloquantes selon le type de permis */
  function gasRules(type, m, secu) {
    if (!m) return [{ ok: false, l: 'Mesure de gaz obligatoire pour ce type de permis' }];
    var r = [];
    r.push({ ok: m.o2 >= 19.5 && m.o2 <= 23.5, l: 'O₂ entre 19,5 et 23,5 % (mesuré : ' + num(m.o2) + ' %)' });
    if (type === 'FEU') r.push({ ok: m.lie <= 0, l: 'LIE = 0 % pour un travail par point chaud (mesuré : ' + num(m.lie) + ' %)' });
    else r.push({ ok: m.lie < 10, l: 'LIE < 10 % (mesuré : ' + num(m.lie) + ' %)' });
    if (type === 'H2S') r.push({ ok: m.h2s < 5 && !!(secu && secu.ari), l: 'H₂S < 5 ppm avec ARI en place (mesuré : ' + num(m.h2s) + ' ppm)' });
    else r.push({ ok: m.h2s < 1, l: 'H₂S < 1 ppm (mesuré : ' + num(m.h2s) + ' ppm)' });
    var coMax = type === 'ESP' ? 20 : 50;
    r.push({ ok: m.co < coMax, l: 'CO < ' + coMax + ' ppm (mesuré : ' + num(m.co) + ' ppm)' });
    return r;
  }
  function authChecks(p) {
    var c = [];
    c.push({ ok: (p.dangers || []).length > 0 && !!p.mesuresRisques, l: 'Analyse de risques renseignée (dangers + mesures)' });
    var req = REQ[p.type] || [], miss = req.filter(function (k) { return !(p.secu || {})[k]; });
    c.push({ ok: !miss.length, l: 'Mesures de sécurité obligatoires : ' + (req.length - miss.length) + '/' + req.length + (miss.length ? ' — manque : ' + miss.map(function (k) { return lbl(SECU, k).split(' (')[0]; }).join(', ') : '') });
    c.push({ ok: (p.epi || []).length > 0, l: 'EPI requis définis' });
    var d = hoursBetween(p.debut, p.fin);
    c.push({ ok: d > 0 && d <= 12, l: 'Durée de validité ≤ 12 h (' + dur(d) + ')' });
    if ((p.type === 'FEU' || p.type === 'ESP') && !p.surveillant) c.push({ ok: false, l: 'Surveillant désigné' });
    (p.associes || []).forEach(function (id) { var a = S.get('permis', id); if (a && a.type === 'LOTO') c.push({ ok: ACTIFS.indexOf(a.statut) >= 0, l: 'Consignation associée ' + id + ' autorisée (' + a.statut.toLowerCase() + ')' }); });
    if (GAS_REQ[p.type]) c = c.concat(gasRules(p.type, lastGas(p), p.secu));
    return c;
  }
  function checklist(c) { return '<ul class="hse-ctl">' + c.map(function (x) { return '<li class="' + (x.ok ? 'ok' : 'ko') + '"><i>' + (x.ok ? '✓' : '✕') + '</i><span>' + esc(x.l) + '</span></li>'; }).join('') + '</ul>'; }

  function stBadge(s) { return ui.badge(s, ST_TONE[s]); }
  function tt(type, long) { var t = TYPES[type] || TYPES.GEN; return '<span class="hse-tt" style="--c:' + t.c + '">' + icon(t.ic) + '<span>' + esc(long ? t.l : t.s) + '</span></span>'; }
  function isOverdue(p) { return (p.statut === 'En cours' || p.statut === 'Suspendu') && toDate(p.fin) < new Date(); }

  /* Événements */
  var EVT = {
    AAA: { l: 'Accident avec arrêt', c: '#b91c1c', tone: 'red', ic: 'alert' },
    ASA: { l: 'Accident sans arrêt', c: '#e8780c', tone: 'orange', ic: 'helmet' },
    PA: { l: 'Presque-accident', c: '#ca8a04', tone: 'yellow', ic: 'flag' },
    SD: { l: 'Situation dangereuse', c: '#2563eb', tone: 'blue', ic: 'eye' },
    FEU: { l: 'Départ de feu', c: '#d93636', tone: 'red', ic: 'fire' },
    FUI: { l: 'Fuite / déversement', c: '#7c3aed', tone: 'violet', ic: 'drop' },
    ENV: { l: 'Environnement (mangrove, rejet)', c: '#1e9e4a', tone: 'green', ic: 'globe' },
    CHUTE: { l: 'Chute de charge', c: '#9a3412', tone: 'red', ic: 'container' },
    ABOR: { l: 'Abordage / heurt de quai', c: '#1e3a8a', tone: 'navy', ic: 'ship' },
    POL: { l: 'Pollution aux hydrocarbures', c: '#0f766e', tone: 'violet', ic: 'drop' },
    HMM: { l: 'Homme à la mer', c: '#dc2626', tone: 'red', ic: 'wave' }
  };
  var GRAV = ['', 'Mineure', 'Modérée', 'Sérieuse', 'Majeure'];
  var GRAV_TONE = ['', 'grey', 'yellow', 'orange', 'red'];
  var EV_FLOW = ['Déclaré', 'En analyse', 'Actions en cours', 'Clôturé'];
  var EV_TONE = { 'Déclaré': 'orange', 'En analyse': 'violet', 'Actions en cours': 'blue', 'Clôturé': 'grey' };
  var CAT5M = ['Main-d\'œuvre', 'Méthode', 'Matériel', 'Milieu', 'Management'];
  function evBadge(type) { var t = EVT[type]; return ui.badge(t ? t.l : type, t ? t.tone : 'grey'); }
  function gravBadge(g) { return '<span class="badge plain ' + ui.TONES[GRAV_TONE[g] || 'grey'] + '">G' + g + ' · ' + GRAV[g] + '</span>'; }
  function actLate(a) { return a.statut !== 'Réalisée' && a.echeance < E.today(); }

  /* Plans de prévention */
  var PDP_FLOW = ['Brouillon', 'Inspection commune', 'Signé', 'Actif', 'Expiré'];
  var PDP_TONE = { 'Brouillon': 'grey', 'Inspection commune': 'orange', 'Signé': 'violet', 'Actif': 'green', 'Expiré': 'red' };

  /* ================================================================== données d'exemple (relatives à aujourd'hui) */
  function seed() {
    var nb = new Date(); nb.setMinutes(0, 0, 0);
    var now = new Date(), Y = yr();
    var HB = function (h) { return localISO(new Date(nb.getTime() + h * 36e5)); };
    var cl = function (s) { return toDate(s) <= now ? s : localISO(new Date(now.getTime() - 25 * 60000)); };
    var g = function (at, phase, o2, lie, h2s, co, par, point) { return { at: cl(at), phase: phase, o2: o2, lie: lie, h2s: h2s, co: co, par: par, point: point || 'Zone de travail' }; };
    var all = function (type, extra) { var o = {}; (REQ[type] || []).concat(extra || []).forEach(function (k) { o[k] = true; }); return o; };
    var epi = function (type, extra) { return EPI_BASE.concat(EPI_TYPE[type] || []).concat(extra || []); };
    var OT = function (n) { return 'OT-' + Y + '-0' + n; }, PT = function (n) { return 'PT-' + Y + '-0' + n; };

    function build(o) {
      var p = Object.assign({ gaz: [], associes: [], prolong: [], secu: {}, dangers: [], epi: [], intervenants: 3, sig: {}, hist: [], surveillant: '' }, o);
      p.site = p.site || siteOf(p.unite);
      var dem = E.empName(p.demandeur), emi = E.empName(p.emetteur), res = E.empName(p.responsable);
      var idx = FLOW.indexOf(p.statut === 'Suspendu' ? 'En cours' : p.statut);
      var t0 = cl(o.cree || shift(p.debut, -20));
      p.cree = t0; p.sig.demandeur = { nom: dem, at: t0 };
      p.hist = [{ at: t0, statut: 'Demandé', par: dem, note: 'Demande de permis créée' }];
      if (idx >= 1) { var tp = cl(o.tPrep || shift(p.debut, -14)); p.hist.push({ at: tp, statut: 'Préparé', par: p.site === 'POG' ? N(37) : N(34), note: 'Analyse de risques, mesures de sécurité et EPI renseignés' }); }
      if (idx >= 2) { var ta = cl(shift(p.debut, -0.75)); p.sig.emetteur = { nom: emi, at: ta }; p.sig.responsable = { nom: res, at: cl(shift(ta, 0.1)) }; p.hist.push({ at: ta, statut: 'Autorisé', par: emi, note: 'Autorisé par l\'émetteur HSE et le responsable de zone' }); }
      if (idx >= 3) { p.sig.executant = { nom: p.executant, at: p.debut }; p.hist.push({ at: p.debut, statut: 'En cours', par: emi, note: 'Ouverture sur le terrain avec l\'exécutant — visite des lieux réalisée' }); }
      if (p.statut === 'Suspendu') p.hist.push({ at: p.suspension.at, statut: 'Suspendu', par: p.suspension.par, note: p.suspension.motif + ' — ' + p.suspension.note });
      if (p.statut === 'Clôturé') {
        var tc = shift(p.fin, -0.5);
        p.cloture = { at: tc, par: emi, retour: RETOUR.map(function (r) { return r[0]; }), obs: o.obsCloture || 'Zone restituée propre, aucune anomalie.' };
        p.sig.cloture = { nom: emi, at: tc };
        p.hist.push({ at: tc, statut: 'Clôturé', par: emi, note: 'Retour d\'état : travaux terminés, zone propre' });
      }
      return p;
    }
    var EMS = 'Obame Nzé Rufin (chef d\'équipe Estuaire Marine Services)';
    var permis = [
      build({ id: PT(405), type: 'FEU', statut: 'En cours', unite: 'OWE-P3', equipement: 'Poste 3 · platines d\'ancrage des nouvelles défenses', ot: OT(437), entreprise: 'F-001', intervenants: 4,
        description: 'Soudure des platines d\'ancrage des nouvelles défenses d\'accostage sur le mur de quai du poste 3 (projet DEF-P3).',
        demandeur: M(25), emetteur: M(34), responsable: M(14), surveillant: M(33), executant: EMS, debut: HB(-2), fin: HB(8),
        dangers: ['noyade', 'brulure', 'coactivite', 'charge'], mesuresRisques: 'Poste 3 neutralisé au plan de quai, nacelle flottante amarrée, gilets de sauvetage, bâches ignifugées, extincteurs à poste, embarcation de sécurité en veille.',
        secu: all('FEU', ['gilet', 'vhf']), epi: epi('FEU', ['gilet']), associes: [PT(406)],
        gaz: [g(HB(-3), 'Préparation', 20.9, 0, 0, 1, N(33), 'Mur de quai, platine n° 2'), g(HB(-2), 'Ouverture', 20.9, 0, 0, 1, N(33), 'Mur de quai, platine n° 2'), g(HB(0), 'Contrôle', 20.9, 0, 0, 2, N(33), 'Platine n° 4')] }),
      build({ id: PT(406), type: 'PLG', statut: 'En cours', unite: 'OWE-P3', equipement: 'Mur de quai du poste 3 · ancrages immergés', ot: OT(437), entreprise: 'F-001', intervenants: 4,
        description: 'Inspection subaquatique des ancrages et des palplanches du poste 3 par une équipe de 3 plongeurs.',
        demandeur: M(25), emetteur: M(34), responsable: M(14), surveillant: M(13), executant: 'Mbourou Serge (chef plongeur, Estuaire Marine Services)', debut: HB(-3), fin: HB(4),
        dangers: ['noyade', 'meteo', 'coactivite'], mesuresRisques: 'Aucun mouvement de navire au poste 3 et aux postes voisins pendant les plongées, pavillon Alpha hissé, veille VHF canal 12, vedette de sécurité.',
        secu: all('PLG', ['balisage']), epi: ['plongee', 'gilet'], associes: [PT(405)] }),
      build({ id: PT(408), type: 'LEV', statut: 'En cours', unite: 'OWE-P2', equipement: 'Grue mobile n° 2 · remplacement du câble de levage', ot: OT(516), entreprise: 'INT', intervenants: 5,
        description: 'Dépose et remplacement du câble de levage de la grue mobile n° 2 (usure constatée au contrôle hebdomadaire).',
        demandeur: M(3), emetteur: M(34), responsable: M(14), executant: 'Boussougou Cédric (mécanicien engins)', debut: HB(-1), fin: HB(6),
        dangers: ['charge', 'chute', 'circulation', 'energie'], mesuresRisques: 'Grue consignée hors opérations, zone balisée sur 30 m, plan de manutention validé, vent < 50 km/h.',
        secu: all('LEV'), epi: epi('LEV') }),
      build({ id: PT(409), type: 'H2S', statut: 'En cours', unite: 'OWE-P4', equipement: 'Poste pétrolier · joint de la ligne de déchargement DN250', ot: OT(522), entreprise: 'INT', intervenants: 3,
        description: 'Remplacement d\'un joint sur la ligne de déchargement du poste pétrolier avant l\'arrivée du MT Ogooué Star.',
        demandeur: M(0), emetteur: M(6), responsable: M(0), surveillant: M(33), executant: N(10), debut: HB(-1), fin: HB(5),
        dangers: ['hc', 'atex', 'energie', 'noyade'], mesuresRisques: 'Ligne vidangée et purgée, bac de rétention sous la bride, barrage antipollution prépositionné, outillage antidéflagrant.',
        secu: all('H2S'), epi: epi('H2S'),
        gaz: [g(HB(-2), 'Préparation', 20.9, 0, 0.4, 0, N(33), 'Bride ligne DN250'), g(HB(-1), 'Ouverture', 20.9, 0, 0.2, 0, N(33), 'Bride ligne DN250')] }),
      build({ id: PT(410), type: 'BORD', statut: 'En cours', unite: 'OWE-P1', equipement: 'MV Atlantic Akanda (à quai) · saisissage des conteneurs en pontée', ot: OT(519), entreprise: 'INT', intervenants: 6,
        description: 'Reprise du saisissage de conteneurs déplacés en pontée, en coordination avec le second capitaine du navire.',
        demandeur: M(14), emetteur: M(34), responsable: M(14), executant: 'Équipe de quai B (chef : Mouketou Gaël)', debut: HB(-3), fin: HB(4),
        dangers: ['chute', 'charge', 'coactivite', 'noyade'], mesuresRisques: 'Accord écrit du commandant, opérations de grue suspendues sur la baie concernée, harnais sur les passerelles de saisissage.',
        secu: all('BORD', ['harnais']), epi: epi('BORD', ['harnais']) }),
      build({ id: PT(403), type: 'HAU', statut: 'Suspendu', unite: 'OWE-PARC', equipement: 'Mât d\'éclairage n° 7 · projecteurs (nacelle 25 m)', ot: OT(488), entreprise: 'F-004', intervenants: 3,
        description: 'Remplacement de quatre projecteurs LED en tête du mât n° 7 du parc à conteneurs, à la nacelle.',
        demandeur: M(23), emetteur: M(34), responsable: M(20), executant: 'Mbadinga Serge (électricien, Gabon Électro-Tech)', debut: HB(-4), fin: HB(6),
        dangers: ['chute', 'elec', 'circulation', 'meteo'], mesuresRisques: 'Nacelle vérifiée, harnais double longe, zone balisée et interdite aux reach stackers, arrêt si vent > 50 km/h ou orage.',
        secu: all('HAU', ['radio']), epi: epi('HAU'),
        suspension: { at: cl(HB(-1)), par: N(34), motif: 'Alerte météo (orage, vent)', note: 'Orage annoncé par la capitainerie — nacelle descendue, équipe à l\'abri.' } }),
      build({ id: PT(404), type: 'ESP', statut: 'Autorisé', unite: 'POG-SOUT', equipement: 'Barge de soutage Mandji · citerne n° 2', ot: OT(527), entreprise: 'INT', intervenants: 3,
        description: 'Inspection visuelle de la citerne n° 2 de la barge de soutage après dégazage (contrôle annuel).',
        demandeur: M(37), emetteur: M(36), responsable: M(37), surveillant: M(38), executant: N(38), debut: HB(3), fin: HB(9),
        dangers: ['anoxie', 'atex', 'hc', 'chute'], mesuresRisques: 'Citerne vidée, dégazée et ventilée 24 h, contrôle atmosphère avant chaque entrée, veilleur au trou d\'homme, trépied et treuil de sauvetage.',
        secu: all('ESP', ['balisage']), epi: epi('ESP'), tPrep: HB(-5),
        gaz: [g(HB(-1), 'Préparation', 20.8, 0, 0, 2, N(38), 'Trou d\'homme citerne n° 2')] }),
      build({ id: PT(411), type: 'LOTO', statut: 'Autorisé', unite: 'OWE-PARC', equipement: 'Armoire de prises frigorifiques R12', ot: OT(531), entreprise: 'INT', intervenants: 2,
        description: 'Consignation électrique de l\'armoire R12 pour remplacement de 6 prises pour conteneurs frigorifiques.',
        demandeur: M(23), emetteur: M(34), responsable: M(20), executant: N(23), debut: dayAt(1, 6), fin: dayAt(1, 18),
        dangers: ['elec', 'energie', 'circulation'], mesuresRisques: 'Consignation en 4 étapes (séparation, condamnation, identification, VAT), conteneurs frigorifiques rebranchés sur la rangée R13.',
        secu: all('LOTO'), epi: epi('LOTO'), tPrep: HB(-6) }),
      build({ id: PT(412), type: 'FEU', statut: 'Préparé', unite: 'OWE-ATL', equipement: 'Reach stacker RS-01 · renfort de châssis', ot: OT(509), entreprise: 'F-008', intervenants: 2,
        description: 'Soudure d\'un renfort sur le châssis du reach stacker RS-01 à l\'atelier engins.',
        demandeur: M(22), emetteur: M(34), responsable: M(3), surveillant: M(33), executant: 'Mabika Fernand (soudeur, Engins Services Afrique)', debut: dayAt(1, 7), fin: dayAt(1, 16),
        dangers: ['brulure', 'hc', 'energie'], mesuresRisques: 'Réservoir et circuits hydrauliques protégés, engin nettoyé et dégraissé, extincteur 9 kg et surveillant feu.',
        secu: all('FEU'), epi: epi('FEU'), tPrep: HB(-1),
        gaz: [g(HB(-1), 'Préparation', 20.9, 0, 0, 0, N(33), 'Châssis RS-01')] }),
      build({ id: PT(415), type: 'FEU', statut: 'Préparé', unite: 'OWE-RADE', equipement: 'Remorqueur Komo (à flot) · tôle de bordé', ot: OT(514), entreprise: 'F-001', intervenants: 2,
        description: 'Reprise par soudure d\'une tôle de bordé enfoncée au-dessus de la flottaison, remorqueur à couple.',
        demandeur: M(9), emetteur: M(34), responsable: M(9), surveillant: M(11), executant: EMS, debut: dayAt(1, 8), fin: dayAt(1, 16),
        dangers: ['atex', 'hc', 'brulure', 'noyade'], mesuresRisques: 'Soute à gasoil adjacente à dégazer avant les travaux — nouvelle mesure LIE exigée après inertage.',
        secu: all('FEU', ['gilet']), epi: epi('FEU', ['gilet']), tPrep: HB(-2),
        gaz: [g(HB(-1), 'Préparation', 20.9, 3, 0, 0, N(34), 'Soute à gasoil bâbord')] }),
      build({ id: PT(413), type: 'GEN', statut: 'Préparé', unite: 'OWE-P3', equipement: 'Poste 3 · remplacement de deux bollards', ot: OT(437), entreprise: 'F-001', intervenants: 4,
        description: 'Dépose des bollards corrodés n° 5 et n° 6 et mise en place des bollards 50 t neufs.',
        demandeur: M(25), emetteur: M(34), responsable: M(14), executant: EMS, debut: dayAt(1, 8), fin: dayAt(1, 16),
        dangers: ['noyade', 'charge', 'coactivite'], mesuresRisques: 'Bord à quai balisé, gilets de sauvetage obligatoires, bouées à poste.',
        secu: all('GEN', ['gilet']), epi: epi('GEN', ['gilet']), tPrep: HB(-3) }),
      build({ id: PT(416), type: 'ESP', statut: 'Demandé', unite: 'OWE-P1', equipement: 'MV Atlantic Akanda · cale n° 2', ot: OT(533), entreprise: 'INT', intervenants: 3,
        description: 'Descente en cale pour reprendre un conteneur effondré sur la rangée basse avant déchargement.',
        demandeur: M(14), emetteur: M(34), responsable: M(14), debut: dayAt(0, 20), fin: dayAt(1, 4), cree: HB(-2) }),
      build({ id: PT(417), type: 'BORD', statut: 'Demandé', unite: 'POG-QC', equipement: 'PSV Offshore Mandji · treuil de pont', ot: OT(535), entreprise: 'F-006', intervenants: 3,
        description: 'Remplacement du moteur hydraulique du treuil de pont du ravitailleur, à quai à Port-Gentil.',
        demandeur: M(41), emetteur: M(36), responsable: M(41), debut: dayAt(1, 13), fin: dayAt(1, 19), cree: HB(-2) }),
      build({ id: PT(419), type: 'H2S', statut: 'En cours', unite: 'POG-SOUT', equipement: 'Appontement de soutage · flexible de livraison n° 2', ot: OT(540), entreprise: 'INT', intervenants: 3,
        description: 'Remplacement du joint du raccord rapide du flexible de soutage n° 2 avant la livraison au PSV Offshore Mandji.',
        demandeur: M(37), emetteur: M(36), responsable: M(37), surveillant: M(38), executant: N(38), debut: HB(-2), fin: HB(4),
        dangers: ['hc', 'atex', 'noyade', 'energie'], mesuresRisques: 'Ligne vidangée et isolée, barrage flottant déployé autour de l\'appontement, kit antipollution à poste, outillage antidéflagrant.',
        secu: all('H2S', ['gilet']), epi: epi('H2S', ['gilet']),
        gaz: [g(HB(-3), 'Préparation', 20.9, 0, 0.3, 0, N(38), 'Raccord flexible n° 2'), g(HB(-2), 'Ouverture', 20.9, 0, 0.1, 0, N(38), 'Raccord flexible n° 2')] }),
      build({ id: PT(420), type: 'LEV', statut: 'En cours', unite: 'POG-QB', equipement: 'Quai B · modules offshore de 28 t pour le PSV Ogooué Supplier', ot: OT(542), entreprise: 'F-006', intervenants: 5,
        description: 'Chargement de deux modules de 28 t sur le pont du ravitailleur offshore avec la grue de Mandji Transports.',
        demandeur: M(41), emetteur: M(36), responsable: M(41), executant: 'Nziengui Arsène (chef de manœuvre Mandji Transports)', debut: HB(-1), fin: HB(7),
        dangers: ['charge', 'coactivite', 'noyade', 'meteo'], mesuresRisques: 'Plan de levage validé, zone d\'évolution balisée, navire amarré et stabilisé, arrêt si vent > 40 km/h.',
        secu: all('LEV', ['gilet']), epi: epi('LEV', ['gilet']) }),
      build({ id: PT(418), type: 'HAU', statut: 'Demandé', unite: 'OWE-P2', equipement: 'Grue mobile n° 1 · poulies en tête de flèche', ot: OT(538), entreprise: 'INT', intervenants: 3,
        description: 'Contrôle et graissage des poulies en tête de flèche (flèche abaissée sur chevalet).',
        demandeur: M(3), emetteur: M(34), responsable: M(14), debut: dayAt(2, 7), fin: dayAt(2, 15), cree: HB(-1) }),
      build({ id: PT(398), type: 'FOU', statut: 'Clôturé', unite: 'OWE-PARC', equipement: 'Terre-plein zone B · réseau électrique reefer', ot: OT(480), entreprise: 'F-001', intervenants: 4,
        description: 'Fouille pour le passage des câbles d\'alimentation des nouvelles prises frigorifiques.', demandeur: M(25), emetteur: M(34), responsable: M(20), executant: EMS, debut: dayAt(-5, 7), fin: dayAt(-5, 16),
        dangers: ['circulation', 'elec', 'coactivite'], mesuresRisques: 'Plans des réseaux consultés, détection de câbles, barrières, déviation des reach stackers.', secu: all('FOU'), epi: epi('FOU') }),
      build({ id: PT(399), type: 'FEU', statut: 'Clôturé', unite: 'OWE-P3', equipement: 'Poste 3 · échelle de quai n° 4', ot: OT(470), entreprise: 'F-001', intervenants: 2,
        description: 'Remplacement par soudure de l\'échelle de quai n° 4 corrodée.', demandeur: M(25), emetteur: M(34), responsable: M(14), surveillant: M(33), executant: EMS, debut: dayAt(-4, 7), fin: dayAt(-4, 17),
        dangers: ['noyade', 'brulure'], mesuresRisques: 'Nacelle flottante, gilets, surveillant feu.', secu: all('FEU', ['gilet']), epi: epi('FEU', ['gilet']),
        gaz: [g(dayAt(-4, 6, 30), 'Préparation', 20.9, 0, 0, 0, N(33)), g(dayAt(-4, 7), 'Ouverture', 20.9, 0, 0, 0, N(33)), g(dayAt(-4, 12), 'Contrôle', 20.9, 0, 0, 1, N(33))] }),
      build({ id: PT(400), type: 'LOTO', statut: 'Clôturé', unite: 'OWE-MAG', equipement: 'Poste de transformation du magasin · cellule HT', ot: OT(462), entreprise: 'F-004', intervenants: 2,
        description: 'Consignation de la cellule HT pour remplacement du disjoncteur.', demandeur: M(23), emetteur: M(34), responsable: M(3), executant: 'Mbadinga Serge (électricien habilité, Gabon Électro-Tech)', debut: dayAt(-3, 6), fin: dayAt(-3, 15),
        dangers: ['elec', 'energie'], mesuresRisques: 'Consignation par chargé de consignation habilité, VAT, mise à la terre et en court-circuit.', secu: all('LOTO'), epi: epi('LOTO') }),
      build({ id: PT(401), type: 'GEN', statut: 'Clôturé', unite: 'OWE-MAG', equipement: 'Bureau d\'exploitation · climatisation', ot: OT(455), entreprise: 'INT', intervenants: 1,
        description: 'Remplacement du compresseur de climatisation du bureau d\'exploitation.', demandeur: M(23), emetteur: M(34), responsable: M(3), executant: N(23), debut: dayAt(-6, 8), fin: dayAt(-6, 12),
        dangers: ['elec', 'chute'], mesuresRisques: 'Alimentation consignée, escabeau conforme.', secu: all('GEN'), epi: epi('GEN') }),
      build({ id: PT(402), type: 'LEV', statut: 'Clôturé', unite: 'POG-QC', equipement: 'Colis offshore 45 t · PSV Ogooué Supplier', ot: OT(451), entreprise: 'F-006', intervenants: 5,
        description: 'Levage d\'un module offshore de 45 t du quai vers le pont du ravitailleur.', demandeur: M(41), emetteur: M(36), responsable: M(41), executant: 'Nziengui Arsène (chef de manœuvre Mandji Transports)', debut: dayAt(-7, 7), fin: dayAt(-7, 18),
        dangers: ['charge', 'coactivite', 'noyade'], mesuresRisques: 'Plan de levage validé, grue 100 t, balisage, élingues contrôlées, navire amarré et stabilisé.', secu: all('LEV'), epi: epi('LEV') })
    ];

    var plans = [
      { id: 'PDP-' + Y + '-031', entreprise: 'F-001', travaux: 'Remplacement des défenses et bollards du poste 3 (soudure, levage, plongée)', chantier: 'Projet DEF-P3 — défenses du poste 3', zones: ['OWE-P3'], debut: D(-40), fin: D(12), effectif: 12, respEE: 'Rufin Obame Nzé (conducteur de travaux)', respSOG: M(25), statut: 'Actif',
        inspection: { date: D(-43), participants: [N(6) + ' (HSE & sûreté)', N(25) + ' (Infrastructures)', N(14) + ' (Chef de quai)', 'Rufin Obame Nzé (Estuaire Marine Services)'], obs: 'Accès par la porte n° 2 sur badge ISPS. Aire de stockage des défenses définie derrière le poste 3. Poste neutralisé au plan de quai.' },
        interferences: [{ risque: 'Mouvements de navires aux postes voisins pendant les plongées', mesure: 'Information de la capitainerie, pavillon Alpha, aucun mouvement au poste 2 et 4 pendant les plongées', charge: 'GPM' }, { risque: 'Chute à l\'eau des intervenants', mesure: 'Gilets de sauvetage, bouées à poste, embarcation de sécurité', charge: 'EE' }, { risque: 'Circulation des engins de manutention', mesure: 'Zone de chantier clôturée, homme trafic lors des livraisons', charge: 'EE' }],
        habilitations: [{ l: 'Soudeurs qualifiés', ok: true }, { l: 'Plongeurs certifiés classe II', ok: true }, { l: 'Aptitude médicale à jour', ok: true }, { l: 'Sensibilisation sûreté ISPS et badges d\'accès', ok: true }],
        accueil: { date: D(-39), personnes: 12 }, sig: { gpm: { nom: N(6), at: D(-42) }, ee: { nom: 'Rufin Obame Nzé', at: D(-42) } } },
      { id: 'PDP-' + Y + '-029', entreprise: 'F-004', travaux: 'Réseau électrique, prises frigorifiques et éclairage du parc à conteneurs', chantier: 'Projet PARC-OWE — réhabilitation du parc', zones: ['OWE-PARC'], debut: D(-55), fin: D(5), effectif: 9, respEE: 'Serge Mbadinga (chargé d\'affaires)', respSOG: M(23), statut: 'Actif',
        inspection: { date: D(-58), participants: [N(34) + ' (HSE)', N(23) + ' (Électricité)', N(20) + ' (Parc à conteneurs)', 'Serge Mbadinga (Gabon Électro-Tech)'], obs: 'Travaux par zones balisées, plan de circulation provisoire des reach stackers.' },
        interferences: [{ risque: 'Coactivité avec les reach stackers', mesure: 'Zones de travail clôturées, plan de circulation provisoire', charge: 'GPM' }, { risque: 'Risque électrique', mesure: 'Consignations par chargé de consignation habilité', charge: 'EE' }],
        habilitations: [{ l: 'Habilitations électriques', ok: true }, { l: 'Aptitude médicale à jour', ok: true }, { l: 'Travail en hauteur (nacelle)', ok: true }],
        accueil: { date: D(-54), personnes: 9 }, sig: { gpm: { nom: N(6), at: D(-57) }, ee: { nom: 'Serge Mbadinga', at: D(-57) } } },
      { id: 'PDP-' + Y + '-032', entreprise: 'F-008', travaux: 'Maintenance des reach stackers à l\'atelier engins (contrat annuel)', chantier: 'Contrat de maintenance engins de parc', zones: ['OWE-ATL', 'OWE-PARC'], debut: D(-20), fin: D(35), effectif: 5, respEE: 'Fernand Mabika (chef d\'atelier)', respSOG: M(3), statut: 'Actif',
        inspection: { date: D(-24), participants: [N(34) + ' (HSE)', N(3) + ' (Technique)', N(22) + ' (Mécanique engins)', 'Fernand Mabika (Engins Services Afrique)'], obs: 'Essais des engins réparés uniquement sur l\'aire d\'essai balisée.' },
        interferences: [{ risque: 'Essais d\'engins dans le parc en exploitation', mesure: 'Aire d\'essai dédiée, gyrophare et homme trafic', charge: 'EE' }, { risque: 'Fuites hydrauliques', mesure: 'Bacs de rétention et kits absorbants à l\'atelier', charge: 'GPM' }],
        habilitations: [{ l: 'CACES R489 / autorisation de conduite', ok: true }, { l: 'Aptitude médicale à jour', ok: true }],
        accueil: { date: D(-19), personnes: 5 }, sig: { gpm: { nom: N(6), at: D(-23) }, ee: { nom: 'Fernand Mabika', at: D(-23) } } },
      { id: 'PDP-' + Y + '-034', entreprise: 'F-010', travaux: 'Levé hydrographique et préparation du dragage du chenal de Port-Gentil', chantier: 'Projet DRAG — dragage d\'entretien', zones: ['POG-QC'], debut: D(5), fin: D(75), effectif: 6, respEE: 'Samuel Ekane (hydrographe)', respSOG: M(36), statut: 'Signé',
        inspection: { date: D(-6), participants: [N(6) + ' (HSE & sûreté)', N(36) + ' (Agence de Port-Gentil)', N(39) + ' (Pilotage)', 'Samuel Ekane (Hydro Survey Africa)'], obs: 'Programme de levés transmis à la capitainerie ; veille VHF obligatoire.' },
        interferences: [{ risque: 'Croisement avec les navires en manœuvre dans le chenal', mesure: 'Avis aux navigateurs, coordination quotidienne avec les pilotes', charge: 'GPM' }, { risque: 'Chute à l\'eau', mesure: 'Gilets, homme de veille, embarcation conforme', charge: 'EE' }],
        habilitations: [{ l: 'Certificats de navigation de l\'équipage', ok: true }, { l: 'Aptitude médicale à jour', ok: true }, { l: 'Badges d\'accès ISPS', ok: true }],
        accueil: { date: '', personnes: 3 }, sig: { gpm: { nom: N(6), at: D(-4) }, ee: { nom: 'Samuel Ekane', at: D(-4) } } },
      { id: 'PDP-' + Y + '-035', entreprise: 'F-006', travaux: 'Location de grue de renfort et levages lourds pendant la révision de la grue n° 1', chantier: 'Projet GR-REV — révision de la grue n° 1', zones: ['OWE-P1', 'OWE-P2'], debut: D(3), fin: D(40), effectif: 4, respEE: 'Arsène Nziengui (chef de manœuvre)', respSOG: M(14), statut: 'Inspection commune',
        inspection: { date: D(-2), participants: [N(34) + ' (HSE)', N(14) + ' (Chef de quai)', 'Arsène Nziengui (Mandji Transports)'], obs: 'Calage de la grue sur plaques de répartition ; vérifier la portance du quai au poste 2.' },
        interferences: [{ risque: 'Charges suspendues au-dessus des équipes de quai', mesure: 'Plans de levage validés, zone d\'évolution balisée', charge: 'EE' }, { risque: 'Circulation de la grue sur le terre-plein', mesure: 'Escorte et itinéraire validés par l\'exploitation', charge: 'GPM' }],
        habilitations: [{ l: 'CACES grue mobile / autorisation de conduite', ok: true }, { l: 'Élingueurs habilités', ok: true }, { l: 'Rapport de vérification périodique de la grue', ok: false }, { l: 'Aptitude médicale à jour', ok: true }],
        accueil: { date: '', personnes: 0 }, sig: {} },
      { id: 'PDP-' + Y + '-036', entreprise: 'F-002', travaux: 'Assistance technique constructeur pour la révision de la grue n° 1', chantier: 'Projet GR-REV — révision de la grue n° 1', zones: ['OWE-P2', 'OWE-ATL'], debut: D(20), fin: D(75), effectif: 3, respEE: 'Jonas Becker (technicien constructeur)', respSOG: M(3), statut: 'Brouillon',
        inspection: { date: '', participants: [], obs: '' }, interferences: [{ risque: 'Travail en hauteur sur la flèche', mesure: 'Flèche abaissée sur chevalet, nacelle et harnais', charge: 'EE' }],
        habilitations: [{ l: 'Habilitation électrique', ok: false }, { l: 'Badges d\'accès ISPS (personnel étranger)', ok: false }, { l: 'Aptitude médicale à jour', ok: true }], accueil: { date: '', personnes: 0 }, sig: {} },
      { id: 'PDP-' + Y + '-028', entreprise: 'F-007', travaux: 'Vérification des extincteurs, bouées et moyens de sauvetage des quais', chantier: 'Contrat annuel de maintenance sécurité', zones: ['OWE-P1', 'OWE-P2', 'OWE-P3', 'OWE-P4', 'OWE-PARC', 'OWE-MAG'], debut: D(-100), fin: D(-8), effectif: 3, respEE: 'Lionel Bouanga (technicien sécurité)', respSOG: M(34), statut: 'Actif',
        inspection: { date: D(-104), participants: [N(34) + ' (HSE)', N(33) + ' (Sûreté)', 'Lionel Bouanga (Sécurité Pro Gabon)'], obs: 'Intervention par zone, information du bureau d\'exploitation avant chaque intervention à quai.' },
        interferences: [{ risque: 'Retrait temporaire de moyens de sauvetage', mesure: 'Remplacement immédiat par du matériel de prêt', charge: 'EE' }],
        habilitations: [{ l: 'Formation incendie', ok: true }, { l: 'Aptitude médicale à jour', ok: true }], accueil: { date: D(-99), personnes: 3 }, sig: { gpm: { nom: N(6), at: D(-103) }, ee: { nom: 'Lionel Bouanga', at: D(-103) } } },
      { id: 'PDP-' + Y + '-037', entreprise: 'F-006', travaux: 'Levages et manutention de colis offshore aux quais A et B (contrat cadre)', chantier: 'Contrat cadre de levage offshore — Port-Gentil', zones: ['POG-QB', 'POG-QC'], debut: D(-30), fin: D(60), effectif: 7, respEE: 'Arsène Nziengui (chef de manœuvre)', respSOG: M(41), statut: 'Actif',
        inspection: { date: D(-33), participants: [N(36) + ' (Chef d\'agence)', N(41) + ' (Chef de quai)', 'Arsène Nziengui (Mandji Transports)'], obs: 'Calage des grues sur plaques de répartition au quai B ; coordination avec les ravitailleurs offshore.' },
        interferences: [{ risque: 'Charges suspendues au-dessus des ravitailleurs et des équipes de quai', mesure: 'Plans de levage validés, zone d\'évolution balisée, liaison VHF avec la passerelle', charge: 'EE' }, { risque: 'Coactivité avec le soutage à l\'appontement voisin', mesure: 'Planning partagé avec le service soutage, aucune opération simultanée au droit de l\'appontement', charge: 'GPM' }],
        habilitations: [{ l: 'CACES grue mobile / autorisation de conduite', ok: true }, { l: 'Élingueurs habilités', ok: true }, { l: 'Aptitude médicale à jour', ok: true }, { l: 'Badges d\'accès ISPS', ok: true }],
        accueil: { date: D(-29), personnes: 7 }, sig: { gpm: { nom: N(36), at: D(-32) }, ee: { nom: 'Arsène Nziengui', at: D(-32) } } }
    ];
    plans.forEach(function (p) { p.site = siteOf(p.zones[0]); });

    function ev(o) {
      var d = D(o.off);
      return Object.assign({ id: 'EV-' + d.slice(0, 4) + '-' + String(o.n).padStart(3, '0'), date: d, heure: o.h || '10:30', joursArret: 0, victime: '', causes: null, mesuresImm: '' }, o, { off: undefined, n: undefined });
    }
    var incidents = [
      ev({ n: 41, off: -352, type: 'ASA', gravite: 2, unite: 'OWE-P2', lieu: 'Bord à quai, poste 2', titre: 'Glissade sur le quai mouillé pendant le lamanage', description: 'Un lamaneur a glissé sur le quai mouillé en capelant une aussière. Contusion au genou, soins à l\'infirmerie, reprise du poste.', victime: M(12), declarant: M(14), statut: 'Clôturé', h: '06:40', mesuresImm: 'Balisage, rappel du port des chaussures antidérapantes.' }),
      ev({ n: 44, off: -318, type: 'PA', gravite: 3, unite: 'OWE-PARC', lieu: 'Parc à conteneurs · rangée C', titre: 'Chute d\'un twistlock depuis une pile de conteneurs', description: 'Un twistlock oublié sur le toit d\'un conteneur est tombé lors d\'une reprise par reach stacker, à 2 m d\'un pointeur.', declarant: M(20), statut: 'Clôturé', h: '14:15', mesuresImm: 'Arrêt des opérations sur la rangée, balisage.',
        causes: { methode: '5 pourquoi', pourquoi: ['Le twistlock est tombé du conteneur', 'Il était resté posé sur le toit', 'Le dessaisissage à bord n\'a pas été vérifié', 'Pas de contrôle visuel au poser sur le terre-plein', 'Consigne de contrôle des toits non formalisée'], racine: 'Absence de contrôle formalisé des toits de conteneurs au déchargement.' } }),
      ev({ n: 46, off: -301, type: 'AAA', gravite: 3, unite: 'OWE-P1', lieu: 'Échelle de coupée d\'un porte-conteneurs', titre: 'Entorse de la cheville sur l\'échelle de coupée', description: 'Un pointeur a manqué une marche en descendant l\'échelle de coupée d\'un navire à quai. Entorse de la cheville droite, 6 jours d\'arrêt.', victime: M(19), joursArret: 6, declarant: M(14), statut: 'Clôturé', h: '22:10',
        causes: { methode: 'Arbre des causes', facteurs: { 'Main-d\'œuvre': ['Descente avec une tablette en main'], 'Matériel': ['Échelle de coupée mal éclairée'], 'Milieu': ['Marée descendante, forte pente de l\'échelle'], 'Méthode': ['Pas de consigne « trois points d\'appui »'], 'Management': [] } } }),
      ev({ n: 49, off: -270, type: 'POL', gravite: 2, unite: 'POG-SOUT', lieu: 'Appontement de soutage', titre: 'Fuite sur un flexible de soutage', description: 'Fuite de gasoil marin sur le raccord d\'un flexible pendant une livraison à un ravitailleur. Environ 150 L récupérés dans le bac de rétention, quelques litres en mer contenus par le barrage.', declarant: M(37), statut: 'Clôturé', h: '03:25', mesuresImm: 'Arrêt du pompage, fermeture des vannes, barrage flottant et absorbants.' }),
      ev({ n: 52, off: -240, type: 'HMM', gravite: 4, unite: 'OWE-P3', lieu: 'Poste 3 · amarrage d\'un roulier', titre: 'Homme à la mer lors de l\'amarrage', description: 'Un lamaneur a été entraîné à l\'eau par une aussière lors de l\'amarrage d\'un roulier. Récupéré en 3 minutes par la vedette d\'amarrage ; il portait son gilet de sauvetage. Indemne, examen médical.', declarant: M(13), statut: 'Clôturé', h: '05:50', mesuresImm: 'Récupération par la vedette, alerte capitainerie, examen médical.',
        causes: { methode: '5 pourquoi', pourquoi: ['Le lamaneur a été entraîné à l\'eau', 'Il se tenait dans la boucle de l\'aussière', 'La zone de danger de fouet n\'était pas marquée au sol', 'L\'équipe était réduite à deux lamaneurs', 'Le planning ne tenait pas compte des arrivées simultanées'], racine: 'Effectif de lamanage insuffisant lors des arrivées simultanées et zones de danger non matérialisées.' } }),
      ev({ n: 55, off: -205, type: 'FEU', gravite: 3, unite: 'OWE-ATL', lieu: 'Atelier engins', titre: 'Départ de feu sur un reach stacker', description: 'Inflammation d\'huile hydraulique sur le collecteur d\'échappement d\'un reach stacker. Feu éteint à l\'extincteur par le conducteur en 2 minutes.', declarant: M(18), statut: 'Clôturé', h: '16:50', mesuresImm: 'Extinction, engin immobilisé, inspection des flexibles.',
        causes: { methode: '5 pourquoi', pourquoi: ['L\'huile a pris feu', 'Elle s\'écoulait sur l\'échappement', 'Un flexible était fissuré', 'La fissure n\'avait pas été détectée', 'Les flexibles ne sont pas contrôlés à la prise de poste'], racine: 'Contrôle de prise de poste incomplet sur les engins.' } }),
      ev({ n: 58, off: -187, type: 'AAA', gravite: 3, unite: 'OWE-P2', lieu: 'Sous la grue mobile n° 1', titre: 'Main écrasée lors de l\'élingage d\'un colis', description: 'Écrasement de la main gauche entre l\'élingue et un colis conventionnel lors de la mise en tension. 12 jours d\'arrêt.', victime: M(17), joursArret: 12, declarant: M(14), statut: 'Clôturé', h: '11:20',
        causes: { methode: 'Arbre des causes', facteurs: { 'Main-d\'œuvre': ['Main posée sur l\'élingue à la mise en tension'], 'Méthode': ['Absence de cordes de guidage'], 'Matériel': ['Élingue trop courte pour le colis'], 'Milieu': ['Fin de shift, cadence élevée'], 'Management': ['Escale serrée, pression sur la cadence'] } } }),
      ev({ n: 61, off: -160, type: 'ENV', gravite: 2, unite: 'OWE-RADE', lieu: 'Rade d\'Owendo', titre: 'Irisations en rade après un déballastage', description: 'Irisations sur environ 200 m observées par la vedette de pilotage après le passage d\'un navire. Rapport transmis à la capitainerie (MARPOL annexe I).', declarant: M(7), statut: 'Clôturé', h: '07:30', mesuresImm: 'Photographies, prélèvements, information de l\'autorité maritime.' }),
      ev({ n: 64, off: -128, type: 'CHUTE', gravite: 4, unite: 'OWE-P1', lieu: 'Poste 1 · sous la grue n° 2', titre: 'Chute d\'un conteneur de 20 pieds au déchargement', description: 'Un conteneur s\'est décroché du spreader à 3 m de hauteur (twistlock non verrouillé). Aucun blessé : la zone sous charge était dégagée.', declarant: M(14), statut: 'Clôturé', h: '05:10',
        causes: { methode: '5 pourquoi', pourquoi: ['Le conteneur s\'est décroché', 'Un twistlock n\'était pas verrouillé', 'Le voyant de verrouillage était défectueux', 'Le défaut n\'avait pas été signalé', 'Pas de test des voyants à la prise de poste'], racine: 'Test des sécurités du spreader non intégré au contrôle de prise de poste.' } }),
      ev({ n: 67, off: -96, type: 'ASA', gravite: 2, unite: 'OWE-MAG', lieu: 'Magasin cale', titre: 'Coupure à l\'avant-bras en manutention de feuillards', description: 'Coupure superficielle lors de la manutention de colis cerclés sans manchettes. Soins à l\'infirmerie.', victime: M(21), declarant: M(4), statut: 'Clôturé', h: '10:05' }),
      ev({ n: 70, off: -70, type: 'SD', gravite: 3, unite: 'OWE-PARC', lieu: 'Parc · zone B', titre: 'Piéton dans la zone d\'évolution des reach stackers', description: 'Un chauffeur de camion est descendu de sa cabine dans la zone d\'évolution des reach stackers pour vérifier un scellé.', declarant: M(20), statut: 'Actions en cours', h: '13:40', mesuresImm: 'Arrêt des engins, chauffeur raccompagné à sa cabine, rappel des consignes.' }),
      ev({ n: 73, off: -44, type: 'ABOR', gravite: 3, unite: 'OWE-P3', lieu: 'Poste 3', titre: 'Heurt de quai par un roulier à l\'accostage', description: 'Accostage trop rapide d\'un roulier : deux défenses endommagées et un bollard déformé. Pas de blessé, pas de pollution.', declarant: M(8), statut: 'Actions en cours', h: '08:15', mesuresImm: 'Poste 3 restreint, inspection des défenses, rapport du pilote.',
        causes: { methode: '5 pourquoi', pourquoi: ['Le navire a heurté le quai', 'La vitesse d\'approche était trop élevée', 'Un remorqueur était indisponible', 'Le remorqueur de secours était en révision', 'Planification des révisions sans tenir compte des escales de rouliers'], racine: 'Planification de la maintenance des remorqueurs non coordonnée avec le plan de quai.' } }),
      ev({ n: 76, off: -21, type: 'ASA', gravite: 1, unite: 'POG-QC', lieu: 'Quai commercial A', titre: 'Pincement de doigt au raccordement d\'une manche à eau douce', description: 'Pincement de l\'index lors du raccordement d\'une manche d\'eau douce au manifold d\'un ravitailleur. Soins sur place.', victime: M(38), declarant: M(37), statut: 'Actions en cours', h: '19:30' }),
      ev({ n: 79, off: -9, type: 'PA', gravite: 4, unite: 'OWE-P2', lieu: 'Poste 2', titre: 'Charge suspendue au-dessus d\'une équipe de pointeurs', description: 'Lors d\'une opération de grue, un conteneur est passé au-dessus de deux pointeurs non informés du changement de séquence.', declarant: M(34), statut: 'En analyse', h: '15:05', mesuresImm: 'Arrêt de la grue, briefing de l\'équipe, révision des zones d\'exclusion.',
        causes: { methode: 'Arbre des causes', facteurs: { 'Méthode': ['Zone d\'exclusion sous charge non balisée'], 'Management': ['Changement de séquence non communiqué'], 'Main-d\'œuvre': ['Signaleur sans visibilité directe'], 'Matériel': ['Radio du signaleur défaillante'], 'Milieu': ['Deux navires opérés simultanément'] } } }),
      ev({ n: 82, off: -3, type: 'POL', gravite: 2, unite: 'OWE-P4', lieu: 'Poste pétrolier', titre: 'Égouttures d\'hydrocarbures à la déconnexion d\'un flexible', description: 'Égouttures (environ 5 L) au moment de la déconnexion d\'un flexible du manifold d\'un pétrolier. Contenues sur le quai par absorbants.', declarant: M(0), statut: 'En analyse', h: '04:50', mesuresImm: 'Absorbants, nettoyage du quai, contrôle de la mer autour du poste.' }),
      ev({ n: 85, off: -1, type: 'SD', gravite: 2, unite: 'OWE-P1', lieu: 'Poste 1', titre: 'Bouée couronne manquante au poste 1', description: 'La bouée couronne du support n° 3 est absente (retirée pour remplacement sans matériel de prêt).', declarant: M(33), statut: 'Déclaré', h: '08:20' }),
      ev({ n: 88, off: -2, type: 'PA', gravite: 3, unite: 'POG-QB', lieu: 'Quai commercial B · pont d\'un ravitailleur', titre: 'Colis offshore balancé par la houle pendant le levage', description: 'Lors du chargement d\'un conteneur offshore, la houle a fait rouler le ravitailleur : le colis a balancé à moins d\'un mètre d\'un matelot resté sous la charge.', declarant: M(41), statut: 'Actions en cours', h: '16:40', mesuresImm: 'Arrêt du levage, reprise avec cordes de guidage et matelots dégagés de la zone.' })
    ];
    incidents.forEach(function (i) { i.site = siteOf(i.unite); });
    var A = function (n, src, lib, resp, ech, st, prio) { return { id: 'ACT-' + Y + '-' + String(n).padStart(3, '0'), source: src, libelle: lib, responsable: M(resp), echeance: D(ech), statut: st, priorite: prio || 'Moyenne', creee: D(Math.min(ech - 30, -2)) }; };
    var e = function (off, n) { return 'EV-' + D(off).slice(0, 4) + '-0' + n; };
    var actions = [
      A(112, e(-70, 70), 'Créer un parking chauffeurs et interdire la descente des cabines dans le parc', 20, -50, 'Réalisée', 'Haute'),
      A(113, e(-70, 70), 'Marquage au sol des allées piétonnes du parc à conteneurs', 20, -12, 'En cours', 'Haute'),
      A(118, e(-44, 73), 'Remplacer les défenses et le bollard endommagés du poste 3 (projet DEF-P3)', 25, 20, 'En cours', 'Haute'),
      A(119, e(-44, 73), 'Coordonner le planning de maintenance des remorqueurs avec le plan de quai', 9, -5, 'À faire', 'Moyenne'),
      A(120, e(-44, 73), 'Restreindre le poste 3 aux navires de moins de 150 m jusqu\'aux travaux', 0, -4, 'Réalisée', 'Haute'),
      A(124, e(-21, 76), 'Fournir des clés de raccordement adaptées aux manches d\'eau douce', 37, -3, 'À faire', 'Moyenne'),
      A(125, e(-21, 76), 'Mettre à jour le mode opératoire de livraison d\'eau douce', 37, 15, 'En cours', 'Basse'),
      A(127, e(-9, 79), 'Baliser systématiquement la zone d\'exclusion sous charge des grues', 14, 7, 'À faire', 'Haute'),
      A(128, e(-9, 79), 'Doter les signaleurs de radios de rechange', 4, -2, 'Réalisée', 'Haute'),
      A(130, e(-3, 82), 'Installer des bacs d\'égouttures sous les manifolds du poste pétrolier', 0, 10, 'À faire', 'Haute'),
      A(131, e(-1, 85), 'Remettre en place la bouée couronne du poste 1', 33, 1, 'À faire', 'Haute'),
      A(105, e(-128, 64), 'Intégrer le test des voyants du spreader au contrôle de prise de poste', 3, -100, 'Réalisée', 'Haute'),
      A(106, e(-128, 64), 'Former les grutiers aux défaillances du spreader', 16, -30, 'En cours', 'Moyenne'),
      A(101, e(-240, 52), 'Matérialiser les zones de fouet des aussières sur les quais', 14, -200, 'Réalisée', 'Haute'),
      A(102, e(-240, 52), 'Renforcer l\'équipe de lamanage lors des arrivées simultanées', 13, -190, 'Réalisée', 'Moyenne'),
      A(108, 'AUD-' + Y + '-014', 'Remplacer 6 extincteurs périmés au parc à conteneurs', 33, -18, 'En cours', 'Moyenne'),
      A(109, 'AUD-' + Y + '-016', 'Repeindre le marquage des voies piétonnes du terre-plein', 20, 25, 'À faire', 'Basse'),
      A(110, 'AUD-' + Y + '-017', 'Exiger le registre de vérification des élingues de Mandji Transports', 41, -6, 'À faire', 'Moyenne'),
      A(132, e(-2, 88), 'Imposer les cordes de guidage pour tout levage sur un ravitailleur à quai', 41, 5, 'En cours', 'Haute'),
      A(133, e(-2, 88), 'Fixer un seuil de houle au-delà duquel les levages offshore sont suspendus', 36, 12, 'À faire', 'Moyenne'),
      A(114, 'AUD-' + Y + '-018', 'Former 4 nouveaux émetteurs de permis (chefs de quai adjoints)', 34, 30, 'En cours', 'Moyenne'),
      A(116, 'AUD-' + Y + '-019', 'Réparer l\'éclairage de l\'échelle de quai du poste 1', 23, 4, 'À faire', 'Moyenne')
    ];
    var Au = function (n, off, type, unite, entreprise, aud, theme, statut, score, ecarts, constats) { return { id: 'AUD-' + Y + '-' + String(n).padStart(3, '0'), date: D(off), type: type, unite: unite, entreprise: entreprise || '', auditeur: M(aud), theme: theme, statut: statut, score: score, ecarts: ecarts, constats: constats || [] }; };
    var audits = [
      Au(11, -80, 'Visite terrain', 'OWE-P4', '', 6, 'Visite managériale — poste pétrolier et gazier', 'Réalisé', 88, 2, [{ txt: 'Deux flexibles sans date de contrôle', niv: 'Mineur' }, { txt: 'Bonne tenue générale du poste', niv: 'Observation' }]),
      Au(12, -66, 'Audit entreprise extérieure', 'OWE-PARC', 'F-004', 34, 'Travaux électriques et nacelles au parc à conteneurs', 'Réalisé', 71, 4, [{ txt: 'Nacelle utilisée sans balisage au sol', niv: 'Majeur' }, { txt: 'Registre de consignation incomplet', niv: 'Mineur' }, { txt: 'Harnais sans date de contrôle', niv: 'Mineur' }, { txt: 'Câbles non protégés au passage des engins', niv: 'Mineur' }]),
      Au(13, -52, 'Quart d\'heure sécurité', 'OWE-P2', '', 34, 'Zones d\'exclusion sous charge et signaux de grue', 'Réalisé', 95, 0, [{ txt: '22 participants, quiz de fin de session réussi', niv: 'Observation' }]),
      Au(14, -40, 'Visite terrain', 'OWE-PARC', '', 33, 'Moyens de lutte incendie du parc à conteneurs', 'Réalisé', 79, 3, [{ txt: '6 extincteurs à date de vérification dépassée', niv: 'Mineur' }, { txt: 'Poteau incendie PI-4 masqué par une pile de conteneurs', niv: 'Majeur' }, { txt: 'Accès pompiers encombré', niv: 'Mineur' }]),
      Au(15, -31, 'Audit permis de travail', 'OWE-P3', '', 6, 'Conformité des permis affichés sur le terrain (12 permis contrôlés)', 'Réalisé', 84, 2, [{ txt: '1 permis non affiché au poste de travail', niv: 'Mineur' }, { txt: '1 mesure de gaz de contrôle non tracée', niv: 'Mineur' }]),
      Au(16, -24, 'Visite terrain', 'OWE-PARC', '', 20, 'Circulation piétons / engins dans le parc', 'Réalisé', 82, 2, [{ txt: 'Marquage des voies piétonnes effacé', niv: 'Mineur' }, { txt: 'Chauffeurs hors cabine en zone d\'évolution', niv: 'Mineur' }]),
      Au(17, -16, 'Audit entreprise extérieure', 'POG-QC', 'F-006', 36, 'Levage : plans de levage, élingues, habilitations', 'Réalisé', 76, 3, [{ txt: 'Registre de vérification des élingues non disponible', niv: 'Majeur' }, { txt: 'Plan de levage non signé par le chef de manœuvre', niv: 'Mineur' }, { txt: 'Bon balisage de la zone', niv: 'Observation' }]),
      Au(18, -10, 'Audit permis de travail', 'OWE-P1', '', 6, 'Processus d\'émission : compétences des émetteurs', 'Réalisé', 87, 1, [{ txt: 'Manque d\'émetteurs habilités en shift de nuit', niv: 'Mineur' }]),
      Au(19, -6, 'Visite terrain', 'OWE-P1', '', 0, 'Visite de la direction — quais d\'Owendo', 'Réalisé', 90, 1, [{ txt: 'Éclairage de l\'échelle de quai du poste 1 défaillant', niv: 'Mineur' }]),
      Au(20, -2, 'Quart d\'heure sécurité', 'OWE-P3', '', 34, 'Lamanage : zones de fouet des aussières — retour d\'expérience', 'Réalisé', 92, 0, []),
      Au(21, 4, 'Audit entreprise extérieure', 'OWE-P3', 'F-001', 6, 'Soudure et plongée : chantier des défenses du poste 3', 'Planifié', null, null, []),
      Au(22, 9, 'Exercice POI / POLMAR', 'POG-SOUT', '', 37, 'Exercice POLMAR : fuite de gasoil marin à l\'appontement de soutage', 'Planifié', null, null, []),
      Au(23, 15, 'Visite terrain', 'OWE-MAG', '', 6, 'Visite managériale — magasin et parc véhicules', 'Planifié', null, null, []),
      Au(24, -37, 'Visite terrain', 'POG-SOUT', '', 36, 'Visite managériale — appontement de soutage et barge Mandji', 'Réalisé', 86, 2, [{ txt: 'Kit antipollution incomplet (absorbants)', niv: 'Mineur' }, { txt: 'Étiquetage des flexibles à reprendre', niv: 'Mineur' }]),
      Au(25, 12, 'Quart d\'heure sécurité', 'POG-QB', '', 41, 'Levages offshore : houle, cordes de guidage et zone sous charge', 'Planifié', null, null, [])
    ];
    audits.forEach(function (a) { a.site = siteOf(a.unite); });
    var srcSite = function (id) { var x = incidents.concat(audits).find(function (r) { return r.id === id; }); return x ? x.site : 'OWE'; };
    actions.forEach(function (a) { a.site = srcSite(a.source); });
    /* Statistiques mensuelles (heures travaillées, cartes d'observation, quarts d'heure sécurité, permis) */
    var mois = [];
    var ee = [9000, 8500, 8200, 9600, 10500, 12800, 11200, 9100, 8800, 10200, 13800, 15200], obs = [18, 21, 15, 19, 24, 27, 22, 20, 17, 23, 29, 31], qhs = [22, 21, 18, 22, 22, 23, 22, 21, 20, 22, 22, 22], pm = [48, 52, 41, 50, 58, 66, 61, 51, 46, 59, 74, 82];
    /* un enregistrement par site et par mois (même id de mois) — Port-Gentil ≈ 25-30 % de l'activité d'Owendo */
    var pee = [2600, 2400, 2300, 2700, 3100, 3600, 3300, 2600, 2500, 2900, 3900, 4300], pobs = [5, 6, 4, 6, 7, 8, 6, 6, 5, 7, 8, 9], pqhs = [6, 6, 5, 6, 6, 7, 6, 6, 6, 6, 7, 7], ppm = [13, 15, 11, 14, 16, 19, 17, 14, 13, 16, 21, 24];
    for (var i = 11; i >= 0; i--) {
      var dm = new Date(E.TODAY.getFullYear(), E.TODAY.getMonth() - i, 1), k = 11 - i, mid = dm.getFullYear() + '-' + pad(dm.getMonth() + 1);
      mois.push({ id: mid, site: 'OWE', heures: 33500 + (k % 3) * 600 - (k === 2 ? 1400 : 0), heuresEE: ee[k], observations: obs[k], qhs: qhs[k], permis: pm[k] });
      mois.push({ id: mid, site: 'POG', heures: 9300 + (k % 2) * 300, heuresEE: pee[k], observations: pobs[k], qhs: pqhs[k], permis: ppm[k] });
    }
    /* qualité des eaux du bassin portuaire de chaque site (prélèvements mensuels) */
    var mids = mois.filter(function (m) { return m.site === 'OWE'; }).map(function (m) { return m.id; });
    var eaux = mids.map(function (id, k) { return { id: id, site: 'OWE', hc: [0.6, 0.5, 0.8, 0.9, 0.7, 2.4, 1.1, 0.8, 0.6, 0.5, 0.9, 1.3][k], mes: [22, 19, 25, 27, 21, 41, 26, 23, 20, 18, 24, 29][k], ph: [7.9, 7.8, 8.0, 7.9, 7.8, 7.6, 7.9, 8.0, 8.0, 7.9, 7.8, 7.8][k], o2: [6.8, 6.9, 6.6, 6.5, 6.7, 5.9, 6.4, 6.6, 6.8, 6.9, 6.5, 6.2][k], navires: [38, 36, 41, 42, 44, 47, 43, 39, 37, 40, 45, 48][k] }; })
      .concat(mids.map(function (id, k) { return { id: id, site: 'POG', hc: [0.7, 0.8, 0.6, 1.4, 0.9, 0.8, 0.7, 1.1, 0.8, 0.6, 0.7, 0.9][k], mes: [18, 17, 20, 23, 19, 21, 18, 22, 19, 17, 20, 21][k], ph: [8.0, 8.0, 8.1, 7.9, 8.0, 8.0, 8.1, 7.9, 8.0, 8.1, 8.0, 8.0][k], o2: [7.0, 7.1, 6.9, 6.4, 6.8, 6.9, 7.0, 6.6, 6.9, 7.1, 6.9, 6.8][k], navires: [11, 10, 12, 13, 12, 14, 13, 11, 11, 12, 13, 14][k] }; }));
    var mangrove = [
      { id: 'MG-1', station: 'Mangrove d\'Owendo — arrière du parc à conteneurs', date: D(-2), hc: 140, vegetation: 'Stress léger', faune: 'Crabes violonistes présents, densité réduite', statut: 'Surveillance renforcée', obs: 'Prélèvements après les fortes pluies du ' + fmt.date(D(-3)) + ' (exutoire du réseau pluvial). Résultats attendus.' },
      { id: 'MG-2', station: 'Crique d\'Owendo — exutoire du réseau pluvial', date: D(-12), hc: 110, vegetation: 'Bon', faune: 'Périophtalmes, crabes, aigrettes', statut: 'Conforme', obs: 'Séparateur hydrocarbures du réseau pluvial curé ce trimestre.' },
      { id: 'MG-3', station: 'Front de mer — poste pétrolier (poste 4)', date: D(-12), hc: 120, vegetation: 'Bon', faune: 'Huîtres de palétuviers', statut: 'Conforme', obs: '' },
      { id: 'MG-4', station: 'Port-Gentil — abords de l\'appontement de soutage', date: D(-34), hc: 160, vegetation: 'Bon', faune: 'Crabes, oiseaux limicoles', statut: 'Conforme', obs: 'Suivi renforcé lié à l\'activité de soutage.' },
      { id: 'MG-5', station: 'Estuaire du Komo — transect T1', date: D(-34), hc: 90, vegetation: 'Bon', faune: 'Crabes, poissons juvéniles', statut: 'Conforme', obs: '' },
      { id: 'MG-6', station: 'Station témoin (hors influence portuaire)', date: D(-34), hc: 60, vegetation: 'Bon', faune: 'Référence', statut: 'Référence', obs: 'Station de référence pour comparaison.' },
      { id: 'MG-7', station: 'Port-Gentil — mangrove de la baie du Cap Lopez (arrière des quais)', date: D(-20), hc: 150, vegetation: 'Stress léger', faune: 'Crabes, périophtalmes', statut: 'Surveillance renforcée', obs: 'Traces d\'hydrocarbures anciennes sur les racines ; nouveau prélèvement après le curage du séparateur du quai B.' },
      { id: 'MG-8', station: 'Port-Gentil — station témoin de la pointe Clairette', date: D(-20), hc: 55, vegetation: 'Bon', faune: 'Référence', statut: 'Référence', obs: 'Station de référence du site de Port-Gentil.' }
    ];
    mangrove.forEach(function (m) { m.site = /Port-Gentil/.test(m.station) ? 'POG' : 'OWE'; });
    var dch = function (n, off, type, cat, q, fil, prest, st) { return { id: 'BSD-' + Y + '-' + String(n).padStart(3, '0'), date: D(off), type: type, categorie: cat, quantite: q, filiere: fil, prestataire: prest, statut: st }; };
    var dechets = [
      dch(88, -3, 'Absorbants et chiffons souillés (exercice et égouttures)', 'Dangereux', 0.6, 'Incinération', 'Gabon Recyclage Industriel (démo)', 'En attente d\'enlèvement'),
      dch(87, -9, 'Ferrailles (bollards, échelles, défenses)', 'Non dangereux', 14.5, 'Recyclage', 'Gabon Recyclage Industriel (démo)', 'Enlevé'),
      dch(86, -15, 'Huiles hydrauliques usagées (grues, engins)', 'Dangereux', 4.2, 'Régénération', 'Gabon Recyclage Industriel (démo)', 'Enlevé'),
      dch(85, -21, 'Pneus usagés de reach stackers', 'Non dangereux', 6.4, 'Valorisation matière', 'Gabon Recyclage Industriel (démo)', 'Enlevé'),
      dch(84, -33, 'Batteries d\'engins', 'Dangereux', 1.1, 'Recyclage', 'Gabon Recyclage Industriel (démo)', 'Enlevé'),
      dch(83, -40, 'Défenses caoutchouc déposées', 'Non dangereux', 9.8, 'Valorisation matière', 'Mandji Transports', 'Enlevé'),
      dch(82, -48, 'Déchets banals (DIB) des quais', 'Non dangereux', 18.2, 'Enfouissement (CET)', 'Mandji Transports', 'Enlevé'),
      dch(81, -60, 'DEEE (matériel informatique)', 'Dangereux', 0.8, 'Recyclage', 'Gabon Recyclage Industriel (démo)', 'Enlevé'),
      dch(80, -75, 'Bois de calage et palettes', 'Non dangereux', 5.5, 'Valorisation matière', 'Mandji Transports', 'Enlevé'),
      dch(89, 0, 'Filtres à huile et à gasoil usagés', 'Dangereux', 0.4, 'Centre de traitement agréé', 'Gabon Recyclage Industriel (démo)', 'Stocké sur site'),
      dch(90, -6, 'Boues et eaux huileuses de la barge de soutage', 'Dangereux', 2.8, 'Régénération', 'Gabon Recyclage Industriel (démo)', 'Enlevé'),
      dch(91, -18, 'Ferrailles et élingues réformées (quais A et B)', 'Non dangereux', 3.6, 'Recyclage', 'Mandji Transports', 'Enlevé'),
      dch(92, -1, 'Absorbants souillés (appontement de soutage)', 'Dangereux', 0.3, 'Incinération', 'Gabon Recyclage Industriel (démo)', 'En attente d\'enlèvement')
    ];
    dechets.forEach(function (d) { var n = +d.id.slice(-3); d.site = n >= 90 ? 'POG' : 'OWE'; });
    /* déchets des navires reçus (MARPOL) — navires fictifs de démonstration */
    var mp = function (n, off, navire, site, annexe, nature, m3, prest, st) { return { id: 'MRP-' + Y + '-' + String(n).padStart(3, '0'), date: D(off), navire: navire, site: site, annexe: annexe, nature: nature, volume: m3, prestataire: prest, statut: st }; };
    var marpol = [
      mp(141, -1, 'MV Atlantic Akanda', 'OWE', 'Annexe V', 'Ordures de navire (déchets ménagers et emballages)', 6, 'Mandji Transports', 'Réceptionné'),
      mp(140, -1, 'MV Atlantic Akanda', 'OWE', 'Annexe I', 'Boues d\'hydrocarbures (sludge)', 12, 'Gabon Recyclage Industriel (démo)', 'Programmé'),
      mp(139, -2, 'MV Ro-Ro Estuaire', 'OWE', 'Annexe V', 'Ordures de navire', 4, 'Mandji Transports', 'Réceptionné'),
      mp(138, -3, 'PSV Offshore Mandji', 'POG', 'Annexe I', 'Eaux de cale huileuses', 18, 'Gabon Recyclage Industriel (démo)', 'Réceptionné'),
      mp(137, -5, 'MT West Gentil', 'POG', 'Annexe I', 'Résidus de cargaison (slops)', 35, 'Gabon Recyclage Industriel (démo)', 'Réceptionné'),
      mp(136, -6, 'MV Atlantic Pongara', 'OWE', 'Annexe IV', 'Eaux usées sanitaires', 9, 'Mandji Transports', 'Réceptionné'),
      mp(135, -9, 'MV Gulf Trader', 'OWE', 'Annexe V', 'Ordures de navire', 3, 'Mandji Transports', 'Refusé — conteneur non trié'),
      mp(134, -12, 'PSV Ogooué Supplier', 'POG', 'Annexe I', 'Huiles usagées', 2.5, 'Gabon Recyclage Industriel (démo)', 'Réceptionné'),
      mp(133, -15, 'MV Cap Lopez Express', 'POG', 'Annexe V', 'Ordures de navire', 2, 'Mandji Transports', 'Réceptionné')
    ];

    /* ------------------------------------------------ sûreté portuaire (code ISPS) */
    /* un niveau de sûreté par installation portuaire (Owendo et Port-Gentil ont chacune leur PFSO) */
    var surete = [{ id: 'ISPS', site: 'OWE', niveau: 1, depuis: dayAt(-21, 8), par: N(6), motif: 'Niveau normal — aucune menace particulière signalée', historique: [
      { at: dayAt(-21, 8), niveau: 1, par: N(6), motif: 'Retour au niveau 1 sur instruction de l\'autorité désignée' },
      { at: dayAt(-23, 18), niveau: 2, par: N(6), motif: 'Niveau 2 temporaire : sommet régional à Libreville, renforcement des contrôles' },
      { at: dayAt(-180, 9), niveau: 1, par: N(6), motif: 'Niveau 1 — situation normale' }] },
      { id: 'ISPS-POG', site: 'POG', niveau: 1, depuis: dayAt(-64, 7), par: 'Landry Mouyabi', motif: 'Niveau normal — aucune menace particulière signalée', historique: [
        { at: dayAt(-64, 7), niveau: 1, par: 'Landry Mouyabi', motif: 'Retour au niveau 1 après l\'alerte de piraterie levée dans le golfe de Guinée' },
        { at: dayAt(-67, 20), niveau: 2, par: 'Landry Mouyabi', motif: 'Niveau 2 temporaire : alerte de piraterie au large du Cap Lopez (instruction de l\'autorité désignée)' },
        { at: dayAt(-200, 9), niveau: 1, par: 'Landry Mouyabi', motif: 'Niveau 1 — situation normale' }] }];
    var BZ = ['Zone d\'accès restreint (quais)', 'Parc à conteneurs', 'Zone pétrolière (poste 4 / soutage)', 'Bâtiments administratifs'];
    var bdg = function (n, nom, type, org, zones, exp, st) { return { id: 'BDG-' + String(n).padStart(4, '0'), titulaire: nom, type: type, organisme: org, zones: zones, emission: D(exp - 365), expiration: D(exp), statut: st || 'Actif' }; };
    var badges = [
      bdg(1021, E.empName(M(14)), 'Permanent GPM', 'GPM', [BZ[0], BZ[1], BZ[3]], 210), bdg(1022, E.empName(M(16)), 'Permanent GPM', 'GPM', [BZ[0], BZ[1]], 12),
      bdg(1023, E.empName(M(7)), 'Permanent GPM', 'GPM', [BZ[0], BZ[2], BZ[3]], 160), bdg(1024, E.empName(M(37)), 'Permanent GPM', 'GPM', [BZ[0], BZ[2]], -4, 'Expiré'),
      bdg(1025, E.empName(M(33)), 'Permanent GPM', 'GPM', BZ, 280), bdg(1026, E.empName(M(18)), 'Permanent GPM', 'GPM', [BZ[1]], 25),
      bdg(2101, 'Obame Nzé Rufin', 'Entreprise extérieure', 'Estuaire Marine Services', [BZ[0]], 12), bdg(2102, 'Mbadinga Serge', 'Entreprise extérieure', 'Gabon Électro-Tech', [BZ[1]], 5),
      bdg(2103, 'Mabika Fernand', 'Entreprise extérieure', 'Engins Services Afrique', [BZ[1]], 95), bdg(2104, 'Nziengui Arsène', 'Entreprise extérieure', 'Mandji Transports', [BZ[0]], 40),
      bdg(3101, 'Kassa Didier', 'Transporteur (camion)', 'Transitaire Ogooué Logistique (démo)', [BZ[1]], 60), bdg(3102, 'Moussavou Yves', 'Transporteur (camion)', 'Transitaire Ogooué Logistique (démo)', [BZ[1]], -12, 'Expiré'),
      bdg(4101, 'Ebang Léa', 'Agent consignataire', 'Équateur Maritime Agency (démo)', [BZ[0], BZ[3]], 120), bdg(4102, 'Tchicaya Marc', 'Agent consignataire', 'Gulf of Guinea Shipping (démo)', [BZ[0], BZ[3]], 8),
      bdg(5101, 'Ndoutoume Alice', 'Administration (douane)', 'Douanes gabonaises', BZ, 300), bdg(2105, 'Becker Jonas', 'Entreprise extérieure', 'Crane Parts Europe', [BZ[0]], 0, 'Demande en cours'),
      bdg(1027, E.empName(M(36)), 'Permanent GPM', 'GPM', BZ, 240), bdg(1028, E.empName(M(41)), 'Permanent GPM', 'GPM', [BZ[0], BZ[2]], 9),
      bdg(1029, E.empName(M(38)), 'Permanent GPM', 'GPM', [BZ[0], BZ[2]], 150), bdg(2106, 'Oyono Patrice', 'Entreprise extérieure', 'Offshore Supply Gabon (démo)', [BZ[0]], 70),
      bdg(3103, 'Mabika Roger', 'Transporteur (camion)', 'Mandji Transports', [BZ[0]], -3, 'Expiré'), bdg(4103, 'Ivanga Sonia', 'Agent consignataire', 'Cap Lopez Shipping (démo)', [BZ[0], BZ[3]], 0, 'Demande en cours')
    ];
    var BPOG = { 'BDG-1024': 1, 'BDG-2104': 1, 'BDG-1027': 1, 'BDG-1028': 1, 'BDG-1029': 1, 'BDG-2106': 1, 'BDG-3103': 1, 'BDG-4103': 1 };
    badges.forEach(function (b) { b.site = BPOG[b.id] ? 'POG' : 'OWE'; });
    var vs = function (n, off, h, hs, nom, piece, org, motif, hote, site, veh, st) { return { id: 'VIS-' + String(n).padStart(4, '0'), date: D(off), entree: h, sortie: hs || '', nom: nom, piece: piece, organisme: org, motif: motif, hote: hote, site: site, vehicule: veh || '', statut: st || (hs ? 'Sorti' : 'Sur site') }; };
    var visiteurs = [
      vs(8812, 0, '07:42', '', 'Ndong Mathias', 'CNI 1203***', 'Transitaire Ogooué Logistique (démo)', 'Enlèvement de conteneurs', M(20), 'OWE', 'GR-512-AD (camion)'),
      vs(8811, 0, '08:05', '', 'Ebang Léa', 'Badge BDG-4101', 'Équateur Maritime Agency (démo)', 'Formalités d\'escale — MV Atlantic Akanda', M(26), 'OWE', ''),
      vs(8810, 0, '08:30', '10:15', 'Dr Mouele Annie', 'CNI 0988***', 'Service de santé du port', 'Visite médicale à bord (libre pratique)', M(0), 'OWE', 'CA-117-AA'),
      vs(8809, 0, '09:10', '', 'Obame Nzé Rufin', 'Badge BDG-2101', 'Estuaire Marine Services', 'Chantier défenses poste 3', M(25), 'OWE', 'GN-208-AC (pick-up)'),
      vs(8808, 0, '09:25', '', 'Kombila Jean', 'Passeport G04***', 'Inspection de l\'État du port', 'Inspection du MV Atlantic Akanda', M(6), 'OWE', ''),
      vs(8807, 0, '07:15', '', 'Moussavou Yves', 'Badge BDG-3102 (expiré)', 'Transitaire Ogooué Logistique (démo)', 'Livraison de conteneurs export', M(20), 'OWE', 'GR-733-AB (camion)', 'Refoulé'),
      vs(8806, -1, '14:00', '17:40', 'Oyono Patrice', 'CNI 1121***', 'Offshore Supply Gabon (démo)', 'Réunion opérations offshore', M(36), 'POG', ''),
      vs(8805, -1, '10:20', '12:00', 'Ekogha Brice', 'CNI 1044***', 'Hydro Survey Africa', 'Préparation des levés hydrographiques', M(36), 'POG', 'OG-415-AA'),
      vs(8804, -1, '08:00', '16:30', 'Mbadinga Serge', 'Badge BDG-2102', 'Gabon Électro-Tech', 'Travaux électriques au parc', M(23), 'OWE', 'GN-990-AB (fourgon)'),
      vs(8803, -2, '09:00', '11:30', 'Délégation (5 personnes)', 'Liste nominative visée', 'Ministère des Transports', 'Visite officielle des installations', M(31), 'OWE', 'Minibus officiel'),
      vs(8813, 0, '07:55', '', 'Nkoulou Jérémie', 'Badge BDG-2106', 'Offshore Supply Gabon (démo)', 'Supervision du chargement des modules offshore', M(41), 'POG', 'OG-207-AB (pick-up)'),
      vs(8814, 0, '09:40', '', 'Capt. P. Nguema', 'Passeport G11***', 'PSV Offshore Mandji', 'Réunion de sûreté navire / port (PFSO)', M(36), 'POG', ''),
      vs(8815, 0, '06:50', '08:10', 'Ivanga Sonia', 'CNI 1310***', 'Cap Lopez Shipping (démo)', 'Formalités de soutage du MT West Gentil', M(37), 'POG', '')
    ];
    var dsec = function (n, off, navire, imo, site, niv, motif, signNav, st) { return { id: 'DOS-' + Y + '-' + String(n).padStart(3, '0'), date: D(off), navire: navire, imo: imo, site: site, niveauNavire: niv, niveauPort: 1, motif: motif, sso: signNav, pfso: site === 'POG' ? 'Landry Mouyabi' : N(6), statut: st }; };
    var dos = [
      dsec(47, 1, 'MT Ogooué Star', '9700004', 'OWE', 1, 'Opérations de déchargement de produits pétroliers au poste 4 (interface navire / port à risque)', 'Capt. R. Osei (SSO)', 'À signer'),
      dsec(46, 0, 'MT West Gentil', '9700011', 'POG', 1, 'Soutage et eau douce à l\'appontement de Port-Gentil', 'Capt. L. Martins (SSO)', 'Signée'),
      dsec(45, -1, 'PSV Offshore Mandji', '9700009', 'POG', 2, 'Navire au niveau de sûreté 2 sur instruction de son État du pavillon', 'Capt. P. Nguema (SSO)', 'Signée'),
      dsec(44, -15, 'MV Atlantic Pongara', '9700008', 'OWE', 1, 'Demande du navire (escale précédente dans une zone à risque de piraterie)', 'Capt. D. Ivanov (SSO)', 'Clôturée'),
      dsec(43, -23, 'MV Gulf Trader', '9700007', 'OWE', 2, 'Port au niveau 2 (sommet régional)', 'Capt. J. Silva (SSO)', 'Clôturée')
    ];
    dos[dos.length - 1].niveauPort = 2;
    var ex = function (n, off, type, theme, site, part, st, score, constat) { return { id: 'EXS-' + Y + '-' + String(n).padStart(3, '0'), date: D(off), type: type, theme: theme, site: site, participants: part, statut: st, score: score, constat: constat || '' }; };
    var exercices = [
      ex(19, -85, 'Exercice', 'Intrusion par la mer sur le parc à conteneurs (détection et alerte)', 'OWE', 18, 'Réalisé', 78, 'Délai d\'alerte de la capitainerie trop long (9 min) — procédure de communication à revoir.'),
      ex(20, -62, 'Entraînement', 'Contrôle des accès : détection de badges falsifiés', 'OWE', 9, 'Réalisé', 90, 'Bon niveau des agents ; 2 badges falsifiés sur 2 détectés.'),
      ex(21, -40, 'Entraînement', 'Fouille de véhicules et de colis suspects', 'POG', 6, 'Réalisé', 85, ''),
      ex(22, -18, 'Exercice', 'Passage au niveau de sûreté 2 (exercice réel lors du sommet régional)', 'OWE', 24, 'Réalisé', 88, 'Mesures de niveau 2 mises en place en 2 h 10 (objectif 3 h).'),
      ex(23, 6, 'Entraînement', 'Colis abandonné sur le terre-plein — périmètre et évacuation', 'OWE', 12, 'Planifié', null, ''),
      ex(24, 34, 'Exercice', 'Exercice annuel ISPS conjoint avec l\'autorité désignée et un navire à quai', 'POG', 30, 'Planifié', null, '')
    ];
    return { permis: permis, plansPrevention: plans, incidents: incidents, actionsHSE: actions, audits: audits, hseMois: mois, envEaux: eaux, envMangrove: mangrove, envDechets: dechets, envMarpol: marpol,
      surete: surete, badgesISPS: badges, visiteurs: visiteurs, declarationsSurete: dos, exercicesISPS: exercices };
  }

  function init() {
    /* rattachement aux sites (init s'exécute en vue globale, avant le rattachement automatique du noyau) :
       la zone portuaire fait foi pour les permis, événements, audits et plans ; les actions suivent leur origine. */
    var okSite = function (s) { return s === 'OWE' || s === 'POG'; };
    ['permis', 'incidents', 'audits'].forEach(function (col) { S.raw(col).forEach(function (r) { if (/^(OWE|POG)-/.test(r.unite || '')) r.site = siteOf(r.unite); }); });
    S.raw('plansPrevention').forEach(function (p) { if (p.zones && /^(OWE|POG)-/.test(p.zones[0] || '')) p.site = siteOf(p.zones[0]); });
    S.raw('actionsHSE').forEach(function (a) { var src = S.raw('incidents').concat(S.raw('audits')).find(function (r) { return r.id === a.source; }); if (src && okSite(src.site)) a.site = src.site; else if (!okSite(a.site)) a.site = 'OWE'; });
    /* statistiques mensuelles et qualité des eaux : un enregistrement par site et par mois */
    var perSite = function (col, ratio) {
      var rows = S.raw(col); if (!rows.length) return;
      var by = E.groupBy(rows, 'id');
      Object.keys(by).forEach(function (id) {
        var l = by[id], owe = l.find(function (r) { return r.site === 'OWE'; }), pog = l.find(function (r) { return r.site === 'POG'; });
        if (owe && pog) return;
        var base = owe || l[0]; base.site = 'OWE';
        if (!pog || pog === base) { var c = E.clone(base); c.site = 'POG'; Object.keys(ratio).forEach(function (k) { if (typeof c[k] === 'number') c[k] = ratio[k](c[k]); }); rows.push(c); }
      });
    };
    perSite('hseMois', { heures: function (v) { return Math.round(v * 0.28 / 100) * 100; }, heuresEE: function (v) { return Math.round(v * 0.28 / 100) * 100; }, observations: function (v) { return Math.max(3, Math.round(v * 0.28)); }, qhs: function (v) { return Math.max(4, Math.round(v * 0.28)); }, permis: function (v) { return Math.round(v * 0.28); } });
    perSite('envEaux', { navires: function (v) { return Math.round(v * 0.3); }, hc: function (v) { return Math.round(v * 0.8 * 10) / 10; } });
    /* niveau de sûreté ISPS : un enregistrement par installation portuaire */
    var sur = S.raw('surete'), o = sur.find(function (x) { return x.id === 'ISPS'; });
    if (o) o.site = 'OWE';
    sur.forEach(function (x) { if (x !== o && x.id === 'ISPS') x.id = 'ISPS-' + (okSite(x.site) ? x.site : 'POG'); if (!okSite(x.site)) x.site = /POG/.test(x.id) ? 'POG' : 'OWE'; });
    ['OWE', 'POG'].forEach(function (s) { if (!sur.some(function (x) { return x.site === s; })) sur.push(newIsps(s)); });
    /* expiration automatique des plans de prévention */
    S.all('plansPrevention').forEach(function (p) {
      if ((p.statut === 'Actif' || p.statut === 'Signé') && p.fin < E.today()) {
        p.statut = 'Expiré'; p.hist = p.hist || []; p.hist.push({ at: nowISO(), par: 'Système', note: 'Expiration automatique (fin de validité le ' + fmt.date(p.fin) + ')' });
      }
    });
    S.save();
  }

  /* ================================================================== calculs */
  function permis() { return S.all('permis'); }
  function actifs() { return permis().filter(function (p) { return ACTIFS.indexOf(p.statut) >= 0; }); }
  function lastAAA() { var l = S.all('incidents').filter(function (i) { return i.type === 'AAA'; }).sort(function (a, b) { return b.date.localeCompare(a.date); }); return l[0] || null; }
  function joursSans() { var l = lastAAA(); return l ? E.daysBetween(l.date, E.today()) : 400; }
  function lateActions() { return S.all('actionsHSE').filter(actLate); }
  function months12() { var out = []; for (var i = 11; i >= 0; i--) { var d = new Date(E.TODAY.getFullYear(), E.TODAY.getMonth() - i, 1); out.push({ key: d.getFullYear() + '-' + pad(d.getMonth() + 1), l: E.MOIS[d.getMonth()] }); } return out; }
  function rates() {
    var from = months12()[0].key + '-01';
    var inc = S.all('incidents').filter(function (i) { return i.date >= from; });
    var h = E.sum(S.all('hseMois'), function (m) { return m.heures + m.heuresEE; }) || 1;
    var aaa = inc.filter(function (i) { return i.type === 'AAA'; }).length, asa = inc.filter(function (i) { return i.type === 'ASA'; }).length;
    var jp = E.sum(inc, 'joursArret');
    return { inc: inc, h: h, aaa: aaa, asa: asa, jp: jp, tf1: aaa * 1e6 / h, tf2: (aaa + asa) * 1e6 / h, tg: jp * 1e3 / h };
  }
  function pdpDaysLeft(p) { return E.daysBetween(E.today(), p.fin); }
  function pdpExpiring() { return S.all('plansPrevention').filter(function (p) { return p.statut === 'Actif' && pdpDaysLeft(p) <= 15; }); }

  /* ================================================================== rendu principal */
  var state = { permis: { q: '', type: '', st: 'actifs', unite: '' }, zone: '', mapSite: 'OWE', ev: { q: '', type: '' }, act: { st: 'ouvertes', resp: '' }, pdp: { st: '' }, aud: { type: '' }, sur: { vue: 'badges', q: '' } };

  function render(view, params) {
    var tab = params[0] || 'apercu', id = params[1], sc = SC();
    var niv = isps().niveau;
    /* filtres mémorisés : on oublie une zone qui n'appartient pas à l'espace actif */
    var zids = zonesOf(sc).map(function (z) { return z.id; });
    if (sc) state.mapSite = sc; else if (state.mapSite !== 'POG') state.mapSite = 'OWE';
    if (state.zone && (zids.indexOf(state.zone) < 0 || siteOf(state.zone) !== state.mapSite)) state.zone = '';
    if (state.permis.unite && zids.indexOf(state.permis.unite) < 0) state.permis.unite = '';
    /* en vue globale : les deux niveaux (Owendo / Port-Gentil) */
    var ispsHtml = sc ? '<a class="hse-isps n' + niv + '" href="#/hse/surete" title="Niveau de sûreté ISPS en vigueur — ' + esc(portLong(sc)) + '"><span>Niveau de sûreté ISPS</span><b>' + niv + '</b><em>' + esc(NIV[niv].l) + '</em></a>' :
      '<a class="hse-isps hse-isps--dual" href="#/hse/surete" title="Niveaux de sûreté ISPS en vigueur dans chaque port"><span>Niveaux de sûreté ISPS</span>' + ['OWE', 'POG'].map(function (s) { var n = isps(s).niveau; return '<i class="n' + n + '"><b>' + n + '</b><em>' + portName(s) + '<small>' + esc(NIV[n].l) + '</small></em></i>'; }).join('') + '</a>';
    var tabsList = [
      { k: 'apercu', l: 'Vue d\'ensemble' },
      { k: 'surete', l: 'Sûreté ISPS', n: S.all('visiteurs').filter(function (v) { return v.statut === 'Sur site'; }).length || null },
      { k: 'permis', l: 'Permis de travail', n: actifs().length },
      { k: 'prevention', l: 'Plans de prévention', n: S.all('plansPrevention').filter(function (p) { return p.statut === 'Actif'; }).length },
      { k: 'evenements', l: 'Événements', n: S.all('incidents').filter(function (i) { return i.statut !== 'Clôturé'; }).length },
      { k: 'actions', l: 'Actions correctives', n: lateActions().length || null },
      { k: 'indicateurs', l: 'Indicateurs' },
      { k: 'audits', l: 'Visites, audits & exercices' },
      { k: 'environnement', l: 'Environnement & MARPOL' }
    ];
    if (!tabsList.some(function (t) { return t.k === tab; })) tab = 'apercu';
    view.innerHTML = '<div class="hse">' +
      '<div class="section-title hse-top"><div><h2>HSE & sûreté · ' + esc(portLong(sc)) + '</h2><p>' + fmt.date(E.today()) + ' · ' + actifs().length + ' permis actifs · ' + joursSans() + ' jours sans accident avec arrêt</p></div><div class="spacer"></div>' +
      ispsHtml +
      '<div class="row hse-top__btns"><button class="btn danger" data-act="declare">' + icon('alert') + 'Déclarer un événement</button><button class="btn primary" data-act="new-permit">' + icon('plus') + 'Nouveau permis</button></div></div>' +
      ui.tabs(tabsList, tab, function (k) { E.go('hse/' + k); }) +
      '<div id="hse-body"></div>' +
      '<button class="hse-fab" data-act="declare" aria-label="Déclarer un événement">' + icon('alert') + '<span>Déclarer</span></button></div>';
    $$('[data-act="declare"]', view).forEach(function (b) { b.onclick = declareEvent; });
    $('[data-act="new-permit"]', view).onclick = function () { newPermit(); };
    var body = $('#hse-body', view);
    if (tab === 'permis' && id) return viewPermis(body, id);
    if (tab === 'prevention' && id) return viewPDP(body, id);
    if (tab === 'evenements' && id) return viewEvent(body, id);
    ({ apercu: tabApercu, surete: tabSurete, permis: tabPermis, prevention: tabPDP, evenements: tabEvents, actions: tabActions, indicateurs: tabIndic, audits: tabAudits, environnement: tabEnv })[tab](body);
  }

  /* ------------------------------------------------------------------ compteur « jours sans accident » */
  /* record de jours sans accident avec arrêt : propre au port (espace de site), ou des ports (vue globale) */
  function recordJ() { var j = joursSans(); return Math.max(SC() === 'POG' ? 640 : 412, j); }
  function recordLbl() { return SC() ? 'Record du port' : 'Record des ports'; }
  function counterCard() {
    var j = joursSans(), l = lastAAA(), record = recordJ();
    return '<div class="card hse-counter"><div class="hse-counter__n">' + j + '</div><div class="hse-counter__t"><b>jours sans accident avec arrêt</b>' +
      (l ? '<span>Dernier : ' + fmt.date(l.date) + ' · ' + esc(l.titre) + '</span>' : '') +
      '<div class="hse-counter__bar"><i style="width:' + Math.min(100, j / record * 100) + '%"></i></div><span>' + recordLbl() + ' : ' + record + ' jours · objectif ' + (record + 1) + '</span></div>' + icon('shield', 'hse-counter__ic') + '</div>';
  }

  /* ------------------------------------------------------------------ plan schématique du port d'Owendo (SVG) */
  var ZONES = {
    'OWE-ATL': { x: 20, y: 20, w: 200, h: 140, s: 'Atelier engins' }, 'OWE-MAG': { x: 20, y: 175, w: 200, h: 140, s: 'Magasin & bureaux' },
    'OWE-PARC': { x: 235, y: 20, w: 300, h: 295, s: 'Parc à conteneurs' },
    'OWE-P1': { x: 550, y: 20, w: 140, h: 100, s: 'Poste 1' }, 'OWE-P2': { x: 550, y: 130, w: 140, h: 100, s: 'Poste 2' },
    'OWE-P3': { x: 550, y: 240, w: 140, h: 100, s: 'Poste 3 · roulier' }, 'OWE-P4': { x: 550, y: 350, w: 140, h: 100, s: 'Poste 4 · pétrolier' },
    'OWE-RADE': { x: 708, y: 20, w: 84, h: 330, s: 'Rade' }
  };
  /* plan schématique du port de Port-Gentil : baie du Cap Lopez à l'ouest, quais A et B, appontement de soutage, agence */
  var ZONES_POG = {
    'POG-RADE': { x: 20, y: 20, w: 160, h: 270, s: 'Rade du Cap Lopez' },
    'POG-QC': { x: 322, y: 20, w: 220, h: 140, s: 'Quai A · commercial' }, 'POG-QB': { x: 322, y: 175, w: 220, h: 140, s: 'Quai B · offshore' },
    'POG-SOUT': { x: 110, y: 330, w: 250, h: 120, s: 'Appontement de soutage' },
    'POG-MAG': { x: 560, y: 20, w: 220, h: 295, s: 'Magasin & agence' }
  };
  function mapBackdrop(site) {
    if (site === 'POG') {
      return { label: 'Plan schématique du port de Port-Gentil', bg: '<path d="M0 0 H310 V330 H380 V470 H0 Z" class="sea"/>' +
        '<rect x="302" y="15" width="8" height="305" class="jetty"/><rect x="150" y="384" width="230" height="12" class="jetty"/><rect x="150" y="372" width="10" height="36" class="jetty"/>' +
        '<path d="M310 167 H790 M551 0 V470 M310 324 H790" class="road"/>' +
        '<g class="dz">' + [0, 1, 2].map(function (r) { return [0, 1, 2, 3].map(function (c) { return '<rect x="' + (345 + c * 44) + '" y="' + (45 + r * 26) + '" width="34" height="14" rx="2"/>'; }).join(''); }).join('') +
        [0, 1].map(function (r) { return [0, 1, 2].map(function (c) { return '<rect x="' + (350 + c * 56) + '" y="' + (200 + r * 34) + '" width="44" height="20" rx="3"/>'; }).join(''); }).join('') +
        '<rect x="585" y="45" width="120" height="60" rx="4"/><rect x="585" y="125" width="80" height="40" rx="4"/><rect x="680" y="125" width="70" height="40" rx="4"/><rect x="585" y="190" width="165" height="45" rx="4"/>' +
        [430, 490, 550].map(function (x) { return '<circle cx="' + x + '" cy="398" r="24"/>'; }).join('') + '</g>' +
        '<path d="M250 40 h40 v85 l-20 22 l-20 -22z" class="ship"/><path d="M250 195 h40 v80 l-20 20 l-20 -20z" class="ship"/><path d="M212 404 h122 l-12 26 h-98z" class="ship"/>' +
        '<text x="95" y="310" class="seal" text-anchor="middle">Baie du</text><text x="95" y="323" class="seal" text-anchor="middle">Cap Lopez</text>',
        north: 'translate(760 430)' };
    }
    return { label: 'Plan schématique du port d\'Owendo', bg: '<path d="M700 0 H800 V470 H700 Z" class="sea"/>' +
      '<rect x="692" y="15" width="8" height="440" class="jetty"/>' +
      '<path d="M712 60 h60 l-8 70 h-44z" class="ship"/><path d="M712 280 h56 l-8 50 h-40z" class="ship"/><path d="M712 380 h50 l-6 46 h-38z" class="ship"/>' +
      '<text x="750" y="455" class="seal" text-anchor="middle">Estuaire</text><text x="750" y="467" class="seal" text-anchor="middle">du Komo</text>' +
      '<path d="M0 167 H540 M227 0 V470 M542 0 V470 M0 330 H540" class="road"/>' +
      '<g class="dz">' + [0, 1, 2, 3, 4].map(function (r) { return [0, 1, 2, 3, 4, 5].map(function (c) { return '<rect x="' + (255 + c * 44) + '" y="' + (45 + r * 44) + '" width="34" height="16" rx="2"/>'; }).join(''); }).join('') +
      '<rect x="45" y="55" width="60" height="30" rx="4"/><rect x="120" y="95" width="70" height="30" rx="4"/><rect x="45" y="205" width="150" height="50" rx="4"/>' +
      [70, 180, 290].map(function (y) { return '<path d="M600 ' + (y - 40) + ' v50 M600 ' + (y - 40) + ' l50 14"/>'; }).join('') + '</g>',
      north: 'translate(40 420)' };
  }
  function zoneMap(list, sel, site) {
    site = site === 'POG' ? 'POG' : 'OWE';
    var by = E.groupBy(list, 'unite'), ZS = site === 'POG' ? ZONES_POG : ZONES, bd = mapBackdrop(site);
    var zones = Object.keys(ZS).map(function (u) {
      var z = ZS[u], ps = by[u] || [], n = ps.length, feu = ps.some(function (p) { return p.type === 'FEU'; }), susp = ps.some(function (p) { return p.statut === 'Suspendu'; });
      var cls = 'zone' + (n ? ' has' : '') + (feu ? ' feu' : '') + (sel === u ? ' sel' : '');
      var cx = z.x + z.w - 22, cy = z.y + 22;
      return '<g class="' + cls + '" data-u="' + u + '"><title>' + esc(uName(u) + ' — ' + n + ' permis actif(s)' + (n ? ' : ' + ps.map(function (p) { return p.id + ' (' + TYPES[p.type].s + ')'; }).join(', ') : '')) + '</title>' +
        '<rect x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" rx="12" class="zr"/>' +
        '<text x="' + (z.x + 10) + '" y="' + (z.y + z.h - 26) + '" class="zid">' + u.replace(/^(OWE|POG)-/, '') + '</text><text x="' + (z.x + 10) + '" y="' + (z.y + z.h - 10) + '" class="zn">' + esc(z.s) + '</text>' +
        (n ? (feu ? '<circle cx="' + cx + '" cy="' + cy + '" r="16" class="pulse"/>' : '') + '<circle cx="' + cx + '" cy="' + cy + '" r="16" class="pin' + (feu ? ' red' : susp ? ' orange' : '') + '"/><text x="' + cx + '" y="' + (cy + 6) + '" class="pinn" text-anchor="middle">' + n + '</text>' : '') + '</g>';
    }).join('');
    return '<svg class="hse-map hse-map--' + site.toLowerCase() + '" viewBox="0 0 800 470" role="img" aria-label="' + esc(bd.label) + '">' + '<rect x="0" y="0" width="800" height="470" class="land"/>' + bd.bg + zones +
      '<g transform="' + bd.north + '" class="north"><path d="M0 -22 L8 4 L0 -2 L-8 4Z"/><text y="18" text-anchor="middle">N</text></g></svg>';
  }

  function permitItem(p) {
    var t = TYPES[p.type], m = lastGas(p), od = isOverdue(p), now = new Date(), tot = hoursBetween(p.debut, p.fin), el = (now - toDate(p.debut)) / 36e5;
    var pct = Math.max(0, Math.min(100, el / tot * 100)), rest = hoursBetween(localISO(now), p.fin);
    var when = p.statut === 'Autorisé' ? (el < 0 ? 'Ouverture prévue ' + fDT(p.debut) : 'Prêt à ouvrir · fin ' + fH(p.fin)) : od ? '<b class="late">Validité dépassée de ' + dur(-rest) + '</b>' : 'Reste ' + dur(rest) + ' · fin ' + fH(p.fin);
    return '<a class="hse-pi" href="#/hse/permis/' + p.id + '" style="--c:' + t.c + '"><div class="hse-pi__ic">' + icon(t.ic) + '</div><div class="hse-pi__b"><div class="row" style="gap:6px"><b>' + p.id + '</b>' + stBadge(p.statut) + '<span class="small muted">' + esc(t.s) + '</span></div>' +
      '<div class="hse-pi__d">' + esc(p.unite + ' · ' + p.equipement) + '</div><div class="small muted">' + esc(ent(p.entreprise)) + ' · ' + when + '</div>' +
      (p.statut !== 'Autorisé' ? '<div class="progress ' + (od ? 'red' : pct > 80 ? 'orange' : '') + '" style="margin:6px 0 4px"><i style="width:' + pct + '%"></i></div>' : '') +
      (m ? gasPills(m) : '') + '</div></a>';
  }

  /* ------------------------------------------------------------------ onglet Vue d'ensemble */
  function tabApercu(el) {
    var act = actifs(), feu = act.filter(function (p) { return p.type === 'FEU'; }), att = permis().filter(function (p) { return p.statut === 'Préparé' || p.statut === 'Demandé'; });
    var late = lateActions(), r = rates();
    var html = '<div class="grid hse-ov">' + counterCard() +
      '<div class="grid g2 hse-ov__k">' +
      ui.kpi({ label: 'Permis actifs sur le site', value: act.length, icon: 'shield', tone: 'blue', foot: '<span class="' + (feu.length ? 'down' : '') + '">' + feu.length + ' permis de feu</span> · ' + act.filter(function (p) { return p.statut === 'Suspendu'; }).length + ' suspendu(s)' }) +
      ui.kpi({ label: 'Permis à traiter', value: att.length, icon: 'clock', tone: 'orange', foot: att.filter(function (p) { return p.statut === 'Préparé'; }).length + ' à autoriser · ' + att.filter(function (p) { return p.statut === 'Demandé'; }).length + ' à préparer' }) +
      ui.kpi({ label: 'Actions correctives en retard', value: late.length, icon: 'alert', tone: late.length ? 'red' : 'green', foot: S.all('actionsHSE').filter(function (a) { return a.statut !== 'Réalisée'; }).length + ' actions ouvertes' }) +
      ui.kpi({ label: 'TF1 glissant 12 mois', value: num(r.tf1, 2), icon: 'trend', tone: 'violet', foot: 'TF2 ' + num(r.tf2, 2) + ' · TG ' + num(r.tg, 3) }) +
      '</div></div>';
    /* plan : celui du site actif ; en vue globale, sélecteur Owendo / Port-Gentil */
    var sc = SC(), ms = state.mapSite, actM = act.filter(function (p) { return siteOf(p.unite) === ms; });
    var mapSel = sc ? '' : '<div class="chips hse-mapsel" role="tablist">' + ['OWE', 'POG'].map(function (s) { var n = act.filter(function (p) { return siteOf(p.unite) === s; }).length; return '<button class="chip' + (ms === s ? ' is-active' : '') + '" data-ms="' + s + '" role="tab" aria-selected="' + (ms === s) + '">' + icon('pin') + 'Port ' + (s === 'POG' ? 'de Port-Gentil' : 'd\'Owendo') + ' <b>' + n + '</b></button>'; }).join('') + '</div>';
    html += '<div class="grid g-2-1" style="margin-top:16px"><div class="card"><div class="card__h"><h3>Permis actifs ' + (sc ? 'sur le port' : 'dans les ports') + '</h3><span class="sub">autorisés, en cours ou suspendus · cliquez une zone pour filtrer</span><div class="spacer"></div><div class="legend"><span><i style="background:var(--navy-3)"></i>Actifs</span><span><i style="background:var(--red)"></i>Dont permis de feu</span><span><i style="background:var(--orange)"></i>Suspendu</span></div></div>' +
      '<div class="card__b">' + mapSel + '<div class="hse-mapwrap">' + zoneMap(actM, state.zone, ms) + '</div><div class="chips hse-zchips">' +
      zonesOf(ms).map(function (z) { return z.id; }).map(function (u) { var n = actM.filter(function (p) { return p.unite === u; }).length; return '<button class="chip' + (state.zone === u ? ' is-active' : '') + '" data-z="' + u + '">' + esc(shortZ(u)) + (n ? ' <b>' + n + '</b>' : '') + '</button>'; }).join('') + '</div></div></div>' +
      '<div class="card"><div class="card__h"><h3>' + (state.zone ? 'Zone ' + state.zone + ' · ' + esc(shortZ(state.zone)) : 'Tous les permis actifs' + (sc ? '' : ' · ' + portName(ms))) + '</h3>' + (state.zone ? '<button class="btn ghost sm" data-z="">Toutes les zones</button>' : '') + '</div><div class="hse-pl">' +
      (function () { var l = actM.filter(function (p) { return !state.zone || p.unite === state.zone; }); return l.length ? l.map(permitItem).join('') : '<div class="empty">Aucun permis actif ' + (state.zone ? 'dans cette zone' : 'sur ce port') + '.</div>'; })() + '</div></div></div>';
    /* alertes + événements récents */
    var alerts = [];
    act.filter(isOverdue).forEach(function (p) { alerts.push(['red', 'clock', '<b>' + p.id + '</b> — validité dépassée (' + fH(p.fin) + ') : à prolonger ou clôturer.', '#/hse/permis/' + p.id]); });
    act.filter(function (p) { return p.statut === 'Suspendu'; }).forEach(function (p) { alerts.push(['orange', 'alert', '<b>' + p.id + '</b> suspendu : ' + esc(p.suspension ? p.suspension.motif : ''), '#/hse/permis/' + p.id]); });
    act.forEach(function (p) { var m = lastGas(p); if (m && gasWorst(m) !== 'ok') alerts.push([gasWorst(m) === 'bad' ? 'red' : 'yellow', 'drop', '<b>' + p.id + '</b> — dernière mesure de gaz à surveiller : ' + gasPills(m), '#/hse/permis/' + p.id]); });
    permis().filter(function (p) { return p.statut === 'Préparé' && authChecks(p).some(function (c) { return !c.ok; }); }).forEach(function (p) { alerts.push(['red', 'lock', '<b>' + p.id + '</b> (' + TYPES[p.type].s + ') — autorisation bloquée par les contrôles de sécurité.', '#/hse/permis/' + p.id]); });
    pdpExpiring().forEach(function (p) { alerts.push(['orange', 'calendar', 'Plan de prévention <b>' + p.id + '</b> (' + esc(ent(p.entreprise)) + ') expire dans ' + pdpDaysLeft(p) + ' j.', '#/hse/prevention/' + p.id]); });
    S.all('plansPrevention').filter(function (p) { return p.statut === 'Expiré'; }).forEach(function (p) { alerts.push(['red', 'calendar', 'Plan de prévention <b>' + p.id + '</b> expiré — l\'entreprise ' + esc(ent(p.entreprise)) + ' ne peut plus intervenir.', '#/hse/prevention/' + p.id]); });
    if (late.length) alerts.push(['red', 'flag', '<b>' + late.length + ' actions correctives en retard</b> — plus ancienne : ' + esc(late.sort(function (a, b) { return a.echeance.localeCompare(b.echeance); })[0].libelle), '#/hse/actions']);
    var recent = S.all('incidents').slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 5);
    html += '<div class="grid g2 keep-1" style="margin-top:16px"><div class="card"><div class="card__h"><h3>Alertes sécurité</h3><span class="badge tone-red">' + alerts.length + '</span></div><div class="list">' +
      (alerts.length ? alerts.map(function (a) { return '<a class="list__item" href="' + a[3] + '" style="color:inherit"><div class="list__icon tone-' + a[0] + '">' + icon(a[1]) + '</div><div class="list__body small">' + a[2] + '</div></a>'; }).join('') : '<div class="empty">Aucune alerte</div>') + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Derniers événements HSE</h3><div class="spacer"></div><a class="btn ghost sm" href="#/hse/evenements">Tout voir</a></div><div class="list">' +
      recent.map(function (i) { var t = EVT[i.type]; return '<a class="list__item" href="#/hse/evenements/' + i.id + '" style="color:inherit"><div class="list__icon" style="background:' + t.c + '1a;color:' + t.c + '">' + icon(t.ic) + '</div><div class="list__body"><b>' + esc(i.titre) + '</b><div class="small muted">' + fmt.date(i.date) + ' · ' + esc(i.unite + ' · ' + i.lieu) + '</div><div class="row" style="gap:6px;margin-top:4px">' + evBadge(i.type) + ui.badge(i.statut, EV_TONE[i.statut]) + '</div></div></a>'; }).join('') + '</div></div></div>';
    el.innerHTML = html;
    $$('[data-z]', el).forEach(function (b) { b.onclick = function () { state.zone = state.zone === b.dataset.z ? '' : b.dataset.z; tabApercu(el); }; });
    $$('[data-ms]', el).forEach(function (b) { b.onclick = function () { if (state.mapSite !== b.dataset.ms) { state.mapSite = b.dataset.ms; state.zone = ''; tabApercu(el); } }; });
    $$('.hse-map .zone', el).forEach(function (g) { g.addEventListener('click', function () { state.zone = state.zone === g.dataset.u ? '' : g.dataset.u; tabApercu(el); }); });
  }

  /* ------------------------------------------------------------------ onglet Permis */
  var PT_COLS = [
    { label: 'N°', render: function (p) { return '<b class="nowrap">' + p.id + '</b>'; }, csv: function (p) { return p.id; } },
    { label: 'Type', render: function (p) { return tt(p.type); }, csv: function (p) { return TYPES[p.type].l; } },
    { label: 'Zone · équipement', render: function (p) { return '<div class="hse-cell"><b>' + esc(p.unite) + '</b> · ' + esc(p.equipement) + '<div class="small muted">' + esc(p.ot) + '</div></div>'; }, csv: function (p) { return p.unite + ' · ' + p.equipement; } },
    { label: 'Entreprise', render: function (p) { return esc(ent(p.entreprise)); }, csv: function (p) { return ent(p.entreprise); } },
    { label: 'Validité', render: function (p) { return '<span class="nowrap' + (isOverdue(p) ? ' late' : '') + '">' + fDT(p.debut) + ' → ' + fH(p.fin) + '</span>'; }, csv: function (p) { return fDT(p.debut) + ' - ' + fDT(p.fin); } },
    { label: 'Dernière mesure gaz', render: function (p) { return GAS_REQ[p.type] || p.gaz.length ? gasPills(lastGas(p)) : '<span class="muted small">Non requise</span>'; }, csv: function (p) { var m = lastGas(p); return m ? 'O2 ' + m.o2 + ' / LIE ' + m.lie + ' / H2S ' + m.h2s + ' / CO ' + m.co : ''; } },
    { label: 'Statut', render: function (p) { return stBadge(p.statut); }, csv: function (p) { return p.statut; } }
  ];
  function tabPermis(el) {
    var st = state.permis, all = permis();
    var cnt = function (f) { return all.filter(f).length; };
    el.innerHTML = '<div class="grid g4">' +
      ui.kpi({ label: 'En cours sur le terrain', value: cnt(function (p) { return p.statut === 'En cours'; }), icon: 'helmet', tone: 'blue', foot: cnt(function (p) { return p.statut === 'Autorisé'; }) + ' autorisé(s) à ouvrir' }) +
      ui.kpi({ label: 'À autoriser', value: cnt(function (p) { return p.statut === 'Préparé'; }), icon: 'key', tone: 'violet', foot: cnt(function (p) { return p.statut === 'Demandé'; }) + ' demande(s) à préparer' }) +
      ui.kpi({ label: 'Permis de feu actifs', value: cnt(function (p) { return p.type === 'FEU' && ACTIFS.indexOf(p.statut) >= 0; }), icon: 'fire', tone: 'red', foot: 'LIE exigée : 0 %' }) +
      ui.kpi({ label: 'Suspendus', value: cnt(function (p) { return p.statut === 'Suspendu'; }), icon: 'alert', tone: 'orange', foot: 'Reprise après nouvelle mesure' }) + '</div>' +
      '<div class="card" style="margin-top:16px"><div class="card__h"><h3>Registre des permis de travail</h3><div class="spacer"></div><button class="btn sm" id="pt-csv">' + icon('download') + 'Export CSV</button><button class="btn primary sm" id="pt-new">' + icon('plus') + 'Nouveau permis</button></div><div class="card__b" style="padding-bottom:0">' +
      '<div class="filters"><input class="input" id="pt-q" placeholder="Rechercher (n°, équipement, OT…)" value="' + esc(st.q) + '">' +
      '<select class="select" id="pt-type"><option value="">Tous les types</option>' + TYPE_KEYS.map(function (k) { return '<option value="' + k + '"' + (st.type === k ? ' selected' : '') + '>' + esc(TYPES[k].s) + '</option>'; }).join('') + '</select>' +
      '<select class="select" id="pt-unite"><option value="">Toutes les zones</option>' + uniteOpts().map(function (o) { return '<option value="' + o.v + '"' + (st.unite === o.v ? ' selected' : '') + '>' + esc(o.l) + '</option>'; }).join('') + '</select></div>' +
      '<div class="chips" id="pt-st" style="margin-bottom:14px">' + [['actifs', 'Actifs'], ['traiter', 'À traiter'], ['clotures', 'Clôturés / annulés'], ['tous', 'Tous']].map(function (c) { return '<button class="chip' + (st.st === c[0] ? ' is-active' : '') + '" data-k="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div></div><div id="pt-list"></div></div>';
    function rows() {
      var q = E.norm(st.q);
      return all.filter(function (p) {
        if (st.type && p.type !== st.type) return false;
        if (st.unite && p.unite !== st.unite) return false;
        if (st.st === 'actifs' && ACTIFS.indexOf(p.statut) < 0) return false;
        if (st.st === 'traiter' && ['Demandé', 'Préparé'].indexOf(p.statut) < 0) return false;
        if (st.st === 'clotures' && ['Clôturé', 'Annulé'].indexOf(p.statut) < 0) return false;
        return !q || E.norm([p.id, p.equipement, p.description, p.ot, ent(p.entreprise), TYPES[p.type].l].join(' ')).indexOf(q) >= 0;
      }).sort(function (a, b) { return b.id.localeCompare(a.id); });
    }
    function draw() { $('#pt-list', el).innerHTML = ui.table(PT_COLS, rows(), { onRow: function (p) { E.go('hse/permis/' + p.id); }, empty: 'Aucun permis pour ces critères' }); }
    draw();
    $('#pt-q', el).oninput = function (e) { st.q = e.target.value; draw(); };
    $('#pt-type', el).onchange = function (e) { st.type = e.target.value; draw(); };
    $('#pt-unite', el).onchange = function (e) { st.unite = e.target.value; draw(); };
    $$('#pt-st .chip', el).forEach(function (b) { b.onclick = function () { st.st = b.dataset.k; $$('#pt-st .chip', el).forEach(function (x) { x.classList.toggle('is-active', x === b); }); draw(); }; });
    $('#pt-csv', el).onclick = function () { ui.exportCSV('permis-de-travail', PT_COLS, rows()); };
    $('#pt-new', el).onclick = function () { newPermit(); };
  }

  /* ------------------------------------------------------------------ fiche permis */
  function validityBlock(p) {
    var now = new Date(), tot = hoursBetween(p.debut, p.fin), el = (now - toDate(p.debut)) / 36e5, rest = hoursBetween(localISO(now), p.fin);
    var pct = Math.max(0, Math.min(100, el / tot * 100)), txt, tone = '';
    if (p.statut === 'Clôturé') txt = 'Clôturé le ' + fDT(p.cloture ? p.cloture.at : p.fin);
    else if (p.statut === 'Annulé') txt = 'Permis annulé';
    else if (el < 0) txt = 'Débute dans ' + dur(-el);
    else if (rest < 0) { txt = 'Validité dépassée de ' + dur(-rest); tone = 'red'; }
    else { txt = 'Reste ' + dur(rest); tone = rest < 1.5 ? 'orange' : ''; }
    return '<div class="hse-valid"><div class="row"><b>' + fDT(p.debut) + '</b><div class="spacer"></div><b>' + fDT(p.fin) + '</b></div><div class="progress ' + tone + '"><i style="width:' + (p.statut === 'Clôturé' ? 100 : pct) + '%"></i></div>' +
      '<div class="row small"><span class="' + (tone === 'red' ? 'late' : 'muted') + '">' + txt + '</span><div class="spacer"></div><span class="muted">Durée ' + dur(tot) + ' (max 12 h)' + (p.prolong.length ? ' · ' + p.prolong.length + ' prolongation(s)' : '') + '</span></div></div>';
  }
  function sigBox(label, s) { return '<div class="hse-sig' + (s ? ' ok' : '') + '"><span>' + esc(label) + '</span>' + (s ? '<b>' + esc(s.nom) + '</b><em>' + fDT(s.at) + '</em>' : '<i>En attente</i>') + '</div>'; }
  function gasTable(p) {
    if (!p.gaz.length) return '<div class="empty" style="padding:20px">Aucune mesure de gaz enregistrée.' + (GAS_REQ[p.type] ? ' <b class="late">Obligatoire pour ce type de permis.</b>' : '') + '</div>';
    return ui.table([{ label: 'Heure', render: function (m) { return '<b class="nowrap">' + fDT(m.at) + '</b>'; } }, { label: 'Phase', key: 'phase' }].concat(GAS.map(function (g) { return { label: g.l + ' (' + g.u + ')', num: true, render: function (m) { return '<span class="gz ' + g.lvl(m[g.k]) + '">' + num(m[g.k]) + '</span>'; } }; })).concat([{ label: 'Point de mesure', key: 'point' }, { label: 'Opérateur', key: 'par' }]), p.gaz.slice().reverse());
  }
  function viewPermis(el, id) {
    var p = S.get('permis', id);
    if (!p) { el.innerHTML = '<div class="card empty">Permis introuvable. <a href="#/hse/permis">Retour au registre</a></div>'; return; }
    var t = TYPES[p.type], checks = authChecks(p), blocked = checks.some(function (c) { return !c.ok; });
    var idx = { 'Demandé': 0, 'Préparé': 1, 'Autorisé': 2, 'En cours': 3, 'Suspendu': 3, 'Clôturé': 4, 'Annulé': 0 }[p.statut];
    var btns = [];
    if (p.statut === 'Demandé') btns.push(['prepare', 'primary', 'edit', 'Préparer le permis']);
    if (p.statut === 'Préparé') { btns.push(['authorize', blocked ? 'danger' : 'success', blocked ? 'lock' : 'check', blocked ? 'Autoriser (bloqué)' : 'Autoriser le permis']); btns.push(['prepare', '', 'edit', 'Compléter la préparation']); }
    if (p.statut === 'Autorisé') btns.push(['open', 'success', 'helmet', 'Ouvrir sur le terrain']);
    if (p.statut === 'En cours') { btns.push(['suspend', 'danger', 'alert', 'Suspendre']); btns.push(['extend', '', 'clock', 'Prolonger']); btns.push(['close', 'primary', 'check', 'Clôturer']); }
    if (p.statut === 'Suspendu') { btns.push(['resume', 'success', 'refresh', 'Reprendre les travaux']); btns.push(['close', 'primary', 'check', 'Clôturer']); }
    if (['Préparé', 'Autorisé', 'En cours', 'Suspendu'].indexOf(p.statut) >= 0) btns.push(['gas', '', 'drop', 'Mesure de gaz']);
    if (p.statut === 'Demandé' || p.statut === 'Préparé' || p.statut === 'Autorisé') btns.push(['cancel', 'ghost', 'x', 'Annuler']);
    btns.push(['print', 'ghost', 'print', 'Aperçu imprimable']);
    var assoc = (p.associes || []).map(function (aid) { var a = S.get('permis', aid); return a ? '<a class="hse-assoc" href="#/hse/permis/' + a.id + '">' + tt(a.type) + '<b>' + a.id + '</b>' + stBadge(a.statut) + '</a>' : ''; }).join('');
    var also = permis().filter(function (x) { return x.id !== p.id && (x.associes || []).indexOf(p.id) >= 0 && (p.associes || []).indexOf(x.id) < 0; });
    assoc += also.map(function (a) { return '<a class="hse-assoc" href="#/hse/permis/' + a.id + '">' + tt(a.type) + '<b>' + a.id + '</b>' + stBadge(a.statut) + '</a>'; }).join('');
    var m = lastGas(p);
    var html = '<a class="btn ghost sm" href="#/hse/permis" style="margin-bottom:10px">' + icon('back') + 'Registre des permis</a>' +
      '<div class="card hse-ph" style="--c:' + t.c + '"><div class="hse-ph__band"></div><div class="card__b"><div class="row" style="align-items:flex-start"><div class="hse-ph__ic">' + icon(t.ic) + '</div><div style="flex:1;min-width:0"><div class="row" style="gap:8px"><h3 class="hse-ph__t">' + esc(t.l) + '</h3>' + stBadge(p.statut) + (isOverdue(p) ? '<span class="badge tone-red">Validité dépassée</span>' : '') + '</div>' +
      '<div class="mono" style="margin:3px 0 6px">' + p.id + ' · ' + esc(p.ot) + '</div><div>' + esc(p.description) + '</div></div></div>' +
      '<div class="row hse-ph__btns">' + btns.map(function (b) { return '<button class="btn ' + b[1] + '" data-do="' + b[0] + '">' + icon(b[2]) + esc(b[3]) + '</button>'; }).join('') + '</div></div>' +
      '<div class="card__b" style="border-top:1px solid var(--line-2)">' + ui.steps(['Demandé', 'Préparé', 'Autorisé', p.statut === 'Suspendu' ? 'Suspendu' : 'En cours', 'Clôturé'], idx, { rejected: p.statut === 'Suspendu' || p.statut === 'Annulé', finished: p.statut === 'Clôturé' }) + '</div></div>';
    if (p.statut === 'Suspendu' && p.suspension) html += alertBox('red', 'alert', '<b>Permis suspendu</b> le ' + fDT(p.suspension.at) + ' par ' + esc(p.suspension.par) + ' — ' + esc(p.suspension.motif) + (p.suspension.note ? ' : ' + esc(p.suspension.note) : '') + '. Une nouvelle mesure de gaz conforme est exigée pour reprendre.');
    html += '<div class="grid g-2-1" style="margin-top:16px"><div class="stack">' +
      '<div class="card"><div class="card__h"><h3>Identification</h3></div><div class="card__b"><dl class="kv">' +
      '<dt>Zone portuaire</dt><dd>' + esc(p.unite + ' · ' + uName(p.unite)) + '</dd><dt>Équipement / lieu</dt><dd>' + esc(p.equipement) + '</dd><dt>Ordre de travail</dt><dd class="mono">' + esc(p.ot) + '</dd>' +
      '<dt>Entreprise</dt><dd>' + esc(ent(p.entreprise)) + ' · ' + (p.intervenants || 1) + ' intervenant(s)</dd><dt>Demandeur</dt><dd>' + esc(E.empName(p.demandeur)) + '</dd><dt>Émetteur (exploitation)</dt><dd>' + esc(E.empName(p.emetteur)) + '</dd>' +
      '<dt>Responsable de zone</dt><dd>' + esc(E.empName(p.responsable)) + '</dd>' + (p.surveillant ? '<dt>Surveillant</dt><dd>' + esc(E.empName(p.surveillant)) + '</dd>' : '') + (p.executant ? '<dt>Exécutant</dt><dd>' + esc(p.executant) + '</dd>' : '') + '</dl></div></div>' +
      '<div class="card"><div class="card__h"><h3>Analyse de risques</h3></div><div class="card__b">' + ((p.dangers || []).length ? '<div class="chips">' + p.dangers.map(function (d) { return '<span class="hse-danger">' + icon('alert') + esc(lbl(DANGERS, d)) + '</span>'; }).join('') + '</div><p class="hse-p">' + esc(p.mesuresRisques || '') + '</p>' : '<div class="muted">Analyse à réaliser lors de la préparation.</div>') + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Mesures de sécurité</h3><span class="sub">obligatoires pour ce type : ' + (REQ[p.type] || []).length + '</span></div><div class="card__b"><ul class="hse-secu">' +
      SECU.filter(function (s) { return (REQ[p.type] || []).indexOf(s[0]) >= 0 || p.secu[s[0]]; }).map(function (s) { var req = (REQ[p.type] || []).indexOf(s[0]) >= 0; return '<li class="' + (p.secu[s[0]] ? 'ok' : req ? 'ko' : '') + '"><i>' + (p.secu[s[0]] ? '✓' : '') + '</i>' + esc(s[1]) + (req ? '<em>obligatoire</em>' : '') + '</li>'; }).join('') + '</ul>' +
      '<div class="small muted" style="margin:12px 0 6px;font-weight:600">EPI requis</div><div class="chips">' + ((p.epi || []).length ? p.epi.map(function (e) { return '<span class="hse-epi">' + icon('helmet') + esc(lbl(EPI, e)) + '</span>'; }).join('') : '<span class="muted small">À définir</span>') + '</div></div></div>' +
      '<div class="card"><div class="card__h"><h3>Mesures de gaz</h3><span class="sub">explosimètre 4 gaz · seuils : O₂ 19,5–23,5 % · LIE 0 % (feu) · H₂S &lt; 1 ppm · CO &lt; 20 ppm</span></div>' +
      (m ? '<div class="hse-gasnow">' + GAS.map(function (g) { return '<div class="hse-gt ' + g.lvl(m[g.k]) + '"><span>' + g.l + '</span><b>' + num(m[g.k]) + '<small>' + g.u + '</small></b><em>' + esc(g.seuil) + '</em></div>'; }).join('') + '</div>' : '') +
      gasTable(p) + '</div></div>' +
      '<div class="stack">' +
      (['Demandé', 'Préparé'].indexOf(p.statut) >= 0 ? '<div class="card"><div class="card__h"><h3>Contrôles avant autorisation</h3>' + (blocked ? '<span class="badge tone-red">Bloquant</span>' : '<span class="badge tone-green">Conforme</span>') + '</div><div class="card__b">' + checklist(checks) + '</div></div>' : '') +
      '<div class="card"><div class="card__h"><h3>Validité</h3></div><div class="card__b">' + validityBlock(p) + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Signatures</h3></div><div class="card__b hse-sigs">' + sigBox('Demandeur', p.sig.demandeur) + sigBox('Émetteur', p.sig.emetteur) + sigBox('Responsable de zone', p.sig.responsable) + sigBox('Exécutant', p.sig.executant) + sigBox('Clôture', p.sig.cloture) + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Permis associés</h3><span class="sub">cumul de risques</span></div><div class="card__b">' + (assoc || '<span class="muted small">Aucun permis associé</span>') + '</div></div>' +
      (p.cloture ? '<div class="card"><div class="card__h"><h3>Retour d\'état</h3></div><div class="card__b"><ul class="hse-secu">' + RETOUR.map(function (r) { return '<li class="ok"><i>✓</i>' + esc(r[1]) + '</li>'; }).join('') + '</ul><p class="hse-p small">' + esc(p.cloture.obs || '') + '</p></div></div>' : '') +
      '<div class="card"><div class="card__h"><h3>Historique</h3></div><div class="card__b"><div class="timeline">' + p.hist.slice().reverse().map(function (h, i) { return '<div class="tl-item ' + (i === 0 ? (h.statut === 'Suspendu' || h.statut === 'Annulé' ? 'rejected' : 'current') : 'done') + '"><b>' + esc(h.statut) + ' · ' + fDT(h.at) + '</b><span>' + esc(h.par) + (h.note ? ' — ' + esc(h.note) : '') + '</span></div>'; }).join('') + '</div></div></div>' +
      '</div></div>';
    el.innerHTML = html;
    $$('[data-do]', el).forEach(function (b) { b.onclick = function () { ACTIONS_PT[b.dataset.do](p); }; });
  }

  /* --- formulaires utilitaires */
  function checkGroup(grp, items, selected, req) {
    selected = selected || {}; req = req || [];
    return '<div class="hse-checks">' + items.map(function (it) {
      var on = Array.isArray(selected) ? selected.indexOf(it[0]) >= 0 : !!selected[it[0]], r = req.indexOf(it[0]) >= 0;
      return '<label class="hse-ck' + (r ? ' req' : '') + '"><input type="checkbox" data-grp="' + grp + '" value="' + it[0] + '"' + (on ? ' checked' : '') + '><span>' + esc(it[1]) + (r ? ' <em>obligatoire</em>' : '') + '</span></label>';
    }).join('') + '</div>';
  }
  function readGroup(root, grp) { return $$('input[data-grp="' + grp + '"]:checked', root).map(function (i) { return i.value; }); }
  function gasInputs(m, opt) {
    opt = opt || {};
    return '<div class="hse-gasin">' + GAS.map(function (g) { return '<label class="hse-gi" data-g="' + g.k + '"><span>' + g.l + ' <small>' + g.u + '</small></span><input class="input" type="number" inputmode="decimal" step="' + g.step + '" min="0" data-gas="' + g.k + '" value="' + (m && m[g.k] != null ? m[g.k] : '') + '" placeholder="—"><em>' + esc(g.seuil) + '</em></label>'; }).join('') + '</div>' +
      '<div class="form-grid" style="margin-top:12px"><div class="field"><label>Point de mesure</label><input class="input" data-gas-point value="' + esc(opt.point || 'Zone de travail') + '"></div><div class="field"><label>Opérateur de mesure</label><input class="input" data-gas-par value="' + esc(opt.par || user().name) + '"></div></div>';
  }
  function bindGas(root) {
    $$('[data-gas]', root).forEach(function (inp) {
      var f = function () { var g = GAS.find(function (x) { return x.k === inp.dataset.gas; }), lab = inp.closest('.hse-gi'); lab.classList.remove('ok', 'warn', 'bad'); if (inp.value !== '') lab.classList.add(g.lvl(+inp.value)); };
      inp.addEventListener('input', f); f();
    });
  }
  function readGas(root, phase) {
    var m = { at: nowISO(), phase: phase }, ok = true;
    $$('[data-gas]', root).forEach(function (i) { if (i.value === '') { ok = false; i.style.borderColor = 'var(--red)'; } else m[i.dataset.gas] = +i.value; });
    var pt = $('[data-gas-point]', root), pr = $('[data-gas-par]', root);
    m.point = pt ? pt.value : ''; m.par = pr ? pr.value : user().name;
    return ok ? m : null;
  }
  function blockedModal(title, rules, extra) {
    ui.modal({ title: title, sub: 'Contrôle de sécurité bloquant', size: 'sm', body: alertBox('red', 'lock', '<b>Action refusée.</b> Les conditions suivantes ne sont pas remplies :') + '<div style="margin-top:12px">' + checklist(rules) + '</div>' + (extra || ''), actions: [{ label: 'Compris', cls: 'primary' }] });
    ui.toast('Action bloquée : condition de sécurité non remplie', 'err');
  }
  function addHist(p, statut, note) { var s = stamp(note); s.statut = statut; p.hist.push(s); }
  function setStatus(p, statut, note, extra) {
    Object.assign(p, extra || {}); p.statut = statut; addHist(p, statut, note); S.save();
    E.log('Permis ' + p.id + ' → ' + statut, TYPES[p.type].s + ' · ' + p.equipement);
  }

  var ACTIONS_PT = {
    prepare: function (p) {
      var req = REQ[p.type] || [], secuSel = Object.keys(p.secu || {}).length ? p.secu : {};
      var epiSel = (p.epi || []).length ? p.epi : EPI_BASE.concat(EPI_TYPE[p.type] || []);
      var body = '<div class="hse-form">' +
        '<h4 class="hse-h4">1. Analyse de risques</h4>' + checkGroup('dg', DANGERS, p.dangers) +
        '<div class="field" style="margin-top:10px"><label>Mesures de prévention décidées *</label><textarea class="textarea" id="pp-mes" placeholder="Isolement, inertage, balisage, coordination…">' + esc(p.mesuresRisques || '') + '</textarea></div>' +
        '<h4 class="hse-h4">2. Mesures de sécurité <span class="muted small">(' + req.length + ' obligatoires pour « ' + esc(TYPES[p.type].s) + ' »)</span></h4>' + checkGroup('sc', SECU, secuSel, req) +
        (p.type === 'FEU' || p.type === 'ESP' || p.type === 'H2S' ? '<div class="field" style="margin-top:10px"><label>Surveillant désigné' + (p.type !== 'H2S' ? ' *' : '') + '</label><select class="select" id="pp-surv"><option value="">— choisir —</option>' + empOpts().map(function (o) { return '<option value="' + o.v + '"' + (o.v === p.surveillant ? ' selected' : '') + '>' + esc(o.l) + '</option>'; }).join('') + '</select></div>' : '') +
        '<h4 class="hse-h4">3. EPI requis</h4>' + checkGroup('epi', EPI, epiSel) +
        '<h4 class="hse-h4">4. Mesure de gaz de préparation ' + (GAS_REQ[p.type] ? '<span class="badge tone-red">obligatoire</span>' : '<span class="muted small">(facultative)</span>') + '</h4>' + gasInputs(null) + '</div>';
      var mo = ui.modal({ title: 'Préparer le permis ' + p.id, sub: TYPES[p.type].l + ' · ' + esc(p.equipement), size: 'lg', body: body, actions: [{ label: 'Annuler' }, { label: 'Enregistrer la préparation', cls: 'primary', icon: 'check', onClick: function (close, root) {
        var dg = readGroup(root, 'dg'), mes = $('#pp-mes', root).value.trim(), gi = $$('[data-gas]', root).some(function (i) { return i.value !== ''; });
        if (!dg.length || !mes) { ui.toast('Cochez au moins un danger et décrivez les mesures de prévention.', 'err'); return; }
        var g = null;
        if (GAS_REQ[p.type] || gi) { g = readGas(root, 'Préparation'); if (!g) { ui.toast('Mesure de gaz incomplète (O₂, LIE, H₂S et CO).', 'err'); return; } }
        var surv = $('#pp-surv', root);
        if (surv && !surv.value && p.type !== 'H2S') { ui.toast('Désignez le surveillant.', 'err'); surv.style.borderColor = 'var(--red)'; return; }
        var secu = {}; readGroup(root, 'sc').forEach(function (k) { secu[k] = true; });
        p.dangers = dg; p.mesuresRisques = mes; p.secu = secu; p.epi = readGroup(root, 'epi'); if (surv) p.surveillant = surv.value;
        if (g) p.gaz.push(g);
        var first = p.statut === 'Demandé';
        if (first) setStatus(p, 'Préparé', 'Analyse de risques et mesures de sécurité renseignées'); else { addHist(p, p.statut, 'Préparation complétée'); S.save(); E.log('Permis ' + p.id + ' — préparation complétée', ''); }
        if (first) E.notify('Permis à autoriser', p.id + ' · ' + TYPES[p.type].s + ' — ' + p.equipement, '#/hse/permis/' + p.id, p.type === 'FEU' ? 'red' : 'orange');
        close(); ui.toast(first ? 'Permis préparé — en attente d\'autorisation' : 'Préparation mise à jour');
        var bad = authChecks(p).filter(function (c) { return !c.ok; });
        if (bad.length) setTimeout(function () { ui.toast('Attention : ' + bad.length + ' contrôle(s) bloqueront l\'autorisation', 'err'); }, 400);
        E.rerender();
      } }] });
      bindGas(mo.el);
    },
    authorize: function (p) {
      if (!isHSE()) { ui.toast('L\'autorisation est réservée aux émetteurs habilités (profil HSE).', 'err'); return; }
      var c = authChecks(p), bad = c.filter(function (x) { return !x.ok; });
      if (bad.length) return blockedModal('Autorisation impossible — ' + p.id, c, GAS_REQ[p.type] ? '<p class="small muted" style="margin:12px 0 0">Corrigez la situation sur le terrain puis enregistrez une nouvelle mesure de gaz conforme (bouton « Mesure de gaz »).</p>' : '');
      var body = alertBox('green', 'check', 'Tous les contrôles de sécurité sont conformes.') + '<div style="margin:12px 0">' + checklist(c) + '</div>' +
        ui.form([{ name: 'emetteur', label: 'Émetteur (exploitation)', type: 'select', options: empOpts(), required: true, value: p.emetteur }, { name: 'responsable', label: 'Responsable de zone', type: 'select', options: empOpts(), required: true, value: p.responsable }]) +
        '<label class="hse-ck" style="margin-top:12px"><input type="checkbox" id="au-ok"><span>Je certifie avoir vérifié sur place la mise en œuvre des mesures de sécurité.</span></label>';
      ui.modal({ title: 'Autoriser le permis ' + p.id, sub: TYPES[p.type].l, body: body, actions: [{ label: 'Annuler' }, { label: 'Signer et autoriser', cls: 'success', icon: 'check', onClick: function (close, root) {
        if (!$('#au-ok', root).checked) { ui.toast('Cochez la certification de vérification sur place.', 'err'); return; }
        var v = ui.readForm(root); if (!v) return;
        p.emetteur = v.emetteur; p.responsable = v.responsable;
        p.sig.emetteur = { nom: E.empName(v.emetteur), at: nowISO() }; p.sig.responsable = { nom: E.empName(v.responsable), at: nowISO() };
        setStatus(p, 'Autorisé', 'Autorisé par ' + E.empName(v.emetteur) + ' et ' + E.empName(v.responsable));
        E.notify('Permis autorisé', p.id + ' — ' + p.equipement, '#/hse/permis/' + p.id, 'green');
        close(); ui.toast('Permis ' + p.id + ' autorisé'); E.rerender();
      } }] });
    },
    open: function (p) {
      var body = '<p class="small muted" style="margin-top:0">Validation sur le terrain avec l\'exécutant : visite des lieux, vérification des mesures, mesure de gaz d\'ouverture.</p>' +
        '<div class="form-grid"><div class="field full"><label>Exécutant (chef d\'équipe) *</label><input class="input" id="op-exe" value="' + esc(p.executant || '') + '" placeholder="Nom et entreprise"></div></div>' +
        '<label class="hse-ck" style="margin:12px 0"><input type="checkbox" id="op-visite"><span>Visite des lieux réalisée avec l\'exécutant, consignes comprises, permis affiché au poste de travail.</span></label>' +
        (GAS_REQ[p.type] ? '<h4 class="hse-h4">Mesure de gaz d\'ouverture <span class="badge tone-red">obligatoire</span></h4>' + gasInputs(null, { point: p.equipement }) : '');
      var mo = ui.modal({ title: 'Ouvrir le permis ' + p.id, sub: TYPES[p.type].l + ' · ' + esc(p.equipement), body: body, actions: [{ label: 'Annuler' }, { label: 'Démarrer les travaux', cls: 'success', icon: 'helmet', onClick: function (close, root) {
        var exe = $('#op-exe', root).value.trim();
        if (!exe || !$('#op-visite', root).checked) { ui.toast('Renseignez l\'exécutant et confirmez la visite des lieux.', 'err'); return; }
        var g = null;
        if (GAS_REQ[p.type]) {
          g = readGas(root, 'Ouverture'); if (!g) { ui.toast('Mesure de gaz d\'ouverture incomplète.', 'err'); return; }
          var r = gasRules(p.type, g, p.secu);
          if (r.some(function (x) { return !x.ok; })) { p.gaz.push(g); S.save(); close(); blockedModal('Ouverture refusée — ' + p.id, r, '<p class="small muted" style="margin:12px 0 0">La mesure a été enregistrée. Les travaux ne peuvent pas démarrer.</p>'); E.log('Ouverture refusée ' + p.id, 'Mesure de gaz non conforme'); E.rerender(); return; }
          p.gaz.push(g);
        }
        p.executant = exe; p.sig.executant = { nom: exe, at: nowISO() };
        var note = '';
        if (toDate(p.debut) > new Date()) { var d0 = hoursBetween(p.debut, p.fin); p.debut = nowISO(); p.fin = shift(p.debut, d0); note = ' (ouverture anticipée, validité recalée : fin ' + fDT(p.fin) + ')'; }
        setStatus(p, 'En cours', 'Ouverture sur le terrain' + (g ? ' — mesure de gaz conforme' : '') + note);
        close(); ui.toast('Travaux démarrés — permis ' + p.id + ' en cours'); E.rerender();
      } }] });
      bindGas(mo.el);
    },
    gas: function (p) {
      var phase = p.statut === 'En cours' ? 'Contrôle' : p.statut === 'Suspendu' ? 'Contrôle' : 'Préparation';
      var mo = ui.modal({ title: 'Mesure de gaz · ' + p.id, sub: 'Saisie de l\'explosimètre 4 gaz — les couleurs indiquent la conformité', body: '<div class="field" style="margin-bottom:12px"><label>Phase</label><select class="select" id="gz-ph">' + ['Préparation', 'Contrôle', 'Ouverture', 'Reprise'].map(function (x) { return '<option' + (x === phase ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' + gasInputs(null, { point: p.equipement }),
        actions: [{ label: 'Annuler' }, { label: 'Enregistrer la mesure', cls: 'primary', icon: 'check', onClick: function (close, root) {
          var g = readGas(root, $('#gz-ph', root).value); if (!g) { ui.toast('Renseignez les 4 valeurs.', 'err'); return; }
          p.gaz.push(g); S.save(); E.log('Mesure de gaz ' + p.id, 'O2 ' + g.o2 + ' % · LIE ' + g.lie + ' % · H2S ' + g.h2s + ' ppm · CO ' + g.co + ' ppm');
          close();
          var bad = GAS_REQ[p.type] ? gasRules(p.type, g, p.secu).filter(function (x) { return !x.ok; }) : (gasWorst(g) === 'bad' ? [{ ok: false, l: 'Seuil dépassé' }] : []);
          if (bad.length && p.statut === 'En cours') {
            p.suspension = { at: nowISO(), par: user().name, motif: 'Alarme gaz / mesure non conforme', note: bad.map(function (x) { return x.l; }).join(' ; ') };
            setStatus(p, 'Suspendu', 'Suspension automatique : mesure de gaz non conforme');
            E.notify('Permis suspendu — alarme gaz', p.id + ' · ' + p.equipement, '#/hse/permis/' + p.id, 'red');
            ui.toast('Mesure non conforme : permis suspendu automatiquement, évacuez la zone', 'err');
          } else ui.toast(bad.length ? 'Mesure enregistrée — non conforme' : 'Mesure de gaz enregistrée — conforme', bad.length ? 'err' : 'ok');
          E.rerender();
        } }] });
      bindGas(mo.el);
    },
    suspend: function (p) {
      ui.formModal({ title: 'Suspendre le permis ' + p.id, sub: 'Arrêt immédiat des travaux, mise en sécurité du chantier', okLabel: 'Suspendre', fields: [
        { name: 'motif', label: 'Motif', type: 'select', options: ['Fin de poste', 'Alarme gaz / détection', 'Alerte météo (orage, vent)', 'Déclenchement POI / POLMAR / alerte sûreté', 'Écart constaté lors d\'une visite', 'Demande de l\'exploitation', 'Autre'], required: true, full: true },
        { name: 'note', label: 'Commentaire', type: 'textarea', placeholder: 'Situation, mise en sécurité réalisée…' }],
        onSubmit: function (v) {
          p.suspension = { at: nowISO(), par: user().name, motif: v.motif, note: v.note };
          setStatus(p, 'Suspendu', v.motif + (v.note ? ' — ' + v.note : ''));
          E.notify('Permis suspendu', p.id + ' — ' + v.motif, '#/hse/permis/' + p.id, 'red');
          ui.toast('Permis suspendu'); E.rerender();
        } });
    },
    resume: function (p) {
      var body = alertBox('yellow', 'info', 'Reprise après suspension (« ' + esc(p.suspension ? p.suspension.motif : '') + ' ») : vérification des lieux' + (GAS_REQ[p.type] ? ' et nouvelle mesure de gaz obligatoire.' : '.')) +
        '<label class="hse-ck" style="margin:12px 0"><input type="checkbox" id="rs-ok"><span>Les conditions ayant motivé la suspension sont levées, l\'équipe a été re-briefée.</span></label>' + (GAS_REQ[p.type] ? gasInputs(null, { point: p.equipement }) : '');
      var mo = ui.modal({ title: 'Reprendre les travaux · ' + p.id, body: body, actions: [{ label: 'Annuler' }, { label: 'Reprendre', cls: 'success', icon: 'refresh', onClick: function (close, root) {
        if (!$('#rs-ok', root).checked) { ui.toast('Confirmez la levée des conditions de suspension.', 'err'); return; }
        if (GAS_REQ[p.type]) {
          var g = readGas(root, 'Reprise'); if (!g) { ui.toast('Mesure de gaz incomplète.', 'err'); return; }
          p.gaz.push(g); var r = gasRules(p.type, g, p.secu);
          if (r.some(function (x) { return !x.ok; })) { S.save(); close(); blockedModal('Reprise refusée — ' + p.id, r); E.rerender(); return; }
        }
        setStatus(p, 'En cours', 'Reprise des travaux après suspension'); close(); ui.toast('Travaux repris'); E.rerender();
      } }] });
      bindGas(mo.el);
    },
    extend: function (p) {
      if (p.prolong.length >= 2) { ui.toast('Nombre maximal de prolongations atteint (2) : établir un nouveau permis.', 'err'); return; }
      var body = ui.form([{ name: 'h', label: 'Prolongation (heures, max 12)', type: 'number', value: 4, min: 1, required: true }, { name: 'motif', label: 'Motif', type: 'text', value: 'Travaux non terminés', required: true }]) +
        '<p class="small muted">Fin actuelle : ' + fDT(p.fin) + '. ' + (GAS_REQ[p.type] ? 'Une mesure de gaz conforme est exigée.' : '') + '</p>' + (GAS_REQ[p.type] ? gasInputs(null, { point: p.equipement }) : '');
      var mo = ui.modal({ title: 'Prolonger le permis ' + p.id, body: body, actions: [{ label: 'Annuler' }, { label: 'Prolonger', cls: 'primary', icon: 'clock', onClick: function (close, root) {
        var v = ui.readForm(root); if (!v) return;
        if (!(v.h > 0 && v.h <= 12)) { ui.toast('La prolongation doit être comprise entre 1 et 12 heures.', 'err'); return; }
        if (GAS_REQ[p.type]) { var g = readGas(root, 'Prolongation'); if (!g) { ui.toast('Mesure de gaz incomplète.', 'err'); return; } p.gaz.push(g); var r = gasRules(p.type, g, p.secu); if (r.some(function (x) { return !x.ok; })) { S.save(); close(); blockedModal('Prolongation refusée — ' + p.id, r); E.rerender(); return; } }
        var base = toDate(p.fin) < new Date() ? nowISO() : p.fin;
        p.prolong.push({ at: nowISO(), h: v.h, motif: v.motif, par: user().name }); p.fin = shift(base, v.h);
        addHist(p, p.statut, 'Prolongé de ' + v.h + ' h (' + v.motif + ') — nouvelle fin ' + fDT(p.fin)); S.save(); E.log('Permis ' + p.id + ' prolongé', v.h + ' h');
        close(); ui.toast('Permis prolongé jusqu\'à ' + fDT(p.fin)); E.rerender();
      } }] });
      bindGas(mo.el);
    },
    close: function (p) {
      var items = RETOUR.slice(); if (p.type === 'FEU') items.push(['ronde', 'Ronde de surveillance post-travaux par point chaud réalisée (1 h)']);
      var body = '<p class="small muted" style="margin-top:0">Retour d\'état : toutes les cases doivent être cochées pour clôturer le permis.</p>' + checkGroup('rt', items, []) +
        '<div class="field" style="margin-top:12px"><label>Observations</label><textarea class="textarea" id="cl-obs" placeholder="État de la zone, réserves…"></textarea></div>';
      ui.modal({ title: 'Clôturer le permis ' + p.id, sub: 'Retour d\'état et restitution à l\'exploitation', body: body, actions: [{ label: 'Annuler' }, { label: 'Clôturer le permis', cls: 'primary', icon: 'check', onClick: function (close, root) {
        var sel = readGroup(root, 'rt'), miss = items.filter(function (i) { return sel.indexOf(i[0]) < 0; });
        if (miss.length) { ui.toast('Retour d\'état incomplet : ' + miss.length + ' point(s) non validé(s).', 'err'); return; }
        p.cloture = { at: nowISO(), par: user().name, retour: sel, obs: $('#cl-obs', root).value || 'Zone restituée propre.' }; p.sig.cloture = { nom: user().name, at: nowISO() };
        setStatus(p, 'Clôturé', 'Retour d\'état : travaux terminés, zone propre'); close(); ui.toast('Permis ' + p.id + ' clôturé'); E.rerender();
      } }] });
    },
    cancel: function (p) { ui.confirm('Annuler le permis ' + p.id, 'Le permis sera annulé et ne pourra plus être utilisé.', 'Annuler le permis', function () { setStatus(p, 'Annulé', 'Permis annulé'); ui.toast('Permis annulé'); E.rerender(); }, 'danger'); },
    print: function (p) { printPermit(p); }
  };

  /* --- nouveau permis */
  function newPermit(pre) {
    pre = pre || {};
    var start = new Date(); start.setDate(start.getDate() + 1); start.setHours(7, 0, 0, 0);
    var fields = [
      { name: 'type', label: 'Type de permis', type: 'select', options: TYPE_KEYS.map(function (k) { return { v: k, l: TYPES[k].l }; }), required: true, full: true, value: pre.type || 'GEN' },
      { name: 'unite', label: 'Zone portuaire', type: 'select', options: uniteOpts(), required: true, value: pre.unite || def('zone') },
      { name: 'equipement', label: 'Équipement / lieu précis', required: true, placeholder: 'ex. Pompe P-104B, bride aspiration' },
      { name: 'description', label: 'Description des travaux', type: 'textarea', required: true },
      { name: 'ot', label: 'Ordre de travail lié', placeholder: 'OT-' + yr() + '-0xxx', value: 'OT-' + yr() + '-0' + (885 + Math.floor(Math.random() * 40)) },
      { name: 'entreprise', label: 'Entreprise intervenante', type: 'select', options: entOpts(), value: 'INT' },
      { name: 'intervenants', label: 'Nombre d\'intervenants', type: 'number', value: 2, min: 1 },
      { name: 'demandeur', label: 'Demandeur', type: 'select', options: empOpts(), value: def('dem'), required: true },
      { name: 'emetteur', label: 'Émetteur pressenti', type: 'select', options: empOpts(), value: def('emi') },
      { name: 'responsable', label: 'Responsable de zone', type: 'select', options: empOpts(), value: def('resp') },
      { name: 'debut', label: 'Début de validité', type: 'datetime-local', value: localISO(start), required: true },
      { name: 'duree', label: 'Durée (heures, max 12)', type: 'number', value: 10, min: 1, required: true }
    ];
    var open = permis().filter(function (p) { return ['Clôturé', 'Annulé'].indexOf(p.statut) < 0; });
    var body = ui.form(fields) + '<div class="field" style="margin-top:14px"><label>Permis associés (cumul de risques, ex. feu + espace confiné, consignation)</label><div class="hse-checks hse-checks--sm">' +
      open.map(function (p) { return '<label class="hse-ck"><input type="checkbox" data-grp="as" value="' + p.id + '"><span><b>' + p.id + '</b> · ' + esc(TYPES[p.type].s) + ' · ' + esc(p.unite + ' ' + p.equipement) + '</span></label>'; }).join('') + '</div></div>';
    ui.modal({ title: 'Nouvelle demande de permis de travail', sub: 'La demande sera ensuite préparée (analyse de risques, mesures) puis autorisée', size: 'lg', body: body, actions: [{ label: 'Annuler' }, { label: 'Créer la demande', cls: 'primary', icon: 'check', onClick: function (close, root) {
      var v = ui.readForm(root); if (!v) return;
      if (!(v.duree > 0 && v.duree <= 12)) { ui.toast('La durée de validité d\'un permis est limitée à 12 heures.', 'err'); $('#f_duree', root).style.borderColor = 'var(--red)'; return; }
      var p = { id: nextId('permis', 'PT-' + yr() + '-', 4), site: SC() || siteOf(v.unite), type: v.type, statut: 'Demandé', unite: v.unite, equipement: v.equipement, description: v.description, ot: v.ot, entreprise: v.entreprise, intervenants: v.intervenants || 1,
        demandeur: v.demandeur, emetteur: v.emetteur, responsable: v.responsable, debut: v.debut, fin: shift(v.debut, v.duree), gaz: [], associes: readGroup(root, 'as'), prolong: [], secu: {}, dangers: [], epi: [], surveillant: '', cree: nowISO(),
        sig: { demandeur: { nom: E.empName(v.demandeur), at: nowISO() } }, hist: [] };
      addHist(p, 'Demandé', 'Demande créée par ' + user().name);
      p.associes.forEach(function (aid) { var a = S.get('permis', aid); if (a) { a.associes = a.associes || []; if (a.associes.indexOf(p.id) < 0) a.associes.push(p.id); } });
      S.add('permis', p); E.log('Demande de permis ' + p.id, TYPES[p.type].s + ' · ' + p.equipement);
      E.notify('Nouvelle demande de permis', p.id + ' · ' + TYPES[p.type].s, '#/hse/permis/' + p.id, 'orange');
      close(); ui.toast('Demande ' + p.id + ' créée'); E.go('hse/permis/' + p.id);
    } }] });
  }

  /* --- impression */
  function printDoc(title, html) {
    ui.modal({ title: title, size: 'lg', body: html, actions: [{ label: 'Fermer' }, { label: 'Imprimer', cls: 'primary', icon: 'print', onClick: function () { document.body.classList.add('hse-printing'); window.print(); setTimeout(function () { document.body.classList.remove('hse-printing'); }, 500); } }] });
  }
  /* en-tête des documents imprimables : le port du document (ou de l'espace actif) */
  function docHead(title, sub, ref, st, site) {
    site = site || SC();
    return '<div class="doc__head"><div class="row" style="align-items:center"><img src="../assets/img/logo.png" alt="GPM"><div><b style="font-size:15px">Gabon Port Management</b><div class="small muted">' + esc(portLong(site)) + ' · Service HSE' + (site === 'POG' ? ' de l\'agence' : '') + '</div></div></div>' +
      '<div class="right"><h4>' + esc(title) + '</h4><div class="small">' + esc(sub) + '</div><div class="mono" style="margin-top:4px">' + esc(ref) + '</div>' + (st ? '<div style="margin-top:4px">' + st + '</div>' : '') + '</div></div>';
  }
  function printPermit(p) {
    var t = TYPES[p.type], box = function (on) { return '<span class="hse-box">' + (on ? '✕' : '') + '</span>'; };
    var html = '<div class="doc hse-doc" style="--c:' + t.c + '">' + docHead(t.l.toUpperCase(), 'Permis de travail — à afficher sur le lieu de travail', p.id, stBadge(p.statut), p.site || siteOf(p.unite)) +
      '<div class="hse-dsec"><h5>1. Identification des travaux</h5><table class="hse-dt"><tr><th>Zone portuaire</th><td>' + esc(p.unite + ' · ' + uName(p.unite)) + '</td><th>Ordre de travail</th><td>' + esc(p.ot) + '</td></tr>' +
      '<tr><th>Équipement</th><td colspan="3">' + esc(p.equipement) + '</td></tr><tr><th>Description</th><td colspan="3">' + esc(p.description) + '</td></tr>' +
      '<tr><th>Entreprise</th><td>' + esc(ent(p.entreprise)) + ' (' + (p.intervenants || 1) + ' pers.)</td><th>Demandeur</th><td>' + esc(E.empName(p.demandeur)) + '</td></tr>' +
      '<tr><th>Validité du</th><td>' + fDT(p.debut) + '</td><th>au</th><td>' + fDT(p.fin) + (p.prolong.length ? ' (prolongé)' : '') + '</td></tr></table></div>' +
      '<div class="hse-dsec"><h5>2. Analyse de risques</h5><div class="hse-dgrid">' + DANGERS.map(function (d) { return '<div>' + box((p.dangers || []).indexOf(d[0]) >= 0) + esc(d[1]) + '</div>'; }).join('') + '</div><p><b>Mesures :</b> ' + esc(p.mesuresRisques || '—') + '</p></div>' +
      '<div class="hse-dsec"><h5>3. Mesures de sécurité</h5><div class="hse-dgrid two">' + SECU.map(function (s) { return '<div>' + box(p.secu[s[0]]) + esc(s[1]) + ((REQ[p.type] || []).indexOf(s[0]) >= 0 ? ' <b>*</b>' : '') + '</div>'; }).join('') + '</div><p class="small">* obligatoire pour ce type de permis' + (p.surveillant ? ' · Surveillant : <b>' + esc(E.empName(p.surveillant)) + '</b>' : '') + '</p></div>' +
      '<div class="hse-dsec"><h5>4. Mesures de gaz</h5><div class="hse-dscroll"><table class="hse-dt c"><tr><th>Heure</th><th>Phase</th><th>O₂ %</th><th>LIE %</th><th>H₂S ppm</th><th>CO ppm</th><th>Opérateur</th><th>Visa</th></tr>' +
      (p.gaz.length ? p.gaz.map(function (m) { return '<tr><td>' + fDT(m.at) + '</td><td>' + esc(m.phase) + '</td>' + GAS.map(function (g) { return '<td class="gz-' + g.lvl(m[g.k]) + '">' + num(m[g.k]) + '</td>'; }).join('') + '<td>' + esc(m.par) + '</td><td></td></tr>'; }).join('') : '') +
      '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr></table></div><p class="small">Seuils : O₂ 19,5–23,5 % · LIE 0 % pour tout point chaud (&lt; 10 % sinon) · H₂S &lt; 1 ppm (&lt; 5 ppm sous ARI) · CO &lt; 20 ppm.</p></div>' +
      '<div class="hse-dsec"><h5>5. EPI requis</h5><div class="hse-dgrid">' + EPI.map(function (e) { return '<div>' + box((p.epi || []).indexOf(e[0]) >= 0) + esc(e[1]) + '</div>'; }).join('') + '</div>' +
      ((p.associes || []).length ? '<p><b>Permis associés :</b> ' + p.associes.map(function (a) { var x = S.get('permis', a); return a + (x ? ' (' + TYPES[x.type].s + ')' : ''); }).join(', ') + '</p>' : '') + '</div>' +
      '<div class="hse-dsec"><h5>6. Signatures</h5><div class="hse-dsigs">' + [['Demandeur', p.sig.demandeur], ['Émetteur', p.sig.emetteur], ['Responsable de zone', p.sig.responsable], ['Exécutant', p.sig.executant], ['Clôture / retour d\'état', p.sig.cloture]].map(function (s) { return '<div><span>' + s[0] + '</span><b>' + (s[1] ? esc(s[1].nom) : '') + '</b><em>' + (s[1] ? fDT(s[1].at) : 'Date / heure :') + '</em><i>Signature</i></div>'; }).join('') + '</div></div>' +
      '<p class="hse-dfoot">Toute alarme gaz, alerte POI / POLMAR, changement de niveau de sûreté ou modification des conditions entraîne l\'arrêt immédiat des travaux et la suspension du permis. Validité maximale 12 h. Document généré le ' + fDT(nowISO()) + '.</p></div>';
    printDoc('Aperçu du permis ' + p.id, html);
  }

  /* ------------------------------------------------------------------ Plans de prévention */
  var PDP_COLS = [
    { label: 'N°', render: function (p) { return '<b class="nowrap">' + p.id + '</b>'; }, csv: function (p) { return p.id; } },
    { label: 'Entreprise · travaux', render: function (p) { return '<div class="hse-cell"><b>' + esc(ent(p.entreprise)) + '</b><div class="small muted">' + esc(p.travaux) + '</div></div>'; }, csv: function (p) { return ent(p.entreprise) + ' — ' + p.travaux; } },
    { label: 'Zones', render: function (p) { return esc(p.zones.length > 4 ? 'Tout le site' : p.zones.join(', ')); }, csv: function (p) { return p.zones.join(' '); } },
    { label: 'Période', render: function (p) { var d = pdpDaysLeft(p); return '<span class="nowrap">' + fmt.dateShort(p.debut) + ' → ' + fmt.dateShort(p.fin) + '</span>' + (p.statut === 'Actif' && d <= 15 ? '<div><span class="badge tone-' + (d < 0 ? 'red' : 'orange') + '">' + (d < 0 ? 'Échu' : 'Expire dans ' + d + ' j') + '</span></div>' : ''); }, csv: function (p) { return p.debut + ' - ' + p.fin; } },
    { label: 'Effectif', num: true, render: function (p) { return p.effectif; }, csv: function (p) { return p.effectif; } },
    { label: 'Accueil sécurité', render: function (p) { return ui.progress((p.accueil.personnes || 0) / p.effectif * 100, p.accueil.personnes >= p.effectif ? 'green' : 'orange'); }, csv: function (p) { return p.accueil.personnes + '/' + p.effectif; } },
    { label: 'Statut', render: function (p) { return ui.badge(p.statut, PDP_TONE[p.statut]); }, csv: function (p) { return p.statut; } }
  ];
  function tabPDP(el) {
    var all = S.all('plansPrevention'), st = state.pdp, exp = pdpExpiring();
    var act = all.filter(function (p) { return p.statut === 'Actif'; });
    el.innerHTML = '<div class="grid g4">' +
      ui.kpi({ label: 'Plans actifs', value: act.length, icon: 'doc', tone: 'green', foot: E.sum(act, 'effectif') + ' intervenants extérieurs sur site' }) +
      ui.kpi({ label: 'À signer', value: all.filter(function (p) { return p.statut === 'Inspection commune'; }).length, icon: 'edit', tone: 'orange', foot: 'après inspection commune' }) +
      ui.kpi({ label: 'Expirent sous 15 jours', value: exp.length, icon: 'calendar', tone: exp.length ? 'red' : 'grey', foot: exp.map(function (p) { return p.id; }).join(', ') || '—' }) +
      ui.kpi({ label: 'Entreprises extérieures', value: Object.keys(E.groupBy(all.filter(function (p) { return p.statut !== 'Expiré'; }), 'entreprise')).length, icon: 'users', tone: 'blue', foot: 'avec un plan en cours' }) + '</div>' +
      (exp.length || all.some(function (p) { return p.statut === 'Expiré'; }) ? '<div class="stack" style="margin-top:16px;gap:8px">' + exp.map(function (p) { return alertBox('orange', 'calendar', '<b>' + p.id + '</b> — ' + esc(ent(p.entreprise)) + ' : le plan expire le ' + fmt.date(p.fin) + ' (' + pdpDaysLeft(p) + ' j). Prolonger ou préparer le renouvellement.'); }).join('') +
        all.filter(function (p) { return p.statut === 'Expiré'; }).map(function (p) { return alertBox('red', 'alert', '<b>' + p.id + '</b> — ' + esc(ent(p.entreprise)) + ' : plan expiré depuis le ' + fmt.date(p.fin) + '. Aucune intervention autorisée sans renouvellement.'); }).join('') + '</div>' : '') +
      '<div class="card" style="margin-top:16px"><div class="card__h"><h3>Plans de prévention — entreprises extérieures</h3><div class="spacer"></div><button class="btn sm" id="pdp-csv">' + icon('download') + 'Export CSV</button><button class="btn primary sm" id="pdp-new">' + icon('plus') + 'Nouveau plan</button></div>' +
      '<div class="card__b" style="padding-bottom:0"><div class="chips" id="pdp-st" style="margin-bottom:14px">' + [''].concat(PDP_FLOW).map(function (s) { return '<button class="chip' + (st.st === s ? ' is-active' : '') + '" data-k="' + s + '">' + (s || 'Tous') + '</button>'; }).join('') + '</div></div><div id="pdp-list"></div></div>';
    function rows() { return all.filter(function (p) { return !st.st || p.statut === st.st; }).sort(function (a, b) { return PDP_FLOW.indexOf(a.statut) - PDP_FLOW.indexOf(b.statut) || a.fin.localeCompare(b.fin); }); }
    function draw() { $('#pdp-list', el).innerHTML = ui.table(PDP_COLS, rows(), { onRow: function (p) { E.go('hse/prevention/' + p.id); } }); }
    draw();
    $$('#pdp-st .chip', el).forEach(function (b) { b.onclick = function () { st.st = b.dataset.k; $$('#pdp-st .chip', el).forEach(function (x) { x.classList.toggle('is-active', x === b); }); draw(); }; });
    $('#pdp-csv', el).onclick = function () { ui.exportCSV('plans-de-prevention', PDP_COLS, rows()); };
    $('#pdp-new', el).onclick = newPDP;
  }
  function newPDP() {
    ui.formModal({ title: 'Nouveau plan de prévention', sub: 'Intervention d\'une entreprise extérieure', size: 'lg', okLabel: 'Créer le brouillon', fields: [
      { name: 'entreprise', label: 'Entreprise extérieure', type: 'select', options: E.options('fournisseurs'), required: true },
      { name: 'respEE', label: 'Responsable de l\'entreprise', required: true, placeholder: 'Nom, fonction' },
      { name: 'travaux', label: 'Nature des travaux', type: 'textarea', required: true },
      { name: 'chantier', label: 'Chantier / projet', value: 'Programme de modernisation' },
      { name: 'zone', label: 'Zone principale', type: 'select', options: uniteOpts(), value: def('zone') },
      { name: 'debut', label: 'Début', type: 'date', value: D(7), required: true }, { name: 'fin', label: 'Fin', type: 'date', value: D(60), required: true },
      { name: 'effectif', label: 'Effectif prévu', type: 'number', value: 6, min: 1, required: true },
      { name: 'respSOG', label: 'Donneur d\'ordre GPM', type: 'select', options: empOpts(), value: def('sog') }],
      onSubmit: function (v) {
        if (v.fin <= v.debut) { ui.toast('La date de fin doit être postérieure au début.', 'err'); return false; }
        var p = { id: nextId('plansPrevention', 'PDP-' + yr() + '-', 3), site: SC() || siteOf(v.zone), entreprise: v.entreprise, travaux: v.travaux, chantier: v.chantier, zones: [v.zone], debut: v.debut, fin: v.fin, effectif: v.effectif, respEE: v.respEE, respSOG: v.respSOG, statut: 'Brouillon',
          inspection: { date: '', participants: [], obs: '' }, interferences: [], habilitations: [{ l: 'Aptitude médicale à jour', ok: false }, { l: 'Formations / habilitations requises pour les travaux', ok: false }, { l: 'Sensibilisation H₂S / port de l\'ARI', ok: false }], accueil: { date: '', personnes: 0 }, sig: {}, hist: [stamp('Brouillon créé')] };
        S.add('plansPrevention', p); E.log('Plan de prévention ' + p.id + ' créé', ent(p.entreprise)); ui.toast('Plan ' + p.id + ' créé'); E.go('hse/prevention/' + p.id);
      } });
  }
  function viewPDP(el, id) {
    var p = S.get('plansPrevention', id);
    if (!p) { el.innerHTML = '<div class="card empty">Plan introuvable. <a href="#/hse/prevention">Retour</a></div>'; return; }
    var idx = PDP_FLOW.indexOf(p.statut), d = pdpDaysLeft(p), tot = Math.max(1, E.daysBetween(p.debut, p.fin)), el0 = E.daysBetween(p.debut, E.today());
    var habOk = p.habilitations.every(function (h) { return h.ok; });
    var btns = [];
    if (p.statut === 'Brouillon') btns.push(['insp', 'primary', 'users', 'Réaliser l\'inspection commune']);
    if (p.statut === 'Inspection commune') btns.push(['sign', 'success', 'edit', 'Signer le plan']);
    if (p.statut === 'Signé') btns.push(['start', 'success', 'helmet', 'Démarrer le chantier']);
    if (p.statut === 'Actif') { btns.push(['extend', '', 'clock', 'Prolonger']); btns.push(['expire', 'danger', 'x', 'Clôturer le plan']); }
    if (p.statut === 'Expiré') btns.push(['renew', 'primary', 'refresh', 'Renouveler']);
    if (p.statut !== 'Expiré') { btns.push(['risk', '', 'plus', 'Risque d\'interférence']); btns.push(['welcome', '', 'userplus', 'Accueil sécurité']); }
    btns.push(['print', 'ghost', 'print', 'Aperçu imprimable']);
    var html = '<a class="btn ghost sm" href="#/hse/prevention" style="margin-bottom:10px">' + icon('back') + 'Plans de prévention</a>' +
      '<div class="card"><div class="card__b"><div class="row" style="align-items:flex-start"><div class="hse-ph__ic" style="--c:#0e7490">' + icon('doc') + '</div><div style="flex:1;min-width:0"><div class="row" style="gap:8px"><h3 class="hse-ph__t">' + esc(ent(p.entreprise)) + '</h3>' + ui.badge(p.statut, PDP_TONE[p.statut]) + '</div><div class="mono" style="margin:3px 0 6px">' + p.id + ' · ' + esc(p.chantier || '') + '</div><div>' + esc(p.travaux) + '</div></div></div>' +
      '<div class="row hse-ph__btns">' + btns.map(function (b) { return '<button class="btn ' + b[1] + '" data-do="' + b[0] + '">' + icon(b[2]) + esc(b[3]) + '</button>'; }).join('') + '</div></div>' +
      '<div class="card__b" style="border-top:1px solid var(--line-2)">' + ui.steps(PDP_FLOW, idx, { rejected: p.statut === 'Expiré' }) + '</div></div>';
    if (p.statut === 'Actif' && d <= 15) html += alertBox(d < 0 ? 'red' : 'orange', 'calendar', 'Le plan ' + (d < 0 ? 'est échu depuis ' + (-d) + ' j' : 'expire dans <b>' + d + ' jours</b>') + ' (' + fmt.date(p.fin) + ').');
    html += '<div class="grid g-2-1" style="margin-top:16px"><div class="stack">' +
      '<div class="card"><div class="card__h"><h3>Informations générales</h3></div><div class="card__b"><dl class="kv"><dt>Entreprise extérieure</dt><dd>' + esc(ent(p.entreprise)) + '</dd><dt>Responsable EE</dt><dd>' + esc(p.respEE) + '</dd><dt>Donneur d\'ordre GPM</dt><dd>' + esc(E.empName(p.respSOG)) + '</dd>' +
      '<dt>Zones d\'intervention</dt><dd>' + p.zones.map(function (z) { return esc(z + ' · ' + uName(z)); }).join('<br>') + '</dd><dt>Période</dt><dd>' + fmt.date(p.debut) + ' → ' + fmt.date(p.fin) + '</dd><dt>Effectif</dt><dd>' + p.effectif + ' personnes</dd></dl>' +
      '<div style="margin-top:14px">' + ui.progress(Math.max(0, Math.min(100, el0 / tot * 100)), p.statut === 'Expiré' ? 'red' : d <= 15 ? 'orange' : '') + '<div class="small muted">Avancement de la période</div></div></div></div>' +
      '<div class="card"><div class="card__h"><h3>Inspection commune préalable</h3></div><div class="card__b">' + (p.inspection.date ? '<dl class="kv"><dt>Date</dt><dd>' + fmt.date(p.inspection.date) + '</dd><dt>Participants</dt><dd>' + p.inspection.participants.map(esc).join('<br>') + '</dd><dt>Observations</dt><dd>' + esc(p.inspection.obs || '—') + '</dd></dl>' : '<div class="muted">Inspection commune non encore réalisée.</div>') + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Risques d\'interférence et mesures</h3><span class="sub">' + p.interferences.length + ' risque(s)</span></div>' + ui.table([{ label: 'Risque', key: 'risque' }, { label: 'Mesure de prévention', key: 'mesure' }, { label: 'À la charge de', render: function (r) { return ui.badge(r.charge === 'EE' ? 'Entreprise ext.' : 'GPM', r.charge === 'EE' ? 'violet' : 'navy'); } }], p.interferences, { empty: 'Aucun risque d\'interférence identifié' }) + '</div></div>' +
      '<div class="stack"><div class="card"><div class="card__h"><h3>Habilitations vérifiées</h3>' + (habOk ? '<span class="badge tone-green">Complet</span>' : '<span class="badge tone-orange">À vérifier</span>') + '</div><div class="card__b"><div class="hse-checks one">' +
      p.habilitations.map(function (h, i) { return '<label class="hse-ck"><input type="checkbox" data-hab="' + i + '"' + (h.ok ? ' checked' : '') + (p.statut === 'Expiré' ? ' disabled' : '') + '><span>' + esc(h.l) + '</span></label>'; }).join('') + '</div></div></div>' +
      '<div class="card"><div class="card__h"><h3>Accueil sécurité</h3></div><div class="card__b"><div class="hse-big">' + (p.accueil.personnes || 0) + '<small> / ' + p.effectif + ' personnes</small></div>' + ui.progress((p.accueil.personnes || 0) / p.effectif * 100, p.accueil.personnes >= p.effectif ? 'green' : 'orange') + '<div class="small muted">' + (p.accueil.date ? 'Dernière session le ' + fmt.date(p.accueil.date) : 'Aucune session enregistrée') + '</div></div></div>' +
      '<div class="card"><div class="card__h"><h3>Signatures</h3></div><div class="card__b hse-sigs">' + sigBox('Donneur d\'ordre (GPM)', p.sig.gpm) + sigBox('Entreprise extérieure', p.sig.ee) + '</div></div>' +
      ((p.hist || []).length ? '<div class="card"><div class="card__h"><h3>Historique</h3></div><div class="card__b"><div class="timeline">' + p.hist.slice().reverse().map(function (h) { return '<div class="tl-item done"><b>' + fDT(h.at) + '</b><span>' + esc(h.par) + ' — ' + esc(h.note) + '</span></div>'; }).join('') + '</div></div></div>' : '') +
      '</div></div>';
    el.innerHTML = html;
    var save = function (note, statut) { if (statut) p.statut = statut; p.hist = p.hist || []; p.hist.push(stamp(note)); S.save(); E.log('Plan de prévention ' + p.id, note); };
    $$('[data-hab]', el).forEach(function (c) { c.onchange = function () { p.habilitations[+c.dataset.hab].ok = c.checked; save((c.checked ? 'Habilitation vérifiée : ' : 'Habilitation à revoir : ') + p.habilitations[+c.dataset.hab].l); E.rerender(); }; });
    var A = {
      insp: function () { ui.formModal({ title: 'Inspection commune préalable', sub: p.id + ' · ' + ent(p.entreprise), fields: [{ name: 'date', label: 'Date de l\'inspection', type: 'date', value: E.today(), required: true }, { name: 'participants', label: 'Participants (un par ligne)', type: 'textarea', required: true, value: user().name + ' (HSE)\n' + E.empName(p.respSOG) + ' (donneur d\'ordre)\n' + p.respEE }, { name: 'obs', label: 'Observations / consignes', type: 'textarea' }],
        onSubmit: function (v) { p.inspection = { date: v.date, participants: v.participants.split('\n').map(function (s) { return s.trim(); }).filter(Boolean), obs: v.obs }; save('Inspection commune réalisée', 'Inspection commune'); E.notify('Plan de prévention à signer', p.id + ' · ' + ent(p.entreprise), '#/hse/prevention/' + p.id, 'orange'); ui.toast('Inspection commune enregistrée'); E.rerender(); } }); },
      sign: function () {
        var c = [{ ok: !!p.inspection.date, l: 'Inspection commune réalisée' }, { ok: p.interferences.length > 0, l: 'Risques d\'interférence analysés (' + p.interferences.length + ')' }, { ok: habOk, l: 'Habilitations vérifiées (' + p.habilitations.filter(function (h) { return h.ok; }).length + '/' + p.habilitations.length + ')' }];
        if (c.some(function (x) { return !x.ok; })) return blockedModal('Signature impossible — ' + p.id, c);
        ui.confirm('Signer le plan ' + p.id, 'Signature conjointe du donneur d\'ordre GPM (' + esc(user().name) + ') et de l\'entreprise extérieure (' + esc(p.respEE) + ').', 'Signer', function () { p.sig = { gpm: { nom: user().name, at: nowISO() }, ee: { nom: p.respEE.split(' (')[0], at: nowISO() } }; save('Plan signé par les deux parties', 'Signé'); ui.toast('Plan de prévention signé'); E.rerender(); }, 'success');
      },
      start: function () {
        var c = [{ ok: (p.accueil.personnes || 0) >= p.effectif, l: 'Accueil sécurité de tout l\'effectif (' + (p.accueil.personnes || 0) + '/' + p.effectif + ')' }, { ok: p.debut <= E.addDays(E.today(), 1), l: 'Date de début atteinte (' + fmt.date(p.debut) + ')' }];
        if (c.some(function (x) { return !x.ok; })) return blockedModal('Démarrage impossible — ' + p.id, c);
        save('Chantier démarré — plan actif', 'Actif'); ui.toast('Plan actif'); E.rerender();
      },
      extend: function () { ui.formModal({ title: 'Prolonger le plan ' + p.id, fields: [{ name: 'fin', label: 'Nouvelle date de fin', type: 'date', value: E.addDays(p.fin, 30), required: true }], onSubmit: function (v) { if (v.fin <= p.fin) { ui.toast('La nouvelle date doit être postérieure.', 'err'); return false; } save('Prolongé du ' + fmt.date(p.fin) + ' au ' + fmt.date(v.fin)); p.fin = v.fin; S.save(); ui.toast('Plan prolongé'); E.rerender(); } }); },
      expire: function () { ui.confirm('Clôturer le plan ' + p.id, 'Le plan passera au statut « Expiré » : l\'entreprise ne pourra plus intervenir.', 'Clôturer', function () { save('Plan clôturé', 'Expiré'); ui.toast('Plan clôturé'); E.rerender(); }, 'danger'); },
      renew: function () {
        var n = E.clone(p); n.id = nextId('plansPrevention', 'PDP-' + yr() + '-', 3); n.statut = 'Brouillon'; n.debut = E.today(); n.fin = E.addDays(E.today(), Math.max(30, tot)); n.inspection = { date: '', participants: [], obs: '' }; n.accueil = { date: '', personnes: 0 }; n.sig = {}; n.habilitations.forEach(function (h) { h.ok = false; }); n.hist = [stamp('Renouvellement de ' + p.id)];
        S.add('plansPrevention', n); E.log('Renouvellement ' + p.id + ' → ' + n.id, ''); ui.toast('Brouillon ' + n.id + ' créé'); E.go('hse/prevention/' + n.id);
      },
      risk: function () { ui.formModal({ title: 'Ajouter un risque d\'interférence', fields: [{ name: 'risque', label: 'Risque', required: true, full: true }, { name: 'mesure', label: 'Mesure de prévention', type: 'textarea', required: true }, { name: 'charge', label: 'À la charge de', type: 'select', options: [{ v: 'GPM', l: 'GPM' }, { v: 'EE', l: 'Entreprise extérieure' }] }], onSubmit: function (v) { p.interferences.push(v); save('Risque ajouté : ' + v.risque); ui.toast('Risque ajouté'); E.rerender(); } }); },
      welcome: function () { ui.formModal({ title: 'Session d\'accueil sécurité', sub: 'Consignes du port, sûreté ISPS, POI, permis de travail', fields: [{ name: 'date', label: 'Date', type: 'date', value: E.today(), required: true }, { name: 'n', label: 'Nombre de personnes accueillies', type: 'number', value: Math.max(1, p.effectif - (p.accueil.personnes || 0)), min: 1, required: true }], onSubmit: function (v) { p.accueil = { date: v.date, personnes: Math.min(p.effectif, (p.accueil.personnes || 0) + v.n) }; save('Accueil sécurité : ' + v.n + ' personne(s)'); ui.toast('Accueil enregistré'); E.rerender(); } }); },
      print: function () { printPDP(p); }
    };
    $$('[data-do]', el).forEach(function (b) { b.onclick = function () { A[b.dataset.do](); }; });
  }
  function printPDP(p) {
    var html = '<div class="doc hse-doc">' + docHead('PLAN DE PRÉVENTION', 'Intervention d\'une entreprise extérieure', p.id, ui.badge(p.statut, PDP_TONE[p.statut]), p.site || siteOf(p.zones[0])) +
      '<div class="hse-dsec"><h5>1. Parties et travaux</h5><table class="hse-dt"><tr><th>Entreprise utilisatrice</th><td>Gabon Port Management — ' + ((p.site || siteOf(p.zones[0])) === 'POG' ? 'port de Port-Gentil' : 'port d\'Owendo') + '</td><th>Donneur d\'ordre</th><td>' + esc(E.empName(p.respSOG)) + '</td></tr><tr><th>Entreprise extérieure</th><td>' + esc(ent(p.entreprise)) + '</td><th>Responsable</th><td>' + esc(p.respEE) + '</td></tr>' +
      '<tr><th>Travaux</th><td colspan="3">' + esc(p.travaux) + '</td></tr><tr><th>Zones</th><td>' + esc(p.zones.join(', ')) + '</td><th>Période</th><td>' + fmt.date(p.debut) + ' → ' + fmt.date(p.fin) + '</td></tr><tr><th>Effectif</th><td>' + p.effectif + ' personnes</td><th>Accueil sécurité</th><td>' + (p.accueil.personnes || 0) + ' / ' + p.effectif + '</td></tr></table></div>' +
      '<div class="hse-dsec"><h5>2. Inspection commune préalable</h5><p>' + (p.inspection.date ? 'Réalisée le ' + fmt.date(p.inspection.date) + ' — ' + p.inspection.participants.map(esc).join(' ; ') + '<br>' + esc(p.inspection.obs || '') : 'Non réalisée.') + '</p></div>' +
      '<div class="hse-dsec"><h5>3. Risques d\'interférence et mesures de prévention</h5><table class="hse-dt"><tr><th>Risque</th><th>Mesure</th><th>Charge</th></tr>' + p.interferences.map(function (r) { return '<tr><td>' + esc(r.risque) + '</td><td>' + esc(r.mesure) + '</td><td>' + (r.charge === 'EE' ? 'EE' : 'GPM') + '</td></tr>'; }).join('') + '</table></div>' +
      '<div class="hse-dsec"><h5>4. Habilitations et aptitudes</h5><div class="hse-dgrid two">' + p.habilitations.map(function (h) { return '<div><span class="hse-box">' + (h.ok ? '✕' : '') + '</span>' + esc(h.l) + '</div>'; }).join('') + '</div></div>' +
      '<div class="hse-dsec"><h5>5. Signatures</h5><div class="hse-dsigs">' + [['Donneur d\'ordre GPM', p.sig.gpm], ['Entreprise extérieure', p.sig.ee], ['Service HSE', null]].map(function (s) { return '<div><span>' + s[0] + '</span><b>' + (s[1] ? esc(s[1].nom) : '') + '</b><em>' + (s[1] ? fDT(s[1].at) : 'Date :') + '</em><i>Signature</i></div>'; }).join('') + '</div></div></div>';
    printDoc('Aperçu du plan ' + p.id, html);
  }

  /* ------------------------------------------------------------------ Événements */
  var EV_COLS = [
    { label: 'N°', render: function (i) { return '<b class="nowrap">' + i.id + '</b>'; }, csv: function (i) { return i.id; } },
    { label: 'Date', render: function (i) { return '<span class="nowrap">' + fmt.dateShort(i.date) + ' ' + esc(i.heure) + '</span>'; }, csv: function (i) { return i.date + ' ' + i.heure; } },
    { label: 'Type', render: function (i) { return evBadge(i.type); }, csv: function (i) { return EVT[i.type].l; } },
    { label: 'Événement', render: function (i) { return '<div class="hse-cell"><b>' + esc(i.titre) + '</b><div class="small muted">' + esc(i.unite + ' · ' + i.lieu) + '</div></div>'; }, csv: function (i) { return i.titre; } },
    { label: 'Gravité', render: function (i) { return gravBadge(i.gravite); }, csv: function (i) { return GRAV[i.gravite]; } },
    { label: 'Actions', render: function (i) { var a = S.all('actionsHSE').filter(function (x) { return x.source === i.id; }); if (!a.length) return '<span class="muted small">—</span>'; var l = a.filter(actLate).length; return '<span class="nowrap">' + a.filter(function (x) { return x.statut === 'Réalisée'; }).length + '/' + a.length + (l ? ' <span class="badge tone-red">' + l + ' en retard</span>' : '') + '</span>'; }, csv: function (i) { return S.all('actionsHSE').filter(function (x) { return x.source === i.id; }).length; } },
    { label: 'Statut', render: function (i) { return ui.badge(i.statut, EV_TONE[i.statut]); }, csv: function (i) { return i.statut; } }
  ];
  function tabEvents(el) {
    var all = S.all('incidents'), st = state.ev, r = rates();
    var by = E.groupBy(r.inc, 'type');
    el.innerHTML = '<div class="hse-evk">' + Object.keys(EVT).map(function (k) { var t = EVT[k]; return '<button class="hse-evt' + (st.type === k ? ' on' : '') + '" data-t="' + k + '" style="--c:' + t.c + '">' + icon(t.ic) + '<b>' + ((by[k] || []).length) + '</b><span>' + esc(t.l) + '</span></button>'; }).join('') + '</div>' +
      '<div class="card" style="margin-top:16px"><div class="card__h"><h3>Registre des événements HSE</h3><span class="sub">12 derniers mois</span><div class="spacer"></div><button class="btn sm" id="ev-csv">' + icon('download') + 'Export CSV</button><button class="btn danger sm" id="ev-new">' + icon('alert') + 'Déclarer</button></div>' +
      '<div class="card__b" style="padding-bottom:0"><div class="filters"><input class="input" id="ev-q" placeholder="Rechercher (lieu, description…)" value="' + esc(st.q) + '">' + (st.type ? '<button class="btn ghost sm" id="ev-all">' + icon('x') + esc(EVT[st.type].l) + '</button>' : '') + '</div></div><div id="ev-list"></div></div>';
    function rows() { var q = E.norm(st.q); return all.filter(function (i) { return (!st.type || i.type === st.type) && (!q || E.norm([i.id, i.titre, i.description, i.lieu, i.unite].join(' ')).indexOf(q) >= 0); }).sort(function (a, b) { return b.date.localeCompare(a.date); }); }
    function draw() { $('#ev-list', el).innerHTML = ui.table(EV_COLS, rows(), { onRow: function (i) { E.go('hse/evenements/' + i.id); }, empty: 'Aucun événement' }); }
    draw();
    $('#ev-q', el).oninput = function (e) { st.q = e.target.value; draw(); };
    $$('.hse-evt', el).forEach(function (b) { b.onclick = function () { st.type = st.type === b.dataset.t ? '' : b.dataset.t; tabEvents(el); }; });
    if ($('#ev-all', el)) $('#ev-all', el).onclick = function () { st.type = ''; tabEvents(el); };
    $('#ev-csv', el).onclick = function () { ui.exportCSV('evenements-hse', EV_COLS, rows()); };
    $('#ev-new', el).onclick = declareEvent;
  }
  function declareEvent() {
    var body = '<div class="hse-decl"><div class="field"><label>Type d\'événement *</label><div class="hse-tiles">' + Object.keys(EVT).map(function (k, i) { var t = EVT[k]; return '<label class="hse-tile" style="--c:' + t.c + '"><input type="radio" name="evtype" value="' + k + '"' + (k === 'SD' ? ' checked' : '') + '>' + icon(t.ic) + '<span>' + esc(t.l) + '</span></label>'; }).join('') + '</div></div>' +
      '<div class="field"><label>Gravité (réelle ou potentielle) *</label><div class="hse-seg">' + [1, 2, 3, 4].map(function (g) { return '<label class="g' + g + '"><input type="radio" name="evgrav" value="' + g + '"' + (g === 2 ? ' checked' : '') + '><span>' + GRAV[g] + '</span></label>'; }).join('') + '</div></div>' +
      '<div class="form-grid"><div class="field"><label>Date et heure *</label><input class="input" type="datetime-local" id="ev-dt" value="' + nowISO() + '"></div><div class="field"><label>Zone *</label><select class="select" id="ev-u">' + uniteOpts().map(function (o) { return '<option value="' + o.v + '">' + esc(o.l) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field full"><label>Lieu précis *</label><input class="input" id="ev-lieu" placeholder="ex. Pompe P-104B, passerelle +8 m"></div>' +
      '<div class="field full"><label>Que s\'est-il passé ? *</label><textarea class="textarea" id="ev-desc" placeholder="Décrivez les faits, sans chercher de coupable."></textarea></div>' +
      '<div class="field full"><label>Mesures immédiates prises</label><input class="input" id="ev-imm" placeholder="Balisage, arrêt, mise en sécurité…"></div></div>' +
      '<label class="hse-ck" style="margin-top:12px"><input type="checkbox" id="ev-bl"><span>Une personne a été blessée</span></label>' +
      '<div class="form-grid hide" id="ev-vic" style="margin-top:10px"><div class="field"><label>Victime</label><select class="select" id="ev-v"><option value="">— Personne extérieure / non listée —</option>' + empOpts().map(function (o) { return '<option value="' + o.v + '">' + esc(o.l) + '</option>'; }).join('') + '</select></div><div class="field"><label>Jours d\'arrêt (si connus)</label><input class="input" type="number" min="0" id="ev-ja" value="0"></div></div></div>';
    var mo = ui.modal({ title: 'Déclarer un événement HSE', sub: 'Déclaration rapide depuis le terrain — moins d\'une minute', body: body, actions: [{ label: 'Annuler' }, { label: 'Envoyer la déclaration', cls: 'danger', icon: 'send', onClick: function (close, root) {
      var type = ($('input[name="evtype"]:checked', root) || {}).value, g = +(($('input[name="evgrav"]:checked', root) || {}).value || 2), lieu = $('#ev-lieu', root).value.trim(), desc = $('#ev-desc', root).value.trim(), dt = $('#ev-dt', root).value;
      if (!type || !lieu || !desc || !dt) { ui.toast('Type, lieu et description sont obligatoires.', 'err'); [$('#ev-lieu', root), $('#ev-desc', root)].forEach(function (i) { if (!i.value.trim()) i.style.borderColor = 'var(--red)'; }); return; }
      var ja = +$('#ev-ja', root).value || 0;
      if (type === 'AAA' && !ja) ja = 1;
      var y = dt.slice(0, 4), i = { id: nextId('incidents', 'EV-' + y + '-', 3), site: SC() || siteOf($('#ev-u', root).value), date: dt.slice(0, 10), heure: dt.slice(11, 16), type: type, gravite: g, unite: $('#ev-u', root).value, lieu: lieu,
        titre: desc.length > 70 ? desc.slice(0, 67).replace(/\s+\S*$/, '') + '…' : desc, description: desc, mesuresImm: $('#ev-imm', root).value, victime: $('#ev-bl', root).checked ? $('#ev-v', root).value : '', joursArret: type === 'AAA' ? ja : 0,
        declarant: '', declarantNom: user().name, statut: 'Déclaré', causes: null };
      S.add('incidents', i); E.log('Événement HSE déclaré ' + i.id, EVT[type].l + ' · ' + lieu);
      E.notify('Événement HSE déclaré : ' + EVT[type].l, i.unite + ' · ' + lieu, '#/hse/evenements/' + i.id, g >= 3 || type === 'AAA' || type === 'FEU' ? 'red' : 'orange');
      close(); ui.toast('Déclaration ' + i.id + ' envoyée au service HSE'); E.go('hse/evenements/' + i.id);
    } }] });
    $('#ev-bl', mo.el).onchange = function (e) { $('#ev-vic', mo.el).classList.toggle('hide', !e.target.checked); };
  }
  function causesHtml(c) {
    if (!c) return '<div class="muted">Analyse des causes non réalisée.</div>';
    if (c.methode === '5 pourquoi') return '<div class="small muted" style="margin-bottom:8px">Méthode des 5 pourquoi</div><ol class="hse-5p">' + c.pourquoi.filter(Boolean).map(function (w, i) { return '<li><i>' + (i + 1) + '</i><span><b>Pourquoi ?</b> ' + esc(w) + '</span></li>'; }).join('') + '</ol>' + (c.racine ? '<div class="alert tone-violet" style="margin-top:10px">' + icon('target') + '<div><b>Cause racine :</b> ' + esc(c.racine) + '</div></div>' : '');
    var f = c.facteurs || {};
    return '<div class="small muted" style="margin-bottom:8px">Arbre des causes simplifié (méthode des 5M)</div><div class="hse-tree"><div class="hse-tree__cats">' + CAT5M.map(function (k) { var l = (f[k] || []).filter(Boolean); return '<div class="hse-tree__c' + (l.length ? '' : ' empty') + '"><b>' + esc(k) + '</b>' + (l.length ? l.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') : '<em>—</em>') + '</div>'; }).join('') + '</div><div class="hse-tree__ev">' + icon('arrow') + '<b>Événement</b></div></div>';
  }
  function viewEvent(el, id) {
    var i = S.get('incidents', id);
    if (!i) { el.innerHTML = '<div class="card empty">Événement introuvable. <a href="#/hse/evenements">Retour</a></div>'; return; }
    var t = EVT[i.type], acts = S.all('actionsHSE').filter(function (a) { return a.source === i.id; }), idx = EV_FLOW.indexOf(i.statut);
    var btns = [];
    if (i.statut !== 'Clôturé') { btns.push(['analyse', 'primary', 'search', i.causes ? 'Modifier l\'analyse' : 'Analyser les causes']); btns.push(['action', '', 'plus', 'Action corrective']); btns.push(['close', 'success', 'check', 'Clôturer']); }
    var html = '<a class="btn ghost sm" href="#/hse/evenements" style="margin-bottom:10px">' + icon('back') + 'Registre des événements</a>' +
      '<div class="card hse-ph" style="--c:' + t.c + '"><div class="hse-ph__band"></div><div class="card__b"><div class="row" style="align-items:flex-start"><div class="hse-ph__ic">' + icon(t.ic) + '</div><div style="flex:1;min-width:0"><div class="row" style="gap:8px"><h3 class="hse-ph__t">' + esc(i.titre) + '</h3></div>' +
      '<div class="row" style="gap:6px;margin:6px 0">' + evBadge(i.type) + gravBadge(i.gravite) + ui.badge(i.statut, EV_TONE[i.statut]) + '</div><div class="mono">' + i.id + ' · ' + fmt.date(i.date) + ' à ' + esc(i.heure) + '</div></div></div>' +
      '<div class="row hse-ph__btns">' + btns.map(function (b) { return '<button class="btn ' + b[1] + '" data-do="' + b[0] + '">' + icon(b[2]) + esc(b[3]) + '</button>'; }).join('') + '</div></div><div class="card__b" style="border-top:1px solid var(--line-2)">' + ui.steps(EV_FLOW, idx, { finished: i.statut === 'Clôturé' }) + '</div></div>' +
      '<div class="grid g-2-1" style="margin-top:16px"><div class="stack"><div class="card"><div class="card__h"><h3>Description des faits</h3></div><div class="card__b"><p class="hse-p" style="margin-top:0">' + esc(i.description) + '</p>' + (i.mesuresImm ? '<div class="alert tone-blue">' + icon('shield') + '<div><b>Mesures immédiates :</b> ' + esc(i.mesuresImm) + '</div></div>' : '') + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Analyse des causes</h3></div><div class="card__b">' + causesHtml(i.causes) + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Actions correctives</h3><span class="sub">' + acts.filter(function (a) { return a.statut === 'Réalisée'; }).length + '/' + acts.length + ' réalisées</span></div>' + actTable(acts) + '</div></div>' +
      '<div class="stack"><div class="card"><div class="card__h"><h3>Informations</h3></div><div class="card__b"><dl class="kv"><dt>Zone</dt><dd>' + esc(i.unite + ' · ' + uName(i.unite)) + '</dd><dt>Lieu</dt><dd>' + esc(i.lieu) + '</dd><dt>Déclarant</dt><dd>' + esc(i.declarant ? E.empName(i.declarant) : i.declarantNom || '—') + '</dd>' +
      (i.victime ? '<dt>Victime</dt><dd>' + esc(E.empName(i.victime)) + '</dd>' : '') + (i.type === 'AAA' ? '<dt>Jours d\'arrêt</dt><dd><b class="late">' + i.joursArret + ' jours</b></dd>' : '') + '</dl></div></div>' +
      (i.type === 'AAA' ? alertBox('red', 'alert', 'Accident avec arrêt : déclaration à la CNSS sous 48 h et information de l\'inspection du travail.') : '') + '</div></div>';
    el.innerHTML = html;
    bindActRows(el);
    var A = {
      analyse: function () {
        var c = i.causes || {}, f = c.facteurs || {}, five = c.pourquoi || [];
        var body = '<div class="hse-seg" style="margin-bottom:14px" id="an-m"><label><input type="radio" name="anm" value="5p"' + (c.methode !== 'Arbre des causes' ? ' checked' : '') + '><span>5 pourquoi</span></label><label><input type="radio" name="anm" value="arbre"' + (c.methode === 'Arbre des causes' ? ' checked' : '') + '><span>Arbre des causes (5M)</span></label></div>' +
          '<div id="an-5p">' + [0, 1, 2, 3, 4].map(function (k) { return '<div class="field" style="margin-bottom:8px"><label>Pourquoi n°' + (k + 1) + '</label><input class="input" data-w="' + k + '" value="' + esc(five[k] || '') + '"></div>'; }).join('') + '<div class="field"><label>Cause racine</label><input class="input" id="an-r" value="' + esc(c.racine || '') + '"></div></div>' +
          '<div id="an-tr" class="hide">' + CAT5M.map(function (k) { return '<div class="field" style="margin-bottom:8px"><label>' + esc(k) + ' <span class="muted">(une cause par ligne)</span></label><textarea class="textarea" style="min-height:52px" data-c="' + esc(k) + '">' + esc((f[k] || []).join('\n')) + '</textarea></div>'; }).join('') + '</div>';
        var mo = ui.modal({ title: 'Analyse des causes · ' + i.id, body: body, actions: [{ label: 'Annuler' }, { label: 'Enregistrer l\'analyse', cls: 'primary', icon: 'check', onClick: function (close, root) {
          var m = $('input[name="anm"]:checked', root).value;
          if (m === '5p') { var w = $$('[data-w]', root).map(function (x) { return x.value.trim(); }); if (!w[0]) { ui.toast('Renseignez au moins le premier pourquoi.', 'err'); return; } i.causes = { methode: '5 pourquoi', pourquoi: w.filter(Boolean), racine: $('#an-r', root).value.trim() }; }
          else { var fx = {}; $$('[data-c]', root).forEach(function (x) { fx[x.dataset.c] = x.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean); }); i.causes = { methode: 'Arbre des causes', facteurs: fx }; }
          if (i.statut === 'Déclaré') i.statut = 'En analyse';
          S.save(); E.log('Analyse des causes ' + i.id, i.causes.methode); close(); ui.toast('Analyse enregistrée'); E.rerender();
        } }] });
        var sw = function () { var v = $('input[name="anm"]:checked', mo.el).value; $('#an-5p', mo.el).classList.toggle('hide', v !== '5p'); $('#an-tr', mo.el).classList.toggle('hide', v === '5p'); };
        $$('input[name="anm"]', mo.el).forEach(function (r) { r.onchange = sw; }); sw();
      },
      action: function () { newAction(i.id, function () { if (i.statut === 'Déclaré' || i.statut === 'En analyse') { i.statut = 'Actions en cours'; S.save(); } }); },
      close: function () {
        var open = acts.filter(function (a) { return a.statut !== 'Réalisée'; });
        var c = [{ ok: !!i.causes, l: 'Analyse des causes réalisée' }, { ok: acts.length > 0 || i.gravite <= 1, l: 'Au moins une action corrective définie' }, { ok: !open.length, l: 'Toutes les actions réalisées (' + (acts.length - open.length) + '/' + acts.length + ')' }];
        if (c.some(function (x) { return !x.ok; })) return blockedModal('Clôture impossible — ' + i.id, c);
        i.statut = 'Clôturé'; S.save(); E.log('Événement clôturé ' + i.id, ''); ui.toast('Événement clôturé'); E.rerender();
      }
    };
    $$('[data-do]', el).forEach(function (b) { b.onclick = function () { A[b.dataset.do](); }; });
  }

  /* ------------------------------------------------------------------ Actions correctives */
  function srcLabel(s) { if (!s) return 'Autre'; var i = S.get('incidents', s); if (i) return s + ' · ' + i.titre; var a = S.get('audits', s); if (a) return s + ' · ' + a.theme; return s; }
  function echeanceHtml(a) { if (a.statut === 'Réalisée') return '<span class="nowrap muted">' + fmt.dateShort(a.echeance) + '</span>'; var d = E.daysBetween(E.today(), a.echeance); return d < 0 ? '<span class="nowrap late">' + fmt.dateShort(a.echeance) + ' · ' + (-d) + ' j de retard</span>' : '<span class="nowrap">' + fmt.dateShort(a.echeance) + (d <= 7 ? ' <span class="muted">(J-' + d + ')</span>' : '') + '</span>'; }
  var ACT_COLS = [
    { label: 'N°', render: function (a) { return '<b class="nowrap' + (actLate(a) ? ' late' : '') + '">' + a.id + '</b>'; }, csv: function (a) { return a.id; } },
    { label: 'Action', render: function (a) { return '<div class="hse-cell"><b>' + esc(a.libelle) + '</b><div class="small muted">' + esc(srcLabel(a.source)) + '</div></div>'; }, csv: function (a) { return a.libelle; } },
    { label: 'Responsable', render: function (a) { return '<span class="nowrap">' + esc(E.empName(a.responsable)) + '</span>'; }, csv: function (a) { return E.empName(a.responsable); } },
    { label: 'Priorité', render: function (a) { return ui.badge(a.priorite); }, csv: function (a) { return a.priorite; } },
    { label: 'Échéance', render: echeanceHtml, csv: function (a) { return a.echeance; } },
    { label: 'Statut', render: function (a) { return actLate(a) ? ui.badge('En retard', 'red') : ui.badge(a.statut, a.statut === 'Réalisée' ? 'green' : a.statut === 'En cours' ? 'blue' : 'orange'); }, csv: function (a) { return actLate(a) ? 'En retard' : a.statut; } }
  ];
  function actList(list) { return '<div class="list">' + (list.length ? list.map(function (a) { return '<a class="list__item" href="#/hse/actions" style="color:inherit"><div class="list__icon tone-red">' + icon('flag') + '</div><div class="list__body"><b>' + esc(a.libelle) + '</b><div class="small muted">' + a.id + ' · ' + esc(E.empName(a.responsable)) + '</div><div class="small">' + echeanceHtml(a) + '</div></div></a>'; }).join('') : '<div class="empty">Aucune action en retard</div>') + '</div>'; }
  function actTable(list) { return '<div class="hse-acts">' + ui.table(ACT_COLS, list, { empty: 'Aucune action corrective', onRow: function (a) { editAction(a); } }) + '</div>'; }
  function bindActRows() {}
  function editAction(a) {
    ui.modal({ title: a.id + ' · Action corrective', sub: esc(srcLabel(a.source)), body: '<dl class="kv"><dt>Action</dt><dd>' + esc(a.libelle) + '</dd><dt>Responsable</dt><dd>' + esc(E.empName(a.responsable)) + '</dd><dt>Échéance</dt><dd>' + echeanceHtml(a) + '</dd><dt>Priorité</dt><dd>' + ui.badge(a.priorite) + '</dd><dt>Statut</dt><dd>' + ui.badge(a.statut) + '</dd>' + (a.realiseeLe ? '<dt>Réalisée le</dt><dd>' + fmt.date(a.realiseeLe) + '</dd>' : '') + '</dl>' +
      (a.statut !== 'Réalisée' ? '<div class="field" style="margin-top:14px"><label>Reporter l\'échéance</label><input class="input" type="date" id="ac-ech" value="' + a.echeance + '"></div>' : ''),
      actions: a.statut === 'Réalisée' ? [{ label: 'Rouvrir', onClick: function (c) { a.statut = 'En cours'; delete a.realiseeLe; S.save(); c(); ui.toast('Action rouverte'); E.rerender(); } }, { label: 'Fermer', cls: 'primary' }] :
        [{ label: 'Enregistrer l\'échéance', onClick: function (c, root) { var v = $('#ac-ech', root).value; if (v && v !== a.echeance) { E.log('Échéance reportée ' + a.id, a.echeance + ' → ' + v); a.echeance = v; S.save(); ui.toast('Échéance mise à jour'); } c(); E.rerender(); } },
          a.statut === 'À faire' ? { label: 'Démarrer', cls: 'primary', onClick: function (c) { a.statut = 'En cours'; S.save(); E.log('Action démarrée ' + a.id, a.libelle); c(); ui.toast('Action en cours'); E.rerender(); } } : null,
          { label: 'Marquer réalisée', cls: 'success', icon: 'check', onClick: function (c) { a.statut = 'Réalisée'; a.realiseeLe = E.today(); S.save(); E.log('Action réalisée ' + a.id, a.libelle); c(); ui.toast('Action réalisée'); E.rerender(); } }].filter(Boolean) });
  }
  function newAction(source, after) {
    var sc = SC(), srcRec = function (id) { return id ? S.get('incidents', id) || S.get('audits', id) : null; };
    var srcs = [{ v: '', l: 'Autre (initiative HSE)' }].concat(S.all('incidents').filter(function (i) { return i.statut !== 'Clôturé'; }).map(function (i) { return { v: i.id, l: i.id + ' · ' + i.titre }; })).concat(S.all('audits').filter(function (a) { return a.statut === 'Réalisé'; }).map(function (a) { return { v: a.id, l: a.id + ' · ' + a.theme }; }));
    var s0 = srcRec(source), resp0 = DEFS[(s0 && s0.site) || sc || 'OWE'].act;
    var fields = [{ name: 'libelle', label: 'Action', type: 'textarea', required: true }, { name: 'source', label: 'Origine', type: 'select', options: srcs, value: source || '', full: true }, { name: 'responsable', label: 'Responsable', type: 'select', options: empOpts(), value: resp0, required: true }, { name: 'echeance', label: 'Échéance', type: 'date', value: D(30), required: true }, { name: 'priorite', label: 'Priorité', type: 'select', options: ['Haute', 'Moyenne', 'Basse'], value: 'Moyenne' }];
    /* vue globale : port de rattachement (sinon celui de l'origine) */
    if (!sc) fields.push({ name: 'site', label: 'Port (si aucune origine)', type: 'select', options: PORT_OPTS, value: (s0 && s0.site) || 'OWE' });
    ui.formModal({ title: 'Nouvelle action corrective', fields: fields,
      onSubmit: function (v) { var o = srcRec(v.source); var a = { id: nextId('actionsHSE', 'ACT-' + yr() + '-', 3), site: sc || (o && o.site) || v.site || 'OWE', source: v.source, libelle: v.libelle, responsable: v.responsable, echeance: v.echeance, priorite: v.priorite, statut: 'À faire', creee: E.today() }; S.add('actionsHSE', a); if (after) after(a); E.log('Action corrective ' + a.id, a.libelle); E.notify('Action corrective assignée', a.libelle, '#/hse/actions', 'blue'); ui.toast('Action ' + a.id + ' créée'); E.rerender(); } });
  }
  function tabActions(el) {
    var all = S.all('actionsHSE'), st = state.act, late = all.filter(actLate);
    var open = all.filter(function (a) { return a.statut !== 'Réalisée'; }), done = all.filter(function (a) { return a.statut === 'Réalisée'; });
    el.innerHTML = '<div class="grid g4">' + ui.kpi({ label: 'Actions ouvertes', value: open.length, icon: 'list', tone: 'blue', foot: open.filter(function (a) { return a.priorite === 'Haute'; }).length + ' de priorité haute' }) +
      ui.kpi({ label: 'En retard', value: late.length, icon: 'alert', tone: 'red', foot: late.length ? 'jusqu\'à ' + Math.max.apply(null, late.map(function (a) { return E.daysBetween(a.echeance, E.today()); })) + ' j de retard' : 'aucune' }) +
      ui.kpi({ label: 'Réalisées', value: done.length, icon: 'check', tone: 'green', foot: 'sur ' + all.length + ' actions' }) +
      ui.kpi({ label: 'Taux de réalisation dans les délais', value: Math.round(done.length / Math.max(1, done.length + late.length) * 100), unit: '%', icon: 'target', tone: 'violet', foot: 'objectif 90 %' }) + '</div>' +
      '<div class="card" style="margin-top:16px"><div class="card__h"><h3>Plan d\'actions HSE</h3><div class="spacer"></div><button class="btn sm" id="ac-csv">' + icon('download') + 'Export CSV</button><button class="btn primary sm" id="ac-new">' + icon('plus') + 'Nouvelle action</button></div>' +
      '<div class="card__b" style="padding-bottom:0"><div class="filters"><div class="chips" id="ac-st">' + [['ouvertes', 'Ouvertes'], ['retard', 'En retard'], ['realisees', 'Réalisées'], ['toutes', 'Toutes']].map(function (c) { return '<button class="chip' + (st.st === c[0] ? ' is-active' : '') + '" data-k="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>' +
      '<select class="select" id="ac-resp"><option value="">Tous les responsables</option>' + Object.keys(E.groupBy(all, 'responsable')).map(function (r) { return '<option value="' + r + '"' + (st.resp === r ? ' selected' : '') + '>' + esc(E.empName(r)) + '</option>'; }).join('') + '</select></div></div><div id="ac-list"></div></div>';
    function rows() { return all.filter(function (a) { return (!st.resp || a.responsable === st.resp) && (st.st === 'toutes' || (st.st === 'ouvertes' && a.statut !== 'Réalisée') || (st.st === 'retard' && actLate(a)) || (st.st === 'realisees' && a.statut === 'Réalisée')); }).sort(function (a, b) { return a.echeance.localeCompare(b.echeance); }); }
    function draw() { $('#ac-list', el).innerHTML = actTable(rows()); }
    draw();
    $$('#ac-st .chip', el).forEach(function (b) { b.onclick = function () { st.st = b.dataset.k; $$('#ac-st .chip', el).forEach(function (x) { x.classList.toggle('is-active', x === b); }); draw(); }; });
    $('#ac-resp', el).onchange = function (e) { st.resp = e.target.value; draw(); };
    $('#ac-csv', el).onclick = function () { ui.exportCSV('actions-correctives-hse', ACT_COLS.concat([{ label: 'Origine', csv: function (a) { return srcLabel(a.source); } }]), rows()); };
    $('#ac-new', el).onclick = function () { newAction(''); };
  }

  /* ------------------------------------------------------------------ Indicateurs */
  function bird(r) {
    var inc = r.inc, cnt = function (types) { return inc.filter(function (i) { return types.indexOf(i.type) >= 0; }).length; };
    var obs = E.sum(S.all('hseMois'), 'observations');
    var tiers = [['Accidents graves / mortels', 0, '#7f1d1d'], ['Accidents avec arrêt', cnt(['AAA']), '#d93636'], ['Accidents sans arrêt / soins', cnt(['ASA']), '#e8780c'], ['Presque-accidents & incidents sans blessé', cnt(['PA', 'FEU', 'FUI', 'ENV']), '#f5c400'], ['Situations dangereuses & observations terrain', cnt(['SD']) + obs, '#1e9e4a']];
    var w = [7, 26, 45, 64, 82, 100];
    return '<div class="hse-bird">' + tiers.map(function (t, i) { var a = w[i], b = w[i + 1], inset = (1 - a / b) / 2 * 100; return '<div class="hse-bird__p"><div style="width:' + b + '%;background:' + t[2] + ';clip-path:polygon(' + inset + '% 0,' + (100 - inset) + '% 0,100% 100%,0 100%)"><b>' + t[1] + '</b></div></div><div class="hse-bird__l"><b>' + t[1] + '</b> ' + esc(t[0]) + '</div>'; }).join('') + '</div><div class="small muted" style="margin-top:8px">12 derniers mois · base : registre des événements + ' + obs + ' cartes d\'observation terrain. Ratio de Bird de référence 1 / 10 / 30 / 600.</div>';
  }
  /* statistiques mensuelles : un enregistrement par site et par mois ; en vue globale on additionne les deux ports */
  function moisAgg() {
    var out = {};
    S.all('hseMois').forEach(function (m) {
      var o = out[m.id] || (out[m.id] = { id: m.id });
      Object.keys(m).forEach(function (k) { if (typeof m[k] === 'number') o[k] = (o[k] || 0) + m[k]; });
    });
    return out;
  }
  /* comparaison des deux ports (vue globale) */
  function compareSites() {
    var rows = ['OWE', 'POG'].map(function (s) {
      return E.withScope(s, function () { var r = rates(); return { s: s, tf1: r.tf1, tf2: r.tf2, tg: r.tg, h: r.h, act: actifs().length, late: lateActions().length, j: joursSans(), niv: isps(s).niveau }; });
    });
    return '<div class="card" style="margin-top:16px"><div class="card__h"><h3>Comparaison des deux ports</h3><span class="sub">12 mois glissants</span></div>' + ui.table([
      { label: 'Port', render: function (x) { return '<b>' + portName(x.s) + '</b>'; } },
      { label: 'Heures travaillées', num: true, render: function (x) { return fmt.short(x.h); } },
      { label: 'TF1', num: true, render: function (x) { return num(x.tf1, 2); } },
      { label: 'TF2', num: true, render: function (x) { return num(x.tf2, 2); } },
      { label: 'TG', num: true, render: function (x) { return num(x.tg, 3); } },
      { label: 'Jours sans AAA', num: true, render: function (x) { return x.j; } },
      { label: 'Permis actifs', num: true, render: function (x) { return x.act; } },
      { label: 'Actions en retard', num: true, render: function (x) { return x.late ? '<span class="late">' + x.late + '</span>' : '0'; } },
      { label: 'Niveau ISPS', render: function (x) { return ui.badge('Niveau ' + x.niv, NIV[x.niv].tone); } }], rows) + '</div>';
  }
  function tabIndic(el) {
    var r = rates(), ms = months12(), mois = S.all('hseMois'), agg = moisAgg();
    var mk = function (types) { return ms.map(function (m) { return r.inc.filter(function (i) { return i.date.slice(0, 7) === m.key && types.indexOf(i.type) >= 0; }).length; }); };
    var byType = E.groupBy(permis(), 'type'), mm = function (k) { return agg[k] || {}; };
    var late = lateActions();
    el.innerHTML = '<div class="grid hse-ov">' + counterCard() + '<div class="grid g2 hse-ov__k">' +
      ui.kpi({ label: 'TF1 (avec arrêt)', value: num(r.tf1, 2), icon: 'trend', tone: 'red', foot: r.aaa + ' AAA / ' + fmt.short(r.h) + ' h travaillées' }) +
      ui.kpi({ label: 'TF2 (avec + sans arrêt)', value: num(r.tf2, 2), icon: 'trend', tone: 'orange', foot: (r.aaa + r.asa) + ' accidents sur 12 mois' }) +
      ui.kpi({ label: 'TG (gravité)', value: num(r.tg, 3), icon: 'chart', tone: 'violet', foot: r.jp + ' jours perdus' }) +
      ui.kpi({ label: 'Heures travaillées', value: fmt.short(r.h), icon: 'clock', tone: 'blue', foot: 'dont ' + fmt.short(E.sum(mois, 'heuresEE')) + ' entreprises ext.' }) + '</div></div>' +
      '<p class="small muted" style="margin:8px 2px 0">TF1 = AAA × 10⁶ / heures travaillées · TF2 = (AAA + ASA) × 10⁶ / heures · TG = jours perdus × 10³ / heures — personnel GPM et entreprises extérieures' + (SC() ? ' · ' + esc(portLong(SC())) : ' · cumul des deux ports') + '.</p>' +
      '<div class="grid g2 keep-1" style="margin-top:16px"><div class="card"><div class="card__h"><h3>Pyramide de Bird</h3></div><div class="card__b">' + bird(r) + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Évolution mensuelle des événements</h3></div><div class="card__b">' + ui.bars({ labels: ms.map(function (m) { return m.l; }), stacked: true, height: 240, series: [{ name: 'Accidents (AAA + ASA)', values: mk(['AAA', 'ASA']), color: '#d93636' }, { name: 'Presque-accidents & incidents', values: mk(['PA', 'FEU', 'FUI']), color: '#f5c400' }, { name: 'Situations dangereuses', values: mk(['SD']), color: '#2563eb' }, { name: 'Environnement', values: mk(['ENV']), color: '#1e9e4a' }] }) + '</div></div></div>' +
      '<div class="grid g3" style="margin-top:16px"><div class="card"><div class="card__h"><h3>Permis émis par type</h3><span class="sub">registre actuel</span></div><div class="card__b">' + ui.donut(TYPE_KEYS.filter(function (k) { return byType[k]; }).map(function (k) { return { label: TYPES[k].s, value: byType[k].length, color: TYPES[k].c }; }), { sub: 'permis' }) + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Prévention terrain</h3><span class="sub">par mois</span></div><div class="card__b">' + ui.bars({ labels: ms.map(function (m) { return m.l; }), height: 200, series: [{ name: 'Cartes d\'observation', values: ms.map(function (m) { return mm(m.key).observations || 0; }), color: '#1e9e4a' }, { name: 'Quarts d\'heure sécurité', values: ms.map(function (m) { return mm(m.key).qhs || 0; }), color: '#0f2d5c' }] }) + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Permis de travail émis</h3><span class="sub">par mois</span></div><div class="card__b">' + ui.line({ labels: ms.map(function (m) { return m.l; }), height: 200, series: [{ name: 'Permis émis', values: ms.map(function (m) { return mm(m.key).permis || 0; }), color: '#d93636' }] }) + '</div></div></div>' +
      '<div class="grid g2 keep-1" style="margin-top:16px"><div class="card"><div class="card__h"><h3>Actions en retard</h3><span class="badge tone-red">' + late.length + '</span><div class="spacer"></div><a class="btn ghost sm" href="#/hse/actions">Plan d\'actions</a></div>' + actList(late) + '</div>' +
      '<div class="card"><div class="card__h"><h3>Visites & audits sécurité</h3><div class="spacer"></div><a class="btn ghost sm" href="#/hse/audits">Tout voir</a></div><div class="card__b">' + auditSummary() + '</div></div></div>' +
      (SC() ? '' : compareSites());
  }
  function auditSummary() {
    var done = S.all('audits').filter(function (a) { return a.statut === 'Réalisé'; }), by = E.groupBy(done, 'type');
    return '<div class="hse-audsum">' + Object.keys(by).map(function (k) { var avg = E.sum(by[k], 'score') / by[k].length; return '<div><div class="row"><b>' + esc(k) + '</b><span class="muted small">' + by[k].length + ' réalisé(s) · ' + E.sum(by[k], 'ecarts') + ' écart(s)</span></div>' + ui.progress(avg, avg >= 85 ? 'green' : avg >= 75 ? 'orange' : 'red') + '</div>'; }).join('') + '</div>';
  }

  /* ------------------------------------------------------------------ Visites & audits */
  var AUD_TYPES = ['Visite terrain', 'Quart d\'heure sécurité', 'Audit entreprise extérieure', 'Audit permis de travail', 'Exercice POI / POLMAR'];
  var AUD_COLS = [
    { label: 'N°', render: function (a) { return '<b class="nowrap">' + a.id + '</b>'; }, csv: function (a) { return a.id; } },
    { label: 'Date', render: function (a) { return '<span class="nowrap">' + fmt.dateShort(a.date) + '</span>'; }, csv: function (a) { return a.date; } },
    { label: 'Type', render: function (a) { return esc(a.type); }, csv: function (a) { return a.type; } },
    { label: 'Thème', render: function (a) { return '<div class="hse-cell"><b>' + esc(a.theme) + '</b><div class="small muted">' + esc(a.unite + (a.entreprise ? ' · ' + ent(a.entreprise) : '')) + '</div></div>'; }, csv: function (a) { return a.theme; } },
    { label: 'Auditeur', render: function (a) { return '<span class="nowrap">' + esc(E.empName(a.auditeur)) + '</span>'; }, csv: function (a) { return E.empName(a.auditeur); } },
    { label: 'Score', render: function (a) { return a.score == null ? '<span class="muted small">—</span>' : '<span class="hse-score ' + (a.score >= 85 ? 'ok' : a.score >= 75 ? 'warn' : 'bad') + '">' + a.score + ' %</span>'; }, csv: function (a) { return a.score; } },
    { label: 'Écarts', num: true, render: function (a) { return a.ecarts == null ? '—' : a.ecarts; }, csv: function (a) { return a.ecarts; } },
    { label: 'Statut', render: function (a) { return ui.badge(a.statut, a.statut === 'Réalisé' ? 'green' : 'violet'); }, csv: function (a) { return a.statut; } }
  ];
  function tabAudits(el) {
    var all = S.all('audits'), st = state.aud, done = all.filter(function (a) { return a.statut === 'Réalisé'; }), plan = all.filter(function (a) { return a.statut === 'Planifié'; }).sort(function (a, b) { return a.date.localeCompare(b.date); });
    var maj = E.sum(done, function (a) { return a.constats.filter(function (c) { return c.niv === 'Majeur'; }).length; });
    el.innerHTML = '<div class="grid g4">' + ui.kpi({ label: 'Visites & audits réalisés', value: done.length, icon: 'eye', tone: 'blue', foot: 'derniers 90 jours' }) +
      ui.kpi({ label: 'Score moyen', value: Math.round(E.sum(done, 'score') / Math.max(1, done.length)), unit: '%', icon: 'target', tone: 'green', foot: 'objectif ≥ 85 %' }) +
      ui.kpi({ label: 'Écarts relevés', value: E.sum(done, 'ecarts'), icon: 'flag', tone: 'orange', foot: maj + ' écart(s) majeur(s)' }) +
      ui.kpi({ label: 'Prochaine visite', value: plan[0] ? fmt.dateShort(plan[0].date) : '—', icon: 'calendar', tone: 'violet', foot: plan[0] ? esc(plan[0].type) : '' }) + '</div>' +
      '<div class="card" style="margin-top:16px"><div class="card__h"><h3>Programme de visites et d\'audits sécurité</h3><div class="spacer"></div><button class="btn sm" id="au-csv">' + icon('download') + 'Export CSV</button><button class="btn primary sm" id="au-new">' + icon('plus') + 'Planifier</button></div>' +
      '<div class="card__b" style="padding-bottom:0"><div class="chips" id="au-t" style="margin-bottom:14px">' + [''].concat(AUD_TYPES).map(function (t) { return '<button class="chip' + (st.type === t ? ' is-active' : '') + '" data-k="' + esc(t) + '">' + esc(t || 'Tous') + '</button>'; }).join('') + '</div></div><div id="au-list"></div></div>';
    function rows() { return all.filter(function (a) { return !st.type || a.type === st.type; }).sort(function (a, b) { return b.date.localeCompare(a.date); }); }
    function draw() { $('#au-list', el).innerHTML = ui.table(AUD_COLS, rows(), { onRow: openAudit }); }
    draw();
    $$('#au-t .chip', el).forEach(function (b) { b.onclick = function () { st.type = b.dataset.k; $$('#au-t .chip', el).forEach(function (x) { x.classList.toggle('is-active', x === b); }); draw(); }; });
    $('#au-csv', el).onclick = function () { ui.exportCSV('visites-audits-hse', AUD_COLS, rows()); };
    $('#au-new', el).onclick = function () {
      ui.formModal({ title: 'Planifier une visite / un audit', fields: [{ name: 'type', label: 'Type', type: 'select', options: AUD_TYPES, required: true }, { name: 'date', label: 'Date', type: 'date', value: D(7), required: true }, { name: 'theme', label: 'Thème', required: true, full: true }, { name: 'unite', label: 'Zone', type: 'select', options: uniteOpts(), value: def('zone') }, { name: 'entreprise', label: 'Entreprise auditée (si EE)', type: 'select', options: [{ v: '', l: '—' }].concat(E.options('fournisseurs')) }, { name: 'auditeur', label: 'Auditeur / animateur', type: 'select', options: empOpts(), value: def('aud') }],
        onSubmit: function (v) { var a = Object.assign({ id: nextId('audits', 'AUD-' + yr() + '-', 3), site: SC() || siteOf(v.unite), statut: 'Planifié', score: null, ecarts: null, constats: [] }, v); S.add('audits', a); E.log('Audit planifié ' + a.id, a.theme); ui.toast('Visite ' + a.id + ' planifiée'); E.rerender(); } });
    };
  }
  function openAudit(a) {
    if (a.statut === 'Planifié') {
      var body = '<dl class="kv"><dt>Type</dt><dd>' + esc(a.type) + '</dd><dt>Thème</dt><dd>' + esc(a.theme) + '</dd><dt>Date</dt><dd>' + fmt.date(a.date) + '</dd><dt>Auditeur</dt><dd>' + esc(E.empName(a.auditeur)) + '</dd></dl><h4 class="hse-h4">Saisir le résultat</h4>' +
        ui.form([{ name: 'score', label: 'Score de conformité (%)', type: 'number', min: 0, value: 85, required: true }, { name: 'constats', label: 'Écarts / constats (un par ligne, préfixer « ! » pour un écart majeur)', type: 'textarea' }]);
      return ui.modal({ title: a.id + ' · ' + a.type, body: body, actions: [{ label: 'Fermer' }, { label: 'Enregistrer le résultat', cls: 'primary', icon: 'check', onClick: function (c, root) {
        var v = ui.readForm(root); if (!v) return;
        a.constats = String(v.constats || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) { return s[0] === '!' ? { txt: s.slice(1).trim(), niv: 'Majeur' } : { txt: s, niv: 'Mineur' }; });
        a.score = Math.max(0, Math.min(100, v.score)); a.ecarts = a.constats.length; a.statut = 'Réalisé'; if (a.date > E.today()) a.date = E.today(); S.save(); E.log('Audit réalisé ' + a.id, a.score + ' %'); c(); ui.toast('Résultat enregistré'); E.rerender();
      } }] });
    }
    var acts = S.all('actionsHSE').filter(function (x) { return x.source === a.id; });
    var m = ui.modal({ title: a.id + ' · ' + a.type, sub: fmt.date(a.date) + ' · ' + esc(a.unite) + (a.entreprise ? ' · ' + esc(ent(a.entreprise)) : ''), body:
      '<div class="row" style="gap:16px;align-items:center"><div style="width:150px">' + ui.gauge(a.score, 'Score', a.score >= 85 ? '#1e9e4a' : a.score >= 75 ? '#e8780c' : '#d93636') + '</div><div style="flex:1;min-width:200px"><b>' + esc(a.theme) + '</b><div class="small muted">Auditeur : ' + esc(E.empName(a.auditeur)) + '</div><div class="small muted">' + a.ecarts + ' écart(s) · ' + acts.length + ' action(s) corrective(s)</div></div></div>' +
      '<h4 class="hse-h4">Constats</h4>' + (a.constats.length ? '<div class="list hse-constats">' + a.constats.map(function (c, k) { return '<div class="list__item"><div class="list__icon tone-' + (c.niv === 'Majeur' ? 'red' : c.niv === 'Mineur' ? 'orange' : 'blue') + '">' + icon(c.niv === 'Observation' ? 'eye' : 'flag') + '</div><div class="list__body"><b>' + esc(c.txt) + '</b><div class="small muted">' + esc(c.niv) + '</div></div>' + (c.niv !== 'Observation' ? '<button class="btn sm" data-ca="' + k + '">' + icon('plus') + 'Action</button>' : '') + '</div>'; }).join('') + '</div>' : '<div class="muted">Aucun écart relevé.</div>') +
      (acts.length ? '<h4 class="hse-h4">Actions liées</h4>' + acts.map(function (x) { return '<div class="small">• ' + x.id + ' — ' + esc(x.libelle) + ' (' + (actLate(x) ? '<span class="late">en retard</span>' : esc(x.statut)) + ')</div>'; }).join('') : ''),
      actions: [{ label: 'Fermer', cls: 'primary' }] });
    $$('[data-ca]', m.el).forEach(function (b) { b.onclick = function () { var c = a.constats[+b.dataset.ca]; m.close(); newAction(a.id); setTimeout(function () { var t = document.querySelector('.modal textarea[name="libelle"]'); if (t) t.value = 'Corriger : ' + c.txt; }, 30); }; });
  }

  /* ------------------------------------------------------------------ onglet Environnement & MARPOL */
  function tabEnv(el) {
    var sc = SC(), byId = function (a, b) { return a.id.localeCompare(b.id); };
    /* qualité des eaux : bassin du site actif ; en vue globale, les deux bassins */
    var exAll = S.all('envEaux').slice().sort(byId), exO = exAll.filter(function (r) { return r.site !== 'POG'; }), exP = exAll.filter(function (r) { return r.site === 'POG'; });
    var ex = sc ? exAll : exO, mg = S.all('envMangrove'), dc = S.all('envDechets').slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    var mp = S.all('envMarpol').slice().sort(function (a, b) { return b.date.localeCompare(a.date) || b.id.localeCompare(a.id); });
    var ms = months12(), lastO = exO[exO.length - 1] || {}, lastP = exP[exP.length - 1] || {};
    var last = sc ? (ex[ex.length - 1] || {}) : { hc: Math.max(lastO.hc || 0, lastP.hc || 0) };
    var lab = function (k) { var x = ms.find(function (m) { return m.key === k; }); return x ? x.l : k; };
    var hcOf = function (list, id) { var r = list.find(function (x) { return x.id === id; }); return r ? r.hc : 0; };
    var navOf = function (list, id) { var r = list.find(function (x) { return x.id === id; }); return r ? r.navires : 0; };
    var hcSeries = sc ? [{ name: 'HC (mg/l)', values: ex.map(function (r) { return r.hc; }), color: '#0f2d5c' }] :
      [{ name: 'Owendo (mg/l)', values: ex.map(function (r) { return hcOf(exO, r.id); }), color: '#0f2d5c' }, { name: 'Port-Gentil (mg/l)', values: ex.map(function (r) { return hcOf(exP, r.id); }), color: '#009e60' }];
    var navSeries = sc ? [{ name: 'Navires en escale', values: ex.map(function (r) { return r.navires; }), color: '#145091' }] :
      [{ name: 'Owendo', values: ex.map(function (r) { return navOf(exO, r.id); }), color: '#145091' }, { name: 'Port-Gentil', values: ex.map(function (r) { return navOf(exP, r.id); }), color: '#009e60' }];
    var tblRows = sc ? ex.slice(-6).reverse() : exAll.filter(function (r) { return ex.slice(-6).some(function (x) { return x.id === r.id; }); }).sort(function (a, b) { return b.id.localeCompare(a.id) || (a.site === 'POG' ? 1 : -1); });
    var dang = dc.filter(function (d) { return d.categorie === 'Dangereux'; }), tot = E.sum(dc, 'quantite'), valo = E.sum(dc.filter(function (d) { return /valoris|recycl|régén/i.test(d.filiere); }), 'quantite');
    var m30 = mp.filter(function (m) { return m.date >= D(-30); }), refus = mp.filter(function (m) { return /Refus/.test(m.statut); });
    var alertSt = mg.filter(function (m) { return m.statut !== 'Conforme' && m.statut !== 'Référence'; });
    el.innerHTML = '<div class="grid g4">' + ui.kpi({ label: sc ? 'Hydrocarbures dans le bassin portuaire' : 'Hydrocarbures (max.)', value: num(last.hc || 0, 1), unit: 'mg/l', icon: 'drop', tone: last.hc > 2 ? 'red' : last.hc > 1 ? 'orange' : 'green', foot: sc ? 'seuil d\'alerte interne 1 mg/l' : 'Owendo ' + num(lastO.hc || 0, 1) + ' · Port-Gentil ' + num(lastP.hc || 0, 1) + ' mg/l' }) +
      ui.kpi({ label: 'Déchets des navires reçus (30 j)', value: num(E.sum(m30, 'volume'), 0), unit: 'm³', icon: 'ship', tone: 'blue', foot: m30.length + ' réception(s) MARPOL · ' + refus.length + ' refus' }) +
      ui.kpi({ label: 'Déchets du port évacués / stockés', value: num(tot, 1), unit: 't', icon: 'box', tone: 'violet', foot: num(E.sum(dang, 'quantite'), 1) + ' t de déchets dangereux' }) +
      ui.kpi({ label: 'Taux de valorisation', value: Math.round(valo / Math.max(1, tot) * 100), unit: '%', icon: 'refresh', tone: 'green', foot: 'objectif 60 %' }) + '</div>' +
      (alertSt.length ? '<div style="margin-top:16px">' + alertBox('orange', 'globe', '<b>Surveillance de la mangrove :</b> ' + alertSt.map(function (m) { return esc(m.station) + ' — ' + esc(m.statut.toLowerCase()); }).join(' ; ') + '.') + '</div>' : '') +
      '<div class="card" style="margin-top:16px"><div class="card__h"><h3>Réception des déchets des navires (MARPOL)</h3><span class="sub">installations de réception portuaires · annexes I (hydrocarbures), IV (eaux usées), V (ordures)</span><div class="spacer"></div><button class="btn sm" id="mp-csv">' + icon('download') + 'CSV</button><button class="btn primary sm" id="mp-new">' + icon('plus') + 'Réception</button></div>' +
      ui.table(MP_COLS, mp, { empty: 'Aucune réception enregistrée' }) + '<div class="small muted" style="padding:10px 18px">Chaque navire en escale notifie ses déchets avant l\'arrivée ; le refus d\'un dépôt non conforme est signalé à l\'autorité maritime.</div></div>' +
      '<div class="grid g2 keep-1" style="margin-top:16px"><div class="card"><div class="card__h"><h3>Qualité des eaux ' + (sc ? 'du bassin portuaire' : 'des bassins portuaires') + '</h3><span class="sub">hydrocarbures, moyenne mensuelle (mg/l)' + (sc ? ' · ' + esc(portLong(sc)) : ' · Owendo et Port-Gentil') + '</span></div><div class="card__b">' + ui.line({ labels: ex.map(function (r) { return lab(r.id); }), height: 210, series: hcSeries.concat([{ name: 'Seuil d\'alerte 1 mg/l', values: ex.map(function () { return 1; }), color: '#d93636', dash: true }]) }) + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Navires et déchets reçus</h3><span class="sub">navires en escale par mois</span></div><div class="card__b">' + ui.bars({ labels: ex.map(function (r) { return lab(r.id); }), height: 210, stacked: !sc, series: navSeries }) + '</div></div></div>' +
      '<div class="card" style="margin-top:16px"><div class="card__h"><h3>Suivi de la qualité des eaux</h3><span class="sub">6 derniers mois · prélèvements au droit des postes</span></div>' + ui.table([
        { label: 'Mois', render: function (r) { return '<b>' + esc(fmt.month(r.id + '-01')) + '</b>' + (sc ? '' : '<div class="small muted">' + portName(r.site) + '</div>'); } },
        { label: 'HC (mg/l)', num: true, render: function (r) { return '<span class="gz ' + (r.hc > 2 ? 'bad' : r.hc > 1 ? 'warn' : 'ok') + '">' + num(r.hc, 1) + '</span>'; } },
        { label: 'MES (mg/l)', num: true, render: function (r) { return '<span class="gz ' + (r.mes > 35 ? 'bad' : 'ok') + '">' + r.mes + '</span>'; } },
        { label: 'O₂ dissous (mg/l)', num: true, render: function (r) { return '<span class="gz ' + (r.o2 < 6 ? 'warn' : 'ok') + '">' + num(r.o2, 1) + '</span>'; } },
        { label: 'pH', num: true, render: function (r) { return num(r.ph, 1); } },
        { label: 'Navires en escale', num: true, render: function (r) { return r.navires; } }], tblRows) + '<div class="small muted" style="padding:10px 18px">Seuils internes : HC 1 mg/l (alerte) · MES 35 mg/l · O₂ dissous ≥ 6 mg/l.</div></div>' +
      '<div class="grid g2 keep-1" style="margin-top:16px"><div class="card"><div class="card__h"><h3>Surveillance de la mangrove</h3><div class="spacer"></div><button class="btn sm" id="mg-new">' + icon('plus') + 'Observation</button></div><div class="list">' +
      mg.map(function (m) { var tone = m.statut === 'Conforme' ? 'green' : m.statut === 'Référence' ? 'grey' : 'orange'; return '<div class="list__item"><div class="list__icon tone-' + tone + '">' + icon('globe') + '</div><div class="list__body"><div class="row" style="gap:6px"><b>' + esc(m.station) + '</b>' + ui.badge(m.statut, tone) + '</div><div class="small muted">' + fmt.date(m.date) + ' · HC sédiments ' + m.hc + ' mg/kg · végétation : ' + esc(m.vegetation) + ' · ' + esc(m.faune) + '</div>' + (m.obs ? '<div class="small">' + esc(m.obs) + '</div>' : '') + '</div></div>'; }).join('') + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Registre des déchets du port</h3><div class="spacer"></div><button class="btn sm" id="dc-csv">' + icon('download') + 'CSV</button><button class="btn sm" id="dc-new">' + icon('plus') + 'Enlèvement</button></div>' + ui.table(DC_COLS, dc) + '</div></div>';
    $('#dc-csv', el).onclick = function () { ui.exportCSV('registre-dechets', DC_COLS, dc); };
    $('#mp-csv', el).onclick = function () { ui.exportCSV('dechets-navires-marpol', MP_COLS, mp); };
    $('#mp-new', el).onclick = function () {
      ui.formModal({ title: 'Réception de déchets d\'un navire', sub: 'Convention MARPOL — installations de réception portuaires' + (sc ? ' · ' + portLong(sc) : ''), fields: [{ name: 'navire', label: 'Navire', required: true, value: 'MV ' }].concat(sc ? [] : [{ name: 'site', label: 'Port', type: 'select', options: PORT_OPTS }]).concat([{ name: 'annexe', label: 'Annexe MARPOL', type: 'select', options: ['Annexe I', 'Annexe IV', 'Annexe V', 'Annexe VI'] }, { name: 'nature', label: 'Nature', type: 'select', options: ['Boues d\'hydrocarbures (sludge)', 'Eaux de cale huileuses', 'Huiles usagées', 'Résidus de cargaison (slops)', 'Eaux usées sanitaires', 'Ordures de navire', 'Résidus d\'épurateurs de fumées'] }, { name: 'volume', label: 'Volume (m³)', type: 'number', step: '0.5', value: 5, required: true }, { name: 'prestataire', label: 'Prestataire agréé', value: 'Gabon Recyclage Industriel (démo)' }, { name: 'date', label: 'Date', type: 'date', value: E.today() }, { name: 'statut', label: 'Statut', type: 'select', options: ['Programmé', 'Réceptionné', 'Refusé — déchet non conforme'] }]),
        onSubmit: function (v) { v.id = nextId('envMarpol', 'MRP-' + yr() + '-', 3); v.site = sc || v.site || 'OWE'; v.volume = +v.volume; S.add('envMarpol', v); E.log('Déchets navire ' + v.id, v.navire + ' · ' + v.annexe + ' · ' + v.volume + ' m³', 'hse'); ui.toast('Réception ' + v.id + ' enregistrée'); E.rerender(); } });
    };
    $('#dc-new', el).onclick = function () {
      ui.formModal({ title: 'Enregistrer un enlèvement de déchets', sub: sc ? portLong(sc) : '', fields: [{ name: 'type', label: 'Nature du déchet', required: true, full: true }].concat(sc ? [] : [{ name: 'site', label: 'Port', type: 'select', options: PORT_OPTS }]).concat([{ name: 'categorie', label: 'Catégorie', type: 'select', options: ['Dangereux', 'Non dangereux'] }, { name: 'quantite', label: 'Quantité (t)', type: 'number', step: '0.1', value: 1, required: true }, { name: 'filiere', label: 'Filière', type: 'select', options: ['Valorisation matière', 'Recyclage', 'Régénération', 'Incinération', 'Centre de traitement agréé', 'Enfouissement (CET)'] }, { name: 'prestataire', label: 'Prestataire', value: 'Gabon Recyclage Industriel (démo)' }, { name: 'date', label: 'Date', type: 'date', value: E.today() }, { name: 'statut', label: 'Statut', type: 'select', options: ['Enlevé', 'En attente d\'enlèvement', 'Stocké sur site'] }]),
        onSubmit: function (v) { v.id = nextId('envDechets', 'BSD-' + yr() + '-', 3); v.site = sc || v.site || 'OWE'; v.quantite = +v.quantite; S.add('envDechets', v); E.log('Déchets ' + v.id, v.type + ' · ' + v.quantite + ' t', 'hse'); ui.toast('Bordereau ' + v.id + ' enregistré'); E.rerender(); } });
    };
    $('#mg-new', el).onclick = function () {
      ui.formModal({ title: 'Observation de la mangrove', fields: [{ name: 'id', label: 'Station', type: 'select', options: mg.map(function (m) { return { v: m.id, l: m.station }; }), full: true }, { name: 'date', label: 'Date', type: 'date', value: E.today() }, { name: 'hc', label: 'HC sédiments (mg/kg)', type: 'number', value: 150 }, { name: 'vegetation', label: 'État de la végétation', type: 'select', options: ['Bon', 'Stress léger', 'Dégradé'] }, { name: 'statut', label: 'Statut', type: 'select', options: ['Conforme', 'Surveillance renforcée', 'Non conforme'] }, { name: 'obs', label: 'Observations', type: 'textarea' }],
        onSubmit: function (v) { var m = S.get('envMangrove', v.id); Object.assign(m, { date: v.date, hc: v.hc, vegetation: v.vegetation, statut: v.statut, obs: v.obs || m.obs }); S.save(); E.log('Observation mangrove', m.station, 'hse'); ui.toast('Observation enregistrée'); E.rerender(); } });
    };
  }
  var DC_COLS = [
    { label: 'Bordereau', render: function (d) { return '<b class="nowrap">' + d.id + '</b><div class="small muted">' + fmt.dateShort(d.date) + (SC() ? '' : ' · ' + portName(d.site)) + '</div>'; }, csv: function (d) { return d.id; } },
    { label: 'Déchet', render: function (d) { return '<div class="hse-cell"><b>' + esc(d.type) + '</b><div class="small muted">' + esc(d.filiere) + '</div></div>'; }, csv: function (d) { return d.type + ' — ' + d.filiere; } },
    { label: 'Quantité', num: true, render: function (d) { return num(d.quantite, 1) + ' t'; }, csv: function (d) { return d.quantite; } },
    { label: 'Catégorie', render: function (d) { return ui.badge(d.categorie, d.categorie === 'Dangereux' ? 'red' : 'grey'); }, csv: function (d) { return d.categorie; } }
  ];
  var MP_COLS = [
    { label: 'N°', render: function (m) { return '<b class="nowrap">' + m.id + '</b><div class="small muted">' + fmt.dateShort(m.date) + '</div>'; }, csv: function (m) { return m.id; } },
    { label: 'Navire', render: function (m) { return '<b>' + esc(m.navire) + '</b>' + (SC() ? '' : '<div class="small muted">' + portName(m.site) + '</div>'); }, csv: function (m) { return m.navire + ' (' + portName(m.site) + ')'; } },
    { label: 'Déchet', render: function (m) { return '<div class="hse-cell">' + ui.badge(m.annexe, m.annexe === 'Annexe I' ? 'violet' : m.annexe === 'Annexe IV' ? 'blue' : 'grey') + ' ' + esc(m.nature) + '<div class="small muted">' + esc(m.prestataire) + '</div></div>'; }, csv: function (m) { return m.annexe + ' — ' + m.nature; } },
    { label: 'Volume', num: true, render: function (m) { return num(m.volume, 1) + ' m³'; }, csv: function (m) { return m.volume; } },
    { label: 'Statut', render: function (m) { return ui.badge(m.statut, /Refus/.test(m.statut) ? 'red' : m.statut === 'Réceptionné' ? 'green' : 'orange'); }, csv: function (m) { return m.statut; } }
  ];

  /* ------------------------------------------------------------------ onglet Sûreté portuaire (code ISPS) */
  var NIV = { 1: { l: 'Normal', tone: 'green', mesures: ['Contrôle des accès par badge à toutes les entrées', 'Rondes de surveillance selon le plan de sûreté', 'Contrôle par sondage des véhicules et des colis', 'Surveillance des zones d\'accès restreint et des navires à quai'] },
    2: { l: 'Renforcé', tone: 'orange', mesures: ['Fouille systématique des véhicules et des colis', 'Réduction du nombre d\'accès ouverts (une entrée par port)', 'Rondes doublées, surveillance côté mer par la vedette', 'Accompagnement obligatoire de tous les visiteurs', 'Déclaration de sûreté avec chaque navire'] },
    3: { l: 'Exceptionnel', tone: 'red', mesures: ['Suspension des accès non indispensables', 'Évacuation ou interdiction de zones sur instruction de l\'autorité', 'Arrêt possible des opérations de manutention', 'Coordination permanente avec l\'autorité désignée et les forces de l\'ordre'] } };
  /* Niveau de sûreté propre à chaque installation portuaire : enregistrement « ISPS » (Owendo) et « ISPS-POG » (Port-Gentil). */
  function newIsps(site) { return { id: site === 'POG' ? 'ISPS-POG' : 'ISPS', site: site, niveau: 1, depuis: nowISO(), par: 'Système', motif: 'Niveau normal', historique: [{ at: nowISO(), niveau: 1, par: 'Système', motif: 'Niveau 1 — situation normale' }] }; }
  function isps(site) {
    site = site || SC() || 'OWE';
    var x = S.raw('surete').find(function (r) { return r.site === site; });
    if (!x) { x = newIsps(site); S.raw('surete').push(x); S.save(); }
    return x;
  }
  /* niveau le plus élevé des deux ports (vue globale) */
  function ispsMax() { return Math.max(isps('OWE').niveau, isps('POG').niveau); }
  function badgeState(b) { if (b.statut === 'Suspendu' || b.statut === 'Demande en cours') return b.statut; var d = E.daysBetween(E.today(), b.expiration); return d < 0 ? 'Expiré' : d <= 15 ? 'Expire bientôt' : 'Actif'; }
  var BADGE_TONE = { 'Actif': 'green', 'Expire bientôt': 'orange', 'Expiré': 'red', 'Suspendu': 'grey', 'Demande en cours': 'violet' };
  /* Changement du niveau de sûreté d'UN port (celui de l'espace actif ; en vue globale, le port est choisi dans le formulaire). */
  function changeNiveau(site0) {
    var sc = SC(), site = sc || site0 || 'OWE';
    var fields = [{ name: 'niveau', label: 'Niveau de sûreté', type: 'select', options: [{ v: 1, l: 'Niveau 1 — normal' }, { v: 2, l: 'Niveau 2 — renforcé' }, { v: 3, l: 'Niveau 3 — exceptionnel' }], value: isps(site).niveau }, { name: 'motif', label: 'Motif / instruction reçue', type: 'textarea', required: true }];
    if (!sc) fields.unshift({ name: 'port', label: 'Installation portuaire', type: 'select', options: PORT_OPTS.map(function (o) { return { v: o.v, l: o.l + ' — actuellement niveau ' + isps(o.v).niveau }; }), value: site, required: true });
    ui.formModal({ title: 'Modifier le niveau de sûreté ISPS', sub: (sc ? portLong(sc) + ' — ' : '') + 'décision de l\'autorité désignée, mise en œuvre par l\'agent de sûreté de l\'installation portuaire (PFSO)', okLabel: 'Appliquer le niveau',
      intro: '<div class="alert tone-blue" style="margin-bottom:14px">' + icon('info') + '<div>Chaque port a son propre niveau de sûreté. Le changement est horodaté, notifié aux équipes et aux navires à quai du port concerné, et tracé dans le journal d\'audit.</div></div>',
      fields: fields,
      onSubmit: function (v) {
        var s = sc || v.port || site, x = isps(s);
        var n = +v.niveau; if (n === x.niveau) { ui.toast('Le port ' + (s === 'POG' ? 'de Port-Gentil' : 'd\'Owendo') + ' est déjà au niveau ' + n + '.', 'err'); return false; }
        x.historique = x.historique || []; x.historique.unshift({ at: nowISO(), niveau: n, par: user().name, motif: v.motif });
        x.niveau = n; x.depuis = nowISO(); x.par = user().name; x.motif = v.motif; S.save();
        E.withScope(s, function () {
          E.log('Niveau de sûreté ISPS ' + n + ' · ' + portName(s), v.motif, 'hse');
          E.notify('Niveau de sûreté ISPS ' + portName(s) + ' : ' + n + ' (' + NIV[n].l.toLowerCase() + ')', v.motif, '#/hse/surete', NIV[n].tone === 'green' ? 'green' : NIV[n].tone === 'orange' ? 'orange' : 'red');
        });
        ui.toast('Niveau de sûreté ' + n + ' appliqué au port ' + (s === 'POG' ? 'de Port-Gentil' : 'd\'Owendo') + ' — équipes et navires informés'); setTimeout(E.rerender);
      } });
  }
  /* max+1 calculé sur toute la collection (les deux sites) */
  function nextNum(col, base) { return S.raw(col).reduce(function (m, x) { return Math.max(m, +String(x.id).replace(/\D/g, '') || 0); }, base) + 1; }
  function nouveauVisiteur() {
    var sc = SC();
    ui.formModal({ title: 'Enregistrer un visiteur / un véhicule', sub: 'Registre des accès à l\'installation portuaire' + (sc ? ' · ' + portLong(sc) : ''), okLabel: 'Enregistrer l\'entrée',
      fields: [{ name: 'nom', label: 'Nom et prénom', required: true }, { name: 'piece', label: 'Pièce d\'identité / badge', required: true, placeholder: 'CNI, passeport ou n° de badge' }, { name: 'organisme', label: 'Organisme', required: true }, { name: 'motif', label: 'Motif de la visite', required: true },
        { name: 'hote', label: 'Personne visitée', type: 'select', options: empOpts() }].concat(sc ? [] : [{ name: 'site', label: 'Port', type: 'select', options: PORT_OPTS }]).concat([{ name: 'vehicule', label: 'Véhicule (immatriculation)', placeholder: 'facultatif' }]),
      onSubmit: function (v) {
        var n = nextNum('visiteurs', 8800), d = new Date();
        var o = { id: 'VIS-' + String(n).padStart(4, '0'), date: E.today(), entree: pad(d.getHours()) + ':' + pad(d.getMinutes()), sortie: '', nom: v.nom, piece: v.piece, organisme: v.organisme, motif: v.motif, hote: v.hote, site: sc || v.site || 'OWE', vehicule: v.vehicule || '', statut: 'Sur site' };
        S.add('visiteurs', o); E.log('Entrée visiteur ' + o.id, o.nom + ' · ' + o.organisme, 'hse'); ui.toast('Entrée enregistrée — badge visiteur remis à ' + o.nom); setTimeout(E.rerender);
      } });
  }
  function nouveauBadge() {
    var sc = SC();
    ui.formModal({ title: 'Demande de badge d\'accès', sub: 'Contrôle d\'identité puis visa du PFSO' + (sc ? ' · ' + portLong(sc) : ''), okLabel: 'Émettre la demande',
      fields: [{ name: 'titulaire', label: 'Titulaire', required: true }, { name: 'type', label: 'Type', type: 'select', options: ['Permanent GPM', 'Entreprise extérieure', 'Transporteur (camion)', 'Agent consignataire', 'Administration (douane)'] }, { name: 'organisme', label: 'Organisme', required: true }].concat(sc ? [] : [{ name: 'site', label: 'Port', type: 'select', options: PORT_OPTS }]).concat([
        { name: 'zones', label: 'Zones autorisées', type: 'select', options: ['Parc à conteneurs', 'Zone d\'accès restreint (quais)', 'Zone pétrolière (poste 4 / soutage)', 'Toutes zones'] }, { name: 'duree', label: 'Validité', type: 'select', options: [{ v: 30, l: '1 mois' }, { v: 180, l: '6 mois' }, { v: 365, l: '1 an' }], value: 365 }]),
      onSubmit: function (v) {
        var n = nextNum('badgesISPS', 6000);
        var b = { id: 'BDG-' + String(n).padStart(4, '0'), site: sc || v.site || 'OWE', titulaire: v.titulaire, type: v.type, organisme: v.organisme, zones: v.zones === 'Toutes zones' ? ['Zone d\'accès restreint (quais)', 'Parc à conteneurs', 'Zone pétrolière (poste 4 / soutage)', 'Bâtiments administratifs'] : [v.zones], emission: E.today(), expiration: E.addDays(E.today(), +v.duree), statut: 'Demande en cours' };
        S.add('badgesISPS', b); E.log('Demande de badge ' + b.id, b.titulaire + ' · ' + portName(b.site), 'hse'); E.notify('Badge à viser (PFSO)', b.titulaire + ' — ' + b.organisme, '#/hse/surete', 'violet'); ui.toast('Demande ' + b.id + ' transmise au PFSO'); setTimeout(E.rerender);
      } });
  }
  function ficheBadge(b) {
    var st = badgeState(b), acts = [{ label: 'Fermer' }];
    if (isHSE()) {
      if (st === 'Demande en cours') acts.push({ label: 'Viser et activer', cls: 'success', icon: 'check', onClick: function (c) { b.statut = 'Actif'; b.emission = E.today(); S.save(); E.log('Badge activé ' + b.id, b.titulaire, 'hse'); c(); ui.toast('Badge ' + b.id + ' activé'); E.rerender(); } });
      if (st === 'Actif' || st === 'Expire bientôt' || st === 'Expiré') acts.push({ label: 'Renouveler (1 an)', icon: 'refresh', onClick: function (c) { b.expiration = E.addDays(E.today(), 365); b.statut = 'Actif'; S.save(); E.log('Badge renouvelé ' + b.id, b.titulaire, 'hse'); c(); ui.toast('Badge renouvelé jusqu\'au ' + fmt.date(b.expiration)); E.rerender(); } });
      if (st !== 'Suspendu' && st !== 'Demande en cours') acts.push({ label: 'Suspendre', cls: 'danger', icon: 'lock', onClick: function (c) { b.statut = 'Suspendu'; S.save(); E.log('Badge suspendu ' + b.id, b.titulaire, 'hse'); c(); ui.toast('Badge suspendu — accès bloqué'); E.rerender(); } });
      if (st === 'Suspendu') acts.push({ label: 'Réactiver', cls: 'success', icon: 'check', onClick: function (c) { b.statut = 'Actif'; S.save(); c(); ui.toast('Badge réactivé'); E.rerender(); } });
    }
    ui.modal({ title: 'Badge ' + b.id, sub: esc(b.titulaire), body: '<div class="hse-badgecard"><div class="hse-badgecard__h"><b>GPM · Accès portuaire</b><span>' + esc(b.id) + '</span></div><div class="hse-badgecard__b">' + ui.avatar(b.titulaire) + '<div><b>' + esc(b.titulaire) + '</b><div class="small muted">' + esc(b.organisme) + '</div><div class="small">' + esc(b.type) + '</div></div></div><div class="hse-badgecard__f">' + ui.badge(st, BADGE_TONE[st]) + '<span class="small">valide jusqu\'au <b>' + fmt.date(b.expiration) + '</b></span></div></div>' +
      '<dl class="kv" style="margin-top:14px"><dt>Zones autorisées</dt><dd>' + esc((b.zones || []).join(' · ')) + '</dd><dt>Émis le</dt><dd>' + fmt.date(b.emission) + '</dd></dl>', actions: acts });
  }
  /* carte du niveau de sûreté d'un port */
  function nivCard(x, dual) {
    var niv = NIV[x.niveau];
    return '<div class="card hse-niv n' + x.niveau + (dual ? ' hse-niv--dual' : '') + '"><div class="card__b"><div class="hse-niv__top"><span>' + (dual ? '<b class="hse-niv__port">' + icon('pin') + 'Port ' + (x.site === 'POG' ? 'de Port-Gentil' : 'd\'Owendo') + '</b>' : 'Niveau de sûreté ISPS en vigueur') + '</span>' + (isHSE() ? '<button class="btn sm" data-niv="' + x.site + '">' + icon('edit') + 'Modifier</button>' : '') + '</div>' +
      '<div class="hse-niv__lvl">' + [1, 2, 3].map(function (n) { return '<div class="' + (n === x.niveau ? 'on' : '') + '"><b>' + n + '</b><span>' + NIV[n].l + '</span></div>'; }).join('') + '</div>' +
      '<p class="small" style="margin:12px 0 4px">Depuis le <b>' + fDT(x.depuis) + '</b> · ' + esc(x.par || '') + '</p><p class="small muted" style="margin:0">' + esc(x.motif || '') + '</p>' +
      (dual ? '<details class="hse-niv__more"><summary>Mesures applicables au niveau ' + x.niveau + '</summary><ul class="hse-mes">' + niv.mesures.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></details>' :
        '<h4 class="hse-h4">Mesures applicables au niveau ' + x.niveau + '</h4><ul class="hse-mes">' + niv.mesures.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>') + '</div></div>';
  }
  function tabSurete(el) {
    var sc = SC(), x = isps(), st = state.sur;
    /* historique des niveaux : celui du port ; en vue globale, les deux ports fusionnés */
    var hist = sc ? (x.historique || []).map(function (h) { return Object.assign({ site: sc }, h); }) :
      ['OWE', 'POG'].reduce(function (a, s) { return a.concat((isps(s).historique || []).map(function (h) { return Object.assign({ site: s }, h); })); }, []).sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    var vis = S.all('visiteurs').slice().sort(function (a, b) { return (b.date + b.entree).localeCompare(a.date + a.entree); });
    var surSite = vis.filter(function (v) { return v.statut === 'Sur site'; }), today = vis.filter(function (v) { return v.date === E.today(); });
    var badges = S.all('badgesISPS'), bAlert = badges.filter(function (b) { var s = badgeState(b); return s === 'Expiré' || s === 'Expire bientôt'; }), bDem = badges.filter(function (b) { return badgeState(b) === 'Demande en cours'; });
    var dos = S.all('declarationsSurete').slice().sort(function (a, b) { return b.date.localeCompare(a.date); }), dosSign = dos.filter(function (d) { return d.statut === 'À signer'; });
    var exs = S.all('exercicesISPS').slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    var lastEx = exs.filter(function (e) { return e.statut === 'Réalisé'; }).slice(-1)[0], nextEx = exs.find(function (e) { return e.statut === 'Planifié'; });
    var html = '<div class="grid g-1-2 hse-sur">' +
      (sc ? nivCard(x) : '<div class="stack">' + nivCard(isps('OWE'), true) + nivCard(isps('POG'), true) + '</div>') +
      '<div class="stack"><div class="grid g4" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">' +
        ui.kpi({ label: 'Visiteurs sur site', value: surSite.length, icon: 'users', tone: 'blue', foot: today.length + ' entrée(s) aujourd\'hui' }) +
        ui.kpi({ label: 'Badges actifs', value: badges.filter(function (b) { var s = badgeState(b); return s === 'Actif' || s === 'Expire bientôt'; }).length, icon: 'badge', tone: 'green', foot: bAlert.length + ' à renouveler · ' + bDem.length + ' demande(s)' }) +
        ui.kpi({ label: 'Déclarations de sûreté', value: dosSign.length, unit: 'à signer', icon: 'doc', tone: dosSign.length ? 'orange' : 'green', foot: dos.length + ' déclarations enregistrées' }) +
        ui.kpi({ label: 'Prochain exercice', value: nextEx ? fmt.dateShort(nextEx.date) : '—', icon: 'target', tone: 'violet', foot: lastEx ? 'dernier : ' + lastEx.score + ' / 100' : '' }) + '</div>' +
        '<div class="card"><div class="card__h"><h3>Historique des niveaux</h3>' + (sc ? '' : '<span class="sub">Owendo et Port-Gentil</span>') + '</div><div class="card__b"><div class="timeline">' + hist.slice(0, sc ? 4 : 6).map(function (h, i) { return '<div class="tl-item ' + (i === 0 ? 'current' : 'done') + '"><b>' + (sc ? '' : portName(h.site) + ' · ') + 'Niveau ' + h.niveau + ' — ' + esc(NIV[h.niveau].l) + '</b><span>' + fDT(h.at) + ' · ' + esc(h.par) + ' · ' + esc(h.motif) + '</span></div>'; }).join('') + '</div></div></div></div></div>';
    html += '<div class="chips hse-surchips" id="sur-vue" style="margin:16px 0 12px">' + [['badges', 'Badges d\'accès'], ['visiteurs', 'Visiteurs & véhicules'], ['dos', 'Déclarations de sûreté'], ['exercices', 'Exercices & entraînements']].map(function (c) { return '<button class="chip' + (st.vue === c[0] ? ' is-active' : '') + '" data-k="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div><div id="sur-body"></div>';
    el.innerHTML = html;
    $$('[data-niv]', el).forEach(function (bt) { bt.onclick = function () { changeNiveau(bt.dataset.niv); }; });
    $$('#sur-vue .chip', el).forEach(function (c) { c.onclick = function () { st.vue = c.dataset.k; tabSurete(el); }; });
    var sb = $('#sur-body', el);
    if (st.vue === 'badges') {
      var BC = [{ label: 'Badge', render: function (x) { return '<b class="nowrap">' + x.id + '</b>'; }, csv: function (x) { return x.id; } }, { label: 'Titulaire', render: function (x) { return '<div class="hse-cell"><b>' + esc(x.titulaire) + '</b><div class="small muted">' + esc(x.organisme) + '</div></div>'; }, csv: function (x) { return x.titulaire; } }, { label: 'Type', key: 'type' }, { label: 'Zones', render: function (x) { return '<span class="small">' + esc((x.zones || []).join(' · ')) + '</span>'; }, csv: function (x) { return (x.zones || []).join(' / '); } }, { label: 'Expiration', render: function (x) { return '<span class="nowrap">' + fmt.date(x.expiration) + '</span>'; }, csv: function (x) { return x.expiration; } }, { label: 'État', render: function (x) { var s = badgeState(x); return ui.badge(s, BADGE_TONE[s]); }, csv: badgeState }];
      if (!sc) BC.splice(2, 0, { label: 'Port', render: function (x) { return portName(x.site); }, csv: function (x) { return portName(x.site); } });
      var rowsB = badges.slice().sort(function (a, c) { var o = { 'Demande en cours': 0, 'Expiré': 1, 'Expire bientôt': 2, 'Suspendu': 3, 'Actif': 4 }; return o[badgeState(a)] - o[badgeState(c)] || a.id.localeCompare(c.id); });
      sb.innerHTML = '<div class="card"><div class="card__h"><h3>Badges d\'accès à la zone portuaire</h3><span class="sub">' + badges.length + ' badges · cliquez une ligne pour viser, renouveler ou suspendre</span><div class="spacer"></div><button class="btn sm" id="bd-csv">' + icon('download') + 'CSV</button>' + (isHSE() ? '<button class="btn primary sm" id="bd-new">' + icon('plus') + 'Demande de badge</button>' : '') + '</div>' + ui.table(BC, rowsB, { onRow: ficheBadge }) + '</div>';
      $('#bd-csv', sb).onclick = function () { ui.exportCSV('badges-isps', BC, rowsB); };
      var nb = $('#bd-new', sb); if (nb) nb.onclick = nouveauBadge;
    } else if (st.vue === 'visiteurs') {
      var VC = [{ label: 'Date', render: function (v) { return '<span class="nowrap">' + fmt.dateShort(v.date) + ' · ' + v.entree + (v.sortie ? ' → ' + v.sortie : '') + '</span>'; }, csv: function (v) { return v.date + ' ' + v.entree + '-' + v.sortie; } }, { label: 'Visiteur', render: function (v) { return '<div class="hse-cell"><b>' + esc(v.nom) + '</b><div class="small muted">' + esc(v.organisme) + ' · ' + esc(v.piece) + '</div></div>'; }, csv: function (v) { return v.nom + ' (' + v.organisme + ')'; } }, { label: 'Motif', render: function (v) { return '<span class="small">' + esc(v.motif) + '</span><div class="small muted">visité : ' + esc(E.empName(v.hote)) + '</div>'; }, csv: function (v) { return v.motif; } }, { label: 'Véhicule', render: function (v) { return esc(v.vehicule || '—'); }, csv: function (v) { return v.vehicule; } }, { label: 'Port', render: function (v) { return v.site === 'POG' ? 'Port-Gentil' : 'Owendo'; }, csv: function (v) { return v.site; } }, { label: 'Statut', render: function (v) { return v.statut === 'Sur site' ? (isHSE() ? '<button class="btn sm" data-out="' + v.id + '">' + icon('logout') + 'Sortie</button>' : ui.badge('Sur site', 'blue')) : ui.badge(v.statut, v.statut === 'Refoulé' ? 'red' : 'grey'); }, csv: function (v) { return v.statut; } }];
      if (sc) VC = VC.filter(function (c) { return c.label !== 'Port'; });
      sb.innerHTML = '<div class="card"><div class="card__h"><h3>Registre des visiteurs et des véhicules</h3><span class="sub">' + surSite.length + ' personne(s) actuellement sur site</span><div class="spacer"></div><button class="btn sm" id="vi-csv">' + icon('download') + 'CSV</button>' + (isHSE() ? '<button class="btn primary sm" id="vi-new">' + icon('plus') + 'Entrée visiteur</button>' : '') + '</div>' + ui.table(VC, vis, { empty: 'Aucun visiteur' }) + '</div>';
      $('#vi-csv', sb).onclick = function () { ui.exportCSV('registre-visiteurs', VC, vis); };
      var nv = $('#vi-new', sb); if (nv) nv.onclick = nouveauVisiteur;
      $$('[data-out]', sb).forEach(function (bt) { bt.onclick = function () { var v = S.get('visiteurs', bt.dataset.out), d = new Date(); v.sortie = pad(d.getHours()) + ':' + pad(d.getMinutes()); v.statut = 'Sorti'; S.save(); E.log('Sortie visiteur ' + v.id, v.nom, 'hse'); ui.toast('Sortie de ' + v.nom + ' enregistrée — badge visiteur restitué'); tabSurete(el); }; });
    } else if (st.vue === 'dos') {
      var DCOL = [{ label: 'N°', render: function (d) { return '<b class="nowrap">' + d.id + '</b><div class="small muted">' + fmt.dateShort(d.date) + '</div>'; }, csv: function (d) { return d.id; } }, { label: 'Navire', render: function (d) { return '<b>' + esc(d.navire) + '</b><div class="small muted">IMO ' + esc(d.imo || '—') + (sc ? '' : ' · ' + portName(d.site)) + '</div>'; }, csv: function (d) { return d.navire + ' (' + portName(d.site) + ')'; } }, { label: 'Niveaux', render: function (d) { return '<span class="nowrap">navire ' + d.niveauNavire + ' · port ' + d.niveauPort + '</span>'; }, csv: function (d) { return d.niveauNavire + '/' + d.niveauPort; } }, { label: 'Motif', render: function (d) { return '<span class="small">' + esc(d.motif) + '</span>'; }, csv: function (d) { return d.motif; } }, { label: 'Signataires', render: function (d) { return '<span class="small">' + esc(d.sso) + '<br>' + esc(d.pfso) + ' (PFSO)</span>'; }, csv: function (d) { return d.sso + ' / ' + d.pfso; } }, { label: 'Statut', render: function (d) { return d.statut === 'À signer' && isHSE() ? '<button class="btn sm success" data-sign="' + d.id + '">' + icon('check') + 'Signer</button>' : ui.badge(d.statut, d.statut === 'Signée' ? 'green' : d.statut === 'À signer' ? 'orange' : 'grey'); }, csv: function (d) { return d.statut; } }];
      sb.innerHTML = '<div class="card"><div class="card__h"><h3>Déclarations de sûreté navire / port</h3><span class="sub">accord sur les mesures de sûreté de l\'interface navire-port</span><div class="spacer"></div>' + (isHSE() ? '<button class="btn primary sm" id="dos-new">' + icon('plus') + 'Nouvelle déclaration</button>' : '') + '</div>' + ui.table(DCOL, dos) + '</div>';
      $$('[data-sign]', sb).forEach(function (bt) { bt.onclick = function () { var d = S.get('declarationsSurete', bt.dataset.sign); d.statut = 'Signée'; d.pfso = user().name; S.save(); E.log('Déclaration de sûreté signée ' + d.id, d.navire, 'hse'); ui.toast('Déclaration ' + d.id + ' signée'); tabSurete(el); }; });
      var nd = $('#dos-new', sb); if (nd) nd.onclick = function () {
        /* navires en escale du site actif (collection `escales` de l'ERP, sinon données partagées avec le site public) */
        var src0 = S.has('escales') && S.all('escales').length ? S.all('escales') : (window.GPM_DATA && GPM_DATA.escales ? GPM_DATA.escales() : []);
        var esc0 = src0.filter(function (e) { return e.statut !== 'Appareillé' && (!sc || String(e.site || 'OWE').slice(0, 3) === sc); });
        var escSite = function (e) { return String(e.site || e.poste || 'OWE').slice(0, 3) === 'POG' ? 'POG' : 'OWE'; };
        var f0 = esc0.length ? [{ name: 'escale', label: 'Navire en escale', type: 'select', options: esc0.map(function (e) { return { v: e.id, l: e.navire + ' — ' + e.id + (sc ? '' : ' · ' + portName(escSite(e))) }; }), required: true, full: true }] :
          [{ name: 'navire', label: 'Navire', required: true }, { name: 'imo', label: 'N° IMO' }].concat(sc ? [] : [{ name: 'site', label: 'Port', type: 'select', options: PORT_OPTS }]);
        ui.formModal({ title: 'Déclaration de sûreté', sub: 'Navire / installation portuaire' + (sc ? ' · ' + portLong(sc) : '') + ' — le niveau du port est celui du port d\'escale', fields: f0.concat([{ name: 'niveauNavire', label: 'Niveau de sûreté du navire', type: 'select', options: [1, 2, 3] }, { name: 'motif', label: 'Motif', type: 'textarea', required: true }, { name: 'sso', label: 'Agent de sûreté du navire (SSO)', required: true }]),
          onSubmit: function (v) {
            var e0 = esc0.find(function (e) { return e.id === v.escale; }) || {}, site = sc || (e0.id ? escSite(e0) : v.site) || 'OWE';
            var d = { id: nextId('declarationsSurete', 'DOS-' + yr() + '-', 3), date: E.today(), navire: e0.navire || v.navire || v.escale, imo: e0.imo || v.imo || '', escale: e0.id || '', site: site, niveauNavire: +v.niveauNavire, niveauPort: isps(site).niveau, motif: v.motif, sso: v.sso, pfso: user().name, statut: 'Signée' };
            S.add('declarationsSurete', d); E.log('Déclaration de sûreté ' + d.id, d.navire + ' · ' + portName(site), 'hse'); ui.toast('Déclaration ' + d.id + ' enregistrée'); tabSurete(el);
          } });
      };
    } else {
      var XC = [{ label: 'Date', render: function (e) { return '<b class="nowrap">' + fmt.date(e.date) + '</b><div class="small muted">' + e.id + '</div>'; }, csv: function (e) { return e.date; } }, { label: 'Type', render: function (e) { return ui.badge(e.type, e.type === 'Exercice' ? 'violet' : 'blue'); }, csv: function (e) { return e.type; } }, { label: 'Scénario', render: function (e) { return '<div class="hse-cell"><b>' + esc(e.theme) + '</b>' + (e.constat ? '<div class="small muted">' + esc(e.constat) + '</div>' : '') + '</div>'; }, csv: function (e) { return e.theme; } }, { label: 'Port', render: function (e) { return e.site === 'POG' ? 'Port-Gentil' : 'Owendo'; }, csv: function (e) { return e.site; } }, { label: 'Participants', num: true, key: 'participants' }, { label: 'Résultat', render: function (e) { return e.score != null ? '<b>' + e.score + '</b> / 100' : (isHSE() ? '<button class="btn sm" data-res="' + e.id + '">' + icon('check') + 'Saisir le résultat</button>' : ui.badge('Planifié', 'violet')); }, csv: function (e) { return e.score; } }];
      if (sc) XC = XC.filter(function (c) { return c.label !== 'Port'; });
      sb.innerHTML = '<div class="card"><div class="card__h"><h3>Exercices et entraînements de sûreté</h3><span class="sub">au moins un exercice tous les 3 mois — plan de sûreté de l\'installation portuaire</span><div class="spacer"></div>' + (isHSE() ? '<button class="btn primary sm" id="ex-new">' + icon('plus') + 'Planifier</button>' : '') + '</div>' + ui.table(XC, exs.slice().reverse()) + '</div>';
      $$('[data-res]', sb).forEach(function (bt) { bt.onclick = function () { var e = S.get('exercicesISPS', bt.dataset.res); ui.formModal({ title: 'Résultat de l\'exercice', sub: esc(e.theme), fields: [{ name: 'score', label: 'Note globale (sur 100)', type: 'number', value: 85, required: true }, { name: 'participants', label: 'Participants', type: 'number', value: e.participants }, { name: 'constat', label: 'Constats et axes d\'amélioration', type: 'textarea', required: true }], onSubmit: function (v) { e.score = +v.score; e.participants = +v.participants; e.constat = v.constat; e.statut = 'Réalisé'; S.save(); E.log('Exercice de sûreté réalisé ' + e.id, e.theme + ' · ' + v.score + '/100', 'hse'); ui.toast('Résultat enregistré'); setTimeout(function () { tabSurete(el); }); } }); }; });
      var ne = $('#ex-new', sb); if (ne) ne.onclick = function () { ui.formModal({ title: 'Planifier un exercice ou un entraînement', fields: [{ name: 'type', label: 'Type', type: 'select', options: ['Exercice', 'Entraînement'] }, { name: 'date', label: 'Date', type: 'date', value: D(14), required: true }, { name: 'theme', label: 'Scénario', required: true, full: true }].concat(sc ? [] : [{ name: 'site', label: 'Port', type: 'select', options: PORT_OPTS }]).concat([{ name: 'participants', label: 'Participants prévus', type: 'number', value: 10 }]), onSubmit: function (v) { var o = { id: nextId('exercicesISPS', 'EXS-' + yr() + '-', 3), date: v.date, type: v.type, theme: v.theme, site: sc || v.site || 'OWE', participants: +v.participants, statut: 'Planifié', score: null, constat: '' }; S.add('exercicesISPS', o); E.log('Exercice de sûreté planifié ' + o.id, o.theme, 'hse'); ui.toast('Exercice ' + o.id + ' planifié'); setTimeout(function () { tabSurete(el); }); } }); };
    }
  }

  /* ================================================================== enregistrement */
  E.register({
    id: 'hse', label: 'HSE & sûreté', title: 'HSE & sûreté portuaire', icon: 'shield', group: 'HSE & Sûreté', roles: ['hse', 'exploitation'],
    seed: seed, init: init, render: render,
    summary: function () {
      var a = actifs(), feu = a.filter(function (p) { return p.type === 'FEU'; }).length, late = lateActions().length;
      /* niveau du site actif ; en vue globale, le niveau le plus élevé avec le détail des deux ports */
      var sc = SC(), nv = sc ? isps(sc).niveau : ispsMax(), vis = S.all('visiteurs').filter(function (v) { return v.statut === 'Sur site'; }).length;
      var nFoot = sc ? NIV[nv].l : 'Owendo ' + isps('OWE').niveau + ' · Port-Gentil ' + isps('POG').niveau;
      return [{ label: sc ? 'Niveau de sûreté ISPS' : 'Niveau de sûreté ISPS (max.)', value: String(nv), icon: 'lock', tone: nv === 1 ? 'green' : nv === 2 ? 'orange' : 'red', foot: nFoot + ' · ' + vis + ' visiteur(s) sur site', href: '#/hse/surete' },
        { label: 'Jours sans accident avec arrêt', value: String(joursSans()), icon: 'shield', tone: 'green', foot: recordLbl() + ' : ' + recordJ() + ' jours', href: '#/hse/indicateurs' },
        { label: 'Permis de travail actifs', value: String(a.length), icon: 'helmet', tone: feu ? 'red' : 'blue', foot: feu + ' permis de feu en cours', href: '#/hse' },
        { label: 'Actions HSE en retard', value: String(late), icon: 'alert', tone: late ? 'orange' : 'green', foot: S.all('actionsHSE').filter(function (x) { return x.statut !== 'Réalisée'; }).length + ' actions ouvertes', href: '#/hse/actions' }];
    },
    pending: function (u) {
      var out = [], hse = u && (u.profile === 'hse' || u.profile === 'admin');
      if (hse) {
        S.all('declarationsSurete').filter(function (d) { return d.statut === 'À signer'; }).forEach(function (d) { out.push({ title: d.id + ' · Déclaration de sûreté à signer', sub: d.navire + ' · ' + (d.site === 'POG' ? 'Port-Gentil' : 'Owendo'), date: d.date, href: '#/hse/surete', tone: 'orange', icon: 'shield' }); });
        S.all('badgesISPS').filter(function (b) { return badgeState(b) === 'Demande en cours'; }).forEach(function (b) { out.push({ title: b.id + ' · Badge d\'accès à viser (PFSO)', sub: b.titulaire + ' · ' + b.organisme, date: b.emission, href: '#/hse/surete', tone: 'violet', icon: 'badge' }); });
        permis().filter(function (p) { return p.statut === 'Préparé'; }).forEach(function (p) { var bl = authChecks(p).some(function (c) { return !c.ok; }); out.push({ title: p.id + ' · ' + TYPES[p.type].s + ' — ' + p.equipement, sub: 'À autoriser' + (bl ? ' (contrôle bloquant)' : '') + ' · ' + uName(p.unite) + ' · ' + ent(p.entreprise), date: p.debut.slice(0, 10), href: '#/hse/permis/' + p.id, tone: p.type === 'FEU' ? 'red' : 'orange', icon: p.type === 'FEU' ? 'fire' : 'shield' }); });
        permis().filter(function (p) { return p.statut === 'Demandé'; }).forEach(function (p) { out.push({ title: p.id + ' · ' + TYPES[p.type].s + ' — ' + p.equipement, sub: 'Demande à préparer · demandé par ' + E.empName(p.demandeur), date: p.debut.slice(0, 10), href: '#/hse/permis/' + p.id, tone: 'violet', icon: 'edit' }); });
      }
      S.all('plansPrevention').filter(function (p) { return p.statut === 'Inspection commune'; }).forEach(function (p) { out.push({ title: p.id + ' · Plan de prévention à signer', sub: ent(p.entreprise) + ' · ' + p.travaux, date: p.debut, href: '#/hse/prevention/' + p.id, tone: 'orange', icon: 'doc' }); });
      lateActions().forEach(function (a) { out.push({ title: a.id + ' · Action HSE en retard', sub: a.libelle + ' · ' + E.empName(a.responsable), date: a.echeance, href: '#/hse/actions', tone: 'red', icon: 'alert' }); });
      return out;
    },
    search: function (q) {
      var out = [];
      permis().forEach(function (p) { if (E.norm([p.id, p.equipement, p.description, p.ot, TYPES[p.type].l, ent(p.entreprise)].join(' ')).indexOf(q) >= 0) out.push({ title: p.id + ' · ' + TYPES[p.type].s, sub: p.equipement + ' · ' + p.statut, href: '#/hse/permis/' + p.id }); });
      S.all('plansPrevention').forEach(function (p) { if (E.norm([p.id, p.travaux, ent(p.entreprise)].join(' ')).indexOf(q) >= 0) out.push({ title: p.id + ' · Plan de prévention', sub: ent(p.entreprise) + ' · ' + p.statut, href: '#/hse/prevention/' + p.id }); });
      S.all('incidents').forEach(function (i) { if (E.norm([i.id, i.titre, i.lieu, EVT[i.type].l].join(' ')).indexOf(q) >= 0) out.push({ title: i.id + ' · ' + i.titre, sub: EVT[i.type].l + ' · ' + fmt.date(i.date), href: '#/hse/evenements/' + i.id }); });
      S.all('actionsHSE').forEach(function (a) { if (E.norm(a.id + ' ' + a.libelle).indexOf(q) >= 0) out.push({ title: a.id + ' · Action HSE', sub: a.libelle, href: '#/hse/actions' }); });
      return out;
    },
    badge: function () { return permis().filter(function (p) { return p.statut === 'Préparé' || p.statut === 'Demandé'; }).length; }
  });
})();
