/* LauOS Base v52
   Ajustes leves de estabilidade/performance sem alterar o visual principal. */
(function () {
  if (window.__lauosV52BaseLoaded) return;
  window.__lauosV52BaseLoaded = true;

  const isMobile = () => window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
  const isDebug = () => localStorage.getItem('lauos_debug') === '1';
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function consoleInfo(...args) {
    if (isDebug()) console.info('[LauOS v52]', ...args);
  }

  function showDevToast(message) {
    if (!isDebug()) return;
    try {
      const oldToast = document.getElementById('lauosDevToast');
      if (oldToast) oldToast.remove();
      const toast = document.createElement('div');
      toast.id = 'lauosDevToast';
      toast.textContent = message;
      toast.style.cssText = 'position:fixed;left:14px;right:14px;bottom:14px;z-index:99999;background:#5a2a45;color:#fff;padding:12px 14px;border-radius:16px;font:700 13px system-ui;box-shadow:0 12px 30px rgba(0,0,0,.22);';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4500);
    } catch (e) {}
  }

  window.addEventListener('error', (event) => {
    console.error('[LauOS erro]', event.error || event.message);
    showDevToast('Erro no LauOS: ' + (event.message || 'veja o console'));
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[LauOS promise]', event.reason);
    showDevToast('Falha assíncrona no LauOS. Veja o console.');
  });

  function wrapAsyncOnce(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__lauosWrappedOnce) return;
    let running = false;
    let lastPromise = null;

    async function wrapped(...args) {
      if (running) {
        consoleInfo(name + ' ignorado: chamada anterior ainda rodando.');
        return lastPromise;
      }
      running = true;
      lastPromise = Promise.resolve()
        .then(() => original.apply(this, args))
        .finally(() => {
          running = false;
          lastPromise = null;
        });
      return lastPromise;
    }

    wrapped.__lauosWrappedOnce = true;
    wrapped.__lauosOriginal = original;
    window[name] = wrapped;
    try { eval(name + ' = window[name]'); } catch (e) {}
  }

  function protegerLoginContraCliqueDuplo() {
    const original = window.entrarPeloCartao;
    if (typeof original !== 'function' || original.__lauosLoginProtected) return;
    let entrando = false;

    async function entrarProtegido(tipo) {
      if (entrando) return;
      entrando = true;
      const botoes = document.querySelectorAll('.login-card button');
      botoes.forEach((btn) => { btn.disabled = true; btn.style.opacity = '0.72'; });
      try {
        return await original.call(this, tipo);
      } finally {
        await sleep(350);
        entrando = false;
        botoes.forEach((btn) => { btn.disabled = false; btn.style.opacity = ''; });
      }
    }

    entrarProtegido.__lauosLoginProtected = true;
    entrarProtegido.__lauosOriginal = original;
    window.entrarPeloCartao = entrarPeloCartao = entrarProtegido;
  }

  function melhorarCamposLogin() {
    const lau = document.getElementById('loginPasswordLau');
    const namorado = document.getElementById('loginPasswordNamorado');
    [lau, namorado].forEach((input) => {
      if (!input) return;
      input.setAttribute('autocomplete', 'current-password');
      input.setAttribute('autocapitalize', 'none');
      input.setAttribute('spellcheck', 'false');
    });
  }

  function protegerBotoesSalvar() {
    document.addEventListener('click', (event) => {
      const btn = event.target && event.target.closest ? event.target.closest('button') : null;
      if (!btn || btn.disabled) return;
      const onclick = btn.getAttribute('onclick') || '';
      const texto = (btn.textContent || '').toLowerCase();
      const pareceSalvar = /salvar|enviar|publicar|adicionar|upload/i.test(onclick + ' ' + texto);
      if (!pareceSalvar) return;
      btn.dataset.lauosBusy = '1';
      setTimeout(() => { delete btn.dataset.lauosBusy; }, 1200);
    }, true);
  }

  function iniciarModoLeveVisual() {
    if (!window.LauOSGuard) return;
    const preferenciaLeve = localStorage.getItem('lauos_modo_leve') === '1';
    const deveAtivar = preferenciaLeve || isMobile();
    if (!deveAtivar || window.__lauosLightVisualsStarted) return;

    window.__lauosLightVisualsStarted = true;

    setTimeout(() => {
      const removidos = window.LauOSGuard.clearVisualIntervals();
      consoleInfo('intervalos visuais originais removidos:', removidos);

      setInterval(() => {
        if (!document.hidden && typeof window.createFloatingHeart === 'function') window.createFloatingHeart();
      }, 1900);

      setInterval(() => {
        if (!document.hidden && typeof window.createSparkle === 'function') window.createSparkle();
      }, 3400);
    }, 3600);
  }

  function pausarVisualQuandoOculto() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden || !window.LauOSGuard) return;
      window.LauOSGuard.clearVisualIntervals();
    });
  }

  function instalarPainelDev() {
    window.LauOS = window.LauOS || {};
    window.LauOS.status = function () {
      return {
        usuario: localStorage.getItem('lauraos_usuario') || null,
        mobile: isMobile(),
        debug: isDebug(),
        modoLeve: localStorage.getItem('lauos_modo_leve') === '1',
        intervals: window.LauOSGuard ? window.LauOSGuard.intervals() : [],
        timeouts: window.LauOSGuard ? window.LauOSGuard.timeouts() : []
      };
    };
    window.LauOS.ativarDebug = function () { localStorage.setItem('lauos_debug', '1'); location.reload(); };
    window.LauOS.desativarDebug = function () { localStorage.removeItem('lauos_debug'); location.reload(); };
    window.LauOS.ativarModoLeve = function () { localStorage.setItem('lauos_modo_leve', '1'); location.reload(); };
    window.LauOS.desativarModoLeve = function () { localStorage.removeItem('lauos_modo_leve'); location.reload(); };
    window.LauOS.limparSessaoLocal = function () {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('lauraos_') || key.startsWith('lauos_')) localStorage.removeItem(key);
      });
      location.reload();
    };
  }

  function aplicarBaseV52() {
    melhorarCamposLogin();
    protegerLoginContraCliqueDuplo();
    protegerBotoesSalvar();
    wrapAsyncOnce('carregarTudoSupabase');
    wrapAsyncOnce('sincronizarLauOS');
    wrapAsyncOnce('carregarAgendaSupabase');
    wrapAsyncOnce('carregarFotosSupabase');
    iniciarModoLeveVisual();
    pausarVisualQuandoOculto();
    instalarPainelDev();
    consoleInfo('base instalada', window.LauOS.status());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicarBaseV52);
  } else {
    aplicarBaseV52();
  }
})();
