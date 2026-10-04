/* GPM · Espace de gestion — module « Projets & investissements » (portefeuille, planning Gantt, fiches projet).
   Infrastructures portuaires (quais, défenses, dragage, parcs), équipements (grues, engins), sûreté et digitalisation.
   La collection `projets` est partagée avec le site public (window.GPM_DATA.projets()) : champs public, avancement,
   statut, jalons, resume, partenaire, fin. Un projet publié ici peut donc être affiché sur le site. */
(function () {
  'use strict';
  var E = window.ERP, S = E.store, U = E.ui, F = E.fmt, esc = E.esc, COL = 'projets';
  var STATUTS = ['Études', 'Planifié', 'En cours', 'Suspendu', 'Terminé'];
  var METEO = {
    soleil: { l: 'Au vert', tone: 'green', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2" fill="#fde68a" stroke="#e8a50c"/><path stroke="#e8a50c" d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>' },
    nuage: { l: 'Vigilance', tone: 'orange', svg: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="3.2" fill="#fde68a" stroke="#e8a50c"/><path d="M7 19h10.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6-1.2A4 4 0 0 0 7 19z" fill="#e2e8f0" stroke="#64748b"/></svg>' },
    orage: { l: 'Critique', tone: 'red', svg: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16h10.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6-1.2A4 4 0 0 0 7 16z" fill="#cbd5e1" stroke="#475569"/><path d="M12.5 13.5 10.5 17h3l-2 4" stroke="#d93636" stroke-width="2"/></svg>' }
  };
  var M = function (i) { return 'MAT-' + (2041 + i * 7); };
  var cur = { view: null, params: [] };
  var flt = { q: '', vue: 'tous', statut: '' };
  var planUnit = null, ficheUnit = 'month';

  /* ------------------------------------------------------------------ utilitaires */
  function all() { return S.all(COL); }
  function get(id) { return S.get(COL, id); }
  function today() { return E.today(); }
  function mIdx(d) { var p = String(d).slice(0, 7).split('-'); return +p[0] * 12 + (+p[1] - 1); }
  function mFrac(d) { var x = E.parseDate(d), dim = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); return x.getFullYear() * 12 + x.getMonth() + (x.getDate() - 1) / dim; }
  function mLabel(i) { return E.MOIS[i % 12] + ' ' + String(Math.floor(i / 12)).slice(2); }
  function ymOf(i) { return Math.floor(i / 12) + '-' + String(i % 12 + 1).padStart(2, '0'); }
  function interp(anchors, x) {
    if (!anchors || !anchors.length) return 0;
    var a = anchors.map(function (k) { return [mIdx(k[0] + '-01'), k[1]]; }).sort(function (p, q) { return p[0] - q[0]; });
    if (x <= a[0][0]) return a[0][1];
    for (var i = 1; i < a.length; i++) if (x <= a[i][0]) { var t = (x - a[i - 1][0]) / (a[i][0] - a[i - 1][0] || 1); return a[i - 1][1] + (a[i][1] - a[i - 1][1]) * t; }
    return a[a.length - 1][1];
  }
  function dur(t) { return Math.max(1, E.daysBetween(t.s, t.e) + 1); }
  function calcAv(p) { var T = p.taches || []; if (!T.length) return p.avancement || 0; var d = E.sum(T, dur); return Math.round(E.sum(T, function (t) { return (+t.p || 0) * dur(t); }) / d); }
  function planned(p, d) { if (!p.courbe) return null; return Math.round(interp(p.courbe.prevu, mFrac(d || today()))); }
  function isActive(p) { return p.statut !== 'Terminé' && p.statut !== 'Suspendu'; }
  function overdueJalons(p) { var t = today(); return (p.jalons || []).filter(function (j) { return !j.fait && j.d < t; }); }
  function lateTasks(p) { var t = today(); return (p.taches || []).filter(function (x) { return (+x.p || 0) < 100 && x.e < t; }); }
  function ecart(p) { var pl = planned(p); return pl == null ? 0 : (p.avancement || 0) - pl; }
  function isLate(p) { return p.statut !== 'Terminé' && (overdueJalons(p).length > 0 || lateTasks(p).length > 0 || ecart(p) <= -8); }
  function nextJalon(p) { return (p.jalons || []).filter(function (j) { return !j.fait; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; })[0]; }
  function taskStatus(t) { var d = today(); if ((+t.p || 0) >= 100) return ['Terminé', 'green']; if (t.e < d) return ['En retard', 'red']; if (t.s <= d) return ['En cours', 'blue']; return ['À venir', 'grey']; }
  function meteo(p) { return METEO[p.meteo] || METEO.soleil; }
  function meteoPill(p, withLabel) { var m = meteo(p); return '<span class="prj-meteo tone-' + m.tone + '" title="Météo projet : ' + m.l + '">' + m.svg + (withLabel === false ? '' : m.l) + '</span>'; }
  function pubBadge(p) { return p.public ? '<span class="badge prj-pub" title="L\'avancement et les jalons sont affichés sur la page Projets du site public">' + E.icon('globe') + 'Visible sur le site</span>' : '<span class="badge tone-grey">' + E.icon('lock') + 'Interne</span>'; }
  function statBadge(s) { return U.badge(s, { 'Études': 'violet', 'Planifié': 'violet', 'En cours': 'blue', 'Suspendu': 'red', 'Terminé': 'green' }[s]); }
  function score(r) { return (+r.probabilite || 1) * (+r.impact || 1); }
  function scoreTone(s) { return s >= 15 ? 'red' : s >= 8 ? 'orange' : s >= 4 ? 'yellow' : 'green'; }
  function ring(pct, size, color) {
    var r = 42, c = 2 * Math.PI * r, len = c * Math.max(0, Math.min(100, pct)) / 100;
    return '<svg class="prj-ring" viewBox="0 0 100 100" width="' + (size || 110) + '" height="' + (size || 110) + '"><circle cx="50" cy="50" r="' + r + '" fill="none" stroke="#eef1f5" stroke-width="10"/><circle cx="50" cy="50" r="' + r + '" fill="none" stroke="' + (color || '#163b75') + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + len.toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 50 50)"/><text x="50" y="50" text-anchor="middle" style="font:700 21px Sora,sans-serif;fill:#0d1b2a">' + Math.round(pct) + '%</text><text x="50" y="66" text-anchor="middle" style="font:500 9px Inter,sans-serif;fill:#7a879a">avancement</text></svg>';
  }
  function empOpts() { return S.all('employes').map(function (e) { return { v: e.id, l: e.nom + ' — ' + e.poste }; }); }
  function refresh() { if (cur.view) { var y = window.scrollY; render(cur.view, cur.params); window.scrollTo(0, y); } E.renderBadges(); }
  function nextId() { var n = all().reduce(function (m, p) { var k = +(String(p.id).split('-')[1]) || 0; return Math.max(m, k); }, 0) + 1; return 'PRJ-' + String(n).padStart(2, '0'); }
  function publicNote(p) { return p.public ? ' (mis à jour sur le site public)' : ''; }

  /* ------------------------------------------------------------------ données d'exemple (dates relatives à aujourd'hui)
     Les projets PRJ-01 à PRJ-04 proviennent de window.GPM_DATA.projetsDefaut (partagés avec le site) ;
     ils sont enrichis ici (équipe, courbe en S, budget par lot, risques, journal, documents). */
  function D(n) { return E.addDays(E.today(), n); }
  function YM(k) { return ymOf(mIdx(E.today()) + k); }
  var EXTRA = {
    'PRJ-01': { responsable: M(25), equipe: [M(25), M(3), M(24), M(32), M(14)], meteo: 'nuage',
      courbe: { prevu: [[YM(-2), 0], [YM(-1), 30], [YM(0), 58], [YM(1), 90], [YM(2), 100]], reel: [[YM(-2), 0], [YM(-1), 27], [YM(0), 54]] },
      taches: [{ t: 'Commande et fabrication des défenses', s: D(-60), e: D(-10), p: 100, lot: 'Achats', resp: M(32) }, { t: 'Réception et contrôle des défenses', s: D(-12), e: D(-5), p: 100, lot: 'Achats', resp: M(4) },
        { t: 'Dépose des anciennes défenses et bollards', s: D(-8), e: D(10), p: 55, lot: 'Travaux', resp: M(24) }, { t: 'Reprise des ancrages sur le mur de quai', s: D(2), e: D(22), p: 0, lot: 'Génie civil', resp: M(25) },
        { t: 'Pose des défenses et des bollards', s: D(14), e: D(34), p: 0, lot: 'Travaux', resp: M(24) }, { t: 'Essais d\'accostage et réception', s: D(35), e: D(40), p: 0, lot: 'Réception', resp: M(25) }],
      budgetLignes: [{ lot: 'Défenses & bollards', budget: 210e6, engage: 205e6, facture: 160e6 }, { lot: 'Génie civil (ancrages)', budget: 85e6, engage: 25e6, facture: 0 }, { lot: 'Pose & levage', budget: 55e6, engage: 10e6, facture: 0 }, { lot: 'Provisions & aléas', budget: 30e6, engage: 0, facture: 0 }],
      risques: [
        { titre: 'Indisponibilité du poste 3 pendant la pose (navires rouliers à dérouter)', probabilite: 4, impact: 3, mitigation: 'Pose par demi-poste, planning coordonné avec le plan de quai et les armateurs rouliers.', statut: 'Ouvert', resp: M(0) },
        { titre: 'Ancrages du mur de quai plus dégradés que prévu', probabilite: 3, impact: 4, mitigation: 'Inspection subaquatique avant reprise ; variante de scellement chimique chiffrée.', statut: 'Ouvert', resp: M(25) },
        { titre: 'Travaux en bord à quai (chute à l\'eau, levage)', probabilite: 2, impact: 5, mitigation: 'Permis de travail journalier, gilets, plan de levage, embarcation de sécurité en veille.', statut: 'Maîtrisé', resp: M(6) }],
      journal: [
        { d: D(-6), type: 'Réunion de chantier', auteur: M(25), titre: 'Point hebdomadaire — poste 3', texte: 'Défenses réceptionnées et conformes. Dépose engagée sur la moitié nord du poste. Deux ancrages présentent une corrosion avancée.', decisions: ['Programmer une inspection subaquatique des ancrages', 'Informer le service commercial des créneaux d\'indisponibilité'] },
        { d: D(-25), type: 'Comité de pilotage', auteur: M(3), titre: 'COPIL mensuel', texte: 'Fabrication terminée avec une semaine d\'avance. Budget respecté à ce stade.', decisions: ['Valider le démarrage de la dépose dès réception'] }],
      documents: [{ nom: 'Plan de pose des défenses — poste 3', type: 'PDF', d: D(-40) }, { nom: 'PV de réception usine des défenses', type: 'PDF', d: D(-5) }, { nom: 'Planning travaux poste 3', type: 'XLSX', d: D(-6) }] },
    'PRJ-02': { responsable: M(25), equipe: [M(25), M(36), M(39), M(13)], meteo: 'soleil',
      courbe: { prevu: [[YM(-1), 0], [YM(0), 15], [YM(1), 25], [YM(2), 45], [YM(3), 75], [YM(4), 100]], reel: [[YM(-1), 0], [YM(0), 17]] },
      taches: [{ t: 'Levé hydrographique du chenal', s: D(-30), e: D(5), p: 80, lot: 'Études', resp: M(13) }, { t: 'Analyse des fonds et volumes à draguer', s: D(0), e: D(15), p: 10, lot: 'Études', resp: M(25) },
        { t: 'Consultation des entreprises de dragage', s: D(0), e: D(40), p: 10, lot: 'Achats', resp: M(32) }, { t: 'Dragage d\'entretien', s: D(45), e: D(110), p: 0, lot: 'Travaux', resp: M(36) }, { t: 'Levé de contrôle et balisage', s: D(110), e: D(120), p: 0, lot: 'Réception', resp: M(39) }],
      budgetLignes: [{ lot: 'Hydrographie', budget: 120e6, engage: 120e6, facture: 70e6 }, { lot: 'Dragage', budget: 950e6, engage: 60e6, facture: 0 }, { lot: 'Suivi environnemental', budget: 50e6, engage: 0, facture: 0 }, { lot: 'Provisions & aléas', budget: 80e6, engage: 0, facture: 0 }],
      risques: [
        { titre: 'Volumes de sédiments supérieurs aux estimations', probabilite: 3, impact: 4, mitigation: 'Bordereau de prix au m³ avec tranche optionnelle.', statut: 'Ouvert', resp: M(25) },
        { titre: 'Gêne à la navigation pendant le dragage', probabilite: 3, impact: 3, mitigation: 'Avis aux navigateurs, coordination avec les pilotes et la capitainerie.', statut: 'Ouvert', resp: M(39) },
        { titre: 'Disponibilité d\'une drague dans la sous-région', probabilite: 2, impact: 4, mitigation: 'Consultation élargie à trois entreprises, réservation anticipée.', statut: 'Ouvert', resp: M(32) }],
      journal: [{ d: D(-3), type: 'Revue technique', auteur: M(13), titre: 'Premiers résultats du levé', texte: 'Le levé confirme un envasement localisé à l\'entrée du chenal. Les profondeurs restent compatibles avec le trafic actuel.', decisions: ['Publier un avis aux navigateurs sur la zone envasée', 'Lancer la consultation des dragueurs'] }],
      documents: [{ nom: 'Cahier des charges du levé hydrographique', type: 'PDF', d: D(-32) }] },
    'PRJ-03': { responsable: M(35), equipe: [M(35), M(26), M(15), M(28)], meteo: 'soleil',
      courbe: { prevu: [[YM(-1), 0], [YM(0), 30], [YM(1), 55], [YM(2), 80], [YM(3), 100]], reel: [[YM(-1), 0], [YM(0), 33]] },
      taches: [{ t: 'Site et demandes d\'escale en ligne', s: D(-20), e: D(10), p: 80, lot: 'Développement', resp: M(35) }, { t: 'Espace de gestion interne', s: D(-10), e: D(40), p: 30, lot: 'Développement', resp: M(35) },
        { t: 'Paramétrage des tarifs et de la facturation', s: D(5), e: D(35), p: 0, lot: 'Paramétrage', resp: M(28) }, { t: 'Formation des équipes et des armateurs', s: D(30), e: D(70), p: 0, lot: 'Conduite du changement', resp: M(26) }],
      budgetLignes: [{ lot: 'Développement', budget: 55e6, engage: 25e6, facture: 12e6 }, { lot: 'Hébergement & sécurité', budget: 15e6, engage: 5e6, facture: 2e6 }, { lot: 'Formation', budget: 15e6, engage: 0, facture: 0 }, { lot: 'Provisions', budget: 10e6, engage: 0, facture: 0 }],
      risques: [{ titre: 'Adoption par les consignataires', probabilite: 3, impact: 3, mitigation: 'Ateliers de présentation et accompagnement personnalisé des premiers utilisateurs.', statut: 'Ouvert', resp: M(26) }, { titre: 'Qualité des données tarifaires', probabilite: 2, impact: 3, mitigation: 'Validation des barèmes par la direction financière.', statut: 'Ouvert', resp: M(28) }],
      journal: [{ d: D(-2), type: 'Comité de pilotage', auteur: M(35), titre: 'Présentation du démonstrateur', texte: 'Démonstration du site et de l\'espace de gestion à la Direction générale. Accueil favorable des directions.', decisions: ['Désigner un utilisateur clé par direction', 'Préparer l\'ouverture aux premiers armateurs'] }],
      documents: [{ nom: 'Cartographie des processus portuaires', type: 'PDF', d: D(-15) }] },
    'PRJ-04': { responsable: M(3), equipe: [M(3), M(22), M(23), M(16)], meteo: 'soleil',
      courbe: { prevu: [[YM(0), 0], [YM(1), 15], [YM(2), 60], [YM(3), 100]], reel: [[YM(0), 0]] },
      taches: [{ t: 'Approvisionnement des pièces (couronne, câbles, réducteurs)', s: D(0), e: D(20), p: 40, lot: 'Achats', resp: M(4) }, { t: 'Immobilisation et dépose', s: D(20), e: D(30), p: 0, lot: 'Maintenance', resp: M(22) },
        { t: 'Révision des mécanismes de levage et d\'orientation', s: D(30), e: D(65), p: 0, lot: 'Maintenance', resp: M(22) }, { t: 'Contrôle électrique et automatismes', s: D(55), e: D(70), p: 0, lot: 'Maintenance', resp: M(23) }, { t: 'Essais de charge et remise en service', s: D(70), e: D(75), p: 0, lot: 'Essais', resp: M(3) }],
      budgetLignes: [{ lot: 'Pièces constructeur', budget: 160e6, engage: 0, facture: 0 }, { lot: 'Main-d\'œuvre & assistance technique', budget: 70e6, engage: 0, facture: 0 }, { lot: 'Essais & certification', budget: 15e6, engage: 0, facture: 0 }, { lot: 'Provisions', budget: 15e6, engage: 0, facture: 0 }],
      risques: [{ titre: 'Délai de livraison des pièces constructeur', probabilite: 3, impact: 4, mitigation: 'Commande dès validation, transport aérien pour les pièces critiques.', statut: 'Ouvert', resp: M(4) }, { titre: 'Baisse de cadence avec deux grues seulement', probabilite: 4, impact: 3, mitigation: 'Révision planifiée en période de trafic plus faible ; renfort reach stackers.', statut: 'Ouvert', resp: M(0) }],
      journal: [{ d: D(-4), type: 'Revue technique', auteur: M(3), titre: 'Préparation de la révision', texte: 'Liste des pièces arrêtée avec le constructeur. Fenêtre d\'immobilisation calée avec l\'exploitation.', decisions: ['Émettre la demande d\'achat des pièces'] }],
      documents: [{ nom: 'Rapport d\'expertise grue n° 1 (22 000 h)', type: 'PDF', d: D(-10) }] }
  };
  var INTERNES = [
    { id: 'PRJ-05', code: 'PARC-OWE', nom: 'Réhabilitation et densification du parc à conteneurs d\'Owendo', public: false,
      resume: 'Reprise des chaussées du parc, renforcement des chemins de roulement des reach stackers, nouvelles prises pour conteneurs frigorifiques et éclairage LED.',
      partenaire: 'Estuaire BTP Portuaire (démo)', debut: D(-200), fin: D(160), statut: 'En cours', budget: 4.2e9, engage: 2.65e9, chef: 'Service technique', responsable: M(25), equipe: [M(25), M(20), M(23), M(18), M(6)], meteo: 'nuage',
      jalons: [{ d: D(-180), t: 'Validation des études d\'exécution', fait: true }, { d: D(-60), t: 'Livraison de la zone A (2,5 ha)', fait: true }, { d: D(20), t: 'Mise en service des 120 prises frigorifiques', fait: false }, { d: D(110), t: 'Livraison de la zone B', fait: false }, { d: D(160), t: 'Réception définitive', fait: false }],
      taches: [{ t: 'Études d\'exécution et phasage', s: D(-200), e: D(-180), p: 100, lot: 'Études', resp: M(25) }, { t: 'Chaussées zone A', s: D(-175), e: D(-60), p: 100, lot: 'Génie civil', resp: M(25) },
        { t: 'Réseau électrique et prises frigorifiques', s: D(-90), e: D(-3), p: 75, lot: 'Électricité', resp: M(23) }, { t: 'Chaussées zone B', s: D(-30), e: D(110), p: 25, lot: 'Génie civil', resp: M(25) },
        { t: 'Éclairage LED des mâts', s: D(30), e: D(130), p: 0, lot: 'Électricité', resp: M(23) }, { t: 'Marquage et plan de gerbage', s: D(120), e: D(155), p: 0, lot: 'Exploitation', resp: M(20) }],
      courbe: { prevu: [[YM(-7), 0], [YM(-5), 15], [YM(-3), 40], [YM(-1), 55], [YM(0), 62], [YM(2), 78], [YM(5), 100]], reel: [[YM(-7), 0], [YM(-5), 14], [YM(-3), 37], [YM(-1), 50], [YM(0), 55]] },
      budgetLignes: [{ lot: 'Génie civil & chaussées', budget: 2.7e9, engage: 1.9e9, facture: 1.4e9 }, { lot: 'Électricité & prises reefer', budget: 0.85e9, engage: 0.6e9, facture: 0.35e9 }, { lot: 'Éclairage', budget: 0.35e9, engage: 0.1e9, facture: 0 }, { lot: 'Signalisation & marquage', budget: 0.1e9, engage: 0.05e9, facture: 0 }, { lot: 'Provisions & aléas', budget: 0.2e9, engage: 0, facture: 0 }],
      risques: [{ titre: 'Travaux en parc exploité (coactivité avec les engins)', probabilite: 4, impact: 4, mitigation: 'Phasage par zones balisées, plan de circulation provisoire, coordinateur sécurité dédié.', statut: 'Ouvert', resp: M(6) }, { titre: 'Saison des pluies sur les travaux de chaussées', probabilite: 4, impact: 2, mitigation: 'Priorité aux réseaux pendant les fortes pluies ; drainage provisoire.', statut: 'Ouvert', resp: M(25) }, { titre: 'Puissance électrique disponible pour les prises frigorifiques', probabilite: 2, impact: 4, mitigation: 'Nouveau transformateur 1 250 kVA commandé.', statut: 'Maîtrisé', resp: M(23) }],
      journal: [{ d: D(-5), type: 'Réunion de chantier', auteur: M(25), titre: 'Point zone B et prises frigorifiques', texte: 'Câblage des prises frigorifiques à 75 % : le raccordement au nouveau transformateur est en attente. Chaussées zone B à 25 %.', decisions: ['Relancer la livraison du transformateur', 'Basculer une équipe du génie civil sur les massifs des mâts d\'éclairage'] }],
      documents: [{ nom: 'Plan de phasage du parc', type: 'PDF', d: D(-185) }, { nom: 'PV de livraison zone A', type: 'PDF', d: D(-60) }] },
    { id: 'PRJ-06', code: 'ISPS-ACC', nom: 'Sûreté portuaire : contrôle d\'accès par badges et vidéosurveillance', public: false,
      resume: 'Tourniquets et barrières à badges aux entrées d\'Owendo et de Port-Gentil, 64 caméras, poste central de sûreté, conformément au plan de sûreté de l\'installation portuaire (code ISPS).',
      partenaire: 'Gabon Électro-Tech (démo)', debut: D(-150), fin: D(90), statut: 'En cours', budget: 1.25e9, engage: 0.98e9, chef: 'HSE & sûreté', responsable: M(6), equipe: [M(6), M(33), M(35), M(23)], meteo: 'orage',
      jalons: [{ d: D(-130), t: 'Validation du plan de sûreté révisé', fait: true }, { d: D(-12), t: 'Mise en service du poste central de sûreté', fait: false }, { d: D(40), t: 'Contrôle d\'accès opérationnel à Owendo', fait: false }, { d: D(90), t: 'Déploiement à Port-Gentil et audit', fait: false }],
      taches: [{ t: 'Évaluation de sûreté et plan révisé', s: D(-150), e: D(-130), p: 100, lot: 'Études', resp: M(6) }, { t: 'Génie civil des guérites et tranchées', s: D(-120), e: D(-40), p: 100, lot: 'Travaux', resp: M(23) },
        { t: 'Poste central de sûreté et serveurs', s: D(-60), e: D(-12), p: 70, lot: 'Systèmes', resp: M(35) }, { t: 'Pose des caméras (64)', s: D(-45), e: D(15), p: 50, lot: 'Systèmes', resp: M(23) },
        { t: 'Tourniquets et barrières Owendo', s: D(5), e: D(40), p: 0, lot: 'Systèmes', resp: M(23) }, { t: 'Émission des badges et formation des agents', s: D(20), e: D(60), p: 0, lot: 'Sûreté', resp: M(33) }, { t: 'Déploiement Port-Gentil', s: D(50), e: D(90), p: 0, lot: 'Systèmes', resp: M(36) }],
      courbe: { prevu: [[YM(-5), 0], [YM(-3), 25], [YM(-1), 50], [YM(0), 60], [YM(2), 85], [YM(3), 100]], reel: [[YM(-5), 0], [YM(-3), 22], [YM(-1), 42], [YM(0), 47]] },
      budgetLignes: [{ lot: 'Vidéosurveillance', budget: 0.45e9, engage: 0.42e9, facture: 0.25e9 }, { lot: 'Contrôle d\'accès', budget: 0.4e9, engage: 0.36e9, facture: 0.1e9 }, { lot: 'Génie civil', budget: 0.2e9, engage: 0.2e9, facture: 0.19e9 }, { lot: 'Formation & badges', budget: 0.08e9, engage: 0, facture: 0 }, { lot: 'Provisions', budget: 0.12e9, engage: 0, facture: 0 }],
      risques: [{ titre: 'Retard du poste central : serveurs livrés incomplets', probabilite: 4, impact: 4, mitigation: 'Livraison complémentaire exigée sous 10 jours ; pénalités contractuelles activées.', statut: 'Ouvert', resp: M(35) }, { titre: 'Non-conformité ISPS lors du prochain audit', probabilite: 2, impact: 5, mitigation: 'Mesures compensatoires : rondes renforcées et registre papier jusqu\'à la mise en service.', statut: 'Ouvert', resp: M(6) }, { titre: 'Acceptation des nouveaux contrôles par les transporteurs', probabilite: 3, impact: 2, mitigation: 'Communication aux transitaires et pré-enregistrement des véhicules.', statut: 'Ouvert', resp: M(33) }],
      journal: [{ d: D(-8), type: 'Comité de pilotage', auteur: M(6), titre: 'COPIL sûreté', texte: 'Le poste central n\'est pas opérationnel : deux serveurs d\'enregistrement manquent. 32 caméras posées sur 64.', decisions: ['Mettre en demeure le fournisseur', 'Maintenir les rondes renforcées'] }],
      documents: [{ nom: 'Plan de sûreté de l\'installation portuaire (révision)', type: 'PDF', d: D(-130) }, { nom: 'Synoptique vidéosurveillance', type: 'PDF', d: D(-70) }] },
    { id: 'PRJ-07', code: 'ERP', nom: 'Déploiement de l\'ERP et digitalisation des processus', public: false,
      resume: 'Espace de gestion unique : escales, services maritimes, terminal, facturation, achats, magasin, maintenance, RH, paie, HSE et tableaux de bord en temps réel.',
      partenaire: 'Rouana (intégrateur)', debut: D(-125), fin: D(270), statut: 'En cours', budget: 0.85e9, engage: 0.27e9, chef: 'Direction générale', responsable: M(35), equipe: [M(35), M(28), M(29), M(4), M(15)], meteo: 'soleil',
      jalons: [{ d: D(-80), t: 'Cadrage et cartographie des processus validés', fait: true }, { d: D(-4), t: 'Démonstrateur présenté à la Direction générale', fait: true }, { d: D(72), t: 'Lot 1 en production : escales, services, facturation', fait: false }, { d: D(180), t: 'Lot 2 en production : achats, magasin, maintenance', fait: false }, { d: D(270), t: 'Lot 3 : RH, paie, HSE, tableaux de bord', fait: false }],
      taches: [{ t: 'Cadrage et cartographie des processus', s: D(-125), e: D(-80), p: 100, lot: 'Cadrage', resp: M(35) }, { t: 'Démonstrateur fonctionnel', s: D(-79), e: D(-4), p: 100, lot: 'Conception', resp: M(35) }, { t: 'Paramétrage du lot 1', s: D(-3), e: D(70), p: 5, lot: 'Lot 1', resp: M(35) }, { t: 'Reprise des données (clients, tarifs, équipements)', s: D(10), e: D(60), p: 0, lot: 'Données', resp: M(28) }, { t: 'Formation des utilisateurs clés', s: D(40), e: D(260), p: 0, lot: 'Conduite du changement', resp: M(30) }, { t: 'Paramétrage du lot 2', s: D(90), e: D(180), p: 0, lot: 'Lot 2', resp: M(4) }, { t: 'Paramétrage du lot 3', s: D(180), e: D(270), p: 0, lot: 'Lot 3', resp: M(29) }],
      courbe: { prevu: [[YM(-4), 0], [YM(-1), 18], [YM(2), 40], [YM(6), 70], [YM(9), 100]], reel: [[YM(-4), 0], [YM(-2), 12], [YM(0), 20]] },
      budgetLignes: [{ lot: 'Licences & hébergement', budget: 0.15e9, engage: 0.08e9, facture: 0.04e9 }, { lot: 'Intégration & paramétrage', budget: 0.48e9, engage: 0.17e9, facture: 0.08e9 }, { lot: 'Reprise de données', budget: 0.06e9, engage: 0.02e9, facture: 0 }, { lot: 'Formation & conduite du changement', budget: 0.1e9, engage: 0, facture: 0 }, { lot: 'Tablettes terrain (quais)', budget: 0.06e9, engage: 0, facture: 0 }],
      risques: [{ titre: 'Qualité des données historiques (tarifs, clients, équipements)', probabilite: 4, impact: 3, mitigation: 'Campagne de nettoyage des données avant la reprise, validation par les métiers.', statut: 'Ouvert', resp: M(28) }, { titre: 'Couverture réseau sur les quais (tablettes terrain)', probabilite: 2, impact: 2, mitigation: 'Mode hors connexion et bornes Wi-Fi industrielles.', statut: 'Maîtrisé', resp: M(35) }],
      journal: [{ d: D(-4), type: 'Comité de pilotage', auteur: M(35), titre: 'Présentation du démonstrateur', texte: 'Démonstration des modules escales, terminal, achats, magasin, RH, paie et HSE & sûreté à la Direction générale.', decisions: ['Lancer le paramétrage du lot 1', 'Désigner un utilisateur clé par direction'] }],
      documents: [{ nom: 'Cartographie des processus', type: 'PDF', d: D(-80) }, { nom: 'Plan de déploiement par lots', type: 'PDF', d: D(-4) }] },
    { id: 'PRJ-08', code: 'MAG-POG', nom: 'Réhabilitation du magasin couvert et du terre-plein de Port-Gentil', public: false,
      resume: 'Réfection de la toiture et du bardage du magasin, reprise de la dalle, rénovation du terre-plein et du réseau d\'eaux pluviales.',
      partenaire: 'Mandji Transports (démo)', debut: D(-90), fin: D(180), statut: 'En cours', budget: 0.9e9, engage: 0.38e9, chef: 'Agence de Port-Gentil', responsable: M(36), equipe: [M(36), M(41), M(25)], meteo: 'soleil',
      jalons: [{ d: D(-60), t: 'Diagnostic structurel du magasin', fait: true }, { d: D(45), t: 'Toiture et bardage terminés', fait: false }, { d: D(180), t: 'Réception du terre-plein', fait: false }],
      taches: [{ t: 'Diagnostic structurel', s: D(-90), e: D(-60), p: 100, lot: 'Études', resp: M(25) }, { t: 'Réfection de la toiture et du bardage', s: D(-40), e: D(45), p: 45, lot: 'Bâtiment', resp: M(36) }, { t: 'Reprise de la dalle du magasin', s: D(30), e: D(90), p: 0, lot: 'Génie civil', resp: M(25) }, { t: 'Terre-plein et eaux pluviales', s: D(60), e: D(175), p: 0, lot: 'Génie civil', resp: M(41) }],
      courbe: { prevu: [[YM(-3), 0], [YM(-1), 20], [YM(0), 28], [YM(2), 50], [YM(6), 100]], reel: [[YM(-3), 0], [YM(-1), 20], [YM(0), 29]] },
      budgetLignes: [{ lot: 'Bâtiment (toiture, bardage)', budget: 0.35e9, engage: 0.3e9, facture: 0.14e9 }, { lot: 'Dalle & terre-plein', budget: 0.45e9, engage: 0.06e9, facture: 0 }, { lot: 'Études & contrôle', budget: 0.05e9, engage: 0.02e9, facture: 0.02e9 }, { lot: 'Provisions', budget: 0.05e9, engage: 0, facture: 0 }],
      risques: [{ titre: 'Stockage des marchandises pendant les travaux', probabilite: 3, impact: 3, mitigation: 'Travaux par travées, location de tentes de stockage temporaires.', statut: 'Ouvert', resp: M(41) }, { titre: 'Travail en hauteur sur la toiture', probabilite: 2, impact: 5, mitigation: 'Lignes de vie, filets, permis de travail en hauteur quotidien.', statut: 'Maîtrisé', resp: M(6) }],
      journal: [{ d: D(-7), type: 'Réunion de chantier', auteur: M(36), titre: 'Avancement toiture', texte: 'Neuf travées de toiture sur vingt remplacées. Aucun incident.', decisions: ['Maintenir le phasage par travées'] }],
      documents: [{ nom: 'Diagnostic structurel du magasin', type: 'PDF', d: D(-60) }] }
  ];
  function seed() {
    var base = E.clone(window.GPM_DATA ? window.GPM_DATA.projetsDefaut : []);
    base.forEach(function (p) { var x = EXTRA[p.id]; if (x) Object.keys(x).forEach(function (k) { p[k] = E.clone(x[k]); }); p.avancement = calcAv(p); });
    INTERNES.forEach(function (p) { var q = E.clone(p); q.avancement = calcAv(q); base.push(q); });
    base.forEach(function (p) {
      (p.risques || []).forEach(function (r, i) { r.id = 'R' + (i + 1); });
      (p.journal || []).forEach(function (j, i) { j.id = p.id + '-CR' + (i + 1); });
      p.equipe = p.equipe || []; p.documents = p.documents || []; p.journal = p.journal || []; p.risques = p.risques || [];
      if (!p.budgetLignes) p.budgetLignes = [{ lot: 'Budget global', budget: p.budget || 0, engage: p.engage || 0, facture: 0 }];
    });
    return { projets: base };
  }

  /* ------------------------------------------------------------------ CSS du module */
  function css() {
    if (document.getElementById('prj-css')) return;
    var s = document.createElement('style'); s.id = 'prj-css';
    s.textContent = [
      '.prj-ch .chart{overflow:visible}.tbl.responsive td .prj-range{flex:1;max-width:220px}',
      '.prj-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}',
      '.prj-card{padding:18px 18px 16px;display:flex;flex-direction:column;gap:12px;cursor:pointer;position:relative;overflow:hidden;transition:transform .15s,box-shadow .15s}',
      '.prj-card:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(13,27,42,.12)}',
      '.prj-card::before{content:"";position:absolute;left:0;top:0;right:0;height:4px;background:var(--green)}',
      '.prj-card.m-nuage::before{background:var(--orange)}.prj-card.m-orage::before{background:var(--red)}',
      '.prj-card h3{font-size:15.5px;line-height:1.3}',
      '.prj-top{display:flex;gap:6px;align-items:center;flex-wrap:wrap}',
      '.prj-code{font:700 11px/1 ui-monospace,Consolas,monospace;letter-spacing:.06em;background:var(--navy);color:#fff;padding:5px 7px;border-radius:6px}',
      '.prj-meteo{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;padding:2px 9px 2px 3px;border-radius:20px;white-space:nowrap}',
      '.prj-meteo svg{width:22px;height:22px}',
      '.badge.prj-pub{background:#fff6b8;color:#7a5d00}.badge svg{width:12px;height:12px}.badge.prj-pub::before,.badge.tone-grey:has(svg)::before{display:none}',
      '.prj-av__lbl{display:flex;align-items:baseline;gap:8px;margin-bottom:6px;font-size:12px;color:var(--ink-3)}',
      '.prj-av__lbl b{font-family:Sora,sans-serif;font-size:19px;color:var(--ink)}',
      '.prj-av .progress{height:9px}',
      '.prj-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;border-top:1px solid var(--line-2);padding-top:12px}',
      '.prj-stats>div{min-width:0}',
      '.prj-stats span{display:block;font-size:10.5px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.05em;font-weight:600}',
      '.prj-stats b{display:block;font-size:13.5px;margin-top:3px}',
      '.prj-stats small{display:block;font-size:11.5px;color:var(--ink-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.prj-foot{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink-2)}',
      '.prj-alert{display:flex;gap:6px;align-items:center;font-size:12px;font-weight:600;color:var(--red);background:var(--red-bg);padding:6px 10px;border-radius:8px}',
      '.prj-alert svg{width:15px;flex:none}',
      '.prj-head{overflow:hidden;background:linear-gradient(135deg,#0a1f44 0%,#163b75 100%);color:#fff;border:0}',
      '.prj-head .card__b{padding:20px 22px}',
      '.prj-head h2{font-size:22px;line-height:1.25;color:#fff;margin:8px 0 6px}',
      '.prj-head p{margin:0;color:#c9d6ea;max-width:820px}',
      '.prj-head__main{display:flex;gap:22px;align-items:center}',
      '.prj-head__txt{flex:1;min-width:0}',
      '.prj-head .prj-ring{flex:none;background:#fff;border-radius:50%;padding:4px}',
      '.prj-head .prj-code{background:var(--yellow);color:var(--navy)}',
      '.prj-meta{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:14px;font-size:12.5px;color:#c9d6ea}',
      '.prj-meta b{color:#fff;font-weight:600}',
      '.prj-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}',
      '.prj-head .btn.ghost{color:#fff}.prj-head .btn.ghost:hover{background:rgba(255,255,255,.1)}',
      '.prj-head .btn.line{background:transparent;border-color:rgba(255,255,255,.35);color:#fff}.prj-head .btn.line:hover{background:rgba(255,255,255,.1)}',
      '.prj-back{display:inline-flex;align-items:center;gap:6px;color:#c9d6ea;font-size:12.5px;font-weight:600}.prj-back svg{width:15px}',
      '.prj-range{display:flex;align-items:center;gap:10px;min-width:170px}',
      '.prj-range input{flex:1;accent-color:#163b75;min-width:90px;height:22px}',
      '.prj-range output{font-weight:700;font-size:12.5px;width:40px;text-align:right}',
      '.prj-matrix{display:grid;grid-template-columns:22px repeat(5,minmax(0,1fr));gap:5px;align-items:stretch}',
      '.prj-matrix .c{min-height:52px;border-radius:9px;display:flex;flex-wrap:wrap;gap:3px;align-content:center;justify-content:center;padding:4px;font-size:11px;font-weight:700}',
      '.prj-matrix .c i{font-style:normal;background:#fff;color:var(--ink);border-radius:20px;padding:1px 6px;box-shadow:0 1px 2px rgba(0,0,0,.12)}',
      '.prj-matrix .ax{font-size:11px;color:var(--ink-3);display:flex;align-items:center;justify-content:center;font-weight:600}',
      '.prj-matrix .h-green{background:#d7f2e0}.prj-matrix .h-yellow{background:#fff3b0}.prj-matrix .h-orange{background:#ffd9b0}.prj-matrix .h-red{background:#f9c0c0}',
      '.prj-jal{display:flex;gap:14px;align-items:center;padding:14px 18px;border-bottom:1px solid var(--line-2)}',
      '.prj-jal:last-child{border-bottom:0}',
      '.prj-jal__d{width:16px;height:16px;transform:rotate(45deg);background:var(--yellow);border:2px solid var(--navy);flex:none;margin:0 4px}',
      '.prj-jal__d.done{background:var(--green);border-color:#0f6b31}.prj-jal__d.late{background:var(--red);border-color:#8f1d1d}',
      '.prj-jal__b{flex:1;min-width:0}',
      '.prj-cr{border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:#fff}',
      '.prj-cr h4{font-size:14px;margin:4px 0 6px}',
      '.prj-cr ul{margin:8px 0 0;padding-left:18px;font-size:12.5px}',
      '.prj-cr .dec{margin-top:10px;background:#f8fafc;border-radius:8px;padding:8px 12px}',
      '.prj-team{display:flex;flex-direction:column;gap:10px}',
      '.prj-team>div{display:flex;align-items:center;gap:10px}',
      '.prj-seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}',
      '.prj-seg button{border:0;background:none;padding:6px 12px;font-weight:600;font-size:12.5px;cursor:pointer;color:var(--ink-3)}',
      '.prj-seg button.is-active{background:var(--navy);color:#fff}',
      '.prj-kv{display:grid;grid-template-columns:1fr auto;gap:8px 12px;font-size:13px}.prj-kv dt{color:var(--ink-3)}.prj-kv dd{margin:0;font-weight:600;text-align:right}',
      '.prj-pubbox{border:1px dashed #c9d2de;border-radius:12px;padding:14px;background:#fbfcfe}',
      '@media (max-width:640px){.prj-grid{grid-template-columns:1fr}.prj-head__main{flex-direction:column-reverse;align-items:flex-start}.prj-head h2{font-size:18px}.prj-head .card__b{padding:16px}.prj-stats{gap:8px}.prj-stats b{font-size:12.5px}.prj-jal{flex-wrap:wrap;padding:12px 14px}.prj-matrix .c{min-height:40px}.prj-actions .btn{flex:1 1 auto}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ rendu principal */
  function render(view, params) {
    css(); cur.view = view; cur.params = params || [];
    var a = cur.params[0];
    if (a && get(a)) return renderFiche(view, get(a), cur.params[1] || 'synthese');
    if (a === 'planning') return renderPlanning(view, cur.params[1] || 'ALL', cur.params[2]);
    return renderPortefeuille(view);
  }

  function topTabs(active) {
    return U.tabs([{ k: 'portefeuille', l: 'Portefeuille', n: all().length }, { k: 'planning', l: 'Planning global' }], active, function (k) { E.go('projets' + (k === 'planning' ? '/planning' : '')); });
  }

  function kpiRow() {
    var P = all(), act = P.filter(isActive), t = today(), t30 = E.addDays(t, 30);
    var wsum = E.sum(act, function (p) { return p.budget || 1; }), wav = wsum ? E.sum(act, function (p) { return (p.avancement || 0) * (p.budget || 1); }) / wsum : 0;
    var bud = E.sum(P, 'budget'), eng = E.sum(P, 'engage');
    var jal = []; P.forEach(function (p) { (p.jalons || []).forEach(function (j) { if (!j.fait && j.d >= t && j.d <= t30) jal.push(j); }); });
    var late = P.filter(isLate);
    return '<div class="grid g4" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">' +
      U.kpi({ label: 'Projets actifs', value: act.length, unit: '/ ' + P.length, icon: 'layers', tone: 'blue', foot: P.filter(function (p) { return p.public; }).length + ' visibles sur le site public' }) +
      U.kpi({ label: 'Avancement moyen', value: Math.round(wav), unit: '%', icon: 'trend', tone: 'green', foot: 'pondéré par le budget des projets actifs' }) +
      U.kpi({ label: 'Budget engagé', value: F.short(eng), unit: '/ ' + F.short(bud), icon: 'wallet', tone: 'violet', foot: '<span class="' + (eng / bud > .8 ? 'down' : 'up') + '">' + F.pct(bud ? eng / bud * 100 : 0) + '</span> du budget total' }) +
      U.kpi({ label: 'Jalons à 30 jours', value: jal.length, icon: 'flag', tone: 'yellow', foot: jal.length ? 'prochain : ' + F.date(jal.sort(function (a, b) { return a.d < b.d ? -1 : 1; })[0].d) : 'aucun jalon imminent' }) +
      U.kpi({ label: 'Projets en retard', value: late.length, icon: 'alert', tone: late.length ? 'red' : 'green', foot: late.length ? late.map(function (p) { return p.code; }).join(' · ') : 'tous dans les temps' }) +
      '</div>';
  }

  function card(p) {
    var nj = nextJalon(p), pl = planned(p), late = isLate(p), oj = overdueJalons(p), lt = lateTasks(p);
    var cons = p.budget ? p.engage / p.budget * 100 : 0, rest = E.daysBetween(today(), p.fin);
    var alertTxt = [];
    if (oj.length) alertTxt.push(oj.length + ' jalon' + (oj.length > 1 ? 's' : '') + ' dépassé' + (oj.length > 1 ? 's' : ''));
    if (lt.length) alertTxt.push(lt.length + ' tâche' + (lt.length > 1 ? 's' : '') + ' en retard');
    if (!alertTxt.length && late) alertTxt.push('Écart de ' + Math.abs(ecart(p)) + ' pts sur le prévu');
    return '<article class="card prj-card m-' + (p.meteo || 'soleil') + '" data-id="' + p.id + '" tabindex="0">' +
      '<div class="prj-top"><span class="prj-code">' + esc(p.code) + '</span>' + statBadge(p.statut) + pubBadge(p) + '<span class="spacer"></span>' + meteoPill(p) + '</div>' +
      '<div><h3>' + esc(p.nom) + '</h3><div class="small muted" style="margin-top:4px">' + esc(p.partenaire || '—') + ' · ' + esc(E.empName(p.responsable)) + '</div></div>' +
      '<div class="prj-av"><div class="prj-av__lbl"><b>' + (p.avancement || 0) + ' %</b><span>réalisé</span>' + (pl != null && p.statut !== 'Terminé' ? '<span class="spacer"></span><span>prévu ' + pl + ' %</span>' : '') + '</div>' +
      '<div class="progress ' + (p.avancement >= 100 ? 'green' : late ? 'orange' : '') + '"><i style="width:' + (p.avancement || 0) + '%"></i></div></div>' +
      '<div class="prj-stats"><div><span>Budget</span><b>' + F.pct(cons) + '</b><small>' + F.short(p.engage) + ' / ' + F.short(p.budget) + '</small></div>' +
      '<div><span>Prochain jalon</span><b>' + (nj ? F.date(nj.d) : '—') + '</b><small title="' + esc(nj ? nj.t : '') + '">' + esc(nj ? nj.t : 'Tous atteints') + '</small></div>' +
      '<div><span>Échéance</span><b>' + F.date(p.fin) + '</b><small>' + (p.statut === 'Terminé' ? 'achevé' : rest >= 0 ? 'dans ' + rest + ' j' : 'dépassée de ' + (-rest) + ' j') + '</small></div></div>' +
      (alertTxt.length && p.statut !== 'Terminé' ? '<div class="prj-alert">' + E.icon('alert') + esc(alertTxt.join(' · ')) + '</div>' : '') +
      '</article>';
  }

  function filtered() {
    var q = E.norm(flt.q);
    return all().filter(function (p) {
      if (flt.vue === 'publics' && !p.public) return false;
      if (flt.vue === 'internes' && p.public) return false;
      if (flt.vue === 'retard' && !isLate(p)) return false;
      if (flt.statut && p.statut !== flt.statut) return false;
      if (q && E.norm(p.nom + ' ' + p.code + ' ' + p.id + ' ' + p.partenaire + ' ' + E.empName(p.responsable)).indexOf(q) < 0) return false;
      return true;
    });
  }

  function renderPortefeuille(view) {
    var P = all();
    view.innerHTML = topTabs('portefeuille') +
      '<div class="section-title" style="margin-bottom:14px"><div><h2>Portefeuille de projets</h2><p>Infrastructures portuaires, équipements et projets internes d\'Owendo et de Port-Gentil — suivi de l\'avancement, des coûts et des risques.</p></div><span class="spacer"></span>' +
      '<button class="btn" id="pj-csv">' + E.icon('download') + 'Exporter</button><button class="btn primary" id="pj-new">' + E.icon('plus') + 'Nouveau projet</button></div>' +
      kpiRow() +
      '<div class="filters" style="margin-top:18px"><div class="chips" id="pj-vue">' + [['tous', 'Tous', P.length], ['publics', 'Visibles sur le site', P.filter(function (p) { return p.public; }).length], ['internes', 'Internes', P.filter(function (p) { return !p.public; }).length], ['retard', 'En retard', P.filter(isLate).length]].map(function (c) { return '<button class="chip' + (flt.vue === c[0] ? ' is-active' : '') + '" data-v="' + c[0] + '">' + c[1] + ' · ' + c[2] + '</button>'; }).join('') + '</div>' +
      '<span class="spacer"></span><select class="select" id="pj-st"><option value="">Tous les statuts</option>' + STATUTS.map(function (s) { return '<option' + (flt.statut === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
      '<input class="input" id="pj-q" type="search" placeholder="Rechercher un projet…" value="' + esc(flt.q) + '"></div>' +
      '<div id="pj-cards"></div>';
    function draw() {
      var L = filtered();
      E.$('#pj-cards', view).innerHTML = L.length ? '<div class="prj-grid">' + L.map(card).join('') + '</div>' : '<div class="card empty">Aucun projet ne correspond à ces critères.</div>';
    }
    draw();
    E.$('#pj-vue', view).addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (!b) return; flt.vue = b.dataset.v; E.$$('#pj-vue .chip', view).forEach(function (c) { c.classList.toggle('is-active', c === b); }); draw(); });
    E.$('#pj-st', view).onchange = function (e) { flt.statut = e.target.value; draw(); };
    E.$('#pj-q', view).oninput = function (e) { flt.q = e.target.value; draw(); };
    E.$('#pj-cards', view).addEventListener('click', function (e) { var c = e.target.closest('.prj-card'); if (c) E.go('projets/' + c.dataset.id); });
    E.$('#pj-cards', view).addEventListener('keydown', function (e) { var c = e.target.closest('.prj-card'); if (c && e.key === 'Enter') E.go('projets/' + c.dataset.id); });
    E.$('#pj-new', view).onclick = newProject;
    E.$('#pj-csv', view).onclick = function () {
      U.exportCSV('portefeuille-projets', [{ label: 'Réf.', key: 'id' }, { label: 'Code', key: 'code' }, { label: 'Projet', key: 'nom' }, { label: 'Statut', key: 'statut' }, { label: 'Public', csv: function (p) { return p.public ? 'Oui' : 'Non'; } }, { label: 'Responsable', csv: function (p) { return E.empName(p.responsable); } }, { label: 'Début', key: 'debut' }, { label: 'Fin', key: 'fin' }, { label: 'Avancement %', key: 'avancement' }, { label: 'Prévu %', csv: function (p) { return planned(p); } }, { label: 'Budget FCFA', key: 'budget' }, { label: 'Engagé FCFA', key: 'engage' }, { label: 'Météo', csv: function (p) { return meteo(p).l; } }], filtered());
    };
  }

  /* ------------------------------------------------------------------ planning global */
  function renderPlanning(view, pid, unit) {
    var P = all().slice().sort(function (a, b) { return a.debut < b.debut ? -1 : 1; });
    var sel = pid !== 'ALL' && get(pid) ? [get(pid)] : P;
    unit = unit || planUnit || (sel.length > 1 ? 'quarter' : 'month');
    var rows = [];
    sel.forEach(function (p) {
      rows.push({ label: p.code + ' — ' + p.nom, sub: p.statut + ' · ' + (p.avancement || 0) + ' % · ' + E.empName(p.responsable), start: p.debut, end: p.fin, progress: p.avancement || 0, group: true,
        milestones: (p.jalons || []).map(function (j) { return { date: j.d, label: j.t, done: j.fait }; }), onClick: function () { E.go('projets/' + p.id); } });
      (p.taches || []).slice().sort(function (a, b) { return a.s < b.s ? -1 : 1; }).forEach(function (t) {
        rows.push({ label: t.t, sub: t.lot + (t.resp ? ' · ' + E.empName(t.resp) : ''), start: t.s, end: t.e, progress: +t.p || 0, onClick: function () { E.go('projets/' + p.id + '/taches'); } });
      });
    });
    var from = sel.reduce(function (m, p) { return !m || p.debut < m ? p.debut : m; }, null), to = sel.reduce(function (m, p) { return !m || p.fin > m ? p.fin : m; }, null);
    var t = today(), t90 = E.addDays(t, 90), up = [];
    sel.forEach(function (p) { (p.jalons || []).forEach(function (j) { if (!j.fait && j.d <= t90) up.push({ p: p, j: j }); }); });
    up.sort(function (a, b) { return a.j.d < b.j.d ? -1 : 1; });
    view.innerHTML = topTabs('planning') +
      '<div class="card"><div class="card__h"><h3>Planning multi-projets</h3><span class="sub">' + sel.length + ' projet(s) · ' + (rows.length - sel.length) + ' tâches · cliquez une barre pour ouvrir le projet</span><span class="spacer"></span>' +
      '<select class="select" id="pl-p" style="width:auto;max-width:100%"><option value="ALL">Tous les projets</option>' + P.map(function (p) { return '<option value="' + p.id + '"' + (p.id === pid ? ' selected' : '') + '>' + esc(p.code + ' — ' + p.nom) + '</option>'; }).join('') + '</select>' +
      '<div class="prj-seg" id="pl-u"><button data-u="month" class="' + (unit === 'month' ? 'is-active' : '') + '">Mois</button><button data-u="quarter" class="' + (unit === 'quarter' ? 'is-active' : '') + '">Trimestre</button></div></div>' +
      U.gantt({ rows: rows, from: from, to: to, unit: unit, title: 'Projet / tâche' }) + '</div>' +
      '<div class="grid g2 stack-m" style="margin-top:16px"><div class="card"><div class="card__h"><h3>Jalons des 90 prochains jours</h3><span class="sub">et jalons dépassés</span></div><div class="list">' +
      (up.length ? up.map(function (x) { var late = x.j.d < t; return '<a class="list__item" href="#/projets/' + x.p.id + '/jalons" style="color:inherit"><div class="list__icon ' + (late ? 'tone-red' : 'tone-yellow') + '">' + E.icon('flag') + '</div><div class="list__body"><b>' + esc(x.j.t) + '</b><div class="small muted">' + esc(x.p.code) + ' · ' + F.date(x.j.d) + (late ? ' · <span class="down">dépassé de ' + E.daysBetween(x.j.d, t) + ' j</span>' : ' · dans ' + E.daysBetween(t, x.j.d) + ' j') + '</div></div></a>'; }).join('') : '<div class="empty">Aucun jalon dans les 90 prochains jours.</div>') +
      '</div></div><div class="card"><div class="card__h"><h3>Charge par projet</h3><span class="sub">tâches en cours ce mois-ci</span></div><div class="card__b">' + chargeBars(sel) + '</div></div></div>';
    E.$('#pl-p', view).onchange = function (e) { planUnit = null; E.go('projets/planning/' + e.target.value); };
    E.$('#pl-u', view).addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; planUnit = b.dataset.u; renderPlanning(view, pid, b.dataset.u); });
  }
  function chargeBars(list) {
    var t = today();
    var data = list.filter(isActive).map(function (p) { return { p: p, n: (p.taches || []).filter(function (x) { return x.s <= t && x.e >= E.addDays(t, -30) && (+x.p || 0) < 100; }).length, late: lateTasks(p).length }; });
    if (!data.length) return '<div class="empty">Aucun projet actif.</div>';
    var max = Math.max.apply(null, data.map(function (d) { return d.n; }).concat([1]));
    return '<div class="stack" style="gap:12px">' + data.map(function (d) { return '<div><div class="row" style="justify-content:space-between;margin-bottom:5px"><b class="small">' + esc(d.p.code) + ' <span class="muted" style="font-weight:500">' + esc(d.p.nom.length > 44 ? d.p.nom.slice(0, 42) + '…' : d.p.nom) + '</span></b><span class="small">' + d.n + ' en cours' + (d.late ? ' · <span class="down">' + d.late + ' en retard</span>' : '') + '</span></div><div class="progress ' + (d.late ? 'orange' : '') + '"><i style="width:' + (d.n / max * 100) + '%"></i></div></div>'; }).join('') + '</div>';
  }

  /* ------------------------------------------------------------------ fiche projet */
  var TABS = [['synthese', 'Synthèse'], ['planning', 'Planning'], ['taches', 'Tâches'], ['jalons', 'Jalons'], ['risques', 'Risques'], ['budget', 'Budget'], ['journal', 'Journal']];
  function renderFiche(view, p, tab) {
    var late = isLate(p);
    var tabs = TABS.map(function (t) {
      var n = t[0] === 'taches' ? (p.taches || []).length : t[0] === 'jalons' ? (p.jalons || []).length : t[0] === 'risques' ? (p.risques || []).filter(function (r) { return r.statut !== 'Clos'; }).length : t[0] === 'journal' ? (p.journal || []).length : null;
      return { k: t[0], l: t[1], n: n };
    });
    view.innerHTML =
      '<div class="card prj-head"><div class="card__b">' +
      '<a class="prj-back" href="#/projets">' + E.icon('back') + 'Portefeuille de projets</a>' +
      '<div class="prj-head__main" style="margin-top:10px"><div class="prj-head__txt"><div class="prj-top"><span class="prj-code">' + esc(p.code) + '</span>' + statBadge(p.statut) + pubBadge(p) + meteoPill(p) + (late && p.statut !== 'Terminé' ? U.badge('En retard', 'red') : '') + '</div>' +
      '<h2>' + esc(p.nom) + '</h2><p>' + esc(p.resume || '') + '</p>' +
      '<div class="prj-meta"><span>Réf. <b>' + p.id + '</b></span><span>Partenaire <b>' + esc(p.partenaire || '—') + '</b></span><span>Responsable <b>' + esc(E.empName(p.responsable)) + '</b></span><span>Période <b>' + F.date(p.debut) + ' → ' + F.date(p.fin) + '</b></span><span>Budget <b>' + F.short(p.budget) + ' FCFA</b></span></div></div>' +
      ring(p.avancement || 0, 118, p.avancement >= 100 ? '#1e9e4a' : late ? '#e8780c' : '#163b75') + '</div>' +
      '<div class="prj-actions"><button class="btn accent" id="pf-pub">' + E.icon('globe') + (p.public ? 'Retirer du site' : 'Publier sur le site') + '</button>' +
      '<button class="btn line" id="pf-edit">' + E.icon('edit') + 'Modifier</button><button class="btn line" id="pf-task">' + E.icon('plus') + 'Tâche</button>' +
      (p.public ? '<a class="btn line" href="../index.html#projets" target="_blank" rel="noopener">' + E.icon('eye') + 'Voir sur le site</a>' : '') + '</div>' +
      '</div></div>' +
      '<div style="margin-top:16px">' + U.tabs(tabs, tab, function (k) { E.go('projets/' + p.id + '/' + k); }) + '</div><div id="pf-body"></div>';
    var body = E.$('#pf-body', view);
    ({ synthese: tSynthese, planning: tPlanning, taches: tTaches, jalons: tJalons, risques: tRisques, budget: tBudget, journal: tJournal }[tab] || tSynthese)(body, p);
    E.$('#pf-pub', view).onclick = function () { publish(p); };
    E.$('#pf-edit', view).onclick = function () { editProject(p); };
    E.$('#pf-task', view).onclick = function () { editTask(p, null); };
  }

  function sCurve(p) {
    var a = mIdx(p.debut), b = mIdx(p.fin), now = mIdx(today()), labels = [], pv = [], rv = [];
    var reel = (p.courbe && p.courbe.reel || []).slice();
    if (p.statut !== 'Terminé' || now <= b) reel = reel.filter(function (k) { return mIdx(k[0] + '-01') < now; }).concat([[ymOf(Math.min(now, b)), p.avancement || 0]]);
    for (var i = a; i <= b; i++) { labels.push(mLabel(i)); pv.push(Math.round(interp(p.courbe ? p.courbe.prevu : [[ymOf(a), 0], [ymOf(b), 100]], i))); if (i <= now) rv.push(Math.round(interp(reel, i))); }
    return U.line({ labels: labels, height: 230, series: [{ name: 'Prévu (référence)', values: pv, color: '#94a3b8', dash: true }, { name: 'Réalisé', values: rv, color: '#163b75' }] });
  }

  function tSynthese(el, p) {
    var pl = planned(p), ec = ecart(p), T = p.taches || [], done = T.filter(function (t) { return (+t.p || 0) >= 100; }).length;
    var rest = E.daysBetween(today(), p.fin), BL = p.budgetLignes || [];
    var nj = (p.jalons || []).filter(function (j) { return !j.fait; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; }).slice(0, 4);
    var R = (p.risques || []).filter(function (r) { return r.statut !== 'Clos'; }).sort(function (a, b) { return score(b) - score(a); }).slice(0, 3);
    el.innerHTML =
      '<div class="grid g-2-1"><div class="card"><div class="card__h"><h3>Courbe d\'avancement</h3><span class="sub">courbe en S · prévu / réalisé</span></div><div class="card__b prj-ch">' + sCurve(p) + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Situation à date</h3><span class="spacer"></span>' + meteoPill(p) + '</div><div class="card__b">' + U.gauge(p.avancement || 0, 'avancement physique réalisé', p.avancement >= 100 ? '#1e9e4a' : ec <= -8 ? '#e8780c' : '#163b75') +
      '<dl class="prj-kv" style="margin-top:16px"><dt>Prévu à date</dt><dd>' + (pl == null ? '—' : pl + ' %') + '</dd><dt>Écart</dt><dd class="' + (ec < 0 ? 'down' : 'up') + '">' + (ec > 0 ? '+' : '') + ec + ' pts</dd>' +
      '<dt>Tâches terminées</dt><dd>' + done + ' / ' + T.length + '</dd><dt>Tâches en retard</dt><dd class="' + (lateTasks(p).length ? 'down' : '') + '">' + lateTasks(p).length + '</dd>' +
      '<dt>Budget consommé</dt><dd>' + F.pct(p.budget ? p.engage / p.budget * 100 : 0) + '</dd><dt>' + (p.statut === 'Terminé' ? 'Achevé le' : 'Fin prévue') + '</dt><dd>' + F.date(p.fin) + (p.statut !== 'Terminé' ? '<div class="small muted" style="font-weight:500">' + (rest >= 0 ? 'dans ' + rest + ' jours' : 'dépassée') + '</div>' : '') + '</dd></dl></div></div></div>' +
      '<div class="grid g2 stack-m" style="margin-top:16px"><div class="card"><div class="card__h"><h3>Budget par lot</h3><span class="sub">en FCFA</span><span class="spacer"></span><a class="btn ghost sm" href="#/projets/' + p.id + '/budget">Détail ' + E.icon('arrow') + '</a></div><div class="card__b prj-ch">' +
      (BL.length ? U.bars({ labels: BL.map(function (l) { return l.lot.length > 16 ? l.lot.slice(0, 15) + '…' : l.lot; }), series: [{ name: 'Budget', values: BL.map(function (l) { return l.budget; }), color: '#c9d6ea' }, { name: 'Engagé', values: BL.map(function (l) { return l.engage; }), color: '#163b75' }, { name: 'Facturé', values: BL.map(function (l) { return l.facture; }), color: '#1e9e4a' }], height: 220, money: true }) : '<div class="empty">Aucune ligne budgétaire.</div>') + '</div></div>' +
      '<div class="stack"><div class="card"><div class="card__h"><h3>Prochains jalons</h3><span class="spacer"></span><a class="btn ghost sm" href="#/projets/' + p.id + '/jalons">Tous ' + E.icon('arrow') + '</a></div><div class="list">' +
      (nj.length ? nj.map(function (j) { var l = j.d < today(); return '<div class="list__item"><div class="list__icon ' + (l ? 'tone-red' : 'tone-yellow') + '">' + E.icon('flag') + '</div><div class="list__body"><b>' + esc(j.t) + '</b><div class="small muted">' + F.date(j.d) + (l ? ' · <span class="down">dépassé</span>' : ' · dans ' + E.daysBetween(today(), j.d) + ' j') + '</div></div></div>'; }).join('') : '<div class="empty">Tous les jalons sont atteints.</div>') + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Risques majeurs</h3><span class="spacer"></span><a class="btn ghost sm" href="#/projets/' + p.id + '/risques">Matrice ' + E.icon('arrow') + '</a></div><div class="list">' +
      (R.length ? R.map(function (r) { var s = score(r); return '<div class="list__item"><div class="list__icon tone-' + scoreTone(s) + '" style="font-weight:800">' + s + '</div><div class="list__body"><b>' + esc(r.titre) + '</b><div class="small muted">' + esc(r.mitigation || '') + '</div></div></div>'; }).join('') : '<div class="empty">Aucun risque ouvert.</div>') + '</div></div></div></div>' +
      '<div class="grid g2 stack-m" style="margin-top:16px"><div class="card"><div class="card__h"><h3>Équipe projet</h3><span class="sub">' + (p.equipe || []).length + ' personnes</span></div><div class="card__b prj-team">' +
      (p.equipe || []).map(function (id) { var e = E.emp(id); if (!e) return ''; return '<div>' + U.avatar(e.nom, null, true) + '<div style="min-width:0"><b class="small">' + esc(e.nom) + (id === p.responsable ? ' <span class="badge tone-navy plain">Responsable</span>' : '') + '</b><div class="small muted">' + esc(e.poste) + ' · ' + esc(E.dirName(e.direction)) + '</div></div></div>'; }).join('') + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Documents du projet</h3><span class="sub">GED</span></div><div class="list">' +
      ((p.documents || []).length ? p.documents.map(function (d) { return '<div class="list__item"><div class="list__icon ' + (d.type === 'PDF' ? 'tone-red' : 'tone-green') + '">' + E.icon('doc') + '</div><div class="list__body"><b>' + esc(d.nom) + '</b><div class="small muted">' + esc(d.type) + ' · déposé le ' + F.date(d.d) + '</div></div></div>'; }).join('') : '<div class="empty">Aucun document.</div>') + '</div></div></div>';
  }

  function tPlanning(el, p) {
    var groups = E.groupBy((p.taches || []).slice().sort(function (a, b) { return a.s < b.s ? -1 : 1; }), 'lot'), rows = [];
    rows.push({ label: 'Jalons du projet', sub: (p.jalons || []).filter(function (j) { return j.fait; }).length + ' / ' + (p.jalons || []).length + ' atteints', milestones: (p.jalons || []).map(function (j) { return { date: j.d, label: j.t, done: j.fait }; }) });
    Object.keys(groups).forEach(function (lot) {
      var L = groups[lot], s = L.reduce(function (m, t) { return !m || t.s < m ? t.s : m; }, null), e = L.reduce(function (m, t) { return !m || t.e > m ? t.e : m; }, null);
      rows.push({ label: lot, sub: L.length + ' tâche(s)', start: s, end: e, group: true, progress: Math.round(E.sum(L, function (t) { return (+t.p || 0) * dur(t); }) / E.sum(L, dur)) });
      L.forEach(function (t) { rows.push({ label: t.t, sub: t.resp ? E.empName(t.resp) : '', start: t.s, end: t.e, progress: +t.p || 0, onClick: function () { editTask(p, (p.taches || []).indexOf(t)); } }); });
    });
    el.innerHTML = '<div class="card"><div class="card__h"><h3>Planning du projet</h3><span class="sub">cliquez une barre pour modifier la tâche</span><span class="spacer"></span><div class="prj-seg" id="pp-u">' + [['week', 'Semaine'], ['month', 'Mois'], ['quarter', 'Trimestre']].map(function (u) { return '<button data-u="' + u[0] + '" class="' + (ficheUnit === u[0] ? 'is-active' : '') + '">' + u[1] + '</button>'; }).join('') + '</div></div>' +
      U.gantt({ rows: rows, from: p.debut, to: p.fin, unit: ficheUnit, title: 'Lot / tâche' }) + '</div>';
    E.$('#pp-u', el).addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { ficheUnit = b.dataset.u; tPlanning(el, p); } });
  }

  function tTaches(el, p) {
    var T = p.taches || [];
    var cols = [
      { label: 'Tâche', render: function (t) { return '<b>' + esc(t.t) + '</b><div class="small muted">' + esc(t.lot || '') + '</div>'; } },
      { label: 'Responsable', render: function (t) { return t.resp ? esc(E.empName(t.resp)) : ''; } },
      { label: 'Début', render: function (t) { return F.dateShort(t.s); }, cls: 'nowrap' },
      { label: 'Fin', render: function (t) { return F.dateShort(t.e); }, cls: 'nowrap' },
      { label: 'Durée', num: true, render: function (t) { return dur(t) + ' j'; } },
      { label: 'Avancement', render: function (t) { var i = T.indexOf(t); return '<div class="prj-range"><input type="range" min="0" max="100" step="5" value="' + (+t.p || 0) + '" data-ti="' + i + '" aria-label="Avancement de ' + esc(t.t) + '"><output>' + (+t.p || 0) + ' %</output></div>'; } },
      { label: 'Statut', render: function (t) { var s = taskStatus(t); return U.badge(s[0], s[1]); } },
      { label: '', render: function (t) { var i = T.indexOf(t); return '<span class="nowrap"><button class="btn ghost sm" data-ed="' + i + '" aria-label="Modifier">' + E.icon('edit') + '</button><button class="btn ghost sm" data-del="' + i + '" aria-label="Supprimer">' + E.icon('trash') + '</button></span>'; } }
    ];
    el.innerHTML = '<div class="alert tone-blue" style="margin-bottom:14px">' + E.icon('info') + '<div>Faites glisser le curseur pour mettre à jour l\'avancement d\'une tâche : l\'avancement global du projet est recalculé automatiquement (moyenne pondérée par la durée des tâches)' + (p.public ? ' et <b>mis à jour sur le site public</b>.' : '.') + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Tâches</h3><span class="sub">' + T.length + ' tâches · avancement calculé ' + calcAv(p) + ' %</span><span class="spacer"></span><button class="btn sm" id="pt-csv">' + E.icon('download') + 'CSV</button><button class="btn primary sm" id="pt-add">' + E.icon('plus') + 'Ajouter une tâche</button></div>' +
      U.table(cols, T.slice().sort(function (a, b) { return a.s < b.s ? -1 : 1; }), { empty: 'Aucune tâche. Ajoutez la première tâche du projet.' }) + '</div>';
    E.$$('input[type=range]', el).forEach(function (r) {
      r.addEventListener('input', function () { r.nextElementSibling.textContent = r.value + ' %'; });
      r.addEventListener('change', function () { setTaskProgress(p, +r.dataset.ti, +r.value); });
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ed]'); if (b) return editTask(p, +b.dataset.ed);
      b = e.target.closest('[data-del]'); if (b) { var t = T[+b.dataset.del]; U.confirm('Supprimer la tâche', 'Supprimer « ' + esc(t.t) + ' » du planning ?', 'Supprimer', function () { T.splice(+b.dataset.del, 1); applyAv(p, 'Tâche supprimée : ' + t.t); }, 'danger'); }
    });
    E.$('#pt-add', el).onclick = function () { editTask(p, null); };
    E.$('#pt-csv', el).onclick = function () { U.exportCSV('taches-' + p.code, [{ label: 'Tâche', key: 't' }, { label: 'Lot', key: 'lot' }, { label: 'Responsable', csv: function (t) { return E.empName(t.resp); } }, { label: 'Début', key: 's' }, { label: 'Fin', key: 'e' }, { label: 'Avancement %', key: 'p' }, { label: 'Statut', csv: function (t) { return taskStatus(t)[0]; } }], T); };
  }
  function applyAv(p, what) {
    var old = p.avancement || 0, nv = calcAv(p), patch = { taches: p.taches, avancement: nv };
    if (nv >= 100 && p.statut !== 'Terminé') { patch.statut = 'Terminé'; E.notify('Projet achevé', p.code + ' — ' + p.nom, '#/projets/' + p.id, 'green'); }
    S.update(COL, p.id, patch);
    E.log('Mise à jour du planning ' + p.code, what + ' — avancement projet ' + old + ' % → ' + nv + ' %', 'projets');
    U.toast(old !== nv ? 'Avancement du projet recalculé : ' + old + ' % → ' + nv + ' %' + publicNote(p) : 'Tâche enregistrée');
    refresh();
  }
  function setTaskProgress(p, i, v) { var t = p.taches[i]; if (!t) return; var o = t.p; t.p = v; applyAv(p, '« ' + t.t + ' » ' + o + ' % → ' + v + ' %'); }

  function editTask(p, i) {
    var t = i != null ? p.taches[i] : null, lots = [];
    (p.taches || []).forEach(function (x) { if (x.lot && lots.indexOf(x.lot) < 0) lots.push(x.lot); });
    U.formModal({ title: t ? 'Modifier la tâche' : 'Nouvelle tâche', sub: p.code + ' — ' + p.nom, okLabel: t ? 'Enregistrer' : 'Ajouter la tâche',
      fields: [{ name: 't', label: 'Intitulé de la tâche', required: true, full: true, placeholder: 'Ex. Épreuve hydraulique du bac' },
        { name: 'lot', label: 'Lot / phase', required: true, placeholder: lots.slice(0, 3).join(', ') || 'Ingénierie' },
        { name: 'resp', label: 'Responsable', type: 'select', empty: '— Non affecté —', options: empOpts() },
        { name: 's', label: 'Début', type: 'date', required: true }, { name: 'e', label: 'Fin', type: 'date', required: true },
        { name: 'p', label: 'Avancement (%)', type: 'number', min: 0, step: 5 }],
      values: t ? { t: t.t, lot: t.lot, resp: t.resp || '', s: t.s, e: t.e, p: t.p } : { lot: lots[0] || '', s: today(), e: E.addDays(today(), 30), p: 0 },
      onSubmit: function (v) {
        if (v.e < v.s) { U.toast('La date de fin doit suivre la date de début.', 'err'); return false; }
        var o = { t: v.t, lot: v.lot, resp: v.resp || '', s: v.s, e: v.e, p: Math.max(0, Math.min(100, +v.p || 0)) };
        p.taches = p.taches || [];
        if (t) Object.assign(t, o); else p.taches.push(o);
        applyAv(p, (t ? 'Tâche modifiée : ' : 'Tâche ajoutée : ') + o.t);
      } });
  }

  function tJalons(el, p) {
    var J = (p.jalons || []).map(function (j, i) { return { j: j, i: i }; }).sort(function (a, b) { return a.j.d < b.j.d ? -1 : 1; }), t = today();
    el.innerHTML = (p.public ? '<div class="alert tone-yellow" style="margin-bottom:14px">' + E.icon('globe') + '<div>Ces jalons sont <b>affichés sur la page Projets du site public</b>. Marquer un jalon comme atteint le fait apparaître instantanément comme « réalisé » pour les visiteurs.</div></div>' : '') +
      '<div class="card"><div class="card__h"><h3>Jalons</h3><span class="sub">' + J.filter(function (x) { return x.j.fait; }).length + ' atteints sur ' + J.length + '</span><span class="spacer"></span><button class="btn primary sm" id="pj-add">' + E.icon('plus') + 'Ajouter un jalon</button></div>' +
      (J.length ? J.map(function (x) {
        var j = x.j, late = !j.fait && j.d < t, dd = E.daysBetween(t, j.d);
        return '<div class="prj-jal"><span class="prj-jal__d' + (j.fait ? ' done' : late ? ' late' : '') + '"></span><div class="prj-jal__b"><b>' + esc(j.t) + '</b><div class="small muted">' + F.date(j.d) + ' · ' + (j.fait ? 'réalisé' + (j.le ? ' (validé le ' + F.date(j.le) + ')' : '') : late ? '<span class="down">dépassé de ' + (-dd) + ' jours</span>' : 'dans ' + dd + ' jours') + '</div></div>' +
          (j.fait ? U.badge('Atteint', 'green') + '<button class="btn ghost sm" data-undo="' + x.i + '">Rouvrir</button>' : (late ? U.badge('En retard', 'red') : U.badge('À venir', 'yellow')) + '<button class="btn success sm" data-ok="' + x.i + '">' + E.icon('check') + 'Marquer comme atteint</button>') + '</div>';
      }).join('') : '<div class="empty">Aucun jalon défini.</div>') + '</div>';
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ok]');
      if (b) { var j = p.jalons[+b.dataset.ok]; U.confirm('Jalon atteint', 'Confirmer que le jalon « <b>' + esc(j.t) + '</b> » est atteint ?' + (p.public ? '<br><br><span class="small muted">Il apparaîtra comme réalisé sur le site public.</span>' : ''), 'Confirmer', function () {
        j.fait = true; j.le = today(); S.update(COL, p.id, { jalons: p.jalons });
        E.log('Jalon atteint', p.code + ' — ' + j.t, 'projets'); E.notify('Jalon atteint', p.code + ' — ' + j.t, '#/projets/' + p.id + '/jalons', 'green');
        U.toast('Jalon marqué comme atteint' + publicNote(p)); refresh();
      }, 'success'); return; }
      b = e.target.closest('[data-undo]');
      if (b) { var k = p.jalons[+b.dataset.undo]; k.fait = false; delete k.le; S.update(COL, p.id, { jalons: p.jalons }); E.log('Jalon rouvert', p.code + ' — ' + k.t, 'projets'); U.toast('Jalon rouvert'); refresh(); }
    });
    E.$('#pj-add', el).onclick = function () {
      U.formModal({ title: 'Nouveau jalon', sub: p.code + ' — ' + p.nom, fields: [{ name: 't', label: 'Intitulé du jalon', required: true, full: true }, { name: 'd', label: 'Date', type: 'date', required: true }, { name: 'fait', label: 'État', type: 'select', options: [{ v: '0', l: 'À venir' }, { v: '1', l: 'Déjà atteint' }] }], values: { d: E.addDays(today(), 30) },
        onSubmit: function (v) { p.jalons = p.jalons || []; p.jalons.push({ d: v.d, t: v.t, fait: v.fait === '1' }); S.update(COL, p.id, { jalons: p.jalons }); E.log('Jalon ajouté', p.code + ' — ' + v.t, 'projets'); U.toast('Jalon ajouté' + publicNote(p)); refresh(); } });
    };
  }

  function tRisques(el, p) {
    var R = p.risques || [], open = R.filter(function (r) { return r.statut !== 'Clos'; });
    var m = '<div class="prj-matrix">';
    for (var imp = 5; imp >= 1; imp--) {
      m += '<div class="ax">' + imp + '</div>';
      for (var pr = 1; pr <= 5; pr++) {
        var here = open.filter(function (r) { return +r.impact === imp && +r.probabilite === pr; });
        m += '<div class="c h-' + scoreTone(imp * pr) + '" title="Probabilité ' + pr + ' × Impact ' + imp + ' = ' + imp * pr + '">' + here.map(function (r) { return '<i title="' + esc(r.titre) + '">' + r.id + '</i>'; }).join('') + '</div>';
      }
    }
    m += '<div></div>' + [1, 2, 3, 4, 5].map(function (i) { return '<div class="ax">' + i + '</div>'; }).join('') + '</div>' +
      '<div class="row small muted" style="justify-content:space-between;margin-top:8px"><span>↑ Impact</span><span>Probabilité →</span></div>' +
      '<div class="legend" style="margin-top:10px"><span><i style="background:#d7f2e0"></i>Faible</span><span><i style="background:#fff3b0"></i>Modéré</span><span><i style="background:#ffd9b0"></i>Élevé</span><span><i style="background:#f9c0c0"></i>Critique</span></div>';
    var cols = [
      { label: 'N°', render: function (r) { return '<b>' + r.id + '</b>'; } },
      { label: 'Risque', render: function (r) { return '<b>' + esc(r.titre) + '</b><div class="small muted">' + esc(r.mitigation || '') + '</div>'; } },
      { label: 'P × I', num: true, render: function (r) { return r.probabilite + ' × ' + r.impact; } },
      { label: 'Criticité', render: function (r) { var s = score(r); return U.badge(String(s), scoreTone(s)); } },
      { label: 'Responsable', render: function (r) { return esc(E.empName(r.resp)); } },
      { label: 'Statut', render: function (r) { return U.badge(r.statut, { 'Ouvert': 'orange', 'Maîtrisé': 'blue', 'Clos': 'grey' }[r.statut]); } }
    ];
    el.innerHTML = '<div class="grid g-1-2"><div class="card"><div class="card__h"><h3>Matrice des risques</h3><span class="sub">' + open.length + ' risques non clos</span></div><div class="card__b">' + m + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Registre des risques</h3><span class="spacer"></span><button class="btn primary sm" id="pr-add">' + E.icon('plus') + 'Nouveau risque</button></div>' +
      U.table(cols, R.slice().sort(function (a, b) { return (a.statut === 'Clos') - (b.statut === 'Clos') || score(b) - score(a); }), { onRow: function (r) { editRisk(p, r); }, empty: 'Aucun risque identifié.' }) + '</div></div>';
    E.$('#pr-add', el).onclick = function () { editRisk(p, null); };
  }
  function editRisk(p, r) {
    var sc = [1, 2, 3, 4, 5].map(function (i) { return { v: i, l: i + ' — ' + ['Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'][i - 1] }; });
    U.formModal({ title: r ? 'Risque ' + r.id : 'Nouveau risque', sub: p.code + ' — ' + p.nom,
      fields: [{ name: 'titre', label: 'Description du risque', required: true, full: true }, { name: 'probabilite', label: 'Probabilité', type: 'select', options: sc }, { name: 'impact', label: 'Impact', type: 'select', options: sc },
        { name: 'resp', label: 'Responsable', type: 'select', options: empOpts() }, { name: 'statut', label: 'Statut', type: 'select', options: ['Ouvert', 'Maîtrisé', 'Clos'] }, { name: 'mitigation', label: 'Plan de mitigation', type: 'textarea' }],
      values: r || { probabilite: 3, impact: 3, statut: 'Ouvert', resp: p.responsable },
      onSubmit: function (v) {
        v.probabilite = +v.probabilite; v.impact = +v.impact; p.risques = p.risques || [];
        if (r) Object.assign(r, v); else { v.id = 'R' + (p.risques.reduce(function (m, x) { return Math.max(m, +String(x.id).slice(1) || 0); }, 0) + 1); p.risques.push(v); }
        S.update(COL, p.id, { risques: p.risques }); E.log(r ? 'Risque modifié' : 'Risque ajouté', p.code + ' — ' + v.titre + ' (criticité ' + score(v) + ')', 'projets');
        if (!r && score(v) >= 15) E.notify('Nouveau risque critique', p.code + ' — ' + v.titre, '#/projets/' + p.id + '/risques', 'red');
        U.toast(r ? 'Risque mis à jour' : 'Risque ajouté au registre'); refresh();
      } });
  }

  function tBudget(el, p) {
    var BL = p.budgetLignes || [], b = E.sum(BL, 'budget'), en = E.sum(BL, 'engage'), fa = E.sum(BL, 'facture');
    var cols = [
      { label: 'Lot', render: function (l) { return '<b>' + esc(l.lot) + '</b>'; } },
      { label: 'Budget', num: true, render: function (l) { return F.money(l.budget); } },
      { label: 'Engagé', num: true, render: function (l) { return F.money(l.engage); } },
      { label: 'Facturé', num: true, render: function (l) { return F.money(l.facture); } },
      { label: 'Reste à engager', num: true, render: function (l) { var r = l.budget - l.engage; return '<span class="' + (r < 0 ? 'down' : '') + '">' + F.money(r) + '</span>'; } },
      { label: 'Consommation', render: function (l) { var c = l.budget ? l.engage / l.budget * 100 : 0; return '<div style="min-width:120px">' + U.progress(c, c > 100 ? 'red' : c > 90 ? 'orange' : '') + '</div>'; } }
    ];
    el.innerHTML = '<div class="grid g4">' + U.kpi({ label: 'Budget', value: F.short(b), unit: 'FCFA', icon: 'wallet', tone: 'navy' }) + U.kpi({ label: 'Engagé', value: F.short(en), unit: 'FCFA', icon: 'cart', tone: 'blue', foot: F.pct(b ? en / b * 100 : 0) + ' du budget' }) +
      U.kpi({ label: 'Facturé', value: F.short(fa), unit: 'FCFA', icon: 'invoice', tone: 'green', foot: F.pct(en ? fa / en * 100 : 0) + ' de l\'engagé' }) + U.kpi({ label: 'Reste à engager', value: F.short(b - en), unit: 'FCFA', icon: 'money', tone: b - en < 0 ? 'red' : 'orange' }) + '</div>' +
      '<div class="card" style="margin-top:16px"><div class="card__h"><h3>Lignes budgétaires</h3><span class="sub">cliquez une ligne pour la modifier</span><span class="spacer"></span><button class="btn sm" id="pb-csv">' + E.icon('download') + 'CSV</button><button class="btn primary sm" id="pb-add">' + E.icon('plus') + 'Ajouter une ligne</button></div>' +
      U.table(cols, BL, { onRow: function (l) { editLine(p, l); }, footer: function () { return '<td>Total</td><td class="num">' + F.money(b) + '</td><td class="num">' + F.money(en) + '</td><td class="num">' + F.money(fa) + '</td><td class="num">' + F.money(b - en) + '</td><td>' + U.progress(b ? en / b * 100 : 0) + '</td>'; } }) + '</div>' +
      '<div class="grid g2 stack-m" style="margin-top:16px"><div class="card"><div class="card__h"><h3>Répartition du budget</h3></div><div class="card__b">' + U.donut(BL.map(function (l) { return { label: l.lot, value: l.budget }; }), { money: true, center: F.short(b), sub: 'FCFA' }) + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Engagé vs facturé</h3></div><div class="card__b prj-ch">' + U.bars({ labels: BL.map(function (l) { return l.lot.length > 14 ? l.lot.slice(0, 13) + '…' : l.lot; }), series: [{ name: 'Engagé', values: BL.map(function (l) { return l.engage; }), color: '#163b75' }, { name: 'Facturé', values: BL.map(function (l) { return l.facture; }), color: '#1e9e4a' }], height: 200, money: true }) + '</div></div></div>';
    E.$('#pb-add', el).onclick = function () { editLine(p, null); };
    E.$('#pb-csv', el).onclick = function () { U.exportCSV('budget-' + p.code, [{ label: 'Lot', key: 'lot' }, { label: 'Budget', key: 'budget' }, { label: 'Engagé', key: 'engage' }, { label: 'Facturé', key: 'facture' }, { label: 'Reste à engager', csv: function (l) { return l.budget - l.engage; } }], BL); };
  }
  function editLine(p, l) {
    U.formModal({ title: l ? 'Ligne budgétaire' : 'Nouvelle ligne budgétaire', sub: p.code + ' — montants en FCFA',
      fields: [{ name: 'lot', label: 'Lot', required: true, full: true }, { name: 'budget', label: 'Budget', type: 'money', required: true }, { name: 'engage', label: 'Engagé (commandes passées)', type: 'money' }, { name: 'facture', label: 'Facturé', type: 'money' }],
      values: l || { engage: 0, facture: 0 },
      onSubmit: function (v) {
        var o = { lot: v.lot, budget: +v.budget || 0, engage: +v.engage || 0, facture: +v.facture || 0 };
        p.budgetLignes = p.budgetLignes || [];
        if (l) Object.assign(l, o); else p.budgetLignes.push(o);
        var nb = E.sum(p.budgetLignes, 'budget'), ne = E.sum(p.budgetLignes, 'engage');
        S.update(COL, p.id, { budgetLignes: p.budgetLignes, budget: nb, engage: ne });
        E.log('Budget projet mis à jour', p.code + ' — ' + o.lot + ' : engagé ' + F.money(o.engage), 'projets');
        if (nb && ne / nb > 0.9) E.notify('Budget projet consommé à ' + Math.round(ne / nb * 100) + ' %', p.code + ' — ' + p.nom, '#/projets/' + p.id + '/budget', 'orange');
        U.toast('Budget mis à jour : ' + F.short(ne) + ' engagés sur ' + F.short(nb)); refresh();
      } });
  }

  function tJournal(el, p) {
    var J = (p.journal || []).slice().sort(function (a, b) { return a.d < b.d ? 1 : -1; });
    el.innerHTML = '<div class="card"><div class="card__h"><h3>Journal du projet</h3><span class="sub">comptes rendus de réunion et faits marquants</span><span class="spacer"></span><button class="btn primary sm" id="pjn-add">' + E.icon('plus') + 'Nouveau compte rendu</button></div><div class="card__b">' +
      (J.length ? '<div class="timeline">' + J.map(function (j) {
        return '<div class="tl-item done"><div class="prj-cr"><div class="row small muted"><b style="display:inline;color:var(--ink)">' + F.date(j.d) + '</b>' + U.badge(j.type, j.type === 'Comité de pilotage' ? 'navy' : j.type === 'Revue technique' ? 'violet' : j.type === 'Réception' ? 'green' : 'blue') + '<span>par ' + esc(E.empName(j.auteur)) + '</span></div>' +
          '<h4>' + esc(j.titre) + '</h4><div style="font-size:13px;color:var(--ink-2)">' + esc(j.texte) + '</div>' +
          ((j.decisions || []).length ? '<div class="dec"><b class="small">Décisions et actions</b><ul>' + j.decisions.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul></div>' : '') + '</div></div>';
      }).join('') + '</div>' : '<div class="empty">Aucun compte rendu. Ajoutez le premier.</div>') + '</div></div>';
    E.$('#pjn-add', el).onclick = function () {
      var u = E.session.user(), me = S.all('employes').find(function (e) { return u && E.norm(e.nom).indexOf(E.norm(u.name.split(' ').slice(-1)[0])) >= 0; });
      U.formModal({ title: 'Nouveau compte rendu', sub: p.code + ' — ' + p.nom,
        fields: [{ name: 'd', label: 'Date', type: 'date', required: true }, { name: 'type', label: 'Type', type: 'select', options: ['Comité de pilotage', 'Réunion de chantier', 'Revue technique', 'Réception', 'Note'] }, { name: 'titre', label: 'Titre', required: true, full: true },
          { name: 'auteur', label: 'Rédacteur', type: 'select', options: empOpts() }, { name: 'texte', label: 'Compte rendu', type: 'textarea', required: true }, { name: 'decisions', label: 'Décisions / actions (une par ligne)', type: 'textarea' }],
        values: { d: today(), type: 'Réunion de chantier', auteur: me ? me.id : p.responsable },
        onSubmit: function (v) {
          p.journal = p.journal || [];
          p.journal.push({ id: p.id + '-CR' + (p.journal.length + 1), d: v.d, type: v.type, auteur: v.auteur, titre: v.titre, texte: v.texte, decisions: String(v.decisions || '').split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean) });
          S.update(COL, p.id, { journal: p.journal }); E.log('Compte rendu ajouté', p.code + ' — ' + v.titre, 'projets'); U.toast('Compte rendu enregistré'); refresh();
        } });
    };
  }

  /* ------------------------------------------------------------------ actions projet */
  function publish(p) {
    var nj = (p.jalons || []).length;
    var body = p.public
      ? '<p style="margin-top:0">Le projet <b>' + esc(p.nom) + '</b> est actuellement affiché sur la page <b>Projets</b> du site public.</p><p>En le retirant, il disparaîtra immédiatement du site. Les données restent conservées ici.</p>'
      : '<p style="margin-top:0">La page <b>Projets</b> du site public affichera automatiquement :</p><div class="prj-pubbox"><div class="prj-top"><span class="prj-code">' + esc(p.code) + '</span>' + statBadge(p.statut) + '</div><b style="display:block;margin:8px 0 4px">' + esc(p.nom) + '</b><div class="small muted">Partenaire : ' + esc(p.partenaire || '—') + '</div><div style="margin:10px 0">' + U.progress(p.avancement || 0) + '</div><div class="small">' + nj + ' jalon(s) · fin visée ' + F.month(p.fin) + '</div></div>' +
        '<p class="small muted" style="margin-bottom:0">Publiés : nom, résumé, partenaire, statut, avancement, jalons et date de fin — mis à jour en temps réel à chaque modification. <b>Restent internes</b> : budget, risques, équipe, comptes rendus et documents.</p>';
    U.modal({ title: p.public ? 'Retirer du site public' : 'Publier sur le site public', sub: p.code + ' — ' + p.id, size: 'sm', body: body,
      actions: [{ label: 'Annuler' }, { label: p.public ? 'Retirer du site' : 'Publier', cls: p.public ? 'danger' : 'accent', icon: 'globe', onClick: function (close) {
        close(); var nv = !p.public; S.update(COL, p.id, { public: nv });
        E.log(nv ? 'Projet publié sur le site' : 'Projet retiré du site', p.code + ' — ' + p.nom, 'projets');
        E.notify(nv ? 'Projet publié sur le site' : 'Projet retiré du site', p.code + ' — ' + p.nom, '#/projets/' + p.id, nv ? 'green' : 'grey');
        U.toast(nv ? 'Projet visible sur la page Projets du site public' : 'Projet retiré du site public'); refresh();
      } }] });
  }
  function projectFields() {
    return [{ name: 'code', label: 'Code court', required: true, placeholder: 'Ex. QUAI-P2' }, { name: 'statut', label: 'Statut', type: 'select', options: STATUTS },
      { name: 'nom', label: 'Intitulé du projet', required: true, full: true }, { name: 'partenaire', label: 'Partenaire / entreprise', placeholder: 'Ex. Estuaire Marine Services' },
      { name: 'responsable', label: 'Responsable', type: 'select', options: empOpts() }, { name: 'debut', label: 'Début', type: 'date', required: true }, { name: 'fin', label: 'Fin prévue', type: 'date', required: true },
      { name: 'meteo', label: 'Météo projet', type: 'select', options: [{ v: 'soleil', l: 'Au vert' }, { v: 'nuage', l: 'Vigilance' }, { v: 'orage', l: 'Critique' }] }, { name: 'budget', label: 'Budget (FCFA)', type: 'money' },
      { name: 'resume', label: 'Résumé (affiché sur le site si le projet est publié)', type: 'textarea' }];
  }
  function newProject() {
    U.formModal({ title: 'Nouveau projet', sub: 'Le projet est créé en interne ; vous pourrez le publier sur le site ensuite.', okLabel: 'Créer le projet', fields: projectFields(),
      values: { statut: 'Études', debut: today(), fin: E.addDays(today(), 365), meteo: 'soleil', responsable: M(0) },
      onSubmit: function (v) {
        if (v.fin <= v.debut) { U.toast('La date de fin doit suivre la date de début.', 'err'); return false; }
        var a = mIdx(v.debut), b = mIdx(v.fin), q = function (f) { return ymOf(Math.round(a + (b - a) * f)); };
        var p = { id: nextId(), code: String(v.code).toUpperCase(), nom: v.nom, public: false, resume: v.resume || '', partenaire: v.partenaire || '', debut: v.debut, fin: v.fin, avancement: 0, statut: v.statut, budget: +v.budget || 0, engage: 0, chef: 'Service technique',
          responsable: v.responsable, equipe: [v.responsable], meteo: v.meteo, jalons: [{ d: v.debut, t: 'Lancement du projet', fait: false }], taches: [], risques: [], journal: [], documents: [],
          budgetLignes: [{ lot: 'Budget global', budget: +v.budget || 0, engage: 0, facture: 0 }],
          courbe: { prevu: [[ymOf(a), 0], [q(.25), 12], [q(.5), 45], [q(.75), 82], [ymOf(b), 100]], reel: [[ymOf(a), 0]] } };
        all().push(p); S.save();
        E.log('Projet créé', p.id + ' — ' + p.nom, 'projets'); E.notify('Nouveau projet créé', p.code + ' — ' + p.nom, '#/projets/' + p.id, 'blue');
        U.toast('Projet ' + p.id + ' créé'); E.go('projets/' + p.id + '/taches');
      } });
  }
  function editProject(p) {
    U.formModal({ title: 'Modifier le projet', sub: p.id + (p.public ? ' · visible sur le site public' : ''), fields: projectFields(), values: p,
      onSubmit: function (v) {
        if (v.fin <= v.debut) { U.toast('La date de fin doit suivre la date de début.', 'err'); return false; }
        var patch = { code: String(v.code).toUpperCase(), nom: v.nom, statut: v.statut, partenaire: v.partenaire, responsable: v.responsable, debut: v.debut, fin: v.fin, meteo: v.meteo, resume: v.resume };
        if (+v.budget && +v.budget !== p.budget) { patch.budget = +v.budget; if ((p.budgetLignes || []).length === 1) p.budgetLignes[0].budget = +v.budget; }
        if (p.equipe && p.equipe.indexOf(v.responsable) < 0) p.equipe.unshift(v.responsable);
        S.update(COL, p.id, patch); E.log('Projet modifié', p.code + ' — ' + p.nom, 'projets'); U.toast('Projet mis à jour' + publicNote(p)); refresh();
      } });
  }

  /* ------------------------------------------------------------------ enregistrement */
  E.register({
    id: 'projets', label: 'Projets & investissements', title: 'Projets & investissements', icon: 'gantt', group: 'Technique & Achats', roles: ['technique'],
    seed: seed, render: render,
    init: function () {
      /* Complète les projets créés par une version antérieure (sans champs enrichis). */
      if (!S.has(COL)) return;
      var changed = false;
      all().forEach(function (p) { if (!p.budgetLignes) { p.budgetLignes = [{ lot: 'Budget global', budget: p.budget || 0, engage: p.engage || 0, facture: 0 }]; changed = true; } ['equipe', 'risques', 'journal', 'documents', 'jalons', 'taches'].forEach(function (k) { if (!p[k]) { p[k] = []; changed = true; } }); });
      if (changed) S.save();
    },
    summary: function () {
      var P = all(), act = P.filter(isActive), late = P.filter(isLate);
      var wsum = E.sum(act, function (p) { return p.budget || 1; }), wav = wsum ? E.sum(act, function (p) { return (p.avancement || 0) * (p.budget || 1); }) / wsum : 0;
      var t = today(), t30 = E.addDays(t, 30), n = 0; P.forEach(function (p) { (p.jalons || []).forEach(function (j) { if (!j.fait && j.d >= t && j.d <= t30) n++; }); });
      return [{ label: 'Projets actifs', value: String(act.length), icon: 'gantt', tone: 'blue', foot: late.length ? late.length + ' en retard' : 'tous dans les temps', href: '#/projets' },
        { label: 'Avancement moyen', value: Math.round(wav) + ' %', icon: 'trend', tone: 'green', foot: n + ' jalon(s) dans les 30 j', href: '#/projets/planning' }];
    },
    pending: function (user) {
      var out = [], prof = user && user.profile, t = today();
      if (prof === 'admin' || prof === 'technique') {
        all().forEach(function (p) {
          overdueJalons(p).forEach(function (j) { out.push({ title: p.code + ' · Jalon dépassé : ' + j.t, sub: 'Prévu le ' + F.date(j.d) + ' · à confirmer ou replanifier', date: j.d, href: '#/projets/' + p.id + '/jalons', tone: 'red' }); });
          lateTasks(p).forEach(function (x) { out.push({ title: p.code + ' · Tâche en retard : ' + x.t, sub: 'Fin prévue ' + F.date(x.e) + ' · ' + x.p + ' % réalisé · ' + E.empName(x.resp), date: x.e, href: '#/projets/' + p.id + '/taches', tone: 'orange' }); });
        });
      }
      if (prof === 'admin' || prof === 'finance') {
        all().forEach(function (p) { if (isActive(p) && p.budget && p.engage / p.budget >= 0.75 && (p.avancement || 0) < 90) out.push({ title: p.code + ' · Budget engagé à ' + Math.round(p.engage / p.budget * 100) + ' %', sub: 'Avancement ' + p.avancement + ' % · reste ' + F.short(p.budget - p.engage) + ' FCFA', date: t, href: '#/projets/' + p.id + '/budget', tone: 'orange' }); });
      }
      return out;
    },
    search: function (q) {
      var res = [];
      all().forEach(function (p) {
        if (E.norm(p.id + ' ' + p.code + ' ' + p.nom + ' ' + p.partenaire).indexOf(q) >= 0) res.push({ title: p.code + ' — ' + p.nom, sub: p.statut + ' · ' + p.avancement + ' %', href: '#/projets/' + p.id });
        (p.taches || []).forEach(function (t) { if (E.norm(t.t).indexOf(q) >= 0) res.push({ title: t.t, sub: 'Tâche · ' + p.code + ' · ' + t.p + ' %', href: '#/projets/' + p.id + '/taches' }); });
      });
      return res;
    },
    badge: function () { var u = E.session.user(); if (!u || (u.profile !== 'admin' && u.profile !== 'technique')) return 0; return all().reduce(function (n, p) { return n + overdueJalons(p).length + lateTasks(p).length; }, 0); }
  });
})();
