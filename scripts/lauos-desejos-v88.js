/* LauOS v88 - Desejos da Lau separado, estável e persistente.
   Resolve: no perfil da Lau, a aba Desejos não aparecia mais após separar o lado do Namorado. */
(function () {
  'use strict';

  const V88 = { cache: [] };
  const $ = (id) => document.getElementById(id);
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function sbClient() {
    try { return window.sb || window.supabaseClient || window.lauosSupabase || null; }
    catch { return null; }
  }

  function safe(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[c]));
  }

  function showMessage(text) {
    if (typeof window.showMessage === 'function') window.showMessage(text);
    else console.log('[LauOS]', text);
  }

  function nowISO() { return new Date().toISOString(); }

  function dateBR(value) {
    if (!value) return '';
    try { return new Date(value).toLocaleString('pt-BR'); }
    catch { return String(value || ''); }
  }

  function storageGet(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function normalize(row, index) {
    if (!row) return null;
    return {
      ...row,
      id: row.id || `local-${index}-${Date.now()}`,
      texto: row.texto || row.title || row.titulo || '',
      created_at: row.created_at || row.data || nowISO(),
      concluido: !!(row.concluido || row.finalizado)
    };
  }

  function mergeRows(remote, local) {
    const map = new Map();
    [...(remote || []), ...(local || [])].forEach((row, index) => {
      const item = normalize(row, index);
      if (!item || !item.texto) return;
      const key = String(item.id || item.created_at || item.texto);
      if (!map.has(key)) map.set(key, item);
    });
    return Array.from(map.values()).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }

  async function load() {
    let remote = [];
    const sb = sbClient();
    if (sb) {
      try {
        const { data, error } = await sb.from('lau_desejos').select('*').order('created_at', { ascending: false }).limit(200);
        if (error) throw error;
        remote = data || [];
        storageSet('lauos_v88_desejos_cache', remote);
      } catch (err) {
        console.warn('[LauOS v88] Não consegui carregar lau_desejos:', err);
        remote = storageGet('lauos_v88_desejos_cache', []);
      }
    }
    const local = [
      ...storageGet('lauraos_wishes', []),
      ...storageGet('lauos_v55_wishes', []),
      ...storageGet('lauos_v88_desejos_local', [])
    ];
    V88.cache = mergeRows(remote, local);
    return V88.cache;
  }

  async function add(texto) {
    const payload = { texto };
    const sb = sbClient();
    if (sb) {
      try {
        const { error } = await sb.from('lau_desejos').insert(payload);
        if (error) throw error;
        return true;
      } catch (err) {
        console.warn('[LauOS v88] Salvamento no Supabase falhou, usando backup local:', err);
      }
    }
    const local = storageGet('lauos_v88_desejos_local', []);
    local.unshift({ id: 'local-' + Date.now(), texto, created_at: nowISO(), concluido: false });
    storageSet('lauos_v88_desejos_local', local.slice(0, 200));
    return true;
  }

  async function setDone(id, done) {
    const isLocal = String(id).startsWith('local-');
    const sb = sbClient();
    if (sb && !isLocal) {
      try {
        const { error } = await sb.from('lau_desejos').update({ concluido: !!done, finalizado: !!done }).eq('id', id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.warn('[LauOS v88] Não consegui atualizar desejo:', err);
        showMessage('Não consegui marcar no Supabase. Rode o SQL v88 se faltar coluna concluido/finalizado.');
      }
    }
    ['lauos_v88_desejos_local', 'lauraos_wishes'].forEach((key) => {
      const list = storageGet(key, []);
      storageSet(key, list.map((item) => String(item.id) === String(id) ? { ...item, concluido: !!done, finalizado: !!done } : item));
    });
    return true;
  }

  async function remove(id) {
    const isLocal = String(id).startsWith('local-');
    const sb = sbClient();
    if (sb && !isLocal) {
      try {
        const { error } = await sb.from('lau_desejos').delete().eq('id', id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.warn('[LauOS v88] Não consegui remover desejo:', err);
        showMessage('Não consegui remover no Supabase.');
        return false;
      }
    }
    ['lauos_v88_desejos_local', 'lauraos_wishes'].forEach((key) => {
      storageSet(key, storageGet(key, []).filter((item) => String(item.id) !== String(id)));
    });
    return true;
  }

  function itemHtml(item) {
    const id = safe(item.id);
    return `<article class="lauos-desejo-v88-item ${item.concluido ? 'is-done' : ''}">
      <button type="button" class="lauos-desejo-v88-check" data-v88-toggle="${id}" aria-label="Marcar desejo">
        ${item.concluido ? '✅' : '✨'}
      </button>
      <div class="lauos-desejo-v88-text">
        <strong>${safe(item.texto)}</strong>
        <small>${item.concluido ? 'concluído/finalizado' : 'em aberto'} · ${safe(dateBR(item.created_at))}</small>
      </div>
      <button type="button" class="lauos-desejo-v88-delete" data-v88-remove="${id}" aria-label="Remover desejo">×</button>
    </article>`;
  }

  function render(host) {
    const abertos = V88.cache.filter((i) => !i.concluido);
    const feitos = V88.cache.filter((i) => i.concluido);
    host.innerHTML = `<section class="lauos-desejos-v88">
      <header class="lauos-desejos-v88-head">
        <div>
          <h2>🌟 Desejos da Lau</h2>
          <p>Guarde vontades, ideias e coisinhas para realizar depois.</p>
        </div>
        <span>${V88.cache.length} desejos</span>
      </header>
      <div class="lauos-desejos-v88-form">
        <input id="lauosDesejoV88Input" placeholder="Ex: receber flores sem motivo" autocomplete="off" />
        <button type="button" data-v88-add>Guardar desejo ✨</button>
      </div>
      <div class="lauos-desejos-v88-grid">
        <section>
          <h3>Para realizar</h3>
          <div class="lauos-desejos-v88-list">${abertos.length ? abertos.map(itemHtml).join('') : '<div class="lauos-desejos-v88-empty">Nenhum desejo aberto por enquanto.</div>'}</div>
        </section>
        <section>
          <h3>Concluídos</h3>
          <div class="lauos-desejos-v88-list">${feitos.length ? feitos.map(itemHtml).join('') : '<div class="lauos-desejos-v88-empty">Nada concluído ainda.</div>'}</div>
        </section>
      </div>
    </section>`;

    qs('[data-v88-add]', host)?.addEventListener('click', async () => {
      const input = $('lauosDesejoV88Input');
      const texto = String(input?.value || '').trim();
      if (!texto) return showMessage('Escreve um desejo antes de guardar ✨');
      await add(texto);
      if (input) input.value = '';
      showMessage('Desejo guardado 🌟');
      await show(host);
    });

    $('lauosDesejoV88Input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        qs('[data-v88-add]', host)?.click();
      }
    });

    qsa('[data-v88-toggle]', host).forEach((btn) => btn.addEventListener('click', async () => {
      const id = btn.dataset.v88Toggle;
      const item = V88.cache.find((i) => String(i.id) === String(id));
      if (!item) return;
      await setDone(id, !item.concluido);
      await show(host);
    }));

    qsa('[data-v88-remove]', host).forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Remover esse desejo?')) return;
      await remove(btn.dataset.v88Remove);
      await show(host);
    }));
  }

  async function show(host) {
    host = host || $('lauosDesejosV88Host');
    if (!host) return;
    host.innerHTML = '<div class="lauos-desejos-v88-loading">Carregando desejos da Lau... 🌟</div>';
    await load();
    render(host);
  }

  window.LauOSDesejosV88 = { show, reload: () => show() };
})();
