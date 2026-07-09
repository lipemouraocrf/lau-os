/* LauOS v85 - lado do Namorado isolado de verdade
   Não depende do cantinho antigo para Hoje, Agenda, Blog e Cartas. */
(function () {
  'use strict';

  const V85 = {
    page: 'hoje',
    agendaMonth: new Date(),
    agendaSelected: todayISO(),
    agendaItems: [],
    blogPosts: [],
    letters: [],
    loaded: { agenda: false, blog: false, letters: false }
  };

  const $ = (id) => document.getElementById(id);
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function sbClient() {
    try { return window.sb || window.supabaseClient || window.lauosSupabase || null; }
    catch { return null; }
  }

  function showMessage(text) {
    if (typeof window.showMessage === 'function') window.showMessage(text);
    else console.log('[LauOS]', text);
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

  function nowISO() { return new Date().toISOString(); }

  function dateBR(value) {
    if (!value) return '';
    try {
      const str = String(value);
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [y, m, d] = str.split('-');
        return `${d}/${m}/${y}`;
      }
      return new Date(value).toLocaleString('pt-BR');
    } catch { return String(value || ''); }
  }

  function storageGet(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function normalizeRowId(item, index) {
    return String(item?.id || `local-${index}-${item?.created_at || ''}`);
  }

  function mergeUnique(remote, local, keyFn) {
    const map = new Map();
    [...(remote || []), ...(local || [])].forEach((item, index) => {
      if (!item) return;
      const key = keyFn ? keyFn(item, index) : String(item.id || item.created_at || JSON.stringify(item));
      if (!map.has(key)) map.set(key, item);
    });
    return Array.from(map.values());
  }

  function display(el, show, mode = 'block') {
    if (!el) return;
    el.style.setProperty('display', show ? mode : 'none', 'important');
    el.classList.toggle('hidden', !show);
  }

  function ensureHost() {
    const area = $('namoradoArea');
    if (!area) return null;

    Array.from(area.children).forEach((child) => {
      const keep = child.id === 'namoradoV85Host';
      display(child, keep);
    });
    display($('boyStatusNamoradoEditor'), false);
    display($('v55NotifyCard'), false);

    let host = $('namoradoV85Host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'namoradoV85Host';
      host.className = 'namorado-v85-host';
      area.appendChild(host);
    }
    display(host, true);
    return host;
  }

  function section(title, inner, extra = '') {
    return `<section class="namorado-v85-card ${extra}">
      <div class="namorado-v85-title">${title}</div>
      ${inner}
    </section>`;
  }

  function getStatusSnapshot() {
    const mood = $('currentMood')?.textContent?.trim() || 'Nenhum status salvo ainda.';
    const note = $('moodNoteView')?.textContent?.trim() || '';
    const levels = $('readonlyLevels')?.innerHTML?.trim() || '';
    const protocol = $('protocolBox')?.innerHTML?.trim() || '';
    const history = $('historyList')?.innerHTML?.trim() || '';
    return { mood, note, levels, protocol, history };
  }

  function statusCardHtml() {
    const s = getStatusSnapshot();
    const noteOk = s.note && !/Quando a Lau salvar/i.test(s.note);
    const protocolOk = s.protocol && !/será carregado/i.test(s.protocol);
    const historyOk = s.history && !/Nenhum histórico/i.test(s.history);

    return `<div class="namorado-v85-status-grid">
      <div class="namorado-v85-status-main">
        <span class="namorado-v85-pill">💗 Status da Lau</span>
        <h3>${safe(s.mood)}</h3>
        ${noteOk ? `<p>${safe(s.note)}</p>` : '<p>Quando ela atualizar, aparece aqui pra você cuidar direitinho.</p>'}
        <button type="button" class="namorado-v85-btn" data-v85-refresh-status>Atualizar status 💙</button>
      </div>
      <div class="namorado-v85-status-levels">
        <span class="namorado-v85-pill">📊 Níveis</span>
        <div class="namorado-v85-levels-inner">${s.levels || '<div class="namorado-v85-empty">Sem níveis salvos ainda.</div>'}</div>
      </div>
      <div class="namorado-v85-status-protocol">
        <span class="namorado-v85-pill">🫶 Protocolo</span>
        <div>${protocolOk ? s.protocol : 'Aguardando um status da Lau pra montar o protocolo fofo.'}</div>
      </div>
      <div class="namorado-v85-status-history">
        <span class="namorado-v85-pill">🕰️ Histórico</span>
        <div>${historyOk ? s.history : '<div class="namorado-v85-empty">Nenhum histórico ainda.</div>'}</div>
      </div>
    </div>`;
  }

  function renderHoje() {
    const host = ensureHost();
    if (!host) return;
    host.innerHTML = `
      <div class="namorado-v85-head">
        <div>
          <h2>💙 Central do Namorado</h2>
          <p>Status completo da Lau, níveis e cuidados do dia.</p>
        </div>
      </div>
      ${section('Hoje da Lau', statusCardHtml(), 'namorado-v85-status-card')}
    `;
    bindHoje();
    // Puxa atualização do core antigo e re-renderiza sem depender dele visualmente.
    try {
      const maybe = window.carregarHumorLau?.();
      if (maybe && typeof maybe.then === 'function') maybe.then(() => { if (V85.page === 'hoje') renderHoje(); }).catch(() => {});
      else setTimeout(() => { if (V85.page === 'hoje') renderHoje(); }, 350);
    } catch {}
  }

  function bindHoje() {
    qsa('[data-v85-refresh-status]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Atualizando...';
        try { await window.carregarHumorLau?.(); } catch {}
        renderHoje();
      });
    });
  }

  function normalizeAgendaItem(row) {
    const data = row?.data || row?.date || row?.dia || '';
    const horario = row?.horario || row?.hora || row?.time || '';
    let titulo = row?.titulo || row?.texto || row?.descricao || row?.title || '';
    const rotina = row?.rotina || '';
    const isRotina = titulo === '__rotina_dia__' || !!rotina;
    if (titulo === '__rotina_dia__') titulo = rotina || row?.texto || 'Rotina do dia';
    return {
      ...row,
      id: row?.id || `${data}-${horario}-${titulo}`,
      data,
      horario,
      titulo: titulo || (isRotina ? 'Rotina do dia' : 'Compromisso'),
      texto: row?.texto || row?.descricao || rotina || titulo || '',
      isRotina
    };
  }

  async function loadAgenda(force = false) {
    if (V85.loaded.agenda && !force) return V85.agendaItems;
    let remote = [];
    const sb = sbClient();
    if (sb) {
      try {
        const { data, error } = await sb.from('lau_agenda').select('*').order('data', { ascending: true });
        if (error) throw error;
        remote = data || [];
      } catch (err) {
        console.warn('[LauOS v85] Agenda Supabase falhou:', err);
      }
    }
    let local = [];
    try { if (typeof window.lerAgendaLau === 'function') local = window.lerAgendaLau() || []; } catch {}
    local = mergeUnique(local, storageGet('lauraos_agenda_items', []), (i, idx) => normalizeRowId(i, idx));
    V85.agendaItems = mergeUnique(remote, local, (i, idx) => normalizeRowId(i, idx)).map(normalizeAgendaItem).filter((i) => i.data);
    V85.loaded.agenda = true;
    return V85.agendaItems;
  }

  function monthLabel(date) {
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  function agendaItemsForDay(day) {
    return V85.agendaItems.filter((item) => item.data === day).sort((a, b) => String(a.horario || '99:99').localeCompare(String(b.horario || '99:99')));
  }

  function agendaCalendarHtml() {
    const y = V85.agendaMonth.getFullYear();
    const m = V85.agendaMonth.getMonth();
    const first = new Date(y, m, 1).getDay();
    const total = new Date(y, m + 1, 0).getDate();
    const daysWithData = new Set(V85.agendaItems.map((i) => i.data));
    let cells = '';
    for (let i = 0; i < first; i++) cells += '<button class="namorado-v85-day is-empty" type="button" disabled></button>';
    for (let d = 1; d <= total; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cls = ['namorado-v85-day'];
      if (iso === todayISO()) cls.push('is-today');
      if (iso === V85.agendaSelected) cls.push('is-selected');
      if (daysWithData.has(iso)) cls.push('has-data');
      cells += `<button class="${cls.join(' ')}" type="button" data-v85-day="${iso}">${d}</button>`;
    }
    return `<div class="namorado-v85-calendar">
      <div class="namorado-v85-calendar-head">
        <button type="button" data-v85-month="-1">‹</button>
        <strong>${safe(monthLabel(V85.agendaMonth))}</strong>
        <button type="button" data-v85-month="1">›</button>
      </div>
      <div class="namorado-v85-week"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>
      <div class="namorado-v85-days">${cells}</div>
    </div>`;
  }

  function agendaDayHtml() {
    const itens = agendaItemsForDay(V85.agendaSelected);
    if (!itens.length) return `<div class="namorado-v85-day-details"><h3>${dateBR(V85.agendaSelected)}</h3><div class="namorado-v85-empty">Nada salvo para esse dia ainda.</div></div>`;
    return `<div class="namorado-v85-day-details"><h3>${dateBR(V85.agendaSelected)}</h3>${itens.map((item) => `
      <div class="namorado-v85-agenda-item ${item.isRotina ? 'is-rotina' : ''}">
        <strong>${item.isRotina ? '🌸 Rotina' : '🗓️ ' + safe(item.horario || 'Sem horário')}</strong>
        <span>${safe(item.texto || item.titulo).replaceAll('\n', '<br>')}</span>
      </div>`).join('')}</div>`;
  }

  async function renderAgenda(force = false) {
    const host = ensureHost();
    if (!host) return;
    host.innerHTML = `
      <div class="namorado-v85-head"><div><h2>🗓️ Agenda da Lau</h2><p>Escolha um dia pra ver compromissos e rotina.</p></div></div>
      ${section('Calendário', '<div class="namorado-v85-loading-line">Carregando agenda...</div>', 'namorado-v85-agenda-card')}
    `;
    await loadAgenda(force);
    if (V85.page !== 'agenda') return;
    host.innerHTML = `
      <div class="namorado-v85-head"><div><h2>🗓️ Agenda da Lau</h2><p>Escolha um dia pra ver compromissos e rotina.</p></div><button type="button" class="namorado-v85-btn soft" data-v85-refresh-agenda>Atualizar</button></div>
      ${section('Calendário', `<div class="namorado-v85-agenda-layout">${agendaCalendarHtml()}${agendaDayHtml()}</div>`, 'namorado-v85-agenda-card')}
    `;
    bindAgenda();
  }

  function bindAgenda() {
    qsa('[data-v85-day]').forEach((btn) => btn.addEventListener('click', () => {
      V85.agendaSelected = btn.dataset.v85Day;
      const [y, m] = V85.agendaSelected.split('-').map(Number);
      V85.agendaMonth = new Date(y, m - 1, 1);
      renderAgenda(false);
    }));
    qsa('[data-v85-month]').forEach((btn) => btn.addEventListener('click', () => {
      V85.agendaMonth = new Date(V85.agendaMonth.getFullYear(), V85.agendaMonth.getMonth() + Number(btn.dataset.v85Month || 0), 1);
      renderAgenda(false);
    }));
    qsa('[data-v85-refresh-agenda]').forEach((btn) => btn.addEventListener('click', () => renderAgenda(true)));
  }

  async function loadBlog(force = false) {
    if (V85.loaded.blog && !force) return V85.blogPosts;
    let remote = [];
    const sb = sbClient();
    if (sb) {
      try {
        const { data, error } = await sb.from('namorado_blog').select('*').order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        remote = data || [];
      } catch (err) { console.warn('[LauOS v85] Blog namorado Supabase falhou:', err); }
    }
    V85.blogPosts = mergeUnique(remote, storageGet('lauos_v55_blog_namorado', []), (i, idx) => normalizeRowId(i, idx));
    V85.loaded.blog = true;
    return V85.blogPosts;
  }

  async function saveBlogPost() {
    const titulo = ($('v85BlogTitulo')?.value || '').trim() || 'Recado do namorado';
    const texto = ($('v85BlogTexto')?.value || '').trim();
    if (!texto) return showMessage('Escreve o post antes, vida 💙');
    const payload = { titulo, texto };
    let saved = null;
    const sb = sbClient();
    if (sb) {
      try {
        const { data, error } = await sb.from('namorado_blog').insert(payload).select('*').single();
        if (error) throw error;
        saved = data;
      } catch (err) { console.warn('[LauOS v85] salvar blog falhou:', err); }
    }
    if (!saved) saved = { id: 'local-' + Date.now(), created_at: nowISO(), ...payload };
    const local = storageGet('lauos_v55_blog_namorado', []);
    storageSet('lauos_v55_blog_namorado', [saved, ...local].slice(0, 120));
    V85.loaded.blog = false;
    showMessage('Post salvo no blog do namorado 💙');
    renderBlog(true);
  }

  function blogCard(post) {
    return `<article class="namorado-v85-post">
      <h3>${safe(post.titulo || 'Recado do namorado')}</h3>
      <small>💙 ${safe(dateBR(post.created_at))}</small>
      <p>${safe(post.texto || '').replaceAll('\n', '<br>')}</p>
    </article>`;
  }

  async function renderBlog(force = false) {
    const host = ensureHost();
    if (!host) return;
    await loadBlog(force);
    host.innerHTML = `
      <div class="namorado-v85-head"><div><h2>📝 Blog do Namorado</h2><p>Um espaço seu pra escrever pra Lau ler depois.</p></div></div>
      ${section('Novo post', `
        <div class="namorado-v85-form">
          <input id="v85BlogTitulo" placeholder="Título do post" />
          <textarea id="v85BlogTexto" placeholder="Escreve pra ela aqui..."></textarea>
          <button type="button" class="namorado-v85-btn" data-v85-save-blog>Publicar para a Lau 💙</button>
        </div>`, 'namorado-v85-blog-form')}
      ${section('Posts', V85.blogPosts.length ? `<div class="namorado-v85-post-list">${V85.blogPosts.map(blogCard).join('')}</div>` : '<div class="namorado-v85-empty">Nenhum post do namorado ainda.</div>', 'namorado-v85-blog-list')}
    `;
    qs('[data-v85-save-blog]', host)?.addEventListener('click', saveBlogPost);
  }

  async function loadLetters(force = false) {
    if (V85.loaded.letters && !force) return V85.letters;
    let remote = [];
    const sb = sbClient();
    if (sb) {
      try {
        const { data, error } = await sb.from('lau_cartinhas').select('*').order('created_at', { ascending: false }).limit(160);
        if (error) throw error;
        remote = data || [];
      } catch (err) { console.warn('[LauOS v85] Cartas Supabase falhou:', err); }
    }
    V85.letters = mergeUnique(remote, storageGet('lauos_v55_cartas', []), (i, idx) => normalizeRowId(i, idx));
    V85.loaded.letters = true;
    return V85.letters;
  }

  function letterOpen(letter) {
    return !letter.abrir_em || String(letter.abrir_em) <= todayISO();
  }

  async function saveLetter() {
    const titulo = ($('v85CartaTitulo')?.value || '').trim() || 'Cartinha';
    const abrir_em = $('v85CartaData')?.value || todayISO();
    const texto = ($('v85CartaTexto')?.value || '').trim();
    const destino = $('v85CartaDestino')?.value || 'Lau';
    if (!texto) return showMessage('Escreve a cartinha primeiro 💌');
    const payload = { titulo, texto, abrir_em, destino, autor: 'Namorado' };
    let saved = null;
    const sb = sbClient();
    if (sb) {
      try {
        const { data, error } = await sb.from('lau_cartinhas').insert(payload).select('*').single();
        if (error) throw error;
        saved = data;
      } catch (err) { console.warn('[LauOS v85] salvar carta falhou:', err); }
    }
    if (!saved) saved = { id: 'local-' + Date.now(), created_at: nowISO(), ...payload };
    const local = storageGet('lauos_v55_cartas', []);
    storageSet('lauos_v55_cartas', [saved, ...local].slice(0, 160));
    V85.loaded.letters = false;
    showMessage('Cartinha guardada 💌');
    renderCartas(true);
  }

  function letterCard(letter) {
    const aberto = letterOpen(letter);
    return `<article class="namorado-v85-letter ${aberto ? '' : 'is-locked'}">
      <div class="namorado-v85-letter-lock">${aberto ? '💌' : '🔒'}</div>
      <h3>${safe(letter.titulo || 'Cartinha')}</h3>
      <small>Para ${safe(letter.destino || 'Lau')} · ${letter.abrir_em ? 'abre em ' + safe(dateBR(letter.abrir_em)) : 'liberada agora'}</small>
      <p>${aberto ? safe(letter.texto || '').replaceAll('\n', '<br>') : 'Essa cartinha ainda está trancada.'}</p>
    </article>`;
  }

  async function renderCartas(force = false) {
    const host = ensureHost();
    if (!host) return;
    await loadLetters(force);
    host.innerHTML = `
      <div class="namorado-v85-head"><div><h2>💌 Cartas</h2><p>Cartinhas dos dois, salvas no LauOS.</p></div></div>
      ${section('Nova carta', `
        <div class="namorado-v85-form namorado-v85-letter-form">
          <input id="v85CartaTitulo" placeholder="Título da carta" />
          <div class="namorado-v85-row">
            <select id="v85CartaDestino"><option value="Lau">Para Lau</option><option value="Namorado">Para Namorado</option></select>
            <input id="v85CartaData" type="date" />
          </div>
          <textarea id="v85CartaTexto" placeholder="Escreve a cartinha aqui..."></textarea>
          <button type="button" class="namorado-v85-btn" data-v85-save-letter>Guardar cartinha 💌</button>
        </div>`, 'namorado-v85-letter-compose')}
      ${section('Cartinhas salvas', V85.letters.length ? `<div class="namorado-v85-letter-list">${V85.letters.map(letterCard).join('')}</div>` : '<div class="namorado-v85-empty">Nenhuma cartinha ainda.</div>', 'namorado-v85-letters')}
    `;
    qs('[data-v85-save-letter]', host)?.addEventListener('click', saveLetter);
  }

  function show(page) {
    V85.page = page || 'hoje';
    document.body.classList.add('namorado-v85-active');
    if (V85.page === 'agenda') return renderAgenda(false);
    if (V85.page === 'blog') return renderBlog(false);
    if (V85.page === 'cartas') return renderCartas(false);
    return renderHoje();
  }

  window.LauOSNamoradoV85 = {
    show,
    refreshHoje: renderHoje,
    renderAgenda: () => renderAgenda(true),
    renderBlog: () => renderBlog(true),
    renderCartas: () => renderCartas(true)
  };
})();
