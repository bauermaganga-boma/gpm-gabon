/* GPM · Espace de gestion — module « Magasin & stocks »
   Magasins de pièces de rechange et consommables des ports d'Owendo et de Port-Gentil :
   pièces de grues mobiles portuaires et d'engins de parc (reach stackers), aussières, défenses et accastillage,
   pièces navales (remorqueurs, vedettes), huiles et filtres, EPI, matériel antipollution.
   Articles reliés aux équipements de la flotte (collection commune `flotte`), bons de sortie imputés aux ordres
   de travail, réapprovisionnement (→ demandes d'achat du module Achats), inventaire tournant.
   Le carburant marin (soutage) est suivi dans le module Soutage. */
(function () {
  'use strict';
  var E = window.ERP; if (!E) return;
  var U = E.ui, F = E.fmt, S = E.store, esc = E.esc, sum = E.sum;

  /* feuille de style des modules Opérations (si la coquille ne l'a pas déjà chargée) */
  if (!document.querySelector('link[href*="operations.css"]')) { var lk = document.createElement('link'); lk.rel = 'stylesheet'; lk.href = 'css/operations.css'; document.head.appendChild(lk); }

  E.addIcons({ rope: '<path d="M4 18c2.5-4 5.5-4 8 0s5.5 4 8 0"/><path d="M4 12c2.5-4 5.5-4 8 0s5.5 4 8 0"/><path d="M4 6c2.5-4 5.5-4 8 0s5.5 4 8 0"/>' });

  var TYPES_S = { 'Entrée': { s: 1, tone: 'green' }, 'Sortie': { s: -1, tone: 'orange' }, 'Retour': { s: 1, tone: 'blue' }, 'Inventaire': { s: 1, tone: 'violet' } };
  var MAGASINS = { OWE: 'Magasin central — Owendo', POG: 'Magasin de Port-Gentil' };
  var CAT_ICON = { 'Pièces de grues': 'crane', 'Engins de parc': 'container', 'Amarrage & accastillage': 'anchor', 'Levage & élingage': 'crane', 'Huiles & lubrifiants': 'drop', 'Pièces navales': 'tug', 'EPI & sécurité': 'helmet', 'Antipollution': 'wave', 'Électricité': 'gauge' };

  /* ------------------------------------------------------------------ petits utilitaires */
  function pad(n) { return String(n).padStart(2, '0'); }
  function signed(n, dec) { return (n > 0 ? '+' : n < 0 ? '−' : '') + F.num(Math.abs(n), dec); }
  function empIdByName(part) { var e = S.all('employes').find(function (x) { return x.nom.indexOf(part) === 0; }); return e ? e.id : ''; }
  function empOpts() { return S.all('employes').map(function (e) { return { v: e.id, l: e.nom + ' — ' + e.poste }; }); }
  function flotte() { return S.all('flotte'); }
  function eqName(id) { var f = S.get('flotte', id); return f ? f.nom : id; }

  /* ------------------------------------------------------------------ calculs magasin */
  function articles() { return S.all('articles'); }
  function artStatut(a) { return a.qte <= 0 ? 'Rupture' : a.qte <= a.min ? 'Sous seuil' : a.qte > a.max ? 'Surstock' : 'Disponible'; }
  var ART_TONE = { 'Rupture': 'red', 'Sous seuil': 'orange', 'Surstock': 'violet', 'Disponible': 'green' };
  function sousSeuil() { return articles().filter(function (a) { return a.qte <= a.min; }); }
  function valeurStock(list) { return sum(list || articles(), function (a) { return a.qte * a.pu; }); }
  function rotation() { var v = valeurStock(); return v ? sum(articles(), function (a) { return (a.consoAn || 0) * a.pu; }) / v : 0; }
  function couvMois(a) { return a.consoAn ? a.qte / (a.consoAn / 12) : null; }
  function fournNom(id) { var f = S.get('fournisseurs', id); return f ? f.nom : id || '—'; }
  function invAValider() { return S.all('inventaires').filter(function (i) { return i.statut === 'À valider'; }); }
  function artsOf(eqId) { return articles().filter(function (a) { return (a.equipements || []).indexOf(eqId) >= 0; }); }
  function eqRisk(eqId) { return artsOf(eqId).filter(function (a) { return a.critique && a.qte <= a.min; }); }

  /* ------------------------------------------------------------------ alertes */
  function alerts() {
    var out = [];
    var rupt = articles().filter(function (a) { return a.qte <= 0; });
    rupt.forEach(function (a) { out.push({ tone: 'red', icon: 'box', title: 'Rupture : ' + a.designation, sub: MAGASINS[a.site || 'OWE'] + (a.daEnCours ? ' · demande ' + a.daEnCours + ' en cours' : ' · aucune demande d\'achat en cours'), href: '#/stocks/magasin/' + a.id }); });
    var crit = sousSeuil().filter(function (a) { return a.critique && a.qte > 0; });
    if (crit.length) out.push({ tone: 'red', icon: 'alert', title: crit.length + ' article(s) critique(s) sous le seuil mini', sub: crit.slice(0, 3).map(function (a) { return a.designation; }).join(' · '), href: '#/stocks/reappro' });
    flotte().forEach(function (f) { var r = eqRisk(f.id); if (r.length) out.push({ tone: 'orange', icon: 'wrench', title: f.nom + ' : ' + r.length + ' pièce(s) critique(s) à risque', sub: r.map(function (a) { return a.designation; }).slice(0, 2).join(' · '), href: '#/stocks/equipements' }); });
    var std = sousSeuil().filter(function (a) { return !a.critique; });
    if (std.length) out.push({ tone: 'orange', icon: 'box', title: std.length + ' autre(s) article(s) sous seuil', sub: std.slice(0, 3).map(function (a) { return a.designation; }).join(' · '), href: '#/stocks/reappro' });
    var inv = invAValider();
    if (inv.length) out.push({ tone: 'violet', icon: 'check', title: inv.length + ' écart(s) d\'inventaire à valider', sub: inv.map(function (i) { return i.articleId; }).join(', '), href: '#/stocks/inventaire' });
    return out;
  }

  /* ------------------------------------------------------------------ données d'exemple */
  function seed() {
    var t = E.today(), D = function (n) { return E.addDays(t, n); }, Y = E.TODAY.getFullYear();
    var GR = ['GR-01', 'GR-02', 'GR-03'], RS = ['RS-01', 'RS-02', 'RS-03'], RM = ['RM-01', 'RM-02', 'RM-03'], VP = ['VP-01', 'VP-02'];
    /* [désignation, catégorie, unité, qté, mini, maxi, PU, fournisseur, critique, emplacement, conso/an, magasin, équipements] */
    var A = [
      ['Câble de levage antigiratoire Ø 30 mm (grue mobile)', 'Pièces de grues', 'm', 180, 220, 600, 38000, 'F-002', 1, 'A-01-1', 420, 'OWE', GR],
      ['Filtre hydraulique haute pression (grue mobile)', 'Pièces de grues', 'u', 14, 8, 30, 145000, 'F-002', 1, 'A-01-2', 36, 'OWE', GR],
      ['Joint de couronne d\'orientation (grue mobile)', 'Pièces de grues', 'u', 2, 1, 4, 1850000, 'F-002', 1, 'A-01-3', 2, 'OWE', GR],
      ['Twistlocks automatiques de spreader (jeu de 4)', 'Pièces de grues', 'jeu', 3, 2, 8, 920000, 'F-002', 1, 'A-02-1', 6, 'OWE', GR.concat(RS)],
      ['Cellule de mesure de charge (limiteur de grue)', 'Pièces de grues', 'u', 1, 1, 3, 2400000, 'F-002', 1, 'A-02-2', 1, 'OWE', GR],
      ['Pneu reach stacker 18.00-25 40 PR', 'Engins de parc', 'u', 4, 6, 16, 1650000, 'F-008', 1, 'B-01-1', 14, 'OWE', RS],
      ['Filtre à huile moteur reach stacker', 'Engins de parc', 'u', 22, 12, 40, 28000, 'F-008', 0, 'B-01-2', 60, 'OWE', RS],
      ['Flexible hydraulique de mât (reach stacker)', 'Engins de parc', 'u', 6, 4, 12, 240000, 'F-008', 0, 'B-01-3', 10, 'OWE', RS],
      ['Batterie 12 V 180 Ah (engins de parc)', 'Engins de parc', 'u', 5, 4, 12, 185000, 'F-008', 0, 'B-02-1', 10, 'OWE', RS],
      ['Aussière polyamide double tresse Ø 64 mm (220 m)', 'Amarrage & accastillage', 'u', 3, 4, 10, 4200000, 'F-005', 1, 'C-01-1', 6, 'OWE', ['RM-01', 'RM-02', 'VA-01']],
      ['Aussière de remorquage HMPE Ø 40 mm', 'Amarrage & accastillage', 'u', 2, 2, 6, 6800000, 'F-005', 1, 'C-01-2', 3, 'OWE', RM],
      ['Défense cylindrique Ø 1 000 mm (poste à quai)', 'Amarrage & accastillage', 'u', 6, 2, 8, 9500000, 'F-005', 0, 'Parc extérieur P-1', 2, 'OWE', []],
      ['Manille lyre galvanisée 35 t', 'Amarrage & accastillage', 'u', 18, 10, 40, 165000, 'F-005', 0, 'C-02-1', 16, 'OWE', []],
      ['Élingue textile 10 t × 6 m', 'Levage & élingage', 'u', 26, 20, 60, 85000, 'F-006', 0, 'D-01-1', 48, 'OWE', []],
      ['Élingue chaîne 4 brins 20 t', 'Levage & élingage', 'u', 3, 2, 6, 1250000, 'F-006', 1, 'D-01-2', 2, 'OWE', []],
      ['Huile hydraulique ISO VG 46 (fût 208 L)', 'Huiles & lubrifiants', 'fût', 9, 6, 20, 520000, 'F-003', 0, 'E-01-1', 24, 'OWE', GR.concat(RS)],
      ['Huile moteur marine 15W40 (fût 208 L)', 'Huiles & lubrifiants', 'fût', 4, 5, 14, 610000, 'F-003', 0, 'E-01-2', 18, 'OWE', RM.concat(VP)],
      ['Graisse EP2 au lithium (seau 18 kg)', 'Huiles & lubrifiants', 'seau', 21, 10, 40, 68000, 'F-003', 0, 'E-01-3', 48, 'OWE', GR],
      ['Filtre gasoil séparateur d\'eau (moteurs marins)', 'Pièces navales', 'u', 16, 12, 40, 54000, 'F-001', 0, 'F-01-1', 50, 'OWE', RM.concat(VP)],
      ['Hélice de rechange de vedette (4 pales)', 'Pièces navales', 'u', 1, 1, 2, 5200000, 'F-001', 1, 'F-02-1', 1, 'OWE', VP],
      ['Turbocompresseur de moteur de remorqueur (échange standard)', 'Pièces navales', 'u', 0, 1, 2, 14500000, 'F-001', 1, 'F-02-2', 1, 'OWE', RM],
      ['Anodes zinc de coque (lot de 10)', 'Pièces navales', 'lot', 6, 4, 12, 210000, 'F-001', 0, 'F-01-2', 8, 'OWE', RM.concat(VP, ['VA-01', 'VH-01'])],
      ['Gilet de sauvetage 150 N', 'EPI & sécurité', 'u', 64, 40, 150, 32000, 'F-007', 1, 'G-01-1', 90, 'OWE', []],
      ['Casque de sécurité avec jugulaire', 'EPI & sécurité', 'u', 58, 40, 150, 12500, 'F-007', 0, 'G-01-2', 160, 'OWE', []],
      ['Gilet haute visibilité classe 2', 'EPI & sécurité', 'u', 110, 80, 300, 6500, 'F-007', 0, 'G-01-3', 320, 'OWE', []],
      ['Chaussures de sécurité S3', 'EPI & sécurité', 'paire', 35, 40, 120, 24000, 'F-007', 0, 'G-02-1', 150, 'OWE', []],
      ['Bouée couronne avec ligne de vie 30 m', 'EPI & sécurité', 'u', 8, 6, 20, 78000, 'F-007', 1, 'G-02-2', 6, 'OWE', []],
      ['Kit absorbant hydrocarbures (boudins et feuilles)', 'Antipollution', 'kit', 5, 6, 15, 420000, 'F-007', 1, 'PG-H-01', 10, 'POG', ['BS-01']],
      ['Barrage flottant antipollution (section de 25 m)', 'Antipollution', 'section', 8, 6, 16, 1850000, 'F-007', 1, 'Parc POG', 2, 'POG', ['BS-01']],
      ['Projecteur LED 400 W (mâts d\'éclairage)', 'Électricité', 'u', 7, 6, 20, 380000, 'F-004', 0, 'I-01-1', 10, 'OWE', []],
      ['Câble électrique armé 3G6 mm²', 'Électricité', 'm', 420, 300, 1500, 5200, 'F-004', 0, 'I-01-2', 1400, 'OWE', []],
      ['Prise pour conteneur frigorifique 32 A (reefer)', 'Électricité', 'u', 12, 10, 40, 165000, 'F-004', 0, 'I-02-1', 24, 'OWE', []],
      ['Filtre à air moteur de grue (élément principal)', 'Pièces de grues', 'u', 9, 6, 20, 92000, 'F-002', 0, 'A-02-3', 18, 'OWE', GR],
      ['Kit de joints de vérin de levée (reach stacker)', 'Engins de parc', 'kit', 2, 2, 6, 310000, 'F-008', 0, 'PG-B-01', 4, 'POG', ['RS-03']],
      ['Filtre gasoil séparateur d\'eau (remorqueur Port-Gentil)', 'Pièces navales', 'u', 6, 4, 16, 54000, 'F-001', 0, 'PG-F-01', 16, 'POG', ['RM-03']]
    ];
    var arts = A.map(function (r, i) {
      return { id: 'ART-' + (1001 + i), designation: r[0], categorie: r[1], unite: r[2], qte: r[3], min: r[4], max: r[5], emplacement: r[9], pu: r[6], fournisseurId: r[7], critique: !!r[8], consoAn: r[10], site: r[11], equipements: r[12], dernierInventaire: D(-(40 + (i * 37) % 170)) };
    });
    arts.forEach(function (a) { if (a.id === 'ART-1021') a.daEnCours = 'DA-' + Y + '-0112'; });
    var invDates = { 'ART-1024': -6, 'ART-1002': -6, 'ART-1031': -5, 'ART-1016': -3, 'ART-1013': -1, 'ART-1018': -1 };
    arts.forEach(function (a) { if (invDates[a.id] != null) a.dernierInventaire = D(invDates[a.id]); });

    var mag = empIdByName('Mengue'), OT = function (n) { return 'OT-' + Y + '-0' + n; };
    var MS = [
      [-1, 'Sortie', 'ART-1007', 2, OT(517), 'Boussougou', 'RS-02 — entretien des 500 heures', 'RS-02'],
      [-1, 'Sortie', 'ART-1001', 40, OT(516), 'Boussougou', 'GR-02 — remplacement du câble de levage (usure)', 'GR-02'],
      [-2, 'Entrée', 'ART-1013', 10, 'BC-' + Y + '-0131', 'Mengue', 'Réception complète', ''],
      [-2, 'Sortie', 'ART-1019', 4, OT(514), 'Assoumou', 'Remorqueur Komo — filtres gasoil moteurs principaux', 'RM-01'],
      [-3, 'Sortie', 'ART-1025', 24, 'Dotation EPI', 'Ntsame', 'Dotation équipe de quai B (gilets HV)', ''],
      [-4, 'Retour', 'ART-1014', 4, OT(502), 'Mouketou', 'Non utilisées — opération colis lourd terminée', ''],
      [-5, 'Sortie', 'ART-1006', 2, OT(509), 'Lendoye', 'RS-01 — crevaison pneu avant droit', 'RS-01'],
      [-6, 'Inventaire', 'ART-1024', -4, 'INV-0001', 'Mengue', 'Écart d\'inventaire tournant validé', ''],
      [-7, 'Entrée', 'ART-1002', 10, 'BC-' + Y + '-0124', 'Mengue', 'Filtres hydrauliques grues — réception', ''],
      [-8, 'Sortie', 'ART-1016', 2, OT(498), 'Boussougou', 'GR-03 — appoint hydraulique', 'GR-03'],
      [-9, 'Sortie', 'ART-1010', 1, OT(495), 'Ondo', 'Remplacement d\'une aussière ragée — lamanage poste 2', 'VA-01'],
      [-10, 'Sortie', 'ART-1017', 2, OT(491), 'Ibinga', 'Vidange moteurs — vedette pilote Estuaire', 'VP-01'],
      [-12, 'Entrée', 'ART-1023', 40, 'BC-' + Y + '-0119', 'Mengue', 'Réception complète', ''],
      [-13, 'Sortie', 'ART-1030', 2, OT(488), 'Mayila', 'Mât d\'éclairage n° 7 — parc à conteneurs', ''],
      [-15, 'Sortie', 'ART-1028', 2, 'Exercice POLMAR', 'Nzamba', 'Exercice antipollution — appontement de soutage', 'BS-01'],
      [-16, 'Sortie', 'ART-1032', 4, OT(480), 'Mayila', 'Remplacement prises reefer — rangée R12', ''],
      [-18, 'Entrée', 'ART-1018', 12, 'BC-' + Y + '-0112', 'Mengue', 'Réception complète', ''],
      [-20, 'Sortie', 'ART-1023', 6, 'Dotation EPI', 'Bekale', 'Renouvellement gilets — remorqueur Mondah', 'RM-02'],
      [-22, 'Sortie', 'ART-1031', 120, OT(471), 'Mayila', 'Alimentation du nouveau poste de garde', ''],
      [-25, 'Sortie', 'ART-1022', 1, OT(466), 'Kombila', 'Remorqueur Cap Lopez — anodes de coque', 'RM-03'],
      [-28, 'Entrée', 'ART-1007', 30, 'BC-' + Y + '-0104', 'Mengue', 'Réception complète', '']
    ];
    var mvtS = MS.map(function (r, i) { var a = arts.find(function (x) { return x.id === r[2]; }); return { id: 'MS-' + String(i + 1).padStart(4, '0'), date: D(r[0]), type: r[1], articleId: r[2], qte: r[3], pu: a.pu, ref: r[4], demandeur: empIdByName(r[5]), commentaire: r[6], equipement: r[7] }; });

    var INV = [
      ['INV-0006', -1, 'ART-1013', 18, 18, 'Validé'], ['INV-0005', -1, 'ART-1018', 23, 21, 'À valider'], ['INV-0004', -3, 'ART-1016', 9, 9, 'Validé'],
      ['INV-0003', -5, 'ART-1031', 420, 420, 'Validé'], ['INV-0002', -6, 'ART-1002', 14, 14, 'Validé'], ['INV-0001', -6, 'ART-1024', 62, 58, 'Validé']
    ];
    var invs = INV.map(function (r) { var a = arts.find(function (x) { return x.id === r[2]; }); return { id: r[0], date: D(r[1]), articleId: r[2], theorique: r[3], reel: r[4], ecart: r[4] - r[3], valeurEcart: (r[4] - r[3]) * a.pu, compteur: mag, statut: r[5] }; });

    return { articles: arts, mouvementsStock: mvtS, inventaires: invs };
  }

  /* ------------------------------------------------------------------ rendu : composants */
  function alertsList(list) {
    if (!list.length) return '<div class="empty">Aucune alerte : tous les articles sont au-dessus de leur seuil.</div>';
    return '<div class="list ops-alerts">' + list.map(function (a) { return '<a class="list__item" href="' + a.href + '" style="color:inherit"><div class="list__icon tone-' + a.tone + '">' + E.icon(a.icon) + '</div><div class="list__body"><b>' + esc(a.title) + '</b><div class="small muted">' + esc(a.sub) + '</div></div></a>'; }).join('') + '</div>';
  }
  function docHead(titre, num, date) {
    return '<div class="doc__head"><div class="row" style="gap:12px"><img src="../assets/img/logo.png" alt="GPM"><div><b style="font-family:Sora,sans-serif;font-size:16px;color:var(--navy)">Gabon Port Management</b><div class="small muted">Ports d\'Owendo et de Port-Gentil<br>Service Achats & magasin</div></div></div>' +
      '<div style="text-align:right"><h4>' + esc(titre) + '</h4><div class="mono">' + esc(num) + '</div><div class="small muted">' + esc(date) + '</div></div></div>';
  }
  function printModal(title, html) {
    U.modal({ title: title, size: 'lg', body: '<div class="doc">' + html + '</div>', actions: [{ label: 'Fermer' }, { label: 'Imprimer', cls: 'primary', icon: 'print', onClick: function () { document.body.classList.add('ops-print'); setTimeout(function () { window.print(); document.body.classList.remove('ops-print'); }, 30); } }] });
  }

  /* ------------------------------------------------------------------ vues */
  var TABS = [
    { k: 'apercu', l: 'Tableau de bord' }, { k: 'magasin', l: 'Articles' }, { k: 'equipements', l: 'Pièces par équipement' },
    { k: 'sorties', l: 'Mouvements' }, { k: 'reappro', l: 'Réapprovisionnement' }, { k: 'inventaire', l: 'Inventaire tournant' }
  ];
  var state = { q: '', cat: '', site: '', artFilter: '', msType: '', eqType: '' };

  function render(view, params) {
    var tab = params[0] || 'apercu'; if (!TABS.some(function (t) { return t.k === tab; })) tab = 'apercu';
    var al = alerts(), ss = sousSeuil(), crit = ss.filter(function (a) { return a.critique; });
    var couvMoy = (function () { var l = articles().filter(function (a) { return a.consoAn; }); return l.length ? sum(l, function (a) { return Math.min(36, couvMois(a)); }) / l.length : 0; })();
    var head = '<div class="grid g4 ops-kpis">' +
      U.kpi({ label: 'Valeur du stock', value: F.short(valeurStock()), unit: 'FCFA', icon: 'box', tone: 'blue', foot: articles().length + ' références · ' + F.short(valeurStock(articles().filter(function (a) { return a.site === 'POG'; }))) + ' à Port-Gentil' }) +
      U.kpi({ label: 'Articles sous seuil', value: ss.length, icon: 'alert', tone: ss.length ? 'orange' : 'green', foot: '<span class="' + (crit.length ? 'down' : 'up') + '">' + crit.length + ' critique(s)</span> pour la flotte et les grues' }) +
      U.kpi({ label: 'Couverture moyenne', value: F.num(couvMoy, 1), unit: 'mois', icon: 'clock', tone: 'violet', foot: 'rotation ' + F.num(rotation(), 1) + ' / an' }) +
      U.kpi({ label: 'Alertes actives', value: al.length, icon: 'bell', tone: al.length ? 'red' : 'green', foot: invAValider().length + ' écart(s) d\'inventaire à valider' }) +
      '</div>';
    var counts = { magasin: articles().length, reappro: ss.length || null, inventaire: invAValider().length || null };
    view.innerHTML = head + U.tabs(TABS.map(function (t) { return { k: t.k, l: t.l, n: counts[t.k] }; }), tab, function (k) { E.go('stocks/' + k); }) + '<div id="stk-body" class="ops-scope"></div>';
    var body = view.querySelector('#stk-body');
    ({ apercu: vApercu, magasin: vMagasin, equipements: vEquipements, sorties: vSorties, reappro: vReappro, inventaire: vInventaire })[tab](body, params);
    if (params[1] && (tab === 'magasin' || tab === 'reappro') && S.get('articles', params[1])) openArticle(params[1], true);
  }
  function clearDeep(tab) { if (location.hash.split('/').length > 3) history.replaceState(null, '', '#/stocks/' + tab); }

  /* ---------- Tableau de bord ---------- */
  function vApercu(el) {
    var cats = E.groupBy(articles(), 'categorie');
    var catItems = Object.keys(cats).map(function (c) { return { label: c, value: valeurStock(cats[c]) }; }).sort(function (a, b) { return b.value - a.value; });
    var from30 = E.addDays(E.today(), -30), out30 = S.all('mouvementsStock').filter(function (m) { return m.type === 'Sortie' && m.date >= from30; });
    var byEq = {}; out30.forEach(function (m) { var k = m.equipement || ''; var f = S.get('flotte', k); var g = f ? f.type : 'Quais, parc & dotations'; byEq[g] = (byEq[g] || 0) + m.qte * m.pu; });
    var eqK = Object.keys(byEq).sort(function (a, b) { return byEq[b] - byEq[a]; });
    var lastM = S.all('mouvementsStock').slice().sort(function (a, b) { return b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)); }).slice(0, 6);
    var risk = flotte().map(function (f) { return { f: f, arts: artsOf(f.id), r: eqRisk(f.id) }; }).filter(function (x) { return x.arts.length; }).sort(function (a, b) { return b.r.length - a.r.length; }).slice(0, 6);
    el.innerHTML =
      '<div class="grid g-2-1">' +
        '<div class="card"><div class="card__h"><h3>Valeur du stock par famille</h3><span class="sub">pièces de rechange et consommables portuaires</span><span class="spacer"></span><a class="btn sm ghost" href="#/stocks/magasin">' + E.icon('box') + 'Articles</a></div><div class="card__b">' +
          U.donut(catItems.slice(0, 7).concat(catItems.length > 7 ? [{ label: 'Autres', value: sum(catItems.slice(7), 'value') }] : []), { center: F.short(valeurStock()), sub: 'FCFA', money: true, size: 150 }) +
          '<div class="ops-stat" style="margin-top:16px">' + Object.keys(MAGASINS).map(function (k) { var l = articles().filter(function (a) { return (a.site || 'OWE') === k; }); return '<div><span>' + esc(MAGASINS[k]) + '</span><b>' + F.short(valeurStock(l)) + '</b><span class="small muted">' + l.length + ' réf. · ' + l.filter(function (a) { return a.qte <= a.min; }).length + ' sous seuil</span></div>'; }).join('') + '</div></div></div>' +
        '<div class="card"><div class="card__h"><h3>Alertes</h3><span class="badge tone-red">' + alerts().length + '</span></div>' + alertsList(alerts()) + '</div>' +
      '</div>' +
      '<div class="grid g-2-1" style="margin-top:16px">' +
        '<div class="card"><div class="card__h"><h3>Disponibilité des pièces critiques par équipement</h3><span class="spacer"></span><a class="btn sm ghost" href="#/stocks/equipements">Détail</a></div>' +
          U.table([
            { label: 'Équipement', render: function (x) { return '<b>' + esc(x.f.nom) + '</b><div class="small muted">' + esc(x.f.id) + ' · ' + esc(x.f.type) + '</div>'; } },
            { label: 'Pièces suivies', num: true, render: function (x) { return x.arts.length; } },
            { label: 'Critiques à risque', num: true, render: function (x) { return x.r.length ? '<b class="ops-neg">' + x.r.length + '</b>' : '0'; } },
            { label: 'État', render: function (x) { return x.r.length ? U.badge(x.r.some(function (a) { return a.qte <= 0; }) ? 'Rupture' : 'À risque', x.r.some(function (a) { return a.qte <= 0; }) ? 'red' : 'orange') : U.badge('Couvert', 'green'); } }
          ], risk, { onRow: function () { E.go('stocks/equipements'); } }) + '</div>' +
        '<div class="card"><div class="card__h"><h3>Sorties — 30 jours</h3><span class="sub">valeur par destination</span></div><div class="card__b">' + (eqK.length ? U.bars({ labels: eqK.map(function (c) { return c.length > 14 ? c.slice(0, 13) + '…' : c; }), series: [{ name: 'Sorties', values: eqK.map(function (c) { return byEq[c]; }), color: '#145091' }], height: 200, money: true }) : '<div class="empty">Aucune sortie sur 30 jours</div>') + '</div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:16px"><div class="card__h"><h3>Derniers mouvements</h3><span class="spacer"></span><a class="btn sm ghost" href="#/stocks/sorties">Journal</a></div><div class="list">' + lastM.map(function (m) { var a = S.get('articles', m.articleId) || {}; var tp = TYPES_S[m.type] || {}; return '<div class="list__item"><div class="list__icon tone-' + (tp.tone || 'grey') + '">' + E.icon(CAT_ICON[a.categorie] || 'box') + '</div><div class="list__body"><b>' + esc(m.type) + ' · ' + esc(a.designation || m.articleId) + '</b><div class="small muted">' + esc(m.ref) + (m.equipement ? ' · ' + esc(eqName(m.equipement)) : '') + ' · ' + esc(m.commentaire || '') + '</div></div><div class="right" style="flex:none;white-space:nowrap"><b class="ops-num">' + msQteTxt(m) + '</b><div class="small muted">' + F.dateShort(m.date) + '</div></div></div>'; }).join('') + '</div></div>';
  }

  /* ---------- Pièces par équipement ---------- */
  function vEquipements(el) {
    var types = Object.keys(E.groupBy(flotte(), 'type'));
    var list = flotte().filter(function (f) { return !state.eqType || f.type === state.eqType; });
    el.innerHTML = '<div class="ops-toolbar"><div class="chips" id="eq-f"><button class="chip' + (!state.eqType ? ' is-active' : '') + '" data-k="">Tous les équipements</button>' + types.map(function (t) { return '<button class="chip' + (state.eqType === t ? ' is-active' : '') + '" data-k="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div></div>' +
      '<div class="alert tone-blue" style="margin-bottom:14px">' + E.icon('info') + '<div>Chaque article critique est relié aux équipements qu\'il permet de maintenir en service (grues mobiles, reach stackers, remorqueurs, vedettes, barge). Une pièce critique sous le seuil expose l\'équipement à une immobilisation prolongée, donc à des retards d\'escale.</div></div>' +
      '<div class="ops-eqgrid">' + list.map(function (f) {
        var arts = artsOf(f.id), r = eqRisk(f.id);
        return '<div class="card ops-eq"><div class="card__h"><div class="list__icon ' + (r.length ? 'tone-orange' : 'tone-green') + '">' + E.icon(/Grue/.test(f.type) ? 'crane' : /Engin/.test(f.type) ? 'container' : /Remorqueur/.test(f.type) ? 'tug' : 'ship') + '</div><div style="min-width:0"><h3>' + esc(f.nom) + '</h3><div class="sub">' + esc(f.id) + ' · ' + esc(f.type) + ' · ' + esc(E.siteName(f.site)) + '</div></div></div>' +
          (arts.length ? '<div class="list">' + arts.map(function (a) { var s = artStatut(a); return '<a class="list__item" href="#/stocks/magasin/' + a.id + '" style="color:inherit"><div class="list__body"><b class="small">' + esc(a.designation) + '</b>' + (a.critique ? ' <span class="badge tone-red plain">Critique</span>' : '') + '<div class="small muted">' + F.num(a.qte) + ' ' + esc(a.unite) + ' en stock · mini ' + a.min + '</div></div>' + U.badge(s, ART_TONE[s]) + '</a>'; }).join('') + '</div>' : '<div class="card__b small muted">Aucune pièce de rechange spécifique suivie au magasin.</div>') + '</div>';
      }).join('') + '</div>';
    el.querySelector('#eq-f').addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (b) { state.eqType = b.dataset.k; vEquipements(el); } });
  }

  /* ---------- Magasin ---------- */
  function artCols(withVal) {
    return [
      { key: 'id', label: 'Référence', render: function (a) { return '<span class="mono">' + esc(a.id) + '</span>'; } },
      { key: 'designation', label: 'Désignation', render: function (a) { return '<b>' + esc(a.designation) + '</b>' + (a.critique ? ' <span class="badge tone-red plain">Critique</span>' : '') + '<div class="small muted">' + esc(a.categorie) + ' · ' + esc(fournNom(a.fournisseurId)) + '</div>'; }, csv: function (a) { return a.designation; } },
      { key: 'emplacement', label: 'Emplacement', render: function (a) { return '<span class="mono">' + esc(a.emplacement) + '</span>'; } },
      { key: 'qte', label: 'Stock', num: 1, render: function (a) { var st = artStatut(a); return '<b class="' + (st === 'Rupture' || st === 'Sous seuil' ? 'ops-neg' : '') + '">' + F.num(a.qte) + '</b> <span class="small muted">' + esc(a.unite) + '</span>'; } },
      { key: 'minmax', label: 'Mini / maxi', num: 1, render: function (a) { return '<span class="small">' + F.num(a.min) + ' / ' + F.num(a.max) + '</span>'; }, csv: function (a) { return a.min + ' / ' + a.max; } },
      { key: 'pu', label: 'Prix unitaire', num: 1, cls: 'ops-hide-m', render: function (a) { return F.money(a.pu); } },
      withVal ? { key: 'valeur', label: 'Valeur', num: 1, render: function (a) { return '<b>' + F.short(a.qte * a.pu) + '</b>'; }, csv: function (a) { return a.qte * a.pu; } } : null,
      { key: 'couv', label: 'Couverture', num: 1, cls: 'ops-hide-m', render: function (a) { var c = couvMois(a); return c == null ? '—' : F.num(c, 1) + ' mois'; }, csv: function (a) { var c = couvMois(a); return c == null ? '' : c.toFixed(1); } },
      { key: 'statut', label: 'Statut', render: function (a) { var s = artStatut(a); return U.badge(s, ART_TONE[s]) + (a.daEnCours ? '<div class="small muted" style="margin-top:3px">' + esc(a.daEnCours) + '</div>' : ''); }, csv: artStatut }
    ].filter(Boolean);
  }
  function vMagasin(el) {
    var cats = Object.keys(E.groupBy(articles(), 'categorie')).sort();
    var q = E.norm(state.q);
    var list = articles().filter(function (a) {
      if (state.cat && a.categorie !== state.cat) return false;
      if (state.site && (a.site || 'OWE') !== state.site) return false;
      if (state.artFilter === 'seuil' && a.qte > a.min) return false;
      if (state.artFilter === 'critique' && !a.critique) return false;
      if (q && E.norm(a.id + ' ' + a.designation + ' ' + a.emplacement + ' ' + a.categorie).indexOf(q) < 0) return false;
      return true;
    });
    el.innerHTML =
      '<div class="ops-toolbar"><div class="chips" id="art-f"><button class="chip' + (!state.artFilter ? ' is-active' : '') + '" data-k="">Tous (' + articles().length + ')</button><button class="chip' + (state.artFilter === 'seuil' ? ' is-active' : '') + '" data-k="seuil">Sous seuil (' + sousSeuil().length + ')</button><button class="chip' + (state.artFilter === 'critique' ? ' is-active' : '') + '" data-k="critique">Critiques (' + articles().filter(function (a) { return a.critique; }).length + ')</button></div></div>' +
      '<div class="ops-toolbar"><input class="input" id="art-q" type="search" placeholder="Rechercher un article, une référence…" value="' + esc(state.q) + '"><select class="select" id="art-cat"><option value="">Toutes les catégories</option>' + cats.map(function (c) { return '<option' + (state.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select><select class="select" id="art-site"><option value="">Tous les magasins</option>' + Object.keys(MAGASINS).map(function (k) { return '<option value="' + k + '"' + (state.site === k ? ' selected' : '') + '>' + esc(MAGASINS[k]) + '</option>'; }).join('') + '</select><span class="spacer"></span>' +
      '<button class="btn" id="art-csv">' + E.icon('download') + 'CSV</button><button class="btn" id="art-new">' + E.icon('plus') + 'Nouvel article</button><button class="btn" id="art-in">' + E.icon('inbox') + 'Entrée / retour</button><button class="btn primary" id="art-out">' + E.icon('send') + 'Bon de sortie</button></div>' +
      '<div class="card"><div class="card__h"><h3>Articles en stock</h3><span class="sub">' + list.length + ' référence(s) · valeur ' + F.money(sum(list, function (a) { return a.qte * a.pu; })) + '</span></div>' +
      U.table(artCols(true), list, { onRow: function (a) { openArticle(a.id); }, empty: 'Aucun article ne correspond' }) + '</div>';
    el.querySelector('#art-f').addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (b) { state.artFilter = b.dataset.k; vMagasin(el); } });
    var qi = el.querySelector('#art-q'); qi.oninput = function () { state.q = qi.value; clearTimeout(qi._t); qi._t = setTimeout(function () { vMagasin(el); var n = el.querySelector('#art-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
    el.querySelector('#art-cat').onchange = function () { state.cat = this.value; vMagasin(el); };
    el.querySelector('#art-site').onchange = function () { state.site = this.value; vMagasin(el); };
    el.querySelector('#art-csv').onclick = function () { U.exportCSV('magasin-articles-' + E.today(), artCols(true), list); };
    el.querySelector('#art-new').onclick = function () { articleForm(); };
    el.querySelector('#art-in').onclick = function () { entreeForm(); };
    el.querySelector('#art-out').onclick = function () { sortieForm(); };
  }
  function openArticle(id, deep) {
    var a = S.get('articles', id); if (!a) return;
    var st = artStatut(a), mv = S.all('mouvementsStock').filter(function (m) { return m.articleId === id; }).sort(function (x, y) { return y.date.localeCompare(x.date); });
    var body = (a.qte <= a.min ? '<div class="alert tone-' + (a.critique ? 'red' : 'orange') + '" style="margin-bottom:14px">' + E.icon('alert') + '<div><b>Stock sous le seuil mini' + (a.critique ? ' — article critique' : '') + '.</b> Quantité proposée au réapprovisionnement : <b>' + F.num(a.max - a.qte) + ' ' + esc(a.unite) + '</b> (délai fournisseur ' + ((S.get('fournisseurs', a.fournisseurId) || {}).delai || '—') + ' j).' + (a.daEnCours ? ' Demande d\'achat ' + esc(a.daEnCours) + ' en cours.' : '') + '</div></div>' : '') +
      '<div class="grid g2 stack-m"><dl class="kv"><dt>Référence</dt><dd class="mono">' + esc(a.id) + '</dd><dt>Catégorie</dt><dd>' + esc(a.categorie) + '</dd><dt>Magasin</dt><dd>' + esc(MAGASINS[a.site || 'OWE']) + '</dd><dt>Emplacement</dt><dd class="mono">' + esc(a.emplacement) + '</dd><dt>Équipements concernés</dt><dd>' + ((a.equipements || []).length ? a.equipements.map(function (x) { return esc(eqName(x)); }).join(', ') : '—') + '</dd><dt>Fournisseur habituel</dt><dd>' + esc(fournNom(a.fournisseurId)) + '</dd><dt>Criticité</dt><dd>' + (a.critique ? U.badge('Critique (sécurité / disponibilité de la flotte)', 'red') : U.badge('Standard', 'grey')) + '</dd><dt>Dernier inventaire</dt><dd>' + F.date(a.dernierInventaire) + '</dd></dl>' +
      '<div><div class="ops-stat"><div><span>Stock</span><b>' + F.num(a.qte) + ' ' + esc(a.unite) + '</b></div><div><span>Mini / maxi</span><b>' + a.min + ' / ' + a.max + '</b></div><div><span>Valeur</span><b>' + F.short(a.qte * a.pu) + '</b></div><div><span>Couverture</span><b>' + (couvMois(a) == null ? '—' : F.num(couvMois(a), 1) + ' mois') + '</b></div></div>' +
      '<div style="margin-top:12px">' + U.progress(Math.min(100, a.qte / a.max * 100), st === 'Disponible' ? 'green' : st === 'Surstock' ? '' : 'orange') + '<div class="small muted" style="margin-top:4px">' + U.badge(st, ART_TONE[st]) + ' · PU ' + F.money(a.pu) + ' · consommation ' + F.num(a.consoAn || 0) + ' ' + esc(a.unite) + '/an</div></div></div></div>' +
      '<h4 style="margin:18px 0 8px;font-size:14px">Mouvements de l\'article</h4>' +
      U.table([
        { key: 'date', label: 'Date', render: function (m) { return F.dateShort(m.date); } },
        { key: 'type', label: 'Type', render: function (m) { return U.badge(m.type, TYPES_S[m.type].tone); } },
        { key: 'qte', label: 'Quantité', num: 1, render: function (m) { return msQteTxt(m); } },
        { key: 'ref', label: 'Pièce', render: function (m) { return '<span class="mono">' + esc(m.ref) + '</span>'; } },
        { key: 'demandeur', label: 'Par', render: function (m) { return esc(E.empName(m.demandeur)); } }
      ], mv, { empty: 'Aucun mouvement récent' });
    U.modal({ title: a.designation, sub: a.id + ' · ' + esc(a.categorie), size: 'lg', body: body, onClose: deep ? function () { clearDeep('magasin'); } : null,
      actions: [
        { label: 'Modifier', icon: 'edit', onClick: function (c) { c(); articleForm(a.id); } },
        { label: 'Compter (inventaire)', icon: 'list', onClick: function (c) { c(); countForm(a.id); } },
        { label: 'Entrée', icon: 'inbox', onClick: function (c) { c(); entreeForm(a.id); } },
        { label: 'Bon de sortie', cls: 'primary', icon: 'send', onClick: function (c) { c(); sortieForm(a.id); } }
      ] });
  }
  function artOpts(f) { return articles().filter(f || function () { return true; }).map(function (a) { return { v: a.id, l: a.id + ' · ' + a.designation + ' (' + F.num(a.qte) + ' ' + a.unite + ')' }; }); }
  function otOpts() {
    if (S.has('ordres') && S.all('ordres').length) return S.all('ordres').filter(function (o) { return !/clôtur|termin|annul/i.test(o.statut || ''); }).map(function (o) { return { v: o.id, l: o.id + ' · ' + (o.titre || o.objet || o.libelle || o.equipement || '') }; });
    return null;
  }
  function addMvtS(o) { o.id = S.next('MS'); o.date = o.date || E.today(); S.all('mouvementsStock').unshift(o); S.save(); return o; }
  function sortieForm(id) {
    var ots = otOpts(), u = E.session.user();
    var m = U.formModal({ title: 'Bon de sortie magasin', sub: 'Sortie imputée à un ordre de travail — le stock est décrémenté', okLabel: 'Valider la sortie',
      intro: '<div class="ops-note" id="bs-info" style="margin-bottom:14px"></div>',
      fields: [
        { name: 'article', label: 'Article', type: 'select', options: artOpts(function (x) { return x.qte > 0; }), required: true, full: true },
        { name: 'qte', label: 'Quantité', type: 'number', required: true, min: 1, value: 1 },
        ots ? { name: 'ot', label: 'Ordre de travail imputé', type: 'select', options: ots, empty: '— Choisir un OT —', required: true } : { name: 'ot', label: 'Ordre de travail / imputation', type: 'text', required: true, placeholder: 'OT-' + E.TODAY.getFullYear() + '-0520 ou « Dotation EPI »' },
        { name: 'demandeur', label: 'Demandeur', type: 'select', options: empOpts(), required: true, value: empIdByName('Boussougou') },
        { name: 'equipement', label: 'Équipement / destination', type: 'select', options: [{ v: '', l: 'Quais, parc, bâtiments ou dotation' }].concat(E.options('flotte', function (x) { return x.id + ' · ' + x.nom; })) },
        { name: 'commentaire', label: 'Motif / commentaire', type: 'textarea', placeholder: 'ex. Remplacement du câble de levage — grue n° 2' }
      ], values: { article: id, equipement: id && S.get('articles', id) && (S.get('articles', id).equipements || [])[0] || '' },
      onSubmit: function (v) {
        var a = S.get('articles', v.article), q = +v.qte;
        if (!(q > 0)) { U.toast('Quantité invalide.', 'err'); return false; }
        if (q > a.qte) { U.toast('Stock insuffisant : ' + F.num(a.qte) + ' ' + a.unite + ' disponible(s).', 'err'); return false; }
        var wasOk = a.qte > a.min;
        S.update('articles', a.id, { qte: a.qte - q });
        var bs = S.next('BS');
        var mv = addMvtS({ type: 'Sortie', articleId: a.id, qte: q, pu: a.pu, ref: v.ot, bs: bs, demandeur: v.demandeur, equipement: v.equipement, commentaire: v.commentaire || '', saisiPar: u ? u.name : '' });
        E.log('Bon de sortie ' + bs, F.num(q) + ' ' + a.unite + ' · ' + a.designation + ' → ' + v.ot, 'stocks');
        if (wasOk && a.qte <= a.min) E.notify('Article sous le seuil mini', a.designation + ' (' + F.num(a.qte) + ' ' + a.unite + ')', '#/stocks/reappro', a.critique ? 'red' : 'orange');
        U.toast('Sortie validée — ' + bs);
        E.rerender();
        setTimeout(function () { printBS(mv); }, 60);
      } });
    var sel = m.el.querySelector('#f_article');
    function info() { var a = S.get('articles', sel.value); if (!a) return; m.el.querySelector('#bs-info').innerHTML = '<b>' + esc(a.designation) + '</b><br>Stock : <b>' + F.num(a.qte) + ' ' + esc(a.unite) + '</b> · emplacement <span class="mono">' + esc(a.emplacement) + '</span> · seuil mini ' + a.min + (a.critique ? ' · ' + U.badge('Critique', 'red') : ''); }
    sel.onchange = info; info();
  }
  function printBS(m) {
    var a = S.get('articles', m.articleId) || {}, un = m.equipement ? S.get('flotte', m.equipement) : null;
    printModal('Bon de sortie ' + (m.bs || m.id), docHead('BON DE SORTIE MAGASIN', m.bs || m.id, (a.site === 'POG' ? 'Port-Gentil' : 'Owendo') + ', le ' + F.date(m.date)) +
      '<div class="ops-doc-meta"><div><span>Ordre de travail : </span><b>' + esc(m.ref) + '</b></div><div><span>Demandeur : </span><b>' + esc(E.empName(m.demandeur)) + '</b></div><div><span>Équipement / destination : </span><b>' + esc(un ? un.id + ' · ' + un.nom : 'Quais, parc ou dotation') + '</b></div><div><span>Magasin : </span><b>' + esc(MAGASINS[a.site || 'OWE']) + '</b></div></div>' +
      '<table class="ops-doc-tbl"><thead><tr><th>Référence</th><th>Désignation</th><th>Empl.</th><th class="num">Qté</th><th class="num">PU</th><th class="num">Montant</th></tr></thead><tbody><tr><td class="mono">' + esc(a.id) + '</td><td>' + esc(a.designation) + '</td><td class="mono">' + esc(a.emplacement) + '</td><td class="num">' + F.num(m.qte) + ' ' + esc(a.unite) + '</td><td class="num">' + F.money(m.pu) + '</td><td class="num"><b>' + F.money(m.qte * m.pu) + '</b></td></tr></tbody></table>' +
      (m.commentaire ? '<p><span class="muted">Motif : </span>' + esc(m.commentaire) + '</p>' : '') +
      '<p class="small muted">Imputation analytique : coût porté sur l\'ordre de travail ' + esc(m.ref) + '. Le matériel non utilisé doit être retourné au magasin sous 72 h avec ce bon.</p>' +
      '<div class="ops-sign"><div>Magasinier</div><div>Demandeur (réception du matériel)</div><div>Visa chef de service</div></div>');
  }
  function entreeForm(id) {
    U.formModal({ title: 'Entrée en stock', sub: 'Réception d\'une commande fournisseur ou retour de matériel non utilisé', okLabel: 'Enregistrer l\'entrée',
      fields: [
        { name: 'type', label: 'Type', type: 'select', options: [{ v: 'Entrée', l: 'Réception de commande (BC)' }, { v: 'Retour', l: 'Retour de matériel (OT)' }], required: true },
        { name: 'article', label: 'Article', type: 'select', options: artOpts(), required: true, full: true },
        { name: 'qte', label: 'Quantité reçue', type: 'number', required: true, min: 1 },
        { name: 'ref', label: 'N° de BC ou d\'OT', type: 'text', required: true, placeholder: 'BC-' + E.TODAY.getFullYear() + '-0135 ou OT-' + E.TODAY.getFullYear() + '-0517' },
        { name: 'commentaire', label: 'Commentaire', type: 'textarea', placeholder: 'Contrôle qualité, réserves à la réception…' }
      ], values: { article: id },
      onSubmit: function (v) {
        var a = S.get('articles', v.article), q = +v.qte;
        if (!(q > 0)) { U.toast('Quantité invalide.', 'err'); return false; }
        var patch = { qte: a.qte + q }; if (v.type === 'Entrée' && a.daEnCours) patch.daEnCours = '';
        S.update('articles', a.id, patch);
        addMvtS({ type: v.type, articleId: a.id, qte: q, pu: a.pu, ref: v.ref, demandeur: empIdByName('Mengue'), commentaire: v.commentaire || (v.type === 'Entrée' ? 'Réception' : 'Retour magasin') });
        E.log((v.type === 'Entrée' ? 'Réception ' : 'Retour ') + v.ref, F.num(q) + ' ' + a.unite + ' · ' + a.designation, 'stocks');
        U.toast('Stock mis à jour : ' + a.designation + ' → ' + F.num(a.qte) + ' ' + a.unite); E.rerender();
      } });
  }
  function articleForm(id) {
    var a = id ? S.get('articles', id) : null;
    var cats = Object.keys(E.groupBy(articles(), 'categorie')).sort();
    U.formModal({ title: a ? 'Modifier l\'article ' + a.id : 'Nouvel article', okLabel: a ? 'Enregistrer' : 'Créer l\'article',
      fields: [
        { name: 'designation', label: 'Désignation', required: true, full: true },
        { name: 'categorie', label: 'Catégorie', type: 'select', options: cats, required: true },
        { name: 'unite', label: 'Unité', required: true, placeholder: 'u, m, fût, paire…' },
        { name: 'qte', label: 'Stock initial', type: 'number', required: true, min: 0 },
        { name: 'pu', label: 'Prix unitaire (FCFA)', type: 'money', required: true, min: 0 },
        { name: 'min', label: 'Seuil mini', type: 'number', required: true, min: 0 },
        { name: 'max', label: 'Stock maxi', type: 'number', required: true, min: 0 },
        { name: 'emplacement', label: 'Emplacement', placeholder: 'A-01-1' },
        { name: 'site', label: 'Magasin', type: 'select', options: Object.keys(MAGASINS).map(function (k) { return { v: k, l: MAGASINS[k] }; }) },
        { name: 'fournisseurId', label: 'Fournisseur habituel', type: 'select', options: E.options('fournisseurs') },
        { name: 'consoAn', label: 'Consommation annuelle', type: 'number', min: 0 },
        { name: 'critique', label: 'Article critique', type: 'select', options: [{ v: '0', l: 'Non' }, { v: '1', l: 'Oui — sécurité / disponibilité de la flotte' }] }
      ],
      values: a ? Object.assign({}, a, { critique: a.critique ? '1' : '0' }) : { unite: 'u', qte: 0, min: 1, max: 5, critique: '0', fournisseurId: 'F-002', site: 'OWE' },
      onSubmit: function (v) {
        if (+v.max < +v.min) { U.toast('Le stock maxi doit être supérieur au seuil mini.', 'err'); return false; }
        var o = { designation: v.designation, categorie: v.categorie, unite: v.unite, qte: +v.qte, pu: +v.pu, min: +v.min, max: +v.max, emplacement: v.emplacement, site: v.site || 'OWE', fournisseurId: v.fournisseurId, consoAn: +v.consoAn || 0, critique: v.critique === '1' };
        if (a) { S.update('articles', a.id, o); E.log('Article modifié ' + a.id, o.designation, 'stocks'); U.toast('Article ' + a.id + ' mis à jour'); }
        else {
          var n = Math.max.apply(null, articles().map(function (x) { return +String(x.id).replace(/\D/g, '') || 0; }).concat([1000])) + 1;
          o.id = 'ART-' + n; o.equipements = []; o.dernierInventaire = E.today(); articles().push(o); S.save();
          E.log('Article créé ' + o.id, o.designation, 'stocks'); U.toast('Article ' + o.id + ' créé');
        }
        E.rerender();
      } });
  }

  /* ---------- Mouvements magasin ---------- */
  function msSign(m) { return m.type === 'Sortie' ? -1 : 1; }
  function msQteTxt(m) { var a = S.get('articles', m.articleId) || {}, s = msSign(m) * m.qte; return '<span class="' + (s < 0 ? 'ops-neg' : 'ops-pos') + '">' + signed(s) + '</span> <span class="small muted">' + esc(a.unite || '') + '</span>'; }
  function vSorties(el) {
    var all = S.all('mouvementsStock').slice().sort(function (a, b) { return b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)); });
    var list = all.filter(function (m) { return !state.msType || m.type === state.msType; });
    var from30 = E.addDays(E.today(), -30), l30 = all.filter(function (m) { return m.date >= from30; });
    var valIn = sum(l30.filter(function (m) { return m.type === 'Entrée'; }), function (m) { return m.qte * m.pu; });
    var valOut = sum(l30.filter(function (m) { return m.type === 'Sortie'; }), function (m) { return m.qte * m.pu; });
    var byCat = {}; l30.filter(function (m) { return m.type === 'Sortie'; }).forEach(function (m) { var a = S.get('articles', m.articleId); if (a) byCat[a.categorie] = (byCat[a.categorie] || 0) + m.qte * m.pu; });
    var catK = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });
    var cols = [
      { key: 'date', label: 'Date', render: function (m) { return F.dateShort(m.date); } },
      { key: 'type', label: 'Type', render: function (m) { return U.badge(m.type, TYPES_S[m.type].tone); } },
      { key: 'article', label: 'Article', render: function (m) { var a = S.get('articles', m.articleId) || {}; return '<b>' + esc(a.designation || m.articleId) + '</b><div class="small muted mono">' + esc(m.articleId) + '</div>'; }, csv: function (m) { return (S.get('articles', m.articleId) || {}).designation; } },
      { key: 'qte', label: 'Quantité', num: 1, render: msQteTxt, csv: function (m) { return msSign(m) * m.qte; } },
      { key: 'valeur', label: 'Valeur', num: 1, render: function (m) { return F.short(m.qte * m.pu); }, csv: function (m) { return m.qte * m.pu; } },
      { key: 'ref', label: 'Pièce', render: function (m) { return '<span class="mono">' + esc(m.bs ? m.bs + ' · ' : '') + esc(m.ref) + '</span>'; } },
      { key: 'demandeur', label: 'Demandeur', render: function (m) { return esc(E.empName(m.demandeur)); }, csv: function (m) { return E.empName(m.demandeur); } },
      { key: 'commentaire', label: 'Commentaire', render: function (m) { return '<span class="small">' + esc(m.commentaire) + '</span>'; } }
    ];
    el.innerHTML =
      '<div class="grid g-2-1">' +
        '<div class="card"><div class="card__h"><h3>Flux du magasin — 30 jours</h3></div><div class="card__b"><div class="ops-stat"><div><span>Entrées (valeur)</span><b class="ops-pos">' + F.short(valIn) + '</b></div><div><span>Sorties (valeur)</span><b>' + F.short(valOut) + '</b></div><div><span>Bons de sortie</span><b>' + l30.filter(function (m) { return m.type === 'Sortie'; }).length + '</b></div><div><span>OT servis</span><b>' + Object.keys(E.groupBy(l30.filter(function (m) { return /^OT-/.test(m.ref); }), 'ref')).length + '</b></div></div>' +
        '<div style="margin-top:14px">' + (catK.length ? U.bars({ labels: catK.map(function (c) { return c.length > 12 ? c.split(' ')[0] : c; }), series: [{ name: 'Sorties', values: catK.map(function (c) { return byCat[c]; }), color: '#163b75' }], height: 180, money: true }) : '') + '</div></div></div>' +
        '<div class="card"><div class="card__h"><h3>Actions rapides</h3></div><div class="card__b stack">' +
          '<button class="btn primary" id="ms-out">' + E.icon('send') + 'Établir un bon de sortie</button><button class="btn" id="ms-in">' + E.icon('inbox') + 'Réception / retour</button><button class="btn" id="ms-csv">' + E.icon('download') + 'Exporter les mouvements</button>' +
          '<div class="ops-note">Chaque sortie est imputée à un <b>ordre de travail</b> de la maintenance (grue, engin, remorqueur, vedette…) ou à une dotation EPI : le coût des pièces remonte dans le suivi des équipements et le contrôle de gestion.</div></div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:16px"><div class="card__h"><h3>Mouvements de stock</h3><span class="sub">' + list.length + ' mouvement(s) · cliquez sur une sortie pour réimprimer le bon</span><span class="spacer"></span><div class="chips" id="ms-f">' + ['', 'Entrée', 'Sortie', 'Retour', 'Inventaire'].map(function (t) { return '<button class="chip' + (state.msType === t ? ' is-active' : '') + '" data-k="' + t + '">' + (t || 'Tous') + '</button>'; }).join('') + '</div></div>' +
      U.table(cols, list, { onRow: function (m) { if (m.type === 'Sortie') printBS(m); else openArticle(m.articleId); } }) + '</div>';
    el.querySelector('#ms-f').addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (b) { state.msType = b.dataset.k; vSorties(el); } });
    el.querySelector('#ms-out').onclick = function () { sortieForm(); };
    el.querySelector('#ms-in').onclick = function () { entreeForm(); };
    el.querySelector('#ms-csv').onclick = function () { U.exportCSV('mouvements-magasin-' + E.today(), cols, list); };
  }

  /* ---------- Réapprovisionnement ---------- */
  function vReappro(el) {
    var list = articles().filter(function (a) { return a.qte <= a.min || a.qte <= a.min * 1.15; }).sort(function (a, b) { return (b.critique - a.critique) || (a.qte / Math.max(1, a.min) - b.qte / Math.max(1, b.min)); });
    var sel = {}; list.forEach(function (a) { sel[a.id] = a.qte <= a.min && !a.daEnCours; });
    var qty = {}; list.forEach(function (a) { qty[a.id] = Math.max(1, a.max - a.qte); });
    el.innerHTML =
      '<div class="alert tone-blue" style="margin-bottom:14px">' + E.icon('info') + '<div>Proposition calculée automatiquement : quantité = <b>stock maxi − stock actuel</b> pour les articles au seuil mini ou en dessous (les articles à moins de 15 % au-dessus du seuil sont signalés « à surveiller »). Ajustez les quantités puis générez la demande d\'achat.</div></div>' +
      '<div class="card"><div class="card__h"><h3>Proposition de réapprovisionnement</h3><span class="sub">' + list.length + ' article(s)</span><span class="spacer"></span><b id="ra-total" class="ops-num"></b><button class="btn primary" id="ra-go">' + E.icon('cart') + 'Créer une demande d\'achat</button></div>' +
      U.table([
        { key: 'sel', label: 'Choix', render: function (a) { return '<input type="checkbox" data-sel="' + a.id + '"' + (sel[a.id] ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:var(--navy)">'; } },
        { key: 'designation', label: 'Article', render: function (a) { return '<b>' + esc(a.designation) + '</b>' + (a.critique ? ' <span class="badge tone-red plain">Critique</span>' : '') + '<div class="small muted mono">' + esc(a.id) + ' · ' + esc(a.emplacement) + '</div>'; } },
        { key: 'qte', label: 'Stock / mini', num: 1, render: function (a) { return '<b class="' + (a.qte <= a.min ? 'ops-neg' : '') + '">' + F.num(a.qte) + '</b> / ' + F.num(a.min) + ' <span class="small muted">' + esc(a.unite) + '</span>'; } },
        { key: 'etat', label: 'État', render: function (a) { return a.daEnCours ? U.badge(a.daEnCours + ' en cours', 'blue') : a.qte <= a.min ? U.badge(artStatut(a), ART_TONE[artStatut(a)]) : U.badge('À surveiller', 'yellow'); } },
        { key: 'prop', label: 'Qté à commander', num: 1, render: function (a) { return '<input class="input" type="number" min="1" data-q="' + a.id + '" value="' + qty[a.id] + '" style="width:92px;text-align:right;padding:6px 8px">'; } },
        { key: 'fourn', label: 'Fournisseur', render: function (a) { var f = S.get('fournisseurs', a.fournisseurId) || {}; return esc(f.nom || '—') + '<div class="small muted">délai ' + (f.delai || '—') + ' j</div>'; } },
        { key: 'montant', label: 'Montant estimé', num: 1, render: function (a) { return '<span data-m="' + a.id + '">' + F.money(qty[a.id] * a.pu) + '</span>'; } }
      ], list, { empty: 'Aucun article à réapprovisionner — tous les stocks sont au-dessus des seuils.' }) + '</div>' +
      '<div class="card" style="margin-top:16px"><div class="card__h"><h3>Demandes d\'achat issues du magasin</h3></div><div class="card__b" id="ra-da"></div></div>';
    function total() {
      var t = 0, n = 0; list.forEach(function (a) { if (sel[a.id]) { t += qty[a.id] * a.pu; n++; } });
      el.querySelector('#ra-total').textContent = n + ' ligne(s) · ' + F.money(t); return { t: t, n: n };
    }
    el.addEventListener('change', function (e) {
      var c = e.target.closest('[data-sel]'); if (c) { sel[c.dataset.sel] = c.checked; total(); }
      var q = e.target.closest('[data-q]'); if (q) { var a = S.get('articles', q.dataset.q); qty[a.id] = Math.max(1, +q.value || 1); q.value = qty[a.id]; el.querySelector('[data-m="' + a.id + '"]').textContent = F.money(qty[a.id] * a.pu); total(); }
    });
    total();
    var das = S.has('da') ? S.all('da').filter(function (d) { return d.origine === 'Magasin' || /réapprovisionnement magasin/i.test(d.objet || ''); }) : [];
    el.querySelector('#ra-da').innerHTML = !S.has('da') ? '<div class="ops-note">Le module <b>Achats</b> n\'est pas activé sur cette démonstration : la proposition sera exportée en CSV.</div>' :
      das.length ? '<div class="list">' + das.map(function (d) { return '<a class="list__item" href="#/achats/da/' + esc(d.id) + '" style="color:inherit"><div class="list__icon tone-orange">' + E.icon('cart') + '</div><div class="list__body"><b>' + esc(d.id) + ' · ' + esc(d.objet) + '</b><div class="small muted">' + F.date(d.date) + ' · ' + (d.lignes || []).length + ' ligne(s) · ' + F.money(d.montant) + '</div></div>' + U.badge(d.statut) + '</a>'; }).join('') + '</div>' : '<div class="small muted">Aucune demande d\'achat générée depuis le magasin pour l\'instant.</div>';
    el.querySelector('#ra-go').onclick = function () {
      var lines = list.filter(function (a) { return sel[a.id]; }); if (!lines.length) { U.toast('Sélectionnez au moins un article.', 'err'); return; }
      var lignes = lines.map(function (a) { return { articleId: a.id, designation: a.designation, qte: qty[a.id], unite: a.unite, pu: a.pu, montant: qty[a.id] * a.pu, fournisseurId: a.fournisseurId }; });
      var montant = sum(lignes, 'montant');
      if (!S.has('da')) {
        U.exportCSV('proposition-reappro-' + E.today(), [{ key: 'articleId', label: 'Référence' }, { key: 'designation', label: 'Désignation' }, { key: 'qte', label: 'Quantité' }, { key: 'unite', label: 'Unité' }, { key: 'pu', label: 'PU' }, { key: 'montant', label: 'Montant' }, { key: 'fournisseurId', label: 'Fournisseur' }], lignes);
        return;
      }
      U.confirm('Créer une demande d\'achat', 'Générer une demande d\'achat brouillon de <b>' + lignes.length + ' ligne(s)</b> pour <b>' + F.money(montant) + '</b> ?', 'Créer la DA', function () {
        var u = E.session.user(), crit = lines.some(function (a) { return a.critique; });
        var da = { id: (function () { var y = E.TODAY.getFullYear(), mx = 100; S.all('da').forEach(function (x) { var m = /-(\d{4})$/.exec(x.id || ''); if (m) mx = Math.max(mx, +m[1]); }); return 'DA-' + y + '-' + String(mx + 1).padStart(4, '0'); })(), objet: 'Réapprovisionnement magasin — ' + lignes.length + ' article(s) sous seuil', lignes: lignes, montant: montant, statut: 'Brouillon', date: E.today(), demandeur: empIdByName('Mengue') || (u ? u.name : ''), direction: 'ACH', origine: 'Magasin', urgence: crit ? 'Urgente' : 'Normale', categorie: 'Pièces de rechange portuaires', imputation: 'Budget maintenance courante', justification: 'Réapprovisionnement automatique des articles sous le seuil mini du magasin.', visas: [], fournisseurId: lignes[0].fournisseurId };
        S.all('da').unshift(da); S.save();
        lines.forEach(function (a) { S.update('articles', a.id, { daEnCours: da.id }); });
        E.log('Demande d\'achat ' + da.id + ' créée depuis le magasin', lignes.length + ' ligne(s) · ' + F.money(montant), 'stocks');
        E.notify('Nouvelle demande d\'achat ' + da.id, 'Réapprovisionnement magasin · ' + F.short(montant) + ' FCFA', '#/achats/da/' + da.id, 'orange');
        U.toast('Demande d\'achat ' + da.id + ' créée (brouillon)');
        E.rerender();
      });
    };
  }

  /* ---------- Inventaire tournant ---------- */
  function vInventaire(el) {
    var inv = S.all('inventaires').slice().sort(function (a, b) { return b.date.localeCompare(a.date) || b.id.localeCompare(a.id); });
    var pend = {}; invAValider().forEach(function (i) { pend[i.articleId] = 1; });
    var todo = articles().filter(function (a) { return !pend[a.id]; }).sort(function (a, b) {
      var sa = (a.critique ? 2 : 0) + (a.qte * a.pu > 5e6 ? 1 : 0), sb = (b.critique ? 2 : 0) + (b.qte * b.pu > 5e6 ? 1 : 0);
      return (a.dernierInventaire || '').localeCompare(b.dernierInventaire || '') - (sb - sa) * 0.001;
    }).slice(0, 6);
    var from90 = E.addDays(E.today(), -90), l90 = inv.filter(function (i) { return i.date >= from90 && i.statut === 'Validé'; });
    var fiab = l90.length ? l90.filter(function (i) { return i.ecart === 0; }).length / l90.length * 100 : 100;
    var d = E.parseDate(E.today()), wk = (function () { var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); var day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 864e5 + 1) / 7); })();
    el.innerHTML =
      '<div class="grid g4" style="margin-bottom:16px">' +
        U.kpi({ label: 'Comptages (90 j)', value: inv.filter(function (i) { return i.date >= from90; }).length, icon: 'list', tone: 'blue', foot: 'objectif : 100 % des références / an' }) +
        U.kpi({ label: 'Fiabilité du stock', value: F.num(fiab, 0), unit: '%', icon: 'target', tone: fiab >= 95 ? 'green' : 'orange', foot: 'comptages sans écart' }) +
        U.kpi({ label: 'Valeur des écarts', value: F.short(sum(l90, 'valeurEcart')), unit: 'FCFA', icon: 'money', tone: 'orange', foot: 'écarts validés, 90 j' }) +
        U.kpi({ label: 'Écarts à valider', value: invAValider().length, icon: 'check', tone: invAValider().length ? 'violet' : 'green', foot: 'visa chef de service' }) +
      '</div>' +
      '<div class="grid g-1-2">' +
        '<div class="card"><div class="card__h"><h3>Campagne — semaine ' + wk + '</h3><span class="sub">références jamais ou anciennement comptées</span></div><div class="list">' +
          todo.map(function (a) { return '<div class="list__item"><div class="list__icon ' + (a.critique ? 'tone-red' : 'tone-blue') + '">' + E.icon('box') + '</div><div class="list__body"><b>' + esc(a.designation) + '</b><div class="small muted"><span class="mono">' + esc(a.emplacement) + '</span> · dernier comptage ' + F.date(a.dernierInventaire) + '</div></div><button class="btn sm" data-count="' + a.id + '">Compter</button></div>'; }).join('') + '</div></div>' +
        '<div class="card"><div class="card__h"><h3>Comptages & écarts</h3><span class="spacer"></span><button class="btn sm" id="inv-new">' + E.icon('plus') + 'Autre article</button></div>' +
        U.table([
          { key: 'date', label: 'Date', render: function (i) { return F.dateShort(i.date); } },
          { key: 'article', label: 'Article', render: function (i) { var a = S.get('articles', i.articleId) || {}; return '<b>' + esc(a.designation || i.articleId) + '</b><div class="small muted mono">' + esc(i.id) + ' · ' + esc(i.articleId) + '</div>'; } },
          { key: 'theorique', label: 'Théorique', num: 1 },
          { key: 'reel', label: 'Compté', num: 1 },
          { key: 'ecart', label: 'Écart', num: 1, render: function (i) { return '<b class="' + (i.ecart < 0 ? 'ops-neg' : i.ecart > 0 ? 'ops-pos' : '') + '">' + signed(i.ecart) + '</b><div class="small muted">' + (i.valeurEcart ? F.short(i.valeurEcart) + ' FCFA' : '') + '</div>'; } },
          { key: 'statut', label: 'Statut', render: function (i) { return i.statut === 'À valider' ? '<button class="btn sm success" data-val="' + i.id + '">' + E.icon('check') + 'Valider</button> <button class="btn sm danger" data-rec="' + i.id + '">Recompter</button>' : U.badge(i.statut, 'green'); } }
        ], inv) + '</div>' +
      '</div>';
    E.$$('[data-count]', el).forEach(function (b) { b.onclick = function () { countForm(b.dataset.count); }; });
    el.querySelector('#inv-new').onclick = function () { countForm(); };
    E.$$('[data-val]', el).forEach(function (b) { b.onclick = function () { validateInv(b.dataset.val); }; });
    E.$$('[data-rec]', el).forEach(function (b) { b.onclick = function () { var i = S.get('inventaires', b.dataset.rec); S.remove('inventaires', i.id); E.log('Recomptage demandé', i.articleId, 'stocks'); U.toast('Comptage annulé — article remis dans la campagne'); countForm(i.articleId); }; });
  }
  function countForm(id) {
    var m = U.formModal({ title: 'Comptage d\'inventaire', sub: 'Comptage physique en magasin — l\'écart est soumis à validation', okLabel: 'Enregistrer le comptage',
      intro: '<div class="ops-note" id="ct-info" style="margin-bottom:14px"></div>',
      fields: [
        { name: 'article', label: 'Article', type: 'select', options: artOpts(), required: true, full: true },
        { name: 'reel', label: 'Quantité comptée', type: 'number', required: true, min: 0 },
        { name: 'compteur', label: 'Compteur', type: 'select', options: empOpts(), required: true, value: empIdByName('Mengue') }
      ], values: { article: id },
      onSubmit: function (v) {
        var a = S.get('articles', v.article), reel = +v.reel, ec = reel - a.qte;
        var o = { id: 'INV-' + String(Math.max.apply(null, S.all('inventaires').map(function (x) { return +String(x.id).replace(/\D/g, '') || 0; }).concat([0])) + 1).padStart(4, '0'), date: E.today(), articleId: a.id, theorique: a.qte, reel: reel, ecart: ec, valeurEcart: ec * a.pu, compteur: v.compteur, statut: ec === 0 ? 'Validé' : 'À valider' };
        S.all('inventaires').unshift(o); S.update('articles', a.id, { dernierInventaire: E.today() });
        E.log('Comptage ' + o.id, a.designation + ' : ' + reel + ' (écart ' + signed(ec) + ')', 'stocks');
        if (ec !== 0) E.notify('Écart d\'inventaire à valider', a.designation + ' : ' + signed(ec) + ' ' + a.unite + ' (' + F.short(ec * a.pu) + ' FCFA)', '#/stocks/inventaire', 'violet');
        U.toast(ec === 0 ? 'Comptage conforme — aucun écart' : 'Écart de ' + signed(ec) + ' ' + a.unite + ' soumis à validation');
        E.rerender();
      } });
    var sel = m.el.querySelector('#f_article');
    function info() { var a = S.get('articles', sel.value); m.el.querySelector('#ct-info').innerHTML = '<b>' + esc(a.designation) + '</b><br>Emplacement <span class="mono">' + esc(a.emplacement) + '</span> · unité : ' + esc(a.unite) + ' · <span class="muted">stock théorique masqué pendant le comptage (comptage « à l\'aveugle »)</span>'; }
    sel.onchange = info; info();
  }
  function validateInv(id) {
    var i = S.get('inventaires', id), a = S.get('articles', i.articleId);
    U.confirm('Valider l\'écart d\'inventaire', 'Ajuster le stock de <b>' + esc(a.designation) + '</b> de ' + signed(i.ecart) + ' ' + esc(a.unite) + ' (' + F.money(i.ecart * a.pu) + ') ?', 'Valider l\'écart', function () {
      S.update('inventaires', id, { statut: 'Validé', theorique: a.qte, reel: a.qte + i.ecart, valeurEcart: i.ecart * a.pu });
      S.update('articles', a.id, { qte: Math.max(0, a.qte + i.ecart) });
      addMvtS({ type: 'Inventaire', articleId: a.id, qte: i.ecart, pu: a.pu, ref: id, demandeur: i.compteur, commentaire: 'Écart d\'inventaire tournant validé' });
      E.log('Écart d\'inventaire validé ' + id, a.designation + ' ' + signed(i.ecart), 'stocks');
      U.toast('Écart validé — stock ajusté'); E.rerender();
    }, 'success');
  }

  /* ------------------------------------------------------------------ enregistrement */
  E.register({
    id: 'stocks', label: 'Magasin & stocks', title: 'Magasin & stocks', icon: 'box', group: 'Technique & Achats', roles: ['achats', 'technique'],
    seed: seed,
    render: render,
    summary: function () {
      var ss = sousSeuil(), crit = ss.filter(function (a) { return a.critique; });
      return [
        { label: 'Valeur du magasin', value: F.short(valeurStock()), unit: 'FCFA', icon: 'box', tone: 'blue', foot: articles().length + ' références (Owendo et Port-Gentil)', href: '#/stocks' },
        { label: 'Articles sous seuil mini', value: String(ss.length), icon: 'alert', tone: crit.length ? 'red' : ss.length ? 'orange' : 'green', foot: crit.length + ' pièce(s) critique(s) pour la flotte et les grues', href: '#/stocks/reappro' }
      ];
    },
    pending: function () {
      var out = [];
      invAValider().forEach(function (i) { var a = S.get('articles', i.articleId) || {}; out.push({ title: 'Écart d\'inventaire ' + i.id + ' · ' + (a.designation || i.articleId), sub: signed(i.ecart) + ' ' + (a.unite || '') + ' · ' + F.money(i.valeurEcart), date: i.date, href: '#/stocks/inventaire', tone: 'violet' }); });
      sousSeuil().filter(function (a) { return a.critique && !a.daEnCours; }).forEach(function (a) { out.push({ title: 'Réapprovisionner · ' + a.designation, sub: 'Article critique : ' + F.num(a.qte) + ' ' + a.unite + ' pour un mini de ' + a.min, date: E.today(), href: '#/stocks/reappro', tone: 'red' }); });
      return out;
    },
    search: function (q) {
      var r = [];
      articles().forEach(function (a) { if (E.norm(a.id + ' ' + a.designation + ' ' + a.categorie).indexOf(q) >= 0) r.push({ title: a.designation, sub: a.id + ' · stock ' + F.num(a.qte) + ' ' + a.unite, href: '#/stocks/magasin/' + a.id }); });
      return r;
    },
    badge: function () { return sousSeuil().filter(function (a) { return !a.daEnCours; }).length + invAValider().length; }
  });
})();
