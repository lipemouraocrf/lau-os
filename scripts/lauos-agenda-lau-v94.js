/* LauOS v94 - Agenda da Lau isolada.
   Só controla a aba Agenda no perfil da Lau. Não altera Namorado, Blog, Fotos ou outras abas. */
(function () {
  'use strict';

  const state = {
    host: null,
    month: new Date(),
    selected: todayISO(),
    rows: [],
    loading: false,
    lastLoad: 0
  };

  const LOCAL_ITEMS = 'lauraos_agenda_items';
  const LOCAL_ROUTINES = 'lauos_v94_agenda_lau_rotinas';

  const $ = (id) => document.getElementById(id);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function sbClient() {
    try { return window.sb || window.supabaseClient || window.lauosSupabase || null; }
    catch { return null; }
  }

  function msg(text) {
    if (typeof window.showMessage === 'function') window.showMessage(text);
    else console.log('[Agenda Lau v94]', text);
  }

  function safe(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[c]));
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function nowBR() {
    return new Date().toLocaleString('pt-BR');
  }

  function dateBR(value) {
    if (!value) return '';
    const raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [y, m, d] = raw.split('-');
      return `${d}/${m}/${y}`;
    }
    try { return new Date(value).toLocaleString('pt-BR'); }
    catch { return raw; }
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function normalize(row, fallbackType = 'compromisso') {
    if (!row) return null;
    const isRotina = row.tipo === 'rotina' || row.titulo === '__rotina_dia__';
    const data = row.data || row.date || row.dia || todayISO();
    const text = isRotina ? (row.rotina || row.texto || row.titulo || '') : (row.titulo || row.texto || row.title || '');
    if (!text || text === '__data_encontro__') return null;
    return {
      id: row.id || null,
      localId: row.localId || `local-${data}-${String(text).slice(0, 24)}-${row.horario || row.hora || ''}`,
      tipo: isRotina ? 'rotina' : fallbackType,
      data,
      hora: row.horario || row.hora || '',
      texto: text,
      created_at: row.created_at || row.criadoEm || row.atualizadoEm || null,
      remote: Boolean(row.id)
    };
  }

  function normalizeRemoteRows(rows) {
    return (rows || [])
      .map((row) => normalize(row, row?.titulo === '__rotina_dia__' ? 'rotina' : 'compromisso'))
      .filter(Boolean);
  }

  function localRows() {
    const compromissos = (readJson(LOCAL_ITEMS, []) || []).map((item) => normalize(item, 'compromisso')).filter(Boolean);
    const rotinasObj = readJson(LOCAL_ROUTINES, {}) || {};
    const rotinas = Object.entries(rotinasObj).flatMap(([data, list]) => {
      const arr = Array.isArray(list) ? list : [list];
      return arr.map((item, idx) => normalize({ ...(typeof item === 'object' ? item : { texto: item }), data, tipo: 'rotina', localId: `rotina-${data}-${idx}` }, 'rotina'));
    }).filter(Boolean);
    return [...compromissos, ...rotinas];
  }

  function saveLocalSnapshot() {
    const compromissos = state.rows
      .filter((r) => r.tipo !== 'rotina')
      .map((r) => ({ id: r.id || undefined, localId: r.localId, data: r.data, hora: r.hora || '', texto: r.texto, criadoEm: r.created_at || nowBR() }))
      .slice(0, 250);
    const rotinas = {};
    state.rows.filter((r) => r.tipo === 'rotina').forEach((r) => {
      if (!rotinas[r.data]) rotinas[r.data] = [];
      rotinas[r.data].push({ id: r.id || undefined, localId: r.localId, texto: r.texto, atualizadoEm: r.created_at || nowBR() });
    });
    writeJson(LOCAL_ITEMS, compromissos);
    writeJson(LOCAL_ROUTINES, rotinas);
  }

  function mergeRows(remote, local) {
    const map = new Map();
    [...local, ...remote].forEach((item) => {
      const key = item.id ? `id:${item.id}` : `${item.tipo}:${item.data}:${item.hora}:${item.texto}`;
      map.set(key, item);
    });
    return Array.from(map.values()).sort((a, b) => {
      const da = String(a.data || '');
      const db = String(b.data || '');
      if (da !== db) return da.localeCompare(db);
      return String(a.hora || '99:99').localeCompare(String(b.hora || '99:99'));
    });
  }

  async function load(force = false) {
    const now = Date.now();
    if (!force && state.rows.length && now - state.lastLoad < 20000) return state.rows;
    if (state.loading) return state.rows;
    state.loading = true;
    try {
      let remote = [];
      const sb = sbClient();
      if (sb) {
        const { data, error } = await sb
          .from('lau_agenda')
          .select('*')
          .order('data', { ascending: true })
          .order('horario', { ascending: true })
          .limit(600);
        if (error) throw error;
        remote = normalizeRemoteRows(data);
      }
      state.rows = mergeRows(remote, localRows());
      state.lastLoad = now;
      saveLocalSnapshot();
      try {
        if (typeof window.carregarAgendaSupabase === 'function') await window.carregarAgendaSupabase();
      } catch {}
    } catch (err) {
      console.warn('[Agenda Lau v94] fallback local:', err);
      state.rows = mergeRows([], localRows());
    } finally {
      state.loading = false;
    }
    return state.rows;
  }

  function rowsForDate(data) {
    return state.rows.filter((item) => item.data === data);
  }

  function datesWithData() {
    const map = new Map();
    state.rows.forEach((item) => {
      if (!item.data) return;
      map.set(item.data, (map.get(item.data) || 0) + 1);
    });
    return map;
  }

  function nextRows() {
    const hoje = todayISO();
    return state.rows.filter((item) => item.data >= hoje && item.tipo !== 'rotina').slice(0, 5);
  }

  function renderCalendar() {
    const y = state.month.getFullYear();
    const m = state.month.getMonth();
    const first = new Date(y, m, 1).getDay();
    const total = new Date(y, m + 1, 0).getDate();
    const today = todayISO();
    const marked = datesWithData();
    let cells = '';
    for (let i = 0; i < first; i++) cells += '<button type="button" class="agenda-v94-day is-empty" disabled></button>';
    for (let day = 1; day <= total; day++) {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const count = marked.get(iso) || 0;
      const cls = ['agenda-v94-day'];
      if (iso === today) cls.push('is-today');
      if (iso === state.selected) cls.push('is-selected');
      if (count) cls.push('has-data');
      cells += `<button type="button" class="${cls.join(' ')}" data-agenda-v94-date="${iso}"><span>${day}</span>${count ? `<em>${count}</em>` : ''}</button>`;
    }
    const mes = state.month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return `
      <section class="agenda-v94-calendar-card">
        <div class="agenda-v94-month">
          <button type="button" data-agenda-v94-month="-1">‹</button>
          <strong>${safe(mes)}</strong>
          <button type="button" data-agenda-v94-month="1">›</button>
        </div>
        <div class="agenda-v94-week"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>
        <div class="agenda-v94-grid">${cells}</div>
      </section>`;
  }

  function renderDayPanel() {
    const items = rowsForDate(state.selected);
    const compromissos = items.filter((i) => i.tipo !== 'rotina');
    const rotinas = items.filter((i) => i.tipo === 'rotina');
    const listHtml = items.length ? `
      <div class="agenda-v94-day-list">
        ${[...compromissos, ...rotinas].map((item) => `
          <article class="agenda-v94-item ${item.tipo === 'rotina' ? 'is-note' : ''}">
            <div>
              <span>${item.tipo === 'rotina' ? '📝 Notinha do dia' : (item.hora ? `⏰ ${safe(item.hora)}` : '🌷 Compromisso')}</span>
              <strong>${safe(item.texto).replaceAll('\n', '<br>')}</strong>
              ${item.created_at ? `<small>${safe(dateBR(item.created_at))}</small>` : ''}
            </div>
            <button type="button" title="remover" data-agenda-v94-del="${safe(item.id || item.localId)}">×</button>
          </article>`).join('')}
      </div>` : '<div class="agenda-v94-empty">Nada salvo nesse dia ainda.</div>';
    return `
      <section class="agenda-v94-day-card">
        <div class="agenda-v94-day-title">
          <span>💌 ${safe(dateBR(state.selected))}</span>
          <button type="button" data-agenda-v94-today>hoje</button>
        </div>
        ${listHtml}
        <div class="agenda-v94-note-box">
          <textarea id="agendaV94Rotina" placeholder="Uma notinha fofa sobre esse dia..."></textarea>
          <button type="button" data-agenda-v94-save-note>Guardar notinha ✨</button>
        </div>
      </section>`;
  }

  function renderNext() {
    const list = nextRows();
    return `
      <section class="agenda-v94-next-card">
        <strong>Próximos</strong>
        ${list.length ? list.map((item) => `
          <div class="agenda-v94-next-item">
            <span>${safe(dateBR(item.data))}${item.hora ? ` · ${safe(item.hora)}` : ''}</span>
            <b>${safe(item.texto)}</b>
          </div>`).join('') : '<p>Sem compromisso futuro salvo.</p>'}
      </section>`;
  }

  function render() {
    if (!state.host) return;
    state.host.innerHTML = `
      <div class="agenda-v94-shell">
        <header class="agenda-v94-header">
          <div>
            <span class="agenda-v94-pill">🗓️ Agenda da Lau</span>
            <h3>Agendinha</h3>
          </div>
          <span class="agenda-v94-count">${state.rows.length} item(ns)</span>
        </header>

        <section class="agenda-v94-add-card">
          <input type="date" id="agendaV94Date" value="${safe(state.selected)}">
          <input type="time" id="agendaV94Time">
          <input id="agendaV94Text" placeholder="Ex: aula, médico, mercado, encontro...">
          <button type="button" data-agenda-v94-save>Salvar 💗</button>
        </section>

        <div class="agenda-v94-layout">
          ${renderCalendar()}
          ${renderDayPanel()}
        </div>
        ${renderNext()}
      </div>`;
    bind();
  }

  async function addCommitment() {
    const data = $('agendaV94Date')?.value || state.selected || todayISO();
    const hora = $('agendaV94Time')?.value || '';
    const texto = ($('agendaV94Text')?.value || '').trim();
    if (!data || !texto) return msg('Coloca uma data e escreve o compromisso primeiro 🗓️');

    const item = { localId: `local-${Date.now()}`, tipo: 'compromisso', data, hora, texto, created_at: new Date().toISOString() };
    state.rows.push(item);
    state.selected = data;
    state.month = new Date(Number(data.slice(0, 4)), Number(data.slice(5, 7)) - 1, 1);
    saveLocalSnapshot();
    render();

    try {
      const sb = sbClient();
      if (!sb) throw new Error('Supabase indisponível');
      const { error } = await sb.from('lau_agenda').insert({ data, horario: hora || null, titulo: texto });
      if (error) throw error;
      await load(true);
      render();
      msg('Compromisso salvo na agenda 💗');
    } catch (err) {
      console.warn('[Agenda Lau v94] salvo local:', err);
      msg('Salvei aqui também; quando o Supabase responder, sincroniza.');
    }
  }

  async function addNote() {
    const texto = ($('agendaV94Rotina')?.value || '').trim();
    if (!texto) return msg('Escreve uma notinha primeiro ✨');
    const data = state.selected || todayISO();
    const item = { localId: `rotina-${Date.now()}`, tipo: 'rotina', data, hora: '', texto, created_at: new Date().toISOString() };
    state.rows.push(item);
    saveLocalSnapshot();
    render();

    try {
      const sb = sbClient();
      if (!sb) throw new Error('Supabase indisponível');
      const { error } = await sb.from('lau_agenda').insert({ data, horario: null, titulo: '__rotina_dia__', rotina: texto });
      if (error) throw error;
      await load(true);
      render();
      msg('Notinha guardada na agenda ✨');
    } catch (err) {
      console.warn('[Agenda Lau v94] notinha local:', err);
      msg('Notinha salva localmente por segurança.');
    }
  }

  async function removeItem(identifier) {
    const id = String(identifier || '');
    const item = state.rows.find((r) => String(r.id || r.localId) === id);
    if (!item) return;
    state.rows = state.rows.filter((r) => String(r.id || r.localId) !== id);
    saveLocalSnapshot();
    render();

    if (item.id) {
      try {
        const sb = sbClient();
        if (sb) {
          const { error } = await sb.from('lau_agenda').delete().eq('id', item.id);
          if (error) throw error;
          await load(true);
          render();
        }
      } catch (err) {
        console.warn('[Agenda Lau v94] remover remoto:', err);
        msg('Removi da tela, mas confere depois se saiu do Supabase.');
      }
    }
  }

  function bind() {
    const root = state.host;
    if (!root) return;
    const dateInput = $('agendaV94Date');
    if (dateInput) {
      dateInput.addEventListener('change', () => {
        state.selected = dateInput.value || todayISO();
        const [y, m] = state.selected.split('-').map(Number);
        if (y && m) state.month = new Date(y, m - 1, 1);
        render();
      });
    }
    const textInput = $('agendaV94Text');
    if (textInput) {
      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addCommitment(); }
      });
    }
    qsa('[data-agenda-v94-save]', root).forEach((btn) => btn.addEventListener('click', addCommitment));
    qsa('[data-agenda-v94-save-note]', root).forEach((btn) => btn.addEventListener('click', addNote));
    qsa('[data-agenda-v94-today]', root).forEach((btn) => btn.addEventListener('click', () => {
      state.selected = todayISO();
      state.month = new Date();
      render();
    }));
    qsa('[data-agenda-v94-month]', root).forEach((btn) => btn.addEventListener('click', () => {
      const delta = Number(btn.dataset.agendaV94Month || 0);
      state.month = new Date(state.month.getFullYear(), state.month.getMonth() + delta, 1);
      render();
    }));
    qsa('[data-agenda-v94-date]', root).forEach((btn) => btn.addEventListener('click', () => {
      state.selected = btn.dataset.agendaV94Date || state.selected;
      render();
    }));
    qsa('[data-agenda-v94-del]', root).forEach((btn) => btn.addEventListener('click', () => removeItem(btn.dataset.agendaV94Del)));
  }

  async function show(host) {
    state.host = host;
    host.classList.add('lauos-agenda-v94-host');
    if (!state.rows.length) host.innerHTML = '<div class="lauos-agenda-v94-loading">Carregando agendinha... 🗓️</div>';
    await load(false);
    render();
  }

  window.LauOSAgendaLauV94 = { show, load, render };
})();
