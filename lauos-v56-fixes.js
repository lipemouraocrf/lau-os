/* LauOS v56 - Etapa 1
   - Diário da Lau protegido com fallback local antigo
   - Blog do namorado separado do Blog da Lau
   - Aba Status vira Namorado, com status + blog em um lugar só
*/
(function () {
  'use strict';

  const EMAIL_LAU = 'lau@lauos.com';
  const EMAIL_NAMORADO = 'lipe@lauos.com';

  const state = {
    blogNamorado: [],
    diario: [],
    statusAbertoLau: false,
    statusAbertoNamorado: true,
    timer: null
  };

  function $(id) { return document.getElementById(id); }
  function q(sel) { return document.querySelector(sel); }
  function qa(sel) { return Array.from(document.querySelectorAll(sel)); }
  function show(msg) { if (typeof window.showMessage === 'function') window.showMessage(msg); else console.log(msg); }
  function safe(text) {
    const raw = String(text ?? '');
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(raw);
    return raw.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }
  function dataBR(value) {
    try {
      if (typeof window.dataBR === 'function') return window.dataBR(value);
      if (!value) return '';
      return new Date(value).toLocaleString('pt-BR');
    } catch { return String(value || ''); }
  }
  function nowISO() { return new Date().toISOString(); }
  function usuarioAtual() { return localStorage.getItem('lauraos_usuario') || ''; }
  function isLau() { return usuarioAtual() === 'Lau'; }
  function isNamorado() { return usuarioAtual() === 'Namorado'; }
  function sbClient() {
    try { return window.sb || window.supabaseClient || null; }
    catch { return null; }
  }
  async function sessionEmail() {
    try {
      const sb = sbClient();
      if (!sb) return '';
      const { data } = await sb.auth.getSession();
      return data?.session?.user?.email || '';
    } catch { return ''; }
  }
  function storageGet(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function storageSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  // ---------- NAV / AREA NAMORADO ----------
  function renomearStatusParaNamorado() {
    qa('#desktopTabbar button[data-desktop-page="boyStatus"], #mobileTabbar button[data-mobile-page="boyStatus"]').forEach((btn) => {
      const span = btn.querySelector('span');
      const strong = btn.querySelector('strong');
      if (span) span.textContent = 'Namorado';
      if (strong) strong.textContent = '💙';
      btn.title = 'Área do namorado';
    });
  }

  function removerBlogNamoradoDoBlogDaLau() {
    const antigoLau = $('blogNamoradoParaLau');
    if (antigoLau) antigoLau.remove();
    const antigoEditor = $('blogNamoradoEditor');
    if (antigoEditor) antigoEditor.remove();
  }

  function garantirPainelNamorado() {
    removerBlogNamoradoDoBlogDaLau();

    const lauView = $('boyStatusLauView');
    if (lauView && !$('v56BlogNamoradoParaLau')) {
      lauView.classList.add('v56-status-collapsed');
      const content = $('boyStatusLauContent');
      if (content && !$('v56StatusToggleLau')) {
        content.insertAdjacentHTML('beforebegin', `
          <div class="v56-namorado-status-actions">
            <button type="button" class="v56-status-toggle" id="v56StatusToggleLau" onclick="abrirStatusNamoradoV56()">Ver status do namorado 💙</button>
            <span class="v56-blog-muted">Status e blog dele ficam juntinhos aqui.</span>
          </div>
        `);
      }
      lauView.insertAdjacentHTML('beforeend', `
        <section class="v56-blog-box" id="v56BlogNamoradoParaLau">
          <div class="v56-blog-head">
            <div>
              <h4>💙 Blog do Namorado</h4>
              <small>Textos que ele escreve para a Lau ler aqui, separado do blog dela.</small>
            </div>
          </div>
          <div class="v56-post-list" id="v56BlogNamoradoListaLau">Carregando...</div>
        </section>
      `);
    }

    const editor = $('boyStatusNamoradoEditor');
    if (editor && !$('v56BlogNamoradoEditor')) {
      editor.classList.add('v56-status-open');
      const saved = $('boyStatusSavedView');
      if (saved && !$('v56StatusToggleNamorado')) {
        saved.insertAdjacentHTML('beforebegin', `
          <div class="v56-namorado-status-actions">
            <button type="button" class="v56-status-toggle" id="v56StatusToggleNamorado" onclick="abrirMeuStatusNamoradoV56()">Ver meu status salvo 💙</button>
            <span class="v56-blog-muted">Seu status do dia + seu blog para ela.</span>
          </div>
        `);
      }
      editor.insertAdjacentHTML('beforeend', `
        <section class="v56-blog-box" id="v56BlogNamoradoEditor">
          <div class="v56-blog-head">
            <div>
              <h4>💙 Meu blog para a Lau</h4>
              <small>Escreve aqui. Ela vê na aba Namorado, não no blog dela.</small>
            </div>
          </div>
          <div class="v56-blog-form">
            <input class="v56-blog-input" id="v56BlogNamoradoTitulo" placeholder="Título. Ex: hoje pensei em você..." />
            <textarea class="v56-blog-textarea" id="v56BlogNamoradoTexto" placeholder="Escreve para ela aqui..."></textarea>
            <button type="button" class="v56-post-button" onclick="publicarBlogNamoradoV56()">Publicar para a Lau 💙</button>
          </div>
          <div class="v56-post-list" id="v56BlogNamoradoListaEditor">Carregando...</div>
        </section>
      `);
    }

    renomearStatusParaNamorado();
  }

  window.abrirStatusNamoradoV56 = function () {
    const view = $('boyStatusLauView');
    if (!view) return;
    state.statusAbertoLau = !state.statusAbertoLau;
    view.classList.toggle('v56-status-open', state.statusAbertoLau);
    view.classList.toggle('v56-status-collapsed', !state.statusAbertoLau);
    const btn = $('v56StatusToggleLau');
    if (btn) btn.textContent = state.statusAbertoLau ? 'Esconder status do namorado 💙' : 'Ver status do namorado 💙';
  };

  window.abrirMeuStatusNamoradoV56 = function () {
    const view = $('boyStatusNamoradoEditor');
    if (!view) return;
    state.statusAbertoNamorado = !state.statusAbertoNamorado;
    view.classList.toggle('v56-status-open', state.statusAbertoNamorado);
    view.classList.toggle('v56-status-collapsed', !state.statusAbertoNamorado);
    const btn = $('v56StatusToggleNamorado');
    if (btn) btn.textContent = state.statusAbertoNamorado ? 'Esconder meu status salvo 💙' : 'Ver meu status salvo 💙';
  };

  // ---------- BLOG DO NAMORADO ----------
  async function carregarBlogNamoradoV56() {
    const sb = sbClient();
    if (sb) {
      try {
        const { data, error } = await sb.from('namorado_blog').select('*').order('created_at', { ascending: false }).limit(80);
        if (error) throw error;
        state.blogNamorado = data || [];
        storageSet('lauos_v56_blog_namorado_cache', state.blogNamorado);
        return state.blogNamorado;
      } catch (e) {
        console.warn('[V56] Blog namorado via Supabase falhou, usando fallback local.', e);
      }
    }
    state.blogNamorado = storageGet('lauos_v56_blog_namorado_cache', storageGet('lauos_v55_blog_namorado', []));
    return state.blogNamorado;
  }

  function postBlogNamoradoHtml(post, editavel) {
    const id = post.id || ('local-' + (post.created_at || Math.random()));
    return `<article class="v56-post-card">
      ${editavel ? `<button type="button" class="v56-post-delete" onclick="excluirBlogNamoradoV56('${safe(String(id))}')">×</button>` : ''}
      <div class="v56-post-title">${safe(post.titulo || 'Recado do namorado')}</div>
      <div class="v56-post-date">💙 ${safe(dataBR(post.created_at))}</div>
      <div class="v56-post-text">${safe(post.texto || '').replaceAll('\n', '<br>')}</div>
    </article>`;
  }

  function renderizarBlogNamoradoV56() {
    garantirPainelNamorado();
    const htmlLau = state.blogNamorado.length
      ? state.blogNamorado.map((p) => postBlogNamoradoHtml(p, false)).join('')
      : '<div class="corner-item">Nenhum post do namorado ainda.</div>';
    const htmlEditor = state.blogNamorado.length
      ? state.blogNamorado.map((p) => postBlogNamoradoHtml(p, true)).join('')
      : '<div class="corner-item">Você ainda não publicou nenhum post para ela.</div>';

    const lauList = $('v56BlogNamoradoListaLau');
    if (lauList) lauList.innerHTML = htmlLau;
    const editorList = $('v56BlogNamoradoListaEditor');
    if (editorList) editorList.innerHTML = htmlEditor;
  }

  window.publicarBlogNamoradoV56 = async function () {
    if (!isNamorado()) return show('Só o namorado pode escrever nesse blog 💙');
    const tituloInput = $('v56BlogNamoradoTitulo');
    const textoInput = $('v56BlogNamoradoTexto');
    const titulo = (tituloInput?.value || '').trim() || 'Recado do namorado';
    const texto = (textoInput?.value || '').trim();
    if (!texto) return show('Escreve o post antes de publicar 💙');

    const payload = { titulo, texto };
    const sb = sbClient();
    let salvo = false;
    if (sb) {
      try {
        const { error } = await sb.from('namorado_blog').insert(payload);
        if (error) throw error;
        salvo = true;
      } catch (e) {
        console.warn('[V56] Não consegui salvar blog no Supabase. Vou guardar local.', e);
      }
    }
    if (!salvo) {
      const list = storageGet('lauos_v56_blog_namorado_cache', []);
      list.unshift({ id: 'local-' + Date.now(), created_at: nowISO(), ...payload });
      storageSet('lauos_v56_blog_namorado_cache', list.slice(0, 80));
    }
    if (tituloInput) tituloInput.value = '';
    if (textoInput) textoInput.value = '';
    await carregarBlogNamoradoV56();
    renderizarBlogNamoradoV56();
    if (typeof window.notificarSistemaV55 === 'function') window.notificarSistemaV55('Novo post do namorado 💙', titulo, 'blog-namorado-v56');
    show('Post publicado para a Lau 💙');
  };

  window.excluirBlogNamoradoV56 = async function (id) {
    if (!confirm('Excluir esse post do Blog do Namorado?')) return;
    const sb = sbClient();
    if (sb && !String(id).startsWith('local-')) {
      try {
        const { error } = await sb.from('namorado_blog').delete().eq('id', id);
        if (error) throw error;
      } catch (e) { console.warn('[V56] delete blog namorado falhou.', e); }
    }
    const list = storageGet('lauos_v56_blog_namorado_cache', state.blogNamorado || []);
    storageSet('lauos_v56_blog_namorado_cache', list.filter((p) => String(p.id) !== String(id)));
    await carregarBlogNamoradoV56();
    renderizarBlogNamoradoV56();
  };

  // ---------- DIARIO DA LAU PROTEGIDO ----------
  function normalizarEntradaDiario(item, origem) {
    if (!item) return null;
    const texto = String(item.texto || item.text || item.conteudo || '').trim();
    if (!texto) return null;
    const created = item.created_at || item.criado_em || item.data_iso || item.data || nowISO();
    return {
      id: item.id || `${origem}-${texto.slice(0, 12)}-${created}`,
      texto,
      created_at: created,
      origem
    };
  }

  function lerDiarioLocalAntigo() {
    const chaves = ['lauraos_diary', 'lauos_diary_backup', 'lauos_v56_diary_backup'];
    const linhas = [];
    chaves.forEach((key) => {
      const raw = storageGet(key, []);
      if (Array.isArray(raw)) raw.forEach((item) => {
        const n = normalizarEntradaDiario(item, key);
        if (n) linhas.push(n);
      });
    });
    return linhas;
  }

  function ordenarDiario(lista) {
    return [...(lista || [])].sort((a, b) => new Date(b.created_at || b.data || 0) - new Date(a.created_at || a.data || 0));
  }

  function mesclarDiario(supabaseRows, localRows) {
    const seen = new Set();
    const out = [];
    [...(supabaseRows || []), ...(localRows || [])].forEach((item) => {
      const n = normalizarEntradaDiario(item, item.origem || 'supabase');
      if (!n) return;
      const key = `${n.texto}::${String(n.created_at).slice(0, 16)}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(n);
    });
    return ordenarDiario(out);
  }

  async function carregarDiarioV56() {
    let supa = [];
    const email = await sessionEmail();
    if (email && email !== EMAIL_LAU && !isLau()) {
      state.diario = [];
      return [];
    }
    const sb = sbClient();
    if (sb) {
      try {
        const { data, error } = await sb.from('lau_diario').select('*').order('created_at', { ascending: false }).limit(200);
        if (error) throw error;
        supa = data || [];
      } catch (e) {
        console.warn('[V56] Diário no Supabase indisponível, tentando backup local.', e);
      }
    }
    state.diario = mesclarDiario(supa, lerDiarioLocalAntigo());
    try { if (typeof cacheDiarioLau !== 'undefined') cacheDiarioLau = state.diario; } catch {}
    storageSet('lauos_v56_diary_backup', state.diario);
    return state.diario;
  }

  function renderizarDiarioLivroV56() {
    const diaryList = $('diaryList');
    if (!diaryList) return;
    const entradas = ordenarDiario(state.diario.length ? state.diario : lerDiarioLocalAntigo());
    if (!entradas.length) {
      diaryList.innerHTML = `
        <div class="diary-book v56-restored v59-empty-book">
          <div class="diary-book-date">💌 Recadinho do Lipe</div>
          <div class="diary-book-text">Lau, eu sinto muito pelo diário antigo. Cuidei pra esse cantinho ficar protegido daqui pra frente. Agora é um recomeço só seu. 💗</div>
        </div>
      `;
      return;
    }
    let pagina = Number(window.diarioPaginaAtual || 0);
    if (pagina < 0) pagina = 0;
    if (pagina >= entradas.length) pagina = entradas.length - 1;
    window.diarioPaginaAtual = pagina;
    const entrada = entradas[pagina];
    diaryList.innerHTML = `
      <div class="diary-book v56-restored">
        <div class="diary-book-date">📓 ${safe(dataBR(entrada.created_at))}</div>
        <div class="diary-book-text">${safe(entrada.texto || '').replaceAll('\n', '<br>')}</div>
        <div class="diary-book-controls">
          <button onclick="mudarPaginaDiarioLau(1)" ${pagina >= entradas.length - 1 ? 'disabled' : ''}>← anterior</button>
          <div class="diary-page-indicator">página ${pagina + 1} de ${entradas.length}</div>
          <button onclick="mudarPaginaDiarioLau(-1)" ${pagina <= 0 ? 'disabled' : ''}>próxima →</button>
        </div>
      </div>
    `;
  }

  function renderizarHistoricoDiarioV56() {
    const lista = $('diaryHistoryList');
    if (lista) {
      const entradas = ordenarDiario(state.diario.length ? state.diario : lerDiarioLocalAntigo());
      lista.innerHTML = entradas.length
        ? entradas.map((item) => `<div class="history-item">${safe(item.texto).replaceAll('\n', '<br>')}<br><br><small>${safe(dataBR(item.created_at))}</small></div>`).join('')
        : 'Nenhuma anotação ainda.';
    }
    renderizarDiarioLivroV56();
  }

  window.carregarDiarioSupabase = carregarDiarioV56;
  window.renderizarDiarioLivroLau = renderizarDiarioLivroV56;
  window.renderizarHistoricoDiarioModal = renderizarHistoricoDiarioV56;
  window.mudarPaginaDiarioLau = function (delta) {
    window.diarioPaginaAtual = Number(window.diarioPaginaAtual || 0) + Number(delta || 0);
    renderizarDiarioLivroV56();
  };

  const oldSalvarDiario = window.salvarDiarioLau;
  window.salvarDiarioLau = async function () {
    const campo = $('diaryText');
    const texto = (campo?.value || '').trim();
    if (!texto) return show('Escreve alguma coisa no diário primeiro 📓');
    if (!isLau()) return show('Esse diário é privado da Lau 📓');

    const entradaLocal = { id: 'local-' + Date.now(), texto, data: new Date().toLocaleString('pt-BR'), created_at: nowISO(), origem: 'local' };
    const backup = storageGet('lauos_v56_diary_backup', []);
    backup.unshift(entradaLocal);
    storageSet('lauos_v56_diary_backup', backup.slice(0, 250));

    const sb = sbClient();
    let salvoSupa = false;
    if (sb) {
      try {
        const { data } = await sb.auth.getSession();
        const user = data?.session?.user;
        if (user?.email === EMAIL_LAU) {
          const { error } = await sb.from('lau_diario').insert({ user_id: user.id, perfil: 'lau', texto });
          if (error) throw error;
          salvoSupa = true;
        }
      } catch (e) { console.warn('[V56] salvar diario Supabase falhou, backup local preservado.', e); }
    }

    if (!salvoSupa && typeof oldSalvarDiario === 'function') {
      // Não chama o antigo para evitar duplicidade visual; o backup já preservou.
    }
    if (campo) campo.value = '';
    window.diarioPaginaAtual = 0;
    await carregarDiarioV56();
    renderizarHistoricoDiarioV56();
    show(salvoSupa ? 'Página guardada no diarinho 💌' : 'Guardei uma cópia local. Depois a gente confirma o cofre online.');
  };

  const oldAbrirHistorico = window.abrirHistoricoDiarioLau;
  window.abrirHistoricoDiarioLau = async function () {
    if (!isLau()) return show('Esse diário é privado da Lau 📓');
    await carregarDiarioV56();
    renderizarHistoricoDiarioV56();
    const modal = $('diaryHistoryModal');
    if (modal) modal.classList.add('show');
    else if (typeof oldAbrirHistorico === 'function') oldAbrirHistorico();
  };

  // Reforça renderizações antigas sem quebrar o app.
  const oldRenderCantinhoLau = window.renderizarCantinhoLau;
  window.renderizarCantinhoLau = function () {
    const result = typeof oldRenderCantinhoLau === 'function' ? oldRenderCantinhoLau() : undefined;
    const diaryList = $('diaryList');
    const entradas = state.diario.length ? state.diario : lerDiarioLocalAntigo();
    if (diaryList && entradas.length) renderizarDiarioLivroV56();
    return result;
  };

  const oldAbrirDesktop = window.abrirPaginaDesktop;
  window.abrirPaginaDesktop = function (page) {
    const normalized = page === 'namorado' ? 'boyStatus' : page;
    const result = typeof oldAbrirDesktop === 'function' ? oldAbrirDesktop(normalized) : undefined;
    setTimeout(async () => {
      renomearStatusParaNamorado();
      removerBlogNamoradoDoBlogDaLau();
      garantirPainelNamorado();
      if (normalized === 'boyStatus') {
        await carregarBlogNamoradoV56();
        renderizarBlogNamoradoV56();
      }
      if (normalized === 'diario') {
        await carregarDiarioV56();
        renderizarHistoricoDiarioV56();
      }
    }, 140);
    return result;
  };

  const oldAbrirMobile = window.abrirPaginaMobile;
  window.abrirPaginaMobile = function (page) {
    const normalized = page === 'namorado' ? 'boyStatus' : page;
    const result = typeof oldAbrirMobile === 'function' ? oldAbrirMobile(normalized) : undefined;
    setTimeout(async () => {
      renomearStatusParaNamorado();
      removerBlogNamoradoDoBlogDaLau();
      garantirPainelNamorado();
      if (normalized === 'boyStatus') {
        await carregarBlogNamoradoV56();
        renderizarBlogNamoradoV56();
      }
      if (normalized === 'diario') {
        await carregarDiarioV56();
        renderizarHistoricoDiarioV56();
      }
    }, 140);
    return result;
  };

  const oldAplicar = window.aplicarPermissao;
  window.aplicarPermissao = function (usuario) {
    const result = typeof oldAplicar === 'function' ? oldAplicar(usuario) : undefined;
    setTimeout(inicializarV56, 450);
    setTimeout(inicializarV56, 1400);
    return result;
  };

  async function inicializarV56() {
    if (!localStorage.getItem('lauraos_usuario')) return;
    removerBlogNamoradoDoBlogDaLau();
    garantirPainelNamorado();
    renomearStatusParaNamorado();
    await Promise.all([carregarBlogNamoradoV56(), carregarDiarioV56()]);
    renderizarBlogNamoradoV56();
    renderizarHistoricoDiarioV56();
  }

  window.addEventListener('load', () => {
    setTimeout(inicializarV56, 900);
    setTimeout(inicializarV56, 2300);
  });

  state.timer = setInterval(() => {
    if (!localStorage.getItem('lauraos_usuario')) return;
    renomearStatusParaNamorado();
    removerBlogNamoradoDoBlogDaLau();
    garantirPainelNamorado();
    renderizarBlogNamoradoV56();
  }, 2500);
})();
