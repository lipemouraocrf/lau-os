/* LauOS v73 - une Fotos + Baú em uma aba só e remove Chat/Baú da navegação. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const EMOJIS = ['💖', '🥹', '😂', '🔥', '💙', '😍'];
  const META_KEY = 'lauos_media_meta_v73';
  const OLD_META_KEYS = ['lauos_media_meta_v72', 'lauos_media_meta_v66'];
  const REACTIONS_KEY = 'lauos_media_reacoes_v73';
  const OLD_REACTIONS_KEYS = ['lauos_media_reacoes_v72', 'lauos_media_reacoes_v68'];
  let activePage = null;
  let currentPhoto = null;
  let photoReactionsCache = {};
  let originalDesktop = null;
  let originalMobile = null;
  let originalCantinho = null;
  let booted = false;
  let navObserver = null;

  function safe(text) {
    return String(text || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[c]);
  }

  function user() {
    return localStorage.getItem('lauraos_usuario') || (document.body.classList.contains('namorado-mode') ? 'Namorado' : 'Lau');
  }

  function getSupabase() {
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

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; }
    catch { return fallback; }
  }

  function readMeta() {
    const current = readJson(META_KEY, {});
    for (const key of OLD_META_KEYS) Object.assign(current, readJson(key, {}));
    return current || {};
  }

  function writeMeta(meta) {
    localStorage.setItem(META_KEY, JSON.stringify(meta || {}));
  }

  function readReactions() {
    const merged = {};
    for (const key of OLD_REACTIONS_KEYS) Object.assign(merged, readJson(key, {}));
    Object.assign(merged, readJson(REACTIONS_KEY, {}));
    return merged;
  }

  function writeReactions(map) {
    try { localStorage.setItem(REACTIONS_KEY, JSON.stringify(map || {})); } catch {}
  }

  function photoKey(photo) {
    return String(photo?.id || photo?.path || photo?.url || 'foto');
  }

  function normalizePhoto(photo, index) {
    if (!photo) return null;
    if (typeof photo === 'string') {
      return { id: 'local-' + index, url: photo, titulo: '', legenda: '', created_at: null, path: null };
    }
    return {
      id: photo.id ?? ('local-' + index),
      url: photo.url || photo.publicUrl || photo.src || '',
      titulo: photo.titulo || photo.title || '',
      legenda: photo.legenda || '',
      created_at: photo.created_at || photo.createdAt || null,
      path: photo.path || null
    };
  }

  function getPhotosFromCache() {
    let list = [];
    try {
      if (Array.isArray(window.cacheFotosLau)) list = window.cacheFotosLau;
      else if (typeof cacheFotosLau !== 'undefined' && Array.isArray(cacheFotosLau)) list = cacheFotosLau;
    } catch {}
    return list.map(normalizePhoto).filter((photo) => photo && photo.url);
  }

  async function refreshPhotos() {
    try {
      if (typeof window.carregarFotosSupabase === 'function') await window.carregarFotosSupabase();
    } catch (error) {
      console.warn('[LauOS v73] Não consegui recarregar fotos:', error);
    }
    const photos = getPhotosFromCache();
    await loadPhotoReactions(photos);
    return photos;
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function photoMetaKeys(photo) {
    return [photo?.id, photo?.path, photo?.url].filter(Boolean).map(String);
  }

  function photoMeta(photo) {
    const all = readMeta();
    for (const key of photoMetaKeys(photo)) {
      if (all[key]) return all[key];
    }
    return {};
  }

  function captionFor(photo) {
    const meta = photoMeta(photo);
    return meta.legenda || photo.legenda || '';
  }

  function savePhotoMeta(photo, patch) {
    const meta = readMeta();
    const keys = photoMetaKeys(photo);
    keys.forEach((key) => {
      meta[key] = Object.assign({}, meta[key] || {}, patch || {});
    });
    writeMeta(meta);
  }

  function photoTargetId(photo) {
    return String(photo?.id || photo?.path || photo?.url || 'foto');
  }

  async function loadPhotoReactions(photos) {
    photoReactionsCache = readReactions();
    const ids = (photos || []).map(photoTargetId).filter(Boolean);
    const client = getSupabase();
    if (!client || !ids.length) return photoReactionsCache;
    try {
      const { data, error } = await client.from('lau_reacoes')
        .select('*')
        .eq('alvo_tipo', 'foto')
        .in('alvo_id', ids);
      if (error) throw error;
      const map = {};
      (data || []).forEach((row) => {
        const id = String(row.alvo_id);
        if (!map[id]) map[id] = [];
        map[id].push({ autor: row.autor || '', emoji: row.emoji || '' });
      });
      photoReactionsCache = map;
      writeReactions(map);
    } catch (error) {
      console.warn('[LauOS v73] Reações ficaram locais:', error);
    }
    return photoReactionsCache;
  }

  function reactionsFor(photo) {
    return photoReactionsCache[photoTargetId(photo)] || [];
  }

  function hasReaction(photo, emoji) {
    const autor = user();
    return reactionsFor(photo).some((r) => r.autor === autor && r.emoji === emoji);
  }

  function reactionCount(photo, emoji) {
    return reactionsFor(photo).filter((r) => r.emoji === emoji).length;
  }

  function reactionSummary(photo) {
    const parts = EMOJIS.map((emoji) => {
      const count = reactionCount(photo, emoji);
      return count ? `<span>${safe(emoji)} ${count}</span>` : '';
    }).filter(Boolean).join('');
    return parts ? `<div class="lauos-v72-reactions-small">${parts}</div>` : '';
  }

  function ensureRoot() {
    let root = $('lauosMediaV72');
    if (root) return root;
    const main = $('mainWindow') || document.querySelector('.window') || document.body;
    root = document.createElement('section');
    root.id = 'lauosMediaV72';
    root.setAttribute('aria-live', 'polite');
    main.appendChild(root);
    return root;
  }

  function showRoot() {
    ensureRoot();
    document.body.classList.add('lauos-v72-media-active');
    document.body.classList.remove('lauos-v66-media-active', 'v47-bau-active', 'v49-bau-active', 'v50-bau-active', 'v51-bau-open');
  }

  function hideRoot() {
    document.body.classList.remove('lauos-v72-media-active');
    const root = $('lauosMediaV72');
    if (root) root.innerHTML = '';
    activePage = null;
  }

  function headerHtml(count) {
    return `
      <div class="lauos-v72-head">
        <div class="lauos-v72-titlebox">
          <div class="lauos-v72-icon">📸</div>
          <h2>Fotos</h2>
        </div>
        <div class="lauos-v72-badge">${count} foto${count === 1 ? '' : 's'} ✨</div>
      </div>`;
  }

  function uploaderHtml() {
    return `
      <div class="lauos-v72-uploader">
        <label class="lauos-v72-file-label" for="lauosV72PhotoInput">Adicionar fotos 📁</label>
        <input id="lauosV72PhotoInput" type="file" accept="image/*" multiple>
        <button class="lauos-v72-btn lauos-v72-primary" type="button" id="lauosV72UploadBtn">Guardar 💖</button>
        <span id="lauosV72UploadStatus" class="lauos-v72-status">pronto</span>
      </div>`;
  }

  function photoCard(photo, index) {
    const legenda = captionFor(photo);
    const date = formatDate(photo.created_at);
    const canDelete = photo.id && !String(photo.id).startsWith('local-');
    return `
      <article class="lauos-v72-card" data-v72-photo="${index}" role="button" tabindex="0" aria-label="Abrir foto ${index + 1}">
        ${canDelete ? `<button class="lauos-v72-delete" type="button" data-v72-delete="${safe(photo.id)}" title="Excluir foto">×</button>` : ''}
        <img src="${safe(photo.url)}" alt="Foto ${index + 1}" loading="lazy">
        <div class="lauos-v72-card-meta">
          ${legenda ? `<div class="lauos-v72-caption">${safe(legenda)}</div>` : ''}
          ${date ? `<div class="lauos-v72-date">📅 ${safe(date)}</div>` : ''}
          ${reactionSummary(photo)}
        </div>
      </article>`;
  }

  async function renderFotos() {
    activePage = 'fotos';
    showRoot();
    hideOldNavItems();
    const root = ensureRoot();
    root.innerHTML = '<div class="lauos-v72-shell"><div class="lauos-v72-empty">Carregando fotos...</div></div>';
    const photos = await refreshPhotos();
    root.innerHTML = `
      <div class="lauos-v72-shell">
        ${headerHtml(photos.length)}
        ${uploaderHtml()}
        ${photos.length ? `<div class="lauos-v72-grid">${photos.map(photoCard).join('')}</div>` : `<div class="lauos-v72-empty">Nenhuma foto ainda.</div>`}
      </div>`;

    const input = $('lauosV72PhotoInput');
    const status = $('lauosV72UploadStatus');
    input?.addEventListener('change', () => {
      const n = input.files ? input.files.length : 0;
      status.textContent = n ? `${n} foto${n === 1 ? '' : 's'}` : 'pronto';
    });
    $('lauosV72UploadBtn')?.addEventListener('click', uploadSelectedPhotos);

    root.querySelectorAll('[data-v72-photo]').forEach((card) => {
      const index = Number(card.dataset.v72Photo);
      const open = () => openPhotoModal(photos[index]);
      card.addEventListener('click', open);
      card.addEventListener('keydown', (event) => { if (event.key === 'Enter') open(); });
    });
    root.querySelectorAll('[data-v72-delete]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        deletePhoto(btn.dataset.v72Delete);
      });
    });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  async function uploadSelectedPhotos() {
    const input = $('lauosV72PhotoInput');
    const status = $('lauosV72UploadStatus');
    const client = getSupabase();
    if (!input || !input.files || !input.files.length) return message('Escolhe uma ou mais fotos primeiro 📸');
    if (!client) return message('Supabase não carregou. Reabre o app e tenta de novo.');

    const files = Array.from(input.files).slice(0, 18);
    if (status) status.textContent = 'guardando...';

    for (const file of files) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const folder = user() === 'Namorado' ? 'namorado' : 'lau';
      const path = `${folder}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

      const upload = await client.storage.from('lau-fotos').upload(path, file, { upsert: false });
      if (upload.error) {
        console.error(upload.error);
        if (status) status.textContent = 'erro';
        return message('Erro ao guardar foto. Confere o Storage/policy.');
      }
      const publicUrl = client.storage.from('lau-fotos').getPublicUrl(path).data.publicUrl;
      let insert = await client.from('lau_fotos').insert({ titulo: '', url: publicUrl, path, legenda: '' });
      if (insert.error && String(insert.error.message || '').includes('legenda')) {
        insert = await client.from('lau_fotos').insert({ titulo: '', url: publicUrl, path });
      }
      if (insert.error) {
        console.error(insert.error);
        if (status) status.textContent = 'erro';
        return message('Foto subiu, mas não salvou no banco.');
      }
    }

    input.value = '';
    message('Fotos guardadas 💖');
    await renderFotos();
  }

  async function deletePhoto(id) {
    if (!id) return;
    if (!confirm('Excluir essa foto?')) return;
    const client = getSupabase();
    if (!client) return message('Supabase não carregou.');

    const photos = getPhotosFromCache();
    const photo = photos.find((item) => String(item.id) === String(id));
    if (photo?.path) {
      try { await client.storage.from('lau-fotos').remove([photo.path]); } catch {}
    }
    const del = await client.from('lau_fotos').delete().eq('id', id);
    if (del.error) {
      console.error(del.error);
      return message('Não consegui excluir.');
    }
    message('Foto removida.');
    await renderFotos();
  }

  function ensureModal() {
    let modal = $('lauosMediaModalV72');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'lauosMediaModalV72';
    modal.className = 'lauos-v72-modal';
    modal.innerHTML = `
      <div class="lauos-v72-modal-card" role="dialog" aria-modal="true">
        <div class="lauos-v72-modal-body">
          <div class="lauos-v72-modal-photo"><img id="lauosV72ModalImg" alt="Foto ampliada"></div>
          <aside class="lauos-v72-modal-side">
            <button class="lauos-v72-close" type="button" id="lauosV72ModalClose">×</button>
            <h3>Foto</h3>
            <p id="lauosV72ModalDate"></p>
            <div class="lauos-v72-reaction-row" id="lauosV72ModalReactions"></div>
            <p>Legenda</p>
            <textarea class="lauos-v72-caption-box" id="lauosV72Caption" placeholder="Escreve uma legenda se quiser..."></textarea>
            <button class="lauos-v72-btn lauos-v72-primary" type="button" id="lauosV72SaveCaption" style="margin-top:12px;">Salvar legenda 💌</button>
          </aside>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    $('lauosV72ModalClose')?.addEventListener('click', closeModal);
    $('lauosV72SaveCaption')?.addEventListener('click', saveCaptionFromModal);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
    return modal;
  }

  function openPhotoModal(photo) {
    if (!photo) return;
    currentPhoto = photo;
    const modal = ensureModal();
    $('lauosV72ModalImg').src = photo.url;
    $('lauosV72ModalDate').textContent = formatDate(photo.created_at) ? `📅 ${formatDate(photo.created_at)}` : '';
    $('lauosV72Caption').value = captionFor(photo);
    renderModalReactions();
    modal.classList.add('show');
  }

  function closeModal() {
    ensureModal().classList.remove('show');
    currentPhoto = null;
  }

  function renderModalReactions() {
    const box = $('lauosV72ModalReactions');
    if (!box || !currentPhoto) return;
    box.innerHTML = EMOJIS.map((emoji) => {
      const count = reactionCount(currentPhoto, emoji);
      const label = count ? `${emoji} ${count}` : emoji;
      return `<button type="button" class="lauos-v72-reaction ${hasReaction(currentPhoto, emoji) ? 'is-on' : ''}" data-v72-react="${safe(emoji)}">${safe(label)}</button>`;
    }).join('');
    box.querySelectorAll('[data-v72-react]').forEach((btn) => btn.addEventListener('click', () => toggleReaction(btn.dataset.v72React)));
  }

  async function toggleReaction(emoji) {
    if (!currentPhoto || !emoji) return;
    const id = photoTargetId(currentPhoto);
    const autor = user();
    const list = photoReactionsCache[id] || [];
    const exists = list.some((r) => r.autor === autor && r.emoji === emoji);
    photoReactionsCache[id] = exists
      ? list.filter((r) => !(r.autor === autor && r.emoji === emoji))
      : list.concat({ autor, emoji });
    writeReactions(photoReactionsCache);
    renderModalReactions();
    if (activePage === 'fotos') setTimeout(renderFotos, 120);

    const client = getSupabase();
    if (client && currentPhoto.id && !String(currentPhoto.id).startsWith('local-')) {
      try {
        if (exists) {
          await client.from('lau_reacoes')
            .delete()
            .eq('alvo_tipo', 'foto')
            .eq('alvo_id', id)
            .eq('autor', autor)
            .eq('emoji', emoji);
        } else {
          await client.from('lau_reacoes').upsert({ alvo_tipo: 'foto', alvo_id: id, autor, emoji }, { onConflict: 'alvo_tipo,alvo_id,autor,emoji' });
        }
      } catch (error) {
        console.warn('[LauOS v73] Reação ficou local, mas foi guardada em backup local:', error);
      }
    }
  }

  async function saveCaptionFromModal() {
    if (!currentPhoto) return;
    const text = $('lauosV72Caption')?.value.trim() || '';
    currentPhoto.legenda = text;
    savePhotoMeta(currentPhoto, { legenda: text, atualizadoEm: new Date().toISOString() });

    // Atualiza caches antigos na hora, para aparecer sem depender do reload do Supabase.
    try {
      if (Array.isArray(window.cacheFotosLau)) {
        window.cacheFotosLau = window.cacheFotosLau.map((foto) => String(foto.id || foto.path || foto.url) === String(currentPhoto.id || currentPhoto.path || currentPhoto.url) ? { ...foto, legenda: text } : foto);
      }
    } catch {}

    let sincronizou = false;
    const client = getSupabase();
    if (client && currentPhoto.id && !String(currentPhoto.id).startsWith('local-')) {
      try {
        const { error } = await client.from('lau_fotos').update({ legenda: text }).eq('id', currentPhoto.id);
        if (error) throw error;
        sincronizou = true;
      } catch (error) {
        console.warn('[LauOS v83] Legenda ficou no backup local. Rode o SQL v83 se ainda não rodou:', error);
      }
    }
    message(sincronizou ? 'Legenda salva no Supabase 💌' : 'Legenda salva neste aparelho. Rode o SQL v83 para sincronizar no Supabase.');
    closeModal();
    renderFotos();
  }

  function hideOldNavItems() {
    const containers = [
      ...document.querySelectorAll('.side-nav, .desktop-sidebar, .mobile-bottom-nav, .bottom-nav, nav, aside, .sidebar')
    ];
    const isNavButton = (btn) => containers.some((box) => box && box.contains(btn));
    document.querySelectorAll('button, a').forEach((el) => {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const onclick = (el.getAttribute('onclick') || '').toLowerCase();
      const dataPage = String(el.dataset?.desktopPage || el.dataset?.page || '').toLowerCase();
      const looksChat = text === '💬 chat' || text === 'chat' || onclick.includes('chat') || dataPage === 'chat';
      const looksBau = text === '📸 baú' || text === 'baú' || text === 'bau' || dataPage === 'bau' || onclick.includes("'bau'") || onclick.includes('"bau"');
      if (isNavButton(el) && (looksChat || looksBau)) el.classList.add('lauos-v72-nav-hidden');
    });
  }

  function installNavObserver() {
    hideOldNavItems();
    if (navObserver) return;
    navObserver = new MutationObserver(() => hideOldNavItems());
    navObserver.observe(document.body, { childList: true, subtree: true });
    setTimeout(hideOldNavItems, 500);
    setTimeout(hideOldNavItems, 1200);
    setTimeout(hideOldNavItems, 2500);
  }

  function message(text) {
    if (typeof window.showMessage === 'function') window.showMessage(text);
    else console.log('[LauOS]', text);
  }

  function patchNavigation() {
    if (booted) return;
    booted = true;
    originalDesktop = window.abrirPaginaDesktop;
    originalMobile = window.abrirPaginaMobile;
    originalCantinho = window.abrirCantinhoNamorado;

    window.abrirPaginaDesktop = function (page) {
      if (page === 'fotos' || page === 'bau') return renderFotos();
      if (page === 'chat') return;
      hideRoot();
      return typeof originalDesktop === 'function' ? originalDesktop.apply(this, arguments) : undefined;
    };

    window.abrirPaginaMobile = function (page) {
      if (page === 'fotos' || page === 'bau') return renderFotos();
      if (page === 'chat') return;
      hideRoot();
      return typeof originalMobile === 'function' ? originalMobile.apply(this, arguments) : undefined;
    };

    window.abrirCantinhoNamorado = function (id) {
      if (id === 'viewBau') return renderFotos();
      hideRoot();
      return typeof originalCantinho === 'function' ? originalCantinho.apply(this, arguments) : undefined;
    };

    window.abrirBauNamoradoV47 = renderFotos;
    window.abrirBauNamoradoV49 = renderFotos;
    window.abrirBauNamoradoV51 = renderFotos;
    window.renderizarBauNamoradoV51 = renderFotos;
    window.renderizarGaleriaFotosLauV66 = renderFotos;
    window.LauOSMediaV73 = { renderFotos, refreshPhotos };
  }

  function install() {
    ensureRoot();
    ensureModal();
    patchNavigation();
    installNavObserver();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
