/* Gabon Port Management — scripts communs du site public (accueil, espace armateurs, carrières) */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var DATA = window.GPM_DATA || null;
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- Utilitaires ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  /* « aaaa-mm-jj » ou « aaaa-mm-jjThh:mm » -> Date locale */
  function parseDate(d) {
    var m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
    if (!m) return new Date(NaN);
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  }
  function fmtDate(d, opts) {
    var dt = parseDate(d);
    if (isNaN(dt)) return esc(d);
    return dt.toLocaleDateString('fr-FR', opts || { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtDT(d) {
    var dt = parseDate(d);
    if (isNaN(dt)) return '—';
    var day = dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    return day + ' · ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
  }
  var SITES = { OWE: 'Owendo', POG: 'Port-Gentil' };
  function siteName(s) { return SITES[s] || s || '—'; }
  function posteName(p) { var m = String(p || '').match(/P(\d+)$/); return m ? 'Poste ' + m[1] : (p || 'Poste à attribuer'); }
  /* Statut d'escale -> classe CSS et groupe (quai | attendus | partis) */
  function statusInfo(s) {
    var n = norm(s);
    if (n.indexOf('operation') !== -1) return { cls: 'ops', group: 'quai' };
    if (n.indexOf('quai') !== -1) return { cls: 'quai', group: 'quai' };
    if (n.indexOf('rade') !== -1) return { cls: 'rade', group: 'attendus' };
    if (n.indexOf('confirm') !== -1) return { cls: 'conf', group: 'attendus' };
    if (n.indexOf('appareill') !== -1 || n.indexOf('parti') !== -1 || n.indexOf('termin') !== -1) return { cls: 'parti', group: 'partis' };
    if (n.indexOf('demande') !== -1 || n.indexOf('nouvelle') !== -1) return { cls: 'dem', group: 'attendus' };
    return { cls: 'ann', group: 'attendus' };
  }
  var ICON_ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var ICON_SHIP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17c2 2 4 2 6 0 2 2 4 2 6 0 2 2 4 2 6 0"/><path d="M5 14 4 10h16l-1 4M8 10V6h8v4M12 3v3"/></svg>';
  function escales() { try { return (DATA && DATA.escales()) || []; } catch (e) { return []; } }

  /* ---------- Avis aux navigateurs (accueil + espace armateurs) ---------- */
  function renderAvis() {
    $$('#avis-list').forEach(function (box) {
      if (!DATA) return;
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var list = (DATA.avis() || []).slice().sort(function (a, b) { return parseDate(b.date) - parseDate(a.date); });
      var limit = +box.dataset.limit || 0;
      if (limit) list = list.slice(0, limit);
      box.innerHTML = list.map(function (a) {
        var lv = norm(a.niveau), cls = lv.indexOf('prud') === 0 ? ' avis__item--prudence' : (lv.indexOf('dang') === 0 || lv.indexOf('urg') === 0 || lv.indexOf('interdi') === 0 ? ' avis__item--danger' : '');
        var past = a.jusqu && parseDate(a.jusqu) < today;
        return '<li class="avis__item' + cls + (past ? ' is-past' : '') + '">' +
          '<div class="avis__meta"><span class="avis__lvl">' + esc(a.niveau || 'Information') + '</span><span>' + esc(a.id) + '</span><span>' + esc(siteName(a.site)) + '</span>' +
          '<span>' + (past ? 'Expiré le ' + fmtDate(a.jusqu, { day: 'numeric', month: 'short' }) : (a.jusqu ? 'Jusqu\'au ' + fmtDate(a.jusqu, { day: 'numeric', month: 'short' }) : 'Publié le ' + fmtDate(a.date, { day: 'numeric', month: 'short' }))) + '</span></div>' +
          '<b>' + esc(a.titre) + '</b><p>' + esc(a.texte) + '</p></li>';
      }).join('') || '<li class="avis__item"><b>Aucun avis en cours</b><p>Aucun avis aux navigateurs n\'est publié actuellement.</p></li>';
    });
  }

  /* ---------- Bandeau « en direct » + tableau des navires ---------- */
  function groups(list) {
    var g = { quai: [], attendus: [], partis: [] };
    var limite = Date.now() - 7 * 864e5; /* « partis » : seulement les 7 derniers jours */
    list.forEach(function (e) {
      var grp = statusInfo(e.statut).group;
      if (grp === 'partis' && new Date(e.atd || e.etd || 0).getTime() < limite) return;
      g[grp].push(e);
    });
    return g;
  }
  function renderLive() {
    if (!$('#live-quai')) return;
    var g = groups(escales());
    $('#live-quai').textContent = g.quai.length;
    $('#live-attendus').textContent = g.attendus.length;
    $('#live-partis').textContent = g.partis.length;
  }

  var board = $('#board'), fSite = $('#f-site'), fStatut = $('#f-statut');
  var state = { site: 'all', statut: 'quai' };
  function renderBoard() {
    if (!board) return;
    var all = escales().filter(function (e) { return state.site === 'all' || e.site === state.site; });
    var g = groups(all);
    $$('[data-n]', fStatut).forEach(function (n) { n.textContent = g[n.dataset.n].length; });
    var list = state.statut === 'all' ? g.quai.concat(g.attendus, g.partis) : g[state.statut];
    list = list.slice().sort(function (a, b) {
      var ga = statusInfo(a.statut).group, gb = statusInfo(b.statut).group;
      if (ga !== gb) return ['quai', 'attendus', 'partis'].indexOf(ga) - ['quai', 'attendus', 'partis'].indexOf(gb);
      if (ga === 'partis') return parseDate(b.atd || b.etd) - parseDate(a.atd || a.etd);
      if (ga === 'quai') return parseDate(a.etd) - parseDate(b.etd);
      return parseDate(a.eta) - parseDate(b.eta);
    });
    if (!list.length) {
      board.innerHTML = '<p class="board__empty">Aucun navire dans cette catégorie pour le moment.</p>';
      return;
    }
    board.innerHTML = '<table><thead><tr><th scope="col">Navire</th><th scope="col">Port / poste</th><th scope="col">Arrivée</th><th scope="col">Départ</th><th scope="col">Opérations</th><th scope="col">Statut</th></tr></thead><tbody>' +
      list.map(function (e) {
        var si = statusInfo(e.statut), pct = Math.max(0, Math.min(100, +e.fait || 0));
        var arr = e.ata ? fmtDT(e.ata) + '<small>Arrivé (ATA)</small>' : fmtDT(e.eta) + '<small>Prévu (ETA)</small>';
        var dep = e.atd ? fmtDT(e.atd) + '<small>Parti (ATD)</small>' : fmtDT(e.etd) + '<small>Prévu (ETD)</small>';
        return '<tr>' +
          '<td class="ship__name-cell"><div class="ship__name"><span class="ship__ico">' + ICON_SHIP + '</span><div><b>' + esc(e.navire) + '</b><small>' + esc(e.type) + ' · ' + esc(e.pavillon) + (e.loa ? ' · ' + esc(e.loa) + ' m' : '') + '</small></div></div></td>' +
          '<td data-label="Port / poste" class="ship__port"><b>' + esc(siteName(e.site)) + '</b><small>' + esc(posteName(e.poste)) + '</small></td>' +
          '<td data-label="Arrivée" class="ship__time">' + arr + '</td>' +
          '<td data-label="Départ" class="ship__time">' + dep + '</td>' +
          '<td data-label="Opérations" class="ship__ops-cell"><div class="ship__ops">' + esc(e.operations || '—') + '</div>' +
            (si.group === 'quai' ? '<div class="ship__bar" role="img" aria-label="Opérations réalisées à ' + pct + ' %"><i style="width:' + pct + '%"></i></div>' : '') + '</td>' +
          '<td data-label="Statut" class="ship__status-cell"><span class="status status--' + si.cls + '">' + esc(e.statut) + '</span></td>' +
        '</tr>';
      }).join('') + '</tbody></table>';
  }
  function bindSeg(box, key) {
    if (!box) return;
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state[key] = b.dataset.v;
      $$('button', box).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      renderBoard();
    });
  }
  bindSeg(fSite, 'site'); bindSeg(fStatut, 'statut');
  $$('[data-goto]').forEach(function (a) {
    a.addEventListener('click', function () {
      var b = fStatut && $('button[data-v="' + a.dataset.goto + '"]', fStatut);
      if (b) b.click();
    });
  });

  /* ---------- Offres (aperçu accueil) ---------- */
  function renderJobsTeaser() {
    var box = $('#jobs-teaser');
    if (!box || !DATA) return;
    var list = (DATA.offres() || []).slice().sort(function (a, b) { return parseDate(b.publie) - parseDate(a.publie); }).slice(0, 3);
    box.innerHTML = list.map(function (o) {
      return '<a class="job reveal" href="carrieres.html?offre=' + encodeURIComponent(o.id) + '#offres">' +
        '<div><h3>' + esc(o.titre) + '</h3><div class="job__meta"><span>' + esc(o.direction) + '</span><span class="c">' + esc(o.contrat) + '</span><span>' + esc(o.lieu) + '</span></div></div>' +
        '<span class="job__go">Voir l\'offre ' + ICON_ARROW + '</span>' +
        '<span class="job__date">Publiée le ' + fmtDate(o.publie, { day: 'numeric', month: 'long', year: 'numeric' }) + (o.cloture ? ' · clôture le ' + fmtDate(o.cloture, { day: 'numeric', month: 'long' }) : '') + '</span></a>';
    }).join('') || '<p class="jobs__empty">Aucune offre publiée pour le moment. Vous pouvez déposer une candidature spontanée.</p>';
  }

  window.GPM_UI = { esc: esc, norm: norm, fmtDate: fmtDate, fmtDT: fmtDT, parseDate: parseDate, siteName: siteName, posteName: posteName, statusInfo: statusInfo, reduce: reduce };

  renderAvis();
  renderLive();
  renderBoard();
  renderJobsTeaser();

  /* ---------- En-tête ---------- */
  var header = $('#header');
  var totop = $('#totop'), ring = totop && $('.fg', totop), RC = 2 * Math.PI * 24;
  if (ring) { ring.style.strokeDasharray = RC.toFixed(1); ring.style.strokeDashoffset = RC.toFixed(1); }
  var ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset;
    if (header) header.classList.toggle('is-scrolled', y > 30);
    if (totop) {
      totop.classList.toggle('is-visible', y > 480);
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (ring && max > 0) ring.style.strokeDashoffset = (RC * (1 - Math.min(1, y / max))).toFixed(1);
    }
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ---------- Mobile : le bouton WhatsApp ne masque pas le bandeau « en direct » du héro ---------- */
  var heroLive = $('.hero__live');
  if (heroLive && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      document.body.classList.toggle('live-in-view', entries[0].isIntersecting);
    }, { rootMargin: '0px 0px -40px 0px' }).observe(heroLive);
  }

  /* ---------- Retour en haut ---------- */
  if (totop) {
    totop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      var brand = $('.brand');
      if (brand) setTimeout(function () { brand.focus({ preventScroll: true }); }, reduce ? 0 : 500);
    });
  }

  /* ---------- Menu mobile ---------- */
  var burger = $('#burger'), nav = $('#nav');
  if (burger && nav) {
    var closeNav = function () {
      nav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Ouvrir le menu');
      document.body.classList.remove('nav-open');
      document.body.style.overflow = '';
    };
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      document.body.style.overflow = open ? 'hidden' : '';
      document.body.classList.toggle('nav-open', open);
    });
    $$('a', nav).forEach(function (a) { a.addEventListener('click', closeNav); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('is-open')) { closeNav(); burger.focus(); } });
    window.addEventListener('resize', function () { if (window.innerWidth > 1140 && nav.classList.contains('is-open')) closeNav(); });
  }

  /* ---------- Compteurs ---------- */
  function fmtNum(v, dec) {
    return v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).replace(/[  ]/g, ' ');
  }
  function runCounter(el) {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    var target = parseFloat(el.dataset.count) || 0, dec = +el.dataset.decimals || 0, pre = el.dataset.prefix || '';
    var out = function (v) { el.textContent = pre + fmtNum(v, dec); };
    if (reduce) { out(target); return; }
    var t0 = null, dur = 1700;
    function step(t) {
      if (!t0) t0 = t;
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      out(target * e);
      if (k < 1) requestAnimationFrame(step); else out(target);
    }
    requestAnimationFrame(step);
  }
  var counters = $$('[data-count]');
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { runCounter(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.4 });
    counters.forEach(function (c) { cio.observe(c); });
  } else counters.forEach(runCounter);

  /* ---------- Apparition au défilement ---------- */
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    reveals.forEach(function (el, i) { el.style.transitionDelay = (i % 4) * 60 + 'ms'; io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- Lien actif dans la navigation ---------- */
  if (nav && 'IntersectionObserver' in window) {
    var links = $$('a[href^="#"]', nav);
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (l) { l.classList.toggle('is-active', l.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (l) { var s = document.getElementById(l.getAttribute('href').slice(1)); if (s) spy.observe(s); });
  }

  /* ---------- Onglets (ports) ---------- */
  $$('[data-tabs]').forEach(function (list) {
    var tabs = $$('[role="tab"]', list);
    function select(t, focus) {
      tabs.forEach(function (x) {
        var on = x === t, panel = document.getElementById(x.getAttribute('aria-controls'));
        x.setAttribute('aria-selected', String(on));
        x.tabIndex = on ? 0 : -1;
        if (panel) {
          panel.hidden = !on;
          if (on) {
            panel.classList.remove('is-in'); void panel.offsetWidth; panel.classList.add('is-in');
            $$('.reveal', panel).forEach(function (r) { r.classList.add('is-visible'); });
          }
        }
      });
      if (focus) t.focus();
    }
    list.addEventListener('click', function (e) { var t = e.target.closest('[role="tab"]'); if (t) select(t); });
    list.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement); if (i < 0) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); select(tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length], true); }
    });
    if (location.hash === '#port-gentil') select(tabs[1]);
  });

  /* ---------- Carte (Owendo / Port-Gentil) ---------- */
  var mapFrame = $('#map-frame');
  if (mapFrame) {
    $$('[data-map]').forEach(function (b, i, all) {
      b.addEventListener('click', function () {
        all.forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
        mapFrame.src = b.dataset.map;
      });
    });
  }

  /* ---------- Galerie filtrable ---------- */
  var gfilters = $('.gfilters');
  if (gfilters) {
    gfilters.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var f = b.dataset.filter;
      $$('button', gfilters).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      $$('.g-item').forEach(function (g) { g.classList.toggle('is-hidden', f !== 'all' && g.dataset.cat !== f); });
    });
  }

  /* ---------- Visionneuse (clavier + glisser) ---------- */
  var lb = $('#lightbox');
  if (lb) {
    var lbImg = $('img', lb), lbCap = $('figcaption', lb), group = [], idx = 0, lastFocus = null;
    var show = function (i) {
      idx = (i + group.length) % group.length;
      var fig = group[idx], img = $('img', fig), cap = $('figcaption', fig);
      lbImg.src = img.currentSrc || img.src; lbImg.alt = img.alt;
      lbCap.innerHTML = esc(cap ? cap.textContent : img.alt) + '<span class="lightbox__count">' + (idx + 1) + ' / ' + group.length + '</span>';
    };
    var openLb = function (fig) {
      group = $$('.g-item').filter(function (f) { return !f.classList.contains('is-hidden'); });
      lastFocus = document.activeElement;
      show(group.indexOf(fig));
      lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      $('.lightbox__close', lb).focus();
    };
    var closeLb = function () {
      lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };
    $$('.g-item').forEach(function (fig) {
      fig.tabIndex = 0;
      fig.setAttribute('role', 'button');
      fig.setAttribute('aria-label', 'Agrandir : ' + ($('figcaption', fig) || {}).textContent);
      fig.addEventListener('click', function () { openLb(fig); });
      fig.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLb(fig); } });
    });
    $('.lightbox__close', lb).addEventListener('click', closeLb);
    $('.lightbox__prev', lb).addEventListener('click', function (e) { e.stopPropagation(); show(idx - 1); });
    $('.lightbox__next', lb).addEventListener('click', function (e) { e.stopPropagation(); show(idx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeLb();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === 'Tab') {
        var f = $$('button', lb), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    var sx = null, sy = null;
    lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) show(idx + (dx < 0 ? 1 : -1));
      sx = sy = null;
    });
  }

  /* ---------- Formulaire de contact ---------- */
  var form = $('#contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true, first = null;
      $$('[required]', form).forEach(function (f) {
        var valid = f.type === 'checkbox' ? f.checked : f.value.trim() !== '';
        if (valid && f.type === 'email') valid = /^\S+@\S+\.\S+$/.test(f.value.trim());
        (f.type === 'checkbox' ? f.parentNode : f).classList.toggle('is-invalid', !valid);
        if (!valid) { ok = false; first = first || f; }
      });
      var note = $('#form-note');
      note.classList.toggle('is-error', !ok);
      if (!ok) { note.textContent = 'Merci de compléter les champs signalés (nom, courriel valide, message, accord).'; if (first) first.focus(); return; }
      var d = new FormData(form);
      var msg = {
        nom: String(d.get('nom')).trim(), societe: String(d.get('societe') || '').trim(), email: String(d.get('email')).trim(),
        telephone: String(d.get('tel') || '').trim(), objet: d.get('objet'), port: d.get('port'), message: String(d.get('message')).trim(),
        statut: 'Nouveau', source: 'Site internet'
      };
      var id = DATA ? DATA.contacter(msg) : 'MSG';
      var subject = '[' + id + '] ' + msg.objet + ' — ' + msg.port;
      var body = 'Nom : ' + msg.nom + '\nSociété / organisme : ' + (msg.societe || '—') + '\nCourriel : ' + msg.email +
        '\nTéléphone : ' + (msg.telephone || '—') + '\nPort concerné : ' + msg.port + '\nRéférence : ' + id + '\n\n' + msg.message;
      var mail = form.dataset.mail || '';
      var href = 'mailto:' + mail + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      var box = $('#contact-box');
      box.innerHTML = '<div class="confirm" tabindex="-1" id="contact-confirm">' +
        '<div class="confirm__ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg></div>' +
        '<h3>Merci ' + esc(msg.nom.split(' ')[0]) + ', votre message est enregistré</h3>' +
        '<p>Votre messagerie s\'ouvre pour finaliser l\'envoi à <strong>' + esc(mail) + '</strong>. Votre référence :</p>' +
        '<div class="confirm__id">' + esc(id) + '</div>' +
        '<p>Si votre messagerie ne s\'est pas ouverte, <a href="' + esc(href) + '">cliquez ici</a> ou appelez le <a href="tel:+24111703274">011 70 32 74</a>.</p>' +
        '<div class="confirm__actions"><a class="btn btn--navy" href="clients.html#demande">Demander une escale</a><a class="btn btn--outline" href="#accueil">Retour en haut</a></div></div>';
      var c = $('#contact-confirm');
      c.focus({ preventScroll: true });
      c.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      setTimeout(function () { window.location.href = href; }, 400);
    });
  }
})();
