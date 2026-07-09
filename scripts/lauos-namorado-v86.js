/* LauOS v86 - Lado do Namorado separado e estável.
   Regras do usuário:
   - Hoje: só vê status atual da Lau.
   - Namorado: atualiza o status dele.
   - Fotos/Momentos/Planos: usam módulos compartilhados.
   - Agenda: lê a agenda da Lau.
   - Blog: lê o blog da Lau.
   - Blog do Namorado: escreve o blog dele para aparecer na aba Namorado da Lau.
   - Desejos: vê desejos da Lau.
   - Cartas: ambos escrevem; cada um só remove a própria carta.
   - Músicas: mesma área compartilhada dos dois.
*/
(function () {
  'use strict';

  const V86 = {
    page: 'hoje',
    agendaMonth: new Date(),
    agendaSelected: todayISO(),
    cache: {
      lauStatus: [],
      boyStatus: [],
      agenda: [],
      lauBlog: [],
      boyBlog: [],
      desejos: [],
      cartas: [],
      musicas: []
    }
  };

  const $ = (id) => document.getElementById(id);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const qs = (sel, root = document) => root.querySelector(sel);

  const EMOJIS = ['💖', '🥹', '😂', '🔥', '💙', '😍'];
  const BOY_MOODS = ['🥰 Com saudade', '😴 Cansado', '😤 Estressado', '💙 Carente', '🔥 Motivado', '🤍 Tranquilo', '🍟 Com fome', '🫠 Precisando dela'];
  const BOY_LEVELS = [
    ['saudade', '🥺 Saudade', 80],
    ['cansaco', '😴 Cansaço', 30],
    ['carinho', '💙 Vontade de carinho', 70],
    ['stress', '😤 Stress', 20]
  ];

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

  function nl2br(text) { return safe(text || '').replace(/\n/g, '<br>'); }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function nowISO() { return new Date().toISOString(); }

  function dateBR(value) {
    if (!value) return '';
    try {
      const s = String(value);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split('-');
        return `${d}/${m}/${y}`;
      }
      return new Date(value).toLocaleString('pt-BR');
    } catch { return String(value || ''); }
  }


  function normalizeDateISO(value) {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (br) return `${br[3]}-${String(br[2]).padStart(2, '0')}-${String(br[1]).padStart(2, '0')}`;
    try {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } catch {}
    return raw;
  }

  function asArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  function localAgendaSources() {
    const rows = [];
    try { rows.push(...asArray(window.lerAgendaLau?.())); } catch {}
    try {
      const rotinas = window.lerRotinasLau?.() || {};
      Object.entries(rotinas).forEach(([data, item]) => {
        asArray(item).forEach((rotina, idx) => rows.push({
          id: `rotina-${data}-${idx}`,
          data,
          titulo: '__rotina_dia__',
          rotina: typeof rotina === 'string' ? rotina : (rotina?.texto || rotina?.rotina || ''),
          isRotina: true
        }));
      });
    } catch {}
    rows.push(...asArray(storageGet('lauraos_agenda_items', [])));
    rows.push(...asArray(storageGet('lauos_v55_agenda', [])));
    return rows;
  }

  function musicUrl(raw) {
    const url = String(raw || '').trim();
    if (!url) return '';
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  function musicPlatform(url) {
    const u = String(url || '');
    if (/spotify/i.test(u)) return 'Spotify';
    if (/youtube|youtu\.be/i.test(u)) return 'YouTube';
    if (/deezer/i.test(u)) return 'Deezer';
    if (/soundcloud/i.test(u)) return 'SoundCloud';
    return 'Link';
  }

  function extrairSpotifyEmbed(url) {
    const texto = String(url || '').trim();
    if (!texto) return '';
    const match = texto.match(/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/i);
    if (!match) return '';
    return `https://open.spotify.com/embed/${match[1].toLowerCase()}/${match[2]}?utm_source=generator`;
  }

  function tituloMusica(url, titulo) {
    const clean = String(titulo || '').trim();
    if (clean) return clean;
    const u = String(url || '');
    if (u.includes('/playlist/')) return 'Playlist dos dois';
    if (u.includes('/album/')) return 'Álbum salvo';
    return 'Música salva';
  }

  function musicEmbedCardHtml(m) {
    const url = musicUrl(m?.url || m?.link || m?.href || '');
    const embed = m?.embed_url || m?.embedUrl || extrairSpotifyEmbed(url);
    const titulo = tituloMusica(url, m?.titulo || m?.nome || m?.title);
    const podeExcluir = m?.id && !String(m.id).startsWith('local-');
    if (!embed) {
      return `<article class="namorado-v86-music-fallback">
        <div><strong>🎵 ${safe(titulo)}</strong><small>${safe(musicPlatform(url))} · ${safe(dateBR(m?.created_at))}</small></div>
        ${url ? `<a class="namorado-v86-open-link" href="${safe(url)}" target="_blank" rel="noopener noreferrer">Abrir</a>` : ''}
      </article>`;
    }
    return `<article class="music-card-item namorado-v86-spotify-card">
      <div class="music-card-top">
        <div>
          <div>🎵 ${safe(titulo)}</div>
          <small>${m?.created_at ? safe(dateBR(m.created_at)) : 'música do LauOS'}</small>
        </div>
        ${podeExcluir ? `<button class="music-delete-btn" type="button" data-v86-delete-music="${safe(m.id)}" aria-label="Excluir música">×</button>` : ''}
      </div>
      <div class="music-embed-wrap namorado-v86-spotify-embed">
        <iframe src="${safe(embed)}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>
      </div>
    </article>`;
  }

  function storageGet(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function rowKey(item, index) {
    return String(item?.id || item?.created_at || item?.data || item?.titulo || item?.texto || `local-${index}`);
  }

  function mergeRows(remote, local) {
    const map = new Map();
    [...(remote || []), ...(local || [])].forEach((item, index) => {
      if (!item) return;
      const key = rowKey(item, index);
      if (!map.has(key)) map.set(key, item);
    });
    return Array.from(map.values());
  }

  function display(el, show, mode = 'block') {
    if (!el) return;
    el.style.setProperty('display', show ? mode : 'none', 'important');
    el.classList.toggle('hidden', !show);
  }

  function hideOldBoyArea() {
    const area = $('namoradoArea');
    if (!area) return null;
    Array.from(area.children).forEach((child) => {
      const keep = child.id === 'namoradoV86Host';
      display(child, keep);
    });
    display($('boyStatusNamoradoEditor'), false);
    let host = $('namoradoV86Host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'namoradoV86Host';
      host.className = 'namorado-v86-host';
      area.appendChild(host);
    }
    display(host, true);
    return host;
  }

  function hideOldLauNamorado() {
    const area = $('lauraArea');
    if (!area) return null;
    [
      area.querySelector('.role-header'),
      $('moodOptions'),
      area.querySelector('.levels-grid'),
      $('moodNote'),
      area.querySelector('.save-mood-btn'),
      $('lauCorner'),
      $('boyStatusLauView')
    ].forEach((el) => display(el, false));
    let host = $('namoradoV86ForLau');
    if (!host) {
      host = document.createElement('div');
      host.id = 'namoradoV86ForLau';
      host.className = 'namorado-v86-host namorado-v86-for-lau';
      area.appendChild(host);
    }
    display(host, true);
    return host;
  }

  function section(title, html, cls = '') {
    return `<section class="namorado-v86-card ${cls}">
      <div class="namorado-v86-card-title">${title}</div>
      ${html}
    </section>`;
  }

  async function selectRows(table, opts = {}) {
    const sb = sbClient();
    if (!sb) return null;
    try {
      let q = sb.from(table).select(opts.select || '*');
      if (opts.eq) Object.entries(opts.eq).forEach(([k, v]) => { q = q.eq(k, v); });
      if (opts.order) q = q.order(opts.order, { ascending: !!opts.ascending });
      if (opts.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn(`[LauOS v86] select ${table} falhou:`, err);
      return null;
    }
  }

  async function insertRow(table, payload, localKey) {
    const sb = sbClient();
    if (sb) {
      try {
        const { data, error } = await sb.from(table).insert(payload).select('*').single();
        if (error) throw error;
        return data || { id: Date.now(), created_at: nowISO(), ...payload };
      } catch (err) {
        console.warn(`[LauOS v86] insert ${table} falhou:`, err);
      }
    }
    const row = { id: 'local-' + Date.now() + '-' + Math.random().toString(16).slice(2), created_at: nowISO(), ...payload };
    if (localKey) {
      const local = storageGet(localKey, []);
      storageSet(localKey, [row, ...local].slice(0, 250));
    }
    return row;
  }

  async function deleteRow(table, id, localKey) {
    const isLocal = String(id).startsWith('local-');
    const sb = sbClient();
    if (sb && !isLocal) {
      try {
        const { error } = await sb.from(table).delete().eq('id', id);
        if (error) throw error;
      } catch (err) {
        console.warn(`[LauOS v86] delete ${table} falhou:`, err);
        return false;
      }
    }
    if (localKey) storageSet(localKey, storageGet(localKey, []).filter((item) => String(item.id) !== String(id)));
    return true;
  }

  function normalizeLevels(niveis) {
    if (!niveis) return {};
    if (typeof niveis === 'string') {
      try { return JSON.parse(niveis); } catch { return {}; }
    }
    return niveis || {};
  }

  function levelsHtml(niveis, blue = false) {
    const obj = normalizeLevels(niveis);
    const labels = {
      fofura: '🥰 Fofura', estresse: '😡 Estresse', carencia: '🥺 Carência', fome: '🍟 Fome',
      sono: '😴 Sono', sensibilidade: '🍫 Sensibilidade', carinho: '💖 Carinho', conversa: '🗣️ Conversa',
      saudade: '🥺 Saudade', cansaco: '😴 Cansaço', stress: '😤 Stress'
    };
    const entries = Object.entries(obj).filter(([, value]) => value !== null && value !== undefined && value !== '');
    if (!entries.length) return '<div class="namorado-v86-empty">Sem níveis salvos ainda.</div>';
    return `<div class="namorado-v86-levels ${blue ? 'blue' : ''}">${entries.map(([key, value]) => {
      const num = Math.max(0, Math.min(100, Number(value) || 0));
      return `<div class="namorado-v86-level">
        <div><span>${safe(labels[key] || key)}</span><strong>${num}%</strong></div>
        <div class="namorado-v86-bar"><i style="width:${num}%"></i></div>
      </div>`;
    }).join('')}</div>`;
  }

  async function loadLauStatus() {
    let remote = await selectRows('lau_status', { order: 'created_at', ascending: false, limit: 12 });
    if (!remote) remote = storageGet('lauos_v86_lau_status_cache', []);
    else storageSet('lauos_v86_lau_status_cache', remote);
    V86.cache.lauStatus = remote || [];
    return V86.cache.lauStatus;
  }

  async function loadBoyStatus() {
    let remote = await selectRows('namorado_status', { order: 'created_at', ascending: false, limit: 12 });
    if (!remote) remote = storageGet('lauos_v86_boy_status', []);
    else storageSet('lauos_v86_boy_status', remote);
    V86.cache.boyStatus = remote || [];
    return V86.cache.boyStatus;
  }

  function lauStatusCard(status, full = true) {
    if (!status) {
      return `<div class="namorado-v86-empty big">A Lau ainda não mandou status hoje.</div>`;
    }
    return `<article class="namorado-v86-status">
      <div class="namorado-v86-status-head">
        <span class="namorado-v86-pill pink">💗 Status atual da Lau</span>
        <small>${safe(dateBR(status.created_at))}</small>
      </div>
      <h2>${safe(status.humor || 'Status da Lau')}</h2>
      <p>${nl2br(status.observacao || 'Ela não escreveu observação.')}</p>
      ${full ? levelsHtml(status.niveis) : ''}
      ${full && status.protocolo ? `<div class="namorado-v86-protocol"><strong>Protocolo recomendado:</strong><br>${nl2br(status.protocolo)}</div>` : ''}
    </article>`;
  }

  async function renderHoje() {
    const host = hideOldBoyArea();
    if (!host) return;
    host.innerHTML = `<div class="namorado-v86-loading">Carregando status da Lau... 💙</div>`;
    await loadLauStatus();
    const atual = V86.cache.lauStatus[0];
    host.innerHTML = `
      <div class="namorado-v86-page-head"><h2>💙 Hoje</h2><span>somente o status atual da Lau</span></div>
      ${section('Status atual dela', lauStatusCard(atual, true), 'status-only')}
    `;
  }

  function boyStatusPreview(status) {
    if (!status) return '<div class="namorado-v86-empty">Nenhum status seu enviado ainda.</div>';
    return `<article class="namorado-v86-status boy">
      <div class="namorado-v86-status-head"><span class="namorado-v86-pill blue">💙 Seu último status</span><small>${safe(dateBR(status.created_at))}</small></div>
      <h2>${safe(status.humor || 'Status')}</h2>
      <p>${nl2br(status.observacao || '')}</p>
      ${levelsHtml(status.niveis, true)}
    </article>`;
  }

  async function renderNamoradoStatus() {
    const host = hideOldBoyArea();
    if (!host) return;
    await loadBoyStatus();
    const ultimo = V86.cache.boyStatus[0];
    host.innerHTML = `
      <div class="namorado-v86-page-head"><h2>🫶 Namorado</h2><span>atualize seu status para a Lau ver</span></div>
      ${section('Meu status', `
        <div class="namorado-v86-status-editor">
          <div class="namorado-v86-mood-grid">${BOY_MOODS.map((m, i) => `<button type="button" data-v86-boy-mood="${safe(m)}" class="${i === 0 ? 'selected' : ''}">${safe(m)}</button>`).join('')}</div>
          <div class="namorado-v86-levels-edit">${BOY_LEVELS.map(([key, label, val]) => `<label><span>${safe(label)}</span><strong id="v86BoyLevel_${key}_value">${val}%</strong><input type="range" min="0" max="100" value="${val}" id="v86BoyLevel_${key}" data-v86-boy-level="${key}"></label>`).join('')}</div>
          <textarea id="v86BoyStatusNote" placeholder="Ex: hoje tô com saudade, meio cansado, mas pensando em você..."></textarea>
          <button type="button" class="namorado-v86-btn blue" data-v86-save-boy-status>Enviar status para a Lau 💙</button>
        </div>
      `, 'boy-editor')}
      ${section('Último enviado', boyStatusPreview(ultimo), 'boy-last')}
    `;
    bindBoyStatus();
  }

  function bindBoyStatus() {
    let selected = qsa('[data-v86-boy-mood]').find((b) => b.classList.contains('selected'))?.dataset.v86BoyMood || BOY_MOODS[0];
    qsa('[data-v86-boy-mood]').forEach((btn) => btn.addEventListener('click', () => {
      selected = btn.dataset.v86BoyMood;
      qsa('[data-v86-boy-mood]').forEach((b) => b.classList.toggle('selected', b === btn));
    }));
    qsa('[data-v86-boy-level]').forEach((input) => input.addEventListener('input', () => {
      const out = $(`v86BoyLevel_${input.dataset.v86BoyLevel}_value`);
      if (out) out.textContent = `${input.value}%`;
    }));
    qs('[data-v86-save-boy-status]')?.addEventListener('click', async () => {
      const niveis = {};
      qsa('[data-v86-boy-level]').forEach((input) => { niveis[input.dataset.v86BoyLevel] = Number(input.value || 0); });
      const observacao = ($('v86BoyStatusNote')?.value || '').trim();
      await insertRow('namorado_status', { humor: selected, observacao, niveis }, 'lauos_v86_boy_status');
      showMessage('Status enviado para a Lau 💙');
      renderNamoradoStatus();
    });
  }

  async function loadAgenda() {
    let remote = await selectRows('lau_agenda', { order: 'data', ascending: true, limit: 700 });
    if (!remote) remote = [];
    const mixed = mergeRows(remote, localAgendaSources());
    V86.cache.agenda = mixed
      .map(normalizeAgendaItem)
      .filter((item) => item.data)
      .sort((a, b) => String(a.data + ' ' + (a.horario || '')).localeCompare(String(b.data + ' ' + (b.horario || ''))));
    return V86.cache.agenda;
  }

  function normalizeAgendaItem(row) {
    const data = normalizeDateISO(row?.data || row?.date || row?.dia || row?.data_agenda || '');
    const horario = row?.horario || row?.hora || row?.time || '';
    const rotina = row?.rotina || '';
    let titulo = row?.titulo || row?.title || row?.texto || row?.descricao || '';
    const isRotina = titulo === '__rotina_dia__' || !!rotina || !!row?.isRotina;
    if (titulo === '__rotina_dia__') titulo = 'Rotina do dia';
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

  function monthLabel(date) { return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); }

  function agendaForDay(day) {
    return V86.cache.agenda.filter((item) => item.data === day).sort((a, b) => String(a.horario || '99:99').localeCompare(String(b.horario || '99:99')));
  }

  function agendaCalendarHtml() {
    const y = V86.agendaMonth.getFullYear();
    const m = V86.agendaMonth.getMonth();
    const first = new Date(y, m, 1).getDay();
    const total = new Date(y, m + 1, 0).getDate();
    const dataDays = new Set(V86.cache.agenda.map((item) => item.data));
    let cells = '';
    for (let i = 0; i < first; i++) cells += '<button type="button" class="namorado-v86-day empty" disabled></button>';
    for (let d = 1; d <= total; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const cls = ['namorado-v86-day'];
      if (iso === todayISO()) cls.push('today');
      if (iso === V86.agendaSelected) cls.push('selected');
      if (dataDays.has(iso)) cls.push('has-data');
      const count = V86.cache.agenda.filter((item) => item.data === iso).length;
      cells += `<button type="button" class="${cls.join(' ')}" data-v86-day="${iso}" title="${count ? `${count} item(ns) salvo(s)` : 'Nada salvo'}"><span>${d}</span>${count ? `<b>${count}</b>` : ''}</button>`;
    }
    return `<div class="namorado-v86-calendar" id="v86AgendaCalendar">
      <div class="namorado-v86-calendar-head"><button type="button" data-v86-month="-1">‹</button><strong id="v86AgendaMonthLabel">${safe(monthLabel(V86.agendaMonth))}</strong><button type="button" data-v86-month="1">›</button></div>
      <div class="namorado-v86-week"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>
      <div class="namorado-v86-days">${cells}</div>
      <div class="namorado-v86-agenda-legend"><i></i> dias marcados têm agenda ou rotina da Lau</div>
    </div>`;
  }

  function agendaDetailsHtml() {
    const items = agendaForDay(V86.agendaSelected);
    if (!items.length) return `<div class="namorado-v86-empty">Nada salvo para ${safe(dateBR(V86.agendaSelected))}.</div>`;
    return `<div class="namorado-v86-agenda-list">${items.map((item) => `<div class="namorado-v86-agenda-item">
      <strong>${item.isRotina ? '🌸 Rotina' : '🗓️ ' + safe(item.horario || 'Sem horário')}</strong>
      <span>${nl2br(item.texto || item.titulo)}</span>
    </div>`).join('')}</div>`;
  }

  function refreshAgendaDetailsOnly() {
    const panel = $('v86AgendaDayPanel');
    if (!panel) return;
    panel.innerHTML = `<h3>${safe(dateBR(V86.agendaSelected))}</h3>${agendaDetailsHtml()}`;
    const host = $('namoradoV86Host') || document;
    qsa('[data-v86-day]', host).forEach((btn) => btn.classList.toggle('selected', btn.dataset.v86Day === V86.agendaSelected));
  }

  function refreshAgendaCalendarOnly() {
    const calendar = $('v86AgendaCalendar');
    if (calendar) calendar.outerHTML = agendaCalendarHtml();
    refreshAgendaDetailsOnly();
    bindAgenda();
  }

  async function renderAgenda() {
    const host = hideOldBoyArea();
    if (!host) return;
    host.innerHTML = '<div class="namorado-v86-loading">Carregando agenda da Lau... 🗓️</div>';
    await loadAgenda();
    host.innerHTML = `
      <div class="namorado-v86-page-head"><h2>🗓️ Agenda da Lau</h2><span>somente visualização</span></div>
      ${section('Calendário', `<div class="namorado-v86-agenda-grid">${agendaCalendarHtml()}<div class="namorado-v86-day-panel" id="v86AgendaDayPanel"><h3>${safe(dateBR(V86.agendaSelected))}</h3>${agendaDetailsHtml()}</div></div>`, 'agenda')}
    `;
    bindAgenda();
  }

  function bindAgenda() {
    const host = $('namoradoV86Host') || document;
    qsa('[data-v86-day]', host).forEach((btn) => {
      if (btn.dataset.v86Bound) return;
      btn.dataset.v86Bound = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        V86.agendaSelected = btn.dataset.v86Day;
        refreshAgendaDetailsOnly();
      });
    });
    qsa('[data-v86-month]', host).forEach((btn) => {
      if (btn.dataset.v86Bound) return;
      btn.dataset.v86Bound = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        V86.agendaMonth = new Date(V86.agendaMonth.getFullYear(), V86.agendaMonth.getMonth() + Number(btn.dataset.v86Month || 0), 1);
        refreshAgendaCalendarOnly();
      });
    });
  }

  async function loadLauBlog() {
    let remote = await selectRows('lau_blog', { order: 'created_at', ascending: false, limit: 100 });
    if (!remote) remote = storageGet('lauos_v55_blog_lau', []);
    V86.cache.lauBlog = remote || [];
    return V86.cache.lauBlog;
  }

  async function loadBoyBlog() {
    let remote = await selectRows('namorado_blog', { order: 'created_at', ascending: false, limit: 100 });
    if (!remote) remote = storageGet('lauos_v55_blog_namorado', []);
    V86.cache.boyBlog = remote || [];
    return V86.cache.boyBlog;
  }

  function blogPostHtml(post, theme = 'pink', allowDelete = false) {
    const id = safe(post.id || '');
    const canDelete = allowDelete && id;
    return `<article class="namorado-v86-post ${theme} ${canDelete ? 'has-delete' : ''}">
      ${canDelete ? `<button type="button" class="namorado-v86-delete" data-v86-delete-boy-blog="${id}" aria-label="Excluir post">×</button>` : ''}
      <h3>${safe(post.titulo || 'Querido blog')}</h3>
      <small>${theme === 'blue' ? '💙 Namorado' : '💗 Lau'} · ${safe(dateBR(post.created_at))}</small>
      <p>${nl2br(post.texto || '')}</p>
    </article>`;
  }

  async function renderBlogLau() {
    const host = hideOldBoyArea();
    if (!host) return;
    await loadLauBlog();
    host.innerHTML = `
      <div class="namorado-v86-page-head"><h2>📝 Blog da Lau</h2><span>leitura do que ela publicou</span></div>
      ${section('Posts da Lau', V86.cache.lauBlog.length ? `<div class="namorado-v86-posts">${V86.cache.lauBlog.map((p) => blogPostHtml(p, 'pink')).join('')}</div>` : '<div class="namorado-v86-empty">A Lau ainda não publicou no blog.</div>', 'blog')}
    `;
  }

  async function renderBlogNamorado() {
    const host = hideOldBoyArea();
    if (!host) return;
    await loadBoyBlog();
    host.innerHTML = `
      <div class="namorado-v86-page-head"><h2>✍️ Blog do Namorado</h2><span>escreva para aparecer na aba Namorado dela</span></div>
      ${section('Novo post', `<div class="namorado-v86-form"><input id="v86BoyBlogTitle" placeholder="Título do post"><textarea id="v86BoyBlogText" placeholder="Escreve pra Lau aqui..."></textarea><button type="button" class="namorado-v86-btn blue" data-v86-save-boy-blog>Publicar para a Lau 💙</button></div>`, 'blog-editor')}
      ${section('Meus posts', V86.cache.boyBlog.length ? `<div class="namorado-v86-posts">${V86.cache.boyBlog.map((p) => blogPostHtml(p, 'blue', true)).join('')}</div>` : '<div class="namorado-v86-empty">Nenhum post seu ainda.</div>', 'blog')}
    `;
    qs('[data-v86-save-boy-blog]', host)?.addEventListener('click', async () => {
      const titulo = ($('v86BoyBlogTitle')?.value || '').trim() || 'Recado do namorado';
      const texto = ($('v86BoyBlogText')?.value || '').trim();
      if (!texto) return showMessage('Escreve o post primeiro 💙');
      await insertRow('namorado_blog', { titulo, texto }, 'lauos_v55_blog_namorado');
      showMessage('Post salvo para a Lau ler 💙');
      renderBlogNamorado();
    });
    qsa('[data-v86-delete-boy-blog]', host).forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Excluir esse post do seu blog?')) return;
      const ok = await deleteRow('namorado_blog', btn.dataset.v86DeleteBoyBlog, 'lauos_v55_blog_namorado');
      if (ok) showMessage('Post removido 💙');
      else showMessage('Não consegui remover esse post agora.');
      renderBlogNamorado();
    }));
  }

  async function loadDesejos() {
    let remote = await selectRows('lau_desejos', { order: 'created_at', ascending: false, limit: 120 });
    if (!remote) remote = storageGet('lauraos_wishes', []);
    V86.cache.desejos = (remote || []).map((item, index) => ({ ...item, id: item.id || `local-${index}`, texto: item.texto || item.title || item.titulo || '', concluido: !!(item.concluido || item.finalizado), created_at: item.created_at || item.data }));
    return V86.cache.desejos;
  }

  async function renderDesejos() {
    const host = hideOldBoyArea();
    if (!host) return;
    await loadDesejos();
    host.innerHTML = `
      <div class="namorado-v86-page-head"><h2>🌟 Desejos da Lau</h2><span>somente visualização</span></div>
      ${section('Lista dela', V86.cache.desejos.length ? `<div class="namorado-v86-list">${V86.cache.desejos.map((d) => `<article class="namorado-v86-mini ${d.concluido ? 'done' : ''}"><strong>${safe(d.texto)}</strong><small>${d.concluido ? '✅ concluído' : '✨ em aberto'} · ${safe(dateBR(d.created_at))}</small></article>`).join('')}</div>` : '<div class="namorado-v86-empty">Nenhum desejo da Lau salvo ainda.</div>', 'desejos')}
    `;
  }

  async function loadCartas() {
    let remote = await selectRows('lau_cartinhas', { order: 'created_at', ascending: false, limit: 160 });
    if (!remote) remote = storageGet('lauos_v55_cartas', []);
    V86.cache.cartas = remote || [];
    return V86.cache.cartas;
  }

  function canOpenLetter(letter) { return !letter.abrir_em || String(letter.abrir_em) <= todayISO(); }
  function currentAutor() { return (localStorage.getItem('lauraos_usuario') || 'Namorado') === 'Lau' ? 'Lau' : 'Namorado'; }

  function letterHtml(letter) {
    const autor = letter.autor || 'Lau';
    const mine = autor === currentAutor();
    const open = canOpenLetter(letter);
    const id = safe(letter.id || '');
    const destino = safe(letter.destino || (autor === 'Namorado' ? 'Lau' : 'Namorado'));
    const textoCarta = open ? nl2br(letter.texto || '') : 'Essa cartinha ainda está trancada. Quando chegar o dia, ela abre com todo o drama e fofura. 🔒';
    const statusTexto = open ? 'Clique para abrir a carta' : `Abre em ${safe(dateBR(letter.abrir_em))}`;
    const preview = safe((letter.texto || '').slice(0, 120));
    return `<article class="namorado-v86-letter namorado-v86-letter-envelope ${open ? 'can-open' : 'locked'}" data-v86-letter-card="${id}" data-v86-letter-openable="${open ? '1' : '0'}">
      ${mine ? `<button type="button" class="namorado-v86-delete" data-v86-delete-letter="${id}">×</button>` : ''}
      <div class="namorado-v86-letter-meta">
        <span class="namorado-v86-pill ${autor === 'Namorado' ? 'blue' : 'pink'}">${autor === 'Namorado' ? '💙 Namorado' : '💗 Lau'}</span>
        <span class="namorado-v86-letter-to">Para ${destino}</span>
      </div>
      <h3>${safe(letter.titulo || 'Cartinha')}</h3>
      <small>${letter.abrir_em ? 'abre em ' + safe(dateBR(letter.abrir_em)) : 'liberada'} · ${safe(dateBR(letter.created_at))}</small>
      <div class="namorado-v86-envelope-scene ${open ? '' : 'locked'}">
        <button type="button" class="namorado-v86-envelope-toggle" data-v86-open-letter="${id}" ${open ? '' : 'disabled'}>
          <div class="namorado-v86-envelope-stage">
            <div class="namorado-v86-envelope-glow"></div>
            <div class="namorado-v86-envelope-shell">
              <div class="namorado-v86-envelope-back"></div>
              <div class="namorado-v86-envelope-paper-preview"></div>
              <div class="namorado-v86-envelope-front"></div>
              <div class="namorado-v86-envelope-flap"></div>
              <div class="namorado-v86-envelope-seal"><span>💗</span></div>
            </div>
          </div>
          <span class="namorado-v86-envelope-hint">${statusTexto}</span>
          ${preview ? `<span class="namorado-v86-envelope-preview-text">${preview}${(letter.texto || '').length > 120 ? '…' : ''}</span>` : ''}
        </button>
        <template class="namorado-v86-letter-template">
          <div class="namorado-v86-letter-modal-paper-inner">
            <div class="namorado-v86-letter-modal-head">
              <span class="namorado-v86-letter-modal-stamp">💌</span>
              <div>
                <strong>${safe(letter.titulo || 'Cartinha')}</strong>
                <small>Para ${destino} · ${safe(dateBR(letter.created_at || letter.abrir_em || ''))}</small>
              </div>
            </div>
            <div class="namorado-v86-letter-modal-body">${textoCarta}</div>
            <div class="namorado-v86-letter-modal-sign">Com carinho, ${safe(autor)} ✨</div>
          </div>
        </template>
      </div>
    </article>`;
  }

  async function renderCartas() {
    const host = hideOldBoyArea();
    if (!host) return;
    await loadCartas();
    host.innerHTML = `
      <div class="namorado-v86-page-head"><h2>💌 Cartas</h2><span>cada um só remove a própria carta</span></div>
      ${section('Nova carta', `<div class="namorado-v86-form"><input id="v86LetterTitle" placeholder="Título da carta"><div class="namorado-v86-row"><select id="v86LetterDest"><option value="Lau">Para Lau</option><option value="Namorado">Para Namorado</option></select><input id="v86LetterDate" type="date"></div><textarea id="v86LetterText" placeholder="Escreve a cartinha aqui..."></textarea><button type="button" class="namorado-v86-btn blue" data-v86-save-letter>Guardar cartinha 💌</button></div>`, 'letter-editor')}
      ${section('Cartinhas', V86.cache.cartas.length ? `<div class="namorado-v86-letters">${V86.cache.cartas.map(letterHtml).join('')}</div>` : '<div class="namorado-v86-empty">Nenhuma carta ainda.</div>', 'letters')}
    `;
    qs('[data-v86-save-letter]', host)?.addEventListener('click', async () => {
      const titulo = ($('v86LetterTitle')?.value || '').trim() || 'Cartinha';
      const texto = ($('v86LetterText')?.value || '').trim();
      const abrir_em = $('v86LetterDate')?.value || todayISO();
      const destino = $('v86LetterDest')?.value || 'Lau';
      if (!texto) return showMessage('Escreve a carta primeiro 💌');
      await insertRow('lau_cartinhas', { titulo, texto, abrir_em, destino, autor: currentAutor() }, 'lauos_v55_cartas');
      showMessage('Cartinha salva 💌');
      renderCartas();
    });
    qsa('[data-v86-delete-letter]', host).forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Remover sua cartinha?')) return;
      await deleteRow('lau_cartinhas', btn.dataset.v86DeleteLetter, 'lauos_v55_cartas');
      renderCartas();
    }));
    qsa('[data-v86-open-letter]', host).forEach((btn) => {
      const toggle = () => {
        if (btn.disabled) return showMessage('Essa carta ainda está fechadinha 🔒');
        const card = btn.closest('[data-v86-letter-card]');
        if (!card) return;
        card.classList.add('is-opening');
        window.setTimeout(() => {
          card.classList.remove('is-opening');
          openLetterModalV86(btn.dataset.v86OpenLetter);
        }, 620);
      };
      btn.addEventListener('click', toggle);
      btn.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          toggle();
        }
      });
    });
  }

  function ensureLetterModalV86() {
    let modal = $('v86LetterModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'v86LetterModal';
    modal.className = 'namorado-v86-letter-modal';
    modal.innerHTML = `<div class="namorado-v86-letter-modal-dialog"><button class="namorado-v86-delete" type="button" onclick="window.fecharCartaModalV86()">×</button><div class="namorado-v86-letter-modal-paper" id="v86LetterModalBody"></div></div>`;
    modal.addEventListener('click', (e) => { if (e.target === modal) window.fecharCartaModalV86(); });
    document.body.appendChild(modal);
    return modal;
  }
  function openLetterModalV86(id) {
    const card = document.querySelector(`[data-v86-letter-card="${String(id).replace(/"/g, '&quot;')}"]`);
    if (!card) return;
    const template = card.querySelector('.namorado-v86-letter-template');
    const modal = ensureLetterModalV86();
    const body = $('v86LetterModalBody');
    if (body && template) body.innerHTML = template.innerHTML;
    modal.classList.add('show');
    document.body.classList.add('v86-modal-open');
  }
  window.fecharCartaModalV86 = function () {
    const modal = $('v86LetterModal');
    if (modal) modal.classList.remove('show');
    document.body.classList.remove('v86-modal-open');
  };

  async function loadMusicas() {
    let remote = await selectRows('lau_musicas', { order: 'created_at', ascending: false, limit: 120 });
    if (!remote) remote = [];
    V86.cache.musicas = mergeRows(remote, storageGet('lauraos_music', []));
    return V86.cache.musicas;
  }

  async function renderMusicas() {
    const host = hideOldBoyArea();
    if (!host) return;
    await loadMusicas();
    host.innerHTML = `
      <div class="namorado-v86-page-head"><h2>🎵 Músicas</h2><span>área compartilhada dos dois</span></div>
      ${section('Adicionar música', `<div class="namorado-v86-form namorado-v86-music-form"><input id="v86MusicTitle" placeholder="Nome opcional. Ex: nossa música"><input id="v86MusicUrl" placeholder="Cole o link do Spotify aqui"><button type="button" class="namorado-v86-btn blue" data-v86-save-music>Adicionar música 🎵</button></div>`, 'music-editor')}
      ${section('Playlist', V86.cache.musicas.length ? `<div class="music-card-list namorado-v86-spotify-list">${V86.cache.musicas.map(musicEmbedCardHtml).join('')}</div>` : '<div class="namorado-v86-empty">Nenhuma música salva ainda.</div>', 'music')}
    `;
    qs('[data-v86-save-music]', host)?.addEventListener('click', async () => {
      const url = ($('v86MusicUrl')?.value || '').trim();
      const embed_url = extrairSpotifyEmbed(url);
      if (!url) return showMessage('Cola o link da música 🎵');
      if (!embed_url) return showMessage('Cola um link válido do Spotify primeiro 🎵');
      const titulo = tituloMusica(url, $('v86MusicTitle')?.value || '');
      await insertRow('lau_musicas', { titulo, url, embed_url, autor: currentAutor() }, 'lauraos_music');
      showMessage('Música salva 🎵');
      renderMusicas();
    });
    qsa('[data-v86-delete-music]', host).forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Excluir essa música?')) return;
      await deleteRow('lau_musicas', btn.dataset.v86DeleteMusic, 'lauraos_music');
      showMessage('Música removida 🎵');
      renderMusicas();
    }));
  }

  async function renderLauNamorado() {
    const host = hideOldLauNamorado();
    if (!host) return;
    host.innerHTML = '<div class="namorado-v86-loading">Carregando status e blog do namorado... 💙</div>';
    await Promise.all([loadBoyStatus(), loadBoyBlog()]);
    const ultimo = V86.cache.boyStatus[0];
    host.innerHTML = `
      <div class="namorado-v86-page-head pink"><h2>💙 Namorado</h2><span>status e blog dele</span></div>
      ${section('Status dele', boyStatusPreview(ultimo), 'boy-last')}
      ${section('Blog do Namorado', V86.cache.boyBlog.length ? `<div class="namorado-v86-posts">${V86.cache.boyBlog.map((p) => blogPostHtml(p, 'blue')).join('')}</div>` : '<div class="namorado-v86-empty">Ele ainda não escreveu no blog.</div>', 'blog')}
    `;
  }

  function show(page) {
    V86.page = page || 'hoje';
    document.body.classList.add('namorado-v86-active');
    const map = {
      hoje: renderHoje,
      namorado: renderNamoradoStatus,
      agenda: renderAgenda,
      blog: renderBlogLau,
      'blog-namorado': renderBlogNamorado,
      blogNamorado: renderBlogNamorado,
      desejos: renderDesejos,
      cartas: renderCartas,
      musicas: renderMusicas
    };
    return (map[V86.page] || renderHoje)();
  }

  window.LauOSNamoradoV86 = {
    show,
    showForLau: renderLauNamorado,
    reload: () => show(V86.page || 'hoje')
  };
})();
