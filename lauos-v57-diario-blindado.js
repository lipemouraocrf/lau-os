/* LauOS v57 - Diário blindado
   Objetivo: diário nunca depender de uma fonte só.
   Camadas:
   1) Supabase lau_diario
   2) backup local automático
   3) exportação/importação manual
   4) snapshot opcional na tabela lau_diario_backups
*/
(function () {
  'use strict';

  const EMAIL_LAU = 'lau@lauos.com';
  const KEYS = {
    latest: 'lauos_v57_diary_latest',
    history: 'lauos_v57_diary_history',
    v56: 'lauos_v56_diary_backup',
    old: 'lauraos_diary'
  };
  const state = {
    lastEntries: [],
    lastBackupAt: null,
    lastSupabaseOk: null,
    initialized: false,
    saveWrapped: false,
    renderWrapped: false,
    syncBusy: false
  };

  function $(id) { return document.getElementById(id); }
  function q(sel) { return document.querySelector(sel); }
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
  function sbClient() {
    try { return window.sb || window.supabaseClient || null; }
    catch { return null; }
  }
  async function session() {
    const sb = sbClient();
    if (!sb) return null;
    try {
      const { data } = await sb.auth.getSession();
      return data?.session || null;
    } catch { return null; }
  }
  function storageGet(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.warn('[V57] localStorage falhou:', key, e); return false; }
  }
  function normalizar(item, origem) {
    if (!item) return null;
    const texto = String(item.texto || item.text || item.conteudo || '').trim();
    if (!texto) return null;
    const created = item.created_at || item.criado_em || item.data_iso || item.data || nowISO();
    return {
      id: item.id || `${origem}-${created}-${texto.slice(0, 12)}`,
      texto,
      created_at: created,
      perfil: item.perfil || 'lau',
      origem: item.origem || origem || 'desconhecida'
    };
  }
  function ordenar(lista) {
    return [...(lista || [])].sort((a, b) => new Date(b.created_at || b.data || 0) - new Date(a.created_at || a.data || 0));
  }
  function dedupe(lista) {
    const seen = new Set();
    const out = [];
    (lista || []).forEach((item) => {
      const n = normalizar(item, item?.origem || 'mix');
      if (!n) return;
      const key = `${n.texto.trim()}::${String(n.created_at).slice(0, 16)}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(n);
    });
    return ordenar(out);
  }
  function lerTodosBackupsLocais() {
    const all = [];
    [KEYS.latest, KEYS.v56, KEYS.old].forEach((key) => {
      const val = storageGet(key, []);
      if (Array.isArray(val)) val.forEach((i) => all.push(normalizar(i, key)));
    });
    const history = storageGet(KEYS.history, []);
    if (Array.isArray(history)) history.forEach((snap) => {
      (snap.entries || []).forEach((i) => all.push(normalizar(i, 'history')));
    });
    return dedupe(all);
  }

  async function carregarSupabase() {
    const sb = sbClient();
    const sess = await session();
    if (!sb || !sess?.user || sess.user.email !== EMAIL_LAU) {
      state.lastSupabaseOk = false;
      return [];
    }
    const { data, error } = await sb
      .from('lau_diario')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      state.lastSupabaseOk = false;
      console.warn('[V57] Falha ao carregar diário do Supabase:', error);
      return [];
    }
    state.lastSupabaseOk = true;
    return dedupe(data || []);
  }

  async function coletarDiarioSeguro() {
    const local = lerTodosBackupsLocais();
    const supa = await carregarSupabase();
    const entries = dedupe([...(supa || []), ...(local || [])]);
    state.lastEntries = entries;
    salvarBackupLocal(entries, 'auto-coleta');
    return entries;
  }

  function salvarBackupLocal(entries, motivo) {
    const clean = dedupe(entries || state.lastEntries || []);
    storageSet(KEYS.latest, clean);
    state.lastBackupAt = nowISO();
    const history = storageGet(KEYS.history, []);
    const snapshot = {
      id: `snap-${Date.now()}`,
      created_at: state.lastBackupAt,
      motivo: motivo || 'snapshot',
      total: clean.length,
      entries: clean
    };
    history.unshift(snapshot);
    storageSet(KEYS.history, history.slice(0, 12));
    return snapshot;
  }

  async function salvarSnapshotSupabase(entries, motivo) {
    const sb = sbClient();
    const sess = await session();
    if (!sb || !sess?.user || sess.user.email !== EMAIL_LAU) return false;
    try {
      const payload = {
        user_id: sess.user.id,
        motivo: motivo || 'snapshot',
        total: (entries || []).length,
        dados: entries || []
      };
      const { error } = await sb.from('lau_diario_backups').insert(payload);
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('[V57] Snapshot remoto opcional falhou. Rode o SQL v57 para ativar:', e);
      return false;
    }
  }

  function atualizarStatus() {
    const el = $('v57DiaryStatus');
    if (!el) return;
    const total = state.lastEntries?.length || lerTodosBackupsLocais().length;
    const last = state.lastBackupAt ? dataBR(state.lastBackupAt) : 'ainda não feito nesta sessão';
    const supa = state.lastSupabaseOk === true ? 'Supabase OK' : state.lastSupabaseOk === false ? 'Supabase não confirmado' : 'aguardando teste';
    el.innerHTML = `Proteção ativa: <strong>${total}</strong> anotação(ões) em backup local. Último backup: <strong>${safe(last)}</strong>. ${safe(supa)}.`;
  }

  function inserirPainel() {
    // V59: o cofre continua funcionando por baixo, mas não aparece mais na tela do diário.
    // A aba ficou mais leve e fofinha; backups seguem automáticos no salvamento.
    return;
  }

  function arquivoNome() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `lauos-diario-backup-${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  }

  window.lauosV57ExportarDiario = async function () {
    if (!isLau()) return show('Só a Lau pode exportar o diário 📓');
    const entries = await coletarDiarioSeguro();
    const pacote = {
      app: 'LauOS',
      tipo: 'diario_lau_backup',
      versao: 57,
      exported_at: nowISO(),
      total: entries.length,
      entries
    };
    const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = arquivoNome();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    show(`Backup exportado com ${entries.length} anotação(ões) 📦`);
    atualizarStatus();
  };

  async function importarArquivo(evt) {
    if (!isLau()) return show('Só a Lau pode importar backup 📓');
    const file = evt.target.files?.[0];
    evt.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const entries = Array.isArray(json) ? json : Array.isArray(json.entries) ? json.entries : [];
      if (!entries.length) return show('Esse arquivo não parece ter anotações do diário.');
      await importarEntradas(entries);
    } catch (e) {
      console.error(e);
      show('Não consegui importar esse arquivo JSON.');
    }
  }

  async function importarEntradas(entries) {
    const normalized = dedupe(entries);
    if (!normalized.length) return show('Nenhuma anotação válida para importar.');
    const atual = await coletarDiarioSeguro();
    const merged = dedupe([...normalized, ...atual]);
    salvarBackupLocal(merged, 'importacao-manual');

    const sb = sbClient();
    const sess = await session();
    let inseridas = 0;
    if (sb && sess?.user?.email === EMAIL_LAU) {
      const existentes = new Set(atual.map((e) => `${String(e.texto).trim()}::${String(e.created_at).slice(0, 16)}`));
      const novas = normalized.filter((e) => !existentes.has(`${String(e.texto).trim()}::${String(e.created_at).slice(0, 16)}`));
      for (const item of novas) {
        try {
          const { error } = await sb.from('lau_diario').insert({
            user_id: sess.user.id,
            perfil: 'lau',
            texto: item.texto,
            created_at: item.created_at || nowISO()
          });
          if (!error) inseridas += 1;
          else console.warn('[V57] Importação parcial falhou em uma linha:', error);
        } catch (e) { console.warn('[V57] Importação parcial falhou:', e); }
      }
    }

    await coletarDiarioSeguro();
    if (typeof window.renderizarHistoricoDiarioModal === 'function') window.renderizarHistoricoDiarioModal();
    if (typeof window.renderizarDiarioLivroLau === 'function') window.renderizarDiarioLivroLau();
    show(`Backup importado. ${merged.length} anotação(ões) protegidas. ${inseridas} enviada(s) ao Supabase.`);
    atualizarStatus();
  }

  window.lauosV57SincronizarDiario = async function () {
    if (!isLau()) return show('Só a Lau pode blindar o diário 📓');
    if (state.syncBusy) return;
    state.syncBusy = true;
    try {
      const entries = await coletarDiarioSeguro();
      const snapLocal = salvarBackupLocal(entries, 'blindagem-manual');
      const snapRemote = await salvarSnapshotSupabase(entries, 'blindagem-manual');
      if (typeof window.renderizarHistoricoDiarioModal === 'function') window.renderizarHistoricoDiarioModal();
      if (typeof window.renderizarDiarioLivroLau === 'function') window.renderizarDiarioLivroLau();
      show(snapRemote
        ? `Diário blindado: ${entries.length} anotação(ões), backup local + remoto.`
        : `Diário blindado localmente: ${entries.length} anotação(ões). Rode o SQL v57 para snapshot remoto.`);
      console.log('[V57] Snapshot local:', snapLocal);
    } finally {
      state.syncBusy = false;
      atualizarStatus();
    }
  };

  // Wrapper de salvar: sempre faz snapshot antes e depois.
  function wrapSalvar() {
    if (state.saveWrapped || typeof window.salvarDiarioLau !== 'function') return;
    state.saveWrapped = true;
    const old = window.salvarDiarioLau;
    window.salvarDiarioLau = async function () {
      const campo = $('diaryText');
      const texto = (campo?.value || '').trim();
      if (texto && isLau()) {
        const before = await coletarDiarioSeguro();
        salvarBackupLocal([{ texto, created_at: nowISO(), origem: 'pre-save' }, ...before], 'antes-de-salvar');
      }
      const result = await old.apply(this, arguments);
      if (isLau()) {
        const after = await coletarDiarioSeguro();
        salvarBackupLocal(after, 'depois-de-salvar');
        await salvarSnapshotSupabase(after, 'depois-de-salvar');
        atualizarStatus();
      }
      return result;
    };
  }

  function patchEmptyMessage() {
    // V59: sem aviso técnico no diário da Lau. O recomeço aparece apenas no livrinho vazio.
    return;
  }


  async function init() {
    if (!localStorage.getItem('lauraos_usuario')) return;
    inserirPainel();
    wrapSalvar();
    if (isLau()) {
      await coletarDiarioSeguro();
      atualizarStatus();
      patchEmptyMessage();
    }
  }

  const oldApply = window.aplicarPermissao;
  window.aplicarPermissao = function (usuario) {
    const result = typeof oldApply === 'function' ? oldApply(usuario) : undefined;
    setTimeout(init, 500);
    setTimeout(init, 1600);
    return result;
  };

  const oldAbrirDesktop = window.abrirPaginaDesktop;
  window.abrirPaginaDesktop = function (page) {
    const result = typeof oldAbrirDesktop === 'function' ? oldAbrirDesktop(page) : undefined;
    if (page === 'diario') setTimeout(init, 220);
    return result;
  };
  const oldAbrirMobile = window.abrirPaginaMobile;
  window.abrirPaginaMobile = function (page) {
    const result = typeof oldAbrirMobile === 'function' ? oldAbrirMobile(page) : undefined;
    if (page === 'diario') setTimeout(init, 220);
    return result;
  };

  window.addEventListener('load', () => {
    setTimeout(init, 900);
    setTimeout(init, 2400);
  });
  window.addEventListener('beforeunload', () => {
    if (state.lastEntries?.length) salvarBackupLocal(state.lastEntries, 'beforeunload');
  });
  setInterval(() => {
    if (isLau()) init();
  }, 30000);
})();
