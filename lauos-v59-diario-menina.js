/* LauOS v59 - diário limpo, delicado e sem lembrar erro antigo o tempo todo */
(function () {
  'use strict';

  const RECADO_CURTO = 'Lau, eu sinto muito pelo diário antigo. Cuidei pra esse cantinho ficar protegido daqui pra frente. Agora é um recomeço só seu. 💗';

  function $(id) { return document.getElementById(id); }

  function limparElementosTecnicos() {
    document.querySelectorAll('#v58DiaryRestartNote, #v57DiarySafePanel, .v57-diary-empty-restart, .v56-diary-warning').forEach((el) => el.remove());
  }

  function deixarDiarioMaisLeve() {
    const corner = $('diaryCorner');
    if (!corner) return;
    corner.classList.add('v59-diary-menina');

    const title = corner.querySelector('h4');
    if (title) title.textContent = '📓 Diarinho da Lau';

    const desc = corner.querySelector('p');
    if (desc) desc.textContent = 'Um cantinho leve, privado e bem dela.';

    const list = $('diaryList');
    if (list) {
      const text = (list.textContent || '').trim();
      const vazio = /Diário vazio|Quando a Lau escrever|Nenhuma anotação/i.test(text);
      if (vazio) {
        list.innerHTML = `
          <div class="diary-book v56-restored v59-empty-book">
            <div class="diary-book-date">💌 Recadinho do Lipe</div>
            <div class="diary-book-text">${RECADO_CURTO}</div>
          </div>
        `;
      }
    }

    limparElementosTecnicos();
  }

  const oldDesktop = window.abrirPaginaDesktop;
  window.abrirPaginaDesktop = function (page) {
    const result = typeof oldDesktop === 'function' ? oldDesktop.apply(this, arguments) : undefined;
    if (page === 'diario') {
      setTimeout(deixarDiarioMaisLeve, 80);
      setTimeout(deixarDiarioMaisLeve, 450);
      setTimeout(deixarDiarioMaisLeve, 1200);
    }
    return result;
  };

  const oldMobile = window.abrirPaginaMobile;
  window.abrirPaginaMobile = function (page) {
    const result = typeof oldMobile === 'function' ? oldMobile.apply(this, arguments) : undefined;
    if (page === 'diario') {
      setTimeout(deixarDiarioMaisLeve, 80);
      setTimeout(deixarDiarioMaisLeve, 450);
      setTimeout(deixarDiarioMaisLeve, 1200);
    }
    return result;
  };

  const oldApply = window.aplicarPermissao;
  window.aplicarPermissao = function (usuario) {
    const result = typeof oldApply === 'function' ? oldApply.apply(this, arguments) : undefined;
    setTimeout(deixarDiarioMaisLeve, 700);
    setTimeout(deixarDiarioMaisLeve, 1800);
    return result;
  };

  const oldAbrirHistorico = window.abrirHistoricoDiarioLau;
  window.abrirHistoricoDiarioLau = async function () {
    const result = typeof oldAbrirHistorico === 'function' ? await oldAbrirHistorico.apply(this, arguments) : undefined;
    setTimeout(() => {
      const lista = $('diaryHistoryList');
      if (lista && /Nenhuma anotação ainda/i.test(lista.textContent || '')) {
        lista.innerHTML = `<div class="history-item"><strong>💌 Recadinho do Lipe</strong><br>${RECADO_CURTO}</div>`;
      }
    }, 120);
    return result;
  };

  window.addEventListener('load', () => {
    setTimeout(deixarDiarioMaisLeve, 1200);
    setTimeout(deixarDiarioMaisLeve, 2600);
  });

  setInterval(() => {
    if (localStorage.getItem('lauraos_usuario') === 'Lau') limparElementosTecnicos();
  }, 1500);
})();
