
<script>
/* V33: correcoes finais - cronometro sync, manual historico, missao e nav desktop */
(function () {
  let cacheDataEncontroSupabase = null;
  let cacheManualHistoricoLau = [];

  function usuarioAtualEmailPermitidoParaLau(email) {
    return typeof isEmailLau === 'function' && isEmailLau(email || '');
  }

  function montarDateTimeLocal(data, hora, rotina) {
    if (rotina && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(rotina)) return rotina.slice(0, 16);
    if (data && hora) return `${data}T${hora.slice(0,5)}`;
    return '';
  }

  const carregarAgendaSupabaseV32 = window.carregarAgendaSupabase || carregarAgendaSupabase;
  window.carregarAgendaSupabase = carregarAgendaSupabase = async function () {
    const { data, error } = await sb.from('lau_agenda').select('*').order('created_at', { ascending: false }).limit(250);
    if (error) { console.error(error); return; }

    cacheAgendaLau = [];
    cacheRotinasLau = {};
    cacheDataEncontroSupabase = null;

    (data || []).forEach((item) => {
      if (item.titulo === '__data_encontro__') {
        if (!cacheDataEncontroSupabase) {
          cacheDataEncontroSupabase = montarDateTimeLocal(item.data, item.horario, item.rotina);
        }
        return;
      }
      if (item.titulo === '__rotina_dia__') {
        cacheRotinasLau[item.data] = { texto: item.rotina || '', data: item.data, atualizadoEm: dataBR(item.created_at) };
      } else {
        cacheAgendaLau.push({ id: item.id, data: item.data, hora: item.horario || '', texto: item.titulo, criadoEm: dataBR(item.created_at) });
      }
    });

    carregarDataEncontro();
  };

  window.carregarDataEncontro = carregarDataEncontro = function () {
    const input = document.getElementById('meetDateInput');
    const data = cacheDataEncontroSupabase || localStorage.getItem('lauraos_data_encontro') || '';
    if (input && data) input.value = data;
    calcularDiasPraSeVer();
  };

  window.salvarDataEncontro = salvarDataEncontro = async function () {
    const input = document.getElementById('meetDateInput');
    if (!input || !input.value) {
      showMessage('Escolhe a data e o horário de quando vocês vão se ver primeiro 📅');
      return;
    }

    const valor = input.value;
    const [data, horaCompleta = '00:00'] = valor.split('T');
    const horario = horaCompleta.slice(0, 5);

    localStorage.setItem('lauraos_data_encontro', valor);
    cacheDataEncontroSupabase = valor;
    calcularDiasPraSeVer();

    const { error } = await sb.from('lau_agenda').insert({
      data,
      horario,
      titulo: '__data_encontro__',
      rotina: valor
    });

    if (error) {
      console.error(error);
      showMessage('Salvei neste aparelho, mas não consegui sincronizar. Confira a permissão da agenda no Supabase.');
      return;
    }

    showMessage('Contagem sincronizada entre vocês 💞');
  };

  window.calcularDiasPraSeVer = calcularDiasPraSeVer = function () {
    const diasEl = document.getElementById('countdownDays');
    const horasEl = document.getElementById('countdownHours');
    const minutosEl = document.getElementById('countdownMinutes');
    const segundosEl = document.getElementById('countdownSeconds');
    const statusEl = document.getElementById('countdownStatus');
    const dataSalva = cacheDataEncontroSupabase || localStorage.getItem('lauraos_data_encontro');

    if (!diasEl || !horasEl || !minutosEl || !segundosEl || !statusEl) return;

    if (!dataSalva) {
      diasEl.textContent = '--';
      horasEl.textContent = '--';
      minutosEl.textContent = '--';
      segundosEl.textContent = '--';
      statusEl.textContent = 'defina a data e horário do encontro';
      return;
    }

    const agora = new Date();
    const encontro = new Date(dataSalva);
    const diffMs = encontro - agora;

    if (Number.isNaN(encontro.getTime())) {
      statusEl.textContent = 'data do encontro inválida';
      return;
    }

    if (diffMs <= 0) {
      diasEl.textContent = '00';
      horasEl.textContent = '00';
      minutosEl.textContent = '00';
      segundosEl.textContent = '00';
      statusEl.textContent = 'é dia de se ver 💖';
      return;
    }

    const totalSegundos = Math.floor(diffMs / 1000);
    const dias = Math.floor(totalSegundos / 86400);
    const horas = Math.floor((totalSegundos % 86400) / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;

    diasEl.textContent = String(dias).padStart(2, '0');
    horasEl.textContent = String(horas).padStart(2, '0');
    minutosEl.textContent = String(minutos).padStart(2, '0');
    segundosEl.textContent = String(segundos).padStart(2, '0');
    statusEl.textContent = 'dias pra se ver, contando cada segundo 💞';
  };

  const carregarCantinhoSupabaseV32 = window.carregarCantinhoSupabase || carregarCantinhoSupabase;
  window.carregarCantinhoSupabase = carregarCantinhoSupabase = async function () {
    const [desejos, frases, manual] = await Promise.all([
      sb.from('lau_desejos').select('*').order('created_at', { ascending: false }).limit(30),
      sb.from('lau_frases').select('*').order('created_at', { ascending: false }).limit(30),
      sb.from('lau_manual').select('*').order('created_at', { ascending: false }).limit(30)
    ]);

    if (!desejos.error) cacheDesejosLau = (desejos.data || []).map((i) => ({ texto: i.texto, data: dataBR(i.created_at) }));
    if (!frases.error) cacheFrasesLau = (frases.data || []).map((i) => ({ texto: i.texto, data: dataBR(i.created_at) }));
    if (!manual.error) {
      cacheManualHistoricoLau = (manual.data || []).map((m) => ({ texto: m.instrucao || m.situacao || '', data: dataBR(m.created_at) }));
      cacheManualLau = cacheManualHistoricoLau[0] || null;
    }
  };

  window.salvarManualLau = salvarManualLau = async function () {
    const campo = document.getElementById('manualText');
    const texto = (campo?.value || '').trim();
    if (!texto) {
      showMessage('Escreve uma instrução no Manual da Lau primeiro 📖');
      return;
    }

    const { error } = await sb.from('lau_manual').insert({ situacao: 'Manual da Lau', instrucao: texto });
    if (error) { console.error(error); showMessage('Não consegui salvar o manual.'); return; }

    if (campo) campo.value = '';
    await carregarCantinhoSupabase();
    renderizarCantinhoLau();
    renderizarCantinhoNamorado();
    showMessage('Manual da Lau salvo no histórico 📖');
  };

  function htmlManualHistorico() {
    if (!cacheManualHistoricoLau || !cacheManualHistoricoLau.length) return 'Manual ainda não preenchido.';
    const [atual, ...antigos] = cacheManualHistoricoLau;
    const historico = antigos.length
      ? `<div class="corner-list" style="margin-top:10px">${antigos.map((item) => `<div class="corner-item">${escapeHtml(item.texto).replaceAll('\n','<br>')}<br><small>${escapeHtml(item.data)}</small></div>`).join('')}</div>`
      : '<div class="corner-list" style="margin-top:10px"><div class="corner-item">Nenhum histórico antigo ainda.</div></div>';
    return `
      <div class="corner-item"><strong>Manual atual:</strong><br>${escapeHtml(atual.texto).replaceAll('\n','<br>')}<br><small>${escapeHtml(atual.data)}</small></div>
      <div class="agenda-section-title">Histórico do manual</div>
      ${historico}
    `;
  }

  const renderizarCantinhoLauV32 = window.renderizarCantinhoLau || renderizarCantinhoLau;
  window.renderizarCantinhoLau = renderizarCantinhoLau = function () {
    renderizarCantinhoLauV32();
    const manualView = document.getElementById('manualView');
    if (manualView) manualView.innerHTML = htmlManualHistorico();
  };

  const renderizarCantinhoNamoradoV32 = window.renderizarCantinhoNamorado || renderizarCantinhoNamorado;
  window.renderizarCantinhoNamorado = renderizarCantinhoNamorado = function () {
    renderizarCantinhoNamoradoV32();
    const viewManual = document.getElementById('viewManual');
    if (viewManual) viewManual.innerHTML = `<h4>📖 Manual da Lau</h4>${htmlManualHistorico()}`;
  };

  window.enviarMissaoNamorado = enviarMissaoNamorado = async function () {
    const select = document.getElementById('missionSelect');
    const custom = document.getElementById('customMissionInput');
    const texto = ((custom?.value || '').trim() || (select?.value || '').trim());
    if (!texto) { showMessage('Escreve ou escolhe uma missão primeiro 🫡'); return; }

    const { error } = await sb.from('lau_missoes').insert({ texto, concluida: false });
    if (error) { console.error(error); showMessage('Não consegui enviar a missão.'); return; }

    if (custom) custom.value = '';
    await carregarMissoesSupabase();
    renderizarMissaoLau();
    renderizarMissaoNamorado();
    showMessage('Missão enviada para o namorado 🫡💌');
  };

  window.renderizarMissaoLau = renderizarMissaoLau = function () {
    const box = document.getElementById('missionResult') || document.getElementById('missionLauBox');
    if (!box) return;
    const missao = cacheMissoesLau && cacheMissoesLau[0];
    box.innerHTML = missao
      ? `<strong>${missao.concluida ? 'Missão concluída ✅' : 'Missão pendente 🫡'}</strong><br>${escapeHtml(missao.texto)}<br><small>Enviada em: ${escapeHtml(dataBR(missao.created_at))}</small>`
      : 'Nenhuma missão enviada ainda.';
  };

  window.renderizarMissaoNamorado = renderizarMissaoNamorado = function () {
    const box = document.getElementById('currentMissionView') || document.getElementById('missionBoyfriendBox');
    if (!box) return;
    const missao = cacheMissoesLau && cacheMissoesLau[0];
    box.innerHTML = missao
      ? `<strong>${missao.concluida ? 'Missão concluída ✅' : 'Missão pendente 🫡'}</strong><br>${escapeHtml(missao.texto)}<br><small>Enviada em: ${escapeHtml(dataBR(missao.created_at))}</small>`
      : 'Nenhuma missão enviada ainda.';
  };

  // Garante botão Missão no desktop da Lau e abre o painel correto, sem mexer no restante visual.
  function garantirMissaoDesktopLau() {
    const nav = document.getElementById('desktopTabbar');
    const usuario = localStorage.getItem('lauraos_usuario');
    if (!nav || usuario !== 'Lau' || nav.querySelector('[data-desktop-page="missao"]')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.desktopPage = 'missao';
    btn.innerHTML = '<strong>🫡</strong><span>Missão</span>';
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      abrirPaginaDesktop('missao');
    });
    nav.appendChild(btn);
  }

  const abrirPaginaDesktopV32 = window.abrirPaginaDesktop;
  if (typeof abrirPaginaDesktopV32 === 'function') {
    window.abrirPaginaDesktop = function (page) {
      if (page !== 'missao') {
        abrirPaginaDesktopV32(page);
        garantirMissaoDesktopLau();
        return;
      }

      const usuario = localStorage.getItem('lauraos_usuario') || 'Lau';
      if (usuario !== 'Lau') {
        abrirPaginaDesktopV32(page);
        return;
      }

      abrirPaginaDesktopV32('bau');
      window.lauDesktopPageAtual = 'missao';
      document.querySelectorAll('#desktopTabbar button[data-desktop-page]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.desktopPage === 'missao');
      });

      const lauraArea = document.getElementById('lauraArea');
      if (!lauraArea) return;
      const roleHeader = lauraArea.querySelector('.role-header');
      const moodOptions = document.getElementById('moodOptions');
      const levelsGrid = lauraArea.querySelector('.levels-grid');
      const moodNote = document.getElementById('moodNote');
      const saveMood = lauraArea.querySelector('.save-mood-btn');
      const chatCard = lauraArea.querySelector('.chat-card');
      const photoViewer = document.getElementById('lauMobilePhotoViewer');
      const corner = document.getElementById('lauCorner');

      [roleHeader, moodOptions, levelsGrid, moodNote, saveMood, chatCard, photoViewer].forEach((el) => { if (el) el.style.display = 'none'; });
      if (corner) corner.style.display = 'block';
      if (typeof mostrarPainelCantinhoDesktop === 'function') {
        mostrarPainelCantinhoDesktop(['missionGame'], false);
      } else {
        document.querySelectorAll('#lauCorner .corner-panel').forEach((panel) => {
          panel.style.display = panel.id === 'missionGame' ? 'block' : 'none';
          panel.classList.toggle('show', panel.id === 'missionGame');
        });
      }
      renderizarMissaoLau();
      garantirMissaoDesktopLau();
    };
  }

  const aplicarPermissaoV32 = window.aplicarPermissao || aplicarPermissao;
  window.aplicarPermissao = aplicarPermissao = function (usuario) {
    aplicarPermissaoV32(usuario);
    setTimeout(() => {
      garantirMissaoDesktopLau();
      carregarDataEncontro();
    }, 120);
  };

  setInterval(async () => {
    try {
      const { data } = await sb.auth.getSession();
      if (!data?.session) return;
      await carregarAgendaSupabase();
      calcularDiasPraSeVer();
    } catch (e) {
      console.warn('Falha ao atualizar contagem sincronizada', e);
    }
  }, 12000);
})();
</script>
