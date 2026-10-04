/* Administration : utilisateurs & droits, circuits de validation, journal d'audit, intégrations, données de démonstration. */
(function () {
  var E = ERP, ui = E.ui, fmt = E.fmt, esc = E.esc;
  var PROFILS = [['admin', 'Direction générale'], ['exploitation', 'Exploitation'], ['commercial', 'Commercial'], ['finance', 'Finances'], ['technique', 'Technique'], ['achats', 'Achats & magasin'], ['rh', 'Ressources humaines'], ['hse', 'HSE & sûreté']];

  function render(view, params) {
    var tab = params[0] || 'droits';
    var sc = E.scope(), sp = E.space();
    view.innerHTML = '<div class="section-title" style="margin-bottom:14px"><div><h2>Administration' + (sc ? ' · ' + esc(sp.nom) : '') + '</h2><p>' + (sc ? 'Comptes, droits d\'accès, circuits de validation et traçabilité de l\'espace ' + esc(sp.court) + ' (' + esc(sp.ville) + ').' : 'Comptes, droits d\'accès, circuits de validation et traçabilité des deux espaces (Libreville et Port-Gentil).') + '</p></div></div>' +
      ui.tabs([{ k: 'droits', l: 'Utilisateurs & droits' }, { k: 'circuits', l: 'Circuits de validation' }, { k: 'journal', l: 'Journal d\'audit', n: E.audit().length }, { k: 'integrations', l: 'Intégrations' }, { k: 'demo', l: 'Données de démonstration' }], tab, function (k) { E.go('admin/' + k); }) +
      '<div id="adm"></div>';
    var el = E.$('#adm', view);
    if (tab === 'droits') droits(el); else if (tab === 'circuits') circuits(el); else if (tab === 'journal') journal(el); else if (tab === 'integrations') integrations(el); else demo(el);
  }

  /* Module accessible dans l'espace courant (modules propres à un site, modules désactivés par la Direction générale) */
  function inSpace(m) {
    var sc = E.scope() || 'ALL';
    if (m.scopes && m.scopes.indexOf(sc) < 0) return false;
    if (sc === 'ALL') return !m.scopes || m.scopes.indexOf('ALL') >= 0;
    if (m.sites && m.sites.indexOf(sc) < 0) return false;
    return m.id === 'dashboard' || E.siteConf(sc).off.indexOf(m.id) < 0;
  }
  var SPL = { ALL: 'Direction générale', OWE: 'Libreville', POG: 'Port-Gentil' };
  function droits(el) {
    var sc = E.scope(), multi = E.session.multi();
    var mods = E.modules.filter(function (m) { return !m.hidden && m.id !== 'admin' && inSpace(m); });
    var users = E.USERS.filter(function (u) { return !sc || u.space === sc; });
    var note = sc ? '<div class="alert tone-blue" style="margin-bottom:16px">' + E.icon('info') + '<div>Espace <b>' + esc(E.space().court) + '</b> : ' + users.length + ' comptes et ' + mods.length + ' modules actifs. ' + (multi ? 'Activez ou désactivez les modules de chaque site dans <a href="#/espaces" data-glob>Espaces &amp; sites</a> (vue globale).' : 'Les modules de l\'espace et ses spécificités sont paramétrés par la Direction générale dans « Espaces &amp; sites ».') + '</div></div>'
      : '<div class="alert tone-blue" style="margin-bottom:16px">' + E.icon('info') + '<div>Chaque site dispose de son espace, de ses comptes et de ses modules. Activez ou désactivez les modules de chaque site dans <a href="#/espaces">Espaces &amp; sites</a>.</div></div>';
    el.innerHTML = note + '<div class="grid g-1-2">' +
      '<div class="card"><div class="card__h"><h3>Comptes</h3><span class="sub">' + users.length + ' comptes de démonstration' + (sc ? ' · ' + esc(SPL[sc]) : '') + '</span></div><div class="card__b flush"><div class="list">' +
      users.map(function (u) { return '<div class="list__item">' + ui.avatar(u.name, u.color) + '<div class="list__body"><b>' + esc(u.name) + '</b><div class="small muted">' + esc(u.role) + '</div><div class="small"><span class="mono">' + u.login + '</span> · ' + (sc ? '' : ui.badge(SPL[u.space] || u.space, u.space === 'POG' ? 'green' : u.space === 'OWE' ? 'blue' : 'navy') + ' ') + ui.badge('Actif', 'green') + '</div></div></div>'; }).join('') +
      '</div></div></div>' +
      '<div class="card"><div class="card__h"><h3>Matrice des droits</h3><span class="sub">modules accessibles par profil' + (sc ? ' · espace ' + esc(SPL[sc]) : ' · vue globale') + '</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Module</th>' + PROFILS.map(function (p) { return '<th class="center">' + esc(p[0] === 'admin' && sc ? 'Direction du site' : p[1]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      mods.map(function (m) { return '<tr><td class="strong nowrap">' + esc(m.label) + '</td>' + PROFILS.map(function (p) { var ok = p[0] === 'admin' || !m.roles || m.roles.indexOf(p[0]) >= 0; return '<td class="center">' + (ok ? '<span style="color:var(--green)">' + E.icon('check') + '</span>' : '<span class="muted">—</span>') + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div><div class="card__b small muted">En production : comptes nominatifs pour chaque agent, mot de passe personnel, double authentification pour la Direction et la Finance, droits réglables par module et par action (lecture, saisie, validation).</div></div>' +
      '</div>';
    E.$$('.tbl svg', el).forEach(function (s) { s.style.width = '16px'; });
    var g = E.$('[data-glob]', el); if (g) g.onclick = function (e) { e.preventDefault(); E.switchSpace('ALL'); setTimeout(function () { E.go('espaces'); }, 50); };
  }

  function circuits(el) {
    var C = [
      ['Demande d\'achat < 5 M FCFA', ['Demandeur', 'Chef de service', 'Achats']],
      ['Demande d\'achat 5 à 50 M FCFA', ['Demandeur', 'Chef de service', 'DAF', 'Achats']],
      ['Demande d\'achat > 50 M FCFA', ['Demandeur', 'Chef de service', 'DAF', 'Directeur général', 'Achats']],
      ['Recrutement', ['Besoin du manager', 'Validation DRH', 'Validation DG', 'Publication', 'Sélection', 'Validation embauche DG']],
      ['Paie mensuelle', ['Préparation', 'Contrôle RH', 'Validation DAF', 'Virements', 'Clôture']],
      ['Permis de travail à quai / à bord', ['Demande', 'Analyse de risques', 'Mesures préalables', 'Autorisation HSE', 'Visa chef de quai / commandant', 'Clôture']],
      ['Accès zone portuaire (ISPS)', ['Demande de badge', 'Contrôle d\'identité', 'Visa PFSO', 'Remise du badge']],
      ['Escale navire', ['Demande d\'escale', 'Confirmation commerciale', 'Plan de quai', 'Pilotage & remorquage', 'Facturation']],
      ['Congés', ['Demande', 'Manager', 'RH']],
      ['Facture fournisseur', ['Réception', 'Rapprochement commande / réception', 'Bon à payer', 'Paiement']]
    ];
    el.innerHTML = '<div class="grid g2">' + C.map(function (c) { return '<div class="card"><div class="card__h"><h3>' + esc(c[0]) + '</h3></div><div class="card__b">' + ui.steps(c[1], -1) + '</div></div>'; }).join('') + '</div>' +
      '<div class="alert tone-blue" style="margin-top:16px">' + E.icon('info') + '<div>Les circuits, seuils et valideurs sont paramétrables. Chaque visa est horodaté et conservé dans le journal d\'audit.</div></div>';
  }

  function journal(el) {
    var rows = E.audit();
    el.innerHTML = '<div class="card"><div class="card__h"><h3>Journal d\'audit</h3><span class="sub">' + (E.scope() ? 'actions réalisées dans l\'espace ' + esc(SPL[E.scope()]) : 'actions réalisées dans les deux espaces') + '</span><span class="spacer"></span><button class="btn sm" id="exp">' + E.icon('download') + 'Exporter</button></div>' +
      ui.table([{ label: 'Date', render: function (r) { return '<span class="nowrap">' + fmt.datetime(r.at) + '</span>'; } }, { label: 'Utilisateur', render: function (r) { return esc(r.user); } }].concat(E.scope() ? [] : [{ label: 'Espace', render: function (r) { return esc(r.site ? SPL[r.site] : 'Global'); } }]).concat([{ label: 'Module', key: 'module' }, { label: 'Action', render: function (r) { return '<b>' + esc(r.action) + '</b>'; } }, { label: 'Détail', key: 'detail' }]), rows, { empty: 'Aucune action pour le moment : validez une demande, créez un bon de commande… elles apparaîtront ici.' }) + '</div>';
    E.$('#exp', el).onclick = function () { ui.exportCSV('journal-audit', [{ label: 'Date', key: 'at' }, { label: 'Utilisateur', key: 'user' }, { label: 'Espace', csv: function (r) { return r.site ? SPL[r.site] : 'Global'; } }, { label: 'Module', key: 'module' }, { label: 'Action', key: 'action' }, { label: 'Détail', key: 'detail' }], rows); };
  }

  function integrations(el) {
    var I = [
      ['globe', 'Site internet GPM', 'Offres d\'emploi et de stage, candidatures, demandes d\'escale et avis aux navigateurs synchronisés avec le site public.', 'Actif', 'green'],
      ['ship', 'Guichet unique portuaire', 'Échange des avis d\'arrivée, manifestes et déclarations avec la douane, l\'OPRAG et la capitainerie.', 'Option', 'grey'],
      ['lock', 'Base de données sécurisée', 'Hébergement des données, sauvegardes quotidiennes, comptes nominatifs.', 'À activer', 'orange'],
      ['mail', 'Messagerie professionnelle', 'Envoi automatique des bons de commande, factures, convocations et relances par e-mail.', 'À activer', 'orange'],
      ['phone', 'WhatsApp Business', 'Notifications aux armateurs, consignataires, candidats et fournisseurs.', 'Option', 'grey'],
      ['money', 'Comptabilité', 'Export des écritures (facturation portuaire, achats, paie) vers le logiciel comptable.', 'Option', 'grey'],
      ['download', 'Excel / PDF', 'Export de toutes les listes et impression des documents.', 'Actif', 'green']
    ];
    el.innerHTML = '<div class="grid g3">' + I.map(function (i) { return '<div class="card card__b"><div class="row" style="margin-bottom:10px"><div class="list__icon tone-navy">' + E.icon(i[0]) + '</div><b>' + esc(i[1]) + '</b></div><p class="small muted" style="margin:0 0 12px">' + esc(i[2]) + '</p>' + ui.badge(i[3], i[4]) + '</div>'; }).join('') + '</div>';
  }

  function demo(el) {
    var n = 0; try { n = Math.round((localStorage.getItem('gpm_erp_v1') || '').length / 1024); } catch (e) {}
    el.innerHTML = '<div class="grid g2"><div class="card card__b"><h3 style="margin-bottom:8px">Données de démonstration</h3><p class="muted">Toutes les données sont fictives (navires, armateurs, agents et montants de démonstration) et sont enregistrées dans ce navigateur (' + n + ' Ko). Réinitialisez pour retrouver le jeu d\'exemple d\'origine.</p><button class="btn danger" id="rst">' + E.icon('refresh') + 'Réinitialiser la démonstration</button></div>' +
      '<div class="card card__b"><h3 style="margin-bottom:8px">Scénario de présentation conseillé</h3><ol class="muted" style="margin:0;padding-left:18px;line-height:1.7"><li>Sur le site public, page Carrières : envoyer une candidature de stage.</li><li>Profil <b>Ressources humaines</b> : la candidature est arrivée dans le Recrutement ; publier ou dépublier une offre → visible sur le site.</li><li>Profil <b>Achats</b> : créer une demande d\'achat (pièces de grue), puis la valider avec <b>Finance</b> et <b>Direction</b>.</li><li>Profil <b>HSE & sûreté</b> : passer au niveau de sûreté ISPS 2, enregistrer un visiteur, autoriser un permis de levage.</li><li>Profil <b>Technique</b> : mettre à jour l\'avancement d\'un projet d\'infrastructure.</li></ol></div></div>';
    E.$('#rst', el).onclick = function () { ui.confirm('Réinitialiser la démonstration', 'Toutes les saisies seront effacées.', 'Réinitialiser', E.store.reset, 'danger'); };
  }

  E.register({ id: 'admin', label: 'Administration', title: 'Administration', icon: 'settings', group: 'Système', roles: ['__admin_only'], render: render });
})();
