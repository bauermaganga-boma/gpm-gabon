/* Gabon Port Management — données partagées entre le site public et l'espace de gestion (démonstration).
   Le site public lit d'abord les données enregistrées par l'espace de gestion (localStorage, clé gpm_erp_v1),
   sinon il utilise les valeurs par défaut ci-dessous. Ainsi, une escale confirmée, une offre publiée ou un avis
   aux navigateurs saisi dans le back-office apparaît aussitôt sur le site.
   Toutes les escales, offres et avis ci-dessous sont des EXEMPLES DE DÉMONSTRATION (navires fictifs). */
(function () {
  'use strict';
  var T0 = new Date(); T0.setHours(0, 0, 0, 0);
  /* date relative à aujourd'hui : d(2, 14) -> ISO « aaaa-mm-jjT14:00 » dans 2 jours */
  function d(days, hour, min) {
    var x = new Date(T0); x.setDate(x.getDate() + days); x.setHours(hour || 0, min || 0, 0, 0);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') + 'T' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0');
  }
  function day(days) { return d(days).slice(0, 10); }

  /* ---------------------------------------------------------------- escales (navires fictifs)
     statut : 'Annoncée' | 'Confirmée' | 'En rade' | 'À quai' | 'En opérations' | 'Appareillé' */
  var ESCALES = [
    { id: 'ESC-2026-0412', navire: 'MV Atlantic Akanda', imo: '9700001', pavillon: 'Libéria', type: 'Porte-conteneurs', client: 'C-01', consignataire: 'Équateur Maritime Agency (démo)', site: 'OWE', poste: 'OWE-P1', loa: 186, te: 9.1, eta: d(-1, 6), etd: d(1, 18), ata: d(-1, 7, 30), atd: '', statut: 'En opérations', operations: 'Déchargement / chargement conteneurs', evp: 1180, fait: 62 },
    { id: 'ESC-2026-0413', navire: 'MV Gulf Pioneer', imo: '9700002', pavillon: 'Malte', type: 'Porte-conteneurs', client: 'C-02', consignataire: 'Gulf of Guinea Shipping (démo)', site: 'OWE', poste: 'OWE-P2', loa: 172, te: 8.8, eta: d(0, 14), etd: d(2, 10), ata: '', atd: '', statut: 'En rade', operations: 'Déchargement / chargement conteneurs', evp: 940, fait: 0 },
    { id: 'ESC-2026-0414', navire: 'MV Ro-Ro Estuaire', imo: '9700003', pavillon: 'Panama', type: 'Roulier (RoRo)', client: 'C-04', consignataire: 'Ro-Ro Africa Lines (démo)', site: 'OWE', poste: 'OWE-P3', loa: 199, te: 8.6, eta: d(-2, 9), etd: d(0, 20), ata: d(-2, 10), atd: '', statut: 'À quai', operations: 'Débarquement de 420 véhicules', evp: 0, fait: 85 },
    { id: 'ESC-2026-0415', navire: 'MT Ogooué Star', imo: '9700004', pavillon: 'Îles Marshall', type: 'Pétrolier produits', client: 'C-08', consignataire: 'West Africa Tankers (démo)', site: 'OWE', poste: 'OWE-P4', loa: 145, te: 8.9, eta: d(1, 5), etd: d(2, 8), ata: '', atd: '', statut: 'Confirmée', operations: 'Déchargement produits pétroliers', evp: 0, fait: 0 },
    { id: 'ESC-2026-0416', navire: 'MV Cap Esterias', imo: '9700005', pavillon: 'Libéria', type: 'Vraquier', client: 'C-03', consignataire: 'Équateur Maritime Agency (démo)', site: 'OWE', poste: 'OWE-P1', loa: 168, te: 9.3, eta: d(2, 7), etd: d(5, 16), ata: '', atd: '', statut: 'Confirmée', operations: 'Déchargement vrac (clinker)', evp: 0, fait: 0 },
    { id: 'ESC-2026-0417', navire: 'MV Atlantic Mondah', imo: '9700006', pavillon: 'Malte', type: 'Porte-conteneurs', client: 'C-01', consignataire: 'Équateur Maritime Agency (démo)', site: 'OWE', poste: 'OWE-P2', loa: 182, te: 9.0, eta: d(3, 22), etd: d(5, 12), ata: '', atd: '', statut: 'Annoncée', operations: 'Déchargement / chargement conteneurs', evp: 1050, fait: 0 },
    { id: 'ESC-2026-0418', navire: 'MV Gulf Trader', imo: '9700007', pavillon: 'Portugal', type: 'Navire conventionnel', client: 'C-02', consignataire: 'Gulf of Guinea Shipping (démo)', site: 'OWE', poste: 'OWE-P3', loa: 138, te: 7.8, eta: d(4, 8), etd: d(6, 18), ata: '', atd: '', statut: 'Annoncée', operations: 'Marchandises diverses', evp: 0, fait: 0 },
    { id: 'ESC-2026-0409', navire: 'MV Atlantic Pongara', imo: '9700008', pavillon: 'Libéria', type: 'Porte-conteneurs', client: 'C-01', consignataire: 'Équateur Maritime Agency (démo)', site: 'OWE', poste: 'OWE-P2', loa: 180, te: 9.2, eta: d(-4, 5), etd: d(-2, 16), ata: d(-4, 6), atd: d(-2, 17, 30), statut: 'Appareillé', operations: 'Déchargement / chargement conteneurs', evp: 1210, fait: 100 },
    { id: 'ESC-2026-0420', navire: 'PSV Offshore Mandji', imo: '9700009', pavillon: 'Gabon', type: 'Ravitailleur offshore', client: 'C-05', consignataire: 'Offshore Supply Gabon (démo)', site: 'POG', poste: 'POG-P2', loa: 78, te: 6.2, eta: d(-1, 15), etd: d(0, 22), ata: d(-1, 15, 20), atd: '', statut: 'En opérations', operations: 'Chargement matériel offshore, eau douce, soutage', evp: 0, fait: 70 },
    { id: 'ESC-2026-0421', navire: 'MV Cap Lopez Express', imo: '9700010', pavillon: 'Cameroun', type: 'Porte-conteneurs feeder', client: 'C-06', consignataire: 'Cap Lopez Shipping (démo)', site: 'POG', poste: 'POG-P1', loa: 132, te: 7.4, eta: d(1, 11), etd: d(2, 15), ata: '', atd: '', statut: 'Confirmée', operations: 'Déchargement / chargement conteneurs', evp: 420, fait: 0 },
    { id: 'ESC-2026-0422', navire: 'MT West Gentil', imo: '9700011', pavillon: 'Îles Marshall', type: 'Pétrolier', client: 'C-08', consignataire: 'West Africa Tankers (démo)', site: 'POG', poste: 'POG-P3', loa: 120, te: 7.2, eta: d(0, 9), etd: d(0, 21), ata: d(0, 9, 15), atd: '', statut: 'À quai', operations: 'Soutage gasoil marin + eau douce', evp: 0, fait: 40 },
    { id: 'ESC-2026-0423', navire: 'PSV Ogooué Supplier', imo: '9700012', pavillon: 'Gabon', type: 'Ravitailleur offshore', client: 'C-05', consignataire: 'Offshore Supply Gabon (démo)', site: 'POG', poste: 'POG-P2', loa: 70, te: 5.9, eta: d(3, 7), etd: d(3, 20), ata: '', atd: '', statut: 'Annoncée', operations: 'Eau douce et soutage', evp: 0, fait: 0 }
  ];

  /* ---------------------------------------------------------------- avis aux navigateurs (exemples) */
  var AVIS = [
    { id: 'AVN-2026-031', date: day(-1), site: 'OWE', titre: 'Travaux de défenses au poste 3', texte: 'Remplacement de deux défenses d\'accostage au poste 3 du port d\'Owendo. Les navires y accostant sont priés de réduire leur vitesse d\'approche et de suivre les instructions du pilote.', niveau: 'Information', jusqu: day(6) },
    { id: 'AVN-2026-030', date: day(-3), site: 'POG', titre: 'Levé hydrographique dans le chenal d\'accès', texte: 'La vedette hydrographique opère dans le chenal d\'accès de Port-Gentil de 7 h à 17 h. Veille VHF obligatoire et passage à distance de sécurité.', niveau: 'Prudence', jusqu: day(4) },
    { id: 'AVN-2026-028', date: day(-8), site: 'OWE', titre: 'Exercice de sûreté portuaire (ISPS)', texte: 'Exercice de sûreté prévu sur la zone portuaire d\'Owendo. Les accès piétons et véhicules pourront être ralentis pendant deux heures.', niveau: 'Information', jusqu: day(-7) }
  ];

  /* ---------------------------------------------------------------- offres d'emploi et de stage (exemples) */
  var OFFRES = [
    { id: 'OF-2026-021', titre: 'Pilote maritime', direction: 'Services maritimes', lieu: 'Owendo (Libreville)', contrat: 'CDI', niveau: 'Brevet de capitaine · 5 ans de navigation', publie: day(-20), cloture: day(30), statut: 'publiee',
      resume: 'Assurer en sécurité l\'entrée, la sortie et les mouvements des navires dans les eaux portuaires d\'Owendo.',
      missions: ['Embarquer à bord des navires et conseiller le commandant pendant la manœuvre', 'Coordonner les remorqueurs et les lamaneurs', 'Rendre compte des conditions nautiques et des incidents', 'Participer aux exercices de sécurité et de sûreté'],
      profil: ['Brevet de capitaine ou officier de quart passerelle', 'Expérience de navigation au long cours ou au cabotage', 'Anglais maritime (SMCP)', 'Sang-froid, rigueur, aptitude médicale à la navigation'] },
    { id: 'OF-2026-022', titre: 'Grutier de grue mobile portuaire', direction: 'Terminal & manutention', lieu: 'Owendo (Libreville)', contrat: 'CDI', niveau: 'CAP/BEP · 3 ans de conduite d\'engins', publie: day(-15), cloture: day(25), statut: 'publiee',
      resume: 'Conduire les grues mobiles portuaires pour le chargement et le déchargement des conteneurs et des marchandises.',
      missions: ['Réaliser les opérations de levage en respectant le plan de chargement', 'Effectuer les contrôles de prise de poste', 'Signaler toute anomalie au chef de quai', 'Contribuer aux objectifs de cadence (mouvements par heure)'],
      profil: ['Expérience de conduite de grue ou d\'engins de levage', 'Certificat d\'aptitude (CACES ou équivalent) apprécié', 'Travail en équipe et en horaires décalés', 'Culture sécurité'] },
    { id: 'OF-2026-023', titre: 'Mécanicien engins portuaires', direction: 'Service technique', lieu: 'Owendo (Libreville)', contrat: 'CDI', niveau: 'BTS maintenance · 3 ans', publie: day(-12), cloture: day(20), statut: 'publiee',
      resume: 'Assurer la maintenance préventive et corrective des grues, reach stackers et engins du terminal.',
      missions: ['Diagnostiquer les pannes hydrauliques, mécaniques et électriques', 'Réaliser les entretiens planifiés (250 h, 500 h, 1 000 h)', 'Renseigner les ordres de travail dans l\'outil de gestion', 'Gérer les pièces de rechange avec le magasin'],
      profil: ['BTS/DUT maintenance industrielle ou engins', 'Expérience sur engins de manutention lourde', 'Lecture de schémas hydrauliques', 'Disponibilité pour les astreintes'] },
    { id: 'OF-2026-024', titre: 'Responsable soutage & eau douce', direction: 'Exploitation — Port-Gentil', lieu: 'Port-Gentil', contrat: 'CDI', niveau: 'Bac+3 · 5 ans', publie: day(-10), cloture: day(28), statut: 'publiee',
      resume: 'Piloter les livraisons de soutage et d\'eau douce aux navires escalant à Port-Gentil, en sécurité et en conformité.',
      missions: ['Planifier les livraisons avec les consignataires', 'Superviser les opérations de transfert et les contrôles qualité', 'Tenir les stocks et les bons de livraison', 'Faire appliquer les règles HSE et de prévention des pollutions'],
      profil: ['Formation technique ou logistique pétrolière', 'Connaissance des opérations de soutage', 'Rigueur documentaire', 'Leadership de terrain'] },
    { id: 'OF-2026-025', titre: 'Stages — programme d\'employabilité des jeunes', direction: 'Ressources humaines', lieu: 'Owendo et Port-Gentil', contrat: 'Stage 3 à 6 mois', niveau: 'Bac+2 à Bac+5', publie: day(-6), cloture: day(45), statut: 'publiee',
      resume: 'GPM accueille des jeunes diplômés en stage dans ses métiers : HSE, grutiers, commercial, qualité et projets.',
      missions: ['Découvrir les opérations d\'un port polyvalent', 'Participer aux projets du service d\'accueil', 'Être accompagné par un tuteur', 'Présenter un rapport de fin de stage'],
      profil: ['Jeune diplômé(e) ou étudiant(e) en fin de cycle', 'Motivation pour les métiers portuaires', 'Respect des règles de sécurité', 'Curiosité et esprit d\'équipe'] },
    { id: 'OF-2026-026', titre: 'Chargé(e) de clientèle armateurs', direction: 'Commercial', lieu: 'Owendo (Libreville)', contrat: 'CDI', niveau: 'Bac+3/4 · 3 ans', publie: day(-4), cloture: day(35), statut: 'publiee',
      resume: 'Être l\'interlocuteur des armateurs et consignataires : demandes d\'escale, devis, suivi des prestations et facturation.',
      missions: ['Traiter les demandes d\'escale et établir les devis', 'Suivre la satisfaction des clients', 'Préparer les éléments de facturation', 'Participer à la prospection de nouvelles lignes'],
      profil: ['Formation commerce international, transport ou logistique', 'Connaissance du shipping appréciée', 'Anglais professionnel', 'Sens du service'] }
  ];

  /* ---------------------------------------------------------------- projets internes (démonstration, non publiés) */
  var PROJETS = [
    { id: 'PRJ-01', code: 'DEF-P3', nom: 'Remplacement des défenses du poste 3 (Owendo)', public: false, resume: 'Remplacement des défenses d\'accostage et des bollards du poste roulier.', partenaire: 'Marine Rope & Fenders (démo)', debut: day(-60), fin: day(40), avancement: 55, statut: 'En cours', budget: 380000000, engage: 240000000, chef: 'Service technique',
      jalons: [{ d: day(-60), t: 'Commande des défenses', fait: true }, { d: day(-5), t: 'Réception des défenses', fait: true }, { d: day(40), t: 'Réception des travaux', fait: false }],
      taches: [{ t: 'Commande et fabrication', s: day(-60), e: day(-10), p: 100, lot: 'Achats' }, { t: 'Dépose des anciennes défenses', s: day(-8), e: day(10), p: 50, lot: 'Travaux' }, { t: 'Pose et essais', s: day(8), e: day(40), p: 0, lot: 'Travaux' }] },
    { id: 'PRJ-02', code: 'DRAG', nom: 'Dragage d\'entretien du chenal (Port-Gentil)', public: false, resume: 'Levé hydrographique puis dragage d\'entretien pour maintenir le tirant d\'eau.', partenaire: 'Hydro Survey Africa (démo)', debut: day(-30), fin: day(120), avancement: 20, statut: 'En cours', budget: 1200000000, engage: 180000000, chef: 'Service technique',
      jalons: [{ d: day(-3), t: 'Levé hydrographique', fait: true }, { d: day(45), t: 'Démarrage du dragage', fait: false }, { d: day(120), t: 'Levé de contrôle', fait: false }],
      taches: [{ t: 'Levé hydrographique', s: day(-30), e: day(5), p: 80, lot: 'Études' }, { t: 'Consultation dragueurs', s: day(0), e: day(40), p: 10, lot: 'Achats' }, { t: 'Dragage', s: day(45), e: day(110), p: 0, lot: 'Travaux' }] },
    { id: 'PRJ-03', code: 'DIGIT', nom: 'Guichet numérique armateurs', public: false, resume: 'Demandes d\'escale, suivi des navires et factures en ligne pour les armateurs et consignataires.', partenaire: 'Rouana (démo)', debut: day(-20), fin: day(70), avancement: 35, statut: 'En cours', budget: 95000000, engage: 30000000, chef: 'Systèmes d\'information',
      jalons: [{ d: day(-20), t: 'Lancement', fait: true }, { d: day(30), t: 'Ouverture aux premiers armateurs', fait: false }, { d: day(70), t: 'Généralisation', fait: false }],
      taches: [{ t: 'Site et demandes d\'escale en ligne', s: day(-20), e: day(10), p: 80, lot: 'Développement' }, { t: 'Espace de gestion interne', s: day(-10), e: day(40), p: 30, lot: 'Développement' }, { t: 'Formation des équipes', s: day(30), e: day(70), p: 0, lot: 'Conduite du changement' }] },
    { id: 'PRJ-04', code: 'GR-REV', nom: 'Révision générale de la grue n° 1', public: false, resume: 'Révision des mécanismes de levage et d\'orientation après 22 000 heures.', partenaire: 'Crane Parts Europe (démo)', debut: day(20), fin: day(75), avancement: 0, statut: 'Planifié', budget: 260000000, engage: 0, chef: 'Service technique',
      jalons: [{ d: day(20), t: 'Immobilisation de la grue', fait: false }, { d: day(75), t: 'Remise en service', fait: false }],
      taches: [{ t: 'Approvisionnement des pièces', s: day(0), e: day(20), p: 40, lot: 'Achats' }, { t: 'Révision', s: day(20), e: day(70), p: 0, lot: 'Maintenance' }, { t: 'Essais de charge', s: day(70), e: day(75), p: 0, lot: 'Maintenance' }] }
  ];

  function read(key) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  var db = read('gpm_erp_v1');
  var col = function (name, def) { return db && db.c && Array.isArray(db.c[name]) ? db.c[name] : def; };
  function push(key, obj, prefix) {
    var list = read(key) || [];
    obj.id = prefix + '-' + Date.now().toString(36).toUpperCase();
    obj.date = new Date().toISOString();
    list.push(obj); write(key, list); return obj.id;
  }

  window.GPM_DATA = {
    escalesDefaut: ESCALES, avisDefaut: AVIS, offresDefaut: OFFRES, projetsDefaut: PROJETS,
    escales: function () { return col('escales', ESCALES); },
    avis: function () { return col('avis', AVIS); },
    offres: function () { return col('offres', OFFRES).filter(function (o) { return o.statut === 'publiee'; }); },
    projets: function () { return col('projets', PROJETS).filter(function (p) { return p.public; }); },
    /* Envois depuis le site public : stockés localement (démonstration), repris par l'espace de gestion. */
    candidater: function (c) { return push('gpm_candidatures_site', c, 'WEB'); },        /* -> module Recrutement */
    demanderEscale: function (c) { return push('gpm_demandes_escale_site', c, 'DEM'); },  /* -> module Escales */
    contacter: function (c) { return push('gpm_contacts_site', c, 'MSG'); },             /* -> module Commercial */
    demandesEscale: function () { return read('gpm_demandes_escale_site') || []; }
  };
})();
