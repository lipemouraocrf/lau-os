const { createClient } = require('@supabase/supabase-js');

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function getIp(req) {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.socket?.remoteAddress || 'unknown';
}

const WINDOW_MS = 60 * 1000;
const MAX_ATTEMPTS = 20;
const attempts = new Map();

function rateLimit(req) {
  const ip = getIp(req);
  const now = Date.now();
  const current = attempts.get(ip) || { count: 0, start: now };

  if (now - current.start > WINDOW_MS) {
    attempts.set(ip, { count: 1, start: now });
    return false;
  }

  current.count += 1;
  attempts.set(ip, current);

  return current.count > MAX_ATTEMPTS;
}

function normalizarBody(body) {
  if (!body) return {};

  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }

  return body;
}

function pegarEmailPorTipo(tipo) {
  if (tipo === 'Lau') {
    return process.env.LAUOS_LAU_EMAIL || 'lau@lauos.com';
  }

  if (tipo === 'Namorado') {
    return process.env.LAUOS_NAMORADO_EMAIL || 'lipe@lauos.com';
  }

  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return send(res, 200, { ok: true });
  }

  if (req.method !== 'POST') {
    return send(res, 405, {
      ok: false,
      message: 'Método não permitido.'
    });
  }

  if (rateLimit(req)) {
    return send(res, 429, {
      ok: false,
      message: 'Muitas tentativas. Espera um pouco e tenta de novo.'
    });
  }

  const supabaseUrl = process.env.LAUOS_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.LAUOS_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return send(res, 501, {
      ok: false,
      code: 'missing_supabase_env',
      message: 'Faltam LAUOS_SUPABASE_URL ou LAUOS_SUPABASE_ANON_KEY.'
    });
  }

  const body = normalizarBody(req.body);

  const tipo = body?.tipo === 'Lau'
    ? 'Lau'
    : body?.tipo === 'Namorado'
      ? 'Namorado'
      : null;

  const senhaDigitada = String(body?.senha || '').trim();

  if (!tipo) {
    return send(res, 400, {
      ok: false,
      message: 'Área inválida.'
    });
  }

  if (!senhaDigitada) {
    return send(res, 400, {
      ok: false,
      message: 'Digite a senha primeiro.'
    });
  }

  const email = pegarEmailPorTipo(tipo);

  if (!email) {
    return send(res, 501, {
      ok: false,
      message: 'E-mail do usuário não configurado.'
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senhaDigitada
  });

  if (error || !data?.session) {
    console.error('[LauOS login] Falha no Supabase Auth:', {
      tipo,
      email,
      erro: error?.message || 'sem sessão'
    });

    return send(res, 401, {
      ok: false,
      message: tipo === 'Lau'
        ? 'Senha errada para a área da Lau.'
        : 'Senha errada para a área do namorado.'
    });
  }

  return send(res, 200, {
    ok: true,
    usuario: tipo,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at
    }
  });
};
