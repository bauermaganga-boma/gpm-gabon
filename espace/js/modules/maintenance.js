/* GPM · Espace de gestion — module « Flotte & maintenance » (Technique & Achats).
   S'appuie sur la collection commune « flotte » (remorqueurs, vedettes, grues mobiles portuaires Gottwald,
   reach stackers, barge de soutage). Plans de maintenance préventive par seuil d'heures (250/500/1 000/2 000 h)
   et calendaires (carénage, visites de classe, certificats, épreuves de charge), ordres de travail (OT),
   disponibilité, arrêts en cours, planning et déclaration de panne.
   Collections : flotte (partagée), plansMaintenance, ordres. Données fictives de démonstration. */
(function () {
  'use strict';
  var E = window.ERP; if (!E) return;
  var S = E.store, U = E.ui, F = E.fmt, esc = E.esc, ic = E.icon, MOD = 'maintenance';

  var STEPS = ['À valider', 'Planifié', 'En cours', 'Terminé'];
  var OT_TONE = { 'À valider': 'orange', 'Planifié': 'violet', 'En cours': 'blue', 'Terminé': 'green', 'Annulé': 'grey' };
  var PRIO_TONE = { 'Urgente': 'red', 'Haute': 'orange', 'Normale': 'blue', 'Basse': 'grey' };
  var EQ_TONE = { 'Disponible': 'green', 'En mission': 'blue', 'En maintenance': 'orange', 'Hors service': 'red', 'Immobilisé': 'red' };
  var TAUX_MO = 18000; /* coût horaire main-d'œuvre interne (FCFA, démonstration) */
  var USAGE = { 'Remorqueur': 5, 'Vedette de pilotage': 4, 'Vedette d\'amarrage': 3, 'Vedette hydrographique': 2, 'Grue mobile portuaire': 13, 'Engin de parc': 15, 'Barge de soutage': 3 };
  var TYPE_IC = { 'Remorqueur': 'tug', 'Vedette de pilotage': 'ship', 'Vedette d\'amarrage': 'ship', 'Vedette hydrographique': 'compass', 'Grue mobile portuaire': 'crane', 'Engin de parc': 'container', 'Barge de soutage': 'fuel' };
  var PHOTO = { 'Grue mobile portuaire': '../assets/img/owendo-grues-mobiles.jpg', 'Engin de parc': '../assets/img/owendo-reach-stacker.jpg' };

  function d(n) { return E.addDays(E.today(), n); }
  function dt(n, h) { return d(n) + 'T' + String(h || 0).padStart(2, '0') + ':00'; }
  function today() { return E.today(); }
  function now() { var x = new Date(); return E.iso(x) + 'T' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); }
  function me() { var u = E.session.user(); return u ? u.name : 'Système'; }
  function prof() { var u = E.session.user(); return u ? u.profile : ''; }
  function canTech() { return prof() === 'admin' || prof() === 'technique'; }
  function flotte() { return S.all('flotte'); }
  function eq(id) { return S.get('flotte', id); }
  function eqNom(id) { var e = eq(id); return e ? e.nom : id; }
  function OT() { return S.all('ordres').filter(function (o) { return o && o.equip; }); }
  function ot(id) { return S.get('ordres', id); }
  function plans() { return S.all('plansMaintenance'); }
  function isOpen(o) { return ['Terminé', 'Annulé'].indexOf(o.statut) < 0; }
  function arret(e) { return e.statut === 'En maintenance' || e.statut === 'Hors service' || e.statut === 'Immobilisé'; }
  function stB(s) { return U.badge(s, OT_TONE[s] || 'grey'); }
  function eqB(s) { return U.badge(s, EQ_TONE[s] || 'grey'); }
  function prB(p) { return U.badge(p, PRIO_TONE[p] || 'grey'); }
  function when(s) { s = String(s || ''); return s ? F.dateShort(s) + (s.length > 10 ? ' · ' + s.slice(11, 16).replace(':', 'h') : '') : '—'; }
  function isTech(e) { return e.direction === 'TECH' || /m[ée]canicien|technicien|[ée]lectric/i.test(e.poste || ''); }
  /* Techniciens du site actif ; à défaut (petit site), personnel navigant et d'exploitation du site, puis techniciens des autres sites. */
  function techs() {
    var L = S.all('employes').filter(isTech);
    if (!L.length) L = S.all('employes').filter(function (e) { return e.statut !== 'Sorti' && (e.direction === 'MAR' || e.direction === 'EXP'); });
    if (!L.length) L = S.raw('employes').filter(isTech);
    return L;
  }
  /* Nom d'un agent, même s'il est rattaché à l'autre site (intervenants détachés) */
  function empName(id) { var e = S.raw('employes').find(function (x) { return x.id === id; }); return e ? e.nom : (id || '—'); }
  function siteSuffix(e) { return E.scope() ? '' : ' · ' + (e.site === 'POG' ? 'Port-Gentil' : 'Owendo'); }
  function techOpts() { return techs().map(function (e) { return { v: e.id, l: e.nom + ' — ' + e.poste }; }); }
  function empByName(n) { var e = S.all('employes').find(function (x) { return x.nom === n; }); return e ? e.id : ''; }
  function eqOpts() { return flotte().map(function (e) { return { v: e.id, l: e.id + ' — ' + e.nom }; }); }
  function cost(o) { return E.sum(o.pieces || [], function (p) { return (+p.qte || 0) * (+p.pu || 0); }) + (+o.heuresMO || 0) * TAUX_MO + (+o.prestation || 0); }
  function usage(e) { return USAGE[e.type] || 6; }

  /* ------------------------------------------------------------------ plans types par famille d'équipement */
  function planTypes(e) {
    var naval = ['Remorqueur', 'Vedette de pilotage', 'Vedette d\'amarrage', 'Vedette hydrographique', 'Barge de soutage'].indexOf(e.type) >= 0;
    if (e.type === 'Grue mobile portuaire') return [
      ['H', 250, 'Entretien 250 h — graissage, contrôle des câbles et limiteurs'], ['H', 500, 'Entretien 500 h — vidange moteur diesel, filtres, contrôle hydraulique'],
      ['H', 1000, 'Entretien 1 000 h — analyse d\'huile, révision circuits hydrauliques'], ['H', 2000, 'Entretien 2 000 h — révision mécanismes de levage et d\'orientation'],
      ['C', 365, 'Épreuve de charge et certificat de levage'], ['C', 180, 'Vérification générale périodique (VGP)']];
    if (e.type === 'Engin de parc') return [
      ['H', 250, 'Entretien 250 h — graissage, pneumatiques, sécurité'], ['H', 500, 'Entretien 500 h — vidange moteur, filtres'], ['H', 2000, 'Entretien 2 000 h — révision spreader et vérins de flèche'],
      ['C', 180, 'Vérification générale périodique (VGP)']];
    if (naval) return [
      ['H', 500, 'Entretien 500 h — vidange moteurs principaux, filtres'], ['H', 2000, 'Entretien 2 000 h — révision propulsion et lignes d\'arbres'],
      ['C', 730, 'Carénage — mise à sec, coque, anodes, peinture'], ['C', 365, 'Visite annuelle de la société de classification'], ['C', 365, 'Renouvellement des certificats de sécurité']].concat(e.type === 'Remorqueur' ? [['H', 1000, 'Entretien 1 000 h — groupes électrogènes, pompes et treuil']] : []);
    return [['H', 500, 'Entretien 500 h'], ['C', 365, 'Visite annuelle']];
  }

  /* ------------------------------------------------------------------ données d'exemple */
  function seed() {
    if (S.has('plansMaintenance')) return null;
    var P = [], n = 0;
    flotte().forEach(function (e, ei) {
      planTypes(e).forEach(function (t, ti) {
        var frac = ((ei * 37 + ti * 53) % 97) / 100; /* avancement dans l'intervalle */
        var p = { id: 'PM-' + String(++n).padStart(3, '0'), equip: e.id, type: t[0] === 'H' ? 'Heures' : 'Calendaire', intervalle: t[1], libelle: t[2] };
        if (p.type === 'Heures') p.dernierH = Math.max(0, Math.round((e.heures - t[1] * (0.08 + frac * 0.85)) / 10) * 10), p.dernierDate = d(-Math.round((e.heures - p.dernierH) / usage(e)));
        else p.dernierDate = d(-Math.round(t[1] * (0.1 + frac * 0.85)));
        P.push(p);
      });
    });
    function setP(eqId, re, patch) { var p = P.find(function (x) { return x.equip === eqId && re.test(x.libelle); }); if (p) Object.assign(p, patch); return p; }
    var gr3 = eq('GR-03'), rm2 = eq('RM-02');
    if (gr3) setP('GR-03', /500 h/, { dernierH: gr3.heures - 500, dernierDate: d(-38) });
    if (rm2) setP('RM-02', /Carénage/, { dernierDate: d(-718) });
    setP('BS-01', /classification/, { dernierDate: d(-359) });
    setP('RS-03', /VGP/, { dernierDate: d(-186) });
    setP('VP-01', /certificats/, { dernierDate: d(-362) });

    var T = { cedric: empByName('Boussougou Cédric'), sandrine: empByName('Mayila Sandrine'), ibinga: empByName('Ibinga Fabrice'), brice: empByName('Assoumou Brice'), fabrice: empByName('Mbadinga Fabrice') };
    function mk(o) {
      var x = Object.assign({ id: S.next('OT'), pieces: [], heuresMO: 0, prestation: 0, historique: [] }, o);
      x.historique.push({ at: x.cree || x.debut, user: x.demandeur || 'Fabrice Mbadinga', action: x.type === 'Correctif' ? 'Panne déclarée' : 'OT préventif généré' });
      if (x.statut !== 'À valider') x.historique.push({ at: x.cree || x.debut, user: 'Fabrice Mbadinga', action: 'OT validé et planifié' });
      if (x.arretDebut) x.historique.push({ at: x.arretDebut, user: 'Fabrice Mbadinga', action: 'Intervention démarrée — équipement immobilisé' });
      if (x.statut === 'Terminé') x.historique.push({ at: x.arretFin || x.fin, user: 'Fabrice Mbadinga', action: 'OT clôturé — équipement remis en service' });
      return x;
    }
    var pc = function (des, q, pu) { return { designation: des, qte: q, pu: pu }; };
    var O = [
      /* historique (terminés) — alimente les taux de disponibilité et les coûts */
      mk({ equip: 'GR-01', titre: 'Remplacement flexible hydraulique de la flèche', type: 'Correctif', priorite: 'Urgente', technicien: T.cedric, debut: dt(-112, 7), fin: dt(-111, 18), statut: 'Terminé', immobilisant: true, arretDebut: dt(-112, 7), arretFin: dt(-111, 16), pieces: [pc('Flexible hydraulique HP DN32', 2, 685000), pc('Huile hydraulique HV46 (fût 208 L)', 1, 410000)], heuresMO: 22, rapport: 'Flexible éclaté remplacé, appoint d\'huile, essais à vide et en charge concluants.' }),
      mk({ equip: 'GR-02', titre: 'Entretien 1 000 h — analyse d\'huile et filtres', type: 'Préventif', priorite: 'Normale', technicien: T.cedric, debut: dt(-96, 6), fin: dt(-96, 18), statut: 'Terminé', immobilisant: true, arretDebut: dt(-96, 6), arretFin: dt(-96, 17), pieces: [pc('Kit filtres hydrauliques', 1, 1250000), pc('Analyse d\'huile (laboratoire)', 3, 95000)], heuresMO: 16 }),
      mk({ equip: 'RS-01', titre: 'Panne transmission — remplacement convertisseur de couple', type: 'Correctif', priorite: 'Haute', technicien: T.cedric, debut: dt(-74, 8), fin: dt(-69, 17), statut: 'Terminé', immobilisant: true, arretDebut: dt(-74, 8), arretFin: dt(-69, 15), pieces: [pc('Convertisseur de couple (échange standard)', 1, 7800000), pc('Joints et visserie', 1, 240000)], heuresMO: 46, prestation: 1500000, rapport: 'Convertisseur remplacé par Engins Services Afrique (démo). Essais de translation OK.' }),
      mk({ equip: 'RM-01', titre: 'Entretien 2 000 h — révision propulsion', type: 'Préventif', priorite: 'Normale', technicien: T.ibinga, debut: dt(-63, 7), fin: dt(-61, 17), statut: 'Terminé', immobilisant: true, arretDebut: dt(-63, 7), arretFin: dt(-61, 16), pieces: [pc('Kit joints d\'étanchéité ligne d\'arbre', 2, 1350000), pc('Huile moteur 15W40 (fût 208 L)', 4, 395000)], heuresMO: 54 }),
      mk({ equip: 'GR-03', titre: 'Défaut capteur de charge — étalonnage limiteur', type: 'Correctif', priorite: 'Haute', technicien: T.sandrine, debut: dt(-51, 9), fin: dt(-51, 15), statut: 'Terminé', immobilisant: true, arretDebut: dt(-51, 9), arretFin: dt(-51, 14), pieces: [pc('Capteur de charge (cellule)', 1, 2150000)], heuresMO: 8 }),
      mk({ equip: 'VP-01', titre: 'Remplacement pompe de cale', type: 'Correctif', priorite: 'Normale', technicien: T.brice, debut: dt(-44, 8), fin: dt(-44, 12), statut: 'Terminé', immobilisant: false, pieces: [pc('Pompe de cale 24 V', 1, 520000)], heuresMO: 4 }),
      mk({ equip: 'RS-03', titre: 'Entretien 500 h — vidange et filtres', type: 'Préventif', priorite: 'Normale', technicien: T.cedric, debut: dt(-37, 7), fin: dt(-37, 13), statut: 'Terminé', immobilisant: true, arretDebut: dt(-37, 7), arretFin: dt(-37, 12), pieces: [pc('Kit vidange moteur (huile + filtres)', 1, 690000)], heuresMO: 6 }),
      mk({ equip: 'BS-01', titre: 'Étalonnage du compteur volumétrique de soutage', type: 'Préventif', priorite: 'Haute', technicien: T.sandrine, debut: dt(-29, 8), fin: dt(-29, 16), statut: 'Terminé', immobilisant: true, arretDebut: dt(-29, 8), arretFin: dt(-29, 15), heuresMO: 7, prestation: 850000, rapport: 'Compteur étalonné, procès-verbal d\'étalonnage joint au dossier.' }),
      mk({ equip: 'GR-02', titre: 'Remplacement câble de levage principal', type: 'Correctif', priorite: 'Urgente', technicien: T.cedric, debut: dt(-21, 6), fin: dt(-20, 20), statut: 'Terminé', immobilisant: true, arretDebut: dt(-21, 6), arretFin: dt(-20, 18), pieces: [pc('Câble de levage antigiratoire Ø 30 mm', 1, 9400000)], heuresMO: 30, rapport: 'Fils cassés constatés lors de l\'inspection quotidienne. Câble remplacé, épreuve de charge réalisée.' }),
      mk({ equip: 'RM-03', titre: 'Remplacement aussière de remorquage', type: 'Correctif', priorite: 'Normale', technicien: T.brice, debut: dt(-3, 8), fin: dt(-3, 12), statut: 'Terminé', immobilisant: false, pieces: [pc('Aussière HMPE Ø 64 mm — 110 m', 1, 4600000)], heuresMO: 4 }),
      mk({ equip: 'RS-01', titre: 'Entretien 250 h — graissage et sécurité', type: 'Préventif', priorite: 'Normale', technicien: T.cedric, debut: dt(-9, 6), fin: dt(-9, 10), statut: 'Terminé', immobilisant: true, arretDebut: dt(-9, 6), arretFin: dt(-9, 10), pieces: [pc('Graisse lithium (seau 18 kg)', 1, 85000)], heuresMO: 4 }),
      /* en cours et à venir */
      mk({ equip: 'RS-02', titre: 'Fuite hydraulique sur vérin de flèche', type: 'Correctif', priorite: 'Haute', technicien: T.cedric, debut: dt(-1, 14), fin: dt(1, 18), statut: 'En cours', immobilisant: true, arretDebut: dt(-1, 14), pieces: [pc('Kit joints vérin de flèche', 1, 1180000)], heuresMO: 10, description: 'Fuite constatée par le conducteur en prise de poste. Engin consigné.' }),
      mk({ equip: 'GR-03', titre: 'Entretien 500 h — vidange moteur, filtres, hydraulique', type: 'Préventif', priorite: 'Haute', technicien: T.cedric, debut: dt(2, 6), fin: dt(2, 16), statut: 'À valider', immobilisant: true, cree: dt(0, 7), plan: 'GR-03/500', description: 'Seuil de 500 h atteint au compteur. À caler hors fenêtre d\'escale porte-conteneurs.' }),
      mk({ equip: 'VP-02', titre: 'Alarme température moteur bâbord', type: 'Correctif', priorite: 'Normale', technicien: T.brice, debut: dt(1, 8), fin: dt(1, 12), statut: 'À valider', immobilisant: false, cree: dt(-1, 17), demandeur: 'Ekomi Landry', description: 'Alarme intermittente en fin de manœuvre. Vérifier thermostat et échangeur.' }),
      mk({ equip: 'BS-01', titre: 'Visite annuelle de la société de classification', type: 'Préventif', priorite: 'Haute', technicien: T.ibinga, debut: dt(6, 8), fin: dt(7, 17), statut: 'Planifié', immobilisant: true, plan: 'BS-01/classification', prestation: 2400000 }),
      mk({ equip: 'RM-02', titre: 'Carénage biennal — mise à sec, coque et anodes', type: 'Préventif', priorite: 'Haute', technicien: T.ibinga, debut: dt(12, 7), fin: dt(24, 17), statut: 'Planifié', immobilisant: true, plan: 'RM-02/Carénage', prestation: 68000000, pieces: [pc('Anodes zinc (lot)', 1, 3200000), pc('Peinture antifouling (lot)', 1, 9800000)], description: 'Chantier confié à Estuaire Marine Services (démo). Remorqueur RM-01 seul en service à Owendo pendant le carénage.' }),
      mk({ equip: 'GR-01', titre: 'Révision générale 22 000 h — mécanismes de levage', type: 'Préventif', priorite: 'Normale', technicien: T.cedric, debut: dt(20, 7), fin: dt(75, 17), statut: 'Planifié', immobilisant: true, prestation: 145000000, description: 'Voir projet « Révision générale de la grue n° 1 ».' })
    ];
    /* rattachement des OT aux plans */
    O.forEach(function (o) { if (o.plan) { var parts = o.plan.split('/'), re = new RegExp(parts[1]); var p = P.find(function (x) { return x.equip === parts[0] && re.test(x.libelle); }); o.plan = p ? p.id : ''; } });
    return { plansMaintenance: P, ordres: O };
  }
  function init() {
    /* rattachement des OT et des plans au site de leur équipement (corrige aussi d'anciennes données) */
    var ch = false, FS = {};
    S.raw('flotte').forEach(function (f) { if (f && f.site) FS[f.id] = f.site; });
    ['ordres', 'plansMaintenance'].forEach(function (col) { S.raw(col).forEach(function (r) { if (r && r.equip && FS[r.equip] && r.site !== FS[r.equip]) { r.site = FS[r.equip]; ch = true; } }); });
    /* cohérence statut flotte ↔ OT immobilisants en cours */
    OT().forEach(function (o) { var e = eq(o.equip); if (e && o.statut === 'En cours' && o.immobilisant && (e.statut === 'Disponible' || !e.statut)) { e.statut = 'En maintenance'; ch = true; } });
    if (ch) S.save();
  }

  /* ------------------------------------------------------------------ calculs */
  function planEtat(p) {
    var e = eq(p.equip); if (!e) return { reste: 0, unit: '', pct: 0, label: '—', tone: 'grey', due: today() };
    var open = OT().find(function (o) { return o.plan === p.id && isOpen(o); });
    var r, prc, due;
    if (p.type === 'Heures') { r = p.dernierH + p.intervalle - e.heures; prc = (e.heures - p.dernierH) / p.intervalle * 100; due = d(Math.max(0, Math.round(r / usage(e)))); }
    else { due = E.addDays(p.dernierDate, p.intervalle); r = E.daysBetween(today(), due); prc = E.daysBetween(p.dernierDate, today()) / p.intervalle * 100; }
    var jours = p.type === 'Heures' ? r / usage(e) : r;
    var tone = r < 0 ? 'red' : jours <= 7 ? 'orange' : jours <= 30 ? 'yellow' : 'green';
    var label = open ? 'OT ' + open.statut.toLowerCase() : r < 0 ? 'Dépassé' : r === 0 || jours <= 7 ? 'À planifier' : jours <= 30 ? 'Bientôt' : 'À jour';
    return { reste: r, unit: p.type === 'Heures' ? 'h' : 'j', pct: prc, jours: jours, label: label, tone: open ? 'violet' : tone, due: due, ot: open };
  }
  function dueList() { return plans().map(function (p) { return { p: p, s: planEtat(p) }; }).sort(function (a, b) { return a.s.jours - b.s.jours; }); }
  function overlapH(a, b, from, to) { var x = Math.max(new Date(a).getTime(), from), y = Math.min(b ? new Date(b).getTime() : Date.now(), to); return Math.max(0, (y - x) / 36e5); }
  function dispo(eid, days) {
    days = days || 90; var to = Date.now(), from = to - days * 864e5, h = 0;
    OT().forEach(function (o) { if (o.equip === eid && o.immobilisant && o.arretDebut) h += overlapH(o.arretDebut, o.arretFin, from, to); });
    var e = eq(eid); if (e && e.statut === 'Hors service' && !OT().some(function (o) { return o.equip === eid && o.arretDebut && !o.arretFin; })) h += 2;
    return Math.max(0, 100 - h / (days * 24) * 100);
  }
  function dispoFlotte() { var L = flotte(); return L.length ? E.sum(L, function (e) { return dispo(e.id); }) / L.length : 100; }
  function gColor(p) { return p >= 95 ? '#1e9e4a' : p >= 88 ? '#e8780c' : '#d93636'; }

  /* ------------------------------------------------------------------ vues */
  var TABS = [{ k: 'apercu', l: 'Vue d\'ensemble' }, { k: 'equipements', l: 'Équipements' }, { k: 'ordres', l: 'Ordres de travail' }, { k: 'preventif', l: 'Préventif' }, { k: 'planning', l: 'Planning' }];
  var st = { tab: 'apercu', fo: 'Ouverts', ft: '', fe: 'Tous' }, viewEl = null;
  function here() { return location.hash.replace(/^#\/?/, '').split('/'); }
  function afterClose() { var p = here(); if (p[0] === MOD && p.length > 2 && p[1] !== 'equipements') history.replaceState(null, '', '#/' + MOD + '/' + p[1]); }
  function refresh() { var p = here(); if (viewEl && p[0] === MOD) { var y = window.scrollY; if (p[1] === 'equipements' && p[2]) drawEq(decodeURIComponent(p[2])); else draw(); window.scrollTo(0, y); } E.renderBadges(); }
  function render(view, params) {
    viewEl = view; params = params || []; var tab = params[0] || 'apercu'; if (!TABS.some(function (t) { return t.k === tab; })) tab = 'apercu'; st.tab = tab;
    if (tab === 'equipements' && params[1]) { drawEq(decodeURIComponent(params[1])); return; }
    draw();
    if (params[1] && tab === 'ordres') { var id = decodeURIComponent(params[1]); setTimeout(function () { openOT(id); }, 30); }
  }
  function headTxt() {
    var sc = E.scope();
    if (sc === 'POG') return 'Port de Port-Gentil · remorqueur, barge de soutage et engin de parc · préventif, correctif, disponibilité.';
    if (sc === 'OWE') return 'Port d’Owendo · remorqueurs, vedettes, grues mobiles portuaires et reach stackers · préventif, correctif, disponibilité.';
    return 'Owendo et Port-Gentil · remorqueurs, vedettes, grues mobiles portuaires, reach stackers et barge · préventif, correctif, disponibilité.';
  }
  function headActs() {
    var a = '<button class="btn danger" data-act="panne">' + ic('alert') + 'Déclarer une panne</button><button class="btn primary" data-act="new-ot">' + ic('plus') + 'Ordre de travail</button>';
    if (st.tab === 'ordres' || st.tab === 'preventif') a += '<button class="btn" data-act="csv">' + ic('download') + 'Export CSV</button>';
    return a;
  }
  function draw() {
    var nV = OT().filter(function (o) { return o.statut === 'À valider'; }).length, nA = flotte().filter(arret).length, nD = dueList().filter(function (x) { return !x.s.ot && x.s.jours <= 7; }).length;
    viewEl.innerHTML = '<div class="mnt-root" id="mnt-root"><div class="mnt-head"><div><h2>Flotte & maintenance</h2><p>' + headTxt() + '</p></div><div class="mnt-head__acts">' + headActs() + '</div></div>' +
      U.tabs(TABS.map(function (t) { return { k: t.k, l: t.l, n: t.k === 'ordres' ? nV || null : t.k === 'apercu' ? nA || null : t.k === 'preventif' ? nD || null : null }; }), st.tab, function (k) { E.go(MOD + '/' + k); }) + '<div id="mnt-body"></div></div>';
    var body = viewEl.querySelector('#mnt-body');
    ({ apercu: vApercu, equipements: vEq, ordres: vOT, preventif: vPrev, planning: vPlan })[st.tab](body);
    bindRoot(viewEl.querySelector('#mnt-root'));
  }
  function bindRoot(root) {
    root.addEventListener('click', function (e) {
      var a = e.target.closest('[data-act]'); if (!a || !root.contains(a)) return; var act = a.dataset.act, id = a.dataset.id;
      if (act === 'panne') panne(id);
      else if (act === 'new-ot') newOT({ equip: id });
      else if (act === 'csv') exportTab();
      else if (act === 'ot') openOT(id);
      else if (act === 'eq') E.go(MOD + '/equipements/' + id);
      else if (act === 'plan-ot') otFromPlan(id);
      else if (act === 'fo') { st.fo = a.dataset.v; draw(); }
      else if (act === 'fe') { st.fe = a.dataset.v; draw(); }
      else if (act === 'go') E.go(a.dataset.k);
      else if (act === 'cpt') compteur(id);
      else if (act === 'service') remettre(id);
    });
    var sel = root.querySelector('#mnt-ft'); if (sel) sel.addEventListener('change', function () { st.ft = sel.value; draw(); });
  }

  function eqThumb(e, big) {
    var ph = PHOTO[e.type];
    return '<div class="mnt-thumb' + (big ? ' big' : '') + (ph ? ' ph' : '') + '"' + (ph ? ' style="background-image:url(' + ph + ')"' : '') + '>' + (ph ? '' : ic(TYPE_IC[e.type] || 'wrench')) + '</div>';
  }
  function vApercu(body) {
    var L = flotte(), df = dispoFlotte(), arr = L.filter(arret), open = OT().filter(isOpen), val = open.filter(function (o) { return o.statut === 'À valider'; });
    var due = dueList(), late = due.filter(function (x) { return x.s.reste < 0 && !x.s.ot; }), soon = due.filter(function (x) { return x.s.reste >= 0 && x.s.jours <= 7 && !x.s.ot; });
    /* coûts mensuels préventif / correctif (6 mois) */
    var labels = [], prev = [], corr = [];
    for (var k = -5; k <= 0; k++) { var a = E.iso(new Date(E.TODAY.getFullYear(), E.TODAY.getMonth() + k, 1)), b = E.iso(new Date(E.TODAY.getFullYear(), E.TODAY.getMonth() + k + 1, 0)); labels.push(E.MOIS[E.parseDate(a).getMonth()]); var os = OT().filter(function (o) { var x = String(o.debut).slice(0, 10); return o.statut !== 'Annulé' && x >= a && x <= b && String(o.debut).slice(0, 10) <= today(); }); prev.push(E.sum(os.filter(function (o) { return o.type === 'Préventif'; }), cost)); corr.push(E.sum(os.filter(function (o) { return o.type === 'Correctif'; }), cost)); }
    var groups = E.groupBy(L, 'type');
    body.innerHTML = '<div class="stack"><div class="mnt-kpis">' +
      U.kpi({ label: 'Disponibilité de la flotte', value: F.num(df, 1), unit: '%', icon: 'gauge', tone: df >= 95 ? 'green' : 'orange', foot: '90 derniers jours · objectif ≥ 95 %' }) +
      U.kpi({ label: 'Équipements à l\'arrêt', value: arr.length + '<small> / ' + L.length + '</small>', icon: 'alert', tone: arr.length ? 'red' : 'green', foot: arr.length ? arr.map(function (e) { return e.id; }).join(', ') : 'toute la flotte est disponible' }) +
      U.kpi({ label: 'Ordres de travail ouverts', value: open.length, icon: 'wrench', tone: 'blue', foot: val.length + ' à valider · ' + open.filter(function (o) { return o.statut === 'En cours'; }).length + ' en cours' }) +
      U.kpi({ label: 'Échéances préventives', value: late.length + soon.length, icon: 'calendar', tone: late.length ? 'red' : soon.length ? 'orange' : 'green', foot: late.length + ' dépassée(s) · ' + soon.length + ' sous 7 jours' }) + '</div>' +
      '<div class="grid g-2-1"><div class="card"><div class="card__h"><h3>Arrêts en cours</h3><span class="sub">' + arr.length + ' équipement(s)</span></div>' +
      (arr.length ? '<div class="list">' + arr.map(function (e) { var o = OT().filter(function (x) { return x.equip === e.id && isOpen(x); }).sort(function (x, y) { return String(x.debut).localeCompare(String(y.debut)); })[0]; return '<div class="list__item mnt-click" data-act="eq" data-id="' + e.id + '">' + eqThumb(e) + '<div class="list__body"><b>' + esc(e.id) + ' · ' + esc(e.nom) + '</b><div class="small muted">' + (o ? esc(o.titre) + ' · depuis ' + when(o.arretDebut || o.cree || o.debut) + ' · fin prévue ' + when(o.fin) : 'Aucun OT associé — à créer') + '</div></div>' + eqB(e.statut) + '</div>'; }).join('') + '</div>' : '<div class="empty">' + ic('check') + '<br>Aucun arrêt : toute la flotte est disponible.</div>') + '</div>' +
      '<div class="card"><div class="card__h"><h3>Prochaines échéances</h3><span class="spacer"></span><button class="btn sm" data-act="go" data-k="maintenance/preventif">Tout le préventif</button></div><div class="list">' + due.filter(function (x) { return !x.s.ot; }).slice(0, 6).map(function (x) { return '<div class="list__item"><div class="list__icon tone-' + x.s.tone + '">' + ic(x.p.type === 'Heures' ? 'clock' : 'calendar') + '</div><div class="list__body"><b>' + esc(x.p.equip) + ' · ' + esc(x.p.libelle.split(' — ')[0]) + '</b><div class="small muted">' + (x.s.reste < 0 ? 'dépassé de ' + F.num(-x.s.reste) + ' ' + x.s.unit : 'reste ' + F.num(x.s.reste) + ' ' + x.s.unit) + ' · ≈ ' + F.dateShort(x.s.due) + '</div></div><button class="btn sm" data-act="plan-ot" data-id="' + x.p.id + '">Créer l\'OT</button></div>'; }).join('') + '</div></div></div>' +
      '<div class="card"><div class="card__h"><h3>Disponibilité par équipement</h3><span class="sub">90 derniers jours · temps hors immobilisation</span></div><div class="card__b"><div class="mnt-gauges">' + Object.keys(groups).map(function (g) { return groups[g].map(function (e) { var p = dispo(e.id); return '<button class="mnt-gauge" data-act="eq" data-id="' + e.id + '"><i class="mnt-gauge__t">' + ic(TYPE_IC[g] || 'wrench') + esc(g) + '</i>' + U.gauge(p, null, gColor(p)) + '<b>' + esc(e.id) + '</b><span>' + esc(e.nom.replace(/^(Remorqueur|Vedette (pilote|d\'amarrage|hydrographique)|Grue mobile portuaire|Reach stacker|Barge de soutage) ?/, '') || e.nom) + '</span>' + eqB(e.statut || 'Disponible') + '</button>'; }).join(''); }).join('') + '</div></div></div>' +
      '<div class="card"><div class="card__h"><h3>Coûts de maintenance</h3><span class="sub">6 derniers mois · pièces, main-d\'œuvre et sous-traitance</span></div><div class="card__b">' + U.bars({ labels: labels, series: [{ name: 'Préventif', values: prev, color: '#009e60' }, { name: 'Correctif', values: corr, color: '#e8780c' }], stacked: true, money: true, height: 210, width: window.innerWidth > 1100 ? 1040 : undefined }) + '</div></div></div>';
  }

  function vEq(body) {
    var types = ['Tous'].concat(Object.keys(E.groupBy(flotte(), 'type')));
    var L = flotte().filter(function (e) { return st.fe === 'Tous' || e.type === st.fe; });
    body.innerHTML = '<div class="stack"><div class="chips">' + types.map(function (t) { return '<button class="chip' + (st.fe === t ? ' is-active' : '') + '" data-act="fe" data-v="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div><div class="mnt-cards">' + L.map(function (e) {
      var p = dispo(e.id), nx = dueList().filter(function (x) { return x.p.equip === e.id; })[0];
      return '<div class="card mnt-card" data-act="eq" data-id="' + e.id + '">' + eqThumb(e) + '<div class="mnt-card__b"><div class="mnt-card__t"><b>' + esc(e.id) + '</b>' + eqB(e.statut || 'Disponible') + '</div><div class="mnt-card__n">' + esc(e.nom) + '</div><div class="small muted">' + esc(e.type) + siteSuffix(e) + ' · ' + esc(e.puissance || '') + '</div>' +
        '<div class="mnt-card__kv"><span>' + ic('clock') + F.num(e.heures) + ' h</span><span>' + ic('gauge') + F.num(p, 1) + ' %</span></div>' + U.progress(p, p >= 95 ? 'green' : p >= 88 ? 'orange' : 'red') +
        (nx ? '<div class="mnt-card__nx tone-' + nx.s.tone + '">' + esc(nx.p.libelle.split(' — ')[0]) + ' · ' + (nx.s.reste < 0 ? 'dépassé' : 'reste ' + F.num(nx.s.reste) + ' ' + nx.s.unit) + '</div>' : '') + '</div></div>';
    }).join('') + '</div></div>';
  }

  var OT_COLS = [
    { label: 'N°', render: function (o) { return '<b>' + esc(o.id) + '</b>'; } },
    { label: 'Équipement', render: function (o) { return '<b>' + esc(o.equip) + '</b><span class="mnt-sub">' + esc(eqNom(o.equip)) + '</span>'; } },
    { label: 'Intervention', render: function (o) { return esc(o.titre) + '<span class="mnt-sub">' + esc(o.type) + (o.immobilisant ? ' · immobilisant' : '') + '</span>'; } },
    { label: 'Priorité', render: function (o) { return prB(o.priorite); } },
    { label: 'Technicien', render: function (o) { return esc(empName(o.technicien)); } },
    { label: 'Début prévu', render: function (o) { return when(o.debut); } },
    { label: 'Coût', num: true, render: function (o) { var c = cost(o); return c ? F.short(c) : '—'; } },
    { label: 'Statut', render: function (o) { return stB(o.statut); } }
  ];
  function otRows() {
    return OT().filter(function (o) { return (st.fo === 'Tous' || (st.fo === 'Ouverts' ? isOpen(o) : o.statut === st.fo)) && (!st.ft || o.type === st.ft); })
      .sort(function (a, b) { return st.fo === 'Terminé' || st.fo === 'Tous' ? String(b.debut).localeCompare(String(a.debut)) : String(a.debut).localeCompare(String(b.debut)); });
  }
  function vOT(body) {
    var rows = otRows();
    body.innerHTML = '<div class="card"><div class="card__b"><div class="filters"><select class="select" id="mnt-ft"><option value="">Préventif et correctif</option><option' + (st.ft === 'Préventif' ? ' selected' : '') + '>Préventif</option><option' + (st.ft === 'Correctif' ? ' selected' : '') + '>Correctif</option></select><span class="small muted">' + rows.length + ' OT · ' + F.money(E.sum(rows, cost)) + '</span></div><div class="chips">' +
      ['Ouverts', 'À valider', 'Planifié', 'En cours', 'Terminé', 'Annulé', 'Tous'].map(function (x) { var n = OT().filter(function (o) { return o.statut === x; }).length; return '<button class="chip' + (st.fo === x ? ' is-active' : '') + '" data-act="fo" data-v="' + x + '">' + x + (n && x !== 'Tous' && x !== 'Ouverts' ? ' · ' + n : '') + '</button>'; }).join('') + '</div></div>' +
      U.table(OT_COLS, rows, { onRow: function (o) { openOT(o.id); }, empty: 'Aucun ordre de travail' }) + '</div>';
  }
  function vPrev(body) {
    var rows = dueList();
    body.innerHTML = '<div class="stack"><div class="alert tone-blue">' + ic('info') + '<div>Les seuils d\'heures sont suivis à partir du <b>compteur horaire</b> de chaque équipement ; l\'échéance en jours est estimée selon l\'utilisation moyenne (grues ≈ 13 h/j, reach stackers ≈ 15 h/j, remorqueurs ≈ 5 h/j). Les échéances calendaires couvrent carénages, visites de classe, certificats et épreuves de charge.</div></div><div class="card">' + U.table([
      { label: 'Équipement', render: function (x) { return '<b>' + esc(x.p.equip) + '</b><span class="mnt-sub">' + esc(eqNom(x.p.equip)) + '</span>'; } },
      { label: 'Opération', render: function (x) { return esc(x.p.libelle); } },
      { label: 'Seuil', render: function (x) { return x.p.type === 'Heures' ? F.num(x.p.intervalle) + ' h' : (x.p.intervalle >= 365 ? F.num(x.p.intervalle / 365, x.p.intervalle % 365 ? 1 : 0) + ' an(s)' : F.num(x.p.intervalle / 30) + ' mois'); } },
      { label: 'Dernière réalisation', render: function (x) { return x.p.type === 'Heures' ? F.num(x.p.dernierH) + ' h<span class="mnt-sub">' + F.dateShort(x.p.dernierDate) + '</span>' : F.dateShort(x.p.dernierDate); } },
      { label: 'Avancement', render: function (x) { return '<div class="mnt-adv">' + U.progress(Math.min(100, x.s.pct), x.s.tone === 'red' ? 'red' : x.s.tone === 'orange' ? 'orange' : x.s.tone === 'yellow' ? 'yellow' : 'green') + '</div>'; } },
      { label: 'Reste', num: true, render: function (x) { return '<b class="' + (x.s.reste < 0 ? 'mnt-red' : '') + '">' + (x.s.reste < 0 ? '−' : '') + F.num(Math.abs(x.s.reste)) + ' ' + x.s.unit + '</b><span class="mnt-sub">≈ ' + F.dateShort(x.s.due) + '</span>'; } },
      { label: 'État', render: function (x) { return x.s.ot ? '<a href="#/maintenance/ordres/' + esc(x.s.ot.id) + '">' + stB(x.s.ot.statut) + '</a>' : x.s.jours <= 30 ? '<button class="btn sm' + (x.s.reste <= 0 || x.s.jours <= 7 ? ' primary' : '') + '" data-act="plan-ot" data-id="' + x.p.id + '">' + ic('plus') + 'Créer l\'OT</button>' : U.badge(x.s.label, x.s.tone); } }
    ], rows) + '</div></div>';
  }
  function vPlan(body) {
    var from = d(-21), to = d(84);
    var rows = OT().filter(function (o) { return o.statut !== 'Annulé' && String(o.fin).slice(0, 10) >= from && String(o.debut).slice(0, 10) <= to; }).sort(function (a, b) { return a.equip.localeCompare(b.equip) || String(a.debut).localeCompare(String(b.debut)); });
    var due = dueList().filter(function (x) { return !x.s.ot && x.s.due <= to; });
    body.innerHTML = '<div class="stack"><div class="card"><div class="card__h"><h3>Planning des interventions</h3><span class="sub">3 semaines passées · 12 semaines à venir · cliquer une barre pour ouvrir l\'OT</span></div>' +
      (rows.length ? U.gantt({ title: 'Équipement · intervention', from: from, to: to, unit: 'week', rows: rows.map(function (o) { return { label: o.equip + ' · ' + o.titre, sub: o.type + ' · ' + o.statut, start: String(o.debut).slice(0, 10), end: String(o.fin).slice(0, 10), progress: o.statut === 'Terminé' ? 100 : o.statut === 'En cours' ? 50 : 0, cls: o.statut === 'À valider' ? 'warn' : '', onClick: function () { openOT(o.id); } }; }) }) : '<div class="empty">Aucune intervention sur la période.</div>') + '</div>' +
      '<div class="card"><div class="card__h"><h3>Échéances préventives sans OT</h3><span class="sub">à intégrer au planning</span></div>' + (due.length ? '<div class="list">' + due.map(function (x) { return '<div class="list__item"><div class="list__icon tone-' + x.s.tone + '">' + ic('calendar') + '</div><div class="list__body"><b>' + esc(x.p.equip) + ' · ' + esc(x.p.libelle) + '</b><div class="small muted">échéance estimée ' + F.date(x.s.due) + '</div></div><button class="btn sm" data-act="plan-ot" data-id="' + x.p.id + '">Créer l\'OT</button></div>'; }).join('') + '</div>' : '<div class="empty">' + ic('check') + '<br>Toutes les échéances de la période sont planifiées.</div>') + '</div></div>';
  }

  /* ------------------------------------------------------------------ fiche équipement */
  function drawEq(id) {
    var e = eq(id); if (!e) { viewEl.innerHTML = '<div class="card"><div class="empty">Équipement introuvable.<br><a href="#/maintenance/equipements">Retour à la flotte</a></div></div>'; return; }
    var p = dispo(e.id), p30 = dispo(e.id, 30), os = OT().filter(function (o) { return o.equip === e.id; }).sort(function (a, b) { return String(b.debut).localeCompare(String(a.debut)); });
    var pl = dueList().filter(function (x) { return x.p.equip === e.id; }), c12 = E.sum(os.filter(function (o) { return o.statut === 'Terminé' && String(o.debut) >= d(-365); }), cost);
    viewEl.innerHTML = '<div class="mnt-root" id="mnt-root"><a class="btn ghost sm mnt-back" href="#/maintenance/equipements">' + ic('back') + 'Toute la flotte</a>' +
      '<div class="card mnt-eqhead">' + eqThumb(e, true) + '<div class="mnt-eqhead__b"><div class="mnt-card__t"><h2>' + esc(e.id) + ' · ' + esc(e.nom) + '</h2>' + eqB(e.statut || 'Disponible') + '</div><div class="muted">' + esc(e.type) + ' · ' + (e.site === 'POG' ? 'Port de Port-Gentil' : 'Port d\'Owendo') + ' · ' + esc(e.puissance || '') + '</div>' +
      '<div class="mnt-eqhead__acts"><button class="btn" data-act="cpt" data-id="' + e.id + '">' + ic('clock') + 'Relever le compteur</button><button class="btn" data-act="new-ot" data-id="' + e.id + '">' + ic('plus') + 'Ordre de travail</button>' + (arret(e) ? '<button class="btn success" data-act="service" data-id="' + e.id + '">' + ic('check') + 'Remettre en service</button>' : '<button class="btn danger" data-act="panne" data-id="' + e.id + '">' + ic('alert') + 'Déclarer une panne</button>') + '</div></div></div>' +
      '<div class="mnt-kpis">' + U.kpi({ label: 'Compteur horaire', value: F.num(e.heures), unit: 'h', icon: 'clock', tone: 'navy', foot: '≈ ' + usage(e) + ' h d\'utilisation par jour' }) + U.kpi({ label: 'Disponibilité 90 j', value: F.num(p, 1), unit: '%', icon: 'gauge', tone: p >= 95 ? 'green' : 'orange', foot: '30 jours : ' + F.num(p30, 1) + ' %' }) + U.kpi({ label: 'OT ouverts', value: os.filter(isOpen).length, icon: 'wrench', tone: 'blue', foot: os.length + ' OT au total' }) + U.kpi({ label: 'Coût maintenance 12 mois', value: F.short(c12), unit: 'FCFA', icon: 'money', tone: 'violet', foot: 'OT terminés' }) + '</div>' +
      '<div class="grid g-1-2"><div class="card"><div class="card__h"><h3>Taux de disponibilité</h3></div><div class="card__b">' + U.gauge(p, '90 derniers jours', gColor(p)) + '<dl class="kv" style="margin-top:14px"><dt>Code</dt><dd>' + esc(e.id) + '</dd><dt>Type</dt><dd>' + esc(e.type) + '</dd><dt>Caractéristique</dt><dd>' + esc(e.puissance || '—') + '</dd><dt>Site</dt><dd>' + (e.site === 'POG' ? 'Port-Gentil' : 'Owendo') + '</dd>' + (e.dernierReleve ? '<dt>Dernier relevé</dt><dd>' + when(e.dernierReleve) + '</dd>' : '') + '</dl></div></div>' +
      '<div class="card"><div class="card__h"><h3>Plan de maintenance</h3><span class="sub">' + pl.length + ' opérations</span></div><div class="list">' + pl.map(function (x) { return '<div class="list__item"><div class="list__icon tone-' + x.s.tone + '">' + ic(x.p.type === 'Heures' ? 'clock' : 'calendar') + '</div><div class="list__body"><b>' + esc(x.p.libelle) + '</b><div class="small muted">' + (x.p.type === 'Heures' ? 'tous les ' + F.num(x.p.intervalle) + ' h · dernier à ' + F.num(x.p.dernierH) + ' h' : 'tous les ' + F.num(x.p.intervalle) + ' j · dernier le ' + F.dateShort(x.p.dernierDate)) + ' · ' + (x.s.reste < 0 ? '<span class="mnt-red">dépassé de ' + F.num(-x.s.reste) + ' ' + x.s.unit + '</span>' : 'reste ' + F.num(x.s.reste) + ' ' + x.s.unit) + '</div><div class="mnt-adv">' + U.progress(Math.min(100, x.s.pct), x.s.tone === 'red' ? 'red' : x.s.tone === 'orange' ? 'orange' : 'green') + '</div></div>' + (x.s.ot ? '<button class="btn sm" data-act="ot" data-id="' + x.s.ot.id + '">' + esc(x.s.ot.id) + '</button>' : '<button class="btn sm" data-act="plan-ot" data-id="' + x.p.id + '">Créer l\'OT</button>') + '</div>'; }).join('') + '</div></div></div>' +
      '<div class="card"><div class="card__h"><h3>Historique des interventions</h3><span class="sub">' + os.length + ' OT</span></div>' + U.table(OT_COLS.filter(function (c) { return c.label !== 'Équipement'; }), os, { onRow: function (o) { openOT(o.id); }, empty: 'Aucune intervention enregistrée' }) + '</div></div>';
    bindRoot(viewEl.querySelector('#mnt-root'));
  }

  /* ------------------------------------------------------------------ ordres de travail */
  function openOT(id) {
    var o = ot(id); if (!o || !o.equip) return U.toast('Ordre de travail introuvable : ' + id, 'err');
    var e = eq(o.equip) || {}, idx = STEPS.indexOf(o.statut);
    var body = '<div class="mnt-steps">' + U.steps(STEPS, o.statut === 'Annulé' ? 0 : idx, { finished: o.statut === 'Terminé', rejected: o.statut === 'Annulé' }) + '</div>' +
      '<div class="mnt-ot"><div><dl class="kv"><dt>Équipement</dt><dd><a href="#/maintenance/equipements/' + esc(o.equip) + '" data-close-modal>' + esc(o.equip) + ' · ' + esc(e.nom || '') + '</a> ' + eqB(e.statut || 'Disponible') + '</dd>' +
      '<dt>Intervention</dt><dd><b>' + esc(o.titre) + '</b></dd><dt>Type · priorité</dt><dd>' + esc(o.type) + ' · ' + prB(o.priorite) + (o.immobilisant ? ' ' + U.badge('Immobilisant', 'red') : '') + '</dd>' +
      '<dt>Technicien</dt><dd>' + esc(empName(o.technicien)) + '</dd><dt>Période prévue</dt><dd>' + when(o.debut) + ' → ' + when(o.fin) + '</dd>' +
      (o.arretDebut ? '<dt>Immobilisation</dt><dd>' + when(o.arretDebut) + ' → ' + (o.arretFin ? when(o.arretFin) : '<b>en cours</b>') + ' · ' + F.num(overlapH(o.arretDebut, o.arretFin, 0, Date.now()), 0) + ' h</dd>' : '') +
      (o.plan ? '<dt>Plan préventif</dt><dd>' + esc(((S.get('plansMaintenance', o.plan) || {}).libelle) || o.plan) + '</dd>' : '') +
      (o.description ? '<dt>Description</dt><dd>' + esc(o.description) + '</dd>' : '') + (o.rapport ? '<dt>Rapport</dt><dd>' + esc(o.rapport) + '</dd>' : '') + '</dl>' +
      '<div class="mnt-sect">Pièces et coûts</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Désignation</th><th class="num">Qté</th><th class="num">P.U.</th><th class="num">Montant</th></tr></thead><tbody>' +
      (o.pieces || []).map(function (p) { return '<tr><td>' + esc(p.designation) + '</td><td class="num">' + F.num(p.qte) + '</td><td class="num">' + F.num(p.pu) + '</td><td class="num">' + F.num(p.qte * p.pu) + '</td></tr>'; }).join('') +
      '<tr><td>Main-d\'œuvre interne (' + F.num(o.heuresMO || 0) + ' h × ' + F.num(TAUX_MO) + ')</td><td></td><td></td><td class="num">' + F.num((o.heuresMO || 0) * TAUX_MO) + '</td></tr>' + (o.prestation ? '<tr><td>Sous-traitance</td><td></td><td></td><td class="num">' + F.num(o.prestation) + '</td></tr>' : '') +
      '</tbody><tfoot><tr><td colspan="3">Coût total</td><td class="num">' + F.money(cost(o)) + '</td></tr></tfoot></table></div></div>' +
      '<div class="mnt-hist"><b>Historique</b><div class="timeline">' + (o.historique || []).map(function (h) { return '<div class="tl-item done"><b>' + esc(h.action) + '</b><span>' + esc(h.user) + ' · ' + when(h.at) + '</span></div>'; }).join('') + '</div></div></div>';
    var acts = [];
    function guard() { if (!canTech()) { U.toast('Action réservée au service technique.', 'err'); return false; } return true; }
    function push(action) { o.historique = o.historique || []; o.historique.push({ at: now(), user: me(), action: action }); }
    if (o.statut === 'À valider') {
      acts.push({ label: 'Rejeter', cls: 'danger', icon: 'x', onClick: function (close) { if (!guard()) return; U.confirm('Rejeter l\'ordre de travail', 'Annuler ' + esc(o.id) + ' (' + esc(o.titre) + ') ?', 'Rejeter', function () { o.statut = 'Annulé'; push('OT rejeté'); S.save(); E.log('OT rejeté', o.id + ' · ' + o.equip, MOD); U.toast(o.id + ' annulé.'); close(); refresh(); }, 'danger'); } });
      acts.push({ label: 'Valider et planifier', cls: 'primary', icon: 'check', onClick: function (close) { if (!guard()) return; close(); planifier(o); } });
    }
    if (o.statut === 'Planifié') acts.push({ label: 'Démarrer l\'intervention', cls: 'primary', icon: 'wrench', onClick: function (close) { if (!guard()) return; demarrer(o); close(); refresh(); openOT(o.id); } });
    if (o.statut === 'En cours') {
      acts.push({ label: 'Ajouter une pièce', icon: 'plus', onClick: function (close) { close(); addPiece(o); } });
      acts.push({ label: 'Clôturer l\'OT', cls: 'success', icon: 'check', onClick: function (close) { if (!guard()) return; close(); cloturer(o); } });
    }
    acts.push({ label: 'Fermer' });
    var m = U.modal({ title: 'Ordre de travail ' + o.id, sub: esc(o.equip) + ' · ' + stB(o.statut), size: 'lg', onClose: afterClose, body: body, actions: acts });
    var lk = m.el.querySelector('[data-close-modal]'); if (lk) lk.addEventListener('click', function () { m.close(); });
  }
  function planifier(o) {
    U.formModal({ title: 'Valider et planifier ' + o.id, sub: esc(o.titre), fields: [
      { name: 'technicien', label: 'Technicien responsable', type: 'select', options: techOpts(), required: true, full: true },
      { name: 'debut', label: 'Début', type: 'datetime-local', required: true }, { name: 'fin', label: 'Fin prévue', type: 'datetime-local', required: true },
      { name: 'priorite', label: 'Priorité', type: 'select', options: ['Urgente', 'Haute', 'Normale', 'Basse'] }
    ], values: o, okLabel: 'Valider', onSubmit: function (v) {
      if (v.fin < v.debut) { U.toast('La fin doit suivre le début.', 'err'); return false; }
      Object.assign(o, v, { statut: 'Planifié' }); o.historique.push({ at: now(), user: me(), action: 'OT validé et planifié du ' + when(v.debut) + ' au ' + when(v.fin) }); S.save();
      E.log('OT validé', o.id + ' · ' + o.equip + ' · ' + o.titre, MOD); U.toast(o.id + ' validé et planifié.'); refresh(); setTimeout(function () { openOT(o.id); }, 40);
    } });
  }
  function demarrer(o) {
    var e = eq(o.equip);
    o.statut = 'En cours'; if (o.immobilisant) { o.arretDebut = now(); if (e && e.statut !== 'Hors service') e.statut = 'En maintenance'; }
    o.historique.push({ at: now(), user: me(), action: 'Intervention démarrée' + (o.immobilisant ? ' — équipement immobilisé' : '') }); S.save();
    E.log('OT démarré', o.id + ' · ' + o.equip, MOD); U.toast('Intervention démarrée' + (o.immobilisant ? ' : ' + o.equip + ' passe en maintenance.' : '.'));
  }
  function addPiece(o) {
    U.formModal({ title: 'Ajouter une pièce — ' + o.id, fields: [{ name: 'designation', label: 'Désignation', required: true, full: true, placeholder: 'ex. Filtre à huile moteur' }, { name: 'qte', label: 'Quantité', type: 'number', min: 1, value: 1, required: true }, { name: 'pu', label: 'Prix unitaire (FCFA)', type: 'number', min: 0, required: true }],
      onSubmit: function (v) { o.pieces = o.pieces || []; o.pieces.push(v); o.historique.push({ at: now(), user: me(), action: 'Pièce ajoutée : ' + v.designation }); S.save(); E.log('Pièce ajoutée à un OT', o.id + ' · ' + v.designation, MOD); U.toast('Pièce ajoutée.'); refresh(); setTimeout(function () { openOT(o.id); }, 40); } });
  }
  function cloturer(o) {
    var e = eq(o.equip) || { heures: 0 };
    U.formModal({ title: 'Clôturer ' + o.id, sub: esc(o.titre), fields: [
      { name: 'heuresMO', label: 'Heures de main-d\'œuvre', type: 'number', min: 0, step: '0.5', required: true },
      { name: 'compteur', label: 'Compteur horaire relevé (h)', type: 'number', min: e.heures || 0, required: true },
      { name: 'rapport', label: 'Rapport d\'intervention', type: 'textarea', required: true }
    ], values: { heuresMO: o.heuresMO || 4, compteur: e.heures, rapport: '' }, okLabel: 'Clôturer et remettre en service', onSubmit: function (v) {
      if (v.compteur < (e.heures || 0)) { U.toast('Le compteur ne peut pas diminuer.', 'err'); return false; }
      Object.assign(o, { heuresMO: v.heuresMO, rapport: v.rapport, statut: 'Terminé' }); if (o.arretDebut && !o.arretFin) o.arretFin = now();
      if (eq(o.equip)) { e.heures = v.compteur; e.dernierReleve = now(); var still = OT().some(function (x) { return x !== o && x.equip === o.equip && x.statut === 'En cours' && x.immobilisant; }); if (!still && arret(e)) e.statut = 'Disponible'; }
      if (o.plan) { var p = S.get('plansMaintenance', o.plan); if (p) { p.dernierDate = today(); if (p.type === 'Heures') p.dernierH = v.compteur; } }
      o.historique.push({ at: now(), user: me(), action: 'OT clôturé — coût ' + F.money(cost(o)) }); S.save();
      E.log('OT clôturé', o.id + ' · ' + o.equip + ' · ' + F.money(cost(o)), MOD); E.notify('Équipement remis en service', o.equip + ' — ' + o.titre, '#/maintenance/equipements/' + o.equip, 'green');
      U.toast(o.id + ' clôturé' + (e.statut === 'Disponible' ? ' : ' + o.equip + ' disponible.' : '.')); refresh();
    } });
  }
  function newOT(pre) {
    pre = pre || {};
    var vals = { equip: (flotte()[0] || {}).id, type: 'Préventif', priorite: 'Normale', technicien: techs()[0] ? techs()[0].id : '', debut: dt(1, 7).slice(0, 16), fin: dt(1, 16).slice(0, 16), immobilisant: 'oui', prestation: 0 };
    Object.keys(pre).forEach(function (k) { if (pre[k] != null && pre[k] !== '') vals[k] = pre[k]; });
    U.formModal({ title: 'Nouvel ordre de travail', sub: 'Soumis à validation du chef du service technique', size: 'lg', fields: [
      { name: 'equip', label: 'Équipement', type: 'select', options: eqOpts(), required: true },
      { name: 'type', label: 'Type', type: 'select', options: ['Préventif', 'Correctif'] },
      { name: 'titre', label: 'Intervention', required: true, full: true },
      { name: 'priorite', label: 'Priorité', type: 'select', options: ['Urgente', 'Haute', 'Normale', 'Basse'] },
      { name: 'technicien', label: 'Technicien', type: 'select', options: techOpts() },
      { name: 'debut', label: 'Début souhaité', type: 'datetime-local', required: true }, { name: 'fin', label: 'Fin prévue', type: 'datetime-local', required: true },
      { name: 'immobilisant', label: 'Immobilise l\'équipement ?', type: 'select', options: [{ v: 'oui', l: 'Oui — équipement indisponible' }, { v: 'non', l: 'Non — intervention en service' }] },
      { name: 'prestation', label: 'Sous-traitance estimée (FCFA)', type: 'number', min: 0 },
      { name: 'description', label: 'Description', type: 'textarea' }
    ], values: vals, okLabel: 'Créer l\'OT', onSubmit: function (v) {
      if (v.fin < v.debut) { U.toast('La fin doit suivre le début.', 'err'); return false; }
      var o = S.add('ordres', { id: S.next('OT'), site: (eq(v.equip) || {}).site || E.scope() || 'OWE', equip: v.equip, type: v.type, titre: v.titre, priorite: v.priorite, technicien: v.technicien, debut: v.debut, fin: v.fin, immobilisant: v.immobilisant === 'oui', prestation: +v.prestation || 0, description: v.description, statut: 'À valider', pieces: [], heuresMO: 0, plan: pre.plan || '', cree: now(), historique: [{ at: now(), user: me(), action: 'OT créé' }] });
      E.log('OT créé', o.id + ' · ' + o.equip + ' · ' + o.titre, MOD); E.notify('Ordre de travail à valider', o.equip + ' — ' + o.titre, '#/maintenance/ordres/' + o.id, 'orange');
      U.toast(o.id + ' créé, en attente de validation.'); refresh();
    } });
  }
  function otFromPlan(pid) {
    var p = S.get('plansMaintenance', pid); if (!p) return; var s = planEtat(p);
    if (s.ot) return openOT(s.ot.id);
    var start = s.due < today() ? d(1) : s.due;
    newOT({ equip: p.equip, type: 'Préventif', titre: p.libelle, priorite: s.reste < 0 ? 'Haute' : 'Normale', debut: start + 'T07:00', fin: start + 'T' + (p.type === 'Calendaire' && /Carénage/.test(p.libelle) ? '17:00' : '16:00'), plan: p.id, immobilisant: 'oui' });
  }
  function panne(eid) {
    var m = U.formModal({ title: 'Déclarer une panne', sub: 'Création immédiate d\'un OT correctif et mise à jour du statut de l\'équipement', fields: [
      { name: 'equip', label: 'Équipement', type: 'select', options: eqOpts(), required: true, full: true },
      { name: 'symptome', label: 'Symptôme constaté', required: true, full: true, placeholder: 'ex. fuite hydraulique, alarme moteur, bruit anormal…' },
      { name: 'gravite', label: 'Gravité', type: 'select', full: true, options: [{ v: 'hs', l: 'Hors service — arrêt immédiat' }, { v: 'deg', l: 'Fonctionnement dégradé — maintenance à prévoir' }, { v: 'min', l: 'Mineur — reste en service' }] },
      { name: 'description', label: 'Circonstances', type: 'textarea' }
    ], values: { equip: eid || (flotte()[0] || {}).id, gravite: 'deg' }, okLabel: 'Déclarer', onSubmit: function (v) {
      var e = eq(v.equip), g = v.gravite;
      var o = S.add('ordres', { id: S.next('OT'), site: (e || {}).site || E.scope() || 'OWE', equip: v.equip, type: 'Correctif', titre: v.symptome, priorite: g === 'hs' ? 'Urgente' : g === 'deg' ? 'Haute' : 'Normale', technicien: techs()[0] ? techs()[0].id : '', debut: now(), fin: (g === 'hs' ? d(1) : d(3)) + 'T17:00', immobilisant: g !== 'min', arretDebut: g !== 'min' ? now() : '', description: v.description, statut: 'À valider', pieces: [], heuresMO: 0, cree: now(), historique: [{ at: now(), user: me(), action: 'Panne déclarée' + (g === 'hs' ? ' — équipement hors service' : g === 'deg' ? ' — équipement en maintenance' : '') }] });
      if (e && g === 'hs') e.statut = 'Hors service'; else if (e && g === 'deg') e.statut = 'En maintenance'; S.save();
      E.log('Panne déclarée', v.equip + ' · ' + v.symptome, MOD);
      E.notify('Panne : ' + v.equip, v.symptome + (g === 'hs' ? ' — hors service' : ''), '#/maintenance/ordres/' + o.id, g === 'hs' ? 'red' : 'orange');
      U.toast('Panne enregistrée : ' + o.id + (e && g !== 'min' ? ' — ' + v.equip + ' ' + e.statut.toLowerCase() + '.' : '.'), g === 'hs' ? 'err' : 'ok'); refresh();
    } });
    return m;
  }
  function compteur(eid) {
    var e = eq(eid); if (!e) return;
    U.formModal({ title: 'Relevé du compteur horaire — ' + e.id, size: 'sm', fields: [{ name: 'heures', label: 'Compteur (h)', type: 'number', min: e.heures, required: true, full: true }], values: { heures: e.heures }, onSubmit: function (v) {
      if (v.heures < e.heures) { U.toast('Le compteur ne peut pas diminuer.', 'err'); return false; }
      var delta = v.heures - e.heures; e.heures = v.heures; e.dernierReleve = now(); S.save(); E.log('Relevé compteur', e.id + ' : ' + F.num(v.heures) + ' h (+' + F.num(delta) + ')', MOD);
      var hit = plans().filter(function (p) { return p.equip === e.id && p.type === 'Heures' && !planEtat(p).ot && planEtat(p).reste <= 0; });
      U.toast('Compteur mis à jour : ' + F.num(v.heures) + ' h.'); if (hit.length) { E.notify('Seuil préventif atteint', e.id + ' — ' + hit[0].libelle.split(' — ')[0], '#/maintenance/preventif', 'orange'); U.toast(hit.length + ' seuil(s) préventif(s) atteint(s) : créer l\'OT.', 'err'); }
      refresh();
    } });
  }
  function remettre(eid) {
    var e = eq(eid); if (!e) return; var open = OT().filter(function (o) { return o.equip === eid && o.statut === 'En cours' && o.immobilisant; });
    U.confirm('Remettre en service', (open.length ? 'L\'OT <b>' + esc(open[0].id) + '</b> est encore en cours. ' : '') + 'Confirmer la remise en service de <b>' + esc(e.id + ' · ' + e.nom) + '</b> ?', 'Remettre en service', function () {
      e.statut = 'Disponible'; S.save(); E.log('Remise en service', e.id, MOD); U.toast(e.id + ' remis en service.'); refresh();
    });
  }
  function exportTab() {
    if (st.tab === 'preventif') return U.exportCSV('plans-maintenance-gpm', [{ label: 'Équipement', csv: function (x) { return x.p.equip; } }, { label: 'Opération', csv: function (x) { return x.p.libelle; } }, { label: 'Type', csv: function (x) { return x.p.type; } }, { label: 'Intervalle', csv: function (x) { return x.p.intervalle + (x.p.type === 'Heures' ? ' h' : ' j'); } }, { label: 'Dernière (h)', csv: function (x) { return x.p.dernierH || ''; } }, { label: 'Dernière (date)', csv: function (x) { return x.p.dernierDate; } }, { label: 'Reste', csv: function (x) { return x.s.reste + ' ' + x.s.unit; } }, { label: 'Échéance estimée', csv: function (x) { return x.s.due; } }, { label: 'État', csv: function (x) { return x.s.label; } }], dueList());
    U.exportCSV('ordres-de-travail-gpm', [{ label: 'N°', key: 'id' }, { label: 'Équipement', key: 'equip' }, { label: 'Intervention', key: 'titre' }, { label: 'Type', key: 'type' }, { label: 'Priorité', key: 'priorite' }, { label: 'Technicien', csv: function (o) { return empName(o.technicien); } }, { label: 'Début', key: 'debut' }, { label: 'Fin', key: 'fin' }, { label: 'Immobilisant', csv: function (o) { return o.immobilisant ? 'oui' : 'non'; } }, { label: 'Coût (FCFA)', csv: cost }, { label: 'Statut', key: 'statut' }], otRows());
  }

  /* ------------------------------------------------------------------ intégration */
  function pending(u) {
    var out = [], p = u ? u.profile : '';
    if (p === 'admin' || p === 'technique') OT().filter(function (o) { return o.statut === 'À valider'; }).forEach(function (o) { out.push({ title: 'Valider l\'OT ' + o.id + ' — ' + o.equip, sub: o.titre + ' · priorité ' + String(o.priorite).toLowerCase(), href: '#/maintenance/ordres/' + o.id, date: String(o.cree || o.debut).slice(0, 10), tone: o.priorite === 'Urgente' ? 'red' : 'orange', icon: 'wrench' }); });
    if (p === 'admin' || p === 'technique') dueList().filter(function (x) { return !x.s.ot && x.s.reste < 0; }).slice(0, 4).forEach(function (x) { out.push({ title: 'Préventif dépassé — ' + x.p.equip, sub: x.p.libelle.split(' — ')[0] + ' · dépassé de ' + F.num(-x.s.reste) + ' ' + x.s.unit, href: '#/maintenance/preventif', date: x.s.due, tone: 'red', icon: 'calendar' }); });
    return out;
  }
  function summary() {
    var a = flotte().filter(arret);
    return [{ label: 'Disponibilité de la flotte', value: F.num(dispoFlotte(), 1), unit: '%', icon: 'gauge', tone: 'green', foot: a.length ? a.length + ' équipement(s) à l\'arrêt' : 'aucun arrêt', href: '#/maintenance' },
      { label: 'Ordres de travail ouverts', value: OT().filter(isOpen).length, icon: 'wrench', tone: 'orange', foot: OT().filter(function (o) { return o.statut === 'À valider'; }).length + ' à valider', href: '#/maintenance/ordres' }];
  }
  function search(q) {
    var out = [];
    flotte().forEach(function (e) { if (E.norm(e.id + ' ' + e.nom + ' ' + e.type).indexOf(q) >= 0) out.push({ title: e.id + ' — ' + e.nom, sub: e.type + ' · ' + (e.statut || 'Disponible'), href: '#/maintenance/equipements/' + e.id }); });
    OT().forEach(function (o) { if (E.norm(o.id + ' ' + o.titre + ' ' + o.equip).indexOf(q) >= 0) out.push({ title: o.id + ' — ' + o.titre, sub: o.equip + ' · ' + o.statut, href: '#/maintenance/ordres/' + o.id }); });
    return out;
  }
  function badge() { return OT().filter(function (o) { return o.statut === 'À valider'; }).length + flotte().filter(function (e) { return e.statut === 'Hors service'; }).length; }

  E.register({ id: MOD, label: 'Flotte & maintenance', title: 'Flotte & maintenance', icon: 'wrench', group: 'Technique & Achats', roles: ['technique', 'exploitation'],
    seed: seed, init: init, render: render, pending: pending, summary: summary, search: search, badge: badge });
})();
