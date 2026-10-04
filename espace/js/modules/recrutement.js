/* GPM · Espace de gestion — module Recrutement & stages
   De la demande de recrutement à l'embauche : offres (circuit DRH → DG → publication sur la page Carrières du site,
   collection `offres` partagée avec window.GPM_DATA), candidatures (site internet — clé gpm_candidatures_site —,
   LinkedIn, cooptation, papier), pipeline, évaluations, validation de la Direction générale, lettre de proposition,
   création de la fiche employé, et volet « Stages — programme d'employabilité des jeunes » (stagiaires, tuteurs). */
(function () {
  'use strict';
  var E = window.ERP; if (!E) return;
  var esc = E.esc, fmt = E.fmt, ui = E.ui, icon = E.icon;

  /* Feuille de style partagée des modules RH */
  if (!document.getElementById('rh-css')) { var l = document.createElement('link'); l.id = 'rh-css'; l.rel = 'stylesheet'; l.href = 'css/rh.css'; document.head.appendChild(l); }

  var WEB_KEY = 'gpm_candidatures_site';
  var ETAPES = ['Reçue', 'Présélection', 'Entretien RH', 'Entretien technique / tests', 'Validation direction', 'Proposition', 'Embauché'];
  var ETAPE_COL = ['#94a3b8', '#2563eb', '#0e7490', '#7c3aed', '#e8780c', '#f5c400', '#1e9e4a'];
  var ETAPE_TONE = ['grey', 'blue', 'blue', 'violet', 'orange', 'yellow', 'green'];
  var SOURCES = ['Site internet', 'LinkedIn', 'Cooptation', 'Candidature papier'];
  var SRC_COL = { 'Site internet': '#0f2d5c', 'LinkedIn': '#2563eb', 'Cooptation': '#1e9e4a', 'Candidature papier': '#f5c400' };
  var DOMAINES = ['Exploitation portuaire', 'Services maritimes (pilotage, remorquage, lamanage)', 'Terminal & manutention (grutiers, engins)', 'Maintenance (navale, engins, électricité)', 'HSE & sûreté portuaire', 'Qualité', 'Projets & infrastructures', 'Achats & magasin', 'Finance / comptabilité', 'Ressources humaines', 'Informatique', 'Commercial (armateurs, consignataires)', 'Autre'];
  var OF_WF = ['Demande', 'Validation DRH', 'Validation DG', 'Publication', 'Clôture'];
  var OF_ST = {
    brouillon: { l: 'Brouillon', t: 'grey' }, demande: { l: 'Validation DRH', t: 'orange' }, valide_drh: { l: 'Validation DG', t: 'orange' },
    approuvee: { l: 'Approuvée · à publier', t: 'blue' }, publiee: { l: 'Publiée', t: 'green' }, cloturee: { l: 'Clôturée', t: 'grey' }, refusee: { l: 'Refusée', t: 'red' }
  };
  var CONTRATS = ['CDI', 'CDD 12 mois', 'CDD 24 mois', 'Stage 6 mois', 'Intérim'];
  var CATEGORIES = ['Employé', 'Agent de maîtrise', 'Cadre', 'Cadre sup.'];
  var MOTIFS = ['Profil ne correspondant pas au poste', 'Expérience insuffisante', 'Résultats des tests insuffisants', 'Prétentions salariales trop élevées', 'Poste pourvu', 'Candidat injoignable', 'Autre'];
  var DRH = 'Mbina Aurélie', CHARGE = 'Allogho Kevin';

  /* ------------------------------------------------------------ utilitaires */
  function user() { return E.session.user() || {}; }
  function isDG() { return user().profile === 'admin'; }
  function isRH() { var p = user().profile; return p === 'rh' || p === 'admin'; }
  function me() { return user().name || 'Système'; }
  function today() { return E.today(); }
  function cands() { return E.store.all('candidatures'); }
  function offres() { return E.store.all('offres'); }
  function offre(id) { return id ? E.store.get('offres', id) : null; }
  function cand(id) { return E.store.get('candidatures', id); }
  function offTitle(c) { var o = offre(c.offreId); return o ? o.titre : (c.offreTitre && !c.offreId ? c.offreTitre : 'Candidature spontanée'); }
  function empByName(n) { var k = E.norm(n); return E.store.all('employes').find(function (e) { return E.norm(e.nom).indexOf(k) === 0; }); }
  function dirCode(name) { if (!name) return ''; var d = E.store.all('directions').find(function (x) { return x.nom === name || x.id === name; }); return d ? d.id : ''; }
  function stars(n, lg) { var r = Math.round(+n || 0), s = ''; for (var i = 1; i <= 5; i++) s += '<span class="' + (i <= r ? 'on' : 'off') + '">★</span>'; return '<span class="rh-stars' + (lg ? ' lg' : '') + '" title="' + (n ? fmt.num(n, 1) + ' / 5' : 'Non évalué') + '">' + s + '</span>'; }
  function etapeBadge(c) {
    if (c.statut === 'Rejetée') return ui.badge('Rejetée', 'red');
    if (c.statut === 'Désistement') return ui.badge('Désistement', 'grey');
    return ui.badge(ETAPES[c.etape], ETAPE_TONE[c.etape]);
  }
  function ofBadge(o) { var s = OF_ST[o.statut] || { l: o.statut, t: 'grey' }; return ui.badge(s.l, s.t); }
  function avgNote(c) { var ev = (c.evaluations || []).filter(function (x) { return x.note; }); return ev.length ? E.sum(ev, 'note') / ev.length : 0; }
  function hist(obj, action) { obj.historique = obj.historique || []; obj.historique.unshift({ date: new Date().toISOString(), par: me(), action: action }); }
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function printDoc(title, html) {
    var w = window.open('', '_blank');
    if (!w) { ui.toast('Autorisez les fenêtres pop-up pour imprimer.', 'err'); return; }
    var base = location.href.replace(/#.*$/, '').replace(/[^\/]*$/, '');
    w.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>' + esc(title) + '</title><base href="' + base + '"><link rel="stylesheet" href="css/erp.css"><link rel="stylesheet" href="css/rh.css"></head><body class="rh-print">' + html + '<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>');
    w.document.close();
  }
  function nextOffreId() { var max = 0; offres().forEach(function (o) { var m = /OF-\d{4}-(\d+)/.exec(o.id); if (m && +m[1] > max) max = +m[1]; }); return 'OF-2026-' + String(max + 1).padStart(3, '0'); }
  function nextCandId() { var max = 400; cands().forEach(function (c) { var m = /CAND-\d{4}-(\d+)/.exec(c.id); if (m && +m[1] > max) max = +m[1]; }); return 'CAND-2026-' + String(max + 1).padStart(4, '0'); }
  function nextMat() { var max = 0; E.store.all('employes').forEach(function (e) { var n = +String(e.id).replace(/\D/g, ''); if (n > max) max = n; }); return 'MAT-' + (max + 7); }
  function mailOf(nom) { var w = String(nom).split(/\s+/); return E.norm(w[w.length - 1]).replace(/[^a-z]/g, '') + '.' + E.norm(w[0]).replace(/[^a-z]/g, '') + '@gpm-demo.ga'; }

  /* ------------------------------------------------------------ données d'exemple
     Les offres OF-2026-021 à 026 proviennent de window.GPM_DATA.offresDefaut (affichées sur la page Carrières du site) ;
     elles sont complétées ici par les informations internes (demandeur, budget, circuit de validation). */
  function seedOffres() {
    var t = today();
    var extra = {
      'OF-2026-021': { dem: 'Nguema', just: 'Hausse du nombre d\'escales à Owendo : passage de 3 à 4 pilotes pour garantir le pilotage de nuit sans heures supplémentaires excessives.', budget: 46800000, cat: 'Cadre' },
      'OF-2026-022': { dem: 'Mouketou', just: 'Création de 2 postes pour armer les trois grues mobiles en double équipe et tenir l\'objectif de 25 à 30 mouvements par heure.', budget: 30000000, cat: 'Employé', postes: 2 },
      'OF-2026-023': { dem: 'Mbadinga', just: 'Remplacement d\'un départ à la retraite et préparation de la révision générale de la grue n° 1.', budget: 13200000, cat: 'Employé' },
      'OF-2026-024': { dem: 'Bivigou', just: 'Structuration de l\'activité soutage et eau douce de Port-Gentil (seul port du pays à proposer ce service).', budget: 21600000, cat: 'Agent de maîtrise' },
      'OF-2026-025': { dem: 'Mbina', just: 'Programme d\'employabilité des jeunes : 10 stagiaires par promotion, répartis entre HSE, grutiers, commercial, qualité et projets.', budget: 18000000, cat: 'Stagiaire', postes: 10 },
      'OF-2026-026': { dem: 'Ogoula', just: 'Développement du portefeuille armateurs et suivi des nouvelles lignes conteneurs.', budget: 15600000, cat: 'Agent de maîtrise' }
    };
    var list = ((window.GPM_DATA && window.GPM_DATA.offresDefaut) || []).map(function (o) {
      var c = E.clone(o), x = extra[o.id] || {}, d = empByName(x.dem || 'Mbina');
      c.postes = x.postes || 1; c.demandeur = d ? d.id : ''; c.justification = x.just || ''; c.budget = x.budget || 0; c.categorie = x.cat || 'Employé';
      c.dateDemande = E.addDays(o.publie, -14);
      c.historique = [
        { date: o.publie + 'T10:00:00', par: DRH, action: 'Offre publiée sur le site carrières' },
        { date: E.addDays(o.publie, -4) + 'T16:20:00', par: 'Direction générale', action: 'Demande validée par la Direction générale' },
        { date: E.addDays(o.publie, -8) + 'T09:40:00', par: DRH, action: 'Demande validée par la DRH' },
        { date: c.dateDemande + 'T08:15:00', par: d ? d.nom : '—', action: 'Demande de recrutement créée' }
      ];
      return c;
    });
    var bek = empByName('Bekale') || {}, dem = function (n) { return (empByName(n) || {}).id; };
    list.push({ id: 'OF-2026-012', titre: 'Matelot lamaneur', direction: 'Services maritimes', lieu: 'Owendo (Libreville)', contrat: 'CDI', niveau: 'Certificat de matelot · 2 ans', publie: E.addDays(t, -130), cloture: E.addDays(t, -95), statut: 'cloturee', postes: 2, categorie: 'Employé',
      resume: 'Assurer l\'amarrage et le démarrage des navires, servir à bord des remorqueurs et de la vedette d\'amarrage.', missions: ['Lamanage : passage et capelage des aussières', 'Service à bord des remorqueurs', 'Entretien courant du matériel d\'amarrage'], profil: ['Certificat de matelot ou expérience équivalente', 'Aptitude médicale à la navigation', 'Savoir nager, culture sécurité'],
      demandeur: bek.id, justification: 'Deux départs (retraite et mutation) dans l\'équipe de lamanage.', budget: 15600000, dateDemande: E.addDays(t, -150),
      historique: [{ date: E.addDays(t, -60) + 'T11:00:00', par: DRH, action: 'Offre clôturée — 2 postes pourvus' }, { date: E.addDays(t, -130) + 'T10:00:00', par: DRH, action: 'Offre publiée sur le site carrières' }, { date: E.addDays(t, -138) + 'T15:00:00', par: 'Direction générale', action: 'Demande validée par la Direction générale' }, { date: E.addDays(t, -144) + 'T09:00:00', par: DRH, action: 'Demande validée par la DRH' }, { date: E.addDays(t, -150) + 'T08:00:00', par: bek.nom || 'Bekale Hervé', action: 'Demande de recrutement créée' }] });
    list.push({ id: 'OF-2026-027', titre: 'Ingénieur maintenance grues et engins', direction: 'Service technique', lieu: 'Owendo (Libreville)', contrat: 'CDI', niveau: 'Bac+5 · 5 ans', publie: '', cloture: E.addDays(t, 45), statut: 'brouillon', postes: 1, categorie: 'Cadre',
      resume: 'Piloter la fiabilité des grues mobiles portuaires et des reach stackers : plans de maintenance, analyses de pannes, gestion des pièces critiques.', missions: ['Analyser les défaillances récurrentes (RCA)', 'Optimiser les plans de maintenance préventive', 'Suivre les indicateurs de disponibilité des engins'], profil: ['Ingénieur mécanique ou électromécanique', 'Expérience sur engins de levage lourds', 'Anglais technique'],
      demandeur: dem('Mbadinga'), justification: 'Réduire les immobilisations non planifiées des grues (impact direct sur la cadence et les escales).', budget: 33600000, dateDemande: E.addDays(t, -3),
      historique: [{ date: E.addDays(t, -3) + 'T14:10:00', par: 'Mbadinga Fabrice', action: 'Brouillon d\'offre créé' }] });
    list.push({ id: 'OF-2026-028', titre: 'Agent de sûreté portuaire', direction: 'HSE & sûreté', lieu: 'Port-Gentil', contrat: 'CDD 12 mois', niveau: 'Bac · formation sûreté ISPS', publie: '', cloture: '', statut: 'demande', postes: 3, categorie: 'Employé',
      resume: 'Contrôler les accès à l\'installation portuaire, tenir les registres visiteurs et véhicules, effectuer les rondes conformément au plan de sûreté (code ISPS).', missions: ['Contrôle des badges et des véhicules aux accès', 'Rondes et surveillance du périmètre', 'Participation aux exercices de sûreté'], profil: ['Formation agent de sûreté', 'Rigueur, vigilance', 'Disponibilité en horaires postés'],
      demandeur: dem('Koumba'), justification: 'Renforcement des contrôles d\'accès à Port-Gentil en attendant la mise en service des tourniquets à badges.', budget: 22000000, dateDemande: E.addDays(t, -2),
      historique: [{ date: E.addDays(t, -2) + 'T09:30:00', par: 'Koumba Patrick', action: 'Demande de recrutement créée' }] });
    list.push({ id: 'OF-2026-029', titre: 'Planificateur navires (ship planner)', direction: 'Terminal & manutention', lieu: 'Owendo (Libreville)', contrat: 'CDI', niveau: 'Bac+3 · 3 ans', publie: '', cloture: '', statut: 'valide_drh', postes: 1, categorie: 'Agent de maîtrise',
      resume: 'Établir les plans de chargement et de déchargement des porte-conteneurs, optimiser l\'utilisation des grues et du parc.', missions: ['Préparer les plans de cale (bay plans)', 'Coordonner les séquences de grues', 'Échanger avec les centres de planification des armateurs'], profil: ['Formation logistique ou transport maritime', 'Maîtrise des logiciels de planification', 'Anglais professionnel'],
      demandeur: dem('Mouketou'), justification: 'Une seule planificatrice pour tout le trafic conteneurs d\'Owendo : risque de rupture lors des congés et des pics d\'escales.', budget: 19200000, dateDemande: E.addDays(t, -9),
      historique: [{ date: E.addDays(t, -4) + 'T11:45:00', par: DRH, action: 'Demande validée par la DRH — transmise à la Direction générale' }, { date: E.addDays(t, -9) + 'T10:05:00', par: 'Mouketou Gaël', action: 'Demande de recrutement créée' }] });
    return list;
  }

  function seedCandidatures() {
    var r = rng(4242), t = today();
    var EVAL = {
      1: ['CV solide, parcours cohérent avec le poste.', 'Bonne adéquation diplôme / expérience.', 'Profil intéressant, quelques manques sur la partie outils.', 'Expérience pertinente dans le secteur maritime et portuaire.'],
      2: ['Bonne présentation, motivation claire pour GPM.', 'Candidat posé, bonne culture sécurité.', 'Communication à améliorer mais très motivé.', 'Excellent savoir-être, mobilité confirmée entre Owendo et Port-Gentil.'],
      3: ['Test pratique réussi (16/20), bonnes bases.', 'Maîtrise technique confirmée lors de la mise en situation sur simulateur.', 'Résultats corrects, à accompagner sur les procédures internes.', 'Très bon niveau technique, recommandé.']
    };
    var TECH = { 'OF-2026-021': 'Nguema Jean-Pierre', 'OF-2026-022': 'Mouketou Gaël', 'OF-2026-023': 'Mbadinga Fabrice', 'OF-2026-024': 'Bivigou Christian', 'OF-2026-025': 'Allogho Kevin', 'OF-2026-026': 'Ogoula Nadia', 'OF-2026-012': 'Bekale Hervé' };
    var MAILS = ['gmail.com', 'yahoo.fr', 'outlook.com', 'gmail.com'];
    var rows = [
      ['Moukagni Ange-Stéphane', '021', 4, 'En cours', 'LinkedIn', 26, 'Brevet de capitaine 3 000 (ARSTM Abidjan)', 9, 'Libreville'],
      ['Ndong Ella Prisca', '021', 3, 'En cours', 'Site internet', 24, 'Officier de quart passerelle (ENSM)', 6, 'Port-Gentil'],
      ['Obame Nzé Wilfried', '021', 2, 'En cours', 'Cooptation', 20, 'Brevet de chef de quart (ARSTM)', 7, 'Libreville'],
      ['Mabika Chancelle', '021', 1, 'En cours', 'Site internet', 9, 'Master sciences nautiques (ARSTM)', 4, 'Libreville'],
      ['Ngoma Loïc', '021', 0, 'En cours', 'Site internet', 2, 'Capitaine de navire de commerce', 11, 'Douala'],
      ['Mouele Grâce', '021', 1, 'Rejetée', 'LinkedIn', 22, 'Licence transport maritime', 1, 'Franceville'],
      ['Nziengui Arsène', '022', 5, 'En cours', 'Site internet', 25, 'CAP conduite d\'engins + CACES grue', 5, 'Owendo'],
      ['Bouanga Ornella', '022', 3, 'En cours', 'Candidature papier', 21, 'BEP maintenance des engins', 4, 'Libreville'],
      ['Ekang Mathieu', '022', 1, 'En cours', 'Site internet', 6, 'CACES R490 grue auxiliaire', 3, 'Lambaréné'],
      ['Mbadinga Yolande', '022', 0, 'En cours', 'Site internet', 1, 'BEP conduite d\'engins', 3, 'Owendo'],
      ['Issembe Rodrigue', '022', 2, 'Rejetée', 'LinkedIn', 19, 'CAP cariste', 2, 'Libreville'],
      ['Otsaghe Brenda', '023', 0, 'En cours', 'Site internet', 3, 'BTS maintenance des systèmes', 2, 'Libreville'],
      ['Nganga Hervé-Junior', '023', 0, 'En cours', 'Candidature papier', 4, 'BT mécanique engins', 4, 'Owendo'],
      ['Mickala Joëlle', '023', 1, 'En cours', 'Site internet', 12, 'DUT génie mécanique (IUSO)', 3, 'Port-Gentil'],
      ['Ondo Nguema Bertrand', '023', 2, 'En cours', 'Cooptation', 15, 'BTS maintenance industrielle', 5, 'Owendo'],
      ['Tchibinda Merveille', '023', 2, 'En cours', 'Site internet', 14, 'BTS électrotechnique', 3, 'Libreville'],
      ['Mayombo Christelle', '024', 4, 'En cours', 'LinkedIn', 18, 'Licence pro logistique pétrolière', 8, 'Port-Gentil'],
      ['Boukandou Fabrice', '024', 2, 'En cours', 'Site internet', 13, 'BTS transport & logistique + HSE', 6, 'Port-Gentil'],
      ['Eyeghe Nadia', '024', 1, 'En cours', 'LinkedIn', 8, 'Ingénieur QHSE', 5, 'Abidjan'],
      ['Moundounga Prince', '026', 1, 'En cours', 'Site internet', 10, 'Master commerce international', 4, 'Libreville'],
      ['Ada Ondo Emmanuella', '026', 0, 'En cours', 'LinkedIn', 5, 'Master transport maritime & logistique', 3, 'Libreville'],
      ['Obiang Mengue Rolande', '025', 2, 'En cours', 'Site internet', 8, 'Licence pro QHSE (USTM)', 0, 'Franceville'],
      ['Ivanga Dimitri', '025', 0, 'En cours', 'Site internet', 1, 'BTS commerce international', 0, 'Port-Gentil'],
      ['Koumba Mavoungou Inès', '025', 1, 'En cours', 'Site internet', 4, 'Master management de projets (UOB)', 0, 'Libreville'],
      ['Nzengue Thierry', '025', 0, 'En cours', 'Site internet', 2, 'BTS qualité', 0, 'Owendo'],
      ['Makanga Sosthène', '012', 6, 'Embauché', 'Site internet', 112, 'Certificat de matelot', 4, 'Owendo'],
      ['Ngouessy Cyrille', '012', 6, 'Embauché', 'Cooptation', 108, 'Certificat de matelot + permis bateau', 6, 'Libreville'],
      ['Nzoghe Laetitia', '012', 5, 'Désistement', 'LinkedIn', 105, 'Certificat de matelot', 5, 'Libreville'],
      ['Mapaga Steeve', '012', 2, 'Rejetée', 'Candidature papier', 110, 'Expérience pêche artisanale', 2, 'Port-Gentil'],
      ['Bibalou Sidonie', '', 1, 'En cours', 'Site internet', 16, 'Master finance d\'entreprise', 3, 'Libreville', 'Finance / comptabilité'],
      ['Nguema Mba Jordan', '', 0, 'En cours', 'Site internet', 4, 'Ingénieur informatique (INPTIC)', 2, 'Libreville', 'Informatique'],
      ['Moussounda Pélagie', '', 0, 'En cours', 'Candidature papier', 11, 'BTS assistant de gestion PME', 5, 'Port-Gentil', 'Ressources humaines'],
      ['Lekogo Anicet', '', 1, 'En cours', 'LinkedIn', 30, 'Mécanicien navigant (ARSTM)', 7, 'Port-Gentil', 'Services maritimes (pilotage, remorquage, lamanage)'],
      ['Mboula Esther', '', 0, 'En cours', 'Site internet', 7, 'Master environnement marin', 2, 'Port-Gentil', 'HSE & sûreté portuaire'],
      ['Rapontchombo Yann', '', 0, 'En cours', 'Cooptation', 19, 'BTS transport & logistique', 3, 'Owendo', 'Terminal & manutention (grutiers, engins)']
    ];
    var out = rows.map(function (x, i) {
      var nom = x[0], ofId = x[1] ? 'OF-2026-' + x[1] : null, etape = x[2], statut = x[3], date = E.addDays(t, -x[5]);
      var w = nom.split(' '), prenom = w[w.length - 1], fam = w.slice(0, -1).join(' ');
      var c = {
        id: 'CAND-2026-' + String(301 + i).padStart(4, '0'), nom: nom, email: E.norm(prenom).replace(/[^a-z]/g, '') + '.' + E.norm(fam).replace(/[^a-z]/g, '') + '@' + MAILS[i % 4],
        tel: '+241 0' + (i % 2 ? 6 : 7) + ' ' + String(10 + Math.floor(r() * 89)) + ' ' + String(10 + Math.floor(r() * 89)) + ' ' + String(10 + Math.floor(r() * 89)),
        ville: x[8], diplome: x[6], experience: x[7], offreId: ofId, domaine: x[9] || '', source: x[4], date: date, etape: etape, etapeMax: etape, statut: statut,
        cv: 'CV_' + E.norm(fam).replace(/[^a-z]+/g, '_').toUpperCase() + '_' + prenom.replace(/[^A-Za-zÀ-ÿ-]/g, '') + '.pdf',
        message: 'Madame, Monsieur,\n\nTitulaire d\'un diplôme « ' + x[6] + ' » et fort(e) de ' + (x[7] ? x[7] + ' année(s) d\'expérience' : 'plusieurs stages en entreprise') + ', je souhaite rejoindre Gabon Port Management, opérateur des ports d\'Owendo et de Port-Gentil. Rigueur, sens de la sécurité et esprit d\'équipe guident mon parcours ; je serais heureux(se) de contribuer à la performance des escales.\n\nJe me tiens à votre disposition pour un entretien.',
        lu: !(etape === 0 && x[5] <= 3), evaluations: [], entretiens: [], historique: []
      };
      var step = function (k) { var d = E.addDays(date, Math.min(x[5], k * Math.max(2, Math.round(x[5] / 7)))); return d > t ? t : d; };
      c.historique.push({ date: date + 'T08:' + String(10 + i).slice(-2) + ':00', par: x[4] === 'Site internet' ? 'Site carrières' : CHARGE, action: 'Candidature reçue (' + x[4] + ')' });
      var tech = ofId ? TECH[ofId] : 'Responsable du domaine';
      for (var k = 1; k <= etape; k++) {
        c.historique.unshift({ date: step(k) + 'T1' + (k % 8) + ':00:00', par: k === 5 ? 'Direction générale' : k === 6 ? DRH : CHARGE, action: k === 5 ? 'Embauche validée par la Direction générale — proposition émise' : k === 6 ? 'Proposition acceptée — embauche confirmée' : 'Passage à l\'étape « ' + ETAPES[k] + ' »' });
      }
      var evalAt = function (k, low) {
        var n = low ? 2 : (3 + Math.floor(r() * 3)); if (n > 5) n = 5;
        c.evaluations.push({ etape: ETAPES[k], par: k === 1 ? CHARGE : k === 2 ? DRH : tech, note: n, commentaire: low ? 'Ne correspond pas aux attentes du poste à ce stade.' : EVAL[k][Math.floor(r() * 4)], date: step(k + 1) });
      };
      var lim = statut === 'Rejetée' ? etape : Math.min(etape, 4);
      for (var s = 1; s < lim; s++) evalAt(s);
      if (statut === 'Rejetée') evalAt(Math.max(1, etape), true);
      if (statut === 'En cours' && etape >= 1 && etape <= 3 && r() > .4) evalAt(etape);
      if (etape >= 2 && (etape > 2 || statut !== 'En cours' || i % 2)) c.entretiens.push({ type: 'Entretien RH', date: step(2), heure: '09:30', lieu: 'Salle de réunion RH — siège Owendo', jury: DRH + ', ' + CHARGE });
      if (etape >= 3 && etape > 3) c.entretiens.push({ type: 'Entretien technique / tests', date: step(3), heure: '14:00', lieu: 'Bureau d\'exploitation — quai', jury: tech + ', ' + CHARGE });
      if (statut === 'En cours' && etape === 2 && !(i % 2)) c.entretiens.push({ type: 'Entretien RH', date: E.addDays(t, 1 + (i % 4)), heure: ['09:00', '10:30', '14:00', '15:30'][i % 4], lieu: 'Salle de réunion RH — siège Owendo', jury: DRH + ', ' + CHARGE });
      if (statut === 'En cours' && etape === 3) c.entretiens.push({ type: 'Entretien technique / tests', date: E.addDays(t, 2 + (i % 3)), heure: '10:00', lieu: 'Bureau d\'exploitation — quai', jury: tech + ', ' + CHARGE });
      if (statut === 'Rejetée') { c.rejet = { motif: etape <= 1 ? 'Expérience insuffisante' : 'Résultats des tests insuffisants', commentaire: 'Courriel de refus envoyé.', date: step(etape + 1), par: CHARGE }; c.historique.unshift({ date: c.rejet.date + 'T16:00:00', par: CHARGE, action: 'Candidature rejetée — ' + c.rejet.motif }); }
      c.note = Math.round(avgNote(c) * 10) / 10;
      c.dateMaj = (c.historique[0] || {}).date ? c.historique[0].date.slice(0, 10) : date;
      return c;
    });
    /* propositions et embauches */
    var byNom = function (n) { return out.find(function (c) { return c.nom === n; }); };
    var ar = byNom('Nziengui Arsène'); ar.proposition = { poste: 'Grutier de grue mobile portuaire', direction: 'TER', categorie: 'Employé', salaire: 1000000, dateEntree: E.addDays(t, 31), essai: '3 mois', envoyee: E.addDays(t, -2) };
    var mk = byNom('Makanga Sosthène'); mk.proposition = { poste: 'Matelot lamaneur', direction: 'MAR', categorie: 'Employé', salaire: 620000, dateEntree: E.addDays(t, -30), essai: '3 mois' }; mk.dateEmbauche = E.addDays(t, -52); mk.employeId = 'MAT-2350';
    var ng = byNom('Ngouessy Cyrille'); ng.proposition = { poste: 'Matelot lamaneur', direction: 'MAR', categorie: 'Employé', salaire: 650000, dateEntree: E.addDays(t, -30), essai: '3 mois' }; ng.dateEmbauche = E.addDays(t, -49); ng.employeId = 'MAT-2357';
    var nz = byNom('Nzoghe Laetitia'); nz.proposition = { poste: 'Matelot lamaneur', direction: 'MAR', categorie: 'Employé', salaire: 630000, dateEntree: E.addDays(t, -30), essai: '3 mois' }; nz.historique.unshift({ date: E.addDays(t, -55) + 'T12:00:00', par: CHARGE, action: 'Désistement du candidat (autre proposition acceptée)' });
    return out;
  }

  /* ------------------------------------------------------------ stages : programme d'employabilité des jeunes */
  var SERVICES_STAGE = ['HSE & sûreté', 'Grutiers (terminal)', 'Commercial', 'Qualité', 'Projets'];
  var SERV_COL = { 'HSE & sûreté': '#d93636', 'Grutiers (terminal)': '#0e7490', 'Commercial': '#2563eb', 'Qualité': '#1e9e4a', 'Projets': '#e8780c' };
  function stagiaires() { return E.store.all('stagiaires'); }
  function stStatut(s) { if (s.statut === 'Terminé' || s.statut === 'Abandon') return s.statut; var t = today(); return s.debut > t ? 'À venir' : s.fin < t ? 'À clôturer' : 'En cours'; }
  function stBadge(s) { var st = stStatut(s); return ui.badge(st, { 'En cours': 'blue', 'À venir': 'violet', 'À clôturer': 'orange', 'Terminé': 'green', 'Abandon': 'grey' }[st]); }
  function seedStagiaires() {
    var t = today(), P = function (n) { return (empByName(n) || {}).id || ''; };
    var rows = [
      ['Mounguengui Sarah', 'Licence pro QHSE — USTM', 'HSE & sûreté', 'OWE', 'Ntsame', -40, 80, 'Mise à jour des analyses de risques des postes à quai'],
      ['Ndjave Ndjoy Rudy', 'Master HSE — Université Omar Bongo', 'HSE & sûreté', 'POG', 'Koumba', -40, 80, 'Registre des visiteurs et exercices de sûreté ISPS à Port-Gentil'],
      ['Ella Mintsa Kévin', 'CAP conduite d\'engins — CFP Owendo', 'Grutiers (terminal)', 'OWE', 'Engonga', -40, 140, 'Formation à la conduite de grue mobile sous tutelle (simulateur puis quai)'],
      ['Boulingui Davy', 'BEP maintenance des engins', 'Grutiers (terminal)', 'OWE', 'Pambou', -40, 140, 'Contrôles de prise de poste et conduite de reach stacker'],
      ['Mezui Andrea', 'BTS commerce international — IST', 'Commercial', 'OWE', 'Ella Stéphane', -40, 80, 'Enquête de satisfaction des armateurs et consignataires'],
      ['Oyono Larissa', 'Master transport & logistique — ESM', 'Commercial', 'POG', 'Bivigou', -40, 80, 'Suivi des demandes d\'escale et devis offshore'],
      ['Nkili Stevy', 'Licence pro qualité — IUSO', 'Qualité', 'OWE', 'Ntoutoume', -40, 80, 'Indicateurs de performance des escales (cadence, temps d\'attente)'],
      ['Mabicka Grâce', 'BTS qualité — Lycée technique Omar Bongo', 'Qualité', 'OWE', 'Ditsougou', -40, 80, 'Cartographie des processus pour la démarche qualité'],
      ['Ondo Obiang Ruth', 'Ingénieur génie civil — ENSET', 'Projets', 'OWE', 'Minko', -40, 140, 'Suivi du chantier de réhabilitation du parc à conteneurs'],
      ['Mamboundou Fred', 'Master management de projets — UOB', 'Projets', 'OWE', 'Mouloungui', -40, 140, 'Accompagnement du déploiement de l\'ERP'],
      ['Assele Murielle', 'Licence pro QHSE — USTM', 'HSE & sûreté', 'OWE', 'Ntsame', -230, -50, 'Plan de gestion des déchets des navires (MARPOL)', 'Terminé', 17],
      ['Ibouanga Cédric', 'BTS transport & logistique', 'Commercial', 'OWE', 'Ella Stéphane', -230, -50, 'Tableau de bord des escales par armateur', 'Terminé', 15],
      ['Moutsinga Joyce', 'Master management de projets — UOB', 'Projets', 'POG', 'Bivigou', 25, 205, 'Réhabilitation du magasin couvert de Port-Gentil', 'À venir']
    ];
    return rows.map(function (x, i) {
      var s = { id: 'STG-2026-' + String(i + 1).padStart(3, '0'), nom: x[0], ecole: x[1], service: x[2], site: x[3], tuteur: P(x[4]), debut: E.addDays(t, x[5]), fin: E.addDays(t, x[6]), theme: x[7], gratification: /Master|Ingénieur/.test(x[1]) ? 150000 : 100000, statut: x[8] === 'Terminé' ? 'Terminé' : 'Actif', programme: 'Programme d\'employabilité des jeunes', presence: x[8] ? 100 : 92 + (i % 4) * 2, rapport: x[8] === 'Terminé', historique: [] };
      if (x[8] === 'Terminé') s.evaluation = { note: x[9], appreciation: 'Stagiaire sérieux(se), très bonne intégration dans le service. Recommandé(e) pour une future embauche.', date: s.fin, attestation: true };
      if (!x[8] && i % 3 === 0) s.pointsEtape = [{ date: E.addDays(t, -10), par: E.empName(s.tuteur), texte: 'Bonne intégration, respect strict des consignes de sécurité à quai.' }];
      s.historique.push({ date: s.debut + 'T08:00:00', par: CHARGE, action: x[8] === 'À venir' ? 'Convention de stage signée' : 'Accueil et formation sécurité d\'accueil (induction portuaire)' });
      return s;
    });
  }

  /* ------------------------------------------------------------ import des candidatures du site public */
  function readWeb() { try { var v = JSON.parse(localStorage.getItem(WEB_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function importSite(silent) {
    var list = readWeb(); if (!list.length) return 0;
    var known = {}; cands().forEach(function (c) { if (c.webId) known[c.webId] = 1; });
    var n = 0;
    list.forEach(function (w, idx) {
      if (!w || typeof w !== 'object') return;
      var wid = String(w.id || ('WEB-' + (w.date || '') + '-' + idx));
      if (known[wid]) return;
      var nom = [w.prenom || w.firstName || '', w.nom || w.lastName || ''].join(' ').replace(/\s+/g, ' ').trim() || w.name || w.fullname || 'Candidat du site';
      var ofId = w.spontanee === true ? '' : (w.offreId || w.offre || w.offre_id || '');
      var poste = w.poste || w.offreTitre || w.titre || '';
      if (!ofId && poste) { var f = offres().find(function (o) { return o.id === poste || E.norm(o.titre) === E.norm(poste); }); if (f) ofId = f.id; }
      if (ofId && !offre(ofId)) { var f2 = offres().find(function (o) { return E.norm(o.titre) === E.norm(poste); }); ofId = f2 ? f2.id : ''; }
      if (/spontan/i.test(ofId + ' ' + (w.type || '')) && !offre(ofId)) ofId = '';
      var cv = w.cv || w.cvNom || w.fichier || ''; if (cv && typeof cv === 'object') cv = cv.name || cv.nom || 'CV.pdf';
      var d = String(w.date || new Date().toISOString());
      var c = {
        id: nextCandId(), webId: wid, nom: nom, email: w.email || w.courriel || '', tel: w.tel || w.telephone || w.phone || '', ville: w.ville || '',
        diplome: w.diplome || w.niveau || '', experience: w.experience != null && w.experience !== '' ? +w.experience || 0 : '', offreId: ofId || null, offreTitre: ofId ? '' : (poste && !/spontan/i.test(poste) ? poste : ''),
        domaine: w.domaine || (ofId ? '' : 'Autre'), source: 'Site internet', date: d.slice(0, 10), dateMaj: d.slice(0, 10), etape: 0, etapeMax: 0, statut: 'En cours',
        cv: cv || '', message: w.message || w.motivation || '', lu: false, evaluations: [], entretiens: [], note: 0,
        historique: [{ date: d.length > 10 ? d : d + 'T08:00:00', par: 'Site carrières', action: 'Candidature reçue via le site internet (' + wid + ')' }]
      };
      E.store.add('candidatures', c); known[wid] = 1; n++;
      E.notify('Nouvelle candidature reçue', nom + ' — ' + (ofId ? offre(ofId).titre : 'candidature spontanée' + (c.domaine ? ' (' + c.domaine + ')' : '')) + ' · via le site internet', '#/recrutement/candidat/' + c.id, 'violet');
      E.log('Import candidature site', nom + ' · ' + c.id, 'recrutement');
      if (!silent) ui.toast('Nouvelle candidature reçue du site : ' + nom);
    });
    return n;
  }

  /* Embauchés de l'exemple : leur fiche employé existe (période d'essai) */
  function ensureHired() {
    cands().forEach(function (c) {
      if (c.statut !== 'Embauché' || !c.employeId || E.store.get('employes', c.employeId)) return;
      var p = c.proposition || {};
      E.store.all('employes').push({ id: c.employeId, nom: c.nom, poste: p.poste || offTitle(c), direction: p.direction || 'TER', categorie: p.categorie || 'Employé', salaire: p.salaire || 700000, entree: p.dateEntree || today(), site: 'OWE', statut: 'Période d\'essai', contrat: 'CDI', tel: c.tel, email: mailOf(c.nom), origine: c.id });
    });
    E.store.save();
  }

  /* ------------------------------------------------------------ actions candidats */
  function save(c, action, detail) { c.dateMaj = today(); if (action) { hist(c, action); E.log(action, c.nom + (detail ? ' · ' + detail : ''), 'recrutement'); } E.store.save(); }

  function moveTo(c, target, done) {
    done = done || E.rerender;
    if (c.statut !== 'En cours') { ui.toast('Cette candidature est clôturée (' + c.statut + ').', 'err'); return; }
    if (target === c.etape) return;
    if (target < c.etape) {
      if (c.etape >= 5) { ui.toast('Impossible de revenir en arrière après la validation de la Direction.', 'err'); return; }
      c.etape = target; save(c, 'Retour à l\'étape « ' + ETAPES[target] + ' »'); ui.toast(c.nom + ' → ' + ETAPES[target]); done(); return;
    }
    if (target > c.etape + 1) { ui.toast('Faites avancer la candidature étape par étape.', 'err'); return; }
    if (target === 5) { validerEmbauche(c, done); return; }
    if (target === 6) { embaucher(c, done); return; }
    c.etape = target; c.etapeMax = Math.max(c.etapeMax || 0, target); c.lu = true;
    save(c, 'Passage à l\'étape « ' + ETAPES[target] + ' »');
    if (target === 4) E.notify('Validation d\'embauche requise', c.nom + ' — ' + offTitle(c), '#/recrutement/candidat/' + c.id, 'orange');
    ui.toast(c.nom + ' → ' + ETAPES[target]);
    done();
  }

  function validerEmbauche(c, done) {
    if (!isDG()) { ui.toast('La validation de l\'embauche est réservée à la Direction générale.', 'err'); return; }
    var o = offre(c.offreId) || {};
    ui.formModal({
      title: 'Valider l\'embauche', sub: esc(c.nom) + ' · ' + esc(offTitle(c)), okLabel: 'Valider l\'embauche',
      intro: '<div class="alert tone-violet" style="margin-bottom:14px">' + icon('shield') + '<div><b>Décision de la Direction générale.</b> Les conditions ci-dessous alimentent la lettre de proposition et la future fiche employé.</div></div>',
      fields: [
        { name: 'poste', label: 'Intitulé du poste', required: true, value: o.titre || '' },
        { name: 'direction', label: 'Direction', type: 'select', options: E.options('directions'), value: dirCode(o.direction) || 'EXP' },
        { name: 'categorie', label: 'Catégorie', type: 'select', options: CATEGORIES, value: o.categorie && CATEGORIES.indexOf(o.categorie) >= 0 ? o.categorie : 'Agent de maîtrise' },
        { name: 'salaire', label: 'Salaire de base mensuel (FCFA)', type: 'money', required: true, value: o.budget ? Math.round(o.budget / 12 / 5000) * 5000 : 900000 },
        { name: 'dateEntree', label: 'Date de prise de poste', type: 'date', required: true, value: E.addDays(today(), 30) },
        { name: 'essai', label: 'Période d\'essai', type: 'select', options: ['1 mois', '3 mois', '6 mois'], value: '3 mois' },
        { name: 'commentaire', label: 'Commentaire de la Direction', type: 'textarea', placeholder: 'Ex. : profil validé, démarrage avant la prochaine pointe de trafic.' }
      ],
      onSubmit: function (v) {
        c.proposition = { poste: v.poste, direction: v.direction, categorie: v.categorie, salaire: +v.salaire, dateEntree: v.dateEntree, essai: v.essai };
        c.etape = 5; c.etapeMax = 5; c.validationDG = { date: today(), par: me(), commentaire: v.commentaire || '' };
        if (v.commentaire) c.evaluations.unshift({ etape: 'Validation direction', par: me(), note: 0, commentaire: v.commentaire, date: today() });
        save(c, 'Embauche validée par la Direction générale', fmt.money(v.salaire) + '/mois');
        E.notify('Embauche validée par la Direction', c.nom + ' — lettre de proposition à émettre', '#/recrutement/candidat/' + c.id, 'green');
        ui.toast('Embauche validée. La lettre de proposition peut être générée.');
        setTimeout(done);
      }
    });
  }

  function embaucher(c, done) {
    var p = c.proposition || {};
    ui.confirm('Confirmer l\'embauche', 'Le candidat <b>' + esc(c.nom) + '</b> a accepté la proposition. Sa fiche employé va être créée dans le module Personnel (statut « Période d\'essai », entrée le ' + fmt.date(p.dateEntree || today()) + ').', 'Confirmer l\'embauche', function () {
      var o = offre(c.offreId) || {};
      var emp = { id: nextMat(), nom: c.nom, poste: p.poste || o.titre || 'À définir', direction: p.direction || dirCode(o.direction) || 'RH', categorie: p.categorie || 'Employé', salaire: +p.salaire || 0, entree: p.dateEntree || today(), site: /Port-Gentil/.test(o.lieu || '') ? 'POG' : 'OWE', statut: 'Période d\'essai', contrat: (o.contrat || 'CDI').replace(/^Stage.*/, 'Stage'), tel: c.tel, email: mailOf(c.nom), origine: c.id };
      E.store.add('employes', emp);
      c.etape = 6; c.etapeMax = 6; c.statut = 'Embauché'; c.dateEmbauche = today(); c.employeId = emp.id;
      save(c, 'Embauche confirmée — fiche employé ' + emp.id + ' créée');
      E.notify('Nouvel employé : ' + c.nom, emp.poste + ' · matricule ' + emp.id + ' · entrée le ' + fmt.date(emp.entree), '#/personnel/' + emp.id, 'green');
      ui.toast('Bienvenue à ' + c.nom + ' ! Fiche ' + emp.id + ' créée.');
      (done || E.rerender)();
    }, 'success');
  }

  function rejeter(c, done) {
    ui.formModal({
      title: 'Rejeter la candidature', sub: esc(c.nom), okLabel: 'Rejeter',
      fields: [{ name: 'motif', label: 'Motif', type: 'select', options: MOTIFS, required: true }, { name: 'commentaire', label: 'Commentaire', type: 'textarea', placeholder: 'Précisions (non communiquées au candidat)' }, { name: 'mail', label: 'Courriel au candidat', type: 'select', options: ['Envoyer le courriel de refus type', 'Ne pas envoyer de courriel'] }],
      onSubmit: function (v) {
        c.statut = 'Rejetée'; c.rejet = { motif: v.motif, commentaire: v.commentaire, date: today(), par: me() }; c.lu = true;
        save(c, 'Candidature rejetée — ' + v.motif);
        ui.toast('Candidature rejetée' + (/^Envoyer/.test(v.mail) ? ' — courriel de refus envoyé' : ''), 'ok');
        setTimeout(done || E.rerender);
      }
    });
  }
  function desistement(c) {
    ui.confirm('Désistement du candidat', 'Enregistrer le désistement de <b>' + esc(c.nom) + '</b> ? La candidature sera clôturée.', 'Enregistrer', function () { c.statut = 'Désistement'; save(c, 'Désistement du candidat'); ui.toast('Désistement enregistré'); E.rerender(); }, 'danger');
  }
  function reactiver(c) { c.statut = 'En cours'; delete c.rejet; save(c, 'Candidature réactivée'); ui.toast('Candidature réactivée'); E.rerender(); }

  function planifier(c) {
    var o = offre(c.offreId), tech = o && o.demandeur ? E.empName(o.demandeur) : 'Responsable technique';
    var type = c.etape >= 3 ? 'Entretien technique / tests' : 'Entretien RH';
    ui.formModal({
      title: 'Planifier un entretien', sub: esc(c.nom) + ' · ' + esc(offTitle(c)), okLabel: 'Planifier et convoquer',
      fields: [
        { name: 'type', label: 'Type', type: 'select', options: ['Entretien RH', 'Entretien technique / tests', 'Test écrit', 'Visite médicale d\'embauche'], value: type },
        { name: 'date', label: 'Date', type: 'date', required: true, value: E.addDays(today(), 3) },
        { name: 'heure', label: 'Heure', type: 'time', required: true, value: '10:00' },
        { name: 'lieu', label: 'Lieu', type: 'select', options: ['Salle de réunion RH — siège Owendo', 'Bureau d\'exploitation — quai', 'Simulateur de grue (test pratique)', 'Agence de Port-Gentil', 'Visioconférence', 'Centre médical du port'] },
        { name: 'jury', label: 'Jury', full: true, required: true, value: type === 'Entretien RH' ? DRH + ', ' + CHARGE : tech + ', ' + CHARGE }
      ],
      onSubmit: function (v) {
        c.entretiens = c.entretiens || []; c.entretiens.push({ type: v.type, date: v.date, heure: v.heure, lieu: v.lieu, jury: v.jury });
        if (v.type === 'Entretien RH' && c.etape < 2 && c.statut === 'En cours') { c.etape = 2; c.etapeMax = Math.max(c.etapeMax || 0, 2); }
        if (/technique|Test/.test(v.type) && c.etape < 3 && c.etape >= 2 && c.statut === 'En cours') { c.etape = 3; c.etapeMax = Math.max(c.etapeMax || 0, 3); }
        save(c, v.type + ' planifié le ' + fmt.date(v.date) + ' à ' + v.heure);
        ui.toast('Convocation envoyée à ' + c.nom + ' (' + (c.email || 'courriel') + ')');
        setTimeout(E.rerender);
      }
    });
  }
  function evaluer(c) {
    ui.formModal({
      title: 'Ajouter une évaluation', sub: esc(c.nom), okLabel: 'Enregistrer l\'évaluation',
      fields: [
        { name: 'etape', label: 'Étape', type: 'select', options: ETAPES.slice(0, 5), value: ETAPES[Math.min(c.etape, 4)] },
        { name: 'note', label: 'Note', type: 'select', options: [{ v: 5, l: '★★★★★ — Excellent (5/5)' }, { v: 4, l: '★★★★☆ — Très bon (4/5)' }, { v: 3, l: '★★★☆☆ — Correct (3/5)' }, { v: 2, l: '★★☆☆☆ — Insuffisant (2/5)' }, { v: 1, l: '★☆☆☆☆ — Inadapté (1/5)' }], value: 4 },
        { name: 'par', label: 'Évaluateur', value: me(), required: true },
        { name: 'commentaire', label: 'Commentaire', type: 'textarea', required: true, placeholder: 'Points forts, points de vigilance, recommandation…' }
      ],
      onSubmit: function (v) {
        c.evaluations = c.evaluations || []; c.evaluations.unshift({ etape: v.etape, par: v.par, note: +v.note, commentaire: v.commentaire, date: today() });
        c.note = Math.round(avgNote(c) * 10) / 10; save(c, 'Évaluation ajoutée (' + v.etape + ')', v.note + '/5');
        ui.toast('Évaluation enregistrée'); setTimeout(E.rerender);
      }
    });
  }

  /* Lettre de proposition */
  function lettreHTML(c) {
    var p = c.proposition || {}, o = offre(c.offreId) || {};
    var civ = /(Aïcha|Prisca|Chancelle|Grâce|Ornella|Yolande|Brenda|Joëlle|Merveille|Christelle|Nadia|Emmanuella|Rolande|Laetitia|Sidonie|Pélagie|Esther|Inès)$/.test(c.nom) ? 'Madame' : 'Monsieur';
    return '<div class="doc rh-doc"><div class="doc__head"><div class="row" style="gap:14px"><img src="../assets/img/logo.png" alt="GPM"><div class="co"><b>Gabon Port Management</b><span>Opérateur des ports d\'Owendo et de Port-Gentil</span><span>Zone portuaire d\'Owendo — B.P. 394 Libreville, Gabon</span></div></div><div style="text-align:right"><span class="small muted">Réf. DRH/REC/' + esc(c.id.replace('CAND-', '')) + '</span><br><b>Owendo, le ' + fmt.date(p.envoyee || today()) + '</b></div></div>' +
      '<p style="margin-left:auto;width:max-content;max-width:100%"><b>' + civ + ' ' + esc(c.nom) + '</b><br>' + esc(c.ville || '') + '<br>' + esc(c.email || '') + '</p>' +
      '<p><b>Objet : proposition d\'embauche — ' + esc(p.poste || o.titre || '') + '</b></p>' +
      '<p>' + civ + ',</p><p>À l\'issue du processus de sélection, nous avons le plaisir de vous proposer de rejoindre Gabon Port Management (GPM) aux conditions suivantes :</p>' +
      '<table><tbody>' + [['Poste', p.poste || o.titre], ['Direction', E.dirName(p.direction) || o.direction], ['Catégorie', p.categorie], ['Type de contrat', o.contrat || 'CDI'], ['Lieu de travail', o.lieu || 'Owendo (Libreville)'], ['Date de prise de poste', fmt.date(p.dateEntree)], ['Période d\'essai', p.essai || '3 mois'], ['Salaire de base mensuel (avant retenues)', fmt.money(p.salaire)], ['Avantages', 'Prime de transport, indemnité de logement selon catégorie, couverture CNAMGS, restauration d\'entreprise' + (['EXP', 'MAR', 'TER'].indexOf(dirCode(o.direction) || p.direction) >= 0 ? ', prime de quart et majoration des heures de nuit' : '')]].map(function (r) { return '<tr><td style="width:40%;color:#555">' + esc(r[0]) + '</td><td><b>' + esc(r[1] || '—') + '</b></td></tr>'; }).join('') + '</tbody></table>' +
      '<p style="margin-top:12px">Cette proposition est valable quinze (15) jours à compter de sa date d\'émission. Votre embauche définitive est subordonnée à la visite médicale d\'aptitude et à la fourniture des pièces administratives (pièce d\'identité, diplômes, casier judiciaire, attestation CNSS).</p>' +
      '<p>Nous vous prions de nous retourner un exemplaire de ce courrier revêtu de la mention « Bon pour accord ». Nous nous réjouissons de vous accueillir prochainement au sein de nos équipes.</p><p>Veuillez agréer, ' + civ + ', l\'expression de nos salutations distinguées.</p>' +
      '<div class="sign"><div>La Responsable des ressources humaines<br><b>' + DRH + '</b></div><div>Le candidat — « Bon pour accord »<br><b>' + esc(c.nom) + '</b></div></div>' +
      '<div class="foot">Gabon Port Management · Owendo — Document généré par l\'espace de gestion (démonstration)</div></div>';
  }
  function lettre(c) {
    if (!c.proposition) { ui.toast('La proposition doit d\'abord être validée par la Direction générale.', 'err'); return; }
    ui.modal({ title: 'Lettre de proposition', sub: esc(c.nom), size: 'lg', body: '<div class="rh-doc-wrap">' + lettreHTML(c) + '</div>',
      actions: [{ label: 'Fermer' }, { label: 'Imprimer / PDF', icon: 'print', onClick: function () { printDoc('Lettre de proposition — ' + c.nom, lettreHTML(c)); } },
        { label: c.proposition.envoyee ? 'Renvoyer au candidat' : 'Envoyer au candidat', cls: 'primary', icon: 'send', onClick: function (close) { c.proposition.envoyee = today(); save(c, 'Lettre de proposition envoyée au candidat'); ui.toast('Lettre envoyée à ' + (c.email || c.nom)); close(); E.rerender(); } }] });
  }
  function voirCV(c) {
    ui.modal({ title: c.cv || 'CV', sub: esc(c.nom) + ' · aperçu', body:
      '<div class="rh-file" style="margin-bottom:14px"><div class="rh-file__ic">PDF</div><div><b>' + esc(c.cv || 'CV non fourni') + '</b><span class="small muted">Déposé le ' + fmt.date(c.date) + ' · ' + esc(c.source) + '</span></div></div>' +
      '<dl class="kv"><dt>Nom</dt><dd>' + esc(c.nom) + '</dd><dt>Diplôme</dt><dd>' + esc(c.diplome || '—') + '</dd><dt>Expérience</dt><dd>' + (c.experience !== '' && c.experience != null ? esc(c.experience) + ' an(s)' : '—') + '</dd><dt>Ville</dt><dd>' + esc(c.ville || '—') + '</dd><dt>Contact</dt><dd>' + esc(c.email || '') + '<br>' + esc(c.tel || '') + '</dd></dl>' +
      '<p class="small muted" style="margin-top:14px">En production, le fichier original est conservé dans la GED sécurisée et s\'ouvre directement ici.</p>',
      actions: [{ label: 'Fermer' }, { label: 'Télécharger', icon: 'download', onClick: function (close) { ui.toast('Téléchargement du CV (démonstration)'); close(); } }] });
  }

  /* Saisie manuelle (candidature papier, cooptation) */
  function nouvelleCandidature(preOffre) {
    var opts = [{ v: '', l: 'Candidature spontanée' }].concat(offres().filter(function (o) { return o.statut === 'publiee'; }).map(function (o) { return { v: o.id, l: o.titre }; }));
    ui.formModal({
      title: 'Saisir une candidature', sub: 'Candidature papier, cooptation ou reçue par courriel', okLabel: 'Enregistrer',
      fields: [
        { name: 'nom', label: 'Nom et prénom', required: true }, { name: 'offreId', label: 'Offre', type: 'select', options: opts, value: preOffre || '' },
        { name: 'email', label: 'Courriel', type: 'email' }, { name: 'tel', label: 'Téléphone', placeholder: '+241 …' },
        { name: 'ville', label: 'Ville', value: 'Libreville' }, { name: 'source', label: 'Source', type: 'select', options: SOURCES, value: 'Candidature papier' },
        { name: 'diplome', label: 'Diplôme', required: true }, { name: 'experience', label: 'Années d\'expérience', type: 'number', min: 0, value: 0 },
        { name: 'domaine', label: 'Domaine (si spontanée)', type: 'select', options: DOMAINES, empty: '—' }, { name: 'cv', label: 'Fichier CV', placeholder: 'CV_NOM_Prenom.pdf' },
        { name: 'message', label: 'Observations', type: 'textarea' }
      ],
      onSubmit: function (v) {
        var c = { id: nextCandId(), nom: v.nom, email: v.email, tel: v.tel, ville: v.ville, diplome: v.diplome, experience: v.experience, offreId: v.offreId || null, domaine: v.offreId ? '' : (v.domaine || 'Autre'), source: v.source, date: today(), dateMaj: today(), etape: 0, etapeMax: 0, statut: 'En cours', cv: v.cv || ('CV_' + E.norm(v.nom).replace(/[^a-z]+/g, '_').toUpperCase() + '.pdf'), message: v.message, lu: true, evaluations: [], entretiens: [], note: 0, historique: [] };
        hist(c, 'Candidature saisie (' + v.source + ')'); E.store.add('candidatures', c); E.log('Candidature saisie', c.nom, 'recrutement');
        ui.toast('Candidature de ' + c.nom + ' enregistrée'); setTimeout(function () { E.go('recrutement/candidat/' + c.id); });
      }
    });
  }

  /* ------------------------------------------------------------ actions offres */
  function offreFields(o) {
    o = o || {};
    return [
      { name: 'titre', label: 'Intitulé du poste', required: true, full: true, value: o.titre },
      { name: 'direction', label: 'Direction', type: 'select', options: E.store.all('directions').map(function (d) { return d.nom; }), value: o.direction || 'Exploitation portuaire' },
      { name: 'lieu', label: 'Lieu', type: 'select', options: ['Owendo (Libreville)', 'Port-Gentil', 'Owendo et Port-Gentil'], value: o.lieu || 'Owendo (Libreville)' },
      { name: 'contrat', label: 'Contrat', type: 'select', options: CONTRATS, value: o.contrat || 'CDI' },
      { name: 'niveau', label: 'Niveau / expérience', value: o.niveau, placeholder: 'Bac+5 · 5 ans' },
      { name: 'categorie', label: 'Catégorie', type: 'select', options: CATEGORIES.concat(['Stagiaire']), value: o.categorie || 'Agent de maîtrise' },
      { name: 'postes', label: 'Nombre de postes', type: 'number', min: 1, value: o.postes || 1 },
      { name: 'cloture', label: 'Date limite de candidature', type: 'date', value: o.cloture || E.addDays(today(), 30) },
      { name: 'budget', label: 'Budget annuel (FCFA, coût employeur)', type: 'money', value: o.budget || '' },
      { name: 'resume', label: 'Résumé du poste (affiché sur le site)', type: 'textarea', required: true, value: o.resume },
      { name: 'missions', label: 'Missions (une par ligne)', type: 'textarea', value: (o.missions || []).join('\n') },
      { name: 'profil', label: 'Profil recherché (un point par ligne)', type: 'textarea', value: (o.profil || []).join('\n') }
    ];
  }
  function lines(s) { return String(s || '').split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function nouvelleOffre() {
    ui.formModal({ title: 'Nouvelle offre d\'emploi', sub: 'Créée en brouillon, puis soumise au circuit DRH → Direction générale avant publication', size: 'lg', fields: offreFields(), okLabel: 'Créer le brouillon',
      onSubmit: function (v) {
        var o = { id: nextOffreId(), titre: v.titre, direction: v.direction, lieu: v.lieu, contrat: v.contrat, niveau: v.niveau, categorie: v.categorie, postes: +v.postes || 1, cloture: v.cloture, budget: +v.budget || 0, resume: v.resume, missions: lines(v.missions), profil: lines(v.profil), publie: '', statut: 'brouillon', demandeur: (empByName('Mbina') || {}).id, justification: '', dateDemande: today(), historique: [] };
        hist(o, 'Brouillon d\'offre créé'); E.store.add('offres', o); E.log('Offre créée', o.id + ' · ' + o.titre, 'recrutement');
        ui.toast('Brouillon ' + o.id + ' créé'); setTimeout(function () { E.go('recrutement/offre/' + o.id); });
      } });
  }
  function nouvelleDemande() {
    ui.formModal({ title: 'Demande de recrutement', sub: 'Besoin exprimé par un manager — validation DRH puis Direction générale', okLabel: 'Soumettre la demande',
      fields: [
        { name: 'titre', label: 'Poste à pourvoir', required: true, full: true },
        { name: 'demandeur', label: 'Manager demandeur', type: 'select', options: E.options('employes', function (e) { return e.nom + ' — ' + e.poste; }), value: (empByName('Mbadinga') || {}).id },
        { name: 'direction', label: 'Direction', type: 'select', options: E.store.all('directions').map(function (d) { return d.nom; }), value: 'Service technique' },
        { name: 'lieu', label: 'Site', type: 'select', options: ['Owendo (Libreville)', 'Port-Gentil'] },
        { name: 'motif', label: 'Nature du besoin', type: 'select', options: ['Création de poste', 'Remplacement (départ)', 'Remplacement (retraite)', 'Renfort temporaire', 'Hausse du trafic', 'Projet d\'investissement'] },
        { name: 'contrat', label: 'Contrat', type: 'select', options: CONTRATS },
        { name: 'postes', label: 'Nombre de postes', type: 'number', min: 1, value: 1 },
        { name: 'arrivee', label: 'Arrivée souhaitée', type: 'date', value: E.addDays(today(), 75) },
        { name: 'categorie', label: 'Catégorie', type: 'select', options: CATEGORIES, value: 'Agent de maîtrise' },
        { name: 'budget', label: 'Budget annuel estimé (FCFA)', type: 'money', required: true, value: 18000000 },
        { name: 'justification', label: 'Justification du besoin', type: 'textarea', required: true, placeholder: 'Charge de travail, départ, projet, risques si le poste n\'est pas pourvu…' }
      ],
      onSubmit: function (v) {
        var d = E.emp(v.demandeur);
        var o = { id: nextOffreId(), titre: v.titre, direction: v.direction, lieu: v.lieu || 'Owendo (Libreville)', contrat: v.contrat, niveau: '', categorie: v.categorie, postes: +v.postes || 1, cloture: '', budget: +v.budget || 0, resume: '', missions: [], profil: [], publie: '', statut: 'demande', demandeur: v.demandeur, justification: v.motif + ' — ' + v.justification, arrivee: v.arrivee, dateDemande: today(), historique: [] };
        o.historique.unshift({ date: new Date().toISOString(), par: d ? d.nom : me(), action: 'Demande de recrutement créée (' + v.motif + ')' });
        E.store.add('offres', o); E.log('Demande de recrutement', o.id + ' · ' + o.titre, 'recrutement');
        E.notify('Demande de recrutement à valider', o.titre + ' — ' + (d ? d.nom : ''), '#/recrutement/offre/' + o.id, 'orange');
        ui.toast('Demande ' + o.id + ' transmise à la DRH'); setTimeout(function () { E.go('recrutement/offre/' + o.id); });
      } });
  }
  function offreAction(o, act) {
    var done = E.rerender;
    if (act === 'soumettre') { o.statut = 'demande'; hist(o, 'Soumise au circuit de validation'); E.store.save(); E.log('Offre soumise', o.id, 'recrutement'); ui.toast('Demande soumise à la DRH'); done(); }
    else if (act === 'drh') {
      if (!isRH()) return ui.toast('Validation réservée à la DRH.', 'err');
      o.statut = 'valide_drh'; hist(o, 'Demande validée par la DRH — transmise à la Direction générale'); E.store.save(); E.log('Validation DRH', o.id + ' · ' + o.titre, 'recrutement');
      E.notify('Recrutement à valider (DG)', o.titre + ' · budget ' + fmt.short(o.budget) + ' FCFA/an', '#/recrutement/offre/' + o.id, 'orange'); ui.toast('Validée par la DRH — transmise à la Direction générale'); done();
    } else if (act === 'dg') {
      if (!isDG()) return ui.toast('Validation réservée à la Direction générale.', 'err');
      o.statut = 'approuvee'; hist(o, 'Demande validée par la Direction générale'); E.store.save(); E.log('Validation DG', o.id + ' · ' + o.titre, 'recrutement');
      E.notify('Recrutement approuvé', o.titre + ' — prêt à être publié', '#/recrutement/offre/' + o.id, 'green'); ui.toast('Recrutement approuvé par la Direction générale'); done();
    } else if (act === 'refuser') {
      ui.formModal({ title: 'Refuser la demande', sub: esc(o.titre), okLabel: 'Refuser', fields: [{ name: 'motif', label: 'Motif du refus', type: 'textarea', required: true }], onSubmit: function (v) {
        o.refusEtape = o.statut === 'valide_drh' ? 2 : 1; o.statut = 'refusee'; o.motifRefus = v.motif; hist(o, 'Demande refusée — ' + v.motif); E.store.save(); E.log('Demande refusée', o.id, 'recrutement'); ui.toast('Demande refusée'); setTimeout(done);
      } });
    } else if (act === 'publier') {
      if (!o.resume) { ui.toast('Complétez d\'abord le descriptif de l\'offre (résumé, missions, profil).', 'err'); return modifierOffre(o); }
      o.statut = 'publiee'; o.publie = today(); if (!o.cloture || o.cloture < today()) o.cloture = E.addDays(today(), 30);
      hist(o, 'Offre publiée sur le site carrières'); E.store.save(); E.log('Offre publiée', o.id + ' · ' + o.titre, 'recrutement'); ui.toast('Offre publiée : elle est visible dès maintenant sur la page Carrières du site'); done();
    } else if (act === 'retirer') {
      o.statut = 'approuvee'; hist(o, 'Offre retirée du site'); E.store.save(); E.log('Offre retirée du site', o.id, 'recrutement'); ui.toast('Offre retirée du site'); done();
    } else if (act === 'cloturer') {
      ui.confirm('Clôturer l\'offre', 'L\'offre <b>' + esc(o.titre) + '</b> sera retirée du site et n\'acceptera plus de candidatures. Les candidatures en cours restent consultables.', 'Clôturer', function () { o.statut = 'cloturee'; hist(o, 'Offre clôturée'); E.store.save(); E.log('Offre clôturée', o.id, 'recrutement'); ui.toast('Offre clôturée'); done(); }, 'danger');
    } else if (act === 'modifier') modifierOffre(o);
  }
  function modifierOffre(o) {
    ui.formModal({ title: 'Modifier l\'offre', sub: o.id, size: 'lg', fields: offreFields(o), onSubmit: function (v) {
      Object.assign(o, { titre: v.titre, direction: v.direction, lieu: v.lieu, contrat: v.contrat, niveau: v.niveau, categorie: v.categorie, postes: +v.postes || 1, cloture: v.cloture, budget: +v.budget || 0, resume: v.resume, missions: lines(v.missions), profil: lines(v.profil) });
      hist(o, 'Offre modifiée'); E.store.save(); ui.toast('Offre mise à jour' + (o.statut === 'publiee' ? ' (également sur le site)' : '')); setTimeout(E.rerender);
    } });
  }

  /* ------------------------------------------------------------ vues */
  function header(view, active) {
    var enCours = cands().filter(function (c) { return c.statut === 'En cours'; });
    var html = '<div class="rh-head"><div><h2>Recrutement & stages</h2><p>De la demande du manager à l\'arrivée du nouveau collaborateur — et accueil des jeunes du programme d\'employabilité</p></div><div class="rh-actions">' +
      (isRH() ? '<button class="btn" data-a="demande">' + icon('flag') + 'Demande de recrutement</button><button class="btn" data-a="offre">' + icon('plus') + 'Nouvelle offre</button><button class="btn primary" data-a="cand">' + icon('userplus') + 'Saisir une candidature</button>' : '') + '</div></div>' +
      ui.tabs([
        { k: 'tableau', l: 'Tableau de bord' }, { k: 'pipeline', l: 'Pipeline', n: enCours.length }, { k: 'candidatures', l: 'Candidatures', n: cands().length },
        { k: 'offres', l: 'Offres & demandes', n: offres().filter(function (o) { return ['demande', 'valide_drh'].indexOf(o.statut) >= 0; }).length || null }, { k: 'vivier', l: 'Vivier (spontanées)', n: cands().filter(function (c) { return !c.offreId; }).length }, { k: 'stages', l: 'Stages', n: stagiaires().filter(function (s) { var st = stStatut(s); return st === 'En cours' || st === 'À clôturer'; }).length }
      ], active, function (k) { E.go('recrutement/' + (k === 'tableau' ? '' : k)); });
    view.innerHTML = html + '<div id="rc-body"></div>';
    view.querySelectorAll('[data-a]').forEach(function (b) { b.onclick = function () { var a = b.dataset.a; if (a === 'demande') nouvelleDemande(); else if (a === 'offre') nouvelleOffre(); else nouvelleCandidature(); }; });
    return view.querySelector('#rc-body');
  }

  function hotBanner() {
    var news = cands().filter(function (c) { return !c.lu && c.statut === 'En cours'; });
    if (!news.length) return '';
    var web = news.filter(function (c) { return c.source === 'Site internet'; });
    var last = news.slice().sort(function (a, b) { return String(b.historique[b.historique.length - 1].date).localeCompare(String(a.historique[a.historique.length - 1].date)); })[0];
    return '<div class="rh-hot"><div class="rh-hot__ic">' + icon('inbox') + '</div><div style="position:relative;z-index:1;min-width:0"><b>' + news.length + ' nouvelle' + (news.length > 1 ? 's' : '') + ' candidature' + (news.length > 1 ? 's' : '') + ' à traiter</b><br><span>' + (web.length ? web.length + ' reçue' + (web.length > 1 ? 's' : '') + ' via le site carrières · ' : '') + 'dernière : ' + esc(last.nom) + ' — ' + esc(offTitle(last)) + '</span></div><a class="btn accent" href="#/recrutement/candidat/' + last.id + '">' + icon('eye') + 'Ouvrir la candidature</a></div>';
  }

  function renderDashboard(body) {
    var all = cands(), t = today(), m30 = E.addDays(t, -30);
    var pub = offres().filter(function (o) { return o.statut === 'publiee'; });
    var postes = E.sum(pub, function (o) { return o.postes || 1; });
    var recues = all.filter(function (c) { return c.date >= m30; });
    var enCours = all.filter(function (c) { return c.statut === 'En cours'; });
    var hired = all.filter(function (c) { return c.statut === 'Embauché'; });
    var delai = hired.length ? Math.round(E.sum(hired, function (c) { return E.daysBetween(c.date, c.dateEmbauche || t); }) / hired.length) : 0;
    var closed = all.filter(function (c) { return c.statut !== 'En cours'; });
    var taux = all.length ? (hired.length + all.filter(function (c) { return c.statut === 'En cours' && c.etape >= 5; }).length) / all.length * 100 : 0;
    var aValider = enCours.filter(function (c) { return c.etape === 4; }).length;
    var html = hotBanner() + '<div class="grid g4 rh-kpis">' +
      ui.kpi({ label: 'Postes ouverts', value: postes, icon: 'userplus', tone: 'violet', foot: pub.length + ' offres publiées sur le site' }) +
      ui.kpi({ label: 'Candidatures reçues (30 j)', value: recues.length, icon: 'inbox', tone: 'blue', foot: '<span class="up">' + recues.filter(function (c) { return c.source === 'Site internet'; }).length + '</span> via le site internet' }) +
      ui.kpi({ label: 'Candidatures en cours', value: enCours.length, icon: 'users', tone: 'orange', foot: aValider ? '<span class="down">' + aValider + '</span> en attente de la Direction' : 'Aucune validation en attente' }) +
      ui.kpi({ label: 'Délai moyen de recrutement', value: delai, unit: 'jours', icon: 'clock', tone: 'green', foot: 'Taux de transformation ' + fmt.pct(taux, 1) + ' · ' + closed.length + ' dossiers clos' }) + '</div>';
    /* entonnoir */
    var reach = ETAPES.map(function (_, i) { return all.filter(function (c) { return Math.max(c.etapeMax || 0, c.etape) >= i && !(c.statut === 'Rejetée' && c.etape < i); }).length; });
    var max = reach[0] || 1;
    var funnel = '<div class="rh-funnel">' + ETAPES.map(function (l, i) { return '<div class="rh-funnel__row"><span title="' + esc(l) + '">' + esc(l) + '</span><div class="rh-funnel__bar"><i style="width:' + (reach[i] / max * 100).toFixed(1) + '%;background:' + ETAPE_COL[i] + '"></i></div><b>' + reach[i] + '<small>' + (i ? fmt.pct(reach[i] / max * 100) : '100 %') + '</small></b></div>'; }).join('') + '</div>';
    var src = SOURCES.map(function (s) { return { label: s, value: all.filter(function (c) { return c.source === s; }).length, color: SRC_COL[s] }; });
    html += '<div class="grid g-2-1" style="margin-bottom:16px"><div class="card"><div class="card__h"><h3>Entonnoir de recrutement</h3><span class="sub">candidats ayant atteint chaque étape · ' + all.length + ' candidatures</span></div><div class="card__b">' + funnel + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Sources des candidatures</h3></div><div class="card__b">' + ui.donut(src, { center: all.length, sub: 'candidatures' }) + '</div></div></div>';
    /* offres + entretiens */
    var offRows = pub.map(function (o) { var cs = all.filter(function (c) { return c.offreId === o.id; }); var j = E.daysBetween(t, o.cloture); return '<a class="list__item" href="#/recrutement/offre/' + o.id + '" style="color:inherit"><div class="list__icon tone-violet">' + icon('userplus') + '</div><div class="list__body"><b>' + esc(o.titre) + '</b><div class="small muted">' + esc(o.direction) + ' · ' + esc(o.contrat) + ' · ' + cs.length + ' candidature(s), ' + cs.filter(function (c) { return c.statut === 'En cours'; }).length + ' en cours</div></div>' + ui.badge(j < 0 ? 'Échue' : 'J-' + j, j < 0 ? 'red' : j <= 15 ? 'orange' : 'grey') + '</a>'; }).join('');
    var meets = [];
    all.forEach(function (c) { (c.entretiens || []).forEach(function (e) { if (e.date >= t && c.statut === 'En cours') meets.push({ c: c, e: e }); }); });
    meets.sort(function (a, b) { return (a.e.date + a.e.heure).localeCompare(b.e.date + b.e.heure); });
    var meetRows = meets.slice(0, 7).map(function (x) { var d = E.parseDate(x.e.date); return '<a class="rh-meet" href="#/recrutement/candidat/' + x.c.id + '" style="color:inherit"><div class="rh-date"><em>' + E.MOIS[d.getMonth()] + '</em><b>' + d.getDate() + '</b></div><div style="min-width:0;flex:1"><b>' + esc(x.c.nom) + '</b><div class="small muted">' + esc(x.e.type) + ' · ' + esc(x.e.heure) + ' · ' + esc(x.e.lieu) + '</div><div class="small muted">' + esc(offTitle(x.c)) + '</div></div></a>'; }).join('');
    var lastRows = all.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 6).map(function (c) { return '<a class="list__item" href="#/recrutement/candidat/' + c.id + '" style="color:inherit">' + ui.avatar(c.nom, null, true) + '<div class="list__body"><b>' + esc(c.nom) + '</b> ' + (!c.lu ? '<span class="rh-new">Nouveau</span>' : '') + '<div class="small muted">' + esc(offTitle(c)) + ' · ' + esc(c.source) + ' · ' + fmt.date(c.date) + '</div></div>' + etapeBadge(c) + '</a>'; }).join('');
    html += '<div class="grid g3"><div class="card"><div class="card__h"><h3>Offres en ligne</h3><a class="btn ghost sm" style="margin-left:auto" href="../carrieres.html" target="_blank">' + icon('globe') + 'Voir le site</a></div><div class="list">' + (offRows || '<div class="empty">Aucune offre publiée</div>') + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Entretiens à venir</h3><span class="sub">' + meets.length + ' planifié(s)</span></div><div class="card__b" style="padding-top:4px;padding-bottom:4px">' + (meetRows || '<div class="empty">Aucun entretien planifié</div>') + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Dernières candidatures</h3><a class="btn ghost sm" style="margin-left:auto" href="#/recrutement/candidatures">Tout voir</a></div><div class="list">' + lastRows + '</div></div></div>';
    body.innerHTML = html;
  }

  var pipeFilter = { offre: '', rejets: false };
  function renderPipeline(body) {
    var opts = '<option value="">Toutes les offres</option><option value="__sp"' + (pipeFilter.offre === '__sp' ? ' selected' : '') + '>Candidatures spontanées</option>' + offres().filter(function (o) { return cands().some(function (c) { return c.offreId === o.id; }); }).map(function (o) { return '<option value="' + o.id + '"' + (pipeFilter.offre === o.id ? ' selected' : '') + '>' + esc(o.titre) + '</option>'; }).join('');
    var list = cands().filter(function (c) { return (pipeFilter.rejets || c.statut === 'En cours' || c.statut === 'Embauché') && (!pipeFilter.offre || (pipeFilter.offre === '__sp' ? !c.offreId : c.offreId === pipeFilter.offre)); });
    var cols = ETAPES.map(function (l, i) {
      var cs = list.filter(function (c) { return c.etape === i; }).sort(function (a, b) { return String(b.dateMaj || b.date).localeCompare(String(a.dateMaj || a.date)); });
      return '<div class="kcol" data-col="' + i + '"><div class="kcol__h"><i style="background:' + ETAPE_COL[i] + '"></i>' + esc(l) + (i === 4 ? ' ' + icon('lock', '') : '') + '<span class="n">' + cs.length + '</span></div>' +
        cs.map(function (c) {
          var nextBtn = c.statut !== 'En cours' ? '' : i < 4 ? '<button class="btn sm" data-next="' + c.id + '" title="Étape suivante">' + icon('arrow') + '</button>' : i === 4 ? (isDG() ? '<button class="btn sm success" data-next="' + c.id + '">Valider</button>' : '<span class="rh-lockmini" title="Validation réservée à la Direction générale">' + icon('lock') + 'DG</span>') : i === 5 ? '<button class="btn sm success" data-next="' + c.id + '">Embaucher</button>' : '';
          return '<div class="kcard rh-kcard' + (!c.lu ? ' is-new' : '') + '"' + (c.statut === 'En cours' && isRH() ? ' draggable="true"' : '') + ' data-id="' + c.id + '"><div class="rh-kcard__top">' + ui.avatar(c.nom, null, true) + '<div style="min-width:0"><b>' + esc(c.nom) + '</b><span class="small muted">' + esc(offTitle(c)) + '</span></div></div>' +
            '<div class="meta">' + (c.note ? stars(c.note) : '<span>Non évalué</span>') + (!c.lu ? '<span class="rh-new">Nouveau</span>' : '') + (c.statut !== 'En cours' ? etapeBadge(c) : '') + '</div>' +
            '<div class="rh-kcard__foot"><span class="small muted">' + esc(c.source) + ' · ' + fmt.dateShort(c.date) + '</span><span class="spacer"></span>' + nextBtn + '</div></div>';
        }).join('') + (cs.length ? '' : '<div class="small muted" style="text-align:center;padding:14px 4px">Aucun candidat</div>') + '</div>';
    }).join('');
    body.innerHTML = '<div class="filters"><select class="select" id="pf-of">' + opts + '</select><label class="chip' + (pipeFilter.rejets ? ' is-active' : '') + '" id="pf-rej">' + (pipeFilter.rejets ? '✓ ' : '') + 'Afficher les rejets et désistements</label><span class="spacer"></span><span class="small muted rh-hint">' + icon('info', '').replace('<svg', '<svg style="width:14px;vertical-align:-3px"') + ' Glissez-déposez une carte vers l\'étape suivante, ou utilisez les boutons</span></div>' +
      '<div class="kanban rh-kanban">' + cols + '</div>' +
      '<div class="alert tone-violet" style="margin-top:12px">' + icon('shield') + '<div><b>Contrôle interne :</b> le passage de « Validation direction » à « Proposition » est réservé au profil <b>Direction générale</b>. ' + (isDG() ? 'Vous êtes connecté avec ce profil.' : 'Vous êtes connecté en tant que ' + esc(user().role || '') + ' : vous pouvez soumettre, pas valider.') + '</div></div>';
    body.querySelector('#pf-of').onchange = function (e) { pipeFilter.offre = e.target.value; renderPipeline(body); };
    body.querySelector('#pf-rej').onclick = function () { pipeFilter.rejets = !pipeFilter.rejets; renderPipeline(body); };
    var redraw = function () { renderPipeline(body); E.renderBadges(); };
    body.querySelectorAll('.kcard').forEach(function (k) {
      k.addEventListener('click', function (e) { if (e.target.closest('button')) return; E.go('recrutement/candidat/' + k.dataset.id); });
      k.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', k.dataset.id); e.dataTransfer.effectAllowed = 'move'; k.classList.add('dragging'); });
      k.addEventListener('dragend', function () { k.classList.remove('dragging'); });
    });
    body.querySelectorAll('[data-next]').forEach(function (b) { b.onclick = function () { var c = cand(b.dataset.next); moveTo(c, c.etape + 1, redraw); }; });
    body.querySelectorAll('.kcol').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('drop'); });
      col.addEventListener('dragleave', function () { col.classList.remove('drop'); });
      col.addEventListener('drop', function (e) { e.preventDefault(); col.classList.remove('drop'); var c = cand(e.dataTransfer.getData('text/plain')); if (c) moveTo(c, +col.dataset.col, redraw); });
    });
  }

  var listF = { q: '', offre: '', etape: '', source: '', statut: '' };
  function candCols() {
    return [
      { label: 'Candidat', render: function (c) { return '<div class="row" style="gap:9px;flex-wrap:nowrap">' + ui.avatar(c.nom, null, true) + '<div><b>' + esc(c.nom) + '</b> ' + (!c.lu ? '<span class="rh-new">Nouveau</span>' : '') + '<div class="small muted">' + esc(c.diplome || '') + '</div></div></div>'; }, csv: function (c) { return c.nom; } },
      { label: 'Offre', render: function (c) { return esc(offTitle(c)) + (!c.offreId && c.domaine ? '<div class="small muted">' + esc(c.domaine) + '</div>' : ''); }, csv: offTitle },
      { label: 'Étape', render: etapeBadge, csv: function (c) { return c.statut === 'En cours' ? ETAPES[c.etape] : c.statut; } },
      { label: 'Source', key: 'source' },
      { label: 'Reçue le', render: function (c) { return fmt.date(c.date); }, csv: function (c) { return c.date; } },
      { label: 'Exp.', num: true, render: function (c) { return c.experience !== '' && c.experience != null ? c.experience + ' an(s)' : '—'; }, csv: function (c) { return c.experience; } },
      { label: 'Note', render: function (c) { return c.note ? stars(c.note) : '<span class="muted small">—</span>'; }, csv: function (c) { return c.note || ''; } }
    ];
  }
  function renderListe(body) {
    var sel = function (id, cur, opts, empty) { return '<select class="select" id="' + id + '"><option value="">' + empty + '</option>' + opts.map(function (o) { var v = typeof o === 'object' ? o.v : o, l = typeof o === 'object' ? o.l : o; return '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>'; };
    body.innerHTML = '<div class="filters"><input class="input" id="lf-q" type="search" placeholder="Rechercher un nom, un diplôme, une ville…" value="' + esc(listF.q) + '">' +
      sel('lf-of', listF.offre, [{ v: '__sp', l: 'Candidatures spontanées' }].concat(offres().map(function (o) { return { v: o.id, l: o.titre }; })), 'Toutes les offres') +
      sel('lf-et', listF.etape, ETAPES.map(function (l, i) { return { v: i, l: l }; }), 'Toutes les étapes') + sel('lf-src', listF.source, SOURCES, 'Toutes les sources') + sel('lf-st', listF.statut, ['En cours', 'Rejetée', 'Embauché', 'Désistement'], 'Tous les statuts') +
      '<span class="spacer"></span><button class="btn" id="lf-csv">' + icon('download') + 'Export CSV</button></div><div class="card" id="lf-res"></div>';
    var draw = function () {
      var q = E.norm(listF.q);
      var rows = cands().filter(function (c) {
        return (!q || E.norm(c.nom + ' ' + c.diplome + ' ' + c.ville + ' ' + c.email + ' ' + offTitle(c)).indexOf(q) >= 0) && (!listF.offre || (listF.offre === '__sp' ? !c.offreId : c.offreId === listF.offre)) &&
          (listF.etape === '' || c.etape === +listF.etape) && (!listF.source || c.source === listF.source) && (!listF.statut || c.statut === listF.statut);
      }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
      body.querySelector('#lf-res').innerHTML = '<div class="card__h"><h3>' + rows.length + ' candidature(s)</h3></div>' + ui.table(candCols(), rows, { onRow: function (c) { E.go('recrutement/candidat/' + c.id); }, empty: 'Aucune candidature ne correspond aux filtres' });
      body._rows = rows;
    };
    ['lf-of', 'lf-et', 'lf-src', 'lf-st'].forEach(function (id) { body.querySelector('#' + id).onchange = function (e) { listF[{ 'lf-of': 'offre', 'lf-et': 'etape', 'lf-src': 'source', 'lf-st': 'statut' }[id]] = e.target.value; draw(); }; });
    body.querySelector('#lf-q').oninput = function (e) { listF.q = e.target.value; draw(); };
    body.querySelector('#lf-csv').onclick = function () { ui.exportCSV('candidatures-gpm', candCols().concat([{ label: 'Courriel', key: 'email' }, { label: 'Téléphone', key: 'tel' }, { label: 'Ville', key: 'ville' }]), body._rows); };
    draw();
  }

  var ofFilter = 'toutes';
  function renderOffres(body) {
    var all = offres();
    var groups = { toutes: all, valider: all.filter(function (o) { return o.statut === 'demande' || o.statut === 'valide_drh'; }), ligne: all.filter(function (o) { return o.statut === 'publiee'; }), prep: all.filter(function (o) { return o.statut === 'brouillon' || o.statut === 'approuvee'; }), closes: all.filter(function (o) { return o.statut === 'cloturee' || o.statut === 'refusee'; }) };
    var labels = { toutes: 'Toutes', valider: 'À valider', ligne: 'En ligne', prep: 'Brouillons & approuvées', closes: 'Clôturées / refusées' };
    var ORD = { demande: 0, valide_drh: 1, approuvee: 2, brouillon: 3, publiee: 4, cloturee: 5, refusee: 6 };
    var cards = groups[ofFilter].slice().sort(function (a, b) { return (ORD[a.statut] - ORD[b.statut]) || String(b.publie || b.dateDemande).localeCompare(String(a.publie || a.dateDemande)); }).map(function (o) {
      var cs = cands().filter(function (c) { return c.offreId === o.id; });
      var st = { brouillon: 0, demande: 1, valide_drh: 2, approuvee: 3, publiee: 4, cloturee: 5 }[o.statut];
      var mini = OF_WF.map(function (_, i) { var cl = o.statut === 'refusee' ? (i < (o.refusEtape || 1) ? 'on' : i === (o.refusEtape || 1) ? 'ko' : '') : i < st ? 'on' : i === st ? 'cur' : ''; return '<i class="' + cl + '"></i>'; }).join('');
      var quick = '';
      if (o.statut === 'demande' && isRH()) quick = '<button class="btn sm success" data-oa="drh" data-id="' + o.id + '">' + icon('check') + 'Valider (DRH)</button>';
      else if (o.statut === 'valide_drh') quick = isDG() ? '<button class="btn sm success" data-oa="dg" data-id="' + o.id + '">' + icon('check') + 'Valider (DG)</button>' : '<span class="small" style="color:var(--violet)">En attente de la DG</span>';
      else if (o.statut === 'approuvee' && isRH()) quick = '<button class="btn sm accent" data-oa="publier" data-id="' + o.id + '">' + icon('globe') + 'Publier sur le site</button>';
      else if (o.statut === 'publiee' && isRH()) quick = '<button class="btn sm" data-oa="retirer" data-id="' + o.id + '">Retirer du site</button>';
      else if (o.statut === 'brouillon' && isRH()) quick = '<button class="btn sm" data-oa="soumettre" data-id="' + o.id + '">' + icon('send') + 'Soumettre</button>';
      return '<div class="card rh-offer" data-go="' + o.id + '"><div class="rh-offer__b"><div class="row" style="justify-content:space-between"><span class="mono muted">' + esc(o.id) + '</span>' + ofBadge(o) + '</div><h3>' + esc(o.titre) + '</h3><div class="rh-offer__meta"><span>' + esc(o.direction) + '</span><span>' + esc(o.contrat) + '</span><span>' + (o.postes || 1) + ' poste(s)</span>' + (o.budget ? '<span>' + fmt.short(o.budget) + ' FCFA/an</span>' : '') + '</div>' +
        '<div class="small muted">' + esc(o.resume || o.justification || '').slice(0, 140) + ((o.resume || o.justification || '').length > 140 ? '…' : '') + '</div><div class="rh-mini" title="Circuit : ' + OF_WF.join(' → ') + '">' + mini + '</div></div>' +
        '<div class="rh-offer__f"><span>' + icon('users', '').replace('<svg', '<svg style="width:14px;vertical-align:-2px"') + ' ' + cs.length + ' candidature(s)</span>' + (o.statut === 'publiee' ? '<span>clôture ' + fmt.dateShort(o.cloture) + '</span>' : '') + '<span class="spacer"></span>' + quick + '</div></div>';
    }).join('');
    body.innerHTML = '<div class="filters"><div class="chips">' + Object.keys(groups).map(function (k) { return '<button class="chip' + (k === ofFilter ? ' is-active' : '') + '" data-f="' + k + '">' + labels[k] + ' (' + groups[k].length + ')</button>'; }).join('') + '</div></div>' +
      '<div class="card" style="margin-bottom:16px"><div class="card__b">' + ui.steps(['Demande du manager', 'Validation DRH', 'Validation Direction générale', 'Publication sur le site', 'Clôture'], 5) + '<div class="small muted" style="text-align:center">Circuit d\'approbation de chaque recrutement : aucune offre n\'est publiée sans double validation.</div></div></div>' +
      '<div class="rh-offers">' + (cards || '<div class="card empty">Aucune offre dans cette catégorie</div>') + '</div>';
    body.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { ofFilter = b.dataset.f; renderOffres(body); }; });
    body.querySelectorAll('[data-oa]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); offreAction(offre(b.dataset.id), b.dataset.oa); }; });
    body.querySelectorAll('[data-go]').forEach(function (c) { c.onclick = function () { E.go('recrutement/offre/' + c.dataset.go); }; });
  }

  var vivF = { dom: '', q: '' };
  function renderVivier(body) {
    var sp = cands().filter(function (c) { return !c.offreId; });
    var doms = {}; sp.forEach(function (c) { var d = c.domaine || 'Autre'; doms[d] = (doms[d] || 0) + 1; });
    var q = E.norm(vivF.q);
    var list = sp.filter(function (c) { return (!vivF.dom || (c.domaine || 'Autre') === vivF.dom) && (!q || E.norm(c.nom + ' ' + c.diplome + ' ' + c.ville + ' ' + c.domaine).indexOf(q) >= 0); }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    body.innerHTML = '<div class="alert tone-blue" style="margin-bottom:14px">' + icon('info') + '<div><b>CVthèque :</b> les candidatures spontanées (site, papier, cooptation) alimentent un vivier classé par domaine. Rattachez un profil à une offre ouverte en un clic.</div></div>' +
      '<div class="filters"><input class="input" id="vf-q" type="search" placeholder="Rechercher dans le vivier…" value="' + esc(vivF.q) + '"><div class="chips"><button class="chip' + (!vivF.dom ? ' is-active' : '') + '" data-d="">Tous (' + sp.length + ')</button>' + Object.keys(doms).sort().map(function (d) { return '<button class="chip' + (vivF.dom === d ? ' is-active' : '') + '" data-d="' + esc(d) + '">' + esc(d.replace(/ \(.*\)/, '')) + ' (' + doms[d] + ')</button>'; }).join('') + '</div></div>' +
      '<div class="rh-people">' + (list.map(function (c) {
        return '<div class="card rh-person" data-id="' + c.id + '"><div class="rh-person__top">' + ui.avatar(c.nom) + '<div><b>' + esc(c.nom) + '</b> ' + (!c.lu ? '<span class="rh-new">Nouveau</span>' : '') + '<span class="small muted">' + esc(c.domaine || 'Autre') + '</span></div></div>' +
          '<div class="rh-person__info"><span>' + icon('graduation') + esc(c.diplome || '—') + '</span><span>' + icon('clock') + (c.experience !== '' && c.experience != null ? esc(c.experience) + ' an(s) d\'expérience' : 'Expérience non précisée') + '</span><span>' + icon('pin') + esc(c.ville || '—') + '</span><span>' + icon('file') + esc(c.cv || 'Pas de CV') + '</span></div>' +
          '<div class="rh-person__f">' + etapeBadge(c) + '<span class="small muted">' + fmt.dateShort(c.date) + '</span><span class="spacer"></span>' + (c.statut === 'En cours' && isRH() ? '<button class="btn sm" data-link="' + c.id + '">' + icon('link') + 'Rattacher</button>' : '') + '</div></div>';
      }).join('') || '<div class="card empty">Aucun profil</div>') + '</div>';
    body.querySelector('#vf-q').oninput = function (e) { vivF.q = e.target.value; var p = e.target.selectionStart; renderVivier(body); var i = body.querySelector('#vf-q'); i.focus(); i.setSelectionRange(p, p); };
    body.querySelectorAll('[data-d]').forEach(function (b) { b.onclick = function () { vivF.dom = b.dataset.d; renderVivier(body); }; });
    body.querySelectorAll('.rh-person').forEach(function (k) { k.onclick = function (e) { if (e.target.closest('button')) return; E.go('recrutement/candidat/' + k.dataset.id); }; });
    body.querySelectorAll('[data-link]').forEach(function (b) { b.onclick = function () { rattacher(cand(b.dataset.link)); }; });
  }
  function rattacher(c) {
    var pub = offres().filter(function (o) { return o.statut === 'publiee'; });
    ui.formModal({ title: 'Rattacher à une offre', sub: esc(c.nom), okLabel: 'Rattacher', fields: [{ name: 'offreId', label: 'Offre ouverte', type: 'select', options: pub.map(function (o) { return { v: o.id, l: o.titre }; }), required: true }], onSubmit: function (v) {
      c.offreId = v.offreId; save(c, 'Rattachée à l\'offre ' + v.offreId + ' — ' + offre(v.offreId).titre); ui.toast(c.nom + ' rattaché(e) à « ' + offre(v.offreId).titre + ' »'); setTimeout(E.rerender);
    } });
  }

  /* ---- stages : programme d'employabilité des jeunes */
  var stF = { service: '', vue: 'actifs' };
  function stageFields(s) {
    s = s || {};
    return [
      { name: 'nom', label: 'Nom et prénom du stagiaire', required: true, value: s.nom },
      { name: 'ecole', label: 'École / diplôme préparé', required: true, value: s.ecole },
      { name: 'service', label: 'Service d\'accueil', type: 'select', options: SERVICES_STAGE, value: s.service || SERVICES_STAGE[0] },
      { name: 'site', label: 'Site', type: 'select', options: E.options('sites'), value: s.site || 'OWE' },
      { name: 'tuteur', label: 'Tuteur', type: 'select', options: E.options('employes', function (e) { return e.nom + ' — ' + e.poste; }), value: s.tuteur || (empByName('Allogho') || {}).id },
      { name: 'gratification', label: 'Gratification mensuelle (FCFA)', type: 'money', value: s.gratification != null ? s.gratification : 100000 },
      { name: 'debut', label: 'Début du stage', type: 'date', required: true, value: s.debut || E.addDays(today(), 14) },
      { name: 'fin', label: 'Fin du stage', type: 'date', required: true, value: s.fin || E.addDays(today(), 104) },
      { name: 'theme', label: 'Thème / mission du stage', type: 'textarea', required: true, value: s.theme }
    ];
  }
  function nouveauStagiaire(pre) {
    ui.formModal({ title: 'Accueillir un stagiaire', sub: 'Programme d\'employabilité des jeunes — convention de stage', size: 'lg', fields: stageFields(pre), values: pre, okLabel: 'Enregistrer la convention',
      onSubmit: function (v) {
        if (v.fin <= v.debut) { ui.toast('La fin du stage doit suivre son début.', 'err'); return false; }
        var n = stagiaires().reduce(function (m, s) { var k = +String(s.id).split('-')[2] || 0; return Math.max(m, k); }, 0) + 1;
        var s = { id: 'STG-2026-' + String(n).padStart(3, '0'), nom: v.nom, ecole: v.ecole, service: v.service, site: v.site, tuteur: v.tuteur, debut: v.debut, fin: v.fin, theme: v.theme, gratification: +v.gratification || 0, statut: 'Actif', programme: 'Programme d\'employabilité des jeunes', presence: 100, rapport: false, origine: pre && pre.origine || '', historique: [] };
        hist(s, 'Convention de stage enregistrée'); E.store.add('stagiaires', s); E.log('Stagiaire accueilli', s.nom + ' · ' + s.service, 'recrutement');
        E.notify('Nouveau stagiaire : ' + s.nom, s.service + ' · tuteur ' + E.empName(s.tuteur), '#/recrutement/stages', 'green');
        if (pre && pre.origine) { var c = cand(pre.origine); if (c) { c.statut = 'Embauché'; c.etape = 6; c.etapeMax = 6; c.dateEmbauche = today(); c.stagiaireId = s.id; save(c, 'Accueilli(e) en stage — ' + s.id); } }
        ui.toast('Stagiaire ' + s.nom + ' enregistré(e)'); setTimeout(function () { E.go('recrutement/stages'); E.rerender(); });
      } });
  }
  function pointEtape(s) {
    ui.formModal({ title: 'Point d\'étape avec le tuteur', sub: esc(s.nom) + ' · ' + esc(s.service), fields: [{ name: 'presence', label: 'Taux de présence (%)', type: 'number', min: 0, value: s.presence || 100 }, { name: 'texte', label: 'Observations du tuteur', type: 'textarea', required: true }],
      onSubmit: function (v) { s.pointsEtape = s.pointsEtape || []; s.pointsEtape.unshift({ date: today(), par: E.empName(s.tuteur), texte: v.texte }); s.presence = +v.presence || 0; hist(s, 'Point d\'étape enregistré'); E.store.save(); E.log('Point d\'étape stage', s.nom, 'recrutement'); ui.toast('Point d\'étape enregistré'); setTimeout(E.rerender); } });
  }
  function cloturerStage(s) {
    ui.formModal({ title: 'Évaluation de fin de stage', sub: esc(s.nom) + ' · ' + esc(s.service), okLabel: 'Clôturer le stage',
      fields: [{ name: 'note', label: 'Note globale (sur 20)', type: 'number', min: 0, value: 15, required: true }, { name: 'rapport', label: 'Rapport de stage', type: 'select', options: ['Remis', 'Non remis'] }, { name: 'suite', label: 'Suite proposée', type: 'select', options: ['Vivier — à recontacter pour un recrutement', 'Prolongation à étudier', 'Aucune'] }, { name: 'appreciation', label: 'Appréciation du tuteur', type: 'textarea', required: true }],
      onSubmit: function (v) {
        s.statut = 'Terminé'; s.rapport = v.rapport === 'Remis'; s.evaluation = { note: +v.note, appreciation: v.appreciation, suite: v.suite, date: today(), attestation: true };
        hist(s, 'Stage clôturé — note ' + v.note + '/20'); E.store.save(); E.log('Stage clôturé', s.nom + ' · ' + v.note + '/20', 'recrutement'); ui.toast('Stage clôturé : l\'attestation peut être imprimée'); setTimeout(E.rerender);
      } });
  }
  function attestationHTML(s) {
    var tut = E.emp(s.tuteur);
    return '<div class="doc rh-doc"><div class="doc__head"><div class="row" style="gap:14px"><img src="../assets/img/logo.png" alt="GPM"><div class="co"><b>Gabon Port Management</b><span>Zone portuaire d\'Owendo — B.P. 394 Libreville</span><span>Gabon</span></div></div><div style="text-align:right"><span class="small muted">Réf. DRH/STG/' + esc(s.id.replace('STG-', '')) + '</span><br><b>Owendo, le ' + fmt.date(today()) + '</b></div></div>' +
      '<h2 style="text-align:center;margin:26px 0 18px">ATTESTATION DE STAGE</h2>' +
      '<p>Nous soussignés, Gabon Port Management (GPM), attestons que <b>' + esc(s.nom) + '</b>, étudiant(e) en ' + esc(s.ecole) + ', a effectué un stage au sein de notre service <b>' + esc(s.service) + '</b> (' + esc(E.siteName(s.site)) + ') du <b>' + fmt.date(s.debut) + '</b> au <b>' + fmt.date(s.fin) + '</b>, dans le cadre du programme d\'employabilité des jeunes.</p>' +
      '<p>Mission confiée : ' + esc(s.theme || '—') + '.</p>' +
      (s.evaluation ? '<p>Appréciation du tuteur (' + esc(tut ? tut.nom : '') + ') : « ' + esc(s.evaluation.appreciation) + ' »</p>' : '') +
      '<p>La présente attestation est délivrée pour servir et valoir ce que de droit.</p>' +
      '<div class="sign"><div>Le tuteur de stage<br><b>' + esc(tut ? tut.nom : '') + '</b></div><div>La Responsable des ressources humaines<br><b>' + DRH + '</b></div></div>' +
      '<div class="foot">Gabon Port Management · Owendo — Document généré par l\'espace de gestion (démonstration)</div></div>';
  }
  function attestation(s) {
    ui.modal({ title: 'Attestation de stage', sub: esc(s.nom), size: 'lg', body: '<div class="rh-doc-wrap">' + attestationHTML(s) + '</div>',
      actions: [{ label: 'Fermer' }, { label: 'Imprimer / PDF', icon: 'print', cls: 'primary', onClick: function () { printDoc('Attestation de stage — ' + s.nom, attestationHTML(s)); } }] });
  }
  function ficheStagiaire(s) {
    var tut = E.emp(s.tuteur), pe = s.pointsEtape || [], d = E.daysBetween(s.debut, s.fin) + 1, fait = Math.max(0, Math.min(d, E.daysBetween(s.debut, today()) + 1));
    var body = '<div class="row" style="gap:12px;margin-bottom:12px">' + ui.avatar(s.nom) + '<div style="min-width:0"><b>' + esc(s.nom) + '</b><div class="small muted">' + esc(s.ecole) + '</div></div><span class="spacer"></span>' + stBadge(s) + '</div>' +
      '<dl class="kv"><dt>Service</dt><dd>' + esc(s.service) + '</dd><dt>Site</dt><dd>' + esc(E.siteName(s.site)) + '</dd><dt>Tuteur</dt><dd>' + esc(tut ? tut.nom + ' — ' + tut.poste : '—') + '</dd><dt>Période</dt><dd>' + fmt.date(s.debut) + ' → ' + fmt.date(s.fin) + '</dd><dt>Gratification</dt><dd>' + fmt.money(s.gratification) + ' / mois</dd><dt>Présence</dt><dd>' + fmt.pct(s.presence || 0) + '</dd><dt>Mission</dt><dd>' + esc(s.theme) + '</dd></dl>' +
      '<div style="margin:14px 0 6px" class="small muted">Avancement du stage</div>' + ui.progress(fait / d * 100) +
      (s.evaluation ? '<div class="alert tone-green" style="margin-top:14px">' + icon('star') + '<div><b>Évaluation finale : ' + s.evaluation.note + '/20</b><br><span class="small">' + esc(s.evaluation.appreciation) + '</span></div></div>' : '') +
      '<h4 style="margin:16px 0 8px">Points d\'étape</h4>' + (pe.length ? pe.map(function (p) { return '<div class="rh-eval"><div class="rh-eval__h"><b>' + fmt.date(p.date) + '</b><span class="spacer"></span><span class="small muted">' + esc(p.par) + '</span></div><p>' + esc(p.texte) + '</p></div>'; }).join('') : '<div class="small muted">Aucun point d\'étape pour le moment.</div>');
    var actions = [{ label: 'Fermer' }];
    if (isRH() && s.statut !== 'Terminé') {
      actions.push({ label: 'Point d\'étape', icon: 'edit', onClick: function (close) { close(); pointEtape(s); } });
      actions.push({ label: 'Évaluer et clôturer', icon: 'check', cls: 'success', onClick: function (close) { close(); cloturerStage(s); } });
    }
    if (s.statut === 'Terminé') actions.push({ label: 'Attestation de stage', icon: 'doc', cls: 'primary', onClick: function (close) { close(); attestation(s); } });
    ui.modal({ title: 'Fiche stagiaire', sub: s.id + ' · ' + esc(s.programme || ''), body: body, actions: actions });
  }
  function renderStages(body) {
    var all = stagiaires(), t = today();
    var actifs = all.filter(function (s) { return stStatut(s) === 'En cours' || stStatut(s) === 'À clôturer'; });
    var tuteurs = {}; actifs.forEach(function (s) { tuteurs[s.tuteur] = 1; });
    var fin30 = actifs.filter(function (s) { return s.fin <= E.addDays(t, 30); });
    var cout = E.sum(actifs, 'gratification');
    var list = all.filter(function (s) { var st = stStatut(s); return (stF.vue === 'tous' || (stF.vue === 'actifs' ? (st === 'En cours' || st === 'À clôturer') : stF.vue === 'venir' ? st === 'À venir' : st === 'Terminé')) && (!stF.service || s.service === stF.service); })
      .sort(function (a, b) { return a.service.localeCompare(b.service) || a.nom.localeCompare(b.nom); });
    var cand = cands().filter(function (c) { var o = offre(c.offreId); return o && /^Stage/.test(o.contrat || '') && c.statut === 'En cours'; });
    var html = '<div class="rh-stage-hero card"><div class="card__b"><div class="rh-stage-hero__in"><div><span class="badge tone-yellow">Programme d\'employabilité des jeunes</span><h3>Former la relève des métiers portuaires</h3><p>Chaque promotion accueille une dizaine de jeunes diplômés dans les services HSE, grutiers, commercial, qualité et projets, accompagnés par un tuteur et évalués en fin de parcours.</p></div><div class="rh-actions">' + (isRH() ? '<button class="btn accent" id="st-new">' + icon('userplus') + 'Accueillir un stagiaire</button>' : '') + '<button class="btn" id="st-csv">' + icon('download') + 'Exporter</button></div></div></div></div>' +
      '<div class="grid g4 rh-kpis">' +
      ui.kpi({ label: 'Stagiaires en cours', value: actifs.length, icon: 'graduation', tone: 'violet', foot: all.filter(function (s) { return stStatut(s) === 'À venir'; }).length + ' arrivée(s) programmée(s)' }) +
      ui.kpi({ label: 'Services d\'accueil', value: SERVICES_STAGE.filter(function (sv) { return actifs.some(function (s) { return s.service === sv; }); }).length, unit: '/ ' + SERVICES_STAGE.length, icon: 'layers', tone: 'blue', foot: Object.keys(tuteurs).length + ' tuteur(s) mobilisé(s)' }) +
      ui.kpi({ label: 'Fins de stage à 30 jours', value: fin30.length, icon: 'calendar', tone: fin30.length ? 'orange' : 'green', foot: fin30.length ? 'évaluations finales à préparer' : 'aucune échéance proche' }) +
      ui.kpi({ label: 'Gratifications mensuelles', value: fmt.short(cout), unit: 'FCFA', icon: 'wallet', tone: 'green', foot: cand.length + ' candidature(s) de stage en cours' }) + '</div>';
    var rep = SERVICES_STAGE.map(function (sv) { return { label: sv, value: actifs.filter(function (s) { return s.service === sv; }).length, color: SERV_COL[sv] }; });
    html += '<div class="grid g-2-1" style="margin-bottom:16px"><div class="card"><div class="card__h"><h3>Stagiaires</h3><span class="sub">' + list.length + ' affiché(s)</span></div>' +
      '<div class="card__b" style="padding-bottom:6px"><div class="filters" style="margin:0"><div class="chips" id="st-vue">' + [['actifs', 'En cours'], ['venir', 'À venir'], ['termines', 'Terminés'], ['tous', 'Tous']].map(function (c) { return '<button class="chip' + (stF.vue === c[0] ? ' is-active' : '') + '" data-v="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div><select class="select" id="st-sv"><option value="">Tous les services</option>' + SERVICES_STAGE.map(function (s) { return '<option' + (stF.service === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></div></div>' +
      ui.table([
        { label: 'Stagiaire', render: function (s) { return '<div class="row" style="gap:9px;flex-wrap:nowrap">' + ui.avatar(s.nom, null, true) + '<div><b>' + esc(s.nom) + '</b><div class="small muted">' + esc(s.ecole) + '</div></div></div>'; } },
        { label: 'Service', render: function (s) { return '<span class="rh-dot" style="background:' + SERV_COL[s.service] + '"></span>' + esc(s.service) + '<div class="small muted">' + esc(E.siteName(s.site)) + '</div>'; } },
        { label: 'Tuteur', render: function (s) { return esc(E.empName(s.tuteur)); } },
        { label: 'Période', render: function (s) { return '<span class="nowrap">' + fmt.dateShort(s.debut) + ' → ' + fmt.dateShort(s.fin) + '</span>'; } },
        { label: 'Statut', render: function (s) { return stBadge(s) + (s.evaluation ? ' <b class="small">' + s.evaluation.note + '/20</b>' : ''); } }
      ], list, { onRow: function (s) { ficheStagiaire(s); }, empty: 'Aucun stagiaire dans cette sélection' }) + '</div>' +
      '<div class="stack"><div class="card"><div class="card__h"><h3>Répartition par service</h3></div><div class="card__b">' + ui.donut(rep, { center: actifs.length, sub: 'en cours' }) + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Candidatures de stage</h3><a class="btn ghost sm" style="margin-left:auto" href="#/recrutement/offre/OF-2026-025">Offre</a></div><div class="list">' + (cand.length ? cand.map(function (c) { return '<a class="list__item" href="#/recrutement/candidat/' + c.id + '" style="color:inherit">' + ui.avatar(c.nom, null, true) + '<div class="list__body"><b>' + esc(c.nom) + '</b><div class="small muted">' + esc(c.diplome) + '</div></div>' + etapeBadge(c) + '</a>'; }).join('') : '<div class="empty">Aucune candidature de stage en cours</div>') + '</div></div></div></div>';
    body.innerHTML = html;
    var n = body.querySelector('#st-new'); if (n) n.onclick = function () { nouveauStagiaire(); };
    body.querySelector('#st-csv').onclick = function () { ui.exportCSV('stagiaires-gpm', [{ label: 'Réf.', key: 'id' }, { label: 'Stagiaire', key: 'nom' }, { label: 'École', key: 'ecole' }, { label: 'Service', key: 'service' }, { label: 'Site', key: 'site' }, { label: 'Tuteur', csv: function (s) { return E.empName(s.tuteur); } }, { label: 'Début', key: 'debut' }, { label: 'Fin', key: 'fin' }, { label: 'Statut', csv: stStatut }, { label: 'Note /20', csv: function (s) { return s.evaluation ? s.evaluation.note : ''; } }], list); };
    body.querySelector('#st-vue').addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (b) { stF.vue = b.dataset.v; renderStages(body); } });
    body.querySelector('#st-sv').onchange = function (e) { stF.service = e.target.value; renderStages(body); };
  }

  /* ---- fiche candidat */
  function renderFiche(view, id) {
    var c = cand(id);
    if (!c) { view.innerHTML = '<a class="rh-back" href="#/recrutement/candidatures">' + icon('back') + 'Candidatures</a><div class="card empty">Candidature introuvable.</div>'; return; }
    if (!c.lu) { c.lu = true; E.store.save(); E.renderBadges(); }
    var o = offre(c.offreId), actif = c.statut === 'En cours', et = c.etape;
    var acts = [];
    if (actif && isRH()) {
      if (et === 0) acts.push('<button class="btn primary" data-x="next">' + icon('check') + 'Présélectionner</button>');
      if (et === 1) acts.push('<button class="btn primary" data-x="plan">' + icon('calendar') + 'Convoquer en entretien RH</button>', '<button class="btn" data-x="next">' + icon('arrow') + 'Étape suivante</button>');
      if (et === 2) acts.push('<button class="btn" data-x="plan">' + icon('calendar') + 'Planifier un entretien</button>', '<button class="btn primary" data-x="next">' + icon('arrow') + 'Passer aux tests techniques</button>');
      if (et === 3) acts.push('<button class="btn" data-x="plan">' + icon('calendar') + 'Planifier un entretien</button>', '<button class="btn primary" data-x="next">' + icon('send') + 'Soumettre à la Direction</button>');
      if (et === 5) acts.push('<button class="btn accent" data-x="lettre">' + icon('doc') + 'Lettre de proposition</button>', '<button class="btn success" data-x="next">' + icon('check') + 'Proposition acceptée : embaucher</button>', '<button class="btn danger" data-x="desist">Désistement</button>');
      if (et <= 4) acts.push('<button class="btn" data-x="eval">' + icon('star') + 'Ajouter une évaluation</button>');
      if (et <= 4) acts.push('<button class="btn danger" data-x="reject">' + icon('x') + 'Rejeter</button>');
    }
    if (actif && et === 4 && isDG()) acts.unshift('<button class="btn success" data-x="next">' + icon('shield') + 'Valider l\'embauche</button>');
    if (!actif && c.statut !== 'Embauché' && isRH()) acts.push('<button class="btn" data-x="react">' + icon('refresh') + 'Réactiver</button>');
    if (c.statut === 'Embauché' && c.employeId) acts.push('<a class="btn primary" href="#/personnel/' + (c.employeId || '') + '">' + icon('users') + 'Voir la fiche employé ' + esc(c.employeId || '') + '</a>', '<button class="btn" data-x="lettre">' + icon('doc') + 'Lettre de proposition</button>');
    if (!c.offreId && actif && isRH()) acts.push('<button class="btn" data-x="link">' + icon('link') + 'Rattacher à une offre</button>');
    if (o && /^Stage/.test(o.contrat || '') && actif && isRH()) acts.unshift('<button class="btn accent" data-x="stage">' + icon('graduation') + 'Accueillir en stage</button>');
    if (c.stagiaireId) acts.push('<a class="btn" href="#/recrutement/stages">' + icon('graduation') + 'Voir le stagiaire ' + esc(c.stagiaireId) + '</a>');

    var lock = actif && et === 4 ? (isDG() ? '<div class="alert tone-violet" style="margin-top:14px">' + icon('shield') + '<div><b>Votre validation est attendue.</b> Le dossier a été soumis par la DRH le ' + fmt.date(c.dateMaj) + '. Validez l\'embauche pour fixer les conditions de la proposition, ou rejetez la candidature.</div></div>'
      : '<div class="rh-lock" style="margin-top:14px">' + icon('lock') + '<div><b>« Valider l\'embauche » est réservé à la Direction générale.</b><br>Dossier transmis le ' + fmt.date(c.dateMaj) + ' — en attente de décision. <a href="#" data-x="relance">Relancer la Direction</a></div></div>') : '';
    var statusAlert = c.statut === 'Rejetée' ? '<div class="alert tone-red" style="margin-top:14px">' + icon('x') + '<div><b>Candidature rejetée</b> le ' + fmt.date(c.rejet && c.rejet.date) + ' par ' + esc(c.rejet && c.rejet.par || '') + ' — ' + esc(c.rejet && c.rejet.motif || '') + (c.rejet && c.rejet.commentaire ? '<br><span class="small">' + esc(c.rejet.commentaire) + '</span>' : '') + '</div></div>'
      : c.statut === 'Embauché' && c.stagiaireId ? '<div class="alert tone-green" style="margin-top:14px">' + icon('graduation') + '<div><b>Accueilli(e) en stage le ' + fmt.date(c.dateEmbauche) + '</b> — dossier ' + esc(c.stagiaireId) + ' (programme d\'employabilité des jeunes).</div></div>'
      : c.statut === 'Embauché' ? '<div class="alert tone-green" style="margin-top:14px">' + icon('check') + '<div><b>Embauché(e) le ' + fmt.date(c.dateEmbauche) + '</b> — matricule ' + esc(c.employeId || '') + ', prise de poste le ' + fmt.date(c.proposition && c.proposition.dateEntree) + ' (période d\'essai).</div></div>'
      : c.statut === 'Désistement' ? '<div class="alert tone-grey" style="margin-top:14px">' + icon('info') + '<div><b>Le candidat s\'est désisté.</b></div></div>' : '';

    var evs = (c.evaluations || []).map(function (e) { return '<div class="rh-eval"><div class="rh-eval__h"><b>' + esc(e.etape) + '</b>' + (e.note ? stars(e.note) : ui.badge('Décision', 'violet')) + '<span class="spacer"></span><span class="small muted">' + esc(e.par) + ' · ' + fmt.date(e.date) + '</span></div><p>' + esc(e.commentaire) + '</p></div>'; }).join('');
    var t = today();
    var meets = (c.entretiens || []).slice().sort(function (a, b) { return (b.date + b.heure).localeCompare(a.date + a.heure); }).map(function (e) { var d = E.parseDate(e.date), past = e.date < t; return '<div class="rh-meet"><div class="rh-date' + (past ? ' past' : '') + '"><em>' + E.MOIS[d.getMonth()] + '</em><b>' + d.getDate() + '</b></div><div style="flex:1;min-width:0"><b>' + esc(e.type) + '</b> ' + (past ? ui.badge('Réalisé', 'grey') : ui.badge('À venir', 'blue')) + '<div class="small muted">' + esc(e.heure) + ' · ' + esc(e.lieu) + '</div><div class="small muted">Jury : ' + esc(e.jury) + '</div></div></div>'; }).join('');
    var hi = '<div class="timeline">' + (c.historique || []).map(function (h, i) { return '<div class="tl-item ' + (i === 0 ? (c.statut === 'Rejetée' ? 'rejected' : 'current') : 'done') + '"><b>' + esc(h.action) + '</b><span>' + (String(h.date).length > 10 ? fmt.datetime(h.date) : fmt.date(h.date)) + ' · ' + esc(h.par) + '</span></div>'; }).join('') + '</div>';
    var prop = c.proposition ? '<div class="card"><div class="card__h"><h3>Conditions proposées</h3>' + (c.proposition.envoyee ? ui.badge('Envoyée le ' + fmt.dateShort(c.proposition.envoyee), 'green') : ui.badge('À envoyer', 'orange')) + '</div><div class="card__b"><dl class="kv"><dt>Poste</dt><dd>' + esc(c.proposition.poste) + '</dd><dt>Direction</dt><dd>' + esc(E.dirName(c.proposition.direction)) + '</dd><dt>Catégorie</dt><dd>' + esc(c.proposition.categorie) + '</dd><dt>Salaire de base</dt><dd><b>' + fmt.money(c.proposition.salaire) + '</b> / mois</dd><dt>Prise de poste</dt><dd>' + fmt.date(c.proposition.dateEntree) + '</dd><dt>Période d\'essai</dt><dd>' + esc(c.proposition.essai) + '</dd></dl></div></div>' : '';

    view.innerHTML = '<a class="rh-back" href="#/recrutement/' + (c.offreId ? 'pipeline' : 'vivier') + '">' + icon('back') + (c.offreId ? 'Pipeline' : 'Vivier') + '</a>' +
      '<div class="card" style="margin-bottom:16px"><div class="card__b"><div class="rh-hero">' + ui.avatar(c.nom) + '<div style="min-width:0;flex:1"><h2>' + esc(c.nom) + '</h2><div class="rh-hero__meta"><span>' + icon('userplus') + (o ? '<a href="#/recrutement/offre/' + o.id + '">' + esc(o.titre) + '</a>' : esc(offTitle(c)) + (c.domaine ? ' · ' + esc(c.domaine) : '')) + '</span><span>' + icon('pin') + esc(c.ville || '—') + '</span><span>' + icon('globe') + esc(c.source) + '</span><span>' + icon('calendar') + 'Reçue le ' + fmt.date(c.date) + '</span><span class="mono">' + esc(c.id) + '</span></div></div>' +
      '<div class="rh-hero__side">' + etapeBadge(c) + (c.note ? '<div class="row" style="gap:6px">' + stars(c.note, true) + '<b>' + fmt.num(c.note, 1) + '</b></div>' : '<span class="small muted">Pas encore évalué</span>') + '</div></div>' +
      '<div style="margin-top:16px">' + ui.steps(ETAPES, c.statut === 'Embauché' ? 6 : c.etape, { rejected: c.statut === 'Rejetée' || c.statut === 'Désistement', finished: c.statut === 'Embauché' }) + '</div>' +
      lock + statusAlert + (acts.length ? '<div class="rh-actions" style="margin-top:14px">' + acts.join('') + '</div>' : '') + '</div></div>' +
      '<div class="grid g-2-1"><div class="stack">' +
      '<div class="card"><div class="card__h"><h3>Évaluations</h3><span class="sub">' + (c.evaluations || []).length + ' avis</span>' + (actif && isRH() ? '<button class="btn sm" style="margin-left:auto" data-x="eval">' + icon('plus') + 'Évaluer</button>' : '') + '</div><div class="card__b" style="padding-top:4px;padding-bottom:4px">' + (evs || '<div class="empty" style="padding:24px">Aucune évaluation pour le moment</div>') + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Entretiens</h3>' + (actif && isRH() && et <= 4 ? '<button class="btn sm" style="margin-left:auto" data-x="plan">' + icon('calendar') + 'Planifier</button>' : '') + '</div><div class="card__b" style="padding-top:4px;padding-bottom:4px">' + (meets || '<div class="empty" style="padding:24px">Aucun entretien planifié</div>') + '</div></div>' +
      (c.message ? '<div class="card"><div class="card__h"><h3>Message de motivation</h3></div><div class="card__b"><div class="rh-quote">' + esc(c.message) + '</div></div></div>' : '') +
      '</div><div class="stack">' + prop +
      '<div class="card"><div class="card__h"><h3>Informations</h3></div><div class="card__b"><dl class="kv"><dt>Courriel</dt><dd>' + (c.email ? '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : '—') + '</dd><dt>Téléphone</dt><dd>' + esc(c.tel || '—') + '</dd><dt>Ville</dt><dd>' + esc(c.ville || '—') + '</dd><dt>Diplôme</dt><dd>' + esc(c.diplome || '—') + '</dd><dt>Expérience</dt><dd>' + (c.experience !== '' && c.experience != null ? esc(c.experience) + ' an(s)' : '—') + '</dd><dt>Source</dt><dd>' + esc(c.source) + (c.webId ? ' <span class="mono small muted">' + esc(c.webId) + '</span>' : '') + '</dd></dl>' +
      '<div class="rh-file" style="margin-top:14px"><div class="rh-file__ic">PDF</div><div style="min-width:0;flex:1"><b>' + esc(c.cv || 'CV non fourni') + '</b><span class="small muted">Curriculum vitae</span></div>' + (c.cv ? '<button class="btn sm" data-x="cv">' + icon('eye') + 'Voir</button>' : '') + '</div></div></div>' +
      '<div class="card"><div class="card__h"><h3>Historique</h3></div><div class="card__b">' + hi + '</div></div></div></div>';

    var map = { next: function () { moveTo(c, c.etape + 1); }, plan: function () { planifier(c); }, eval: function () { evaluer(c); }, reject: function () { rejeter(c); }, lettre: function () { lettre(c); }, desist: function () { desistement(c); }, react: function () { reactiver(c); }, cv: function () { voirCV(c); }, link: function () { rattacher(c); }, stage: function () { nouveauStagiaire({ nom: c.nom, ecole: c.diplome, origine: c.id, site: /Port-Gentil/i.test(c.ville || '') ? 'POG' : 'OWE' }); },
      relance: function () { E.notify('Relance : validation d\'embauche', c.nom + ' — ' + offTitle(c), '#/recrutement/candidat/' + c.id, 'orange'); hist(c, 'Relance envoyée à la Direction générale'); E.store.save(); ui.toast('Relance envoyée à la Direction générale'); } };
    view.querySelectorAll('[data-x]').forEach(function (b) { b.onclick = function (e) { e.preventDefault(); map[b.dataset.x](); }; });
  }

  /* ---- fiche offre */
  function renderOffre(view, id) {
    var o = offre(id);
    if (!o) { view.innerHTML = '<a class="rh-back" href="#/recrutement/offres">' + icon('back') + 'Offres</a><div class="card empty">Offre introuvable.</div>'; return; }
    var cs = cands().filter(function (c) { return c.offreId === o.id; });
    var cur = { brouillon: 0, demande: 1, valide_drh: 2, approuvee: 3, publiee: 3, cloturee: 4 }[o.statut];
    var steps = o.statut === 'refusee' ? ui.steps(OF_WF, o.refusEtape || 1, { rejected: true }) : ui.steps(OF_WF, cur, { finished: o.statut === 'publiee' || o.statut === 'cloturee' });
    var acts = [];
    if (o.statut === 'brouillon' && isRH()) acts.push('<button class="btn primary" data-oa="soumettre">' + icon('send') + 'Soumettre au circuit de validation</button>');
    if (o.statut === 'demande' && isRH()) acts.push('<button class="btn success" data-oa="drh">' + icon('check') + 'Valider (DRH)</button>', '<button class="btn danger" data-oa="refuser">Refuser</button>');
    if (o.statut === 'valide_drh') { if (isDG()) acts.push('<button class="btn success" data-oa="dg">' + icon('shield') + 'Valider (Direction générale)</button>', '<button class="btn danger" data-oa="refuser">Refuser</button>'); }
    if (o.statut === 'approuvee' && isRH()) acts.push('<button class="btn accent" data-oa="publier">' + icon('globe') + 'Publier sur le site</button>');
    if (o.statut === 'publiee' && isRH()) acts.push('<a class="btn" href="../carrieres.html" target="_blank">' + icon('eye') + 'Voir sur le site</a>', '<button class="btn" data-oa="retirer">Retirer du site</button>', '<button class="btn danger" data-oa="cloturer">Clôturer</button>');
    if (o.statut !== 'cloturee' && o.statut !== 'refusee' && isRH()) acts.push('<button class="btn" data-oa="modifier">' + icon('edit') + 'Modifier</button>');
    if (o.statut === 'publiee' && isRH()) acts.push('<button class="btn" data-oa="cand">' + icon('userplus') + 'Ajouter une candidature</button>');
    var wait = o.statut === 'valide_drh' && !isDG() ? '<div class="rh-lock" style="margin-top:14px">' + icon('lock') + '<div><b>En attente de la Direction générale.</b> La DRH a validé ; seule la Direction générale peut approuver l\'ouverture du poste.</div></div>' : o.statut === 'refusee' ? '<div class="alert tone-red" style="margin-top:14px">' + icon('x') + '<div><b>Demande refusée.</b> ' + esc(o.motifRefus || '') + '</div></div>' : o.statut === 'publiee' ? '<div class="alert tone-green" style="margin-top:14px">' + icon('globe') + '<div><b>En ligne sur la page Carrières</b> depuis le ' + fmt.date(o.publie) + ' — clôture des candidatures le ' + fmt.date(o.cloture) + '.</div></div>' : '';
    var dem = o.demandeur ? E.emp(o.demandeur) : null;
    view.innerHTML = '<a class="rh-back" href="#/recrutement/offres">' + icon('back') + 'Offres & demandes</a>' +
      '<div class="card" style="margin-bottom:16px"><div class="card__b"><div class="rh-hero"><div class="list__icon tone-violet" style="width:54px;height:54px;border-radius:14px">' + icon('userplus') + '</div><div style="flex:1;min-width:0"><h2>' + esc(o.titre) + '</h2><div class="rh-hero__meta"><span class="mono">' + esc(o.id) + '</span><span>' + icon('factory') + esc(o.direction) + '</span><span>' + icon('pin') + esc(o.lieu || 'Owendo') + '</span><span>' + icon('doc') + esc(o.contrat) + '</span><span>' + icon('users') + (o.postes || 1) + ' poste(s)</span></div></div><div class="rh-hero__side">' + ofBadge(o) + '</div></div>' +
      '<div style="margin-top:16px">' + steps + '</div>' + wait + (acts.length ? '<div class="rh-actions" style="margin-top:14px">' + acts.join('') + '</div>' : '') + '</div></div>' +
      '<div class="grid g-2-1"><div class="stack">' +
      '<div class="card"><div class="card__h"><h3>Descriptif de l\'offre</h3><span class="sub">tel qu\'affiché sur le site</span></div><div class="card__b">' + (o.resume ? '<p style="margin-top:0">' + esc(o.resume) + '</p>' : '<p class="muted" style="margin-top:0">Descriptif à rédiger avant publication.</p>') +
      (o.missions && o.missions.length ? '<b>Missions</b><ul class="rh-list-ul">' + o.missions.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '') + (o.profil && o.profil.length ? '<div style="margin-top:10px"><b>Profil recherché</b><ul class="rh-list-ul">' + o.profil.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></div>' : '') + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Candidatures</h3><span class="sub">' + cs.length + '</span></div>' + ui.table(candCols().filter(function (c) { return c.label !== 'Offre'; }), cs, { onRow: function (c) { E.go('recrutement/candidat/' + c.id); }, empty: 'Aucune candidature pour cette offre' }) + '</div>' +
      '</div><div class="stack"><div class="card"><div class="card__h"><h3>Demande de recrutement</h3></div><div class="card__b"><dl class="kv"><dt>Demandeur</dt><dd>' + (dem ? esc(dem.nom) + '<div class="small muted">' + esc(dem.poste) + '</div>' : '—') + '</dd><dt>Date de la demande</dt><dd>' + fmt.date(o.dateDemande) + '</dd><dt>Catégorie</dt><dd>' + esc(o.categorie || '—') + '</dd><dt>Budget annuel</dt><dd><b>' + (o.budget ? fmt.money(o.budget) : '—') + '</b></dd><dt>Niveau</dt><dd>' + esc(o.niveau || '—') + '</dd>' + (o.arrivee ? '<dt>Arrivée souhaitée</dt><dd>' + fmt.date(o.arrivee) + '</dd>' : '') + '</dl>' +
      (o.justification ? '<div style="margin-top:12px"><b class="small">Justification</b><div class="rh-quote" style="margin-top:6px">' + esc(o.justification) + '</div></div>' : '') + '</div></div>' +
      '<div class="card"><div class="card__h"><h3>Circuit de validation</h3></div><div class="card__b"><div class="timeline">' + (o.historique || []).map(function (h, i) { return '<div class="tl-item ' + (i === 0 && ['demande', 'valide_drh', 'brouillon'].indexOf(o.statut) >= 0 ? 'current' : o.statut === 'refusee' && i === 0 ? 'rejected' : 'done') + '"><b>' + esc(h.action) + '</b><span>' + (String(h.date).length > 10 ? fmt.datetime(h.date) : fmt.date(h.date)) + ' · ' + esc(h.par) + '</span></div>'; }).join('') + '</div></div></div></div></div>';
    view.querySelectorAll('[data-oa]').forEach(function (b) { b.onclick = function () { if (b.dataset.oa === 'cand') nouvelleCandidature(o.id); else offreAction(o, b.dataset.oa); }; });
  }

  /* ------------------------------------------------------------ enregistrement */
  window.addEventListener('storage', function (e) {
    if (e.key !== WEB_KEY) return;
    try { if (importSite(false)) { E.renderBadges(); if (/^#\/recrutement/.test(location.hash)) E.rerender(); } } catch (x) { console.warn(x); }
  });

  E.register({
    id: 'recrutement', label: 'Recrutement & stages', title: 'Recrutement & stages', icon: 'userplus', group: 'Ressources humaines', roles: ['rh'],
    seed: function () { return { offres: seedOffres(), candidatures: seedCandidatures(), stagiaires: seedStagiaires() }; },
    init: function () { ensureHired(); importSite(true); },
    render: function (view, p) {
      importSite(false);
      var tab = p[0] || 'tableau';
      if (tab === 'candidat' && p[1]) return renderFiche(view, p[1]);
      if (tab === 'offre' && p[1]) return renderOffre(view, p[1]);
      if (['tableau', 'pipeline', 'candidatures', 'offres', 'vivier', 'stages'].indexOf(tab) < 0) tab = 'tableau';
      var body = header(view, tab);
      ({ tableau: renderDashboard, pipeline: renderPipeline, candidatures: renderListe, offres: renderOffres, vivier: renderVivier, stages: renderStages })[tab](body);
    },
    summary: function () {
      var pub = offres().filter(function (o) { return o.statut === 'publiee'; }), enc = cands().filter(function (c) { return c.statut === 'En cours'; });
      var nw = cands().filter(function (c) { return !c.lu; }).length;
      var stg = stagiaires().filter(function (s) { var st = stStatut(s); return st === 'En cours' || st === 'À clôturer'; }).length;
      return [{ label: 'Postes ouverts', value: String(E.sum(pub, function (o) { return o.postes || 1; })), icon: 'userplus', tone: 'violet', foot: enc.length + ' candidatures en cours' + (nw ? ' · ' + nw + ' nouvelle(s)' : ''), href: '#/recrutement' },
        { label: 'Stagiaires en cours', value: String(stg), icon: 'graduation', tone: 'yellow', foot: 'programme d\'employabilité des jeunes', href: '#/recrutement/stages' }];
    },
    pending: function (u) {
      var out = [];
      if (u.profile === 'admin') {
        cands().filter(function (c) { return c.statut === 'En cours' && c.etape === 4; }).forEach(function (c) { out.push({ title: 'Embauche à valider · ' + c.nom, sub: offTitle(c) + ' · soumis par la DRH', date: c.dateMaj, href: '#/recrutement/candidat/' + c.id, tone: 'violet' }); });
        offres().filter(function (o) { return o.statut === 'valide_drh'; }).forEach(function (o) { out.push({ title: 'Ouverture de poste · ' + o.titre, sub: 'Validée par la DRH · budget ' + fmt.short(o.budget) + ' FCFA/an', date: o.dateDemande, href: '#/recrutement/offre/' + o.id, tone: 'orange' }); });
      }
      if (u.profile === 'rh') {
        offres().filter(function (o) { return o.statut === 'demande'; }).forEach(function (o) { out.push({ title: 'Demande de recrutement · ' + o.titre, sub: 'Demandée par ' + E.empName(o.demandeur) + ' · validation DRH', date: o.dateDemande, href: '#/recrutement/offre/' + o.id, tone: 'orange' }); });
        cands().filter(function (c) { return !c.lu && c.statut === 'En cours'; }).forEach(function (c) { out.push({ title: 'Nouvelle candidature · ' + c.nom, sub: offTitle(c) + ' · ' + c.source, date: c.date, href: '#/recrutement/candidat/' + c.id, tone: 'violet' }); });
        cands().filter(function (c) { return c.statut === 'En cours' && c.etape === 5 && c.proposition && !c.proposition.envoyee; }).forEach(function (c) { out.push({ title: 'Lettre de proposition à envoyer · ' + c.nom, sub: offTitle(c), date: c.dateMaj, href: '#/recrutement/candidat/' + c.id, tone: 'green' }); });
        stagiaires().filter(function (s) { return stStatut(s) === 'À clôturer'; }).forEach(function (s) { out.push({ title: 'Évaluation de fin de stage · ' + s.nom, sub: s.service + ' · tuteur ' + E.empName(s.tuteur), date: s.fin, href: '#/recrutement/stages', tone: 'orange' }); });
      }
      return out;
    },
    search: function (q) {
      var r = [];
      cands().forEach(function (c) { if (E.norm(c.nom + ' ' + c.id + ' ' + c.email).indexOf(q) >= 0) r.push({ title: c.nom, sub: offTitle(c) + ' · ' + (c.statut === 'En cours' ? ETAPES[c.etape] : c.statut), href: '#/recrutement/candidat/' + c.id }); });
      offres().forEach(function (o) { if (E.norm(o.titre + ' ' + o.id).indexOf(q) >= 0) r.push({ title: o.titre, sub: o.id + ' · ' + (OF_ST[o.statut] || {}).l, href: '#/recrutement/offre/' + o.id }); });
      stagiaires().forEach(function (s) { if (E.norm(s.nom + ' ' + s.id + ' ' + s.service).indexOf(q) >= 0) r.push({ title: s.nom, sub: 'Stagiaire · ' + s.service + ' · ' + stStatut(s), href: '#/recrutement/stages' }); });
      return r;
    },
    badge: function () {
      var u = user();
      if (u.profile === 'admin') return cands().filter(function (c) { return c.statut === 'En cours' && c.etape === 4; }).length + offres().filter(function (o) { return o.statut === 'valide_drh'; }).length;
      return cands().filter(function (c) { return !c.lu && c.statut === 'En cours'; }).length + offres().filter(function (o) { return o.statut === 'demande'; }).length;
    }
  });
})();
