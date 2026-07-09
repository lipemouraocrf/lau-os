/* LauOS Auth v54
   Login simplificado: a tela só recebe a senha.
   A API escolhe o e-mail correto por área e valida no Supabase. */
(function () {
  if (window.__lauosV53AuthLoaded) return;
  window.__lauosV53AuthLoaded = true;

  let loginEmAndamento = false;

  function el(id) { return document.getElementById(id); }

  function campoPorTipo(tipo) {
    return tipo === 'Lau' ? el('loginPasswordLau') : el('loginPasswordNamorado');
  }

  function erroPorTipo(tipo) {
    return tipo === 'Lau' ? el('loginErrorLau') : el('loginErrorNamorado');
  }

  function hintPorTipo(tipo) {
    return tipo === 'Lau' ? el('loginHintLau') : el('loginHintNamorado');
  }

  function setBotoes(disabled) {
    document.querySelectorAll('.login-card button').forEach((btn) => {
      btn.disabled = disabled;
      btn.style.opacity = disabled ? '0.72' : '';
      btn.style.cursor = disabled ? 'wait' : '';
    });
  }

  function limparErros() {
    const erroLau = el('loginErrorLau');
    const erroNamorado = el('loginErrorNamorado');
    if (erroLau) erroLau.textContent = '';
    if (erroNamorado) erroNamorado.textContent = '';
  }

  async function chamarLoginSeguro(tipo, senha) {
    const resposta = await fetch('/api/lauos-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, senha })
    });

    let payload = null;
    try { payload = await resposta.json(); } catch (error) { payload = null; }

    if (!resposta.ok || !payload?.ok) {
      const msg = payload?.message || 'Não consegui validar o login seguro.';
      const err = new Error(msg);
      err.status = resposta.status;
      err.code = payload?.code;
      throw err;
    }

    return payload;
  }

  async function aplicarSessaoSupabase(session) {
    if (typeof sb === 'undefined' || !sb?.auth?.setSession) {
      throw new Error('Cliente Supabase não encontrado no navegador.');
    }

    if (!session?.access_token || !session?.refresh_token) {
      throw new Error('Sessão inválida recebida do login seguro.');
    }

    const { error } = await sb.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });

    if (error) throw error;
  }

  async function abrirApp(usuario) {
    const loginScreen = el('loginScreen');

    localStorage.setItem('lauraos_usuario', usuario);
    document.body.classList.remove('login-open');
    if (loginScreen) loginScreen.style.display = 'none';

    if (typeof aplicarPermissao === 'function') aplicarPermissao(usuario);
    if (typeof carregarTudoSupabase === 'function') await carregarTudoSupabase();
    if (typeof iniciarRealtimeChat === 'function') iniciarRealtimeChat();

    // v156: não joga toast/mensagem de entrada dentro da tela no mobile.
    // Isso estava virando um bloco solto tipo “Área da Lau aberta” no meio das abas.
  }

  async function entrarSeguro(tipo) {
    if (loginEmAndamento) return;

    limparErros();
    const campo = campoPorTipo(tipo);
    const erro = erroPorTipo(tipo);
    const hint = hintPorTipo(tipo);
    const senha = String(campo?.value || '').trim();

    if (!senha) {
      if (erro) erro.textContent = 'Digite a senha primeiro.';
      return;
    }

    loginEmAndamento = true;
    setBotoes(true);
    if (hint) hint.textContent = 'Verificando senha com segurança...';

    try {
      const payload = await chamarLoginSeguro(tipo, senha);
      await aplicarSessaoSupabase(payload.session);
      if (campo) campo.value = '';
      await abrirApp(payload.usuario || tipo);
    } catch (error) {
      console.error('[LauOS v53 auth]', error);
      if (erro) erro.textContent = error.message || 'Não consegui entrar agora.';
      if (hint) {
        hint.textContent = error.code === 'missing_login_env' || error.code === 'missing_supabase_env'
          ? 'Configure as variáveis de ambiente para ativar esse login.'
          : 'Confira a senha e tente novamente.';
      }
    } finally {
      loginEmAndamento = false;
      setBotoes(false);
    }
  }

  window.entrarPeloCartao = entrarPeloCartao = entrarSeguro;
  window.entrarLauOS = entrarLauOS = function () { return entrarSeguro('Lau'); };

  window.LauOS = window.LauOS || {};
  window.LauOS.authV53 = {
    ativo: true,
    testarApi: function () {
      return fetch('/api/lauos-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'Lau', senha: '__teste__' })
      }).then((r) => r.json().catch(() => ({ status: r.status })));
    }
  };
})();
