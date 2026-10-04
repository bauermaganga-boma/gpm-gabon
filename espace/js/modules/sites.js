/* Espaces par site : vue consolidée de la Direction générale + paramétrage des espaces Libreville / Port-Gentil.
   Chaque site dispose de son propre espace de gestion (ses données, ses comptes, ses modules) ;
   la Direction générale voit les deux sites, ensemble ou séparément. */
(function () {
  var E = ERP, ui = E.ui, esc = E.esc, fmt = E.fmt;
  var SITES = ['OWE', 'POG'];
  var LBL = { OWE: 'Libreville', POG: 'Port-Gentil' };

  function count(site, col, f) { return E.withScope(site, function () { return E.store.all(col).filter(f || function () { return true; }).length; }); }
  var AQUAI = ['À quai', 'En opérations'], ATT = ['Annoncée', 'Confirmée', 'En rade'];

  /* Indicateurs communs aux deux sites */
  function siteStats(site) {
    return E.withScope(site, function () {
      var S = E.store;
      var esc_ = S.all('escales');
      var pend = E.pendingAll();
      return {
        aQuai: esc_.filter(function (e) { return AQUAI.indexOf(e.statut) >= 0; }).length,
        attendus: esc_.filter(function (e) { return ATT.indexOf(e.statut) >= 0; }).length,
        escales30: esc_.filter(function (e) { return e.eta && E.daysBetween(String(e.eta).slice(0, 10), E.today()) <= 30 && E.daysBetween(String(e.eta).slice(0, 10), E.today()) >= 0; }).length,
        effectif: S.all('employes').filter(function (e) { return e.statut !== 'Sorti'; }).length,
        flotte: S.all('flotte').length,
        dispo: S.all('flotte').filter(function (f) { return f.statut === 'Disponible'; }).length,
        pend: pend.length,
        pendList: pend.slice(0, 5)
      };
    });
  }
  /* Indicateurs publiés par chaque module (summary), calculés site par site */
  function moduleRows() {
    var rows = [];
    E.modules.forEach(function (m) {
      if (!m.summary || m.id === 'dashboard' || m.id === 'consolide') return;
      var per = {};
      SITES.forEach(function (s) {
        per[s] = E.withScope(s, function () {
          if (m.sites && m.sites.indexOf(s) < 0) return null;
          try { return (m.summary() || [])[0] || null; } catch (e) { return null; }
        });
      });
      var lab = (per.OWE || per.POG || {}).label; if (!lab) return;
      rows.push({ m: m, label: lab, OWE: per.OWE, POG: per.POG });
    });
    return rows;
  }
  function val(x) { return x ? '<b>' + x.value + '</b>' + (x.unit ? ' <span class="muted small">' + esc(x.unit) + '</span>' : '') + (x.foot ? '<div class="small muted">' + x.foot + '</div>' : '') : '<span class="muted small">Non concerné</span>'; }

  function renderConsolide(view) {
    var st = { OWE: siteStats('OWE'), POG: siteStats('POG') };
    var rows = moduleRows();
    view.innerHTML =
      '<div class="card sit-hero"><div class="card__b"><div><div class="sit-hero__k">Direction générale · Gabon Port Management</div><h2>Vue consolidée des deux ports</h2><p>Chaque port dispose de son propre espace de gestion. Vous voyez ici les deux sites côte à côte ; ouvrez l’espace d’un site pour le piloter en détail.</p></div>' +
      '<div class="sit-hero__tot">' + tot(st.OWE.aQuai + st.POG.aQuai, 'navires à quai') + tot(st.OWE.attendus + st.POG.attendus, 'navires attendus') + tot(st.OWE.effectif + st.POG.effectif, 'agents') + tot(st.OWE.pend + st.POG.pend, 'validations en attente') + '</div></div></div>' +
      '<div class="grid g2 sit-cards">' + SITES.map(function (s) { return siteCard(s, st[s]); }).join('') + '</div>' +
      '<div class="card" style="margin-top:16px"><div class="card__h"><h3>Comparatif des sites</h3><span class="sub">indicateurs de chaque module, calculés séparément pour chaque espace</span></div><div class="card__b flush">' +
        ui.table([
          { label: 'Module', render: function (r) { return '<span class="sit-mod">' + E.icon(r.m.icon) + '<span><b>' + esc(r.m.label) + '</b><span class="small muted">' + esc(r.label) + '</span></span></span>'; } },
          { label: 'Libreville (Owendo)', render: function (r) { return val(r.OWE); } },
          { label: 'Port-Gentil', render: function (r) { return val(r.POG); } }
        ], rows, { empty: 'Aucun indicateur disponible' }) +
      '</div></div>' +
      '<div class="card" style="margin-top:16px"><div class="card__h"><h3>Activité comparée</h3><span class="sub">escales des 30 derniers jours, navires à quai et attendus</span></div><div class="card__b">' +
        ui.bars({ labels: ['Escales (30 j)', 'À quai', 'Attendus', 'Flotte dispo.'], series: [
          { name: 'Libreville (Owendo)', values: [st.OWE.escales30, st.OWE.aQuai, st.OWE.attendus, st.OWE.dispo], color: '#3a75c4' },
          { name: 'Port-Gentil', values: [st.POG.escales30, st.POG.aQuai, st.POG.attendus, st.POG.dispo], color: '#009e60' }], height: 220 }) +
      '</div></div>';
    E.$$('[data-enter]', view).forEach(function (b) { b.onclick = function () { E.switchSpace(b.dataset.enter); }; });
  }
  function tot(v, l) { return '<div><b>' + fmt.num(v) + '</b><span>' + esc(l) + '</span></div>'; }
  function siteCard(s, x) {
    var sp = E.SPACES[s];
    return '<div class="card sit-card sit-' + s + '"><div class="sit-card__h"><div class="sit-card__ico">' + E.icon('anchor') + '</div><div><b>' + esc(sp.nom) + '</b><span>' + esc(sp.court) + ' · ' + esc(sp.ville) + '</span></div><button class="btn primary sm" data-enter="' + s + '">Ouvrir l’espace ' + E.icon('arrow') + '</button></div>' +
      '<div class="sit-card__kpis">' + [[x.aQuai, 'à quai'], [x.attendus, 'attendus'], [x.effectif, 'agents'], [x.dispo + '/' + x.flotte, 'moyens disponibles']].map(function (k) { return '<div><b>' + k[0] + '</b><span>' + k[1] + '</span></div>'; }).join('') + '</div>' +
      '<div class="sit-card__pend"><div class="small muted" style="margin-bottom:6px"><b>' + x.pend + '</b> validation(s) en attente sur ce site</div>' +
        (x.pendList.length ? x.pendList.map(function (p) { return '<div class="sit-pend">' + E.icon(p.icon || 'check') + '<span>' + esc(p.title) + '</span><em>' + esc(p.module || '') + '</em></div>'; }).join('') : '<div class="small muted">Rien à valider.</div>') + '</div></div>';
  }

  /* ---------- Paramétrage des espaces ---------- */
  function renderEspaces(view) {
    var mods = E.modules.filter(function (m) { return ['dashboard', 'consolide', 'espaces'].indexOf(m.id) < 0; });
    view.innerHTML = '<div class="card" style="margin-bottom:16px"><div class="card__b"><h3 style="margin-bottom:6px">Deux espaces, une direction</h3><p class="muted" style="margin:0">Libreville (port d’Owendo) et Port-Gentil disposent chacun de leur espace de gestion : données, comptes utilisateurs et modules propres. Activez ou désactivez les modules de chaque site selon ses spécificités. Certains modules sont propres à un site (ex. <b>Soutage & eau douce</b>, uniquement à Port-Gentil).</p></div></div>' +
      '<div class="grid g2 sit-cards">' + SITES.map(function (s) {
        var sp = E.SPACES[s], conf = E.siteConf(s);
        var users = E.USERS.filter(function (u) { return u.space === s; });
        return '<div class="card sit-card sit-' + s + '"><div class="sit-card__h"><div class="sit-card__ico">' + E.icon('anchor') + '</div><div><b>' + esc(sp.nom) + '</b><span>' + esc(sp.court) + '</span></div><button class="btn sm" data-enter="' + s + '">Ouvrir ' + E.icon('arrow') + '</button></div>' +
          '<div class="card__b"><div class="sit-sub">Modules de l’espace</div><div class="sit-mods">' + mods.map(function (m) {
            var fixed = m.sites && m.sites.indexOf(s) < 0;
            var on = !fixed && conf.off.indexOf(m.id) < 0;
            return '<label class="sit-tog' + (fixed ? ' is-fixed' : '') + '" title="' + (fixed ? 'Non disponible sur ce site' : '') + '"><input type="checkbox" data-site="' + s + '" data-mod="' + m.id + '"' + (on ? ' checked' : '') + (fixed ? ' disabled' : '') + '><span class="sit-tog__sw"></span>' + E.icon(m.icon) + '<span>' + esc(m.label) + (fixed ? ' <em>· non disponible</em>' : '') + '</span></label>';
          }).join('') + '</div>' +
          '<div class="sit-sub" style="margin-top:16px">Comptes de l’espace (' + users.length + ')</div><div class="list">' + users.map(function (u) { return '<div class="list__item">' + ui.avatar(u.name, u.color, true) + '<div class="list__body"><b>' + esc(u.name) + '</b><div class="small muted">' + esc(u.role) + ' · <code>' + esc(u.login) + '</code></div></div></div>'; }).join('') + '</div></div></div>';
      }).join('') + '</div>';
    E.$$('input[data-mod]', view).forEach(function (cb) {
      cb.onchange = function () {
        var conf = E.siteConf(cb.dataset.site), id = cb.dataset.mod;
        conf.off = conf.off.filter(function (x) { return x !== id; }); if (!cb.checked) conf.off.push(id);
        E.saveConf(); E.log(cb.checked ? 'Module activé' : 'Module désactivé', (E.mod(id) || {}).label + ' · ' + E.SPACES[cb.dataset.site].nom, 'espaces');
        ui.toast((cb.checked ? 'Activé : ' : 'Désactivé : ') + (E.mod(id) || {}).label + ' — ' + E.SPACES[cb.dataset.site].nom);
      };
    });
    E.$$('[data-enter]', view).forEach(function (b) { b.onclick = function () { E.switchSpace(b.dataset.enter); }; });
  }

  E.register({ id: 'consolide', label: 'Vue consolidée des sites', title: 'Vue consolidée des sites', icon: 'layers', group: 'Pilotage', scopes: ['ALL'], roles: ['__dg'], render: renderConsolide });
  E.register({ id: 'espaces', label: 'Espaces & sites', title: 'Espaces & sites', icon: 'pin', group: 'Système', scopes: ['ALL'], roles: ['__dg'], render: renderEspaces });
})();
