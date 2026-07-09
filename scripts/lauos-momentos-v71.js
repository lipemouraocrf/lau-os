/* LauOS v70 - Momentos românticos, compactos e isolados */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const EMOJIS = ['💖', '🥹', '😂', '🔥', '💙', '😍'];
  const LOCAL_KEY = 'lauos_momentos_v70_backup';
  const LOCAL_REACT_KEY = 'lauos_momentos_v70_reacoes';
  let booted = false;
  let originalDesktop = null;
  let originalMobile = null;
  let originalCantinho = null;
  let originalCantinhoNamorado = null;
  let momentsCache = [];
  let reactionsCache = {};
  let selectedMomentFile = null;
  let selectedMomentPreview = '';
  let currentModalMoment = null;

  function safe(text) {
    return String(text || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[c]);
  }

  function client() {
    if (window.sb) return window.sb;
    if (window.supabaseClient) return window.supabaseClient;
    try { if (typeof sb !== 'undefined' && sb) return sb; } catch {}
    try {
      if (window.supabase && typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined') {
        const created = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.sb = created;
        window.supabaseClient = created;
        return created;
      }
    } catch {}
    return null;
  }

  function currentUser() {
    return localStorage.getItem('lauraos_usuario') || (document.body.classList.contains('namorado-mode') ? 'Namorado' : 'Lau');
  }

  function autorLabel(value) {
    return value === 'Namorado' ? 'Namorado' : 'Lau';
  }

  function todayInput() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function formatDate(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      const [y, m, d] = String(value).split('-');
      return `${d}/${m}/${y}`;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function message(text) {
    if (typeof window.showMessage === 'function') window.showMessage(text);
    else console.log('[LauOS]', text);
  }

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || localStorage.getItem('lauos_momentos_v69_backup') || localStorage.getItem('lauos_momentos_v68_backup') || '[]') || []; }
    catch { return []; }
  }

  function writeLocal(list) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify((list || []).slice(0, 160))); } catch {}
  }

  function readLocalReactions() {
    try { return JSON.parse(localStorage.getItem(LOCAL_REACT_KEY) || '{}') || {}; }
    catch { return {}; }
  }

  function writeLocalReactions(map) {
    try { localStorage.setItem(LOCAL_REACT_KEY, JSON.stringify(map || {})); } catch {}
  }

  function publicUrlFromPath(path) {
    const sb = client();
    if (!sb || !path) return '';
    try { return sb.storage.from('lau-fotos').getPublicUrl(path).data.publicUrl || ''; }
    catch { return ''; }
  }

  function normalize(item, index) {
    if (!item) return null;
    const fotoPath = item.foto_path || item.fotoPath || '';
    const fotoUrl = item.foto_url || item.fotoUrl || item.foto || item.image_url || item.url || publicUrlFromPath(fotoPath) || '';
    return {
      id: item.id ?? item.local_id ?? ('local-' + index),
      titulo: item.titulo || item.title || 'Momento',
      data: item.data || item.date || null,
      descricao: item.descricao || item.legenda || item.texto || '',
      autor: autorLabel(item.autor),
      foto_url: fotoUrl,
      foto_path: fotoPath,
      created_at: item.created_at || item.createdAt || null
    };
  }

  function sortMoments(list) {
    return (list || []).slice().sort((a, b) => {
      const da = new Date(a.data || a.created_at || 0).getTime() || 0;
      const db = new Date(b.data || b.created_at || 0).getTime() || 0;
      if (db !== da) return db - da;
      const ca = new Date(a.created_at || 0).getTime() || 0;
      const cb = new Date(b.created_at || 0).getTime() || 0;
      return cb - ca;
    });
  }

  async function loadMoments() {
    const sb = client();
    if (sb) {
      try {
        const { data, error } = await sb.from('lau_momentos').select('*').order('data', { ascending: false }).order('created_at', { ascending: false }).limit(160);
        if (error) throw error;
        momentsCache = sortMoments((data || []).map(normalize).filter(Boolean));
        writeLocal(momentsCache);
        await loadReactions(momentsCache);
        return momentsCache;
      } catch (error) {
        console.warn('[LauOS v69] Momentos em backup local:', error);
      }
    }
    momentsCache = sortMoments(readLocal().map(normalize).filter(Boolean));
    reactionsCache = readLocalReactions();
    return momentsCache;
  }

  function targetId(moment) {
    return String(moment?.id || moment?.foto_path || moment?.created_at || 'local');
  }

  async function loadReactions(moments) {
    reactionsCache = readLocalReactions();
    const ids = (moments || []).map(targetId).filter(Boolean);
    const sb = client();
    if (!sb || !ids.length) return reactionsCache;
    try {
      const { data, error } = await sb.from('lau_reacoes')
        .select('*')
        .eq('alvo_tipo', 'momento')
        .in('alvo_id', ids);
      if (error) throw error;
      const map = {};
      (data || []).forEach((row) => {
        const id = String(row.alvo_id);
        if (!map[id]) map[id] = [];
        map[id].push({ autor: row.autor || '', emoji: row.emoji || '' });
      });
      reactionsCache = map;
      writeLocalReactions(map);
      return map;
    } catch (error) {
      console.warn('[LauOS v69] Reações locais:', error);
      return reactionsCache;
    }
  }

  function reactionsFor(moment) {
    return reactionsCache[targetId(moment)] || [];
  }

  function hasReaction(moment, emoji) {
    const autor = currentUser();
    return reactionsFor(moment).some((r) => r.autor === autor && r.emoji === emoji);
  }

  function reactionCount(moment, emoji) {
    return reactionsFor(moment).filter((r) => r.emoji === emoji).length;
  }

  function ensureRoot() {
    let root = $('lauosMomentosV69') || $('lauosMomentosV67');
    if (root) {
      root.id = 'lauosMomentosV69';
      return root;
    }
    const main = $('mainWindow') || document.querySelector('.window') || document.body;
    root = document.createElement('section');
    root.id = 'lauosMomentosV69';
    root.setAttribute('aria-live', 'polite');
    main.appendChild(root);
    return root;
  }

  function showRoot() {
    ensureRoot();
    document.body.classList.remove('lauos-v66-media-active');
    const media = $('lauosMediaV66');
    if (media) media.innerHTML = '';
    document.body.classList.add('lauos-v69-momentos-active');
    document.body.classList.remove('lauos-v67-momentos-active');
  }

  function hideRoot() {
    document.body.classList.remove('lauos-v69-momentos-active', 'lauos-v67-momentos-active');
    const root = $('lauosMomentosV69') || $('lauosMomentosV67');
    if (root) root.innerHTML = '';
  }

  function markNav() {
    document.querySelectorAll('#desktopTabbar button[data-desktop-page], #mobileTabbar button[data-mobile-page]').forEach((btn) => {
      const page = btn.dataset.desktopPage || btn.dataset.mobilePage;
      btn.classList.toggle('active', page === 'momentos');
    });
  }

  function headerHtml(count) {
    return `
      <div class="lauos-v69-head">
        <div class="lauos-v69-titlebox">
          <div class="lauos-v69-icon">🎞️</div>
          <h2>Momentos</h2>
        </div>
        <div class="lauos-v69-count">${count} momento${count === 1 ? '' : 's'}</div>
      </div>`;
  }

  function composerHtml() {
    const user = currentUser();
    return `
      <form class="lauos-v69-composer" id="lauosV69MomentForm">
        <div class="lauos-v69-row">
          <input class="lauos-v69-input" id="lauosV69MomentTitle" placeholder="Título" maxlength="80">
          <input class="lauos-v69-input lauos-v69-date" id="lauosV69MomentDate" type="date" value="${todayInput()}">
          <span class="lauos-v69-author">${user === 'Namorado' ? '💙' : '💗'} ${safe(user)}</span>
        </div>
        <textarea class="lauos-v69-textarea" id="lauosV69MomentText" placeholder="Legenda"></textarea>
        <div class="lauos-v69-photo-preview" id="lauosV69MomentPreview" hidden></div>
        <div class="lauos-v69-actions">
          <label class="lauos-v69-file-label" for="lauosV69MomentFile">Escolher foto 📸</label>
          <input class="lauos-v69-file-input" id="lauosV69MomentFile" type="file" accept="image/*">
          <button class="lauos-v69-btn lauos-v69-primary" type="submit">Publicar 💖</button>
          <button class="lauos-v69-btn lauos-v69-light" type="button" id="lauosV69ClearPhoto">Tirar foto</button>
          <span class="lauos-v69-status" id="lauosV69MomentStatus" hidden></span>
        </div>
      </form>`;
  }

  function postHtml(moment) {
    const id = targetId(moment);
    const date = formatDate(moment.data);
    const created = formatDateTime(moment.created_at);
    const hasPhoto = Boolean(moment.foto_url);
    const deleteBtn = `<button class="lauos-v69-delete" type="button" data-v69-delete="${safe(id)}" title="Excluir">×</button>`;
    const photo = hasPhoto ? `
      <button class="lauos-v69-photo" type="button" data-v69-open="${safe(id)}" aria-label="Abrir foto do momento">
        <img src="${safe(moment.foto_url)}" alt="${safe(moment.titulo)}" loading="lazy">
      </button>` : '';
    const letter = !hasPhoto ? `<div class="lauos-v69-letter-mark">💌</div>` : '';

    return `
      <article class="lauos-v69-post ${hasPhoto ? 'has-photo' : 'no-photo'}" data-v69-post="${safe(id)}">
        ${deleteBtn}
        ${photo}
        <div class="lauos-v69-body">
          ${letter}
          <h3>${safe(moment.titulo)}</h3>
          <div class="lauos-v69-meta">
            ${date ? `<span>📅 ${safe(date)}</span>` : ''}
            <span>${moment.autor === 'Namorado' ? '💙' : '💗'} ${safe(moment.autor)}</span>
          </div>
          ${moment.descricao ? `<p>${safe(moment.descricao)}</p>` : ''}
          <div class="lauos-v69-reactions" aria-label="Reações">
            ${EMOJIS.map((emoji) => {
              const count = reactionCount(moment, emoji);
              const label = count ? `${emoji} ${count}` : emoji;
              return `<button class="lauos-v69-reaction ${hasReaction(moment, emoji) ? 'is-on' : ''}" type="button" data-v69-react="${safe(emoji)}" data-v69-target="${safe(id)}">${safe(label)}</button>`;
            }).join('')}
          </div>
          ${created ? `<small class="lauos-v69-created">salvo ${safe(created)}</small>` : ''}
        </div>
      </article>`;
  }

  async function renderMomentos() {
    showRoot();
    markNav();
    const root = ensureRoot();
    root.innerHTML = '<div class="lauos-v69-shell"><div class="lauos-v69-empty">Carregando...</div></div>';
    const moments = await loadMoments();
    root.innerHTML = `
      <div class="lauos-v69-shell">
        ${headerHtml(moments.length)}
        ${composerHtml()}
        ${moments.length ? `<div class="lauos-v69-feed">${moments.map(postHtml).join('')}</div>` : `<div class="lauos-v69-empty">Nenhum momento ainda.</div>`}
      </div>`;

    const fileInput = $('lauosV69MomentFile');
    fileInput?.addEventListener('change', handlePhotoSelection);
    $('lauosV69ClearPhoto')?.addEventListener('click', clearSelectedPhoto);
    $('lauosV69MomentForm')?.addEventListener('submit', saveMoment);

    root.querySelectorAll('[data-v69-react]').forEach((btn) => {
      btn.addEventListener('click', () => toggleReaction(btn.dataset.v69Target, btn.dataset.v69React));
    });

    root.querySelectorAll('[data-v69-delete]').forEach((btn) => {
      btn.addEventListener('click', () => deleteMoment(btn.dataset.v69Delete));
    });

    root.querySelectorAll('[data-v69-open]').forEach((el) => {
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        openModal(el.dataset.v69Open);
      });
    });

    root.querySelectorAll('[data-v69-post]').forEach((post) => {
      post.addEventListener('click', (event) => {
        if (event.target.closest('button, input, textarea, select, label')) return;
        const id = post.dataset.v69Post;
        const moment = momentsCache.find((m) => targetId(m) === String(id));
        if (moment?.foto_url) openModal(id);
      });
    });

    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function handlePhotoSelection() {
    const file = this.files && this.files[0];
    const status = $('lauosV69MomentStatus');
    const preview = $('lauosV69MomentPreview');
    selectedMomentFile = file || null;
    selectedMomentPreview = '';
    if (!file) {
      if (status) { status.textContent = ''; status.hidden = true; }
      if (preview) { preview.hidden = true; preview.innerHTML = ''; }
      return;
    }
    const url = URL.createObjectURL(file);
    selectedMomentPreview = url;
    if (status) { status.textContent = 'foto pronta'; status.hidden = false; }
    if (preview) {
      preview.hidden = false;
      preview.innerHTML = `<img src="${safe(url)}" alt="Prévia"><span>foto escolhida</span>`;
    }
  }

  function clearSelectedPhoto() {
    const input = $('lauosV69MomentFile');
    if (input) input.value = '';
    if (selectedMomentPreview) URL.revokeObjectURL(selectedMomentPreview);
    selectedMomentFile = null;
    selectedMomentPreview = '';
    const status = $('lauosV69MomentStatus');
    const preview = $('lauosV69MomentPreview');
    if (status) { status.textContent = ''; status.hidden = true; }
    if (preview) { preview.hidden = true; preview.innerHTML = ''; }
  }

  async function uploadPhoto(file) {
    const sb = client();
    if (!file) return { foto_url: '', foto_path: '' };
    if (!sb) throw new Error('Supabase indisponível para subir foto.');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const folder = currentUser() === 'Namorado' ? 'momentos/namorado' : 'momentos/lau';
    const path = `${folder}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
    const upload = await sb.storage.from('lau-fotos').upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (upload.error) throw upload.error;
    const publicUrl = sb.storage.from('lau-fotos').getPublicUrl(path).data.publicUrl;
    if (!publicUrl) throw new Error('Não consegui gerar URL pública da foto.');
    return { foto_url: publicUrl, foto_path: path };
  }

  async function saveMoment(event) {
    event.preventDefault();
    const title = $('lauosV69MomentTitle')?.value.trim() || '';
    const date = $('lauosV69MomentDate')?.value || todayInput();
    const text = $('lauosV69MomentText')?.value.trim() || '';
    const file = selectedMomentFile || $('lauosV69MomentFile')?.files?.[0] || null;
    const status = $('lauosV69MomentStatus');

    if (!title && !text && !file) {
      message('Coloca um título, legenda ou foto primeiro 💌');
      return;
    }

    const payload = {
      titulo: title || 'Momento',
      data: date,
      descricao: text,
      autor: currentUser(),
      foto_url: '',
      foto_path: ''
    };

    try {
      if (status) { status.textContent = file ? 'subindo foto...' : 'salvando...'; status.hidden = false; }
      if (file) Object.assign(payload, await uploadPhoto(file));

      const sb = client();
      if (sb) {
        const { error } = await sb.from('lau_momentos').insert(payload);
        if (error) throw error;
      }
      const local = readLocal();
      local.unshift(Object.assign({ local_id: 'local-' + Date.now(), created_at: new Date().toISOString() }, payload));
      writeLocal(local);

      if (file && !payload.foto_url) throw new Error('A foto foi escolhida, mas não foi salva no momento.');
      selectedMomentFile = null;
      message('Momento publicado 💖');
      await renderMomentos();
    } catch (error) {
      console.error('[LauOS v70] Erro ao publicar momento:', error);
      message('Não consegui publicar. Erro: ' + (error?.message || 'confere o Supabase.'));
      if (status) { status.textContent = 'erro ao salvar'; status.hidden = false; }
    }
  }

  async function deleteMoment(id) {
    if (!id) return;
    if (!confirm('Excluir esse momento?')) return;
    const moment = momentsCache.find((m) => String(m.id) === String(id));
    const sb = client();

    try {
      if (sb && !String(id).startsWith('local-')) {
        if (moment?.foto_path) {
          try { await sb.storage.from('lau-fotos').remove([moment.foto_path]); } catch {}
        }
        await sb.from('lau_reacoes').delete().eq('alvo_tipo', 'momento').eq('alvo_id', String(id));
        const { error } = await sb.from('lau_momentos').delete().eq('id', id);
        if (error) throw error;
      }
      writeLocal(readLocal().filter((m) => String(m.id || m.local_id) !== String(id)));
      message('Momento excluído.');
      await renderMomentos();
    } catch (error) {
      console.error('[LauOS v69] Erro ao excluir momento:', error);
      message('Não consegui excluir esse momento.');
    }
  }

  async function toggleReaction(id, emoji) {
    if (!id || !emoji) return;
    const autor = currentUser();
    const list = reactionsCache[id] || [];
    const exists = list.some((r) => r.autor === autor && r.emoji === emoji);

    reactionsCache[id] = exists
      ? list.filter((r) => !(r.autor === autor && r.emoji === emoji))
      : list.concat({ autor, emoji });
    writeLocalReactions(reactionsCache);

    const sb = client();
    if (sb && !String(id).startsWith('local-')) {
      try {
        if (exists) {
          await sb.from('lau_reacoes')
            .delete()
            .eq('alvo_tipo', 'momento')
            .eq('alvo_id', String(id))
            .eq('autor', autor)
            .eq('emoji', emoji);
        } else {
          await sb.from('lau_reacoes').insert({ alvo_tipo: 'momento', alvo_id: String(id), autor, emoji });
        }
      } catch (error) {
        console.warn('[LauOS v69] Reação ficou local:', error);
      }
    }
    renderMomentos();
  }

  function ensureModal() {
    let modal = $('lauosV69MomentModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'lauosV69MomentModal';
    modal.className = 'lauos-v69-modal';
    modal.innerHTML = `
      <div class="lauos-v69-modal-card" role="dialog" aria-modal="true">
        <button class="lauos-v69-modal-close" type="button" id="lauosV69MomentModalClose">×</button>
        <img class="lauos-v69-modal-img" id="lauosV69MomentModalImg" alt="Momento ampliado">
        <div class="lauos-v69-modal-info" id="lauosV69MomentModalInfo"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    $('lauosV69MomentModalClose')?.addEventListener('click', closeModal);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
    return modal;
  }

  function openModal(id) {
    const moment = momentsCache.find((m) => targetId(m) === String(id));
    if (!moment?.foto_url) return;
    currentModalMoment = moment;
    ensureModal();
    $('lauosV69MomentModalImg').src = moment.foto_url;
    $('lauosV69MomentModalInfo').innerHTML = `
      <strong>${safe(moment.titulo)}</strong>
      <span>${formatDate(moment.data)} • ${safe(moment.autor)}</span>
      ${moment.descricao ? `<p>${safe(moment.descricao)}</p>` : ''}`;
    $('lauosV69MomentModal').classList.add('show');
  }

  function closeModal() {
    ensureModal().classList.remove('show');
    currentModalMoment = null;
  }

  function patchNavigation() {
    if (booted) return;
    booted = true;
    originalDesktop = window.abrirPaginaDesktop;
    originalMobile = window.abrirPaginaMobile;
    originalCantinho = window.abrirCantinho;
    originalCantinhoNamorado = window.abrirCantinhoNamorado;

    window.abrirPaginaDesktop = function (page) {
      if (page === 'momentos') return renderMomentos();
      hideRoot();
      return typeof originalDesktop === 'function' ? originalDesktop.apply(this, arguments) : undefined;
    };

    window.abrirPaginaMobile = function (page) {
      if (page === 'momentos') return renderMomentos();
      hideRoot();
      return typeof originalMobile === 'function' ? originalMobile.apply(this, arguments) : undefined;
    };

    window.abrirCantinho = function (id) {
      if (id === 'calendarCorner') return renderMomentos();
      hideRoot();
      return typeof originalCantinho === 'function' ? originalCantinho.apply(this, arguments) : undefined;
    };

    window.abrirCantinhoNamorado = function (id) {
      if (id === 'viewMoments') return renderMomentos();
      hideRoot();
      return typeof originalCantinhoNamorado === 'function' ? originalCantinhoNamorado.apply(this, arguments) : undefined;
    };

    window.renderizarMomentosV41 = function () {};
    window.renderizarMomentosV42 = function () {};
    window.renderizarMomentosV43 = function () {};
    window.adicionarMomentoLau = function () { renderMomentos(); };
    window.excluirMomentoLau = function () { renderMomentos(); };
    window.LauOSMomentosV67 = { renderMomentos, loadMoments };
    window.LauOSMomentosV68 = window.LauOSMomentosV67;
    window.LauOSMomentosV69 = window.LauOSMomentosV67;
  }

  function install() {
    ensureRoot();
    ensureModal();
    patchNavigation();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
