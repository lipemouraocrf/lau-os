/* LauOS v92 - Meu Blog aparece SOMENTE no lado do Namorado.
   Lau/rosa não recebe essa aba. Este arquivo deve ser carregado por último. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const LAU_TABS = [
    ['hoje', '💗', 'Hoje'],
    ['namorado', '💙', 'Namorado'],
    ['fotos', '📸', 'Fotos'],
    ['momentos', '🎞️', 'Momentos'],
    ['diario', '📓', 'Diário'],
    ['planos', '🗺️', 'Planos'],
    ['agenda', '🗓️', 'Agenda'],
    ['blog', '📝', 'Blog'],
    ['desejos', '🌟', 'Desejos'],
    ['cartas', '💌', 'Cartas'],
    ['series-filmes', '🎬', 'LauTime'],
    ['musicas', '🎵', 'Músicas']
  ];

  const NAMORADO_TABS = [
    ['hoje', '💙', 'Hoje'],
    ['namorado', '🫶', 'Namorado'],
    ['fotos', '📸', 'Fotos'],
    ['momentos', '🎞️', 'Momentos'],
    ['planos', '🗺️', 'Planos'],
    ['agenda', '🗓️', 'Agenda'],
    ['blog', '📝', 'Blog'],
    ['blog-namorado', '✍️', 'Meu Blog'],
    ['desejos', '🌟', 'Desejos'],
    ['cartas', '💌', 'Cartas'],
    ['series-filmes', '🎬', 'LauTime'],
    ['musicas', '🎵', 'Músicas']
  ];

  const LAU_PANEL_BY_PAGE = {
    blog: 'blogCorner',
    agenda: 'agendaCorner',
    diario: 'diaryCorner',
    desejos: 'wishCorner',
    cartas: 'lettersCorner',
    planos: 'plansCorner',
    musicas: 'musicCorner',
    mais: null
  };

  const BOY_PANEL_BY_PAGE = {
    blog: 'viewBlog',
    agenda: 'viewAgenda',
    desejos: 'viewWishes',
    cartas: 'viewLetters',
    planos: 'viewPlans',
    musicas: 'viewMusic',
    mais: null
  };

  let currentPage = null;
  let legacy = {};
  let booted = false;
  let lastUser = null;
  let observer = null;
  let namoradoV86Promise = null;
  let desejosV88Promise = null;
  let watchTimeV1Promise = null;


  function ensureWatchTimeV1Assets() {
    if (window.LauOSWatchTimeV1) return Promise.resolve(window.LauOSWatchTimeV1);

    if (!document.querySelector('link[data-lauos-watchtime-v1]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/styles/lauos-watchtime-v1.css';
      link.dataset.lauosWatchtimeV1 = '1';
      document.head.appendChild(link);
    }

    if (watchTimeV1Promise) return watchTimeV1Promise;
    watchTimeV1Promise = new Promise((resolve) => {
      const existing = document.querySelector('script[data-lauos-watchtime-v1]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.LauOSWatchTimeV1 || null), { once: true });
        setTimeout(() => resolve(window.LauOSWatchTimeV1 || null), 1200);
        return;
      }
      const script = document.createElement('script');
      script.src = '/scripts/lauos-watchtime-v1.js';
      script.defer = true;
      script.dataset.lauosWatchtimeV1 = '1';
      script.onload = () => resolve(window.LauOSWatchTimeV1 || null);
      script.onerror = () => resolve(null);
      document.body.appendChild(script);
      setTimeout(() => resolve(window.LauOSWatchTimeV1 || null), 1600);
    });
    return watchTimeV1Promise;
  }

  function showWatchTimeV1() {
    const usuario = user();
    prepareBase(usuario);
    display($('lauraArea'), false);
    display($('namoradoArea'), false);
    display($('countdownArea'), false);

    let host = $('lauosWatchTimeV1');
    if (!host) {
      host = document.createElement('main');
      host.id = 'lauosWatchTimeV1';
      host.className = 'lauos-watchtime-v1-host';
      document.body.appendChild(host);
    }
    display(host, true);
    document.body.classList.add('lauos-watchtime-active');

    if (window.LauOSWatchTimeV1) {
      window.LauOSWatchTimeV1.show(host, { usuario });
      return true;
    }

    host.innerHTML = '<div class="wt-loading">Carregando Séries & Filmes... 🎬</div>';
    ensureWatchTimeV1Assets().then((mod) => {
      if (mod && currentPage === 'series-filmes') mod.show(host, { usuario: user() });
    });
    return true;
  }


  function ensureDesejosV88Assets() {
    if (window.LauOSDesejosV88) return Promise.resolve(window.LauOSDesejosV88);

    if (!document.querySelector('link[data-lauos-v88-desejos]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/styles/lauos-desejos-v88.css';
      link.dataset.lauosV88Desejos = '1';
      document.head.appendChild(link);
    }

    if (desejosV88Promise) return desejosV88Promise;
    desejosV88Promise = new Promise((resolve) => {
      const existing = document.querySelector('script[data-lauos-v88-desejos]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.LauOSDesejosV88 || null), { once: true });
        setTimeout(() => resolve(window.LauOSDesejosV88 || null), 1200);
        return;
      }
      const script = document.createElement('script');
      script.src = '/scripts/lauos-desejos-v88.js';
      script.defer = true;
      script.dataset.lauosV88Desejos = '1';
      script.onload = () => resolve(window.LauOSDesejosV88 || null);
      script.onerror = () => resolve(null);
      document.body.appendChild(script);
      setTimeout(() => resolve(window.LauOSDesejosV88 || null), 1600);
    });
    return desejosV88Promise;
  }

  function showLauDesejosV88() {
    prepareBase('Lau');
    hideLauContent();
    const area = $('lauraArea');
    if (!area) return true;
    let host = $('lauosDesejosV88Host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'lauosDesejosV88Host';
      host.className = 'lauos-desejos-v88-host';
      area.appendChild(host);
    }
    display(host, true);
    if (window.LauOSDesejosV88) {
      window.LauOSDesejosV88.show(host);
      return true;
    }
    host.innerHTML = '<div class="lauos-desejos-v88-loading">Carregando desejos da Lau... 🌟</div>';
    ensureDesejosV88Assets().then((mod) => {
      if (mod && user() === 'Lau' && currentPage === 'desejos') mod.show(host);
    });
    return true;
  }

  function ensureNamoradoV86Assets() {
    if (window.LauOSNamoradoV86) return Promise.resolve(window.LauOSNamoradoV86);

    if (!document.querySelector('link[data-lauos-v86-namorado]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/styles/lauos-namorado-v86.css';
      link.dataset.lauosV86Namorado = '1';
      document.head.appendChild(link);
    }

    if (namoradoV86Promise) return namoradoV86Promise;
    namoradoV86Promise = new Promise((resolve) => {
      const existing = document.querySelector('script[data-lauos-v86-namorado]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.LauOSNamoradoV86 || null), { once: true });
        setTimeout(() => resolve(window.LauOSNamoradoV86 || null), 1200);
        return;
      }
      const script = document.createElement('script');
      script.src = '/scripts/lauos-namorado-v86.js';
      script.defer = true;
      script.dataset.lauosV86Namorado = '1';
      script.onload = () => resolve(window.LauOSNamoradoV86 || null);
      script.onerror = () => resolve(null);
      document.body.appendChild(script);
      setTimeout(() => resolve(window.LauOSNamoradoV86 || null), 1600);
    });
    return namoradoV86Promise;
  }

  function showNamoradoV86(page) {
    prepareBase('Namorado');
    if (window.LauOSNamoradoV86) {
      window.LauOSNamoradoV86.show(page);
      return true;
    }
    ensureNamoradoV86Assets().then((mod) => {
      if (mod && user() === 'Namorado' && currentPage === page) mod.show(page);
    });
    const area = $('namoradoArea');
    if (area) {
      hideBoyContent();
      let loading = $('namoradoV86Loading');
      if (!loading) {
        loading = document.createElement('div');
        loading.id = 'namoradoV86Loading';
        loading.className = 'namorado-v86-loading';
        loading.innerHTML = 'Carregando central azul... 💙';
        area.appendChild(loading);
      }
      display(loading, true);
    }
    return true;
  }

  function showLauNamoradoV86() {
    prepareBase('Lau');
    if (window.LauOSNamoradoV86) {
      window.LauOSNamoradoV86.showForLau();
      return true;
    }
    ensureNamoradoV86Assets().then((mod) => {
      if (mod && user() === 'Lau' && currentPage === 'namorado') mod.showForLau();
    });
    const area = $('lauraArea');
    if (area) {
      hideLauContent();
      let loading = $('namoradoV86ForLauLoading');
      if (!loading) {
        loading = document.createElement('div');
        loading.id = 'namoradoV86ForLauLoading';
        loading.className = 'namorado-v86-loading';
        loading.innerHTML = 'Carregando status e blog do namorado... 💙';
        area.appendChild(loading);
      }
      display(loading, true);
    }
    return true;
  }


  function user() {
    return localStorage.getItem('lauraos_usuario') || (document.body.classList.contains('namorado-mode') ? 'Namorado' : 'Lau');
  }

  function tabsFor(usuario = user()) {
    return usuario === 'Namorado' ? NAMORADO_TABS : LAU_TABS;
  }

  function normalizePage(page) {
    const p = String(page || '').trim();
    const map = {
      status: 'hoje',
      resumo: 'hoje',
      music: 'musicas',
      musica: 'musicas',
      músicas: 'musicas',
      musicas: 'musicas',
      series: 'series-filmes',
      serie: 'series-filmes',
      séries: 'series-filmes',
      filmes: 'series-filmes',
      filme: 'series-filmes',
      tvtime: 'series-filmes',
      'tv-time': 'series-filmes',
      watchtime: 'series-filmes',
      boyStatus: 'namorado',
      bau: 'fotos',
      memory: 'fotos',
      chat: 'hoje',
      cofrinho: 'desejos',
      wishCorner: 'desejos',
      viewWishes: 'desejos',
      diaryCorner: 'diario',
      calendarCorner: 'momentos',
      viewMoments: 'momentos',
      agendaCorner: 'agenda',
      viewAgenda: 'agenda',
      blogCorner: 'blog',
      viewBlog: 'blog',
      blogNamorado: 'blog-namorado',
      'blog-do-namorado': 'blog-namorado',
      'meu-blog': 'blog-namorado',
      meuBlog: 'blog-namorado',
      lettersCorner: 'cartas',
      viewLetters: 'cartas',
      plansCorner: 'planos',
      viewPlans: 'planos',
      musicCorner: 'musicas',
      viewMusic: 'musicas',
      cantinho: 'musicas',
      mais: 'musicas'
    };
    return map[p] || p || 'hoje';
  }

  function display(el, show, mode = 'block') {
    if (!el) return;
    el.style.setProperty('display', show ? mode : 'none', 'important');
    el.classList.toggle('hidden', !show);
  }

  function limparMenuMais(corner) {
    const menu = corner?.querySelector?.('.corner-menu');
    if (!menu) return;

    // A tela "Mais" agora fica só com extras reais.
    // O que já existe na lateral, ou foi removido do app, não aparece duplicado aqui.
    const remover = [
      'cofrinho', 'preciso', 'humor', 'frases', 'manual', 'baú', 'bau', 'missão', 'missao',
      'diário', 'diario', 'momentos', 'agenda', 'cartas', 'planos', 'desejos', 'fotos', 'blog', 'chat',
      'status', 'namorado'
    ];

    Array.from(menu.querySelectorAll('button')).forEach((btn) => {
      const txt = (btn.textContent || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const deveRemover = remover.some((palavra) => {
        const p = palavra.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return txt.includes(p);
      });
      if (deveRemover) btn.remove();
    });

    const restantes = Array.from(menu.querySelectorAll('button'));
    menu.classList.toggle('v80-mais-limpo', true);
    if (!restantes.length) {
      menu.innerHTML = '<div class="v80-mais-empty">Nada extra por enquanto ✨</div>';
    }
  }

  function removeOldNavs() {
    qsa('#desktopTabbar, #mobileTabbar').forEach((el) => el.remove());
  }

  function ensureNav() {
    removeOldNavs();
    let nav = $('lauosV77Nav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'lauosV77Nav';
      nav.className = 'lauos-v77-nav';
      nav.setAttribute('aria-label', 'Navegação LauOS');
      document.body.appendChild(nav);
    }

    const usuario = user();

    // v92: garantia dura — Meu Blog nunca aparece para a Lau/rosa.
    if (usuario === 'Lau') {
      qsa('#lauosV77Nav [data-v77-page="blog-namorado"]').forEach((btn) => btn.remove());
    }

    const signature = usuario + ':' + tabsFor(usuario).map((t) => t[0]).join('|');
    if (nav.dataset.signature !== signature) {
      nav.dataset.signature = signature;
      nav.innerHTML = `<div class="lauos-v77-nav-inner">${tabsFor(usuario).map(([page, icon, label]) => `
        <button type="button" class="lauos-v77-tab" data-v77-page="${page}" title="${label}">
          <span class="lauos-v77-tab-icon">${icon}</span>
          <span class="lauos-v77-tab-label">${label}</span>
        </button>`).join('')}</div>`;
      qsa('[data-v77-page]', nav).forEach((btn) => {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          go(btn.dataset.v77Page);
        });
      });
    }
    markActive(currentPage || defaultPage());
    return nav;
  }

  function markActive(page) {
    qsa('#lauosV77Nav [data-v77-page]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.v77Page === page);
    });
  }

  function defaultPage() {
    return 'hoje';
  }

  function sanitizePageForUser(page, usuario = user()) {
    const normalized = normalizePage(page);

    // v92: se alguma versão antiga deixou 'Meu Blog' salvo no perfil da Lau, joga para Hoje.
    if (usuario === 'Lau' && normalized === 'blog-namorado') return defaultPage();

    const allowed = new Set(tabsFor(usuario).map((tab) => tab[0]));
    if (allowed.has(normalized)) return normalized;

    // Segurança: se a Lau estava com "Meu Blog" salvo no localStorage
    // por causa da v89 errada, não deixa essa aba aparecer no lado dela.
    return defaultPage();
  }

  function clearPageClasses() {
    Array.from(document.body.classList).forEach((cls) => {
      if (cls.startsWith('lauos-v77-page-')) document.body.classList.remove(cls);
    });
  }

  function hideModuleRoots() {
    display($('lauosMediaV72'), false);
    display($('lauosMomentosV69'), false);
    display($('lauosWatchTimeV1'), false);
    document.body.classList.remove('lauos-v72-media-active', 'lauos-v66-media-active', 'lauos-planos-page-active', 'lauos-watchtime-active');
  }

  function hideCommonNoise() {
    qsa('.chat-card, .laura-chat-card').forEach((el) => display(el, false));
    display($('lauMobilePhotoViewer'), false);
    qsa('.namorado-memory-card').forEach((el) => display(el, false));
    display($('missPanel'), false);
  }

  function ensureExtraPanels() {
    // A v55 cria Cartas/Planos sob demanda. Se ainda não existem, chama o legado uma vez.
    try {
      if (!$('lettersCorner') && typeof legacy.abrirCantinho === 'function') legacy.abrirCantinho('lettersCorner');
      if (!$('plansCorner') && typeof legacy.abrirCantinho === 'function') legacy.abrirCantinho('plansCorner');
      if (!$('viewLetters') && typeof legacy.abrirCantinhoNamorado === 'function') legacy.abrirCantinhoNamorado('viewLetters');
      if (!$('viewPlans') && typeof legacy.abrirCantinhoNamorado === 'function') legacy.abrirCantinhoNamorado('viewPlans');
    } catch (err) {
      console.warn('[LauOS v77] Painéis extras:', err);
    }
  }

  function prepareBase(usuario = user()) {
    document.body.classList.add('lauos-v77-ready', 'lauos-v78-compact');
    document.body.classList.remove('lauos-status-active', 'lauos-show-boy-status');
    document.body.classList.toggle('laura-mode', usuario === 'Lau');
    document.body.classList.toggle('namorado-mode', usuario === 'Namorado');

    // v78: a tela de boas-vindas e os cards antigos não podem ficar por trás das abas.
    // Eles eram o principal motivo do corte/rolagem gigante após a limpeza da navegação.
    display($('introHero'), false);
    display($('cuteDashboard'), false);

    display($('lauraArea'), usuario === 'Lau');
    display($('namoradoArea'), usuario === 'Namorado');
    display($('countdownArea'), false);
    hideModuleRoots();
    hideCommonNoise();
    ensureExtraPanels();
  }

  function hideLauContent() {
    const area = $('lauraArea');
    if (!area) return;
    [
      area.querySelector('.role-header'),
      $('moodOptions'),
      area.querySelector('.levels-grid'),
      $('moodNote'),
      area.querySelector('.save-mood-btn'),
      $('lauCorner'),
      $('boyStatusLauView'),
      $('lauosDesejosV88Host')
    ].forEach((el) => display(el, false));
  }

  function showLauHoje() {
    const area = $('lauraArea');
    if (!area) return;
    hideLauContent();
    display(area.querySelector('.role-header'), true);
    display($('moodOptions'), true, 'grid');
    display(area.querySelector('.levels-grid'), true, 'grid');
    display($('moodNote'), true);
    display(area.querySelector('.save-mood-btn'), true);
  }

  function showLauPanel(panelId, showMenu = false) {
    if (panelId === 'lettersCorner') window.LauOSCartasLauV101?.ensurePanel?.();
    const area = $('lauraArea');
    const corner = $('lauCorner');
    if (!area || !corner) return;
    hideLauContent();
    display(corner, true);
    display(corner.querySelector('.corner-header'), showMenu);
    display(corner.querySelector('.corner-menu'), showMenu, 'grid');
    qsa('.corner-panel', corner).forEach((panel) => {
      const active = panelId ? panel.id === panelId : false;
      display(panel, active);
      panel.classList.toggle('show', active);
    });
    if (showMenu) {
      limparMenuMais(corner);
      qsa('.corner-panel', corner).forEach((panel) => { panel.classList.remove('show'); display(panel, false); });
    } else if (panelId === 'lettersCorner') {
      window.LauOSCartasLauV101?.render?.();
    } else if (panelId === 'plansCorner') {
      window.LauOSV55?.renderExtras?.();
    }
  }

  function showLauNamorado() {
    hideLauContent();
    document.body.classList.add('lauos-status-active', 'lauos-show-boy-status');
    const view = $('boyStatusLauView');
    if (view) {
      display(view, true);
      const content = $('boyStatusLauContent');
      if (content && !content.innerHTML.trim()) content.innerHTML = 'Nenhum status enviado ainda.';
    }
  }

  function hideBoyContent() {
    const area = $('namoradoArea');
    if (!area) return;
    Array.from(area.children).forEach((child) => display(child, false));
    display($('boyStatusNamoradoEditor'), false);
  }

  function ensureBoyHomeV84() {
    const area = $('namoradoArea');
    if (!area) return null;
    let home = $('boyHomeV84');
    if (!home) {
      home = document.createElement('section');
      home.id = 'boyHomeV84';
      home.className = 'v84-boy-home viewer-card';
      home.innerHTML = `
        <div class="v84-boy-home-head">
          <div>
            <h3>💙 Central do Namorado</h3>
            <p>Resumo rápido do que a Lau compartilhou.</p>
          </div>
          <button type="button" class="v84-mini-btn" data-v84-go="namorado">Enviar status</button>
        </div>
        <div class="v84-boy-home-grid">
          <article class="v84-boy-mini-card">
            <strong>💗 Status da Lau</strong>
            <div id="v84BoyMoodResumo">Carregando...</div>
            <button type="button" class="v84-link-btn" onclick="carregarHumorLau && carregarHumorLau(); setTimeout(() => window.LauOSV77?.go('hoje'), 120);">Atualizar</button>
          </article>
          <article class="v84-boy-mini-card">
            <strong>📌 Atalhos</strong>
            <div class="v84-boy-shortcuts">
              <button type="button" data-v84-go="agenda">Agenda</button>
              <button type="button" data-v84-go="cartas">Cartas</button>
              <button type="button" data-v84-go="blog">Blog</button>
              <button type="button" data-v84-go="fotos">Fotos</button>
            </div>
          </article>
        </div>`;
      area.insertAdjacentElement('afterbegin', home);
      qsa('[data-v84-go]', home).forEach((btn) => btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        go(btn.dataset.v84Go);
      }));
    }
    const mood = $('currentMood')?.textContent?.trim() || 'Nenhum status salvo ainda.';
    const note = $('moodNoteView')?.textContent?.trim();
    const box = $('v84BoyMoodResumo');
    if (box) box.innerHTML = `<span>${mood}</span>${note && !/Quando a Lau salvar/i.test(note) ? `<small>${note}</small>` : ''}`;
    return home;
  }

  function showBoyHoje() {
    const area = $('namoradoArea');
    if (!area) return;
    hideBoyContent();
    const notify = $('v55NotifyCard');
    if (notify && notify.parentElement === area) display(notify, true);
    const home = ensureBoyHomeV84();
    display(home, true);
    display($('boyStatusNamoradoEditor'), false);
  }


  const V84_AGENDA = { month: new Date(), selected: new Date().toISOString().slice(0, 10) };

  function v84Html(text) {
    return String(text || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function v84DataBR(dataISO) {
    try {
      if (typeof window.formatarDataBR === 'function') return window.formatarDataBR(dataISO);
      const [y, m, d] = String(dataISO || '').split('-');
      if (y && m && d) return `${d}/${m}/${y}`;
    } catch (e) {}
    return dataISO || '';
  }

  function v84AgendaList() {
    try { if (typeof window.lerAgendaLau === 'function') return window.lerAgendaLau() || []; } catch (e) {}
    try { if (typeof lerAgendaLau === 'function') return lerAgendaLau() || []; } catch (e) {}
    return [];
  }

  function v84Rotinas() {
    try { if (typeof window.lerRotinasLau === 'function') return window.lerRotinasLau() || {}; } catch (e) {}
    try { if (typeof lerRotinasLau === 'function') return lerRotinasLau() || {}; } catch (e) {}
    return {};
  }

  function v84RotinaArray(dataISO) {
    const valor = v84Rotinas()[dataISO];
    if (!valor) return [];
    return Array.isArray(valor) ? valor : [valor];
  }

  function v84Compromissos(dataISO) {
    return v84AgendaList()
      .filter((item) => item && item.data === dataISO)
      .sort((a, b) => String(a.hora || '99:99').localeCompare(String(b.hora || '99:99')));
  }

  function v84AgendaDetalhes(dataISO) {
    const compromissos = v84Compromissos(dataISO);
    const rotinas = v84RotinaArray(dataISO);
    const itens = [];
    if (compromissos.length) itens.push(`<h5>Compromissos</h5>${compromissos.map((item) => `<div class="v84-agenda-item"><strong>${v84Html(item.hora || 'Sem horário')}</strong><span>${v84Html(item.texto || item.titulo || '')}</span></div>`).join('')}`);
    if (rotinas.length) itens.push(`<h5>Rotina</h5>${rotinas.map((item, idx) => `<div class="v84-agenda-item"><strong>Parte ${idx + 1}</strong><span>${v84Html(item.texto || item.rotina || '').replaceAll('\n', '<br>')}</span></div>`).join('')}`);
    return `<div class="v84-agenda-details"><h4>Agenda do dia — ${v84Html(v84DataBR(dataISO))}</h4>${itens.join('') || '<div class="v84-agenda-empty">Nada salvo para esse dia ainda.</div>'}</div>`;
  }

  function v84AgendaCalendar() {
    const d = new Date(V84_AGENDA.month.getFullYear(), V84_AGENDA.month.getMonth(), 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const first = new Date(y, m, 1).getDay();
    const total = new Date(y, m + 1, 0).getDate();
    const hoje = new Date().toISOString().slice(0, 10);
    const datas = new Set([...v84AgendaList().map((i) => i.data), ...Object.keys(v84Rotinas())].filter(Boolean));
    let cells = '';
    for (let i = 0; i < first; i++) cells += '<button class="v84-agenda-day is-empty" type="button" disabled></button>';
    for (let dia = 1; dia <= total; dia++) {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const cls = ['v84-agenda-day'];
      if (iso === hoje) cls.push('is-today');
      if (iso === V84_AGENDA.selected) cls.push('is-selected');
      if (datas.has(iso)) cls.push('has-data');
      cells += `<button class="${cls.join(' ')}" type="button" onclick="window.selecionarDiaAgendaNamoradoV84('${iso}')">${dia}</button>`;
    }
    const mes = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return `<div class="v84-agenda-head"><button type="button" onclick="window.mudarMesAgendaNamoradoV84(-1)">‹</button><strong>${v84Html(mes)}</strong><button type="button" onclick="window.mudarMesAgendaNamoradoV84(1)">›</button></div><div class="v84-agenda-week"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div><div class="v84-agenda-grid">${cells}</div>`;
  }

  function renderAgendaNamoradoV84() {
    const viewAgenda = $('viewAgenda');
    if (!viewAgenda) return;
    viewAgenda.innerHTML = `<div class="v84-agenda-boy"><div class="v84-section-title"><span>🗓️</span><strong>Agenda da Lau</strong></div>${v84AgendaCalendar()}${v84AgendaDetalhes(V84_AGENDA.selected)}</div>`;
  }

  window.selecionarDiaAgendaNamoradoV84 = function (dataISO) {
    V84_AGENDA.selected = dataISO || V84_AGENDA.selected;
    const parts = String(V84_AGENDA.selected).split('-').map(Number);
    if (parts.length >= 2) V84_AGENDA.month = new Date(parts[0], parts[1] - 1, 1);
    renderAgendaNamoradoV84();
  };

  window.mudarMesAgendaNamoradoV84 = function (delta) {
    V84_AGENDA.month = new Date(V84_AGENDA.month.getFullYear(), V84_AGENDA.month.getMonth() + Number(delta || 0), 1);
    renderAgendaNamoradoV84();
  };

  function refreshBoyPanelV84(panelId) {
    try {
      if (panelId === 'viewAgenda') {
        renderAgendaNamoradoV84();
        if (typeof window.carregarAgendaSupabase === 'function') {
          window.carregarAgendaSupabase().then(renderAgendaNamoradoV84).catch(() => {});
        }
      }
      if (panelId === 'viewLetters') {
        if (window.LauOSV55?.loadExtras) window.LauOSV55.loadExtras().then(() => window.LauOSV55.renderExtras?.()).catch(() => window.LauOSV55.renderExtras?.());
        else window.LauOSV55?.renderExtras?.();
      }
      if (panelId === 'viewBlog') {
        if (window.LauOSV55?.loadBlogs) window.LauOSV55.loadBlogs().then(() => window.LauOSV55.renderBlogs?.()).catch(() => window.LauOSV55.renderBlogs?.());
        else if (typeof window.renderizarBlogNamorado === 'function') window.renderizarBlogNamorado();
      }
      if (panelId === 'viewMusic') {
        if (typeof window.sincronizarMusicasSemPiscar === 'function') window.sincronizarMusicasSemPiscar();
        if (typeof window.renderizarTodasMusicas === 'function') window.renderizarTodasMusicas(true);
        setTimeout(() => {
          if (typeof window.sincronizarMusicasSemPiscar === 'function') window.sincronizarMusicasSemPiscar();
          if (typeof window.renderizarTodasMusicas === 'function') window.renderizarTodasMusicas(false);
        }, 180);
      }
    } catch (err) { console.warn('[LauOS v84] painel namorado:', err); }
  }

  function showBoyPanel(panelId, showMenu = false) {
    const area = $('namoradoArea');
    const corner = document.querySelector('.namorado-corner-view');
    if (!area || !corner) return;
    hideBoyContent();
    display(corner, true);
    display(corner.querySelector('.corner-menu'), showMenu, 'grid');
    qsa('.corner-panel', corner).forEach((panel) => {
      const active = panelId ? panel.id === panelId : false;
      display(panel, active);
      panel.classList.toggle('show', active);
    });
    if (showMenu) {
      limparMenuMais(corner);
      qsa('.corner-panel', corner).forEach((panel) => { panel.classList.remove('show'); display(panel, false); });
    } else if (panelId) {
      refreshBoyPanelV84(panelId);
    }
  }

  function showBoyNamorado() {
    hideBoyContent();
    document.body.classList.add('lauos-status-active', 'lauos-show-boy-status');
    const editor = $('boyStatusNamoradoEditor');
    if (editor) display(editor, true);
  }

  function renderFotos() {
    prepareBase(user());
    display($('lauraArea'), false);
    display($('namoradoArea'), false);
    try {
      if (window.LauOSMediaV73?.renderFotos) window.LauOSMediaV73.renderFotos();
      else if (typeof window.renderizarGaleriaFotosLauV66 === 'function') window.renderizarGaleriaFotosLauV66();
    } catch (err) { console.warn('[LauOS v77] Fotos:', err); }
    setTimeout(() => display($('lauosMediaV72'), true), 30);
  }

  function renderMomentos() {
    prepareBase(user());
    display($('lauraArea'), false);
    display($('namoradoArea'), false);
    try {
      if (window.LauOSMomentosV67?.renderMomentos) window.LauOSMomentosV67.renderMomentos();
    } catch (err) { console.warn('[LauOS v77] Momentos:', err); }
    setTimeout(() => display($('lauosMomentosV69'), true), 30);
  }

  function renderPlanos(usuario = user()) {
    if (usuario === 'Namorado') showBoyPanel('viewPlans');
    else showLauPanel('plansCorner');
    try {
      if (typeof window.renderPlanosV74 === 'function') window.renderPlanosV74();
    } catch (err) { console.warn('[LauOS v77] Planos:', err); }
    document.body.classList.add('lauos-planos-page-active');
  }

  function showPage(page) {
    const usuario = user();
    prepareBase(usuario);

    if (page === 'fotos') return renderFotos();
    if (page === 'momentos') return renderMomentos();
    if (page === 'series-filmes') return showWatchTimeV1();

    if (usuario === 'Lau') {
      if (page === 'hoje') return showLauHoje();
      if (page === 'namorado') return showLauNamoradoV86();
      if (page === 'planos') return renderPlanos(usuario);
      if (page === 'desejos') return showLauDesejosV88();
      const panel = LAU_PANEL_BY_PAGE[page];
      if (page === 'mais') return showLauPanel(null, true);
      if (panel) return showLauPanel(panel);
      return showLauHoje();
    }

    // v86: lado do Namorado não usa mais os painéis antigos para páginas de conteúdo.
    if (['hoje', 'namorado', 'agenda', 'blog', 'blog-namorado', 'desejos', 'cartas', 'series-filmes', 'musicas'].includes(page)) return showNamoradoV86(page);
    if (page === 'planos') return renderPlanos(usuario);
    return showNamoradoV86('hoje');
  }

  function go(page, options = {}) {
    const normalized = sanitizePageForUser(page, user());
    currentPage = normalized;
    window.lauDesktopPageAtual = normalized;
    window.lauMobilePageAtual = normalized;
    localStorage.setItem('lauos_v77_page', normalized);
    clearPageClasses();
    document.body.classList.add('lauos-v77-page-' + normalized);
    ensureNav();
    markActive(normalized);
    showPage(normalized);
    if (!options.silent && typeof window.atualizarBadgeChat === 'function') {
      try { window.atualizarBadgeChat(); } catch {}
    }
  }

  function installOverrides() {
    legacy.abrirPaginaDesktop = window.abrirPaginaDesktop;
    legacy.abrirPaginaMobile = window.abrirPaginaMobile;
    legacy.abrirCantinho = window.abrirCantinho;
    legacy.abrirCantinhoNamorado = window.abrirCantinhoNamorado;
    legacy.aplicarPermissao = window.aplicarPermissao;
    legacy.renderizarCantinhoLau = window.renderizarCantinhoLau;
    legacy.renderizarCantinhoNamorado = window.renderizarCantinhoNamorado;

    window.abrirPaginaDesktop = function (page) { return go(page); };
    window.abrirPaginaMobile = function (page) { return go(page); };
    window.abrirCantinho = function (id) { return go(id); };
    window.abrirCantinhoNamorado = function (id) { return go(id); };

    window.aplicarPermissao = function (usuario) {
      const result = typeof legacy.aplicarPermissao === 'function'
        ? legacy.aplicarPermissao.apply(this, arguments)
        : undefined;
      setTimeout(() => boot(usuario || user()), 120);
      setTimeout(() => go(localStorage.getItem('lauos_v77_page') || defaultPage(), { silent: true }), 360);
      return result;
    };

    // v81: impede rotinas antigas de redesenharem abas novas/isoladas por cima.
    // Elas ainda podem atualizar Blog, Agenda, Desejos, Cartas e Músicas.
    const paginasProtegidasV81 = new Set(['planos', 'fotos', 'momentos', 'diario', 'hoje', 'namorado', 'agenda', 'blog', 'blog-namorado', 'desejos', 'cartas', 'series-filmes', 'musicas']);
    window.renderizarCantinhoLau = function () {
      const p = currentPage || localStorage.getItem('lauos_v77_page') || '';
      if (paginasProtegidasV81.has(normalizePage(p))) return undefined;
      return typeof legacy.renderizarCantinhoLau === 'function'
        ? legacy.renderizarCantinhoLau.apply(this, arguments)
        : undefined;
    };
    window.renderizarCantinhoNamorado = function () {
      const p = currentPage || localStorage.getItem('lauos_v77_page') || '';
      if (paginasProtegidasV81.has(normalizePage(p))) return undefined;
      return typeof legacy.renderizarCantinhoNamorado === 'function'
        ? legacy.renderizarCantinhoNamorado.apply(this, arguments)
        : undefined;
    };

    window.LauOSV77 = { go, boot, showPage, ensureNav };
  }

  function installObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      removeOldNavs();
      if (!localStorage.getItem('lauraos_usuario')) return;
      ensureNav();
      markActive(currentPage || defaultPage());
    });
    observer.observe(document.body, { childList: true, subtree: false });
  }

  function boot(usuario = user()) {
    if (!localStorage.getItem('lauraos_usuario') && usuario !== 'Lau' && usuario !== 'Namorado') return;
    lastUser = usuario;
    booted = true;
    document.body.classList.add('lauos-v77-ready');
    ensureNav();
    const saved = localStorage.getItem('lauos_v77_page') || defaultPage();
    go(normalizePage(saved), { silent: true });
  }

  function init() {
    installOverrides();
    installObserver();
    removeOldNavs();
    if (localStorage.getItem('lauraos_usuario')) {
      if (user() === 'Namorado') ensureNamoradoV86Assets();
      setTimeout(() => boot(user()), 200);
      setTimeout(() => go(localStorage.getItem('lauos_v77_page') || defaultPage(), { silent: true }), 900);
    }
    window.addEventListener('resize', () => {
      if (!localStorage.getItem('lauraos_usuario')) return;
      ensureNav();
      markActive(currentPage || defaultPage());
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();


/* LauOS v101 - Cartas da Lau isoladas e sem dependência do bloco antigo */
(function () {
  'use strict';
  const STORE_KEYS = ['lauos_v101_cartas', 'lauos_v55_cartas', 'lauos_v55_cartas_shared', 'lau_cartinhas', 'lauos_cartas', 'lauos_letters', 'lauraos_letters'];
  const state = { letters: [], loaded: false, loading: false };
  function $(id) { return document.getElementById(id); }
  function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])); }
  function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function nowISO() { return new Date().toISOString(); }
  function dateBR(value) { try { if (!value) return ''; const d = new Date(value); if (Number.isNaN(d.getTime())) return String(value); return d.toLocaleString('pt-BR'); } catch { return String(value || ''); } }
  function shortDateBR(value) { try { if (!value) return ''; const d = new Date(value); if (Number.isNaN(d.getTime())) return String(value); return d.toLocaleDateString('pt-BR'); } catch { return String(value || ''); } }
  function canOpen(value) { return !value || String(value).slice(0, 10) <= todayISO(); }
  function storageGet(key, fallback = []) { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } }
  function storageSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
  function user() { return (localStorage.getItem('lauraos_usuario') || 'Lau').toLowerCase().includes('namorado') ? 'Namorado' : 'Lau'; }
  function show(msg) { if (typeof window.showMessage === 'function') window.showMessage(msg); else alert(msg); }
  function sbClient() {
    try {
      if (window.sb) return window.sb;
      if (window.supabaseClient) return window.supabaseClient;
      if (window.lauosSupabase) return window.lauosSupabase;
      if (typeof sb !== 'undefined') return sb;
    } catch {}
    return null;
  }
  function timeout(ms, value) { return new Promise((resolve) => setTimeout(() => resolve(value), ms)); }
  function normalizeActor(value, fallback = 'Lau') {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return fallback;
    if (raw === 'namorado' || raw.includes('lipe') || raw.includes('filipe') || raw.includes('homem') || raw === 'eu') return 'Namorado';
    if (raw === 'lau' || raw.includes('laura') || raw.includes('namorada') || raw.includes('ela')) return 'Lau';
    return fallback;
  }
  function parsePossibleJsonText(item) {
    const texto = item?.texto ?? item?.text ?? item?.conteudo ?? item?.body;
    if (typeof texto !== 'string') return item || {};
    const trimmed = texto.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return item || {};
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') return { ...item, ...parsed, id: item.id || parsed.id, created_at: item.created_at || parsed.created_at };
    } catch {}
    return item || {};
  }
  function normalizeLetter(raw, index = 0) {
    raw = parsePossibleJsonText(raw);
    if (!raw || typeof raw !== 'object') return null;
    const autor = normalizeActor(raw.autor || raw.author || raw.remetente || raw.sender, 'Lau');
    const destino = normalizeActor(raw.destino || raw.to || raw.para || raw.receiver, autor === 'Lau' ? 'Namorado' : 'Lau');
    const text = raw.texto || raw.text || raw.conteudo || raw.body || '';
    const title = raw.titulo || raw.title || 'Cartinha';
    if (!text && !title) return null;
    return {
      ...raw,
      id: raw.id || `local-${autor}-${destino}-${index}-${raw.created_at || raw.criado_em || Date.now()}`,
      titulo: title,
      texto: text,
      autor,
      destino,
      abrir_em: String(raw.abrir_em || raw.open_at || raw.data_abertura || raw.data || todayISO()).slice(0, 10),
      created_at: raw.created_at || raw.criado_em || raw.data_criacao || nowISO()
    };
  }
  function extractLetters(value, out = [], depth = 0) {
    if (!value || depth > 5) return out;
    if (Array.isArray(value)) { value.forEach((v) => extractLetters(v, out, depth + 1)); return out; }
    if (typeof value === 'object') {
      const maybe = value.texto || value.text || value.conteudo || value.body || value.titulo || value.title;
      if (maybe) out.push(value);
      ['cartas', 'cartinhas', 'letters', 'items', 'data', 'rows', 'value', 'lista'].forEach((k) => value[k] && extractLetters(value[k], out, depth + 1));
    }
    return out;
  }
  function dedupe(...lists) {
    const map = new Map();
    lists.flat().map(normalizeLetter).filter(Boolean).forEach((l, i) => {
      const key = String(l.id || `${l.autor}|${l.destino}|${l.titulo}|${l.texto}|${l.created_at || i}`);
      if (!map.has(key)) map.set(key, l);
    });
    return Array.from(map.values()).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }
  function localLetters() {
    const out = [];
    STORE_KEYS.forEach((key) => extractLetters(storageGet(key, []), out));
    try {
      Object.keys(localStorage).forEach((key) => {
        if (!/carta|cartinha|letter/i.test(key) || STORE_KEYS.includes(key)) return;
        extractLetters(storageGet(key, []), out);
      });
    } catch {}
    return dedupe(out);
  }
  function saveLocal(letter) {
    const normalized = normalizeLetter(letter);
    if (!normalized) return;
    ['lauos_v101_cartas', 'lauos_v55_cartas', 'lauos_v55_cartas_shared'].forEach((key) => {
      const list = dedupe([normalized], storageGet(key, []));
      storageSet(key, list.slice(0, 200));
    });
  }
  function removeLocal(id) {
    STORE_KEYS.forEach((key) => {
      const list = extractLetters(storageGet(key, []), []).filter((l) => String(l.id || '') !== String(id));
      storageSet(key, list);
    });
  }
  async function remoteSelect() {
    const sbx = sbClient();
    if (!sbx) return [];
    const task = (async () => {
      const attempts = [
        () => sbx.from('lau_cartinhas').select('*').order('created_at', { ascending: false }).limit(200),
        () => sbx.from('lau_cartinhas').select('*').limit(200)
      ];
      for (const run of attempts) {
        try {
          const { data, error } = await run();
          if (error) throw error;
          if (Array.isArray(data)) return data;
        } catch (e) { console.warn('[Cartas v101] select falhou:', e); }
      }
      return [];
    })();
    return Promise.race([task, timeout(1800, [])]);
  }
  async function remoteInsert(payload) {
    const sbx = sbClient();
    if (!sbx) return null;
    const attempts = [
      payload,
      { texto: JSON.stringify(payload), autor: payload.autor, destino: payload.destino, abrir_em: payload.abrir_em, titulo: payload.titulo, created_at: payload.created_at },
      { texto: JSON.stringify(payload), created_at: payload.created_at },
      { texto: JSON.stringify(payload) }
    ];
    for (const body of attempts) {
      try {
        const { data, error } = await Promise.race([
          sbx.from('lau_cartinhas').insert(body).select('*').single(),
          timeout(2200, { data: null, error: new Error('timeout') })
        ]);
        if (error) throw error;
        return data || body;
      } catch (e) { console.warn('[Cartas v101] insert tentativa falhou:', e); }
    }
    return null;
  }
  async function remoteDelete(id) {
    const sbx = sbClient();
    if (!sbx || !id || String(id).startsWith('local-')) return;
    try { await Promise.race([sbx.from('lau_cartinhas').delete().eq('id', id), timeout(1800, null)]); }
    catch (e) { console.warn('[Cartas v101] delete remoto falhou:', e); }
  }
  async function refresh() {
    const local = localLetters();
    state.letters = dedupe(state.letters, local);
    render(false);
    const remote = await remoteSelect();
    state.letters = dedupe(remote, state.letters, localLetters());
    state.letters.slice(0, 200).forEach(saveLocal);
    state.loaded = true;
    render(false);
  }
  function ensureStyle() {
    if ($('lauosCartasLauV101Css')) return;
    const style = document.createElement('style');
    style.id = 'lauosCartasLauV101Css';
    style.textContent = `
      .v101-cartas{max-width:980px;margin:0 auto;padding:8px 0 18px;color:#5e2a48}.v101-cartas h3{color:#ff4fa3;margin:0 0 10px}.v101-card{background:rgba(255,255,255,.72);border:2px solid #ffc6df;border-radius:24px;padding:16px;margin:14px 0;box-shadow:0 16px 34px rgba(255,94,160,.08)}.v101-form{display:grid;gap:10px}.v101-row{display:grid;grid-template-columns:1fr 220px;gap:10px}.v101-card input,.v101-card select,.v101-card textarea{width:100%;border:2px solid #ffbddd;border-radius:16px;padding:12px 14px;background:#fff;font:inherit;color:#5e2a48;box-sizing:border-box}.v101-card textarea{min-height:92px;resize:vertical}.v101-actions{display:flex;gap:10px;flex-wrap:wrap}.v101-btn{border:0;border-radius:16px;padding:12px 18px;background:linear-gradient(135deg,#ff73b6,#ff4fa3);color:#fff;font-weight:900;cursor:pointer;box-shadow:0 12px 24px rgba(255,79,163,.18)}.v101-muted{padding:14px 16px;border:2px dashed #ffc6df;border-radius:18px;background:rgba(255,255,255,.5)}.v101-section-title{font-size:1.05rem;font-weight:900;color:#ff4fa3;margin:18px 0 10px}.v101-letter{position:relative;overflow:visible}.v101-delete{position:absolute;top:12px;right:12px;width:38px;height:38px;border-radius:999px;border:0;background:#fff;color:#ff4fa3;font-weight:900;cursor:pointer;box-shadow:0 8px 18px rgba(255,79,163,.16);z-index:3}.v101-meta{display:flex;gap:8px;flex-wrap:wrap;margin:0 48px 10px 0}.v101-pill{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;border:2px solid #ffc6df;background:#fff;color:#ff4fa3;font-weight:900;font-size:.86rem}.v101-letter h4{margin:0 0 6px;color:#ff4fa3;font-size:1.12rem}.v101-small{font-size:.86rem;font-weight:850;opacity:.72}.v101-envelope-btn{width:100%;margin-top:12px;border:1px solid rgba(255,202,224,.95);border-radius:26px;background:linear-gradient(180deg,#fff9fc,#fff0f7);padding:18px;cursor:pointer;display:grid;gap:8px;text-align:center;box-shadow:inset 0 1px 0 #fff,0 16px 32px rgba(255,79,163,.09)}.v101-envelope-btn:disabled{cursor:not-allowed;opacity:.78}.v101-stage{position:relative;width:min(360px,100%);height:190px;margin:0 auto;perspective:1200px}.v101-glow{position:absolute;inset:40px 30px 5px;border-radius:999px;background:radial-gradient(circle,rgba(255,150,205,.42),transparent 70%);filter:blur(12px)}.v101-back,.v101-front,.v101-flap,.v101-paper{position:absolute;left:50%;transform:translateX(-50%);width:min(330px,100%)}.v101-back{bottom:10px;height:126px;border-radius:0 0 24px 24px;background:linear-gradient(180deg,#fff,#ffe6f2);border:1px solid #ffd2e6;box-shadow:0 20px 35px rgba(255,105,180,.14)}.v101-paper{bottom:62px;width:min(286px,calc(100% - 44px));height:105px;border-radius:18px 18px 10px 10px;background:linear-gradient(180deg,#fffefb,#fff8fc);border:1px solid #f5d9e7;overflow:hidden;transition:bottom .58s cubic-bezier(.22,.8,.24,1),transform .58s cubic-bezier(.22,.8,.24,1)}.v101-paper:before{content:'';position:absolute;inset:0;opacity:.45;background-image:repeating-linear-gradient(180deg,rgba(255,160,205,.28) 0 1px,transparent 1px 16px),repeating-linear-gradient(90deg,rgba(255,225,238,.38) 0 1px,transparent 1px 24px)}.v101-front{bottom:10px;height:126px;border-radius:0 0 24px 24px;background:linear-gradient(180deg,#ffdce9,#ffc0dc);clip-path:polygon(0 0,50% 65%,100% 0,100% 100%,0 100%)}.v101-flap{top:22px;height:114px;background:linear-gradient(180deg,#fff2f7,#ffd0e5);clip-path:polygon(0 100%,50% 0,100% 100%);transform-origin:top center;transition:transform .68s cubic-bezier(.22,.8,.24,1);z-index:4}.v101-seal{position:absolute;left:50%;top:92px;transform:translateX(-50%);width:58px;height:58px;border-radius:999px;display:grid;place-items:center;background:radial-gradient(circle at 35% 35%,#ff91c3,#ff4ea1 68%);border:4px solid rgba(255,255,255,.9);box-shadow:0 10px 18px rgba(255,78,161,.3);z-index:5}.v101-letter.opening .v101-flap{transform:translateX(-50%) rotateX(180deg)}.v101-letter.opening .v101-paper{bottom:115px;transform:translateX(-50%) scale(1.03)}.v101-hint{font-weight:900;color:#bd4b82}.v101-preview{font-size:.86rem;line-height:1.45;color:#8d6579;max-width:420px;margin:0 auto}.v101-modal{position:fixed;inset:0;background:rgba(55,19,44,.35);backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;z-index:1600;padding:18px}.v101-modal.show{display:flex;animation:v101Fade .22s ease}.v101-dialog{width:min(760px,100%);max-height:calc(100vh - 36px);overflow:auto;border-radius:28px;padding:22px;position:relative;background:linear-gradient(180deg,#fff9fc,#fff0f7);box-shadow:0 30px 75px rgba(85,23,60,.25)}.v101-close{position:absolute;top:18px;right:18px;width:42px;height:42px;border:0;border-radius:14px;background:#fff;color:#ff4fa3;font-weight:900;cursor:pointer;box-shadow:0 10px 18px rgba(255,79,163,.15)}.v101-paper-full{border-radius:22px;padding:30px 26px 24px;background:linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,250,253,.98)),repeating-linear-gradient(180deg,rgba(255,173,210,.2) 0 1px,transparent 1px 32px),repeating-linear-gradient(90deg,rgba(255,223,237,.24) 0 1px,transparent 1px 26px);border:1px solid rgba(255,210,228,.95);box-shadow:inset 0 1px 0 #fff,0 16px 28px rgba(255,110,178,.10)}.v101-paper-head{display:flex;gap:14px;align-items:center;margin-bottom:18px}.v101-stamp{width:56px;height:56px;display:grid;place-items:center;border-radius:16px;background:linear-gradient(180deg,#ff8dbf,#ff5ca5);color:#fff;box-shadow:0 10px 18px rgba(255,92,165,.22);font-size:1.3rem}.v101-paper-head strong{display:block;font-size:1.25rem;color:#c83f87;margin-bottom:4px}.v101-paper-head small{font-weight:850;color:#8e6880}.v101-body{min-height:220px;line-height:2;font-size:1rem;color:#5e2a48;white-space:pre-wrap}.v101-sign{text-align:right;font-weight:900;color:#c24f88;margin-top:18px}@keyframes v101Fade{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:scale(1)}}@media(max-width:700px){.v101-row{grid-template-columns:1fr}.v101-dialog{padding:16px}.v101-paper-head{align-items:flex-start;flex-direction:column}}`;

    style.textContent += `
/* v104 - CARTAS LAU: envelope e folha refeitos de verdade */
.v101-card.v101-letter{border-radius:30px;border-color:rgba(255,184,216,.95);background:linear-gradient(180deg,rgba(255,255,255,.84),rgba(255,246,251,.78));box-shadow:0 18px 42px rgba(255,79,163,.10)}
.v101-envelope-btn{position:relative;overflow:hidden;border-radius:30px;padding:24px 22px 20px;background:radial-gradient(circle at 12% 12%,rgba(255,255,255,.95),transparent 24%),radial-gradient(circle at 88% 18%,rgba(255,255,255,.72),transparent 18%),linear-gradient(180deg,#fffdfd 0%,#fff7fb 46%,#ffedf6 100%);border:1px solid rgba(255,198,224,.96);box-shadow:inset 0 1px 0 rgba(255,255,255,.98),0 24px 44px rgba(214,95,151,.16);transition:transform .25s ease,box-shadow .25s ease}
.v101-envelope-btn:hover{transform:translateY(-2px);box-shadow:inset 0 1px 0 rgba(255,255,255,.98),0 28px 52px rgba(214,95,151,.19)}
.v101-envelope-btn:before,.v101-envelope-btn:after{position:absolute;pointer-events:none;color:rgba(255,115,180,.22);font-weight:900}.v101-envelope-btn:before{content:'✦';left:24px;top:22px}.v101-envelope-btn:after{content:'❤';right:24px;bottom:20px;transform:rotate(-14deg)}
.v101-stage{width:min(405px,100%);height:248px;padding-top:2px}.v101-stage:before,.v101-stage:after{content:'✧';position:absolute;top:20px;color:rgba(255,105,174,.45);font-size:1.05rem;animation:v101Spark 3.2s ease-in-out infinite}.v101-stage:before{left:26px}.v101-stage:after{right:26px;animation-delay:.9s}
.v101-glow{inset:26px 16px 2px;background:radial-gradient(circle,rgba(255,158,205,.42),transparent 72%);filter:blur(18px);opacity:1}
.v101-back,.v101-front,.v101-flap{width:min(382px,100%)}.v101-back{bottom:18px;height:152px;border-radius:0 0 36px 36px;background:linear-gradient(180deg,#fffefe 0%,#fff2f8 48%,#ffe5f0 100%);border:1px solid #ffd3e7;box-shadow:0 28px 48px rgba(255,105,180,.16),inset 0 1px 0 rgba(255,255,255,.95);overflow:hidden}.v101-back:before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.34),transparent 42%),repeating-linear-gradient(135deg,rgba(255,255,255,.15) 0 10px,rgba(255,255,255,0) 10px 20px);opacity:.78}.v101-back:after{content:'';position:absolute;left:22px;right:22px;top:16px;height:16px;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,0))}
.v101-paper{bottom:98px;width:min(318px,calc(100% - 46px));height:138px;border-radius:18px 18px 10px 10px;background:radial-gradient(circle at 16% 12%,rgba(255,214,228,.48),transparent 16%),linear-gradient(180deg,#fffefc 0%,#fffaf3 100%);border:1px solid rgba(232,215,198,.98);box-shadow:0 18px 30px rgba(92,52,63,.12);transition:bottom .72s cubic-bezier(.22,.86,.24,1),transform .72s cubic-bezier(.22,.86,.24,1),box-shadow .72s cubic-bezier(.22,.86,.24,1)}.v101-paper:before{content:'';position:absolute;inset:0;opacity:.95;background:linear-gradient(90deg,rgba(245,155,185,.32) 0 2px,transparent 2px 100%),repeating-linear-gradient(180deg,rgba(170,186,202,.24) 0 1px,transparent 1px 18px),linear-gradient(0deg,rgba(255,255,255,.22),rgba(255,255,255,.22));background-size:42px 100%,100% 18px,100% 100%;background-position:28px 0,0 16px,0 0}.v101-paper:after{content:'meu amor';position:absolute;left:50%;bottom:16px;transform:translateX(-50%);font-family:"Segoe Print","Bradley Hand",cursive;font-size:1rem;letter-spacing:.03em;color:rgba(185,88,131,.74);white-space:nowrap}
.v101-front{bottom:18px;height:152px;border-radius:0 0 36px 36px;background:linear-gradient(180deg,#ffdbe9 0%,#ffbdd7 100%);clip-path:polygon(0 0,50% 72%,100% 0,100% 100%,0 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.55)}.v101-front:before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.24),transparent 42%,rgba(255,255,255,.10) 70%,transparent 100%)}.v101-front:after{content:'';position:absolute;left:26px;right:26px;bottom:13px;height:15px;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.24),rgba(255,255,255,0))}
.v101-flap{top:18px;height:132px;background:linear-gradient(180deg,#fff9fc 0%,#ffd7e9 100%);clip-path:polygon(0 100%,50% 0,100% 100%);box-shadow:0 12px 22px rgba(255,149,196,.18);z-index:4}.v101-flap:before{content:'';position:absolute;left:46px;right:46px;top:20px;height:18px;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.45),rgba(255,255,255,0))}
.v101-seal{top:106px;width:70px;height:70px;border-radius:999px;background:radial-gradient(circle at 34% 28%,#ffb7d8,#ff5fa8 72%);border:5px solid rgba(255,255,255,.94);box-shadow:0 16px 28px rgba(255,95,168,.30),inset 0 3px 6px rgba(255,255,255,.42);font-size:1.2rem}.v101-seal:before{content:'';position:absolute;inset:9px;border-radius:999px;border:1px solid rgba(255,255,255,.38)}
.v101-letter.opening .v101-flap{transform:translateX(-50%) rotateX(176deg) translateY(-4px)}.v101-letter.opening .v101-paper{bottom:152px;transform:translateX(-50%) translateY(-10px) scale(1.05);box-shadow:0 22px 34px rgba(92,52,63,.13)}
.v101-hint{font-size:1rem;color:#bd4b82}.v101-preview{font-size:.9rem;line-height:1.5;color:#8d6579}
.v101-modal{backdrop-filter:blur(10px);background:rgba(55,19,44,.34)}.v101-dialog{width:min(980px,100%);border-radius:40px;padding:22px;background:radial-gradient(circle at top left,rgba(255,255,255,.92),transparent 26%),linear-gradient(180deg,rgba(255,248,252,.99),rgba(255,240,247,.99));box-shadow:0 38px 90px rgba(85,23,60,.24)}.v101-paper-full{position:relative;min-height:610px;border-radius:14px;padding:44px 46px 36px;background:linear-gradient(180deg,rgba(255,255,252,.98),rgba(255,249,242,.98));border:1px solid rgba(231,214,195,.95);box-shadow:inset 0 1px 0 rgba(255,255,255,.98),inset 0 0 0 1px rgba(255,255,255,.35),0 24px 50px rgba(146,108,126,.12);overflow:hidden}.v101-paper-full:before{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(90deg,rgba(244,147,176,.26) 0 2px,transparent 2px 100%),repeating-linear-gradient(180deg,rgba(159,178,196,.24) 0 1px,transparent 1px 34px),radial-gradient(circle at 14% 14%,rgba(255,255,255,.56),transparent 18%),radial-gradient(circle at 82% 86%,rgba(245,213,224,.18),transparent 20%);background-size:56px 100%,100% 34px,100% 100%,100% 100%;background-position:46px 0,0 106px,0 0,0 0;pointer-events:none}.v101-paper-full:after{content:'';position:absolute;right:0;top:0;width:64px;height:64px;background:linear-gradient(135deg,rgba(226,215,198,.16) 0%,rgba(236,227,214,.88) 55%,rgba(255,255,255,0) 56%);box-shadow:-8px 8px 14px rgba(0,0,0,.04)}.v101-paper-head,.v101-body,.v101-sign{position:relative;z-index:1}.v101-stamp{width:64px;height:64px;border-radius:20px;background:linear-gradient(180deg,#ff9ec8,#ff5ca5)}.v101-paper-head strong{font-size:1.7rem;color:#8c3c5f}.v101-body{min-height:340px;padding:18px 22px 28px 70px;font-family:"Segoe Print","Bradley Hand","Snell Roundhand","Lucida Handwriting",cursive;font-size:1.28rem;line-height:2.25;color:#5a3347;text-shadow:0 1px 0 rgba(255,255,255,.35);white-space:pre-wrap}.v101-body:before{content:'';position:absolute;left:44px;top:0;bottom:6px;width:2px;background:linear-gradient(180deg,rgba(244,123,168,0),rgba(244,123,168,.42) 10%,rgba(244,123,168,.42) 90%,rgba(244,123,168,0))}.v101-sign{font-family:"Segoe Print","Bradley Hand","Snell Roundhand","Lucida Handwriting",cursive;font-size:1.3rem;font-weight:700;color:#b34c7e;margin-top:28px}
@keyframes v101Spark{0%,100%{transform:translateY(0) scale(1);opacity:.55}50%{transform:translateY(-7px) scale(1.08);opacity:.95}}
@media(max-width:700px){.v101-stage{height:218px}.v101-back,.v101-front,.v101-flap{width:min(318px,100%)}.v101-paper{width:min(270px,calc(100% - 36px));height:124px}.v101-dialog{padding:14px;border-radius:28px}.v101-paper-full{min-height:470px;padding:28px 18px 24px}.v101-body{padding:16px 10px 16px 42px;font-size:1.08rem;line-height:2.05}.v101-body:before{left:22px}}
`;

    style.textContent += `
/* v105 - ajustes pontuais das cartas: flap correto, modal acima da folha */
.v101-flap{clip-path:polygon(0 0,100% 0,50% 100%)!important;top:18px!important;transform:translateX(-50%) rotateX(0deg)!important;transform-origin:top center!important;z-index:6!important;border-radius:18px 18px 4px 4px!important}
.v101-letter.opening .v101-flap{transform:translateX(-50%) rotateX(176deg) translateY(-4px)!important}
.v101-paper{bottom:84px!important;width:min(300px,calc(100% - 62px))!important;height:126px!important;z-index:2!important}
.v101-front{z-index:5!important}.v101-back{z-index:1!important}.v101-seal{z-index:8!important;top:112px!important}
.v101-stage{overflow:visible!important}.v101-envelope-btn{overflow:hidden!important}
.v101-dialog{padding:66px 22px 22px!important;overflow:auto!important;position:relative!important}
.v101-close{position:absolute!important;top:16px!important;right:18px!important;z-index:9999!important;width:46px!important;height:46px!important;border-radius:16px!important;background:#fff!important;color:#ff4fa3!important;box-shadow:0 12px 24px rgba(255,79,163,.22)!important}
#v101CartaModalBody{position:relative!important;z-index:1!important}.v101-paper-full{margin-top:0!important}
@media(max-width:700px){.v101-dialog{padding:62px 14px 14px!important}.v101-close{top:12px!important;right:12px!important}.v101-paper{width:min(258px,calc(100% - 54px))!important;height:116px!important;bottom:82px!important}.v101-seal{top:106px!important}}
`;
    
    style.textContent += `
/* v106 - envelope 100% fechado e sem corte visível */
.v101-envelope-btn{padding:22px 18px 18px!important}
.v101-stage{height:210px!important;overflow:visible!important}
.v101-back,.v101-front,.v101-flap{width:min(350px,100%)!important}
.v101-back,.v101-front{height:132px!important;bottom:14px!important}
.v101-front{clip-path:polygon(0 0,50% 62%,100% 0,100% 100%,0 100%)!important}
.v101-paper{bottom:30px!important;width:min(292px,calc(100% - 72px))!important;height:112px!important;border-radius:16px 16px 8px 8px!important;z-index:2!important;opacity:.98!important;box-shadow:0 8px 18px rgba(236,150,186,.12)!important}
.v101-flap{top:30px!important;height:102px!important;clip-path:polygon(0 0,100% 0,50% 100%)!important;transform:translateX(-50%) rotateX(0deg)!important;z-index:7!important;box-shadow:0 10px 18px rgba(255,148,194,.08)!important}
.v101-seal{top:116px!important;z-index:9!important}
.v101-letter.opening .v101-flap{transform:translateX(-50%) rotateX(180deg) translateY(-2px)!important}
.v101-letter.opening .v101-paper{bottom:118px!important;transform:translateX(-50%) scale(1.02)!important}
.v101-dialog{overflow:visible!important}
.v101-close{z-index:10000!important}
@media(max-width:700px){
  .v101-stage{height:196px!important}
  .v101-back,.v101-front,.v101-flap{width:min(300px,100%)!important}
  .v101-back,.v101-front{height:118px!important;bottom:14px!important}
  .v101-paper{width:min(246px,calc(100% - 56px))!important;height:98px!important;bottom:28px!important}
  .v101-flap{top:34px!important;height:88px!important}
  .v101-seal{top:106px!important}
  .v101-letter.opening .v101-paper{bottom:104px!important}
}`;

    document.head.appendChild(style);
  }
  function ensurePanel() {
    ensureStyle();
    const corner = $('lauCorner');
    if (!corner) return null;
    let panel = $('lettersCorner');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'lettersCorner';
      panel.className = 'corner-panel';
      corner.appendChild(panel);
    }
    return panel;
  }
  function splitLetters() {
    const u = user();
    const all = dedupe(state.letters, localLetters());
    return {
      mine: all.filter((l) => l.autor === u),
      received: all.filter((l) => l.autor !== u),
      all
    };
  }
  function letterCard(letter, mine) {
    const id = escapeHtml(letter.id);
    const open = canOpen(letter.abrir_em);
    const preview = escapeHtml(String(letter.texto || '').slice(0, 120));
    return `<article class="v101-card v101-letter ${open ? '' : 'locked'}" data-v101-letter="${id}">
      ${mine ? `<button class="v101-delete" type="button" data-v101-delete="${id}">×</button>` : ''}
      <div class="v101-meta"><span class="v101-pill">${letter.autor === 'Lau' ? '💗 Lau' : '💙 Namorado'}</span><span class="v101-pill">Para ${escapeHtml(letter.destino)}</span></div>
      <h4>${escapeHtml(letter.titulo || 'Cartinha')}</h4>
      <div class="v101-small">${letter.abrir_em ? 'abre em ' + escapeHtml(shortDateBR(letter.abrir_em)) : 'liberada'} · ${escapeHtml(dateBR(letter.created_at))}</div>
      <button class="v101-envelope-btn" type="button" data-v101-open="${id}" ${open ? '' : 'disabled'}>
        <div class="v101-stage"><div class="v101-glow"></div><div class="v101-back"></div><div class="v101-paper"></div><div class="v101-front"></div><div class="v101-flap"></div><div class="v101-seal">💗</div></div>
        <span class="v101-hint">${open ? 'Clique para abrir a carta' : 'Cartinha trancada até a data'}</span>
        ${preview ? `<span class="v101-preview">${preview}${String(letter.texto || '').length > 120 ? '…' : ''}</span>` : ''}
      </button>
      <template data-v101-template="${id}">${modalPaper(letter)}</template>
    </article>`;
  }
  function modalPaper(letter) {
    return `<div class="v101-paper-full"><div class="v101-paper-head"><span class="v101-stamp">💌</span><div><strong>${escapeHtml(letter.titulo || 'Cartinha')}</strong><small>Para ${escapeHtml(letter.destino)} · ${escapeHtml(dateBR(letter.created_at))}</small></div></div><div class="v101-body">${escapeHtml(letter.texto || '')}</div><div class="v101-sign">Com carinho, ${escapeHtml(letter.autor)} ✨</div></div>`;
  }
  function html() {
    const { mine, received, all } = splitLetters();
    const destino = user() === 'Lau' ? 'Namorado' : 'Lau';
    return `<div class="v101-cartas">
      <h3>💌 Cartinhas</h3>
      <div class="v101-card v101-form">
        <input id="v101CartaTitulo" placeholder="Título da cartinha" />
        <div class="v101-row"><select id="v101CartaDestino"><option value="Lau" ${destino === 'Lau' ? 'selected' : ''}>Para Lau</option><option value="Namorado" ${destino === 'Namorado' ? 'selected' : ''}>Para Namorado</option></select><input id="v101CartaData" type="date" /></div>
        <textarea id="v101CartaTexto" placeholder="Escreve a cartinha aqui..."></textarea>
        <div class="v101-actions"><button class="v101-btn" type="button" id="v101SalvarCarta">Guardar cartinha 💌</button>${state.loading ? '<span class="v101-pill">sincronizando...</span>' : ''}</div>
      </div>
      <div class="v101-section-title">🗂️ Suas cartinhas</div>
      ${mine.length ? mine.map((l) => letterCard(l, true)).join('') : '<div class="v101-muted">Você ainda não guardou cartinhas.</div>'}
      <div class="v101-section-title">📬 Cartinhas recebidas</div>
      ${received.length ? received.map((l) => letterCard(l, false)).join('') : '<div class="v101-muted">Nenhuma cartinha recebida ainda.</div>'}
      ${all.length ? `<div class="v101-small">${all.length} cartinha(s) no total.</div>` : ''}
    </div>`;
  }
  function bind(panel) {
    const save = $('v101SalvarCarta');
    if (save) save.onclick = saveLetter;
    qsa('[data-v101-delete]', panel).forEach((btn) => btn.onclick = () => deleteLetter(btn.dataset.v101Delete));
    qsa('[data-v101-open]', panel).forEach((btn) => btn.onclick = () => openLetter(btn.dataset.v101Open));
  }
  function render(doRefresh = true) {
    const panel = ensurePanel();
    if (!panel) return;
    panel.innerHTML = html();
    bind(panel);
    if (doRefresh && !state.loading) {
      state.loading = true;
      refresh().catch((e) => console.warn('[Cartas v101] refresh falhou:', e)).finally(() => { state.loading = false; const p = $('lettersCorner'); if (p) { p.innerHTML = html(); bind(p); } });
    }
  }
  async function saveLetter() {
    const titulo = ($('v101CartaTitulo')?.value || '').trim() || 'Cartinha';
    const texto = ($('v101CartaTexto')?.value || '').trim();
    if (!texto) return show('Escreve a cartinha primeiro 💌');
    const payload = { id: 'local-' + Date.now() + '-' + Math.random().toString(16).slice(2), titulo, texto, autor: user(), destino: $('v101CartaDestino')?.value || (user() === 'Lau' ? 'Namorado' : 'Lau'), abrir_em: $('v101CartaData')?.value || todayISO(), created_at: nowISO() };
    state.letters = dedupe([payload], state.letters);
    saveLocal(payload);
    render(false);
    const remote = await remoteInsert(payload);
    if (remote) {
      const saved = normalizeLetter(remote) || payload;
      state.letters = dedupe([saved], state.letters);
      saveLocal(saved);
      render(false);
    }
    show('Cartinha guardada 💌');
  }
  async function deleteLetter(id) {
    if (!confirm('Excluir essa cartinha?')) return;
    state.letters = state.letters.filter((l) => String(l.id) !== String(id));
    removeLocal(id);
    render(false);
    await remoteDelete(id);
  }
  function ensureModal() {
    let modal = $('v101CartaModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'v101CartaModal';
    modal.className = 'v101-modal';
    modal.innerHTML = '<div class="v101-dialog"><button class="v101-close" id="v101FecharCarta" type="button">×</button><div id="v101CartaModalBody"></div></div>';
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    document.body.appendChild(modal);
    $('v101FecharCarta').onclick = closeModal;
    return modal;
  }
  function openLetter(id) {
    const card = document.querySelector(`[data-v101-letter="${CSS.escape(String(id))}"]`);
    if (!card) return;
    const letter = state.letters.find((l) => String(l.id) === String(id)) || localLetters().find((l) => String(l.id) === String(id));
    if (!letter || !canOpen(letter.abrir_em)) return show('Essa cartinha ainda está fechadinha 🔒');
    card.classList.add('opening');
    setTimeout(() => {
      card.classList.remove('opening');
      const modal = ensureModal();
      const body = $('v101CartaModalBody');
      if (body) body.innerHTML = modalPaper(letter);
      modal.classList.add('show');
      document.body.style.overflow = 'hidden';
    }, 620);
  }
  function closeModal() { const modal = $('v101CartaModal'); if (modal) modal.classList.remove('show'); document.body.style.overflow = ''; }

  // v110: envelope da Lau fechado de verdade.
  // O estado normal não mostra folha nem aba levantada; a aba fica por cima do envelope.
  function injectCartaLauV107EnvelopeFix() {
    if ($('lauosCartasLauV107EnvelopeCss')) return;
    const style = document.createElement('style');
    style.id = 'lauosCartasLauV107EnvelopeCss';
    style.textContent = `
#lettersCorner .v101-envelope-btn{padding:22px 18px 18px!important;overflow:hidden!important}
#lettersCorner .v101-stage{height:205px!important;overflow:hidden!important}
#lettersCorner .v101-back,
#lettersCorner .v101-front,
#lettersCorner .v101-flap{width:min(350px,100%)!important;left:50%!important}
#lettersCorner .v101-back,
#lettersCorner .v101-front{height:132px!important;bottom:14px!important}
#lettersCorner .v101-back{z-index:1!important;background:linear-gradient(180deg,#ffd9e8 0%,#ffc6de 100%)!important;border-color:#ffc3dd!important;box-shadow:0 18px 30px rgba(255,120,181,.14)!important}
#lettersCorner .v101-back:before,
#lettersCorner .v101-back:after{display:none!important;content:none!important}
#lettersCorner .v101-front{z-index:5!important;background:linear-gradient(180deg,#ffc8df 0%,#ffb1d2 100%)!important;clip-path:polygon(0 0,50% 63%,100% 0,100% 100%,0 100%)!important;border-radius:0 0 32px 32px!important}
#lettersCorner .v101-letter:not(.opening) .v101-flap{top:59px!important;height:80px!important;z-index:8!important;clip-path:polygon(0 0,100% 0,50% 100%)!important;transform:translateX(-50%) rotateX(0deg)!important;transform-origin:top center!important;border-radius:0 0 8px 8px!important;background:linear-gradient(180deg,#ffe4ef 0%,#ffc3dc 100%)!important;box-shadow:none!important;filter:none!important}
#lettersCorner .v101-letter:not(.opening) .v101-paper{display:none!important;visibility:hidden!important;opacity:0!important;width:0!important;height:0!important;bottom:0!important;transform:translateX(-50%) scale(.9)!important;pointer-events:none!important}
#lettersCorner .v101-letter:not(.opening) .v101-stage{overflow:hidden!important}
#lettersCorner .v101-letter:not(.opening) .v101-seal{top:116px!important;z-index:10!important}
#lettersCorner .v101-letter.opening .v101-flap{top:26px!important;height:108px!important;z-index:8!important;clip-path:polygon(0 0,100% 0,50% 100%)!important;transform:translateX(-50%) rotateX(180deg) translateY(-2px)!important;transform-origin:top center!important;background:linear-gradient(180deg,#ffe6f1 0%,#ffcde2 100%)!important}
#lettersCorner .v101-letter.opening .v101-paper{display:block!important;visibility:visible!important;opacity:1!important;width:min(292px,calc(100% - 72px))!important;height:112px!important;bottom:116px!important;transform:translateX(-50%) scale(1.02)!important;z-index:3!important}
#lettersCorner .v101-letter.opening .v101-seal{top:116px!important;z-index:10!important}
@media(max-width:700px){
  #lettersCorner .v101-stage{height:192px!important}
  #lettersCorner .v101-back,
  #lettersCorner .v101-front,
  #lettersCorner .v101-flap{width:min(300px,100%)!important}
  #lettersCorner .v101-back,
  #lettersCorner .v101-front{height:118px!important;bottom:14px!important}
  #lettersCorner .v101-letter:not(.opening) .v101-flap{top:60px!important;height:68px!important}
  #lettersCorner .v101-letter:not(.opening) .v101-seal{top:106px!important}
  #lettersCorner .v101-letter.opening .v101-flap{top:30px!important;height:92px!important}
  #lettersCorner .v101-letter.opening .v101-paper{width:min(246px,calc(100% - 56px))!important;height:98px!important;bottom:104px!important}
  #lettersCorner .v101-letter.opening .v101-seal{top:106px!important}
}
`;
    document.head.appendChild(style);
  }
  injectCartaLauV107EnvelopeFix();

  // v111: envelope do Namorado fechado bonitinho, igual a lógica corrigida da Lau.
  function injectCartaNamoradoV111EnvelopeFix() {
    if ($('lauosCartasNamoradoV111EnvelopeCss')) return;
    const style = document.createElement('style');
    style.id = 'lauosCartasNamoradoV111EnvelopeCss';
    style.textContent = `
#viewLetters .v101-envelope-btn{padding:22px 18px 18px!important;overflow:hidden!important}
#viewLetters .v101-stage{height:205px!important;overflow:hidden!important}
#viewLetters .v101-back,
#viewLetters .v101-front,
#viewLetters .v101-flap{width:min(350px,100%)!important;left:50%!important}
#viewLetters .v101-back,
#viewLetters .v101-front{height:132px!important;bottom:14px!important}
#viewLetters .v101-back{z-index:1!important;background:linear-gradient(180deg,#dcefff 0%,#bddfff 100%)!important;border-color:#b9d7fb!important;box-shadow:0 18px 30px rgba(84,145,224,.16)!important}
#viewLetters .v101-back:before,
#viewLetters .v101-back:after{display:none!important;content:none!important}
#viewLetters .v101-front{z-index:5!important;background:linear-gradient(180deg,#cde6ff 0%,#9fcfff 100%)!important;clip-path:polygon(0 0,50% 63%,100% 0,100% 100%,0 100%)!important;border-radius:0 0 32px 32px!important}
#viewLetters .v101-letter:not(.opening) .v101-flap{top:59px!important;height:80px!important;z-index:8!important;clip-path:polygon(0 0,100% 0,50% 100%)!important;transform:translateX(-50%) rotateX(0deg)!important;transform-origin:top center!important;border-radius:0 0 8px 8px!important;background:linear-gradient(180deg,#edf6ff 0%,#badbff 100%)!important;box-shadow:none!important;filter:none!important}
#viewLetters .v101-letter:not(.opening) .v101-paper{display:none!important;visibility:hidden!important;opacity:0!important;width:0!important;height:0!important;bottom:0!important;transform:translateX(-50%) scale(.9)!important;pointer-events:none!important}
#viewLetters .v101-letter:not(.opening) .v101-stage{overflow:hidden!important}
#viewLetters .v101-letter:not(.opening) .v101-seal{top:116px!important;z-index:10!important;background:radial-gradient(circle at 34% 28%,#9ac7ff,#4f98ff 72%)!important;box-shadow:0 16px 28px rgba(79,152,255,.28)!important}
#viewLetters .v101-letter.opening .v101-flap{top:26px!important;height:108px!important;z-index:8!important;clip-path:polygon(0 0,100% 0,50% 100%)!important;transform:translateX(-50%) rotateX(180deg) translateY(-2px)!important;transform-origin:top center!important;background:linear-gradient(180deg,#f2f8ff 0%,#cce4ff 100%)!important}
#viewLetters .v101-letter.opening .v101-paper{display:block!important;visibility:visible!important;opacity:1!important;width:min(292px,calc(100% - 72px))!important;height:112px!important;bottom:116px!important;transform:translateX(-50%) scale(1.02)!important;z-index:3!important}
#viewLetters .v101-letter.opening .v101-seal{top:116px!important;z-index:10!important;background:radial-gradient(circle at 34% 28%,#9ac7ff,#4f98ff 72%)!important;box-shadow:0 16px 28px rgba(79,152,255,.28)!important}
@media(max-width:700px){
  #viewLetters .v101-stage{height:192px!important}
  #viewLetters .v101-back,
  #viewLetters .v101-front,
  #viewLetters .v101-flap{width:min(300px,100%)!important}
  #viewLetters .v101-back,
  #viewLetters .v101-front{height:118px!important;bottom:14px!important}
  #viewLetters .v101-letter:not(.opening) .v101-flap{top:60px!important;height:68px!important}
  #viewLetters .v101-letter:not(.opening) .v101-seal{top:106px!important}
  #viewLetters .v101-letter.opening .v101-flap{top:30px!important;height:92px!important}
  #viewLetters .v101-letter.opening .v101-paper{width:min(246px,calc(100% - 56px))!important;height:98px!important;bottom:104px!important}
  #viewLetters .v101-letter.opening .v101-seal{top:106px!important}
}
`;
    document.head.appendChild(style);
  }
  injectCartaNamoradoV111EnvelopeFix();




  // v112: polimento final do envelope do Namorado.
  // Garante estado fechado sem folha aparecendo e envelope centralizado no retângulo azul.
  function injectCartaNamoradoV112EnvelopePolish() {
    if ($('lauosCartasNamoradoV112EnvelopeCss')) return;
    const style = document.createElement('style');
    style.id = 'lauosCartasNamoradoV112EnvelopeCss';
    style.textContent = `
body.namorado-mode #viewLetters .v101-envelope-btn,
body.namorado-mode #lettersCorner .v101-envelope-btn{
  padding:20px 18px 18px!important;
  overflow:hidden!important;
}
body.namorado-mode #viewLetters .v101-stage,
body.namorado-mode #lettersCorner .v101-stage{
  position:relative!important;
  width:min(360px,100%)!important;
  height:190px!important;
  margin:0 auto!important;
  overflow:hidden!important;
}
body.namorado-mode #viewLetters .v101-back,
body.namorado-mode #viewLetters .v101-front,
body.namorado-mode #viewLetters .v101-flap,
body.namorado-mode #viewLetters .v101-paper,
body.namorado-mode #lettersCorner .v101-back,
body.namorado-mode #lettersCorner .v101-front,
body.namorado-mode #lettersCorner .v101-flap,
body.namorado-mode #lettersCorner .v101-paper{
  left:50%!important;
  transform:translateX(-50%)!important;
}
body.namorado-mode #viewLetters .v101-back,
body.namorado-mode #viewLetters .v101-front,
body.namorado-mode #lettersCorner .v101-back,
body.namorado-mode #lettersCorner .v101-front{
  width:min(330px,100%)!important;
  height:126px!important;
  bottom:12px!important;
}
body.namorado-mode #viewLetters .v101-letter:not(.opening) .v101-back,
body.namorado-mode #lettersCorner .v101-letter:not(.opening) .v101-back{
  z-index:1!important;
}
body.namorado-mode #viewLetters .v101-letter:not(.opening) .v101-front,
body.namorado-mode #lettersCorner .v101-letter:not(.opening) .v101-front{
  z-index:5!important;
}
body.namorado-mode #viewLetters .v101-letter:not(.opening) .v101-flap,
body.namorado-mode #lettersCorner .v101-letter:not(.opening) .v101-flap{
  width:min(330px,100%)!important;
  top:52px!important;
  height:86px!important;
  z-index:8!important;
  clip-path:polygon(0 0,100% 0,50% 100%)!important;
  transform:translateX(-50%) rotateX(0deg)!important;
  transform-origin:top center!important;
}
body.namorado-mode #viewLetters .v101-letter:not(.opening) .v101-paper,
body.namorado-mode #lettersCorner .v101-letter:not(.opening) .v101-paper{
  display:none!important;
  visibility:hidden!important;
  opacity:0!important;
  width:0!important;
  height:0!important;
  bottom:0!important;
  transform:translateX(-50%) scale(.01)!important;
  pointer-events:none!important;
}
body.namorado-mode #viewLetters .v101-letter:not(.opening) .v101-seal,
body.namorado-mode #lettersCorner .v101-letter:not(.opening) .v101-seal{
  top:110px!important;
  z-index:10!important;
}
@media(max-width:700px){
  body.namorado-mode #viewLetters .v101-stage,
  body.namorado-mode #lettersCorner .v101-stage{width:min(300px,100%)!important;height:176px!important}
  body.namorado-mode #viewLetters .v101-back,
  body.namorado-mode #viewLetters .v101-front,
  body.namorado-mode #lettersCorner .v101-back,
  body.namorado-mode #lettersCorner .v101-front{width:min(282px,100%)!important;height:112px!important;bottom:12px!important}
  body.namorado-mode #viewLetters .v101-letter:not(.opening) .v101-flap,
  body.namorado-mode #lettersCorner .v101-letter:not(.opening) .v101-flap{width:min(282px,100%)!important;top:52px!important;height:72px!important}
  body.namorado-mode #viewLetters .v101-letter:not(.opening) .v101-seal,
  body.namorado-mode #lettersCorner .v101-letter:not(.opening) .v101-seal{top:100px!important}
}
`;
    document.head.appendChild(style);
  }
  injectCartaNamoradoV112EnvelopePolish();


  window.LauOSCartasLauV101 = { ensurePanel, render, refresh, localLetters };
})();
