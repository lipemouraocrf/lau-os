/* LauOS v55 - recursos novos sem mexer no core antigo */
(function () {
  'use strict';

  const V55 = {
    blogLau: [],
    blogNamorado: [],
    reacoes: [],
    cartas: [],
    planos: [],
    momentos: [],
    supabaseOk: true,
    notificacoesIniciadas: false,
    primeiraLeitura: true,
    timer: null
  };

  const EMOJIS = ['❤️', '🥹', '😂', '🔥', '💙', '😍'];

  function $(id) { return document.getElementById(id); }
  function usuarioAtual() { return localStorage.getItem('lauraos_usuario') || (document.body.classList.contains('namorado-mode') ? 'Namorado' : 'Lau'); }
  function autorAtual() { return usuarioAtual() === 'Namorado' ? 'Namorado' : 'Lau'; }
  function isDesktop() { return window.matchMedia('(min-width: 761px)').matches; }
  function show(txt) { if (typeof showMessage === 'function') showMessage(txt); else alert(txt); }
  function sbClient() {
    try {
      if (window.sb) return window.sb;
      if (window.supabaseClient) return window.supabaseClient;
      if (window.lauosSupabase) return window.lauosSupabase;
      if (typeof sb !== 'undefined') return sb;
    } catch (e) {}
    return null;
  }
  function safe(text) {
    if (typeof escapeHtml === 'function') return escapeHtml(text || '');
    return String(text || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }
  function dataBR(value) {
    try {
      if (typeof window.dataBR === 'function') return window.dataBR(value);
      if (!value) return '';
      return new Date(value).toLocaleString('pt-BR');
    } catch (e) { return String(value || ''); }
  }
  function hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function agoraISO() { return new Date().toISOString(); }
  function podeAbrirData(data) { return !data || String(data) <= hojeISO(); }
  function storageGet(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (e) { return fallback; }
  }
  function storageSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  function normalizarAutorCarta(valor) {
    const raw = String(valor || '').trim().toLowerCase();
    // v98: "namorada" é a Lau. Antes, por conter "namor", podia cair como Namorado e bagunçar o histórico.
    if (raw.includes('lau') || raw.includes('laura') || raw.includes('namorada') || raw.includes('ela')) return 'Lau';
    if (raw.includes('namorado') || raw.includes('lipe') || raw.includes('filipe') || raw === 'eu' || raw === 'homem') return 'Namorado';
    return 'Lau';
  }
  function normalizarDestinoCarta(valor, autor) {
    const raw = String(valor || '').trim().toLowerCase();
    if (raw.includes('lau') || raw.includes('laura') || raw.includes('namorada') || raw.includes('ela')) return 'Lau';
    if (raw.includes('namorado') || raw.includes('lipe') || raw.includes('filipe') || raw === 'eu' || raw === 'homem') return 'Namorado';
    return normalizarAutorCarta(autor) === 'Namorado' ? 'Lau' : 'Namorado';
  }
  function normalizarCarta(item, index) {
    if (!item) return null;
    const autor = normalizarAutorCarta(item.autor || item.author || item.remetente || item.sender);
    return {
      ...item,
      id: item.id || `local-carta-${index}-${item.created_at || item.data || Date.now()}`,
      titulo: item.titulo || item.title || 'Cartinha',
      texto: item.texto || item.text || item.conteudo || item.body || '',
      autor,
      destino: normalizarDestinoCarta(item.destino || item.to || item.para, autor),
      abrir_em: item.abrir_em || item.open_at || item.data_abertura || item.data || hojeISO(),
      created_at: item.created_at || item.criado_em || item.data_criacao || item.data || agoraISO()
    };
  }
  function extrairCartasDeValor(valor, out, depth = 0) {
    if (!valor || depth > 4) return;
    if (Array.isArray(valor)) {
      valor.forEach((item) => extrairCartasDeValor(item, out, depth + 1));
      return;
    }
    if (typeof valor !== 'object') return;
    const pareceCarta = valor.texto || valor.text || valor.conteudo || valor.body || valor.titulo || valor.title;
    if (pareceCarta) out.push(valor);
    ['cartas', 'letters', 'items', 'data', 'rows', 'value', 'lista'].forEach((k) => {
      if (valor[k]) extrairCartasDeValor(valor[k], out, depth + 1);
    });
  }
  function localCartasExtras() {
    const keys = ['lauos_v55_cartas', 'lauos_v55_cartas_shared', 'lauraos_letters', 'lau_cartinhas', 'lauos_cartas', 'lauos_letters'];
    const out = [];
    keys.forEach((key) => extrairCartasDeValor(storageGet(key, []), out));
    try {
      Object.keys(localStorage).forEach((key) => {
        if (!/carta|cartinha|letter/i.test(key) || keys.includes(key)) return;
        extrairCartasDeValor(storageGet(key, null), out);
      });
    } catch (e) {}
    return out.map(normalizarCarta).filter((c) => c && (c.texto || c.titulo));
  }
  function salvarCartaLocalEspelho(carta) {
    const item = normalizarCarta(carta, Date.now());
    if (!item) return;
    ['lauos_v55_cartas', 'lauos_v55_cartas_shared'].forEach((storeKey) => {
      const list = storageGet(storeKey, []);
      const id = String(item.id || '');
      const key = `${item.autor}|${item.destino}|${item.titulo}|${item.texto}|${item.created_at}`;
      const existe = list.some((c) => String(c.id || '') === id || `${normalizarAutorCarta(c.autor)}|${normalizarDestinoCarta(c.destino, c.autor)}|${c.titulo || c.title || ''}|${c.texto || c.text || c.conteudo || ''}|${c.created_at || c.data || ''}` === key);
      if (!existe) {
        list.unshift(item);
        storageSet(storeKey, list.slice(0, 200));
      }
    });
  }
  function juntarCartas(...listas) {
    const map = new Map();
    listas.flat().map(normalizarCarta).filter(Boolean).forEach((item, index) => {
      const key = String(item.id || `${item.autor}-${item.destino}-${item.titulo}-${item.texto}-${item.created_at || index}`);
      if (!map.has(key)) map.set(key, item);
    });
    return Array.from(map.values()).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }

  async function selectRows(table, opts = {}) {
    const sbx = sbClient();
    if (!sbx) return [];
    try {
      let q = sbx.from(table).select(opts.select || '*');
      if (opts.order) q = q.order(opts.order, { ascending: !!opts.ascending });
      if (opts.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn(`[V55] tabela ${table} indisponível, usando fallback local.`, e);
      V55.supabaseOk = false;
      return null;
    }
  }

  async function selectCartinhasV98() {
    const sbx = sbClient();
    if (!sbx) return [];
    const tentativas = [
      async () => sbx.from('lau_cartinhas').select('*').order('created_at', { ascending: false }).limit(200),
      async () => sbx.from('lau_cartinhas').select('*').limit(200)
    ];
    for (const tentar of tentativas) {
      try {
        const { data, error } = await tentar();
        if (error) throw error;
        if (Array.isArray(data)) return data;
      } catch (e) {
        console.warn('[V98] busca de cartinhas falhou nessa tentativa:', e);
      }
    }
    return [];
  }


  function timeoutV100(ms, fallback) {
    return new Promise((resolve) => window.setTimeout(() => resolve(fallback), ms));
  }
  async function selectCartinhasV100Rapido() {
    const sbx = sbClient();
    if (!sbx) return [];
    const run = (async () => {
      const tentativas = [
        () => sbx.from('lau_cartinhas').select('*').order('created_at', { ascending: false }).limit(200),
        () => sbx.from('lau_cartinhas').select('*').limit(200)
      ];
      for (const tentar of tentativas) {
        try {
          const { data, error } = await tentar();
          if (error) throw error;
          if (Array.isArray(data)) return data;
        } catch (e) {
          console.warn('[V100] cartinhas: tentativa Supabase falhou:', e);
        }
      }
      return [];
    })();
    return Promise.race([run, timeoutV100(2200, [])]);
  }
  function carregarCartasLocalV100() {
    return juntarCartas(
      V55.cartas || [],
      localCartasExtras(),
      storageGet('lauos_v55_cartas', []),
      storageGet('lauos_v55_cartas_shared', []),
      storageGet('lauraos_letters', []),
      storageGet('lau_cartinhas', []),
      storageGet('lauos_cartas', []),
      storageGet('lauos_letters', [])
    ).filter((c) => c && (c.texto || c.titulo));
  }
  async function carregarSomenteCartasV100() {
    const locaisAntes = carregarCartasLocalV100();
    const remotas = await selectCartinhasV100Rapido();
    const locaisDepois = carregarCartasLocalV100();
    V55.cartas = juntarCartas(remotas || [], locaisAntes, locaisDepois);
    V55.cartas.slice(0, 200).forEach(salvarCartaLocalEspelho);
    return V55.cartas;
  }

  async function insertRow(table, payload, localKey) {
    const sbx = sbClient();
    if (sbx) {
      try {
        const { data, error } = await sbx.from(table).insert(payload).select('*').single();
        if (error) throw error;
        return data || { created_at: agoraISO(), ...payload };
      } catch (e) {
        console.warn(`[V55] insert ${table} falhou, usando fallback local.`, e);
      }
    }
    if (localKey) {
      const local = { id: 'local-' + Date.now() + '-' + Math.random().toString(16).slice(2), created_at: agoraISO(), ...payload };
      const list = storageGet(localKey, []);
      list.unshift(local);
      storageSet(localKey, list.slice(0, 120));
      return local;
    }
    return null;
  }

  function mergeRows(remote, localKey) {
    const locais = storageGet(localKey, []);
    const base = Array.isArray(remote) ? remote : [];
    const map = new Map();
    [...base, ...locais].forEach((item, index) => {
      if (!item) return;
      const key = String(item.id || `${item.titulo || item.texto || 'item'}-${item.created_at || index}`);
      if (!map.has(key)) map.set(key, item);
    });
    return Array.from(map.values());
  }

  async function deleteRow(table, id, localKey) {
    const sbx = sbClient();
    if (sbx && !String(id).startsWith('local-')) {
      try {
        const { error } = await sbx.from(table).delete().eq('id', id);
        if (error) throw error;
        return true;
      } catch (e) { console.warn(`[V55] delete ${table} falhou.`, e); }
    }
    if (localKey) {
      storageSet(localKey, storageGet(localKey, []).filter((item) => String(item.id) !== String(id)));
      return true;
    }
    return false;
  }

  function targetKey(tipo, id) { return `${tipo}:${String(id)}`; }
  function reacoesDoAlvo(tipo, id) {
    const key = targetKey(tipo, id);
    return (V55.reacoes || []).filter((r) => `${r.alvo_tipo}:${String(r.alvo_id)}` === key);
  }
  function reactionCounts(tipo, id) {
    return reacoesDoAlvo(tipo, id).reduce((acc, r) => {
      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
      return acc;
    }, {});
  }
  function reactionBar(tipo, id) {
    const counts = reactionCounts(tipo, id);
    const idSafe = String(id).replace(/'/g, "\\'");
    return `<div class="v55-reactions">${EMOJIS.map((emoji) => `
      <button type="button" class="v55-reaction-btn" onclick="reagirV55('${tipo}','${idSafe}','${emoji}')">
        <span>${emoji}</span><strong>${counts[emoji] || ''}</strong>
      </button>
    `).join('')}</div>`;
  }
  window.reagirV55 = async function (tipo, id, emoji) {
    const autor = autorAtual();
    await insertRow('lau_reacoes', { alvo_tipo: tipo, alvo_id: String(id), autor, emoji }, 'lauos_v55_reacoes');
    await carregarReacoesV55();
    renderizarTudoV55();
    show('Reação enviada ' + emoji);
  };

  async function carregarReacoesV55() {
    const rows = await selectRows('lau_reacoes', { order: 'created_at', ascending: false, limit: 500 });
    V55.reacoes = rows || storageGet('lauos_v55_reacoes', []);
  }

  async function carregarBlogV55() {
    const [blogLau, blogNamorado] = await Promise.all([
      selectRows('lau_blog', { order: 'created_at', ascending: false, limit: 80 }),
      selectRows('namorado_blog', { order: 'created_at', ascending: false, limit: 80 })
    ]);
    V55.blogLau = blogLau || storageGet('lauos_v55_blog_lau', []);
    V55.blogNamorado = blogNamorado || storageGet('lauos_v55_blog_namorado', []);
  }

  function blogCard(post, tipo, editavel) {
    const id = post.id || ('local-' + (post.created_at || Math.random()));
    const autor = tipo === 'blog_namorado' ? 'Namorado 💙' : 'Lau 💖';
    const tituloPadrao = tipo === 'blog_namorado' ? 'Recado do namorado' : 'Querido blog...';
    const deleteFn = tipo === 'blog_namorado' ? 'excluirPostBlogNamoradoV55' : 'excluirPostBlogLauV55';
    return `<article class="v55-card v55-blog-post">
      ${editavel ? `<button class="v55-delete" type="button" onclick="${deleteFn}('${safe(id)}')" title="Excluir">×</button>` : ''}
      <div class="v55-title">${safe(post.titulo || tituloPadrao)}</div>
      <div class="v55-date-pill">${safe(autor)} · ${safe(dataBR(post.created_at))}</div>
      <div class="v55-text">${safe(post.texto || '').replaceAll('\n', '<br>')}</div>
      ${reactionBar(tipo, id)}
    </article>`;
  }

  function blogListHtml(lista, tipo, editavel) {
    if (!lista || !lista.length) return '<div class="corner-item">Nenhum post publicado ainda.</div>';
    return `<div class="v55-blog-list">${lista.map((post) => blogCard(post, tipo, editavel)).join('')}</div>`;
  }

  function ensureBlogPanels() {
    const blogCorner = $('blogCorner');
    if (blogCorner && !$('blogNamoradoParaLau')) {
      blogCorner.insertAdjacentHTML('beforeend', `
        <div class="v55-card" id="blogNamoradoParaLau">
          <h4>💙 Blog do Namorado</h4>
          <p class="v55-muted">Tudo que ele escrever para a Lau aparece aqui.</p>
          <div id="blogNamoradoListLau" class="v55-blog-list">Carregando...</div>
        </div>
      `);
    }
    const viewBlog = $('viewBlog');
    if (viewBlog && !$('blogNamoradoEditor')) {
      viewBlog.insertAdjacentHTML('beforeend', `
        <div class="v55-card" id="blogNamoradoEditor">
          <h4>💙 Meu blog para a Lau</h4>
          <p class="v55-muted">Escreve aqui e ela consegue ver no cantinho dela.</p>
          <input class="v55-input" id="blogBoyTitleInput" placeholder="Título. Ex: hoje pensei em você..." />
          <textarea class="v55-textarea" id="blogBoyTextInput" placeholder="Escreve para ela aqui..."></textarea>
          <div class="v55-actions"><button type="button" onclick="publicarPostBlogNamoradoV55()">Publicar para a Lau 💙</button></div>
          <div id="blogNamoradoListNamorado" class="v55-blog-list">Carregando...</div>
        </div>
      `);
    }
  }

  function renderizarBlogsV55() {
    ensureBlogPanels();
    const blogListLau = $('blogListLau');
    if (blogListLau) blogListLau.innerHTML = blogListHtml(V55.blogLau, 'blog_lau', usuarioAtual() === 'Lau');
    const blogListNamorado = $('blogListNamorado');
    if (blogListNamorado) blogListNamorado.innerHTML = blogListHtml(V55.blogLau, 'blog_lau', false);
    const blogNamoradoListLau = $('blogNamoradoListLau');
    if (blogNamoradoListLau) blogNamoradoListLau.innerHTML = blogListHtml(V55.blogNamorado, 'blog_namorado', false);
    const blogNamoradoListNamorado = $('blogNamoradoListNamorado');
    if (blogNamoradoListNamorado) blogNamoradoListNamorado.innerHTML = blogListHtml(V55.blogNamorado, 'blog_namorado', usuarioAtual() === 'Namorado');
  }

  window.carregarBlogSupabase = async function () {
    await carregarBlogV55();
    await carregarReacoesV55();
  };
  window.renderizarBlogLau = renderizarBlogsV55;
  window.renderizarBlogNamorado = renderizarBlogsV55;

  window.publicarPostBlogLau = async function () {
    const tituloInput = $('blogTitleInput');
    const textoInput = $('blogTextInput');
    const titulo = (tituloInput?.value || '').trim() || 'Querido blog...';
    const texto = (textoInput?.value || '').trim();
    if (!texto) return show('Escreve o post antes de publicar 📝');
    if (usuarioAtual() !== 'Lau') return show('Só a Lau pode publicar no Blog da Lau 📝');
    await insertRow('lau_blog', { titulo, texto }, 'lauos_v55_blog_lau');
    if (tituloInput) tituloInput.value = '';
    if (textoInput) textoInput.value = '';
    await carregarBlogV55();
    renderizarBlogsV55();
    show('Post publicado no Blog da Lau 📝');
  };
  window.publicarPostBlogNamoradoV55 = async function () {
    const tituloInput = $('blogBoyTitleInput');
    const textoInput = $('blogBoyTextInput');
    const titulo = (tituloInput?.value || '').trim() || 'Recado do namorado';
    const texto = (textoInput?.value || '').trim();
    if (!texto) return show('Escreve o post antes de publicar 💙');
    if (usuarioAtual() !== 'Namorado') return show('Só o namorado pode publicar nesse blog 💙');
    await insertRow('namorado_blog', { titulo, texto }, 'lauos_v55_blog_namorado');
    if (tituloInput) tituloInput.value = '';
    if (textoInput) textoInput.value = '';
    await carregarBlogV55();
    renderizarBlogsV55();
    notificarSistemaV55('Novo post para a Lau 💙', titulo, 'blog-namorado');
    show('Post publicado para a Lau 💙');
  };
  window.excluirPostBlogLauV55 = async function (id) {
    if (!confirm('Excluir esse post do Blog da Lau?')) return;
    await deleteRow('lau_blog', id, 'lauos_v55_blog_lau');
    await carregarBlogV55();
    renderizarBlogsV55();
  };
  window.excluirPostBlogNamoradoV55 = async function (id) {
    if (!confirm('Excluir esse post do Blog do Namorado?')) return;
    await deleteRow('namorado_blog', id, 'lauos_v55_blog_namorado');
    await carregarBlogV55();
    renderizarBlogsV55();
  };
  window.excluirPostBlogLau = window.excluirPostBlogLauV55;

  function fotosAtuais() {
    let lista = [];
    try { if (Array.isArray(cacheFotosLau)) lista = cacheFotosLau; } catch (e) {}
    if (!lista.length && typeof lerFotosLau === 'function') {
      lista = (lerFotosLau() || []).map((url, index) => ({ id: 'local-' + index, url, titulo: 'Foto ' + (index + 1) }));
    }
    return lista.map((foto, index) => typeof foto === 'string' ? { id: 'local-' + index, url: foto } : foto).filter((f) => f && f.url);
  }

  function photoCard(foto, index, editavel) {
    const id = foto.id || ('local-' + index);
    const titulo = foto.titulo || foto.title || `Memória ${index + 1}`;
    const created = foto.created_at ? dataBR(foto.created_at) : '';
    const deleteBtn = editavel && id && !String(id).startsWith('local-')
      ? `<button class="v55-delete" type="button" onclick="excluirFotoLau(${Number(id)})" title="Excluir foto">×</button>`
      : '';
    return `<div class="v55-photo-card">
      ${deleteBtn}
      <img src="${safe(foto.url)}" alt="${safe(titulo)}" onclick="abrirFotoV55('${encodeURIComponent(foto.url)}','${encodeURIComponent(titulo)}')" />
      <div class="v55-photo-info">
        <div class="v55-photo-title">${safe(titulo)}</div>
        <div class="v55-photo-date">${safe(created || 'Baú de memórias')}</div>
        ${reactionBar('foto', id)}
      </div>
    </div>`;
  }

  function renderizarGaleriasV55() {
    const lista = fotosAtuais();
    const html = lista.length
      ? `<div class="v55-photo-grid">${lista.map((foto, index) => photoCard(foto, index, usuarioAtual() === 'Lau')).join('')}</div>`
      : '<div class="corner-item">As fotos adicionadas vão aparecer aqui.</div>';
    const galleryLau = $('photoGalleryLau');
    if (galleryLau) galleryLau.innerHTML = html;
    const boyGallery = $('boyPhotoGalleryV51') || $('boyPhotoGallery') || $('boyPhotoGalleryV49');
    if (boyGallery) boyGallery.innerHTML = lista.length
      ? `<div class="v55-photo-grid">${lista.map((foto, index) => photoCard(foto, index, usuarioAtual() === 'Namorado')).join('')}</div>`
      : '<div class="corner-item">As fotos adicionadas vão aparecer aqui.</div>';
    const boyCount = $('boyPhotoCountV51') || $('boyPhotoCount');
    if (boyCount) boyCount.textContent = lista.length ? `${lista.length} foto(s) no Baú.` : 'Nenhuma foto adicionada ainda.';
  }

  window.renderizarGaleriaFotosLau = renderizarGaleriasV55;
  window.renderizarBauNamoradoV51 = renderizarGaleriasV55;
  window.abrirFotoV55 = function (urlEncoded, tituloEncoded) {
    let modal = $('v55PhotoModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'v55PhotoModal';
      modal.className = 'v55-photo-modal';
      modal.innerHTML = `<div class="v55-photo-modal-inner"><button class="v55-modal-close" type="button" onclick="fecharFotoV55()">×</button><img id="v55PhotoModalImg" alt="Foto ampliada"><div class="v55-photo-modal-caption" id="v55PhotoModalCaption"></div></div>`;
      modal.addEventListener('click', (e) => { if (e.target === modal) window.fecharFotoV55(); });
      document.body.appendChild(modal);
    }
    $('v55PhotoModalImg').src = decodeURIComponent(urlEncoded || '');
    $('v55PhotoModalCaption').textContent = decodeURIComponent(tituloEncoded || 'Memória do LauOS');
    modal.classList.add('show');
  };
  window.fecharFotoV55 = function () { const modal = $('v55PhotoModal'); if (modal) modal.classList.remove('show'); };

  async function carregarCartasPlanosMomentosV55() {
    const locaisAntes = localCartasExtras();
    const [cartas, planos, momentos] = await Promise.all([
      selectCartinhasV98(),
      selectRows('lau_planos', { order: 'created_at', ascending: false, limit: 120 }),
      selectRows('lau_momentos', { order: 'data', ascending: false, limit: 160 })
    ]);
    const locaisDepois = localCartasExtras();
    V55.cartas = juntarCartas(
      cartas || [],
      locaisAntes,
      locaisDepois,
      storageGet('lauos_v55_cartas', []),
      storageGet('lauos_v55_cartas_shared', []),
      V55.cartas || []
    );
    // v99: nunca deixa a lista sumir por atraso/erro de Supabase.
    V55.cartas.slice(0, 200).forEach(salvarCartaLocalEspelho);
    V55.planos = mergeRows(planos, 'lauos_v55_planos');
    V55.momentos = mergeRows(momentos, 'lauraos_moments');
    return V55.cartas;
  }

  function ensureExtraPanels() {
    const lauCorner = $('lauCorner');
    if (lauCorner && !$('lettersCorner')) {
      lauCorner.insertAdjacentHTML('beforeend', `
        <div class="corner-panel" id="lettersCorner"></div>
        <div class="corner-panel" id="plansCorner"></div>
      `);
    }
    const namCorner = document.querySelector('.namorado-corner-view');
    if (namCorner && !$('viewLetters')) {
      namCorner.insertAdjacentHTML('beforeend', `
        <div class="corner-panel" id="viewLetters"></div>
        <div class="corner-panel" id="viewPlans"></div>
      `);
    }
    ensureMenuButton('#lauCorner .corner-menu', 'lettersCorner', '💌 Cartas', () => abrirCantinho('lettersCorner'));
    ensureMenuButton('#lauCorner .corner-menu', 'plansCorner', '🗺️ Planos', () => abrirCantinho('plansCorner'));
    ensureMenuButton('.namorado-corner-view .corner-menu, .namorado-corner-menu', 'viewLetters', '💌 Cartas', () => abrirCantinhoNamorado('viewLetters'));
    ensureMenuButton('.namorado-corner-view .corner-menu, .namorado-corner-menu', 'viewPlans', '🗺️ Planos', () => abrirCantinhoNamorado('viewPlans'));
  }

  function ensureMenuButton(selector, key, label, handler) {
    const menu = document.querySelector(selector);
    if (!menu || menu.querySelector(`[data-v55-menu="${key}"]`)) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.v55Menu = key;
    btn.textContent = label;
    btn.addEventListener('click', (e) => { e.preventDefault(); handler(); });
    menu.appendChild(btn);
  }

  function cartaCard(carta, editavel) {
    const id = carta.id || ('local-' + carta.created_at);
    const aberto = podeAbrirData(carta.abrir_em);
    const destino = carta.destino || (carta.autor === 'Namorado' ? 'Lau' : 'Namorado');
    const cartaHtml = aberto ? safe(carta.texto || '').replaceAll('\n','<br>') : 'Essa cartinha ainda está trancada. Drama, mistério e fofura.';
    const statusTexto = aberto ? 'Clique para abrir a carta' : `Abre em ${safe(carta.abrir_em || hojeISO())}`;
    const preview = safe((carta.texto || '').slice(0, 120));
    return `<article class="v55-card v55-letter-envelope ${aberto ? 'can-open' : 'v55-letter-locked'}" data-v55-letter-id="${safe(id)}" data-v55-letter-openable="${aberto ? '1' : '0'}">
      ${editavel ? `<button class="v55-delete" type="button" onclick="excluirCartaV55('${safe(id)}')">×</button>` : ''}
      <div class="v55-letter-meta-top">
        <span class="v55-pill">${carta.autor === 'Namorado' ? '💙 Namorado' : '💗 Lau'}</span>
        <span class="v55-date-pill">Para ${safe(destino)} · ${carta.abrir_em ? 'abre em ' + safe(carta.abrir_em) : 'liberada agora'}</span>
      </div>
      <h4>${safe(carta.titulo || 'Cartinha')}</h4>
      <div class="v55-envelope-scene ${aberto ? '' : 'locked'}">
        <button class="v55-envelope-toggle" type="button" onclick="toggleCartaEnvelopeV55('${safe(id)}')" ${aberto ? '' : 'disabled'}>
          <div class="v55-envelope-stage">
            <div class="v55-envelope-glow"></div>
            <div class="v55-envelope-shell">
              <div class="v55-envelope-back"></div>
              <div class="v55-envelope-paper-preview"></div>
              <div class="v55-envelope-front"></div>
              <div class="v55-envelope-flap"></div>
              <div class="v55-envelope-seal"><span>💗</span></div>
            </div>
          </div>
          <span class="v55-envelope-hint">${statusTexto}</span>
          ${preview ? `<span class="v55-envelope-preview-text">${preview}${(carta.texto || '').length > 120 ? '…' : ''}</span>` : ''}
        </button>
        <template class="v55-letter-template">
          <div class="v55-letter-modal-paper-inner">
            <div class="v55-letter-paper-flower flower-a">✿</div>
            <div class="v55-letter-paper-flower flower-b">❀</div>
            <div class="v55-letter-modal-head">
              <span class="v55-letter-modal-stamp">💌</span>
              <div>
                <strong>${safe(carta.titulo || 'Cartinha')}</strong>
                <small>Para ${safe(destino)} · ${safe(dateBR(carta.created_at || carta.abrir_em || ''))}</small>
              </div>
            </div>
            <div class="v55-letter-modal-body"><div class="v55-letter-handwriting">${cartaHtml}</div></div>
            <div class="v55-letter-modal-sign">Com carinho, ${safe(carta.autor || 'Lau')} ✨</div>
          </div>
        </template>
      </div>
      ${reactionBar('carta', id)}
    </article>`;
  }

  function donoDaCarta(carta) {
    return normalizarAutorCarta(carta?.autor || carta?.author || carta?.remetente || carta?.sender);
  }
  function cartasHtml() {
    const usuario = autorAtual();
    const todasCartas = juntarCartas(V55.cartas || [], localCartasExtras()).filter((c) => c && (c.texto || c.titulo));
    let minhas = todasCartas.filter((c) => donoDaCarta(c) === usuario);
    let recebidas = todasCartas.filter((c) => donoDaCarta(c) !== usuario);
    const destinoPadrao = usuario === 'Namorado' ? 'Lau' : 'Namorado';
    const form = `<div class="v55-card">
      <h4>💌 Nova cartinha desbloqueável</h4>
      <input class="v55-input" id="v55CartaTitulo" placeholder="Título da cartinha" />
      <select class="v55-select" id="v55CartaDestino">
        <option value="Lau" ${destinoPadrao === 'Lau' ? 'selected' : ''}>Para Lau</option>
        <option value="Namorado" ${destinoPadrao === 'Namorado' ? 'selected' : ''}>Para Namorado</option>
      </select>
      <input class="v55-input" id="v55CartaData" type="date" />
      <textarea class="v55-textarea" id="v55CartaTexto" placeholder="Escreve a cartinha aqui..."></textarea>
      <div class="v55-actions"><button type="button" onclick="salvarCartaV55()">Guardar cartinha 💌</button></div>
    </div>`;
    const minhasHtml = minhas.length ? `<div class="v55-list">${minhas.map((c) => cartaCard(c, true)).join('')}</div>` : '<div class="corner-item">Você ainda não guardou cartinhas.</div>';
    const recebidasHtml = recebidas.length ? `<div class="v55-list">${recebidas.map((c) => cartaCard(c, false)).join('')}</div>` : '<div class="corner-item">Nenhuma cartinha recebida ainda.</div>';
    const totalInfo = todasCartas.length ? `<p class="v55-muted">${todasCartas.length} cartinha(s) encontrada(s).</p>` : '';
    return `<h4>💌 Cartinhas</h4>${totalInfo}${form}<h4>🗂️ Suas cartinhas</h4>${minhasHtml}<h4>📬 Cartinhas recebidas</h4>${recebidasHtml}`;
  }

  window.salvarCartaV55 = async function () {
    const titulo = ($('v55CartaTitulo')?.value || '').trim() || 'Cartinha';
    const destino = $('v55CartaDestino')?.value || (autorAtual() === 'Namorado' ? 'Lau' : 'Namorado');
    const abrir_em = $('v55CartaData')?.value || hojeISO();
    const texto = ($('v55CartaTexto')?.value || '').trim();
    if (!texto) return show('Escreve a cartinha primeiro 💌');
    const payload = { titulo, texto, abrir_em, destino, autor: autorAtual(), created_at: agoraISO() };
    let salva = await insertRow('lau_cartinhas', payload, 'lauos_v55_cartas');
    salva = normalizarCarta(salva || payload);
    salvarCartaLocalEspelho(salva);
    V55.cartas = juntarCartas([salva], V55.cartas || [], localCartasExtras());
    ['v55CartaTitulo','v55CartaTexto'].forEach((id) => { if ($(id)) $(id).value = ''; });
    renderizarExtrasV55();
    carregarSomenteCartasV100().then(() => renderizarExtrasV55()).catch(() => renderizarExtrasV55());
    show('Cartinha guardada 💌');
  };
  window.excluirCartaV55 = async function (id) {
    if (!confirm('Excluir essa cartinha?')) return;
    await deleteRow('lau_cartinhas', id, 'lauos_v55_cartas');
    storageSet('lauos_v55_cartas_shared', storageGet('lauos_v55_cartas_shared', []).filter((item) => String(item.id) !== String(id)));
    V55.cartas = (V55.cartas || []).filter((item) => String(item.id) !== String(id));
    await carregarSomenteCartasV100();
    renderizarExtrasV55();
  };
  function ensureLetterModalV55() {
    let modal = $('v55LetterModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'v55LetterModal';
    modal.className = 'v55-letter-modal';
    modal.innerHTML = `<div class="v55-letter-modal-dialog"><button class="v55-modal-close" type="button" onclick="fecharCartaModalV55()">×</button><div class="v55-letter-modal-paper" id="v55LetterModalBody"></div></div>`;
    modal.addEventListener('click', (e) => { if (e.target === modal) window.fecharCartaModalV55(); });
    document.body.appendChild(modal);
    return modal;
  }
  window.abrirCartaModalV55 = function (id) {
    const card = document.querySelector(`[data-v55-letter-id="${String(id).replace(/"/g, '&quot;')}"]`);
    if (!card) return;
    const template = card.querySelector('.v55-letter-template');
    const modal = ensureLetterModalV55();
    const body = $('v55LetterModalBody');
    if (body && template) body.innerHTML = template.innerHTML;
    modal.classList.add('show');
    document.body.classList.add('v55-modal-open');
  };
  window.fecharCartaModalV55 = function () {
    const modal = $('v55LetterModal');
    if (modal) modal.classList.remove('show');
    document.body.classList.remove('v55-modal-open');
  };
  window.toggleCartaEnvelopeV55 = function (id) {
    const card = document.querySelector(`[data-v55-letter-id="${String(id).replace(/"/g, '&quot;')}"]`);
    if (!card) return;
    if (card.dataset.v55LetterOpenable !== '1') {
      show('Essa carta ainda está fechadinha 🔒');
      return;
    }
    card.classList.add('is-opening');
    window.setTimeout(() => {
      card.classList.remove('is-opening');
      window.abrirCartaModalV55(id);
    }, 620);
  };

  function planoCard(plano) {
    const id = plano.id || ('local-' + plano.created_at);
    return `<article class="v55-card">
      <button class="v55-delete" type="button" onclick="excluirPlanoV55('${safe(id)}')">×</button>
      <h4>${safe(plano.titulo || 'Plano futuro')}</h4>
      <div class="v55-plan-status">${safe(plano.status || 'quero fazer')}</div>
      <div class="v55-date-pill">${safe(plano.categoria || 'plano')} · por ${safe(plano.autor || 'LauOS')}</div>
      <div class="v55-text">${safe(plano.detalhes || '').replaceAll('\n','<br>')}</div>
      ${reactionBar('plano', id)}
    </article>`;
  }
  function planosHtml() {
    const cards = V55.planos.length ? `<div class="v55-list">${V55.planos.map(planoCard).join('')}</div>` : '<div class="corner-item">Nenhum plano futuro salvo ainda.</div>';
    return `<h4>🗺️ Planos futuros</h4><p>Lugares, filmes, comidas, viagens e ideias para vocês viverem depois.</p>
      <div class="v55-card">
        <input class="v55-input" id="v55PlanoTitulo" placeholder="Ex: passar o dia em Altea" />
        <select class="v55-select" id="v55PlanoCategoria"><option>Passeio</option><option>Comida</option><option>Viagem</option><option>Filme</option><option>Surpresa</option><option>Sonho</option></select>
        <select class="v55-select" id="v55PlanoStatus"><option>quero fazer</option><option>combinado</option><option>feito</option></select>
        <textarea class="v55-textarea" id="v55PlanoDetalhes" placeholder="Detalhes do plano..."></textarea>
        <div class="v55-actions"><button type="button" onclick="salvarPlanoV55()">Salvar plano 🗺️</button></div>
      </div>${cards}`;
  }
  window.salvarPlanoV55 = async function () {
    const titulo = ($('v55PlanoTitulo')?.value || '').trim();
    const detalhes = ($('v55PlanoDetalhes')?.value || '').trim();
    const categoria = $('v55PlanoCategoria')?.value || 'Plano';
    const status = $('v55PlanoStatus')?.value || 'quero fazer';
    if (!titulo) return show('Coloca o nome do plano primeiro 🗺️');
    await insertRow('lau_planos', { titulo, detalhes, categoria, status, autor: autorAtual() }, 'lauos_v55_planos');
    ['v55PlanoTitulo','v55PlanoDetalhes'].forEach((id) => { if ($(id)) $(id).value = ''; });
    await carregarCartasPlanosMomentosV55();
    renderizarExtrasV55();
    show('Plano salvo 🗺️');
  };
  window.excluirPlanoV55 = async function (id) {
    if (!confirm('Excluir esse plano?')) return;
    await deleteRow('lau_planos', id, 'lauos_v55_planos');
    await carregarCartasPlanosMomentosV55();
    renderizarExtrasV55();
  };

  function normalizarMomento(m, index) {
    return { id: m.id || ('local-' + index), titulo: m.titulo || m.title || '', data: m.data || '', descricao: m.descricao || '', autor: m.autor || 'LauOS', created_at: m.created_at || m.criadoEm || '' };
  }
  function momentosOrdenados() {
    return [...(V55.momentos || [])].map(normalizarMomento).sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }
  function renderMomentosCalendario() {
    const momentos = momentosOrdenados();
    const grouped = momentos.reduce((acc, m) => {
      const key = (m.data || 'sem-data').slice(0, 7);
      if (!acc[key]) acc[key] = [];
      acc[key].push(m);
      return acc;
    }, {});
    if (!momentos.length) return '<div class="corner-item">Nenhum momento salvo ainda.</div>';
    return `<div class="v55-moment-calendar">${Object.entries(grouped).map(([mes, itens]) => {
      const label = mes === 'sem-data' ? 'Sem data' : new Date(mes + '-02T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      return `<div class="v55-moment-month"><div class="v55-month-badge">${safe(label)}</div><div>${itens.map((m) => `<div class="v55-moment-mini"><strong>${safe(m.titulo)}</strong><br><span>${safe(m.data)}</span>${m.descricao ? `<br><small>${safe(m.descricao)}</small>` : ''}<br><small>por ${safe(m.autor || 'LauOS')}</small>${reactionBar('momento', m.id)}</div>`).join('')}</div></div>`;
    }).join('')}</div>`;
  }
  function renderMomentosV55() {
    const html = renderMomentosCalendario();
    const momentList = $('momentList');
    if (momentList) momentList.innerHTML = html;
    const viewMoments = $('viewMoments');
    if (viewMoments) viewMoments.innerHTML = `<h4>📅 Calendário de momentos</h4><p>Memórias e datas importantes dos dois, organizadas por mês.</p><div class="v55-card"><input class="v55-input" id="boyMomentTitle" placeholder="Ex: nosso próximo encontro" /><input class="v55-input" id="boyMomentDate" type="date" /><textarea class="v55-textarea" id="boyMomentDesc" placeholder="Detalhe opcional..."></textarea><div class="v55-actions"><button type="button" onclick="adicionarMomentoNamorado()">Adicionar momento 💙</button></div></div>${html}`;
  }
  window.adicionarMomentoLau = async function () {
    const titulo = ($('momentTitle')?.value || '').trim();
    const data = $('momentDate')?.value || '';
    if (!titulo || !data) return show('Coloca o nome do momento e a data primeiro 📅');
    await insertRow('lau_momentos', { titulo, data, descricao: '', autor: 'Lau' }, 'lauraos_moments');
    if ($('momentTitle')) $('momentTitle').value = '';
    if ($('momentDate')) $('momentDate').value = '';
    await carregarCartasPlanosMomentosV55();
    renderMomentosV55();
    show('Momento salvo no calendário 📅');
  };
  window.adicionarMomentoNamorado = async function () {
    const titulo = ($('boyMomentTitle')?.value || '').trim();
    const data = $('boyMomentDate')?.value || '';
    const descricao = ($('boyMomentDesc')?.value || '').trim();
    if (!titulo || !data) return show('Coloca o nome do momento e a data primeiro 📅');
    await insertRow('lau_momentos', { titulo, data, descricao, autor: 'Namorado' }, 'lauraos_moments');
    ['boyMomentTitle','boyMomentDate','boyMomentDesc'].forEach((id) => { if ($(id)) $(id).value = ''; });
    await carregarCartasPlanosMomentosV55();
    renderMomentosV55();
    show('Momento adicionado 💙');
  };

  let v98CartasRefreshBusy = false;
  async function atualizarCartasSeAbertoV98() {
    const lettersCorner = $('lettersCorner');
    const aberto = lettersCorner && (lettersCorner.classList.contains('show') || lettersCorner.offsetParent !== null);
    if (!aberto || v98CartasRefreshBusy) return;
    const focused = document.activeElement;
    if (focused && (focused.id === 'v55CartaTitulo' || focused.id === 'v55CartaTexto' || focused.id === 'v55CartaData' || focused.id === 'v55CartaDestino')) return;
    v98CartasRefreshBusy = true;
    try {
      await carregarSomenteCartasV100();
      if ($('lettersCorner')) $('lettersCorner').innerHTML = cartasHtml();
    } finally {
      v98CartasRefreshBusy = false;
    }
  }

  function renderizarExtrasV55() {
    ensureExtraPanels();
    const lettersCorner = $('lettersCorner');
    if (lettersCorner) {
      lettersCorner.innerHTML = cartasHtml();
      setTimeout(atualizarCartasSeAbertoV98, 80);
    }
    const viewLetters = $('viewLetters');
    if (viewLetters) viewLetters.innerHTML = cartasHtml();
    const plansCorner = $('plansCorner');
    if (plansCorner) plansCorner.innerHTML = planosHtml();
    const viewPlans = $('viewPlans');
    if (viewPlans) viewPlans.innerHTML = planosHtml();
    renderMomentosV55();
  }

  function mostrarPainelLau(panelId) {
    const lauraArea = $('lauraArea');
    if (!lauraArea) return;
    document.body.classList.remove('v51-bau-open', 'lauos-status-active', 'lauos-show-boy-status');
    setBlock($('countdownArea'), false);
    setBlock($('namoradoArea'), false);
    setBlock(lauraArea, true);
    [lauraArea.querySelector('.role-header'), $('moodOptions'), lauraArea.querySelector('.levels-grid'), $('moodNote'), lauraArea.querySelector('.save-mood-btn'), lauraArea.querySelector('.chat-card'), $('lauMobilePhotoViewer')].forEach((n) => setBlock(n, false));
    const corner = $('lauCorner');
    setBlock(corner, true);
    if (!corner) return;
    setBlock(corner.querySelector('.corner-header'), false);
    setBlock(corner.querySelector('.corner-menu'), false);
    corner.querySelectorAll('.corner-panel').forEach((p) => { const showIt = p.id === panelId; setBlock(p, showIt); p.classList.toggle('show', showIt); });
    if (panelId === 'lettersCorner' || panelId === 'plansCorner' || panelId === 'calendarCorner') renderizarExtrasV55();
  }
  function mostrarPainelNamorado(panelId) {
    const namoradoArea = $('namoradoArea');
    if (!namoradoArea) return;
    document.body.classList.remove('v51-bau-open', 'lauos-status-active', 'lauos-show-boy-status');
    setBlock($('countdownArea'), false);
    setBlock($('lauraArea'), false);
    setBlock(namoradoArea, true);
    Array.from(namoradoArea.children).forEach((child) => { setBlock(child, child.classList && child.classList.contains('namorado-corner-view')); });
    const corner = namoradoArea.querySelector('.namorado-corner-view');
    setBlock(corner, true);
    if (!corner) return;
    setBlock(corner.querySelector('.corner-menu'), false);
    corner.querySelectorAll('.corner-panel').forEach((p) => { const showIt = p.id === panelId; setBlock(p, showIt); p.classList.toggle('show', showIt); });
    if (panelId === 'viewLetters' || panelId === 'viewPlans' || panelId === 'viewMoments') renderizarExtrasV55();
  }
  function setBlock(el, showIt, display = 'block') { if (el) el.style.setProperty('display', showIt ? display : 'none', 'important'); }

  const oldAbrirCantinho = window.abrirCantinho;
  window.abrirCantinho = function (id) {
    if (id === 'lettersCorner' || id === 'plansCorner') { mostrarPainelLau(id); return; }
    const r = typeof oldAbrirCantinho === 'function' ? oldAbrirCantinho(id) : undefined;
    setTimeout(renderizarExtrasV55, 80);
    return r;
  };
  const oldAbrirCantinhoNamorado = window.abrirCantinhoNamorado;
  window.abrirCantinhoNamorado = function (id) {
    if (id === 'viewLetters' || id === 'viewPlans') { mostrarPainelNamorado(id); return; }
    const r = typeof oldAbrirCantinhoNamorado === 'function' ? oldAbrirCantinhoNamorado(id) : undefined;
    setTimeout(renderizarExtrasV55, 80);
    return r;
  };
  const oldAbrirDesktop = window.abrirPaginaDesktop;
  window.abrirPaginaDesktop = function (page) {
    if (page === 'cartas') { usuarioAtual() === 'Namorado' ? mostrarPainelNamorado('viewLetters') : mostrarPainelLau('lettersCorner'); marcarNav('cartas'); return; }
    if (page === 'planos') { usuarioAtual() === 'Namorado' ? mostrarPainelNamorado('viewPlans') : mostrarPainelLau('plansCorner'); marcarNav('planos'); return; }
    const r = typeof oldAbrirDesktop === 'function' ? oldAbrirDesktop(page) : undefined;
    setTimeout(() => { ensureNavButtons(); renderizarTudoV55(); }, 120);
    return r;
  };
  function marcarNav(page) {
    document.querySelectorAll('#desktopTabbar button[data-desktop-page]').forEach((b) => b.classList.toggle('active', b.dataset.desktopPage === page));
  }
  function ensureNavButtons() {
    if (!isDesktop()) return;
    const nav = $('desktopTabbar');
    if (!nav) return;
    [['cartas','💌','Cartas'], ['planos','🗺️','Planos']].forEach(([page, icon, label]) => {
      if (nav.querySelector(`button[data-desktop-page="${page}"]`)) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.desktopPage = page;
      btn.dataset.v55Nav = '1';
      btn.innerHTML = `<strong>${icon}</strong><span>${label}</span>`;
      btn.addEventListener('click', (e) => { e.preventDefault(); window.abrirPaginaDesktop(page); });
      nav.appendChild(btn);
    });
  }

  function ensureNotifyCard() {
    if ($('v55NotifyCard')) return;
    const area = usuarioAtual() === 'Namorado' ? $('namoradoArea') : $('lauraArea');
    if (!area) return;
    const card = document.createElement('div');
    card.id = 'v55NotifyCard';
    card.className = 'v55-notify-card';
    card.innerHTML = `<div>🔔 Notificações do LauOS<small>Receba aviso de blog, cartinha, plano e chat enquanto o app/PWA estiver ativo.</small></div><button class="v55-primary" type="button" onclick="ativarNotificacoesLauOS()">Ativar</button>`;
    area.insertAdjacentElement('afterbegin', card);
  }
  window.ativarNotificacoesLauOS = async function () {
    if (!('Notification' in window)) return show('Esse navegador não suporta notificações.');
    try {
      if ('serviceWorker' in navigator) await navigator.serviceWorker.register('/sw.js');
      const perm = await Notification.requestPermission();
      localStorage.setItem('lauos_v55_notificacao', perm === 'granted' ? 'on' : 'off');
      if (perm === 'granted') {
        await notificarSistemaV55('LauOS ativado 🔔', 'Agora o app pode mostrar avisos quando tiver novidade.', 'teste');
        show('Notificações ativadas 🔔');
      } else show('Permissão de notificação não foi liberada.');
    } catch (e) { console.warn(e); show('Não consegui ativar as notificações nesse navegador.'); }
  };
  async function notificarSistemaV55(titulo, corpo, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(titulo, { body: corpo, tag: 'lauos-' + tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: location.href } });
      } else {
        new Notification(titulo, { body: corpo, tag: 'lauos-' + tag, icon: '/icons/icon-192.png' });
      }
    } catch (e) { console.warn('Falha na notificação', e); }
  }
  window.notificarSistemaV55 = notificarSistemaV55;

  function newestCreated(list) {
    return (list || []).map((i) => i.created_at).filter(Boolean).sort().pop() || '';
  }
  async function checarNovidadesV55() {
    const usuario = usuarioAtual();
    if (!localStorage.getItem('lauraos_usuario')) return;
    await Promise.all([carregarBlogV55(), carregarCartasPlanosMomentosV55(), carregarReacoesV55()]);
    const watchers = [
      { key: 'blog_namorado', title: 'Novo post do namorado 💙', body: V55.blogNamorado[0]?.titulo || 'Tem texto novo para a Lau.', target: 'Lau', last: newestCreated(V55.blogNamorado) },
      { key: 'cartas', title: 'Cartinha nova 💌', body: V55.cartas[0]?.titulo || 'Tem cartinha no LauOS.', target: null, last: newestCreated(V55.cartas) },
      { key: 'planos', title: 'Plano novo 🗺️', body: V55.planos[0]?.titulo || 'Tem plano futuro no LauOS.', target: null, last: newestCreated(V55.planos) },
      { key: 'momentos', title: 'Momento novo 📅', body: V55.momentos[0]?.titulo || 'Calendário de momentos atualizado.', target: null, last: newestCreated(V55.momentos) }
    ];
    watchers.forEach((w) => {
      if (w.target && w.target !== usuario) return;
      if (!w.last) return;
      const storeKey = `lauos_v55_seen_${usuario}_${w.key}`;
      const seen = localStorage.getItem(storeKey) || '';
      if (!seen) { localStorage.setItem(storeKey, w.last); return; }
      if (w.last > seen) {
        localStorage.setItem(storeKey, w.last);
        notificarSistemaV55(w.title, w.body, w.key);
      }
    });
    renderizarTudoV55();
  }

  async function renderizarTudoV55() {
    ensureBlogPanels();
    ensureExtraPanels();
    ensureNavButtons();
    ensureNotifyCard();
    renderizarBlogsV55();
    renderizarGaleriasV55();
    renderizarExtrasV55();
  }

  const oldAplicar = window.aplicarPermissao;
  window.aplicarPermissao = function (usuario) {
    const result = typeof oldAplicar === 'function' ? oldAplicar(usuario) : undefined;
    setTimeout(inicializarV55, 400);
    setTimeout(inicializarV55, 1300);
    return result;
  };

  async function inicializarV55() {
    if (!localStorage.getItem('lauraos_usuario')) return;
    ensureNotifyCard();
    await Promise.all([carregarBlogV55(), carregarReacoesV55(), carregarCartasPlanosMomentosV55()]);
    renderizarTudoV55();
    if (!V55.timer) V55.timer = setInterval(checarNovidadesV55, 30000);
  }


  async function renderCartasPanelV100() {
    ensureExtraPanels();
    const host = $('lettersCorner');
    const viewHost = $('viewLetters');

    // v100: a aba nunca mais fica presa em "Carregando".
    // Primeiro mostra o que já existe em memória/localStorage, depois tenta atualizar o Supabase com timeout.
    V55.cartas = carregarCartasLocalV100();
    const htmlInicial = cartasHtml();
    if (host) host.innerHTML = htmlInicial;
    if (viewHost) viewHost.innerHTML = htmlInicial;

    try {
      await carregarSomenteCartasV100();
    } catch (e) {
      console.warn('[V100] não consegui atualizar cartinhas agora, mantendo fallback local:', e);
    }

    const htmlFinal = cartasHtml();
    if (host) host.innerHTML = htmlFinal;
    if (viewHost) viewHost.innerHTML = htmlFinal;
    return V55.cartas;
  }

  // v84/v100: expõe os renders internos para o roteador limpo atualizar Cartas/Blog sem depender dos handlers antigos.
  window.LauOSV55 = Object.assign(window.LauOSV55 || {}, {
    loadBlogs: carregarBlogV55,
    renderBlogs: renderizarBlogsV55,
    loadExtras: carregarCartasPlanosMomentosV55,
    renderExtras: renderizarExtrasV55,
    renderCartasPanel: renderCartasPanelV100,
    renderAll: renderizarTudoV55,
    reloadCartas: async function () { await carregarSomenteCartasV100(); renderizarExtrasV55(); return V55.cartas; },
    reloadOnlyCartas: carregarSomenteCartasV100
  });

  window.addEventListener('load', function () {
    setTimeout(inicializarV55, 1200);
    setTimeout(inicializarV55, 2500);
  });
  setInterval(function () {
    if (!localStorage.getItem('lauraos_usuario')) return;
    ensureNavButtons();
    ensureExtraPanels();
    renderizarGaleriasV55();
  }, 3500);
})();
