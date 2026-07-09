/* LauOS v82 - Planos estáveis + cronômetro próprio */
(function () {
  const STORAGE_KEY = 'lauos_v74_planos_cache';
  const LEGACY_KEY = 'lauos_v55_planos';
  let planosCache = [];
  let carregando = false;
  let renderizando = false;
  let observerPlanos = null;
  let debounceRender = null;
  let encontroCacheV83 = localStorage.getItem('lauraos_data_encontro') || '';

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function usuarioAtual() {
    return localStorage.getItem('lauraos_usuario') || 'Lau';
  }

  function autorAtual() {
    return usuarioAtual() === 'Namorado' ? 'Namorado' : 'Lau';
  }

  function sb() {
    return window.sb || window.supabaseClient || window.lauosSupabase || null;
  }

  function show(msg) {
    if (typeof window.showMessage === 'function') window.showMessage(msg);
    else console.log('[LauOS]', msg);
  }

  function storageGet(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function normalizarPlano(plano, index = 0) {
    const status = plano.status || (plano.concluido ? 'feito' : 'quero fazer');
    const concluido = Boolean(plano.concluido) || String(status).toLowerCase().includes('feito') || String(status).toLowerCase().includes('conclu');
    return {
      id: plano.id || plano._id || `local-${plano.created_at || index}`,
      titulo: plano.titulo || plano.title || 'Plano',
      detalhes: plano.detalhes || plano.descricao || '',
      categoria: plano.categoria || 'Plano',
      status: concluido ? 'feito' : status,
      concluido,
      data_plano: plano.data_plano || plano.data || '',
      autor: plano.autor || 'LauOS',
      created_at: plano.created_at || plano.criadoEm || new Date().toISOString(),
      feito_em: plano.feito_em || ''
    };
  }

  function ordenarPlanos(planos) {
    return [...planos].map(normalizarPlano).sort((a, b) => {
      if (a.concluido !== b.concluido) return a.concluido ? 1 : -1;
      const da = a.data_plano || '';
      const db = b.data_plano || '';
      if (da && db && da !== db) return da.localeCompare(db);
      if (da && !db) return -1;
      if (!da && db) return 1;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
  }

  async function carregarPlanosV74() {
    if (carregando) return planosCache;
    carregando = true;
    const client = sb();
    try {
      if (client) {
        const { data, error } = await client
          .from('lau_planos')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300);
        if (!error && Array.isArray(data)) {
          planosCache = ordenarPlanos(data);
          storageSet(STORAGE_KEY, planosCache);
          carregando = false;
          return planosCache;
        }
        if (error) console.warn('[LauOS v74] Planos Supabase:', error);
      }
    } catch (err) {
      console.warn('[LauOS v74] Falha ao carregar planos:', err);
    }

    const cache = storageGet(STORAGE_KEY, []);
    const legacy = storageGet(LEGACY_KEY, []);
    const juntados = [...cache, ...legacy];
    const vistos = new Set();
    planosCache = ordenarPlanos(juntados.filter((p, i) => {
      const n = normalizarPlano(p, i);
      const key = String(n.id || `${n.titulo}-${n.created_at}`);
      if (vistos.has(key)) return false;
      vistos.add(key);
      return true;
    }));
    carregando = false;
    return planosCache;
  }

  async function salvarPlanoSupabase(payload) {
    const client = sb();
    if (!client) throw new Error('Supabase indisponível');
    const { data, error } = await client
      .from('lau_planos')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async function atualizarPlanoSupabase(id, payload) {
    const client = sb();
    if (!client || String(id).startsWith('local-')) throw new Error('Plano local');
    const { error } = await client.from('lau_planos').update(payload).eq('id', id);
    if (error) throw error;
  }

  async function excluirPlanoSupabase(id) {
    const client = sb();
    if (!client || String(id).startsWith('local-')) throw new Error('Plano local');
    const { error } = await client.from('lau_planos').delete().eq('id', id);
    if (error) throw error;
  }

  function salvarCacheLocal(planos) {
    planosCache = ordenarPlanos(planos);
    storageSet(STORAGE_KEY, planosCache);
  }

  function painelPlanosAtivo() {
    const usuario = autorAtual();
    return usuario === 'Namorado' ? $('viewPlans') : $('plansCorner');
  }

  function painelPlanosInativo() {
    return autorAtual() === 'Namorado' ? $('plansCorner') : $('viewPlans');
  }

  // v82: cronômetro próprio dentro da aba Planos.
  // Não move mais o #countdownArea antigo, porque ele era redesenhado por blocos antigos e sumia.
  let countdownV82Timer = null;

  function valorEncontroSalvoV82() {
    const input = $('v82MeetDateInput');
    const local = localStorage.getItem('lauraos_data_encontro') || encontroCacheV83 || '';
    return (input?.value || local || '').trim();
  }

  function normalizarParaInputV82(value) {
    if (!value) return '';
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) return str.slice(0, 16);
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function dateEncontroV82(value) {
    if (!value) return null;
    const str = String(value).trim();
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function preencherInputEncontroV82() {
    const input = $('v82MeetDateInput');
    if (!input) return;
    const saved = encontroCacheV83 || localStorage.getItem('lauraos_data_encontro') || '';
    if (saved && !input.value) input.value = normalizarParaInputV82(saved);
  }

  function partesInputEncontroV83(value) {
    const inputValue = normalizarParaInputV82(value) || String(value || '').slice(0, 16);
    const [data, horaRaw] = String(inputValue).split('T');
    const horario = (horaRaw || '00:00').slice(0, 5);
    return { inputValue, data, horario, rotina: inputValue };
  }

  async function carregarDataEncontroSupabaseV83() {
    const client = sb();
    if (!client) return null;
    try {
      const { data, error } = await client
        .from('lau_agenda')
        .select('rotina,data,horario,created_at,titulo')
        .eq('titulo', '__data_encontro__')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;
      if (!row) return null;
      const valor = row.rotina || (row.data ? `${row.data}T${String(row.horario || '00:00').slice(0,5)}` : '');
      if (valor) {
        encontroCacheV83 = valor;
        localStorage.setItem('lauraos_data_encontro', valor);
        const input = $('v82MeetDateInput');
        if (input && !input.value) input.value = normalizarParaInputV82(valor);
      }
      return valor || null;
    } catch (err) {
      console.warn('[LauOS v83] Não consegui carregar data do encontro no Supabase:', err);
      return null;
    }
  }

  function setTextoV82(id, valor) {
    const el = $(id);
    if (el) el.textContent = valor;
  }

  function atualizarCountdownPlanosV82() {
    if (!document.body.classList.contains('lauos-planos-page-active')) return;
    preencherInputEncontroV82();
    const valor = valorEncontroSalvoV82();
    const status = $('v82CountdownStatus');

    if (!valor) {
      setTextoV82('v82CountDays', '--');
      setTextoV82('v82CountHours', '--');
      setTextoV82('v82CountMinutes', '--');
      setTextoV82('v82CountSeconds', '--');
      if (status) status.textContent = 'Defina a data e horário do encontro';
      return;
    }

    const encontro = dateEncontroV82(valor);
    if (!encontro) {
      if (status) status.textContent = 'Data do encontro inválida';
      return;
    }

    const diffMs = encontro.getTime() - Date.now();
    if (diffMs <= 0) {
      setTextoV82('v82CountDays', '00');
      setTextoV82('v82CountHours', '00');
      setTextoV82('v82CountMinutes', '00');
      setTextoV82('v82CountSeconds', '00');
      if (status) status.textContent = 'É dia de se ver 💖';
      return;
    }

    const total = Math.floor(diffMs / 1000);
    const dias = Math.floor(total / 86400);
    const horas = Math.floor((total % 86400) / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    const segundos = total % 60;

    setTextoV82('v82CountDays', String(dias).padStart(2, '0'));
    setTextoV82('v82CountHours', String(horas).padStart(2, '0'));
    setTextoV82('v82CountMinutes', String(minutos).padStart(2, '0'));
    setTextoV82('v82CountSeconds', String(segundos).padStart(2, '0'));
    if (status) status.textContent = 'Contando cada segundo 💞';
  }

  function iniciarCountdownPlanosV82() {
    preencherInputEncontroV82();
    atualizarCountdownPlanosV82();
    if (countdownV82Timer) clearInterval(countdownV82Timer);
    countdownV82Timer = setInterval(atualizarCountdownPlanosV82, 1000);
  }

  window.salvarDataEncontroPlanosV82 = async function () {
    const input = $('v82MeetDateInput');
    if (!input || !input.value) return show('Escolhe a data e horário do encontro primeiro 📅');

    const partes = partesInputEncontroV83(input.value);
    if (!partes.data || !partes.horario) return show('Data do encontro inválida 📅');

    encontroCacheV83 = partes.rotina;
    localStorage.setItem('lauraos_data_encontro', partes.rotina);
    input.value = partes.inputValue;
    atualizarCountdownPlanosV82();

    const client = sb();
    if (client) {
      try {
        const { error } = await client.from('lau_agenda').insert({
          data: partes.data,
          horario: partes.horario,
          titulo: '__data_encontro__',
          rotina: partes.rotina
        });
        if (error) throw error;
        show('Data salva e sincronizada 💞');
        return;
      } catch (err) {
        console.warn('[LauOS v83] Data salva local, mas não sincronizou:', err);
      }
    }

    show('Data salva neste aparelho. Depois confira o Supabase.');
  };

  window.zerarDataEncontroPlanosV83 = async function () {
    if (!confirm('Zerar a data do encontro?')) return;
    encontroCacheV83 = '';
    localStorage.removeItem('lauraos_data_encontro');
    const input = $('v82MeetDateInput');
    if (input) input.value = '';
    atualizarCountdownPlanosV82();

    const client = sb();
    if (client) {
      try {
        const { error } = await client.from('lau_agenda').delete().eq('titulo', '__data_encontro__');
        if (error) throw error;
      } catch (err) {
        console.warn('[LauOS v83] Não consegui apagar data antiga do Supabase:', err);
      }
    }
    show('Data zerada 💫');
  };

  function moverCountdownParaPlanos() {
    // Mantido só por compatibilidade com chamadas antigas do próprio módulo.
    iniciarCountdownPlanosV82();
  }

  function contadorTexto(planos) {
    const abertos = planos.filter((p) => !p.concluido).length;
    const feitos = planos.filter((p) => p.concluido).length;
    if (!planos.length) return '0 planos';
    return `${abertos} aberto${abertos === 1 ? '' : 's'} · ${feitos} feito${feitos === 1 ? '' : 's'}`;
  }

  function planoCard(plano) {
    const data = plano.data_plano ? `<span class="v74-chip">📅 ${esc(formatarData(plano.data_plano))}</span>` : '';
    const feito = plano.concluido ? `<span class="v74-chip">✅ feito</span>` : `<span class="v74-chip">✨ ${esc(plano.status || 'quero fazer')}</span>`;
    const feitoEm = plano.feito_em ? `<span class="v74-chip">feito em ${esc(formatarDataHora(plano.feito_em))}</span>` : '';
    return `
      <article class="v74-plan-card ${plano.concluido ? 'done' : ''}" data-plan-id="${esc(plano.id)}">
        <div class="v74-plan-main">
          <h4 class="v74-plan-title">${esc(plano.titulo)}</h4>
          <div class="v74-plan-meta">
            <span class="v74-chip">${iconeCategoria(plano.categoria)} ${esc(plano.categoria || 'Plano')}</span>
            ${data}
            ${feito}
            ${feitoEm}
            <span class="v74-chip">por ${esc(plano.autor || 'LauOS')}</span>
          </div>
          ${plano.detalhes ? `<p class="v74-plan-text">${esc(plano.detalhes)}</p>` : ''}
        </div>
        <div class="v74-plan-actions">
          <button class="v74-icon-btn" type="button" title="${plano.concluido ? 'Voltar para aberto' : 'Marcar como feito'}" onclick="alternarPlanoFeitoV74('${esc(plano.id)}')">${plano.concluido ? '↩' : '✓'}</button>
          <button class="v74-icon-btn" type="button" title="Excluir" onclick="excluirPlanoV74('${esc(plano.id)}')">×</button>
        </div>
      </article>
    `;
  }

  function iconeCategoria(categoria) {
    const c = String(categoria || '').toLowerCase();
    if (c.includes('viagem')) return '✈️';
    if (c.includes('comida')) return '🍝';
    if (c.includes('filme')) return '🎬';
    if (c.includes('surpresa')) return '🎁';
    if (c.includes('sonho')) return '🌙';
    if (c.includes('encontro')) return '💞';
    return '🗺️';
  }

  function formatarData(data) {
    if (!data) return '';
    try {
      const [y, m, d] = String(data).slice(0, 10).split('-');
      if (y && m && d) return `${d}/${m}/${y}`;
      return data;
    } catch { return data; }
  }

  function formatarDataHora(value) {
    try {
      return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return value; }
  }

  function planosHtml(planos) {
    const ativos = planos.filter((p) => !p.concluido);
    const feitos = planos.filter((p) => p.concluido);
    return `
      <div class="v74-plans-shell">
        <div class="v74-plans-head">
          <div class="v74-plans-title">
            <span>🗺️</span><h3>Planos</h3>
          </div>
          <div class="v74-plans-pill">${esc(contadorTexto(planos))}</div>
        </div>

        <section class="v82-meet-card" id="v82MeetCard">
          <div class="v82-meet-head">
            <div>
              <h4>📅 Dias pra se ver</h4>
              <span id="v82CountdownStatus">Defina a data e horário do encontro</span>
            </div>
          </div>
          <div class="v82-count-grid" aria-label="Contagem regressiva">
            <div><strong id="v82CountDays">--</strong><small>dias</small></div>
            <div><strong id="v82CountHours">--</strong><small>horas</small></div>
            <div><strong id="v82CountMinutes">--</strong><small>min</small></div>
            <div><strong id="v82CountSeconds">--</strong><small>seg</small></div>
          </div>
          <div class="v82-meet-controls">
            <input id="v82MeetDateInput" type="datetime-local" />
            <button type="button" onclick="salvarDataEncontroPlanosV82()">Salvar data 💞</button>
            <button type="button" class="v82-reset-btn" onclick="zerarDataEncontroPlanosV83()">Zerar data ✨</button>
          </div>
        </section>

        <div class="v74-plans-grid">
          <section class="v74-panel">
            <h4 class="v74-form-title">Novo plano</h4>
            <div class="v74-plan-form">
              <input id="v74PlanoTitulo" placeholder="Nome do plano" />
              <div class="v74-form-row">
                <select id="v74PlanoCategoria">
                  <option>Encontro</option>
                  <option>Passeio</option>
                  <option>Comida</option>
                  <option>Viagem</option>
                  <option>Filme</option>
                  <option>Surpresa</option>
                  <option>Sonho</option>
                </select>
                <input id="v74PlanoData" type="date" />
              </div>
              <textarea id="v74PlanoDetalhes" placeholder="Detalhes"></textarea>
              <button class="v74-primary-btn" type="button" onclick="salvarPlanoV74()">Guardar plano 💞</button>
            </div>
          </section>

          <section class="v74-panel">
            <div class="v74-section-label"><span>Para fazer</span><span>${ativos.length}</span></div>
            <div class="v74-plan-list">
              ${ativos.length ? ativos.map(planoCard).join('') : '<div class="v74-empty">Nenhum plano aberto.</div>'}
            </div>
            <div class="v74-section-label" style="margin-top:14px"><span>Feitos</span><span>${feitos.length}</span></div>
            <div class="v74-plan-list">
              ${feitos.length ? feitos.map(planoCard).join('') : '<div class="v74-empty">Nenhum plano concluído ainda.</div>'}
            </div>
          </section>
        </div>
      </div>
    `;
  }

  function renderizarPlanosNoPainelV82(planos) {
    const html = planosHtml(planos);
    const ativo = painelPlanosAtivo();
    const inativo = painelPlanosInativo();
    if (inativo) inativo.innerHTML = '';
    if (ativo) {
      ativo.innerHTML = html;
      ativo.dataset.v82PlanosOk = '1';
    }
    iniciarCountdownPlanosV82();
    setTimeout(atualizarCountdownPlanosV82, 80);
  }

  async function renderPlanosV74() {
    if (renderizando) return;
    renderizando = true;
    try {
      // Render imediato com cache/local para matar a piscada da tela antiga.
      const rapido = planosCache.length
        ? planosCache
        : ordenarPlanos([...storageGet(STORAGE_KEY, []), ...storageGet(LEGACY_KEY, [])]);
      renderizarPlanosNoPainelV82(rapido);

      const planos = await carregarPlanosV74();
      renderizarPlanosNoPainelV82(planos);
    } finally {
      setTimeout(() => { renderizando = false; }, 60);
    }
  }

  window.renderPlanosV74 = renderPlanosV74;

  window.salvarPlanoV74 = async function () {
    const titulo = ($('v74PlanoTitulo')?.value || '').trim();
    const detalhes = ($('v74PlanoDetalhes')?.value || '').trim();
    const categoria = $('v74PlanoCategoria')?.value || 'Encontro';
    const data_plano = $('v74PlanoData')?.value || null;
    if (!titulo) return show('Coloca o nome do plano primeiro 💞');

    const payload = {
      titulo,
      detalhes,
      categoria,
      data_plano,
      status: 'quero fazer',
      concluido: false,
      autor: autorAtual()
    };

    try {
      const salvo = await salvarPlanoSupabase(payload);
      planosCache = ordenarPlanos([salvo, ...planosCache]);
      storageSet(STORAGE_KEY, planosCache);
      show('Plano guardado 💞');
    } catch (err) {
      console.warn('[LauOS v74] Salvou local por fallback:', err);
      const local = { ...payload, id: `local-${Date.now()}`, created_at: new Date().toISOString() };
      salvarCacheLocal([local, ...planosCache]);
      show('Plano salvo neste aparelho. Depois confira o Supabase.');
    }

    ['v74PlanoTitulo', 'v74PlanoDetalhes', 'v74PlanoData'].forEach((id) => { if ($(id)) $(id).value = ''; });
    await renderPlanosV74();
  };

  window.alternarPlanoFeitoV74 = async function (id) {
    const plano = planosCache.find((p) => String(p.id) === String(id));
    if (!plano) return;
    const novoConcluido = !plano.concluido;
    const payload = {
      concluido: novoConcluido,
      status: novoConcluido ? 'feito' : 'quero fazer',
      feito_em: novoConcluido ? new Date().toISOString() : null
    };

    try {
      await atualizarPlanoSupabase(id, payload);
    } catch (err) {
      console.warn('[LauOS v74] Toggle local:', err);
    }

    salvarCacheLocal(planosCache.map((p) => String(p.id) === String(id) ? { ...p, ...payload } : p));
    await renderPlanosV74();
  };

  window.excluirPlanoV74 = async function (id) {
    if (!confirm('Excluir esse plano?')) return;
    try {
      await excluirPlanoSupabase(id);
    } catch (err) {
      console.warn('[LauOS v74] Excluir local:', err);
    }
    salvarCacheLocal(planosCache.filter((p) => String(p.id) !== String(id)));
    await renderPlanosV74();
    show('Plano removido');
  };


  // v81: mantém o cronômetro e o layout v74/v81 firmes na aba Planos.
  let v81CountdownGuard = null;
  function iniciarGuardCountdownV81() {
    if (v81CountdownGuard) return;
    v81CountdownGuard = setInterval(() => {
      if (!document.body.classList.contains('lauos-planos-page-active')) return;
      const ativo = painelPlanosAtivo();
      if (ativo && !ativo.querySelector('.v74-plans-shell') && !renderizando) {
        scheduleRenderPlanos();
      } else {
        atualizarCountdownPlanosV82();
      }
    }, 900);
  }

  function scheduleRenderPlanos() {
    clearTimeout(debounceRender);
    debounceRender = setTimeout(() => {
      if (document.body.classList.contains('lauos-planos-page-active')) renderPlanosV74();
    }, 80);
  }

  function instalarObserverPlanosV81() {
    if (observerPlanos) return;
    observerPlanos = new MutationObserver(() => {
      if (!document.body.classList.contains('lauos-planos-page-active') || renderizando) return;
      const ativo = painelPlanosAtivo();
      if (ativo && !ativo.querySelector('.v74-plans-shell')) scheduleRenderPlanos();
    });
    ['plansCorner', 'viewPlans'].forEach((id) => {
      const el = $(id);
      if (el) observerPlanos.observe(el, { childList: true, subtree: false });
    });
  }

  function init() {
    Promise.all([carregarDataEncontroSupabaseV83(), carregarPlanosV74()]).then(() => {
      iniciarGuardCountdownV81();
      instalarObserverPlanosV81();
      if (document.body.classList.contains('lauos-planos-page-active') || window.lauDesktopPageAtual === 'planos' || window.lauMobilePageAtual === 'planos') {
        document.body.classList.add('lauos-planos-page-active');
        renderPlanosV74();
      }
    });
    setInterval(() => {
      if (document.body.classList.contains('lauos-planos-page-active')) {
        atualizarCountdownPlanosV82();
      }
    }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
