/* LauOS v73 - guardião anti-sumiço global.
   Faz backup no Supabase dos dados locais importantes do app sem poluir a tela. */
(function () {
  'use strict';

  const BACKUP_INTERVAL_MS = 45000;
  const MAX_VALUE_SIZE = 600000; // evita tentar subir base64 gigante demais repetidamente
  const VERSION = 'v73';
  let timer = null;
  let lastHash = '';
  let running = false;

  function getUser() {
    return localStorage.getItem('lauraos_usuario') || (document.body.classList.contains('namorado-mode') ? 'Namorado' : 'Lau');
  }

  function getSupabase() {
    if (window.sb) return window.sb;
    if (window.supabaseClient) return window.supabaseClient;
    try { if (typeof sb !== 'undefined' && sb) return sb; } catch {}
    return null;
  }

  function shouldKeepKey(key) {
    if (!key) return false;
    const lower = key.toLowerCase();
    if (lower.includes('auth-token')) return false;
    if (lower.includes('supabase.auth')) return false;
    if (lower.includes('sb-') && lower.includes('-auth-token')) return false;
    if (lower.includes('password')) return false;
    return lower.startsWith('lauraos_') || lower.startsWith('lauos_');
  }

  function collectLocalState() {
    const keys = Object.keys(localStorage).filter(shouldKeepKey).sort();
    const dados = {};
    const cortados = [];

    keys.forEach((key) => {
      const raw = localStorage.getItem(key) || '';
      if (raw.length > MAX_VALUE_SIZE) {
        dados[key] = {
          tipo: 'valor_grande_ignorado',
          tamanho: raw.length,
          aviso: 'Valor muito grande para backup automático; o dado principal deve estar no Supabase/Storage.'
        };
        cortados.push(key);
        return;
      }
      try { dados[key] = JSON.parse(raw); }
      catch { dados[key] = raw; }
    });

    return {
      versao: VERSION,
      usuario: getUser(),
      url: location.origin + location.pathname,
      salvo_em: new Date().toISOString(),
      total_chaves: keys.length,
      chaves_cortadas: cortados,
      dados
    };
  }

  function hashPayload(payload) {
    try {
      let hash = 0;
      const str = JSON.stringify(payload.dados || {});
      for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
      return String(hash) + ':' + str.length;
    } catch {
      return String(Date.now());
    }
  }

  async function backupNow(reason = 'auto') {
    const client = getSupabase();
    if (!client) return { ok: false, motivo: 'supabase_indisponivel' };
    if (running) return { ok: false, motivo: 'backup_em_andamento' };

    const payload = collectLocalState();
    const currentHash = hashPayload(payload);
    if (reason === 'auto' && currentHash === lastHash) return { ok: true, ignorado: true };

    running = true;
    try {
      const { error } = await client.from('lau_app_backups').insert({
        usuario: payload.usuario,
        origem: reason,
        total_keys: payload.total_chaves,
        payload
      });
      if (error) throw error;
      lastHash = currentHash;
      localStorage.setItem('lauos_last_backup_ok', new Date().toISOString());
      return { ok: true };
    } catch (error) {
      console.warn('[LauOS v73] Backup global não subiu:', error);
      localStorage.setItem('lauos_last_backup_error', String(error?.message || error));
      return { ok: false, erro: error };
    } finally {
      running = false;
    }
  }

  function scheduleBackup(reason) {
    clearTimeout(timer);
    timer = setTimeout(() => backupNow(reason), 1200);
  }

  function install() {
    window.LauOSGuardV73 = { backupNow, collectLocalState };

    setTimeout(() => backupNow('entrada'), 2500);
    setInterval(() => backupNow('auto'), BACKUP_INTERVAL_MS);

    document.addEventListener('click', () => scheduleBackup('clique'));
    document.addEventListener('change', () => scheduleBackup('mudanca'));
    document.addEventListener('input', () => scheduleBackup('digitacao'));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) backupNow('saida');
      else backupNow('volta');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
