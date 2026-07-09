/* LauOS v60 - Diário menor, com humor/emoji, data/hora clara e sem modal fantasma */
(function () {
  'use strict';

  const RECADO_RECOMECO = 'Lau, eu sinto muito pelo diário antigo. Cuidei pra esse cantinho ficar protegido daqui pra frente. Agora é um recomeço só seu. 💗';
  const EMOJIS = ['💗', '🥹', '🌸', '✨', '🫶', '😌', '🥰', '🌙'];
  let emojiSelecionado = localStorage.getItem('lauos_diario_emoji_atual') || '💗';
  let abrindoHistoricoPorClique = false;

  function $(id) { return document.getElementById(id); }

  function fecharModalDiarioSeNaoForClique() {
    if (abrindoHistoricoPorClique) return;
    const modal = $('diaryHistoryModal');
    if (modal) modal.classList.remove('show');
  }

  function limparTecnicoDaTela() {
    document.querySelectorAll('#v58DiaryRestartNote, #v57DiarySafePanel, .v57-diary-empty-restart, .v56-diary-warning, .v57-diary-danger-note').forEach((el) => el.remove());
  }

  function garantirBarraDeHumor() {
    const campo = $('diaryText');
    const corner = $('diaryCorner');
    if (!campo || !corner || $('v60DiaryMood')) return;

    const barra = document.createElement('div');
    barra.id = 'v60DiaryMood';
    barra.className = 'v60-diary-mood';
    barra.innerHTML = `
      <span class="v60-mood-label">humor da página</span>
      <div class="v60-mood-buttons">
        ${EMOJIS.map((emoji) => `<button type="button" class="${emoji === emojiSelecionado ? 'active' : ''}" data-v60-diary-emoji="${emoji}" aria-label="Humor ${emoji}">${emoji}</button>`).join('')}
      </div>
    `;

    campo.parentNode.insertBefore(barra, campo);

    barra.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-v60-diary-emoji]');
      if (!btn) return;
      emojiSelecionado = btn.dataset.v60DiaryEmoji || '💗';
      localStorage.setItem('lauos_diario_emoji_atual', emojiSelecionado);
      barra.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === btn));
    });
  }

  function polirDiarioRenderizado() {
    const corner = $('diaryCorner');
    if (!corner) return;
    corner.classList.add('v60-diary-polido');

    const title = corner.querySelector('h4');
    if (title) title.textContent = '📓 Diarinho da Lau';

    const desc = corner.querySelector('p');
    if (desc) desc.textContent = 'Um cantinho pequeno, privado e bem dela.';

    garantirBarraDeHumor();
    limparTecnicoDaTela();

    const list = $('diaryList');
    if (!list) return;
    list.classList.add('v60-diary-pages');

    const textoAtual = (list.textContent || '').trim();
    const vazio = /Diário vazio|Quando a Lau escrever|Nenhuma anotação|Recadinho do Lipe/i.test(textoAtual) && !/página\s+\d+\s+de\s+\d+/i.test(textoAtual);

    if (vazio) {
      list.innerHTML = `
        <div class="diary-book v60-empty-book">
          <div class="diary-book-date">💌 Recomeço do diário</div>
          <div class="diary-book-text">${RECADO_RECOMECO}</div>
        </div>
      `;
      return;
    }

    const book = list.querySelector('.diary-book');
    const controlsText = (list.querySelector('.diary-book-controls')?.textContent || '').replace(/\s+/g, ' ').trim();
    if (book && /página\s+1\s+de\s+1/i.test(controlsText)) {
      book.classList.add('v62-single-page');
    }

    const data = list.querySelector('.diary-book-date');
    if (data && !data.dataset.v60Polido) {
      const original = (data.textContent || '').replace(/^📓\s*/, '').trim();
      if (original && !/Diário vazio|Recadinho|Recomeço/i.test(original)) {
        data.textContent = `🕰️ ${original}`;
        data.dataset.v60Polido = '1';
      }
    }
  }

  function reformatarHistoricoModal() {
    const lista = $('diaryHistoryList');
    if (!lista) return;
    lista.classList.add('v60-history-list');
    if (/Nenhuma anotação ainda/i.test(lista.textContent || '')) {
      lista.innerHTML = `<div class="history-item v60-history-empty"><strong>💌 Recomeço do diário</strong><br>${RECADO_RECOMECO}</div>`;
    }
  }

  function prepararPaginaDiario() {
    fecharModalDiarioSeNaoForClique();
    setTimeout(polirDiarioRenderizado, 80);
    setTimeout(polirDiarioRenderizado, 350);
    setTimeout(polirDiarioRenderizado, 900);
  }

  const oldDesktop = window.abrirPaginaDesktop;
  window.abrirPaginaDesktop = function (page) {
    const result = typeof oldDesktop === 'function' ? oldDesktop.apply(this, arguments) : undefined;
    if (page === 'diario') prepararPaginaDiario();
    return result;
  };

  const oldMobile = window.abrirPaginaMobile;
  window.abrirPaginaMobile = function (page) {
    const result = typeof oldMobile === 'function' ? oldMobile.apply(this, arguments) : undefined;
    if (page === 'diario') prepararPaginaDiario();
    return result;
  };

  const oldSalvar = window.salvarDiarioLau;
  window.salvarDiarioLau = async function () {
    const campo = $('diaryText');
    if (campo) {
      const texto = campo.value.trim();
      if (texto && !texto.startsWith(emojiSelecionado)) {
        campo.value = `${emojiSelecionado} ${texto}`;
      }
    }
    const result = typeof oldSalvar === 'function' ? await oldSalvar.apply(this, arguments) : undefined;
    setTimeout(polirDiarioRenderizado, 180);
    setTimeout(polirDiarioRenderizado, 700);
    return result;
  };

  const oldRenderLivro = window.renderizarDiarioLivroLau;
  if (typeof oldRenderLivro === 'function') {
    window.renderizarDiarioLivroLau = function () {
      const result = oldRenderLivro.apply(this, arguments);
      polirDiarioRenderizado();
      return result;
    };
  }

  const oldHistorico = window.abrirHistoricoDiarioLau;
  window.abrirHistoricoDiarioLau = async function () {
    abrindoHistoricoPorClique = true;
    try {
      const result = typeof oldHistorico === 'function' ? await oldHistorico.apply(this, arguments) : undefined;
      setTimeout(reformatarHistoricoModal, 100);
      return result;
    } finally {
      setTimeout(() => { abrindoHistoricoPorClique = false; }, 500);
    }
  };

  const oldFechar = window.fecharHistoricoDiarioLau;
  window.fecharHistoricoDiarioLau = function () {
    abrindoHistoricoPorClique = false;
    return typeof oldFechar === 'function' ? oldFechar.apply(this, arguments) : undefined;
  };

  window.addEventListener('load', () => {
    fecharModalDiarioSeNaoForClique();
    setTimeout(polirDiarioRenderizado, 1000);
    setTimeout(polirDiarioRenderizado, 2200);
  });
})();
