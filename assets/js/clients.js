/* Gabon Port Management — Espace armateurs : demande d'escale en ligne et suivi des escales */
(function () {
  'use strict';
  var DATA = window.GPM_DATA, UI = window.GPM_UI;
  if (!DATA || !UI) return;
  var esc = UI.esc, norm = UI.norm, fmtDT = UI.fmtDT, parseDate = UI.parseDate;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var STEPS = ['Annoncée', 'Confirmée', 'En rade', 'À quai', 'En opérations', 'Appareillé'];

  function pad(n) { return String(n).padStart(2, '0'); }
  function toLocalInput(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  /* ================= Demande d'escale ================= */
  var form = $('#escale-form');
  if (form) {
    var site = $('#e-site'), soutage = $('#e-soutage'), hint = $('#e-soutage-hint'), eta = $('#e-eta'), etd = $('#e-etd'), note = $('#escale-note');
    var now = new Date(); now.setMinutes(0, 0, 0);
    eta.min = toLocalInput(now); etd.min = toLocalInput(now);
    var syncSite = function () {
      var pog = site.value === 'POG';
      soutage.disabled = !pog;
      if (!pog) soutage.checked = false;
      hint.textContent = pog ? 'Disponible à Port-Gentil' : 'Port-Gentil uniquement';
    };
    site.addEventListener('change', syncSite);
    eta.addEventListener('change', function () { if (eta.value) etd.min = eta.value; });
    var p = new URLSearchParams(location.search).get('port');
    if (p === 'POG' || p === 'OWE') site.value = p;
    syncSite();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true, first = null, msg = 'Merci de compléter les champs signalés en rouge.';
      $$('[required]', form).forEach(function (f) {
        var v = f.type === 'checkbox' ? f.checked : String(f.value).trim() !== '';
        if (v && f.type === 'email') v = /^\S+@\S+\.\S+$/.test(f.value.trim());
        if (v && f.name === 'imo') { v = /^\d{7}$/.test(f.value.trim()); if (!v) msg = 'Le numéro IMO doit comporter 7 chiffres.'; }
        if (v && f.name === 'telephone') v = f.value.replace(/\D/g, '').length >= 8;
        if (v && f.type === 'number') v = +f.value >= +f.min && +f.value <= +f.max;
        (f.type === 'checkbox' ? f.parentNode : f).classList.toggle('is-invalid', !v);
        if (!v) { ok = false; first = first || f; }
      });
      if (ok && eta.value && etd.value && parseDate(etd.value) <= parseDate(eta.value)) {
        ok = false; first = etd; etd.classList.add('is-invalid'); msg = 'Le départ prévu (ETD) doit être postérieur à l\'arrivée prévue (ETA).';
      }
      note.classList.toggle('is-error', !ok);
      if (!ok) { note.textContent = msg; if (first && first.focus) first.focus(); return; }

      var d = new FormData(form);
      var dem = {
        navire: String(d.get('navire')).trim(),
        imo: String(d.get('imo')).trim(),
        pavillon: String(d.get('pavillon')).trim(),
        type: d.get('type'),
        loa: +d.get('loa'),
        te: +d.get('te'),
        site: d.get('site'),
        port: UI.siteName(d.get('site')),
        eta: d.get('eta'),
        etd: d.get('etd'),
        operations: d.get('operations'),
        volume: String(d.get('volume') || '').trim(),
        services: d.getAll('services'),
        consignataire: String(d.get('consignataire')).trim(),
        contact: String(d.get('contact')).trim(),
        email: String(d.get('email')).trim(),
        telephone: String(d.get('telephone')).trim(),
        message: String(d.get('message') || '').trim(),
        statut: 'Nouvelle',
        source: 'Site internet'
      };
      var id = DATA.demanderEscale(dem);
      showConfirm(id, dem);
    });
  }

  function showConfirm(id, c) {
    var box = $('#demande-box');
    box.innerHTML = '<div class="confirm" tabindex="-1" id="confirm">' +
      '<div class="confirm__ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg></div>' +
      '<h3>Demande d\'escale enregistrée</h3>' +
      '<p>Merci ' + esc(c.contact) + '. Votre demande pour le <strong>' + esc(c.navire) + '</strong> est transmise au service commercial et à l\'exploitation. Votre numéro de demande :</p>' +
      '<div class="confirm__id">' + esc(id) + '</div>' +
      '<dl class="confirm__recap">' +
        '<div><dt>Navire</dt><dd>' + esc(c.navire) + ' · IMO ' + esc(c.imo) + ' · ' + esc(c.pavillon) + '</dd></div>' +
        '<div><dt>Type</dt><dd>' + esc(c.type) + ' · LOA ' + esc(c.loa) + ' m · TE ' + esc(c.te) + ' m</dd></div>' +
        '<div><dt>Port</dt><dd>' + esc(c.port) + '</dd></div>' +
        '<div><dt>ETA / ETD</dt><dd>' + esc(fmtDT(c.eta)) + ' → ' + esc(fmtDT(c.etd)) + '</dd></div>' +
        '<div><dt>Opérations</dt><dd>' + esc(c.operations) + (c.volume ? ' (' + esc(c.volume) + ')' : '') + '</dd></div>' +
        '<div><dt>Services</dt><dd>' + esc(c.services.join(', ') || '—') + '</dd></div>' +
        '<div><dt>Consignataire</dt><dd>' + esc(c.consignataire) + '</dd></div>' +
      '</dl>' +
      '<p><span class="demo-tag">Démonstration</span> Elle apparaît dans l\'espace de gestion, module Escales.</p>' +
      '<div class="confirm__actions">' +
        '<button type="button" class="btn btn--navy" id="confirm-track">Suivre cette demande</button>' +
        '<a class="btn btn--outline" href="espace/index.html?u=commercial">Voir dans l\'espace de gestion</a>' +
        '<a class="btn btn--outline" href="clients.html#demande">Nouvelle demande</a>' +
      '</div></div>';
    var el = $('#confirm');
    el.scrollIntoView({ behavior: UI.reduce ? 'auto' : 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
    $('#confirm-track').addEventListener('click', function () { search(id, true); });
    hints();
  }

  /* ================= Suivi d'une escale ================= */
  var tForm = $('#track-form'), tQ = $('#track-q'), tRes = $('#track-res'), tHint = $('#track-hint');
  /* Décisions prises dans l'espace de gestion (collection ERP demandesTraitees) */
  function traitees() {
    try { var db = JSON.parse(localStorage.getItem('gpm_erp_v1') || 'null'); return db && db.c && Array.isArray(db.c.demandesTraitees) ? db.c.demandesTraitees : []; } catch (e) { return []; }
  }
  function decision(id) { return traitees().filter(function (t) { return t.id === id; })[0] || null; }
  function demandes() {
    return (DATA.demandesEscale() || []).filter(function (x) {
      var t = decision(x.id); return !(t && t.decision === 'Acceptée' && t.escale); /* acceptée : l'escale créée la remplace */
    }).map(function (x) {
      var t = decision(x.id);
      return { id: x.id, navire: x.navire, imo: x.imo, pavillon: x.pavillon, type: x.type, site: x.site, poste: '', eta: x.eta, etd: x.etd, statut: t ? 'Demande non retenue' : 'Demande reçue', motif: t ? t.motif : '', operations: x.operations, consignataire: x.consignataire, fait: 0, demande: true, loa: x.loa };
    });
  }
  function all() {
    var tr = traitees();
    return (DATA.escales() || []).map(function (e) {
      var t = tr.filter(function (x) { return x.escale === e.id; })[0];
      return t ? Object.assign({}, e, { dem: t.id }) : e;
    }).concat(demandes());
  }
  function card(e) {
    var si = UI.statusInfo(e.statut), idx = STEPS.indexOf(e.statut);
    if (idx < 0) { var n = norm(e.statut); STEPS.forEach(function (s, i) { if (norm(s) === n) idx = i; }); }
    var done = si.group === 'partis';
    var steps = STEPS.map(function (s, i) {
      var c = done || i < idx ? 'is-done' : (i === idx ? 'is-current' : '');
      return '<li class="' + c + '">' + esc(s) + '</li>';
    }).join('');
    var pct = Math.max(0, Math.min(100, +e.fait || 0));
    return '<article class="tcard">' +
      '<div class="tcard__head"><div><h3>' + esc(e.navire) + '</h3><small>' + esc(e.id) + (e.dem ? ' · demande ' + esc(e.dem) : '') + (e.imo ? ' · IMO ' + esc(e.imo) : '') + ' · ' + esc(e.type || '') + (e.pavillon ? ' · ' + esc(e.pavillon) : '') + '</small></div>' +
      '<span class="status status--' + si.cls + '">' + esc(e.statut) + '</span></div>' +
      '<dl class="tcard__grid">' +
        '<div><dt>Port</dt><dd>' + esc(UI.siteName(e.site)) + '</dd></div>' +
        '<div><dt>Poste</dt><dd>' + esc(e.poste ? UI.posteName(e.poste) : 'À attribuer') + '</dd></div>' +
        '<div><dt>' + (e.ata ? 'Arrivé (ATA)' : 'Arrivée (ETA)') + '</dt><dd>' + esc(fmtDT(e.ata || e.eta)) + '</dd></div>' +
        '<div><dt>' + (e.atd ? 'Parti (ATD)' : 'Départ (ETD)') + '</dt><dd>' + esc(fmtDT(e.atd || e.etd)) + '</dd></div>' +
      '</dl>' +
      (e.demande ? '<p class="track__hint" style="margin:0 0 12px">' + (e.statut === 'Demande non retenue' ? 'Demande non retenue par GPM' + (e.motif ? ' : ' + esc(e.motif) : '') + '. Contactez le service commercial au <a href="tel:+24111703274">011 70 32 74</a>.' : 'Demande en cours d\'examen par le service commercial : elle passera au statut « Confirmée » avec l\'attribution d\'un poste.') + '</p>' : '') +
      '<ol class="prog" aria-label="Étapes de l\'escale">' + steps + '</ol>' +
      '<div class="tcard__ops"><div class="lbl"><span>' + esc(e.operations || 'Opérations') + '</span><span>' + pct + ' %</span></div>' +
      '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="Avancement des opérations"><i data-w="' + pct + '"></i></div></div>' +
    '</article>';
  }
  function search(q, scroll) {
    if (!tRes) return;
    tQ.value = q;
    var nq = norm(q.trim());
    if (!nq) { tRes.innerHTML = '<p class="tcard__empty">Saisissez le nom d\'un navire ou un numéro d\'escale.</p>'; return; }
    var res = all().filter(function (e) {
      return [e.navire, e.id, e.imo, e.dem].some(function (v) { return norm(v).indexOf(nq) !== -1; });
    }).sort(function (a, b) { return parseDate(b.eta) - parseDate(a.eta); }).slice(0, 6);
    tRes.innerHTML = res.map(card).join('') || '<p class="tcard__empty">Aucune escale ne correspond à « ' + esc(q) + ' ». Vérifiez l\'orthographe ou contactez le service commercial au <a href="tel:+24111703274">011 70 32 74</a>.</p>';
    requestAnimationFrame(function () { setTimeout(function () { $$('.bar i', tRes).forEach(function (b) { b.style.width = b.dataset.w + '%'; }); }, 60); });
    if (scroll) $('#suivi').scrollIntoView({ behavior: UI.reduce ? 'auto' : 'smooth', block: 'start' });
  }
  function hints() {
    if (!tHint) return;
    var ex = [];
    var esc0 = (DATA.escales() || []);
    var a = esc0.filter(function (e) { return UI.statusInfo(e.statut).group === 'quai'; })[0];
    var b = esc0.filter(function (e) { return UI.statusInfo(e.statut).group === 'attendus'; })[0];
    if (a) ex.push(a.navire); if (b) ex.push(b.id);
    var dm = demandes(); if (dm.length) ex.push(dm[dm.length - 1].id);
    tHint.innerHTML = ex.length ? 'Essayez : ' + ex.map(function (x) { return '<button type="button" data-q="' + esc(x) + '">' + esc(x) + '</button>'; }).join(' ') : '';
  }
  if (tForm) {
    tForm.addEventListener('submit', function (e) { e.preventDefault(); search(tQ.value); });
    tHint.addEventListener('click', function (e) { var b = e.target.closest('[data-q]'); if (b) search(b.dataset.q); });
    hints();
    var q0 = new URLSearchParams(location.search).get('escale');
    if (q0) search(q0, true);
  }
})();
