/* LauOS LauTime v148 - menu mobile com perfil + voltar LauOS */
(function () {
  'use strict';

  const DATA_URL = '/data/tvtime-import.json';
  const STORE_KEY = 'lauos_watchtime_v120_state';
  const OLD_KEYS = ['lauos_watchtime_v1_state'];
  const POSTER_TTL_MS = 1000 * 60 * 60 * 24 * 30;
  const POSTER_CACHE_VERSION = 133;
  const CLOUD_TABLE = 'lauos_watchtime_state';
  const CLOUD_ROW_ID = 'watchtime_v1';
  const CLOUD_DEBOUNCE_MS = 1400;
  const POSTER_BATCH_LIMIT = 35;
  const EPISODE_MINUTES = 42;
  const MOVIE_MINUTES = 105;

  const state = {
    root: null,
    usuario: 'Namorado',
    data: null,
    loading: false,
    booted: false,
    screen: 'shows',
    side: 'lipe',
    tab: 'watchlist',
    query: '',
    seriesQuery: '',
    movieQuery: '',
    coupleQuery: '',
    lauBackupLoading: false,
    lauBackupMessage: '',
    details: null,
    season: 1,
    addOpen: false,
    addKind: 'show',
    profileSettingsOpen: false,
    moreOpen: false,
    addTitle: '',
    addEpisodes: 10,
    remoteLoading: false,
    remoteError: '',
    remoteResults: { shows: [], movies: [] },
    remoteSeq: 0,
    remoteTimer: null,
    addBusyKey: '',
    toast: '',
    local: loadLocal(),
    activeObserver: null,
    activeTimer: null,
    posterTimer: null,
    posterLoading: false,
    cloudLoading: false,
    cloudSaving: false,
    cloudReady: false,
    cloudPullDone: false,
    cloudTimer: null,
    cloudStatus: 'local',
    cloudError: '',
    cloudLastSync: '',
    cloudApplying: false
  };

  function $(id) { return document.getElementById(id); }
  function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
  function esc(v) { return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])); }
  function nowISO() { return new Date().toISOString(); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, Number(n || 0))); }
  function sideForUser() { return state.usuario === 'Lau' ? 'lau' : 'lipe'; }
  function sideName(side) { return side === 'lau' ? 'Lau' : side === 'juntos' ? 'Juntos' : 'Lipe'; }
  function oppositeSide() { return sideForUser() === 'lau' ? 'lipe' : 'lau'; }
  function ownerTitle() { return state.side === 'juntos' ? 'Vocês' : sideName(state.side); }
  function canEditSide(side) { return side === 'juntos' || side === sideForUser(); }
  function currentSideEditable() { return canEditSide(state.side); }
  function titleSort(a, b) { return String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR'); }
  function cleanTitle(title) { return String(title || 'Sem título').trim() || 'Sem título'; }
  function stripHtml(value) { return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
  function yearFrom(value) { const m = String(value || '').match(/(19|20)\d{2}/); return m ? m[0] : ''; }
  function normalizeText(value) { return cleanTitle(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function compactText(value) { return normalizeText(value).replace(/\s+/g, ''); }
  function titleVariants(title) {
    const raw = cleanTitle(title);
    const noYear = raw.replace(/\s*\((19|20)\d{2}\)\s*$/i, '').trim();
    const noParens = raw.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const noDots = raw.replace(/\./g, '').replace(/\s+/g, ' ').trim();
    const beforeColon = raw.includes(':') ? raw.split(':')[0].trim() : '';
    const ascii = normalizeText(raw);
    const prettyAscii = ascii.replace(/\b(us|uk)\b/g, '').replace(/\s+/g, ' ').trim();
    const list = [raw, noYear, noParens, noDots, beforeColon, prettyAscii];
    return uniqueBy(list.map(cleanTitle).filter((v) => v && v !== 'Sem título'), (v) => compactText(v)).slice(0, 6);
  }
  function tvdbIdFrom(item) {
    const value = item?.ids?.tvdb || item?.tvdb_id || item?.tvdb || '';
    return String(value || '').replace(/\D/g, '');
  }
  function imdbIdFrom(item) {
    const value = item?.ids?.imdb || item?.imdb_id || item?.imdb || '';
    const match = String(value || '').match(/tt\d+/i);
    return match ? match[0].toLowerCase() : '';
  }
  function slug(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function itemKey(kind, uuid) { return `${kind}:${uuid}`; }
  function detailKey(item) { return item ? `${item.kind}:${item.uuid}` : ''; }


  function isRootVisible() {
    try {
      if (!state.root || !document.body.contains(state.root)) return false;
      const cs = getComputedStyle(state.root);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const rect = state.root.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch { return false; }
  }

  function syncActiveClasses() {
    const active = isRootVisible();
    document.body.classList.toggle('lauos-watchtime-active', active);
    document.body.classList.toggle('lauos-watchtime-v120-active', active);
    document.body.classList.toggle('lauos-watchtime-fullscreen-active', active);
    if (active) syncLauTimeShell();
  }

  function syncLauTimeShell() {
    try {
      const labels = qsa('.lauos-v77-tab-label, .lauos-v77-nav small, .lauos-v77-nav span, .lauos-v77-nav b');
      labels.forEach((el) => {
        const txt = (el.textContent || '').trim();
        if (/^(s[eé]rie|s[eé]ries|watchtime)$/i.test(txt)) el.textContent = 'LauTime';
      });
      qsa('.lauos-v77-tab, .lauos-v77-nav a, .lauos-v77-nav button').forEach((el) => {
        const txt = (el.textContent || '').trim();
        if (/s[eé]rie|watchtime|lautime/i.test(txt)) {
          el.setAttribute('title', 'LauTime');
          el.setAttribute('aria-label', 'LauTime');
        }
      });
    } catch {}
  }

  function ensureActiveObserver() {
    if (state.activeObserver || !state.root) return;
    state.activeObserver = new MutationObserver(syncActiveClasses);
    state.activeObserver.observe(state.root, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    if (state.root.parentElement) state.activeObserver.observe(state.root.parentElement, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    if (!state.activeTimer) state.activeTimer = setInterval(syncActiveClasses, 700);
    window.addEventListener('resize', syncActiveClasses, { passive: true });
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      }
    } catch {}
    return { custom_shows: [], custom_movies: [], items: {}, profiles: {} };
  }

  function saveLocal(options = {}) {
    if (!state.local || typeof state.local !== 'object') state.local = {};
    if (!state.local.__watchtime_meta || typeof state.local.__watchtime_meta !== 'object') state.local.__watchtime_meta = {};
    if (!options.silentMeta) {
      state.local.__watchtime_meta.updated_at = nowISO();
      state.local.__watchtime_meta.version = 144;
    }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.local)); } catch {}
    if (!options.skipCloud && !state.cloudApplying) queueCloudSave();
  }

  function ensureLocalShape() {
    if (!state.local || typeof state.local !== 'object') state.local = {};
    if (!state.local.items || typeof state.local.items !== 'object') state.local.items = {};
    if (!state.local.profiles || typeof state.local.profiles !== 'object') state.local.profiles = {};
    if (!Array.isArray(state.local.custom_shows)) state.local.custom_shows = [];
    if (!Array.isArray(state.local.custom_movies)) state.local.custom_movies = [];
    if (!state.local.poster_cache || typeof state.local.poster_cache !== 'object') state.local.poster_cache = {};
    if (!Array.isArray(state.local.deleted_items)) state.local.deleted_items = [];
    if (state.local.poster_cache_version !== POSTER_CACHE_VERSION) {
      const kept = {};
      Object.keys(state.local.poster_cache || {}).forEach((key) => {
        const value = state.local.poster_cache[key];
        if (value && value.poster) kept[key] = value;
      });
      state.local.poster_cache = kept;
      state.local.poster_cache_version = POSTER_CACHE_VERSION;
      saveLocal({ skipCloud: true, silentMeta: true });
    }
  }

  function getItemState(item) {
    ensureLocalShape();
    const current = state.local.items[itemKey(item.kind, item.uuid)] || {};
    return current && typeof current === 'object' ? current : {};
  }

  function patchItem(item, patch, keepDetails = true) {
    ensureLocalShape();
    if (!canEditSide(item?.side || state.side)) {
      state.toast = `Este perfil é da ${sideName(item?.side || state.side)}. Você só altera o seu perfil e o Juntos.`;
      render();
      return;
    }
    const key = itemKey(item.kind, item.uuid);
    state.local.items[key] = { ...(state.local.items[key] || {}), ...patch, updated_at: nowISO() };
    saveLocal();
    if (keepDetails) {
      state.details = key;
      state.season = Number(patch.season || state.season || 1);
    }
    render();
  }

  function episodeKey(season, episode) { return `s${String(season).padStart(2, '0')}e${String(episode).padStart(2, '0')}`; }
  function makeEpisode(season, episode) { return { season, episode, key: episodeKey(season, episode), watched: false, watched_at: null, rating: null }; }
  function makeShow(title, total, side) {
    const qty = clamp(total || 10, 1, 120);
    return {
      kind: 'show',
      uuid: slug('show'),
      title: cleanTitle(title),
      side: side || state.side || sideForUser(),
      user_status: 'quero_ver',
      favorite: false,
      created_at: nowISO(),
      total_episodes: qty,
      watched_episodes: 0,
      progress: 0,
      seasons_count: 1,
      seasons: [{ number: 1, total: qty, watched: 0, episodes: Array.from({ length: qty }, (_, i) => makeEpisode(1, i + 1)) }]
    };
  }
  function makeMovie(title, side) {
    return {
      kind: 'movie',
      uuid: slug('movie'),
      title: cleanTitle(title),
      side: side || state.side || sideForUser(),
      watched: false,
      watched_at: null,
      created_at: nowISO(),
      favorite: false,
      rating: null
    };
  }

  function initials(title) {
    const words = cleanTitle(title)
      .replace(/\([^)]*\)/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .filter((w) => !/^(the|a|an|o|os|as|de|da|do|das|dos|and|e)$/i.test(w));
    return (words.slice(0, 3).map((w) => w[0]).join('') || cleanTitle(title).slice(0, 2)).toUpperCase();
  }

  function colorSeed(title) {
    let h = 0;
    const s = cleanTitle(title);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }


  function posterCacheKey(kind, title) {
    return `${kind}:${cleanTitle(title).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  }

  function posterFields(item) {
    ensureLocalShape();
    const directPoster = item.poster || item.poster_url || item.image || item.image_url || '';
    const directBackdrop = item.backdrop || item.backdrop_url || item.banner || '';
    const cached = state.local.poster_cache[posterCacheKey(item.kind, item.title)] || {};
    const out = {};
    if (directPoster || cached.poster) out.poster = directPoster || cached.poster;
    if (directBackdrop || cached.backdrop || cached.poster) out.backdrop = directBackdrop || cached.backdrop || cached.poster;
    if (cached.source) out.poster_source = cached.source;
    return out;
  }

  function hasPoster(item) {
    const fields = posterFields(item);
    return !!(fields.poster || fields.backdrop);
  }

  function shouldFetchPoster(item) {
    ensureLocalShape();
    if (!item || hasPoster(item)) return false;
    const cached = state.local.poster_cache[posterCacheKey(item.kind, item.title)];
    if (!cached) return true;
    const age = Date.now() - Number(cached.fetched_at || 0);
    if (cached.missing && age < POSTER_TTL_MS) return false;
    if (cached.error && age < 1000 * 60 * 60 * 24) return false;
    return age > POSTER_TTL_MS;
  }

  function upscaleAppleArtwork(url) {
    if (!url) return '';
    return String(url)
      .replace(/\/\d+x\d+bb\.(jpg|png|webp)$/i, '/600x900bb.$1')
      .replace(/100x100bb\.(jpg|png|webp)$/i, '600x900bb.$1');
  }

  async function fetchJson(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6500);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  function fetchJsonp(url, callbackParam = 'callback') {
    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') { reject(new Error('JSONP indisponível')); return; }
      const cb = `lauosJsonp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const sep = url.includes('?') ? '&' : '?';
      const script = document.createElement('script');
      let done = false;
      const timer = setTimeout(() => cleanup(new Error('timeout')), 7500);
      function cleanup(err, data) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { delete window[cb]; } catch { window[cb] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
        if (err) reject(err); else resolve(data);
      }
      window[cb] = (data) => cleanup(null, data);
      script.onerror = () => cleanup(new Error('jsonp'));
      script.src = `${url}${sep}${callbackParam}=${encodeURIComponent(cb)}`;
      document.head.appendChild(script);
    });
  }

  async function fetchAppleJson(url) {
    try { return await fetchJson(url); }
    catch { return await fetchJsonp(url, 'callback'); }
  }

  function uniqueBy(items, pick) {
    const seen = new Set();
    return items.filter((item) => {
      const key = pick(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function scoreRemoteTitle(query, title) {
    const q = compactText(query);
    const t = compactText(title);
    if (!q || !t) return 0;
    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    if (t.includes(q)) return 60;
    return 10;
  }

  function mapTVMazeShow(hit) {
    const show = hit?.show || hit || {};
    const image = show.image || {};
    const title = cleanTitle(show.name || show.title || '');
    return {
      kind: 'show',
      remote_key: `tvmaze-${show.id || compactText(title)}`,
      tvmaze_id: show.id || null,
      title,
      year: yearFrom(show.premiered),
      status: show.status || '',
      genres: Array.isArray(show.genres) ? show.genres : [],
      summary: stripHtml(show.summary || ''),
      poster: image.original || image.medium || '',
      backdrop: image.original || image.medium || '',
      source: 'TVMaze',
      score: Number(hit?.score || 0)
    };
  }

  async function fetchTVMazeShowByTVDB(tvdbId) {
    if (!tvdbId) return null;
    try {
      const show = await fetchJson('https://api.tvmaze.com/lookup/shows?thetvdb=' + encodeURIComponent(tvdbId));
      const mapped = mapTVMazeShow(show);
      return mapped?.title ? mapped : null;
    } catch {
      return null;
    }
  }

  async function searchTVMazeShows(query) {
    const variants = titleVariants(query).slice(0, 5);
    const packs = await Promise.allSettled(variants.map((q) => fetchJson('https://api.tvmaze.com/search/shows?q=' + encodeURIComponent(q))));
    const items = packs.flatMap((r) => r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []);
    const mapped = items.map(mapTVMazeShow).filter((s) => s.title);
    return uniqueBy(mapped, (s) => String(s.tvmaze_id || compactText(s.title))).sort((a, b) => (scoreRemoteTitle(query, b.title) + b.score) - (scoreRemoteTitle(query, a.title) + a.score)).slice(0, 12);
  }

  function mapAppleMovie(item) {
    const title = cleanTitle(item?.trackName || item?.collectionName || '');
    const poster = upscaleAppleArtwork(item?.artworkUrl100 || item?.artworkUrl60 || '');
    return {
      kind: 'movie',
      remote_key: `apple-${item?.trackId || item?.collectionId || compactText(title)}`,
      apple_id: item?.trackId || item?.collectionId || null,
      imdb_id: '',
      title,
      year: yearFrom(item?.releaseDate),
      genres: item?.primaryGenreName ? [item.primaryGenreName] : [],
      summary: item?.longDescription || item?.shortDescription || '',
      poster,
      backdrop: poster,
      source: 'Apple',
      score: 0
    };
  }

  function imdbImageFromResult(item) {
    const image = item?.i;
    if (!image) return '';
    if (typeof image === 'string') return image;
    if (Array.isArray(image)) return image[0] || '';
    return image.imageUrl || image.url || '';
  }

  function mapImdbMovie(item) {
    const title = cleanTitle(item?.l || item?.title || '');
    const poster = imdbImageFromResult(item);
    return {
      kind: 'movie',
      remote_key: `imdb-${item?.id || compactText(title)}`,
      apple_id: null,
      imdb_id: item?.id || '',
      title,
      year: String(item?.y || item?.yr || yearFrom(item?.s) || ''),
      genres: [],
      summary: item?.s || '',
      poster,
      backdrop: poster,
      source: 'IMDb',
      score: 0
    };
  }

  async function fetchImdbSuggestion(url) {
    try { return await fetchJson(url); }
    catch { return null; }
  }

  async function fetchImdbPosterById(imdbId) {
    if (!imdbId) return null;
    const data = await fetchImdbSuggestion(`https://v3.sg.media-imdb.com/suggestion/t/${encodeURIComponent(imdbId)}.json`);
    const items = Array.isArray(data?.d) ? data.d : [];
    const found = items.find((it) => String(it.id || '').toLowerCase() === imdbId) || items[0];
    const poster = imdbImageFromResult(found);
    return poster ? { poster, backdrop: poster, source: 'IMDb' } : null;
  }

  async function searchImdbMovies(query) {
    const variants = titleVariants(query).map((q) => compactText(q)).filter(Boolean).slice(0, 4);
    const urls = variants.map((q) => `https://v3.sg.media-imdb.com/suggestion/${encodeURIComponent(q[0] || 't')}/${encodeURIComponent(q)}.json`);
    const packs = await Promise.allSettled(urls.map(fetchImdbSuggestion));
    const items = packs.flatMap((r) => r.status === 'fulfilled' && Array.isArray(r.value?.d) ? r.value.d : []);
    const mapped = items
      .filter((it) => String(it.id || '').startsWith('tt'))
      .filter((it) => !it.qid || /movie|feature|tvMovie/i.test(String(it.qid || it.q || 'movie')))
      .map(mapImdbMovie)
      .filter((m) => m.title);
    return uniqueBy(mapped, (m) => String(m.imdb_id || compactText(m.title))).sort((a, b) => scoreRemoteTitle(query, b.title) - scoreRemoteTitle(query, a.title)).slice(0, 12);
  }

  async function searchAppleMovies(query) {
    const q = cleanTitle(query);
    const variants = titleVariants(q).slice(0, 4);
    const countries = ['BR', 'US', 'PT'];
    const urls = [];
    variants.forEach((term) => countries.forEach((country) => {
      urls.push('https://itunes.apple.com/search?media=movie&entity=movie&limit=12&country=' + country + '&term=' + encodeURIComponent(term));
    }));
    const [applePacks, imdbPack] = await Promise.allSettled([
      Promise.allSettled(urls.map(fetchAppleJson)),
      searchImdbMovies(q)
    ]);
    const appleItems = applePacks.status === 'fulfilled' ? applePacks.value.flatMap((r) => r.status === 'fulfilled' && Array.isArray(r.value?.results) ? r.value.results : []) : [];
    const appleMapped = appleItems.map(mapAppleMovie).filter((m) => m.title);
    const imdbMapped = imdbPack.status === 'fulfilled' ? imdbPack.value : [];
    const mapped = [...appleMapped, ...imdbMapped];
    return uniqueBy(mapped, (m) => String(m.imdb_id || m.apple_id || compactText(m.title))).sort((a, b) => scoreRemoteTitle(q, b.title) - scoreRemoteTitle(q, a.title)).slice(0, 12);
  }

  async function fetchShowPoster(title, item = {}) {
    const tvdbId = tvdbIdFrom(item);
    if (tvdbId) {
      const byTvdb = await fetchTVMazeShowByTVDB(tvdbId);
      if (byTvdb?.poster) return { poster: byTvdb.poster, backdrop: byTvdb.backdrop || byTvdb.poster, source: 'TVMaze' };
    }
    const shows = await searchTVMazeShows(title);
    const found = shows.find((s) => s.poster) || shows[0];
    return found?.poster ? { poster: found.poster, backdrop: found.backdrop || found.poster, source: found.source || 'TVMaze' } : null;
  }

  async function fetchMoviePoster(title, item = {}) {
    const imdbId = imdbIdFrom(item);
    if (imdbId) {
      const byImdb = await fetchImdbPosterById(imdbId);
      if (byImdb?.poster) return byImdb;
    }
    const movies = await searchAppleMovies(title);
    const found = movies.find((m) => m.poster) || movies[0];
    return found?.poster ? { poster: found.poster, backdrop: found.backdrop || found.poster, source: found.source || 'Apple/IMDb' } : null;
  }

  async function fetchPosterForItem(item) {
    return item.kind === 'movie' ? fetchMoviePoster(item.title, item) : fetchShowPoster(item.title, item);
  }

  async function fetchTVMazeEpisodes(tvmazeId) {
    if (!tvmazeId) return [];
    try {
      const data = await fetchJson(`https://api.tvmaze.com/shows/${encodeURIComponent(tvmazeId)}/episodes?specials=0`);
      return Array.isArray(data) ? data.filter((ep) => Number(ep.season || 0) > 0 && Number(ep.number || 0) > 0) : [];
    } catch {
      return [];
    }
  }

  function seasonsFromTVMazeEpisodes(episodes) {
    const bySeason = new Map();
    episodes.forEach((ep) => {
      const seasonNo = Number(ep.season || 1);
      const epNo = Number(ep.number || 1);
      if (!bySeason.has(seasonNo)) bySeason.set(seasonNo, []);
      bySeason.get(seasonNo).push({
        season: seasonNo,
        episode: epNo,
        key: episodeKey(seasonNo, epNo),
        title: ep.name || '',
        airdate: ep.airdate || '',
        watched: false,
        watched_at: null,
        rating: null
      });
    });
    return [...bySeason.entries()].sort((a, b) => a[0] - b[0]).map(([number, eps]) => {
      const ordered = eps.sort((a, b) => a.episode - b.episode);
      return { number, total: ordered.length, watched: 0, episodes: ordered };
    });
  }

  function makeShowFromRemote(result, episodes, side) {
    const seasons = seasonsFromTVMazeEpisodes(episodes);
    const fallback = makeShow(result.title, 10, side);
    const total = seasons.reduce((acc, s) => acc + (s.episodes || []).length, 0) || fallback.total_episodes;
    return {
      ...fallback,
      title: cleanTitle(result.title),
      ids: { tvmaze: result.tvmaze_id || null },
      source: result.source || 'TVMaze',
      poster: result.poster || '',
      backdrop: result.backdrop || result.poster || '',
      summary: result.summary || '',
      year: result.year || '',
      genres: Array.isArray(result.genres) ? result.genres : [],
      tv_status: result.status || '',
      seasons: seasons.length ? seasons : fallback.seasons,
      seasons_count: seasons.length || fallback.seasons_count,
      total_episodes: total,
      watched_episodes: 0,
      progress: 0
    };
  }

  function makeMovieFromRemote(result, side) {
    return {
      ...makeMovie(result.title, side),
      ids: { apple: result.apple_id || null, imdb: result.imdb_id || null },
      source: result.source || 'Apple/IMDb',
      poster: result.poster || '',
      backdrop: result.backdrop || result.poster || '',
      summary: result.summary || '',
      year: result.year || '',
      genres: Array.isArray(result.genres) ? result.genres : []
    };
  }

  function posterCandidateItems() {
    let list = [];
    if (state.screen === 'movies') list = filterBySide(allMovies(), true);
    else if (state.screen === 'couple') list = [...filterBySide(allShows(), true), ...filterBySide(allMovies(), true)];
    else if (state.screen === 'profile') list = [...filterBySide(allShows(), true), ...filterBySide(allMovies(), true)];
    else if (state.screen === 'explore') list = [...allShows(), ...allMovies()].filter((it) => !state.query || cleanTitle(it.title).toLowerCase().includes(String(state.query).toLowerCase()));
    else list = filterBySide(allShows(), true);

    const seen = new Set();
    return list.filter((item) => {
      const key = posterCacheKey(item.kind, item.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return shouldFetchPoster(item);
    }).slice(0, POSTER_BATCH_LIMIT);
  }

  async function hydratePosters() {
    if (state.posterLoading || !state.data) return;
    const candidates = posterCandidateItems();
    if (!candidates.length) return;
    state.posterLoading = true;
    let changed = false;
    ensureLocalShape();
    for (const item of candidates) {
      const key = posterCacheKey(item.kind, item.title);
      try {
        const found = await fetchPosterForItem(item);
        if (found?.poster) {
          state.local.poster_cache[key] = { ...found, fetched_at: Date.now() };
          changed = true;
        } else {
          state.local.poster_cache[key] = { missing: true, fetched_at: Date.now() };
        }
      } catch (err) {
        state.local.poster_cache[key] = { error: true, fetched_at: Date.now() };
      }
      saveLocal({ skipCloud: true, silentMeta: true });
    }
    state.posterLoading = false;
    if (changed) render();
  }

  function schedulePosterHydration() {
    if (!state.data) return;
    clearTimeout(state.posterTimer);
    state.posterTimer = setTimeout(hydratePosters, 450);
  }

  function getSupabaseClient() {
    if (window.sb) return window.sb;
    if (window.supabaseClient) return window.supabaseClient;
    try { if (typeof sb !== 'undefined' && sb) return sb; } catch {}
    return null;
  }

  function cloudUserName() {
    return localStorage.getItem('lauraos_usuario') || state.usuario || 'Namorado';
  }

  function hasMeaningfulLocal() {
    ensureLocalShape();
    return Boolean((state.local.custom_shows || []).length || (state.local.custom_movies || []).length || Object.keys(state.local.items || {}).length || Object.keys(state.local.profiles || {}).length);
  }

  function maxIso(values) {
    return values.filter(Boolean).sort().pop() || '';
  }

  function localUpdatedAt() {
    ensureLocalShape();
    const dates = [state.local.__watchtime_meta?.updated_at];
    (state.local.custom_shows || []).forEach((i) => dates.push(i.updated_at, i.created_at));
    (state.local.custom_movies || []).forEach((i) => dates.push(i.updated_at, i.created_at));
    Object.values(state.local.items || {}).forEach((i) => { if (i && typeof i === 'object') dates.push(i.updated_at, i.created_at); });
    Object.values(state.local.profiles || {}).forEach((i) => { if (i && typeof i === 'object') dates.push(i.updated_at, i.created_at); });
    return maxIso(dates);
  }

  function cloudPayload() {
    ensureLocalShape();
    return {
      custom_shows: JSON.parse(JSON.stringify(state.local.custom_shows || [])),
      custom_movies: JSON.parse(JSON.stringify(state.local.custom_movies || [])),
      items: JSON.parse(JSON.stringify(state.local.items || {})),
      profiles: JSON.parse(JSON.stringify(state.local.profiles || {})),
      __watchtime_meta: {
        ...(state.local.__watchtime_meta || {}),
        updated_at: localUpdatedAt() || nowISO(),
        version: 144,
        saved_by: cloudUserName()
      }
    };
  }

  function applyCloudPayload(payload) {
    if (!payload || typeof payload !== 'object') return false;
    const keepCache = state.local?.poster_cache || {};
    const keepCacheVersion = state.local?.poster_cache_version || POSTER_CACHE_VERSION;
    state.cloudApplying = true;
    state.local = {
      custom_shows: Array.isArray(payload.custom_shows) ? payload.custom_shows : [],
      custom_movies: Array.isArray(payload.custom_movies) ? payload.custom_movies : [],
      items: payload.items && typeof payload.items === 'object' ? payload.items : {},
      profiles: payload.profiles && typeof payload.profiles === 'object' ? payload.profiles : {},
      __watchtime_meta: payload.__watchtime_meta && typeof payload.__watchtime_meta === 'object' ? payload.__watchtime_meta : { updated_at: nowISO(), version: 144 },
      poster_cache: keepCache,
      poster_cache_version: keepCacheVersion
    };
    ensureLocalShape();
    saveLocal({ skipCloud: true, silentMeta: true });
    state.cloudApplying = false;
    return true;
  }

  function cloudStatusLabel() {
    if (state.cloudSaving) return 'salvando…';
    if (state.cloudLoading) return 'sincronizando…';
    if (state.cloudStatus === 'synced') return 'salvo no Supabase';
    if (state.cloudStatus === 'setup') return 'criar tabela';
    if (state.cloudStatus === 'login') return 'login pendente';
    if (state.cloudStatus === 'error') return 'erro no sync';
    return 'local';
  }

  function cloudStatusClass() {
    if (state.cloudSaving || state.cloudLoading) return 'busy';
    if (state.cloudStatus === 'synced') return 'ok';
    if (state.cloudStatus === 'setup' || state.cloudStatus === 'login') return 'warn';
    if (state.cloudStatus === 'error') return 'err';
    return 'local';
  }

  function queueCloudSave() {
    if (!state.booted || !state.cloudPullDone || state.cloudApplying) return;
    clearTimeout(state.cloudTimer);
    state.cloudTimer = setTimeout(() => cloudSaveNow('auto'), CLOUD_DEBOUNCE_MS);
  }

  async function requireCloudSession(client) {
    try {
      const { data } = await client.auth.getSession();
      return data?.session || null;
    } catch { return null; }
  }

  async function cloudPull(options = {}) {
    const client = getSupabaseClient();
    if (!client) {
      state.cloudStatus = 'local';
      state.cloudError = 'Supabase não encontrado na página.';
      state.cloudPullDone = true;
      return;
    }

    state.cloudLoading = true;
    state.cloudError = '';
    render();

    try {
      const session = await requireCloudSession(client);
      if (!session) {
        state.cloudStatus = 'login';
        state.cloudError = 'Entre no LauOS para sincronizar.';
        state.cloudPullDone = true;
        return;
      }

      const { data, error } = await client
        .from(CLOUD_TABLE)
        .select('id,payload,updated_at,updated_by')
        .eq('id', CLOUD_ROW_ID)
        .maybeSingle();

      if (error) throw error;

      const localDate = localUpdatedAt();
      const remotePayload = data?.payload || null;
      const remoteDate = remotePayload?.__watchtime_meta?.updated_at || data?.updated_at || '';

      if (remotePayload && (!localDate || remoteDate >= localDate || options.forceRemote)) {
        applyCloudPayload(remotePayload);
        state.cloudStatus = 'synced';
        state.cloudLastSync = data?.updated_at || remoteDate || nowISO();
      } else if (remotePayload && localDate > remoteDate) {
        state.cloudStatus = 'synced';
        state.cloudLastSync = remoteDate || nowISO();
        state.cloudPullDone = true;
        await cloudSaveNow('auto');
      } else if (!remotePayload && hasMeaningfulLocal()) {
        state.cloudPullDone = true;
        await cloudSaveNow('primeiro_envio');
      } else {
        state.cloudStatus = 'synced';
        state.cloudLastSync = nowISO();
      }
    } catch (error) {
      const msg = String(error?.message || error || 'Erro desconhecido');
      state.cloudError = msg;
      state.cloudStatus = /relation .* does not exist|schema cache|PGRST/i.test(msg) ? 'setup' : 'error';
      console.warn('[LauTime v146] Supabase sync falhou:', error);
    } finally {
      state.cloudLoading = false;
      state.cloudPullDone = true;
      render();
    }
  }

  async function cloudSaveNow(reason = 'manual') {
    const client = getSupabaseClient();
    if (!client || state.cloudApplying) return;

    clearTimeout(state.cloudTimer);
    state.cloudSaving = true;
    state.cloudError = '';
    render();

    try {
      const session = await requireCloudSession(client);
      if (!session) {
        state.cloudStatus = 'login';
        state.cloudError = 'Entre no LauOS para salvar no Supabase.';
        return;
      }

      const payload = cloudPayload();
      const updatedAt = payload.__watchtime_meta.updated_at || nowISO();
      const { error } = await client.from(CLOUD_TABLE).upsert({
        id: CLOUD_ROW_ID,
        payload,
        updated_by: cloudUserName(),
        updated_at: updatedAt
      }, { onConflict: 'id' });
      if (error) throw error;

      state.cloudStatus = 'synced';
      state.cloudLastSync = updatedAt;
      state.cloudError = '';
      if (reason === 'manual') state.toast = 'LauTime salvo no Supabase.';
    } catch (error) {
      const msg = String(error?.message || error || 'Erro desconhecido');
      state.cloudError = msg;
      state.cloudStatus = /relation .* does not exist|schema cache|PGRST/i.test(msg) ? 'setup' : 'error';
      console.warn('[LauTime v146] Save Supabase falhou:', error);
    } finally {
      state.cloudSaving = false;
      render();
    }
  }

  function cloudCard() {
    const last = state.cloudLastSync ? dateShort(state.cloudLastSync) : '';
    const hint = state.cloudStatus === 'synced'
      ? `Pronto para abrir em outro navegador/celular${last ? ` · último sync ${last}` : ''}.`
      : state.cloudStatus === 'setup'
        ? 'Rode o SQL da pasta supabase no Supabase para ativar.'
        : state.cloudStatus === 'login'
          ? 'Faça login no LauOS para conectar.'
          : state.cloudError || 'Por enquanto está usando localStorage.';
    return `<section class="wt-cloud-card-v133 ${cloudStatusClass()}">
      <div><b>☁️ Supabase</b><span>${esc(hint)}</span>${state.cloudError ? `<small>${esc(state.cloudError.slice(0, 180))}</small>` : ''}</div>
      <div class="wt-cloud-actions-v133">
        <button type="button" data-wt-cloud-sync>Baixar do banco</button>
        <button type="button" data-wt-cloud-save>Salvar agora</button>
      </div>
    </section>`;
  }

  function posterHtml(item, size = 'poster') {
    const h = colorSeed(item.title);
    const label = item.kind === 'movie' ? 'Filme' : 'Série';
    const img = item.poster || item.poster_url || item.image || item.image_url || '';
    const style = `--h:${h};`;
    if (img) {
      return `<div class="wt-poster wt-${size} wt-has-image" style="${style}"><img src="${esc(img)}" alt="${esc(item.title)}" loading="lazy" referrerpolicy="no-referrer"><span>${esc(label)}</span></div>`;
    }
    return `<div class="wt-poster wt-${size} wt-fallback-poster" style="${style}"><b>${esc(initials(item.title))}</b><span>${esc(label)}</span></div>`;
  }

  function backdropStyle(items) {
    const list = items.slice(0, 6);
    if (!list.length) return '';
    const featured = list.find((it) => it.backdrop || it.poster);
    if (featured) {
      const img = String(featured.backdrop || featured.poster).replace(/["'\\]/g, '');
      return `background:linear-gradient(90deg,rgba(0,0,0,.92),rgba(0,0,0,.42),rgba(0,0,0,.88)),url("${img}") center/cover no-repeat;`;
    }
    const colors = list.map((it, idx) => `hsl(${colorSeed(it.title)} 78% ${idx % 2 ? 34 : 24}%)`).join(',');
    return `background:linear-gradient(90deg,rgba(0,0,0,.88),rgba(0,0,0,.48),rgba(0,0,0,.9)),linear-gradient(120deg,${colors});`;
  }

  function statusLabel(s) {
    return ({ assistindo: 'Assistindo', quero_ver: 'Quero ver', pausado: 'Pausado', finalizado: 'Finalizada' })[s] || 'Quero ver';
  }

  function dateShort(value) {
    if (!value) return '';
    try { return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { return ''; }
  }

  function epLabel(ep) {
    if (!ep) return 'T01 | E01';
    return `T${String(ep.season).padStart(2, '0')} | E${String(ep.episode).padStart(2, '0')}`;
  }

  function watchedSets(item) {
    const local = getItemState(item);
    return {
      watched: new Set(Array.isArray(local.watched_keys) ? local.watched_keys : []),
      unwatched: new Set(Array.isArray(local.unwatched_keys) ? local.unwatched_keys : [])
    };
  }

  function epWatched(ep, sets) {
    if (sets.unwatched.has(ep.key)) return false;
    if (sets.watched.has(ep.key)) return true;
    return !!ep.watched;
  }

  function computedShow(show) {
    const local = getItemState(show);
    const sets = watchedSets(show);
    let total = 0;
    let watched = 0;
    let next = null;
    let last = null;
    let lastWhen = '';
    const watchedDates = local.watched_dates && typeof local.watched_dates === 'object' ? local.watched_dates : {};
    const seasons = (show.seasons || []).map((season) => {
      const eps = (season.episodes || []).map((ep) => {
        const ok = epWatched(ep, sets);
        const watchedAt = watchedDates[ep.key] || ep.watched_at || '';
        total++;
        if (ok) {
          watched++;
          const when = watchedAt || local.updated_at || '';
          if (!lastWhen || when > lastWhen) {
            lastWhen = when;
            last = { season: ep.season, episode: ep.episode, key: ep.key };
          }
        } else if (!next) {
          next = { season: ep.season, episode: ep.episode, key: ep.key };
        }
        return { ...ep, watched: ok, watched_at: watchedAt || ep.watched_at || null };
      });
      return { ...season, episodes: eps, watched: eps.filter((e) => e.watched).length, total: eps.length };
    });
    if (!total && Number(show.total_episodes || 0) > 0) {
      const qty = Number(show.total_episodes || 1);
      const eps = Array.from({ length: qty }, (_, i) => makeEpisode(1, i + 1));
      return computedShow({ ...show, seasons: [{ number: 1, total: qty, watched: 0, episodes: eps }] });
    }
    const done = total > 0 && watched >= total;
    const side = local.side || show.side || 'lipe';
    const status = local.user_status || (done ? 'finalizado' : watched > 0 ? 'assistindo' : (show.user_status || 'quero_ver'));
    const displayShow = { ...show, ...local };
    return {
      ...displayShow,
      ...posterFields(displayShow),
      seasons,
      side,
      user_status: status,
      favorite: typeof local.favorite === 'boolean' ? local.favorite : !!show.favorite,
      rating: local.rating ?? show.rating ?? null,
      note: local.note ?? show.note ?? '',
      watched_episodes: watched,
      total_episodes: total,
      progress: total ? Math.round((watched / total) * 100) : 0,
      next_episode: next,
      last_episode: last || show.last_episode || null,
      last_watched_at: lastWhen || show.last_watched_at || '',
      is_started: watched > 0,
      is_done: done || status === 'finalizado'
    };
  }

  function computedMovie(movie) {
    const local = getItemState(movie);
    const displayMovie = { ...movie, ...local };
    return {
      ...displayMovie,
      ...posterFields(displayMovie),
      side: local.side || movie.side || 'lipe',
      watched: typeof local.watched === 'boolean' ? local.watched : !!movie.watched,
      watched_at: local.watched_at || movie.watched_at || '',
      favorite: typeof local.favorite === 'boolean' ? local.favorite : !!movie.favorite,
      rating: local.rating ?? movie.rating ?? null,
      note: local.note ?? movie.note ?? ''
    };
  }

  function allShows() {
    ensureLocalShape();
    return [...(state.data?.shows || []), ...state.local.custom_shows]
      .filter((item) => !isDeletedItem('show', item.uuid))
      .map(computedShow);
  }

  function allMovies() {
    ensureLocalShape();
    return [...(state.data?.movies || []), ...state.local.custom_movies]
      .filter((item) => !isDeletedItem('movie', item.uuid))
      .map(computedMovie);
  }

  function sortWatch(a, b) {
    const ad = a.is_done || a.watched ? 1 : 0;
    const bd = b.is_done || b.watched ? 1 : 0;
    if (ad !== bd) return ad - bd;
    const ar = String(a.last_watched_at || a.watched_at || a.created_at || '');
    const br = String(b.last_watched_at || b.watched_at || b.created_at || '');
    if (ar !== br) return br.localeCompare(ar);
    return titleSort(a, b);
  }

  function filterBySide(items, includeDone = true) {
    return items.filter((it) => it.side === state.side && (includeDone || !(it.is_done || it.watched)));
  }

  function resetEpisodeList(seasons) {
    return JSON.parse(JSON.stringify(seasons || [])).map((season) => ({
      ...season,
      watched: 0,
      episodes: (season.episodes || []).map((ep) => ({ ...ep, watched: false, watched_at: null, rating: null }))
    }));
  }

  function cloneItemToSide(item, targetSide) {
    const side = targetSide || state.side || sideForUser();
    const base = JSON.parse(JSON.stringify(item || {}));
    const common = {
      title: cleanTitle(base.title),
      side,
      created_at: nowISO(),
      updated_at: nowISO(),
      ids: base.ids || {},
      source: base.source || '',
      poster: base.poster || base.poster_url || '',
      backdrop: base.backdrop || base.backdrop_url || base.poster || base.poster_url || '',
      summary: base.summary || '',
      year: base.year || '',
      genres: Array.isArray(base.genres) ? base.genres : [],
      favorite: false,
      rating: null,
      note: ''
    };
    if (base.kind === 'movie') {
      return { ...common, kind: 'movie', uuid: slug('movie'), watched: false, watched_at: null, user_status: 'quero_ver' };
    }
    const seasons = resetEpisodeList(base.seasons || []);
    const total = seasons.reduce((acc, season) => acc + (season.episodes || []).length, 0) || Number(base.total_episodes || 10) || 10;
    return {
      ...common,
      kind: 'show',
      uuid: slug('show'),
      user_status: 'quero_ver',
      tv_status: base.tv_status || '',
      seasons: seasons.length ? seasons : makeShow(base.title, total, side).seasons,
      seasons_count: seasons.length || Number(base.seasons_count || 1) || 1,
      total_episodes: total,
      watched_episodes: 0,
      progress: 0,
      watched_keys: [],
      unwatched_keys: [],
      watched_dates: {}
    };
  }

  function itemSameRemote(kind, item, result) {
    if (!item || !result) return false;
    if (compactText(item.title) === compactText(result.title || '')) return true;
    if (kind === 'show' && result.tvmaze_id && (item.ids?.tvmaze === result.tvmaze_id || item.tvmaze_id === result.tvmaze_id)) return true;
    if (kind === 'movie' && result.apple_id && (item.ids?.apple === result.apple_id || item.apple_id === result.apple_id)) return true;
    if (kind === 'movie' && result.imdb_id && (item.ids?.imdb === result.imdb_id || item.imdb_id === result.imdb_id)) return true;
    return false;
  }

  function itemExistsOnSide(kind, result, targetSide) {
    const list = kind === 'movie' ? allMovies() : allShows();
    return list.find((item) => item.side === targetSide && itemSameRemote(kind, item, result));
  }

  function duplicateItemForSide(kind, item, targetSide) {
    ensureLocalShape();
    if (!canEditSide(targetSide)) {
      state.toast = `Você só pode adicionar no seu perfil e no Juntos.`;
      return null;
    }
    if (!item || item.side === targetSide) return item;
    const exists = (kind === 'movie' ? allMovies() : allShows()).find((it) => it.side === targetSide && compactText(it.title) === compactText(item.title));
    if (exists) return exists;
    const cloned = cloneItemToSide({ ...item, kind }, targetSide);
    if (kind === 'movie') state.local.custom_movies.unshift(cloned);
    else state.local.custom_shows.unshift(cloned);
    return cloned;
  }

  function queryFilter(items) {
    const q = String(state.query || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => cleanTitle(it.title).toLowerCase().includes(q));
  }

  function markNext(show) {
    const item = computedShow(show);
    const next = item.next_episode || { season: 1, episode: 1, key: episodeKey(1, 1) };
    const local = getItemState(item);
    const watched = new Set(Array.isArray(local.watched_keys) ? local.watched_keys : []);
    const unwatched = new Set(Array.isArray(local.unwatched_keys) ? local.unwatched_keys : []);
    const dates = local.watched_dates && typeof local.watched_dates === 'object' ? { ...local.watched_dates } : {};
    watched.add(next.key);
    unwatched.delete(next.key);
    dates[next.key] = nowISO();
    patchItem(item, { watched_keys: [...watched], unwatched_keys: [...unwatched], watched_dates: dates, user_status: 'assistindo', side: item.side || state.side, last_marked: next.key }, true);
  }

  function toggleEpisode(show, key) {
    const item = computedShow(show);
    const local = getItemState(item);
    const sets = watchedSets(item);
    const all = item.seasons.flatMap((s) => s.episodes || []);
    const ep = all.find((e) => e.key === key);
    if (!ep) return;
    const watched = new Set(Array.isArray(local.watched_keys) ? local.watched_keys : []);
    const unwatched = new Set(Array.isArray(local.unwatched_keys) ? local.unwatched_keys : []);
    const is = epWatched(ep, sets);
    const dates = local.watched_dates && typeof local.watched_dates === 'object' ? { ...local.watched_dates } : {};
    if (is) {
      watched.delete(ep.key);
      unwatched.add(ep.key);
      delete dates[ep.key];
    } else {
      watched.add(ep.key);
      unwatched.delete(ep.key);
      dates[ep.key] = nowISO();
    }
    patchItem(item, { watched_keys: [...watched], unwatched_keys: [...unwatched], watched_dates: dates, user_status: watched.size ? 'assistindo' : 'quero_ver', season: ep.season }, true);
  }

  function setScreen(screen) {
    state.screen = screen;
    state.moreOpen = false;
    remoteReset();
    state.details = null;
    state.addOpen = false;
    if (screen === 'shows') state.tab = 'watchlist';
    if (screen === 'movies') state.tab = 'watchlist';
    if (screen === 'couple') state.tab = 'watchlist';
    render();
  }

  function setSide(side) {
    const wasCouple = state.screen === 'couple';
    state.side = side;
    state.moreOpen = false;
    state.details = null;
    state.addOpen = false;
    if (side === 'juntos') state.screen = 'couple';
    else if (wasCouple) state.screen = 'shows';
    render();
  }

  function setTab(tab) {
    state.tab = tab;
    state.details = null;
    render();
  }

  function openDetails(kind, uuid) {
    state.details = `${kind}:${uuid}`;
    const item = findItem(kind, uuid);
    state.season = item?.seasons?.[0]?.number || 1;
    render();
  }

  function closeDetails() { state.details = null; render(); }

  function findItem(kind, uuid) {
    const list = kind === 'movie' ? allMovies() : allShows();
    return list.find((i) => String(i.uuid) === String(uuid));
  }

  function isDeletedItem(kind, uuid) {
    ensureLocalShape();
    return state.local.deleted_items.includes(`${kind}:${uuid}`);
  }

  function removeItem(kind, uuid) {
    ensureLocalShape();
    const item = findItem(kind, uuid);
    if (item && !canEditSide(item.side)) {
      state.toast = `Este perfil é da ${sideName(item.side)}. Você só altera o seu perfil e o Juntos.`;
      render();
      return;
    }
    const key = `${kind}:${uuid}`;
    const listName = kind === 'movie' ? 'custom_movies' : 'custom_shows';
    const before = state.local[listName].length;
    state.local[listName] = state.local[listName].filter((item) => String(item.uuid) !== String(uuid));
    delete state.local.items[key];
    if (state.local[listName].length === before && !state.local.deleted_items.includes(key)) {
      state.local.deleted_items.push(key);
    }
    state.details = null;
    saveLocal();
    render();
  }

  function setSeasonWatched(show, seasonNumber, shouldWatch) {
    const item = computedShow(show);
    const local = getItemState(item);
    const watched = new Set(Array.isArray(local.watched_keys) ? local.watched_keys : []);
    const unwatched = new Set(Array.isArray(local.unwatched_keys) ? local.unwatched_keys : []);
    const dates = local.watched_dates && typeof local.watched_dates === 'object' ? { ...local.watched_dates } : {};
    const season = (item.seasons || []).find((s) => Number(s.number) === Number(seasonNumber));
    if (!season) return;
    (season.episodes || []).forEach((ep) => {
      if (shouldWatch) {
        watched.add(ep.key);
        unwatched.delete(ep.key);
        dates[ep.key] = dates[ep.key] || nowISO();
      } else {
        watched.delete(ep.key);
        unwatched.add(ep.key);
        delete dates[ep.key];
      }
    });
    patchItem(item, { watched_keys: [...watched], unwatched_keys: [...unwatched], watched_dates: dates, user_status: shouldWatch ? 'assistindo' : 'quero_ver', season: Number(seasonNumber) }, true);
  }

  function setAllEpisodesWatched(show, shouldWatch) {
    const item = computedShow(show);
    const local = getItemState(item);
    const watched = new Set(Array.isArray(local.watched_keys) ? local.watched_keys : []);
    const unwatched = new Set(Array.isArray(local.unwatched_keys) ? local.unwatched_keys : []);
    const dates = local.watched_dates && typeof local.watched_dates === 'object' ? { ...local.watched_dates } : {};
    (item.seasons || []).forEach((season) => (season.episodes || []).forEach((ep) => {
      if (shouldWatch) {
        watched.add(ep.key);
        unwatched.delete(ep.key);
        dates[ep.key] = dates[ep.key] || nowISO();
      } else {
        watched.delete(ep.key);
        unwatched.add(ep.key);
        delete dates[ep.key];
      }
    }));
    patchItem(item, { watched_keys: [...watched], unwatched_keys: [...unwatched], watched_dates: dates, user_status: shouldWatch ? 'finalizado' : 'quero_ver' }, true);
  }

  function addCustom() {
    const title = cleanTitle(state.addTitle);
    if (!title || title === 'Sem título') return;
    ensureLocalShape();
    if (!currentSideEditable()) {
      state.toast = `Você só pode adicionar no seu perfil e no Juntos.`;
      render();
      return;
    }
    if (state.addKind === 'movie') state.local.custom_movies.unshift(makeMovie(title, state.side));
    else state.local.custom_shows.unshift(makeShow(title, state.addEpisodes, state.side));
    state.addTitle = '';
    state.addEpisodes = 10;
    state.addOpen = false;
    if (state.side === 'juntos') state.screen = 'couple';
    saveLocal();
    render();
  }

  function remoteReset(keepQuery = false) {
    clearTimeout(state.remoteTimer);
    state.remoteLoading = false;
    state.remoteError = '';
    state.remoteResults = { shows: [], movies: [] };
    state.addBusyKey = '';
    if (!keepQuery) state.query = '';
  }

  function scheduleRemoteSearch() {
    const q = String(state.query || '').trim();
    clearTimeout(state.remoteTimer);
    state.remoteError = '';
    if (q.length < 2) {
      state.remoteLoading = false;
      state.remoteResults = { shows: [], movies: [] };
      return;
    }
    const seq = ++state.remoteSeq;
    state.remoteLoading = true;
    state.remoteTimer = setTimeout(() => runRemoteSearch(q, seq), 420);
  }

  async function runRemoteSearch(query, seq) {
    try {
      const [shows, movies] = await Promise.allSettled([searchTVMazeShows(query), searchAppleMovies(query)]);
      if (seq !== state.remoteSeq) return;
      state.remoteResults = {
        shows: shows.status === 'fulfilled' ? shows.value : [],
        movies: movies.status === 'fulfilled' ? movies.value : []
      };
      state.remoteError = '';
    } catch (err) {
      if (seq !== state.remoteSeq) return;
      state.remoteError = 'Não consegui buscar agora. Dá mais uma tentativa.';
      state.remoteResults = { shows: [], movies: [] };
    } finally {
      if (seq === state.remoteSeq) {
        state.remoteLoading = false;
        render();
      }
    }
  }

  function remoteDuplicate(kind, result) {
    const list = kind === 'movie' ? allMovies() : allShows();
    return list.find((item) => itemSameRemote(kind, item, result));
  }

  function findRemoteResult(kind, key) {
    const list = kind === 'movie' ? state.remoteResults.movies : state.remoteResults.shows;
    return (list || []).find((item) => String(item.remote_key) === String(key));
  }

  async function addRemote(kind, key) {
    const result = findRemoteResult(kind, key);
    if (!result) return;
    const busy = `${kind}:${key}`;
    state.addBusyKey = busy;
    render();
    try {
      ensureLocalShape();
      const targetSide = state.side || sideForUser();
      if (!canEditSide(targetSide)) {
        state.toast = `Você só pode adicionar no seu perfil e no Juntos.`;
        state.addBusyKey = '';
        render();
        return;
      }
      const existingSameSide = itemExistsOnSide(kind, result, targetSide);
      if (existingSameSide) {
        state.toast = `${existingSameSide.title} já está em ${sideName(targetSide)}.`;
        state.screen = targetSide === 'juntos' ? 'couple' : (kind === 'movie' ? 'movies' : 'shows');
        state.tab = 'watchlist';
        remoteReset();
        render();
        return;
      }
      const existing = remoteDuplicate(kind, result);
      if (existing) {
        duplicateItemForSide(kind, existing, targetSide);
        state.toast = `${existing.title} copiado para ${sideName(targetSide)} sem sumir de ${sideName(existing.side)}.`;
        state.screen = targetSide === 'juntos' ? 'couple' : (kind === 'movie' ? 'movies' : 'shows');
        state.tab = 'watchlist';
        remoteReset();
        saveLocal();
        render();
        return;
      }
      if (kind === 'movie') {
        state.local.custom_movies.unshift(makeMovieFromRemote(result, targetSide));
        state.screen = targetSide === 'juntos' ? 'couple' : 'movies';
      } else {
        const episodes = await fetchTVMazeEpisodes(result.tvmaze_id);
        state.local.custom_shows.unshift(makeShowFromRemote(result, episodes, targetSide));
        state.screen = targetSide === 'juntos' ? 'couple' : 'shows';
      }
      state.tab = 'watchlist';
      state.toast = `${result.title} adicionado em ${sideName(targetSide)}.`;
      remoteReset();
      saveLocal();
      render();
    } catch (err) {
      state.addBusyKey = '';
      state.remoteError = 'Achei, mas não consegui adicionar. Tenta de novo.';
      render();
    }
  }

  function remoteCard(item) {
    const kind = item.kind === 'movie' ? 'movie' : 'show';
    const exists = !!remoteDuplicate(kind, item);
    const busy = state.addBusyKey === `${kind}:${item.remote_key}`;
    const meta = [item.year, (item.genres || []).slice(0, 2).join(' · '), item.source].filter(Boolean).join(' · ');
    return `<article class="wt-remote-card-v130">
      ${posterHtml(item, kind === 'movie' ? 'movieposter' : 'card')}
      <div class="wt-remote-info-v130">
        <strong>${esc(item.title)}</strong>
        <span>${esc(meta || (kind === 'movie' ? 'Filme' : 'Série'))}</span>
        ${item.summary ? `<p>${esc(item.summary.slice(0, 150))}${item.summary.length > 150 ? '…' : ''}</p>` : ''}
      </div>
      <button type="button" class="wt-remote-add-v130 ${exists ? 'exists' : ''}" data-wt-add-remote="${kind}:${esc(item.remote_key)}" ${busy ? 'disabled' : ''}>${busy ? 'Adicionando…' : exists ? 'Copiar pra cá' : 'Adicionar'}</button>
    </article>`;
  }

  function remoteSection(title, items, emptyText) {
    if (items.length) return `<section class="wt-remote-block-v130"><div class="wt-remote-title-v130">${esc(title)}</div><div class="wt-remote-list-v130">${items.map(remoteCard).join('')}</div></section>`;
    if (!String(state.query || '').trim() || state.remoteLoading) return '';
    return `<section class="wt-remote-block-v130"><div class="wt-remote-title-v130">${esc(title)}</div>${emptyState('Nada encontrado aqui.', emptyText)}</section>`;
  }

  function remoteSearchPanel() {
    const q = String(state.query || '').trim();
    if (q.length < 2) return `<section class="wt-remote-hint-v130"><b>Busca real ligada</b><span>Digite o nome de uma série ou filme. Ex.: Friends, Breaking Bad, Interestelar.</span></section>`;
    return `<section class="wt-remote-shell-v130">
      <div class="wt-remote-status-v130"><b>Resultados reais para “${esc(q)}”</b>${state.remoteLoading ? '<span>buscando poster, ano e detalhes…</span>' : state.remoteError ? `<span class="err">${esc(state.remoteError)}</span>` : '<span>toque em adicionar para salvar na lista</span>'}</div>
      ${remoteSection('Séries da internet', state.remoteResults.shows || [], 'Tenta o nome original em inglês se for uma série muito nova.')}
      ${remoteSection('Filmes da internet', state.remoteResults.movies || [], 'Tenta o título original se o nome em português não aparecer.')}
    </section>`;
  }


  function matchesCoupleQuery(item, qNorm) {
    if (!qNorm) return true;
    return [item.title, item.original_title, item.name, item.year, item.summary, Array.isArray(item.genres) ? item.genres.join(' ') : item.genre]
      .some((value) => normalizeText(value || '').includes(qNorm));
  }

  function coupleFilterButton(tab, label, count) {
    return `<button type="button" class="wt-couple-filter-v144 ${state.tab === tab ? 'active' : ''}" data-wt-tab="${esc(tab)}"><span>${esc(label)}</span><b>${esc(count)}</b></button>`;
  }

  function coupleMixedGrid(items, emptyTitle, emptyHint = '') {
    if (!items.length) return emptyState(emptyTitle, emptyHint || 'Adiciona algo em Juntos pela busca.');
    return `<div class="wt-couple-mixed-grid-v144">${items.map((item) => item.kind === 'movie' ? coupleMovieCard(item) : coupleMiniShow(item)).join('')}</div>`;
  }

  function coupleMovieList(title, list, hint = '') {
    return `<div class="wt-couple-block-v144"><div class="wt-divider-pill">${esc(title)}</div>${list.length ? `<div class="wt-couple-movie-rail-v132 wt-couple-movie-grid-v144">${list.map(coupleMovieCard).join('')}</div>` : emptyState('Nenhum filme aqui ainda.', hint || 'Vai em Buscar e adiciona um filme para vocês.')}</div>`;
  }

  function coupleShowList(title, list, hint = '') {
    return `<div class="wt-couple-block-v144"><div class="wt-divider-pill">${esc(title)}</div>${list.length ? `<div class="wt-couple-show-list-v132">${list.map((s) => coupleMiniShow(s)).join('')}</div>` : emptyState('Nenhuma série aqui ainda.', hint || 'Adiciona uma série em Juntos.')}</div>`;
  }

  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-wt-jszip]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.JSZip));
        existing.addEventListener('error', () => reject(new Error('Não consegui carregar o leitor de ZIP.')));
        return;
      }
      const script = document.createElement('script');
      script.dataset.wtJszip = '1';
      script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
      script.onload = () => resolve(window.JSZip);
      script.onerror = () => reject(new Error('Não consegui carregar o leitor de ZIP.'));
      document.head.appendChild(script);
    });
  }

  function cleanBackupItem(item, kind, side) {
    const cloned = JSON.parse(JSON.stringify(item || {}));
    cloned.kind = kind;
    cloned.side = side;
    cloned.source = 'backup_lau';
    cloned.imported_at = nowISO();
    if (!cloned.uuid) cloned.uuid = slug(kind === 'movie' ? 'movie-lau' : 'show-lau');
    return cloned;
  }

  function backupTitleKey(item, kind) {
    return `${kind}:${normalizeText(item.title || item.name || '')}:${String(item.year || '')}`;
  }

  function importLauBackupPayload(payload) {
    ensureLocalShape();
    const shows = Array.isArray(payload?.shows) ? payload.shows : [];
    const movies = Array.isArray(payload?.movies) ? payload.movies : [];
    if (!shows.length && !movies.length) throw new Error('Não achei séries/filmes dentro desse backup.');

    const existingShows = (state.local.custom_shows || []).filter((i) => i.source !== 'backup_lau');
    const existingMovies = (state.local.custom_movies || []).filter((i) => i.source !== 'backup_lau');
    const used = new Set([...allShows().map((i) => `show:${i.uuid}`), ...allMovies().map((i) => `movie:${i.uuid}`)]);
    const seen = new Set();

    const importedShows = shows.map((item) => cleanBackupItem(item, 'show', 'lau')).filter((item) => {
      const key = backupTitleKey(item, 'show');
      if (!item.title || seen.has(key)) return false;
      seen.add(key);
      if (used.has(`show:${item.uuid}`)) item.uuid = slug('show-lau');
      used.add(`show:${item.uuid}`);
      return true;
    });
    const importedMovies = movies.map((item) => cleanBackupItem(item, 'movie', 'lau')).filter((item) => {
      const key = backupTitleKey(item, 'movie');
      if (!item.title || seen.has(key)) return false;
      seen.add(key);
      if (used.has(`movie:${item.uuid}`)) item.uuid = slug('movie-lau');
      used.add(`movie:${item.uuid}`);
      return true;
    });

    state.local.custom_shows = [...existingShows, ...importedShows];
    state.local.custom_movies = [...existingMovies, ...importedMovies];
    saveLocal();
    state.side = 'lau';
    state.screen = 'profile';
    state.tab = 'watchlist';
    return { shows: importedShows.length, movies: importedMovies.length };
  }

  async function readBackupFile(file) {
    if (!file) throw new Error('Escolhe o arquivo primeiro.');
    const name = String(file.name || '').toLowerCase();
    if (name.endsWith('.json')) {
      const text = await file.text();
      return JSON.parse(text);
    }
    if (!name.endsWith('.zip')) throw new Error('Manda um .zip ou .json do backup.');
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(file);
    const jsonFile = Object.keys(zip.files).find((n) => /tvtime-import\.json$/i.test(n)) || Object.keys(zip.files).find((n) => /\.json$/i.test(n));
    if (!jsonFile) throw new Error('Não achei nenhum JSON dentro do ZIP.');
    const text = await zip.files[jsonFile].async('string');
    return JSON.parse(text);
  }

  async function importLauBackupFromInput(input) {
    const file = input && input.files && input.files[0];
    state.lauBackupLoading = true;
    state.lauBackupMessage = 'Lendo backup da Lau...';
    render();
    try {
      const payload = await readBackupFile(file);
      const result = importLauBackupPayload(payload);
      state.lauBackupMessage = `Importado para Lau: ${result.shows} séries e ${result.movies} filmes.`;
      state.lauBackupLoading = false;
      render();
      cloudSaveNow('manual').catch(() => {});
    } catch (err) {
      state.lauBackupLoading = false;
      state.lauBackupMessage = err?.message || 'Não consegui importar esse backup.';
      render();
    }
  }

  function coupleMiniShow(show, featured = false) {
    const next = show.next_episode || null;
    const main = next ? epLabel(next) : (show.is_done ? 'Finalizada' : 'T01 | E01');
    const sub = show.is_done ? `${show.watched_episodes}/${show.total_episodes} episódios vistos` : (next ? 'Próximo episódio juntos' : 'Começar juntos');
    const remaining = Math.max(0, Number(show.total_episodes || 0) - Number(show.watched_episodes || 0));
    return `<article class="wt-couple-show-card-v132 ${featured ? 'featured' : ''}" data-wt-open="show:${esc(show.uuid)}">
      ${posterHtml(show, featured ? 'detail' : 'thumb')}
      <div class="wt-couple-show-info-v132">
        <span>Série do casal</span>
        <strong>${esc(show.title)}</strong>
        <b>${esc(main)}${remaining && show.is_started && !show.is_done ? ` <small>+${remaining}</small>` : ''}</b>
        <p>${esc(sub)}</p>
        ${progressBar(show.progress)}
      </div>
      <button class="wt-couple-check-v132" type="button" data-wt-next="${esc(show.uuid)}" title="Marcar próximo episódio juntos">${show.is_started ? '✓' : '▶'}</button>
    </article>`;
  }

  function coupleMovieCard(movie) {
    const label = movie.watched ? (dateShort(movie.watched_at) ? `Visto juntos em ${dateShort(movie.watched_at)}` : 'Visto juntos') : 'Filme para ver juntos';
    return `<button type="button" class="wt-couple-movie-card-v132" data-wt-open="movie:${esc(movie.uuid)}">
      ${posterHtml(movie, 'movieposter')}
      <strong>${esc(movie.title)}</strong>
      <span>${esc(label)}</span>
      ${movie.favorite ? '<i>♥</i>' : ''}
    </button>`;
  }

  function coupleHistory(list) {
    if (!list.length) return emptyState('O histórico do casal ainda está vazio.', 'Quando vocês marcarem episódios ou filmes juntos, vai aparecer aqui.');
    return `<div class="wt-couple-history-v132">
      ${list.slice(0, 8).map((it) => `<button type="button" class="wt-couple-history-item-v132" data-wt-open="${it.kind}:${esc(it.uuid)}">
        <span>${it.kind === 'movie' ? '🎬' : '📺'}</span>
        <div><b>${esc(it.title)}</b><small>${esc(it.label)} · ${esc(it.meta)}</small></div>
        <em>${esc(dateShort(it.at) || 'agora')}</em>
      </button>`).join('')}
    </div>`;
  }

  function coupleSection(title, subtitle, content, action = '') {
    return `<section class="wt-couple-section-v132">
      <div class="wt-couple-section-head-v132"><div><h3>${esc(title)}</h3>${subtitle ? `<span>${esc(subtitle)}</span>` : ''}</div>${action}</div>
      ${content}
    </section>`;
  }

  function coupleScreen() {
    if (!['watchlist', 'shows', 'movies', 'watched', 'favorites', 'done', 'all'].includes(state.tab)) state.tab = 'watchlist';

    const baseShows = filterBySide(allShows(), true);
    const baseMovies = filterBySide(allMovies(), true);
    const qRaw = String(state.coupleQuery || '').trim();
    const qNorm = normalizeText(qRaw);
    const shows = baseShows.filter((s) => matchesCoupleQuery(s, qNorm));
    const movies = baseMovies.filter((m) => matchesCoupleQuery(m, qNorm));

    const activeShows = shows.filter((s) => !s.is_done && s.is_started).sort(sortWatch);
    const freshShows = shows.filter((s) => !s.is_done && !s.is_started).sort(titleSort);
    const doneShows = shows.filter((s) => s.is_done).sort(sortWatch);
    const allShowsList = [...activeShows, ...freshShows, ...doneShows];
    const movieQueue = movies.filter((m) => !m.watched).sort(titleSort);
    const watchedMovies = movies.filter((m) => m.watched).sort(sortWatch);
    const allMoviesList = [...movieQueue, ...watchedMovies];
    const favoriteItems = [...shows.filter((s) => s.favorite), ...movies.filter((m) => m.favorite)].sort(titleSort);
    const watchedItems = [...doneShows, ...watchedMovies].sort(sortWatch);
    const filaItems = [...activeShows, ...movieQueue].sort((a, b) => {
      const aw = a.kind === 'movie' ? 1 : 0;
      const bw = b.kind === 'movie' ? 1 : 0;
      if (aw !== bw) return aw - bw;
      return sortWatch(a, b);
    });
    const allMixed = [...activeShows, ...freshShows, ...movieQueue, ...watchedMovies, ...doneShows].sort((a, b) => {
      const aw = a.kind === 'movie' ? (a.watched ? 3 : 1) : (a.is_done ? 4 : a.is_started ? 0 : 2);
      const bw = b.kind === 'movie' ? (b.watched ? 3 : 1) : (b.is_done ? 4 : b.is_started ? 0 : 2);
      if (aw !== bw) return aw - bw;
      return titleSort(a, b);
    });

    let content = '';
    if (state.tab === 'watchlist') {
      content = `<div class="wt-couple-block-v144"><div class="wt-divider-pill">FILA DO CASAL</div>${coupleMixedGrid(filaItems, qNorm ? 'Nada encontrado na fila.' : 'Nada na fila do casal ainda.', qNorm ? 'Limpa a busca ou tenta outro nome.' : 'Adiciona uma série ou filme em Juntos.')}</div>`;
    } else if (state.tab === 'shows') {
      content = `${coupleShowList('SÉRIES DO CASAL', allShowsList, qNorm ? 'Nenhuma série com esse nome.' : 'As séries adicionadas em Juntos aparecem aqui.')}`;
    } else if (state.tab === 'movies') {
      content = `${coupleMovieList('FILMES DO CASAL', allMoviesList, qNorm ? 'Nenhum filme com esse nome.' : 'Os filmes adicionados em Juntos aparecem aqui.')}`;
    } else if (state.tab === 'watched') {
      content = `<div class="wt-couple-block-v144"><div class="wt-divider-pill">VISTOS JUNTOS</div>${coupleMixedGrid(watchedItems, qNorm ? 'Nada visto com esse nome.' : 'Nada marcado como visto juntos ainda.', 'Marque episódios ou filmes como assistidos juntos.')}</div>`;
    } else if (state.tab === 'favorites') {
      content = `<div class="wt-couple-block-v144"><div class="wt-divider-pill">FAVORITOS DO CASAL</div>${coupleMixedGrid(favoriteItems, qNorm ? 'Nenhum favorito com esse nome.' : 'Nada favoritado juntos ainda.', 'Abre uma série ou filme e marca como favorito.')}</div>`;
    } else if (state.tab === 'done') {
      content = `${coupleShowList('SÉRIES FINALIZADAS JUNTOS', doneShows, qNorm ? 'Nenhuma finalizada com esse nome.' : 'Quando finalizar uma série juntos, ela aparece aqui.')}`;
    } else {
      content = `<div class="wt-couple-block-v144"><div class="wt-divider-pill">TUDO DO CASAL</div>${coupleMixedGrid(allMixed, qNorm ? 'Nada encontrado no Juntos.' : 'Nada adicionado em Juntos ainda.', qNorm ? 'Limpa a busca ou tenta outro nome.' : 'Use Buscar para adicionar títulos.')}</div>`;
    }

    const nextItem = filaItems[0] || allMixed[0] || null;
    const nextMini = nextItem
      ? `<button type="button" class="wt-couple-next-mini-v145" data-wt-open="${nextItem.kind}:${esc(nextItem.uuid)}"><span>${nextItem.kind === 'movie' ? '🎬' : '📺'}</span><b>${esc(nextItem.title)}</b><small>${esc(nextItem.kind === 'movie' ? (nextItem.watched ? 'Assistido juntos' : 'Filme na fila') : (nextItem.next_episode ? epLabel(nextItem.next_episode) : nextItem.is_done ? 'Finalizada' : 'Começar juntos'))}</small></button>`
      : '<div class="wt-couple-next-mini-v145 empty"><b>Nada junto ainda</b><small>Use Buscar para adicionar algo no cantinho de vocês.</small></div>';

    return `<main class="wt-page wt-couple-v132 wt-couple-v144 wt-couple-v145">
      <section class="wt-couple-header-v145">
        <div>
          <small>LauTime do casal</small>
          <h2>Juntos</h2>
          <span>${baseShows.length} séries · ${baseMovies.length} filmes</span>
        </div>
        ${nextMini}
        <button type="button" class="wt-search-mini wt-couple-add-v145" data-wt-screen="explore">＋ Buscar para o casal</button>
      </section>

      <section class="wt-couple-board-v144 wt-couple-board-v145">
        <div class="wt-series-search-v141 wt-couple-search-v144">
          <span>⌕</span>
          <input id="wtCoupleSearchInput" type="search" placeholder="Filtrar coisas de vocês..." value="${esc(qRaw)}" autocomplete="off">
          ${qNorm ? `<button type="button" data-wt-couple-clear>Limpar</button>` : ''}
        </div>
        <div class="wt-series-filters wt-series-filters-v141 wt-couple-filters-v144">
          ${coupleFilterButton('watchlist', 'Fila', filaItems.length)}
          ${coupleFilterButton('shows', 'Séries', shows.length)}
          ${coupleFilterButton('movies', 'Filmes', movies.length)}
          ${coupleFilterButton('watched', 'Vistos', watchedItems.length)}
          ${coupleFilterButton('favorites', 'Favoritos', favoriteItems.length)}
          ${coupleFilterButton('done', 'Finalizadas', doneShows.length)}
          ${coupleFilterButton('all', 'Tudo', baseShows.length + baseMovies.length)}
        </div>
        <div class="wt-couple-content-v144">${content}</div>
      </section>
    </main>`;
  }


  function profileStats() {
    const shows = filterBySide(allShows(), true);
    const movies = filterBySide(allMovies(), true);
    const eps = shows.reduce((acc, s) => acc + Number(s.watched_episodes || 0), 0);
    const moviesWatched = movies.filter((m) => m.watched).length;
    const totalMinutes = eps * EPISODE_MINUTES + moviesWatched * MOVIE_MINUTES;
    const months = Math.floor(totalMinutes / 43800);
    const days = Math.floor((totalMinutes % 43800) / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    return {
      shows,
      movies,
      eps,
      moviesWatched,
      totalMinutes,
      months,
      days,
      hours
    };
  }

  function activityItems() {
    const shows = filterBySide(allShows(), true);
    const movies = filterBySide(allMovies(), true);
    const items = [];
    shows.forEach((show) => {
      (show.seasons || []).forEach((season) => {
        (season.episodes || []).forEach((ep) => {
          if (!ep.watched) return;
          items.push({ kind: 'show', uuid: show.uuid, title: show.title, label: epLabel(ep), meta: 'Episódio assistido', at: ep.watched_at || show.last_watched_at || show.updated_at || '' });
        });
      });
    });
    movies.forEach((movie) => {
      if (!movie.watched) return;
      items.push({ kind: 'movie', uuid: movie.uuid, title: movie.title, label: 'Filme', meta: 'Filme assistido', at: movie.watched_at || movie.updated_at || '' });
    });
    return items.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')) || String(a.title).localeCompare(String(b.title), 'pt-BR'));
  }

  function activityFeed(list) {
    if (!list.length) return '';
    return `<section class="wt-live-activity-v129">
      <div class="wt-section-head wt-section-head-compact"><h3><span>↻</span>Atividade recente</h3><span></span></div>
      <div class="wt-activity-list-v129">
        ${list.slice(0, 10).map((it) => `<button type="button" class="wt-activity-item-v129" data-wt-open="${it.kind}:${esc(it.uuid)}"><b>${esc(it.title)}</b><span>${esc(it.label)} · ${esc(it.meta)}</span><small>${esc(dateShort(it.at) || 'agora')}</small></button>`).join('')}
      </div>
    </section>`;
  }

  function topChrome() {
    const last = state.cloudLastSync ? dateShort(state.cloudLastSync) : '';
    const status = cloudStatusLabel();
    const shortStatus = `${status}${last && state.cloudStatus === 'synced' ? ` · ${last}` : ''}`;
    const cloudHint = state.cloudStatus === 'synced'
      ? `Pronto para abrir em outro navegador/celular${last ? ` · último sync ${last}` : ''}.`
      : state.cloudStatus === 'setup'
        ? 'Rode o SQL da pasta supabase no Supabase para ativar.'
        : state.cloudStatus === 'login'
          ? 'Faça login no LauOS para conectar.'
          : state.cloudError || 'Sincronização do LauTime';
    const sideButtons = ['lipe', 'juntos', 'lau'].map((s) => `<button type="button" class="${state.side === s ? 'active' : ''}" data-wt-side="${s}">${esc(sideName(s))}</button>`).join('');
    return `<div class="wt-topbar">
      <div class="wt-brand"><span>💛</span><b>LauTime</b></div>
      <div class="wt-side-switch" role="tablist">${sideButtons}</div>
      <div class="wt-cloud-top-v134 ${cloudStatusClass()}" title="${esc(cloudHint)}">
        <button class="wt-cloud-badge-v133 ${cloudStatusClass()}" type="button" data-wt-cloud-sync><span>☁</span><b>${esc(shortStatus)}</b></button>
        <div class="wt-cloud-actions-top-v134">
          <button type="button" data-wt-cloud-sync>Baixar</button>
          <button type="button" data-wt-cloud-save>Salvar</button>
        </div>
      </div>
      <div class="wt-more-wrap-v148">
        <button class="wt-more ${state.moreOpen ? 'active' : ''}" type="button" title="Menu" data-wt-more-toggle>•••</button>
        ${state.moreOpen ? `<div class="wt-more-menu-v148" role="menu">
          <button type="button" class="wt-more-home-v148" data-wt-home>← Voltar ao LauOS</button>
          <div class="wt-more-label-v148">Perfil ativo</div>
          <div class="wt-more-side-v148" role="tablist">${sideButtons}</div>
          <div class="wt-more-divider-v148"></div>
          <button type="button" data-wt-cloud-sync>☁ Baixar do banco</button>
          <button type="button" data-wt-cloud-save>Salvar agora</button>
        </div>` : ''}
      </div>
    </div>`;
  }

  function bottomNav() {
    const items = state.side === 'juntos'
      ? [
        ['couple', '♥', 'Juntos'],
        ['shows', '▱', 'Séries'],
        ['movies', '▤', 'Filmes'],
        ['explore', '⌕', 'Buscar']
      ]
      : [
        ['shows', '▱', 'Séries'],
        ['movies', '▤', 'Filmes'],
        ['explore', '⌕', 'Explorar'],
        ['profile', '♙', 'Perfil']
      ];
    return `<nav class="wt-bottom-nav">${items.map(([screen, icon, label]) => `<button type="button" class="${state.screen === screen ? 'active' : ''}" data-wt-screen="${screen}"><span>${icon}</span><small>${label}</small></button>`).join('')}</nav>`;
  }

  function sectionTitle(title, right = '', icon = '') {
    return `<div class="wt-section-head"><h3>${icon ? `<span>${icon}</span>` : ''}${esc(title)}</h3>${right ? `<button type="button" data-wt-tab="${esc(right)}">›</button>` : '<span></span>'}</div>`;
  }

  function progressBar(value) {
    const v = clamp(value, 0, 100);
    return `<div class="wt-progress"><i style="width:${v}%"></i></div>`;
  }

  function showRow(show, group = '') {
    const ep = show.next_episode || show.last_episode;
    const main = show.next_episode ? epLabel(show.next_episode) : (show.is_done ? 'Finalizada' : 'T01 | E01');
    const sub = show.next_episode ? `Próximo episódio` : (show.is_done ? `${show.watched_episodes}/${show.total_episodes} episódios vistos` : 'Começar agora');
    return `<article class="wt-watch-row" data-wt-open="show:${esc(show.uuid)}">
      ${posterHtml(show, 'thumb')}
      <div class="wt-row-info">
        <div class="wt-title-pill">${esc(show.title)} ›</div>
        <strong>${esc(main)} ${show.total_episodes > show.watched_episodes && show.is_started ? `<small>+${Math.max(0, show.total_episodes - show.watched_episodes)}</small>` : ''}</strong>
        <p>${esc(sub)}</p>
        ${progressBar(show.progress)}
      </div>
      <button class="wt-check" type="button" data-wt-next="${esc(show.uuid)}" title="${show.is_started ? 'Marcar próximo' : 'Começar'}">${show.is_started ? '✓' : '▶'}</button>
    </article>`;
  }

  function posterCard(item) {
    const kind = item.kind === 'movie' ? 'movie' : 'show';
    const meta = item.kind === 'movie'
      ? (item.watched ? 'Assistido' : 'Minha lista')
      : (item.is_done ? 'Finalizada' : item.is_started ? `${item.watched_episodes}/${item.total_episodes}` : 'Não iniciada');
    return `<button type="button" class="wt-poster-card" data-wt-open="${kind}:${esc(item.uuid)}">
      ${posterHtml(item, 'card')}
      <strong>${esc(item.title)}</strong>
      <small>${esc(meta)}</small>
    </button>`;
  }


  function movieCardTV(movie) {
    const meta = movie.watched
      ? (dateShort(movie.watched_at) ? `Assistido em ${dateShort(movie.watched_at)}` : 'Assistido')
      : 'Minha lista';
    return `<button type="button" class="wt-movie-tv-card" data-wt-open="movie:${esc(movie.uuid)}">
      ${posterHtml(movie, 'movieposter')}
      <strong>${esc(movie.title)}</strong>
      <span>${esc(meta)}</span>
      ${movie.favorite ? '<i>♥</i>' : ''}
    </button>`;
  }

  function movieGridSection(title, list, hint = '') {
    return `<section class="wt-movie-tv-block">
      <div class="wt-movie-tv-label">${esc(title)}</div>
      ${list.length ? `<div class="wt-movie-tv-grid">${list.map(movieCardTV).join('')}</div>` : emptyState('Nenhum filme aqui ainda.', hint || 'Use Explorar para adicionar um filme.')}
    </section>`;
  }

  function horizontalRail(title, items, icon = '') {
    if (!items.length) return '';
    return `<section class="wt-rail-block">${sectionTitle(title, '', icon)}<div class="wt-rail">${items.map(posterCard).join('')}</div></section>`;
  }

  function showRowTV(show) {
    const next = show.next_episode || null;
    const main = next ? epLabel(next) : (show.is_done ? 'Finalizada' : 'T01 | E01');
    const episodeName = show.is_done
      ? `${show.watched_episodes}/${show.total_episodes} episódios vistos`
      : (next ? 'Próximo episódio' : 'Ainda não começou');
    const more = show.total_episodes > show.watched_episodes && show.is_started && !show.is_done ? Math.max(0, show.total_episodes - show.watched_episodes) : 0;
    const status = show.is_done ? 'finalizada' : show.is_started ? 'assistindo' : 'não iniciada';
    return `<article class="wt-tvtime-row wt-tvtime-row-v141" data-wt-open="show:${esc(show.uuid)}">
      <div class="wt-tvtime-poster">${posterHtml(show, 'thumb')}</div>
      <div class="wt-tvtime-info">
        <div class="wt-tvtime-title"><span>${esc(show.title)}</span><b>›</b></div>
        <div class="wt-tvtime-episode"><strong>${esc(main)}</strong>${more ? `<small>+${more}</small>` : ''}</div>
        <p><span>${esc(episodeName)}</span><em>${esc(status)}</em></p>
        ${progressBar(show.progress)}
      </div>
      <button class="wt-tvtime-check" type="button" data-wt-next="${esc(show.uuid)}" title="${show.is_started ? 'Marcar próximo episódio' : 'Começar série'}">${show.is_done ? '↺' : show.is_started ? '✓' : '▶'}</button>
    </article>`;
  }

  function seriesListBlock(label, items, hint = '') {
    if (!items.length) return '';
    return `<div class="wt-tvtime-block wt-tvtime-block-v141"><div class="wt-divider-pill">${esc(label)}</div>${hint ? `<p class="wt-series-block-hint-v141">${esc(hint)}</p>` : ''}<div class="wt-tvtime-list">${items.map(showRowTV).join('')}</div></div>`;
  }

  function seriesFilterButton(tab, label, count) {
    const active = (state.tab || 'watchlist') === tab;
    return `<button class="${active ? 'active' : ''}" data-wt-tab="${esc(tab)}"><span>${esc(label)}</span><b>${esc(count)}</b></button>`;
  }

  function filterShowsBySeriesQuery(items) {
    const q = normalizeText(state.seriesQuery || '');
    if (!q) return items;
    return items.filter((it) => normalizeText(it.title).includes(q));
  }

  function showsScreen() {
    if (!['watchlist', 'active', 'stale', 'soon', 'done', 'favorites', 'all', 'upcoming'].includes(state.tab)) state.tab = 'watchlist';

    const baseAll = filterBySide(allShows(), true);
    const qRaw = String(state.seriesQuery || '').trim();
    const qNorm = normalizeText(qRaw);

    const matchesSeriesQuery = (show) => {
      if (!qNorm) return true;
      return [show.title, show.original_title, show.name, show.year]
        .some((value) => normalizeText(value || '').includes(qNorm));
    };

    const isWatchingShow = (show) => {
      const status = normalizeText(show.user_status || show.status || '');
      return !show.is_done && (
        !!show.is_started ||
        Number(show.watched_episodes || 0) > 0 ||
        status === 'assistindo' ||
        status === 'vendo' ||
        status === 'em andamento'
      );
    };

    const isFreshShow = (show) => !show.is_done && !isWatchingShow(show);
    const searchedAll = baseAll.filter(matchesSeriesQuery);

    const baseActive = baseAll.filter(isWatchingShow).sort(sortWatch);
    const baseFresh = baseAll.filter(isFreshShow).sort(titleSort);
    const baseDone = baseAll.filter((s) => s.is_done).sort(sortWatch);
    const baseFav = baseAll.filter((s) => s.favorite).sort(titleSort);

    const active = searchedAll.filter(isWatchingShow).sort(sortWatch);
    const fresh = searchedAll.filter(isFreshShow).sort(titleSort);
    const done = searchedAll.filter((s) => s.is_done).sort(sortWatch);
    const fav = searchedAll.filter((s) => s.favorite).sort(titleSort);

    const activeForScreen = (!qNorm && !active.length && baseActive.length) ? baseActive : active;
    const freshForScreen = (!qNorm && !fresh.length && baseFresh.length) ? baseFresh : fresh;
    const doneForScreen = (!qNorm && !done.length && baseDone.length) ? baseDone : done;
    const favForScreen = (!qNorm && !fav.length && baseFav.length) ? baseFav : fav;

    const nextUp = activeForScreen.filter((s) => !s.is_done).slice(0, 30);
    const stale = activeForScreen.slice(10);
    const allSorted = [...searchedAll].sort((a, b) => {
      const aw = a.is_done ? 2 : isWatchingShow(a) ? 0 : 1;
      const bw = b.is_done ? 2 : isWatchingShow(b) ? 0 : 1;
      if (aw !== bw) return aw - bw;
      return titleSort(a, b);
    });

    const totalActive = baseActive.length;
    const totalFresh = baseFresh.length;
    const totalDone = baseDone.length;
    const totalFav = baseFav.length;
    const totalStale = Math.max(0, totalActive - 10);
    const tab = state.tab || 'watchlist';
    let rows = '';

    if (tab === 'upcoming') {
      rows = emptyState('Em breve ainda está vazio.', 'Depois a gente puxa estreias e próximos lançamentos automático.');
    } else if (tab === 'watchlist') {
      rows = `${seriesListBlock('PRÓXIMOS EPISÓDIOS', nextUp, 'O que vale clicar agora sem pensar demais.')}${stale.length ? seriesListBlock('PAUSADAS / MAIS ANTIGAS', stale) : ''}${(!nextUp.length ? emptyState(qNorm ? 'Nenhuma série encontrada nesse filtro.' : 'Nada para continuar agora.', qNorm ? 'Tenta outro nome ou limpa a busca.' : 'As séries não iniciadas ficam no filtro “Não iniciadas”.') : '')}`;
    } else if (tab === 'active') {
      rows = `${seriesListBlock('ASSISTINDO', activeForScreen)}${(!activeForScreen.length ? emptyState(qNorm ? 'Nenhuma série assistindo com esse nome.' : 'Você não tem séries em andamento.', 'Quando marcar um episódio, ela entra aqui.') : '')}`;
    } else if (tab === 'stale') {
      const list = stale.length ? stale : activeForScreen.slice(6);
      rows = `${seriesListBlock('PAUSADAS / SEM ASSISTIR HÁ UM TEMPO', list)}${(!list.length ? emptyState(qNorm ? 'Nada pausado com esse nome.' : 'Nenhuma série pausada por enquanto.', 'Milagre: a gaveta das séries está organizada.') : '')}`;
    } else if (tab === 'soon') {
      rows = `${seriesListBlock('NÃO INICIADAS', freshForScreen)}${(!freshForScreen.length ? emptyState(qNorm ? 'Nenhuma não iniciada com esse nome.' : 'Nenhuma série não iniciada.', 'Use Explorar para adicionar uma série.') : '')}`;
    } else if (tab === 'done') {
      rows = `${seriesListBlock('FINALIZADAS', doneForScreen)}${(!doneForScreen.length ? emptyState(qNorm ? 'Nenhuma finalizada com esse nome.' : 'Nenhuma série finalizada.', '') : '')}`;
    } else if (tab === 'favorites') {
      rows = `${seriesListBlock('FAVORITAS', favForScreen)}${(!favForScreen.length ? emptyState(qNorm ? 'Nenhuma favorita com esse nome.' : 'Nenhuma série favorita.', 'Abra uma série e marca o coraçãozinho lá nos detalhes.') : '')}`;
    } else if (tab === 'all') {
      rows = `${seriesListBlock('ASSISTINDO', activeForScreen)}${seriesListBlock('NÃO INICIADAS', freshForScreen)}${seriesListBlock('FINALIZADAS', doneForScreen)}${(!searchedAll.length ? emptyState(qNorm ? 'Nada encontrado na sua lista.' : 'Sua lista de séries está vazia.', qNorm ? 'Limpa a busca ou tenta outro nome.' : 'Vai em Explorar e adiciona a primeira.') : '')}`;
    }

    return `<main class="wt-page wt-page-series wt-series-v125 wt-series-v141 wt-series-v142">
      <div class="wt-series-top-v141">
        <div>
          <h2>Séries</h2>
          <span>${esc(baseAll.length)} séries em ${esc(sideName(state.side))}</span>
        </div>
        <button type="button" class="wt-search-mini" data-wt-screen="explore">＋ Buscar nova</button>
      </div>
      <div class="wt-series-search-v141">
        <span>⌕</span>
        <input id="wtShowsSearchInput" type="search" placeholder="Filtrar séries da sua lista..." value="${esc(qRaw)}" autocomplete="off">
        ${qNorm ? `<button type="button" data-wt-series-clear>Limpar</button>` : ''}
      </div>
      <div class="wt-series-filters wt-series-filters-v141">
        ${seriesFilterButton('watchlist', 'Próximos', totalActive)}
        ${seriesFilterButton('active', 'Assistindo', totalActive)}
        ${seriesFilterButton('stale', 'Pausadas', totalStale)}
        ${seriesFilterButton('soon', 'Não iniciadas', totalFresh)}
        ${seriesFilterButton('done', 'Finalizadas', totalDone)}
        ${seriesFilterButton('favorites', 'Favoritas', totalFav)}
        ${seriesFilterButton('all', 'Todas', baseAll.length)}
      </div>
      <section class="wt-tvtime-content wt-tvtime-content-v141">${rows}</section>
    </main>`;
  }

  function moviesScreen() {
    if (!['watchlist', 'watched', 'favorites', 'all', 'recent', 'upcoming'].includes(state.tab)) state.tab = 'watchlist';

    const baseAll = filterBySide(allMovies(), true);
    const qRaw = String(state.movieQuery || '').trim();
    const qNorm = normalizeText(qRaw);
    const matchesMovieQuery = (movie) => {
      if (!qNorm) return true;
      return [movie.title, movie.original_title, movie.name, movie.year, Array.isArray(movie.genres) ? movie.genres.join(' ') : movie.genre]
        .some((value) => normalizeText(value || '').includes(qNorm));
    };

    const searchedAll = baseAll.filter(matchesMovieQuery);
    const watch = searchedAll.filter((m) => !m.watched).sort(titleSort);
    const watched = searchedAll.filter((m) => m.watched).sort(sortWatch);
    const fav = searchedAll.filter((m) => m.favorite).sort(titleSort);
    const recent = watched.slice(0, 18);

    const totalWatch = baseAll.filter((m) => !m.watched).length;
    const totalWatched = baseAll.filter((m) => m.watched).length;
    const totalFav = baseAll.filter((m) => m.favorite).length;
    const tab = state.tab || 'watchlist';
    let content = '';

    if (tab === 'watchlist') {
      content = `${movieGridSection('QUERO VER', watch, qNorm ? 'Nenhum filme com esse nome na fila.' : 'Use Explorar para adicionar filmes que você quer ver.')}`;
    } else if (tab === 'watched') {
      content = `${movieGridSection('ASSISTIDOS', watched, qNorm ? 'Nenhum filme assistido com esse nome.' : 'Quando marcar um filme como assistido, ele aparece aqui.')}`;
    } else if (tab === 'recent') {
      content = `${movieGridSection('VISTOS RECENTEMENTE', recent, qNorm ? 'Nenhum recente com esse nome.' : 'Os últimos filmes assistidos aparecem aqui.')}`;
    } else if (tab === 'favorites') {
      content = `${movieGridSection('FILMES FAVORITOS', fav, qNorm ? 'Nenhum favorito com esse nome.' : 'Abra um filme e marque como favorito.')}`;
    } else if (tab === 'all') {
      content = `${movieGridSection('QUERO VER', watch, '')}${movieGridSection('ASSISTIDOS', watched, '')}${(!searchedAll.length ? emptyState(qNorm ? 'Nada encontrado na sua lista de filmes.' : 'Sua lista de filmes está vazia.', qNorm ? 'Limpa a busca ou tenta outro nome.' : 'Vai em Explorar e adiciona o primeiro filme.') : '')}`;
    } else if (tab === 'upcoming') {
      content = `<section class="wt-coming-empty"><b>EM BREVE</b><span>Depois vamos puxar lançamentos e estreias automaticamente.</span></section>`;
    }

    return `<main class="wt-page wt-page-movies wt-movies-v126 wt-movies-v143">
      <div class="wt-series-top-v141 wt-movies-top-v143">
        <div>
          <h2>Filmes</h2>
          <span>${esc(baseAll.length)} filmes em ${esc(sideName(state.side))}</span>
        </div>
        <button type="button" class="wt-search-mini" data-wt-screen="explore">＋ Buscar filme</button>
      </div>
      <div class="wt-series-search-v141 wt-movie-search-v143">
        <span>⌕</span>
        <input id="wtMoviesSearchInput" type="search" placeholder="Filtrar filmes da sua lista..." value="${esc(qRaw)}" autocomplete="off">
        ${qNorm ? `<button type="button" data-wt-movie-clear>Limpar</button>` : ''}
      </div>
      <div class="wt-series-filters wt-series-filters-v141 wt-movie-filters-v143">
        ${seriesFilterButton('watchlist', 'Quero ver', totalWatch)}
        ${seriesFilterButton('watched', 'Assistidos', totalWatched)}
        ${seriesFilterButton('recent', 'Recentes', Math.min(18, totalWatched))}
        ${seriesFilterButton('favorites', 'Favoritos', totalFav)}
        ${seriesFilterButton('all', 'Todos', baseAll.length)}
      </div>
      <section class="wt-movie-tv-content wt-movie-tv-content-v143">${content}</section>
    </main>`;
  }

  function exploreScreen() {
    const q = String(state.query || '').trim().toLowerCase();
    const localShows = allShows().filter((s) => !q || cleanTitle(s.title).toLowerCase().includes(q)).slice(0, 18);
    const localMovies = allMovies().filter((m) => !q || cleanTitle(m.title).toLowerCase().includes(q)).slice(0, 18);
    return `<main class="wt-page wt-page-explore wt-explore-v130">
      <div class="wt-explore-head-v130"><h2>Explorar</h2><span>Busca real + cadastro automático</span></div>
      <div class="wt-search-box wt-search-box-v130"><span>⌕</span><input id="wtSearchInput" type="search" placeholder="Buscar série ou filme..." value="${esc(state.query)}" autocomplete="off"></div>
      ${remoteSearchPanel()}
      <div class="wt-add-panel ${state.addOpen ? 'open' : ''}">
        <button class="wt-add-toggle" type="button" data-wt-add-toggle>＋ Adicionar manualmente</button>
        <div class="wt-add-form">
          <div class="wt-kind-switch">
            <button type="button" class="${state.addKind === 'show' ? 'active' : ''}" data-wt-add-kind="show">Série</button>
            <button type="button" class="${state.addKind === 'movie' ? 'active' : ''}" data-wt-add-kind="movie">Filme</button>
          </div>
          <input id="wtAddTitle" type="text" placeholder="Nome" value="${esc(state.addTitle)}">
          ${state.addKind === 'show' ? `<input id="wtAddEpisodes" type="number" min="1" max="120" placeholder="Qtd. episódios" value="${esc(state.addEpisodes)}">` : ''}
          <button type="button" class="wt-primary" data-wt-add-save>Adicionar em ${esc(sideName(state.side))}</button>
        </div>
      </div>
      ${q ? horizontalRail('Já salvos nas suas listas', [...localShows, ...localMovies].slice(0, 18), '✓') : ''}
    </main>`;
  }

  function profileTimeText(stats) {
    const parts = [];
    if (stats.months) parts.push(`${stats.months}m`);
    if (stats.days) parts.push(`${stats.days}d`);
    if (stats.hours || !parts.length) parts.push(`${stats.hours}h`);
    return parts.join(' ');
  }

  function profileMetric(label, value, hint = '') {
    return `<div class="wt-profile-metric-v135"><b>${esc(value)}</b><span>${esc(label)}</span>${hint ? `<small>${esc(hint)}</small>` : ''}</div>`;
  }

  function profileHeroAction(item) {
    if (!item) {
      return `<div class="wt-profile-empty-next-v135">
        <b>Lista pronta pra crescer</b>
        <span>Busca uma série ou filme e joga no perfil. O LauTime organiza o resto.</span>
        <button type="button" data-wt-screen="explore">Buscar agora</button>
      </div>`;
    }
    if (item.kind === 'movie') {
      return `<article class="wt-profile-next-card-v135 movie" data-wt-open="movie:${esc(item.uuid)}">
        ${posterHtml(item, 'thumb')}
        <div class="wt-profile-next-info-v135">
          <span>Filme na fila</span>
          <strong>${esc(item.title)}</strong>
          <p>${item.watched ? 'Já assistido. Bom candidato pra rever ou favoritar.' : 'Pronto pra uma sessão pipoca sem ficar escolhendo 40 minutos.'}</p>
        </div>
        <button type="button" data-wt-movie-watch="${esc(item.uuid)}">${item.watched ? '↺' : '✓'}</button>
      </article>`;
    }
    const next = item.next_episode || null;
    const label = next ? epLabel(next) : (item.is_done ? 'Finalizada' : 'T01 | E01');
    const sub = item.is_done ? `${item.watched_episodes}/${item.total_episodes} episódios vistos` : (item.is_started ? 'Próximo episódio' : 'Começar série');
    return `<article class="wt-profile-next-card-v135" data-wt-open="show:${esc(item.uuid)}">
      ${posterHtml(item, 'thumb')}
      <div class="wt-profile-next-info-v135">
        <span>${esc(sub)}</span>
        <strong>${esc(item.title)}</strong>
        <p><b>${esc(label)}</b> · ${esc(item.progress || 0)}% concluído</p>
        ${progressBar(item.progress || 0)}
      </div>
      <button type="button" data-wt-next="${esc(item.uuid)}">${item.is_started ? '✓' : '▶'}</button>
    </article>`;
  }

  function profileMiniList(title, items, kind, emptyText) {
    if (!items.length) return `<section class="wt-profile-mini-v135"><h3>${esc(title)}</h3>${emptyState(emptyText, 'Use Explorar para adicionar novos títulos.')}</section>`;
    return `<section class="wt-profile-mini-v135">
      <h3>${esc(title)}</h3>
      <div class="wt-profile-mini-list-v135">
        ${items.slice(0, 5).map((item) => {
          const isMovie = kind === 'movie' || item.kind === 'movie';
          const open = `${isMovie ? 'movie' : 'show'}:${esc(item.uuid)}`;
          const meta = isMovie ? (item.watched ? 'Assistido' : 'Quero ver') : (item.next_episode ? epLabel(item.next_episode) : `${item.progress || 0}% visto`);
          return `<button type="button" data-wt-open="${open}"><span>${isMovie ? '🎬' : '📺'}</span><b>${esc(item.title)}</b><small>${esc(meta)}</small></button>`;
        }).join('')}
      </div>
    </section>`;
  }


  function profileConfig() {
    ensureLocalShape();
    const key = state.side || sideForUser();
    const current = state.local.profiles[key] || {};
    return current && typeof current === 'object' ? current : {};
  }

  function profileDefaults() {
    if (state.side === 'juntos') return { name: 'Lipe & Lau', handle: '@juntos', bio: 'LauTime do casal' };
    if (state.side === 'lau') return { name: 'Lau', handle: '@lau', bio: 'Meu LauTime' };
    return { name: 'Lipe', handle: '@lipe', bio: 'Meu LauTime' };
  }

  function profileMeta() {
    const cfg = profileConfig();
    const def = profileDefaults();
    return {
      name: cleanTitle(cfg.name || def.name),
      handle: cleanTitle(cfg.handle || def.handle),
      bio: cleanTitle(cfg.bio || def.bio),
      avatar: String(cfg.avatar || '').trim(),
      cover: String(cfg.cover || '').trim()
    };
  }

  function saveProfileConfig(patch) {
    ensureLocalShape();
    const key = state.side || sideForUser();
    state.local.profiles[key] = { ...(state.local.profiles[key] || {}), ...patch, updated_at: nowISO() };
    saveLocal();
    render();
  }

  function safeBgUrl(value) {
    return String(value || '').trim().replace(/["'\\]/g, '');
  }

  function profileCoverStyle(items) {
    const meta = profileMeta();
    const custom = safeBgUrl(meta.cover);
    if (custom) return `background-image:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.84)),url("${custom}");background-size:cover;background-position:center;`;
    return backdropStyle(items);
  }

  function profileAvatarHtml() {
    const meta = profileMeta();
    const src = safeBgUrl(meta.avatar);
    if (src) return `<div class="wt-avatar wt-profile-avatar-v138"><img src="${esc(src)}" alt="Foto de perfil"></div>`;
    return `<div class="wt-avatar wt-profile-avatar-v138"><span>${esc(initials(meta.name || sideName(state.side)))}</span></div>`;
  }

  function profileSettingsSheet() {
    if (!state.profileSettingsOpen) return '';
    const meta = profileMeta();
    if (!currentSideEditable() && state.side === 'lau') {
      return `<div class="wt-profile-settings-v138">
        <div class="wt-profile-settings-backdrop-v138" data-wt-profile-settings-close></div>
        <section class="wt-profile-settings-card-v138" role="dialog" aria-modal="true" aria-label="Backup da Lau">
          <div class="wt-profile-settings-head-v138">
            <div><small>Lau</small><h3>Backup da Lau</h3></div>
            <button type="button" data-wt-profile-settings-close>×</button>
          </div>
          <p class="wt-profile-settings-tip-v139">Aqui fica só o importador discreto do backup dela. Nome, foto e capa ficam para a Lau alterar no perfil dela.</p>
          ${lauBackupCard(true)}
          <div class="wt-profile-settings-actions-v138"><button type="button" data-wt-profile-settings-close>Fechar</button></div>
        </section>
      </div>`;
    }
    const avatarPreview = safeBgUrl(meta.avatar) ? `<img src="${esc(safeBgUrl(meta.avatar))}" alt="Foto atual">` : `<span>${esc(initials(meta.name || sideName(state.side)))}</span>`;
    const coverPreview = safeBgUrl(meta.cover) ? `style="background-image:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.45)),url('${esc(safeBgUrl(meta.cover))}')"` : '';
    return `<div class="wt-profile-settings-v138">
      <div class="wt-profile-settings-backdrop-v138" data-wt-profile-settings-close></div>
      <section class="wt-profile-settings-card-v138" role="dialog" aria-modal="true" aria-label="Configurar perfil">
        <div class="wt-profile-settings-head-v138">
          <div><small>Perfil</small><h3>Configurar perfil</h3></div>
          <button type="button" data-wt-profile-settings-close>×</button>
        </div>
        <label>Nome do perfil<input id="wtProfileName" type="text" value="${esc(meta.name)}" placeholder="Ex.: Lipe"></label>
        <label>@ do perfil<input id="wtProfileHandle" type="text" value="${esc(meta.handle)}" placeholder="Ex.: @lipe"></label>
        <label>Frase curta<input id="wtProfileBio" type="text" value="${esc(meta.bio)}" placeholder="Ex.: Meu LauTime"></label>

        <div class="wt-profile-media-grid-v139">
          <div class="wt-profile-upload-v139">
            <div class="wt-profile-upload-avatar-v139">${avatarPreview}</div>
            <label>Foto de perfil<input id="wtProfileAvatarFile" type="file" accept="image/*"></label>
            <button type="button" data-wt-profile-avatar-clear>Remover foto</button>
          </div>
          <div class="wt-profile-upload-v139">
            <div class="wt-profile-upload-cover-v139" ${coverPreview}><span>Capa</span></div>
            <label>Capa do perfil<input id="wtProfileCoverFile" type="file" accept="image/*"></label>
            <button type="button" data-wt-profile-settings-reset>Capa automática</button>
          </div>
        </div>

        <p class="wt-profile-settings-tip-v139">Escolhe a imagem direto do PC ou celular. O app reduz a imagem antes de salvar pra não pesar.</p>
        ${state.side === 'lau' ? lauBackupCard(true) : ''}
        <div class="wt-profile-settings-actions-v138">
          <button type="button" data-wt-profile-settings-close>Cancelar</button>
          <button type="button" data-wt-profile-settings-save>Salvar perfil</button>
        </div>
      </section>
    </div>`;
  }

  function readImageFileInput(input, fallback = '', opts = {}) {
    const file = input && input.files && input.files[0];
    if (!file) return Promise.resolve(fallback || '');
    if (!/^image\//i.test(file.type || '')) return Promise.resolve(fallback || '');
    const maxW = opts.maxW || 1200;
    const maxH = opts.maxH || 800;
    const quality = typeof opts.quality === 'number' ? opts.quality : 0.82;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => resolve(fallback || '');
      reader.onload = () => {
        const raw = String(reader.result || '');
        const img = new Image();
        img.onerror = () => resolve(raw || fallback || '');
        img.onload = () => {
          try {
            let w = img.naturalWidth || img.width || maxW;
            let h = img.naturalHeight || img.height || maxH;
            const ratio = Math.min(1, maxW / Math.max(1, w), maxH / Math.max(1, h));
            w = Math.max(1, Math.round(w * ratio));
            h = Math.max(1, Math.round(h * ratio));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } catch (_) {
            resolve(raw || fallback || '');
          }
        };
        img.src = raw;
      };
      reader.readAsDataURL(file);
    });
  }


  function lauBackupCard(compact = false) {
    if (state.side !== 'lau') return '';
    const msg = state.lauBackupMessage ? `<small>${esc(state.lauBackupMessage)}</small>` : '<small>Importar ZIP/JSON do backup dela para o perfil Lau.</small>';
    return `<section class="wt-lau-backup-v144 ${compact ? 'compact' : ''}">
      <div><b>Backup da Lau</b>${msg}</div>
      <label class="wt-lau-backup-btn-v144 ${state.lauBackupLoading ? 'loading' : ''}">
        ${state.lauBackupLoading ? 'Importando...' : 'Importar ZIP'}
        <input id="wtLauBackupFile" type="file" accept=".zip,.json,application/zip,application/json">
      </label>
    </section>`;
  }

  function profileScreen() {
    const stats = profileStats();
    const shows = stats.shows.sort(sortWatch);
    const movies = stats.movies.sort(sortWatch);
    const watching = shows.filter((s) => !s.is_done && s.is_started).sort(sortWatch);
    const notStarted = shows.filter((s) => !s.is_done && !s.is_started).sort(titleSort);
    const doneShows = shows.filter((s) => s.is_done).sort(sortWatch);
    const movieQueue = movies.filter((m) => !m.watched).sort(titleSort);
    const watchedMovies = movies.filter((m) => m.watched).sort(sortWatch);
    const favShows = shows.filter((s) => s.favorite).sort(titleSort);
    const favMovies = movies.filter((m) => m.favorite).sort(titleSort);
    const favoriteTotal = favShows.length + favMovies.length;
    const nextItem = watching[0] || notStarted[0] || movieQueue[0] || watchedMovies[0] || null;
    const averageProgress = shows.length ? Math.round(shows.reduce((acc, s) => acc + Number(s.progress || 0), 0) / shows.length) : 0;
    const heroItems = [nextItem, ...watching, ...movieQueue, ...watchedMovies, ...shows, ...movies].filter(Boolean);

    const meta = profileMeta();

    const canOpenConfig = currentSideEditable() || state.side === 'lau';
    return `<main class="wt-page wt-page-profile wt-profile-v124 wt-profile-v129 wt-profile-v134 wt-profile-v135 wt-profile-v138">
      <section class="wt-profile-command-v135 wt-profile-command-v138" style="${profileCoverStyle(heroItems)}">
        ${canOpenConfig ? '<button type="button" class="wt-profile-config-btn-v138" data-wt-profile-settings title="Configurar perfil">⚙</button>' : ''}
        <div class="wt-profile-command-main-v135">
          <div class="wt-profile-id wt-profile-id-v135">
            ${profileAvatarHtml()}
            <div class="wt-profile-name"><strong>${esc(meta.name)}</strong><span>${esc(meta.handle)} · ${esc(meta.bio)}</span></div>
          </div>
          <div class="wt-profile-quick-stats-v139">
            <button type="button" data-wt-screen="shows"><b>${esc(shows.length)}</b><span>séries</span></button>
            <button type="button" data-wt-screen="movies"><b>${esc(movies.length)}</b><span>filmes</span></button>
            <button type="button" data-wt-screen="explore"><b>＋</b><span>buscar</span></button>
          </div>
        </div>
        <div class="wt-profile-next-v135">
          <span class="wt-profile-label-v135">próximo</span>
          ${profileHeroAction(nextItem)}
        </div>
      </section>

      ${horizontalRail('Assistindo agora', watching.slice(0, 14), '▶')}
      ${horizontalRail('Não iniciadas', notStarted.slice(0, 14), '＋')}
      ${horizontalRail('Favoritos', [...favShows, ...favMovies].slice(0, 16), '♥')}
      ${horizontalRail('Concluídas / vistas', [...doneShows, ...watchedMovies].slice(0, 16), '✓')}
      ${profileSettingsSheet()}
    </main>`;
  }

  function emptyState(title, subtitle) {
    return `<div class="wt-empty"><b>${esc(title)}</b><span>${esc(subtitle || '')}</span></div>`;
  }


  function ratingOptions(value = '') {
    const current = String(value ?? '');
    const opts = ['','1','2','3','4','5'];
    return opts.map((v) => `<option value="${v}" ${current === v ? 'selected' : ''}>${v ? `${v} estrela${v === '1' ? '' : 's'}` : 'Sem nota'}</option>`).join('');
  }

  function sideCopyOptions(currentSide) {
    if (!canEditSide(currentSide)) return `<option value="${esc(currentSide)}" selected>${esc(sideName(currentSide))}</option>`;
    const mine = sideForUser();
    const allowed = uniqueBy([currentSide, mine, 'juntos'].filter(Boolean), (v) => v);
    return allowed.map((side) => `<option value="${esc(side)}" ${side === currentSide ? 'selected' : ''}>${esc(sideName(side))}</option>`).join('');
  }

  function detailBgStyle(item) {
    const img = String(item.backdrop || item.poster || '').replace(/["'\\]/g, '');
    if (!img) return '';
    return `background-image:linear-gradient(180deg,rgba(0,0,0,.10),rgba(0,0,0,.88)),url("${img}");background-size:cover;background-position:center;`;
  }

  function detailMetaChip(label, value) {
    return `<div class="wt-detail-chip"><small>${esc(label)}</small><b>${esc(value || '—')}</b></div>`;
  }

  function detailInfoText(item) {
    const meta = [item.year, Array.isArray(item.genres) ? item.genres.slice(0, 3).join(' · ') : '', item.source].filter(Boolean).join(' · ');
    const summary = stripHtml(item.summary || '');
    if (!meta && !summary) return '';
    return `<section class="wt-detail-section-v127 wt-detail-about-v140">
      <div class="wt-detail-section-head"><h3>Sobre</h3><span>${esc(meta || 'detalhes')}</span></div>
      ${summary ? `<p>${esc(summary)}</p>` : `<p>Sem sinopse cadastrada ainda.</p>`}
    </section>`;
  }

  function detailDangerZone(kind, item) {
    return `<section class="wt-detail-section-v127 wt-detail-danger-v140">
      <button type="button" data-wt-delete="${kind}:${esc(item.uuid)}">Remover da lista</button>
    </section>`;
  }

  function detailEditBox(kind, item) {
    return `<section class="wt-detail-section-v127 wt-detail-edit-v140">
      <details>
        <summary>Editar dados</summary>
        <div class="wt-detail-edit-grid-v140">
          <label>Título<input id="wtEditTitle" type="text" value="${esc(item.title)}"></label>
          <label>Ano<input id="wtEditYear" type="text" value="${esc(item.year || '')}" placeholder="2026"></label>
        </div>
        <label>Sinopse<textarea id="wtEditSummary" placeholder="Sinopse curta...">${esc(item.summary || '')}</textarea></label>
        <button type="button" data-wt-detail-save="${kind}:${esc(item.uuid)}">Salvar edição</button>
      </details>
    </section>`;
  }

  function detailProgressCircle(value) {
    const v = clamp(value, 0, 100);
    return `<div class="wt-progress-ring" style="--p:${v}"><b>${v}%</b><span>visto</span></div>`;
  }

  function nextActionLabel(show) {
    if (show.is_done) return 'Rever / marcar próximo';
    return show.is_started ? 'Marcar próximo episódio' : 'Começar série';
  }

  function episodeLine(show, ep) {
    const checked = ep.watched ? 'checked' : '';
    const title = ep.title || `Episódio ${String(ep.episode).padStart(2, '0')}`;
    return `<button type="button" class="wt-ep-line ${ep.watched ? 'watched' : ''}" data-wt-episode="${esc(show.uuid)}:${esc(ep.key)}">
      <span class="wt-ep-check">${checked ? '✓' : ''}</span>
      <span class="wt-ep-main"><b>E${String(ep.episode).padStart(2, '0')}</b><small>${esc(title)}</small></span>
      <span class="wt-ep-status">${ep.watched ? 'Assistido' : 'Não visto'}</span>
    </button>`;
  }

  function detailSheet() {
    if (!state.details) return '';
    const [kind, uuid] = state.details.split(':');
    const item = findItem(kind, uuid);
    if (!item) return '';
    if (kind === 'movie') return movieDetails(item);
    return showDetails(item);
  }

  function showDetails(show) {
    const seasons = show.seasons || [];
    const currentSeason = seasons.find((s) => Number(s.number) === Number(state.season)) || seasons[0] || { number: 1, episodes: [] };
    const next = show.next_episode || null;
    const last = show.last_episode || null;
    const seasonCount = seasons.length || 1;
    const nextText = next ? epLabel(next) : (show.is_done ? 'Finalizada' : 'T01 | E01');
    const lastText = last ? epLabel(last) : 'Nenhum ainda';
    const statusText = statusLabel(show.user_status);
    return `<div class="wt-sheet wt-detail-v127 show">
      <div class="wt-sheet-backdrop" data-wt-close></div>
      <aside class="wt-sheet-panel wt-detail-panel-v127">
        <button class="wt-close wt-detail-close" type="button" data-wt-close>×</button>
        <section class="wt-detail-hero-v127" style="--h:${colorSeed(show.title)}">
          <div class="wt-detail-bg-v127" style="${detailBgStyle(show)}"></div>
          <div class="wt-detail-main-v127">
            ${posterHtml(show, 'detail')}
            <div class="wt-detail-title-v127">
              <p>Série</p>
              <h2>${esc(show.title)}</h2>
              <div class="wt-detail-tags-v127"><span>${esc(statusText)}</span><span>${esc(sideName(show.side))}</span><span>${seasonCount} temp.</span></div>
            </div>
            ${detailProgressCircle(show.progress)}
          </div>
        </section>

        <section class="wt-detail-action-v127">
          <button class="wt-primary wt-big-action" type="button" data-wt-next="${esc(show.uuid)}">${esc(nextActionLabel(show))}</button>
          <button type="button" class="wt-heart-action ${show.favorite ? 'active' : ''}" data-wt-fav="show:${esc(show.uuid)}">${show.favorite ? '♥ Favorita' : '♡ Favoritar'}</button>
        </section>

        <section class="wt-detail-stats-v127">
          ${detailMetaChip('Próximo', nextText)}
          ${detailMetaChip('Último visto', lastText)}
          ${detailMetaChip('Episódios', `${show.watched_episodes}/${show.total_episodes}`)}
          ${detailMetaChip('Status', statusText)}
        </section>

        <section class="wt-detail-section-v127">
          <div class="wt-detail-section-head"><h3>Organizar</h3><span>lado, status e nota</span></div>
          <div class="wt-detail-controls-v127">
            <label>Copiar para<select data-wt-move="show:${esc(show.uuid)}">${sideCopyOptions(show.side)}</select></label>
            <label>Status<select data-wt-status="show:${esc(show.uuid)}"><option value="quero_ver" ${show.user_status === 'quero_ver' ? 'selected' : ''}>Quero ver</option><option value="assistindo" ${show.user_status === 'assistindo' ? 'selected' : ''}>Assistindo</option><option value="pausado" ${show.user_status === 'pausado' ? 'selected' : ''}>Pausada</option><option value="finalizado" ${show.user_status === 'finalizado' ? 'selected' : ''}>Finalizada</option></select></label>
            <label>Nota<select data-wt-rating="show:${esc(show.uuid)}">${ratingOptions(show.rating)}</select></label>
          </div>
        </section>

        ${detailInfoText(show)}

        <section class="wt-detail-section-v127">
          <div class="wt-detail-section-head"><h3>Temporadas</h3><span>${esc(`T${String(currentSeason.number).padStart(2, '0')}`)}</span></div>
          <div class="wt-season-tabs wt-season-tabs-v127">${seasons.map((s) => `<button type="button" class="${Number(s.number) === Number(currentSeason.number) ? 'active' : ''}" data-wt-season="${esc(s.number)}">T${esc(String(s.number).padStart(2, '0'))}</button>`).join('')}</div>
          <div class="wt-season-actions-v140">
            <button type="button" data-wt-season-watch="${esc(show.uuid)}:${esc(currentSeason.number)}">Marcar temporada</button>
            <button type="button" data-wt-season-clear="${esc(show.uuid)}:${esc(currentSeason.number)}">Limpar temporada</button>
            <button type="button" data-wt-show-complete="${esc(show.uuid)}">Marcar tudo</button>
            <button type="button" data-wt-show-clear="${esc(show.uuid)}">Limpar tudo</button>
          </div>
          <div class="wt-episodes-v127">${(currentSeason.episodes || []).map((ep) => episodeLine(show, ep)).join('') || emptyState('Sem episódios cadastrados.', '')}</div>
        </section>

        <section class="wt-detail-section-v127 wt-note-section-v127">
          <div class="wt-detail-section-head"><h3>Anotação</h3><span>privada/local</span></div>
          <textarea data-wt-note="show:${esc(show.uuid)}" placeholder="Escreva uma observação sobre essa série...">${esc(show.note || '')}</textarea>
        </section>
        ${detailEditBox('show', show)}
        ${detailDangerZone('show', show)}
      </aside>
    </div>`;
  }

  function movieDetails(movie) {
    const watchedText = movie.watched ? `Assistido ${dateShort(movie.watched_at) ? 'em ' + dateShort(movie.watched_at) : ''}` : 'Na minha lista';
    return `<div class="wt-sheet wt-detail-v127 movie">
      <div class="wt-sheet-backdrop" data-wt-close></div>
      <aside class="wt-sheet-panel wt-detail-panel-v127 wt-movie-detail-panel-v127">
        <button class="wt-close wt-detail-close" type="button" data-wt-close>×</button>
        <section class="wt-detail-hero-v127 wt-movie-hero-v127" style="--h:${colorSeed(movie.title)}">
          <div class="wt-detail-bg-v127" style="${detailBgStyle(movie)}"></div>
          <div class="wt-detail-main-v127">
            ${posterHtml(movie, 'detail')}
            <div class="wt-detail-title-v127">
              <p>Filme</p>
              <h2>${esc(movie.title)}</h2>
              <div class="wt-detail-tags-v127"><span>${esc(watchedText || 'Quero ver')}</span><span>${esc(sideName(movie.side))}</span>${movie.favorite ? '<span>Favorito</span>' : ''}</div>
            </div>
          </div>
        </section>

        <section class="wt-detail-action-v127">
          <button class="wt-primary wt-big-action" type="button" data-wt-movie-watch="${esc(movie.uuid)}">${movie.watched ? 'Marcar como não visto' : 'Marcar como assistido'}</button>
          <button type="button" class="wt-heart-action ${movie.favorite ? 'active' : ''}" data-wt-fav="movie:${esc(movie.uuid)}">${movie.favorite ? '♥ Favorito' : '♡ Favoritar'}</button>
        </section>

        <section class="wt-detail-stats-v127 wt-movie-stats-v127">
          ${detailMetaChip('Status', movie.watched ? 'Assistido' : 'Quero ver')}
          ${detailMetaChip('Lado', sideName(movie.side))}
          ${detailMetaChip('Data', movie.watched ? (dateShort(movie.watched_at) || 'Hoje') : '—')}
          ${detailMetaChip('Nota', movie.rating ? `${movie.rating}/5` : 'Sem nota')}
        </section>

        <section class="wt-detail-section-v127">
          <div class="wt-detail-section-head"><h3>Organizar</h3><span>lado e nota</span></div>
          <div class="wt-detail-controls-v127 two">
            <label>Copiar para<select data-wt-move="movie:${esc(movie.uuid)}">${sideCopyOptions(movie.side)}</select></label>
            <label>Nota<select data-wt-rating="movie:${esc(movie.uuid)}">${ratingOptions(movie.rating)}</select></label>
          </div>
        </section>

        ${detailInfoText(movie)}

        <section class="wt-detail-section-v127 wt-note-section-v127">
          <div class="wt-detail-section-head"><h3>Anotação</h3><span>privada/local</span></div>
          <textarea data-wt-note="movie:${esc(movie.uuid)}" placeholder="Escreva uma observação sobre esse filme...">${esc(movie.note || '')}</textarea>
        </section>
        ${detailEditBox('movie', movie)}
        ${detailDangerZone('movie', movie)}
      </aside>
    </div>`;
  }

  function loadingScreen() {
    return `<div class="wtv1-app loading"><div class="wt-splash"><div class="wt-loader"></div><b>Carregando LauTime...</b></div></div>`;
  }

  function render() {
    if (!state.root) return;
    const activeId = document.activeElement?.id || '';
    const activePos = typeof document.activeElement?.selectionStart === 'number' ? document.activeElement.selectionStart : null;
    if (!state.data) {
      state.root.innerHTML = loadingScreen();
      return;
    }
    const body = state.screen === 'couple' ? coupleScreen()
      : state.screen === 'movies' ? moviesScreen()
      : state.screen === 'explore' ? exploreScreen()
      : state.screen === 'profile' ? profileScreen()
      : showsScreen();
    state.root.innerHTML = `<div class="wtv1-app">
      ${topChrome()}
      <div class="wt-scroll">${body}</div>
      ${bottomNav()}
      ${detailSheet()}
    </div>`;
    bind(state.root);
    syncLauTimeShell();
    if (activeId === 'wtSearchInput' || activeId === 'wtShowsSearchInput' || activeId === 'wtMoviesSearchInput' || activeId === 'wtCoupleSearchInput') {
      const input = $(activeId);
      if (input) {
        input.focus();
        try { input.setSelectionRange(activePos ?? input.value.length, activePos ?? input.value.length); } catch {}
      }
    }
    schedulePosterHydration();
  }

  function returnToLauOS() {
    state.moreOpen = false;
    const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], [tabindex]'));
    const root = state.root;
    const target = candidates.find((el) => {
      if (!el || (root && root.contains(el))) return false;
      const txt = (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
      return /^(hoje|início|inicio|home)$/i.test(txt) || /hoje/i.test(txt);
    });
    if (target && typeof target.click === 'function') { target.click(); return; }
    try { window.history.back(); } catch {}
  }

  async function loadData() {
    if (state.data || state.loading) return;
    state.loading = true;
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const raw = await res.json();
      state.data = {
        shows: Array.isArray(raw.shows) ? raw.shows.map((s) => ({ kind: 'show', side: 'lipe', ...s })) : [],
        movies: Array.isArray(raw.movies) ? raw.movies.map((m) => ({ kind: 'movie', side: 'lipe', ...m })) : []
      };
    } catch (err) {
      console.warn('[LauTime v146] Falha ao carregar dados:', err);
      state.data = { shows: [], movies: [] };
    } finally {
      state.loading = false;
    }
  }

  function bind(root) {
    qsa('[data-wt-screen]', root).forEach((btn) => btn.onclick = () => setScreen(btn.dataset.wtScreen));
    qsa('[data-wt-side]', root).forEach((btn) => btn.onclick = () => setSide(btn.dataset.wtSide));
    qsa('[data-wt-more-toggle]', root).forEach((btn) => btn.onclick = (ev) => { ev.stopPropagation(); state.moreOpen = !state.moreOpen; render(); });
    qsa('[data-wt-home]', root).forEach((btn) => btn.onclick = () => returnToLauOS());
    qsa('[data-wt-tab]', root).forEach((btn) => btn.onclick = () => setTab(btn.dataset.wtTab));
    qsa('[data-wt-open]', root).forEach((el) => {
      el.onclick = (ev) => {
        if (ev.target.closest('[data-wt-next],[data-wt-movie-watch]')) return;
        const [kind, uuid] = el.dataset.wtOpen.split(':');
        openDetails(kind, uuid);
      };
    });
    qsa('[data-wt-close]', root).forEach((el) => el.onclick = closeDetails);
    qsa('[data-wt-next]', root).forEach((btn) => btn.onclick = (ev) => { ev.stopPropagation(); const item = findItem('show', btn.dataset.wtNext); if (item) markNext(item); });
    qsa('[data-wt-fav]', root).forEach((btn) => btn.onclick = () => {
      const [kind, uuid] = btn.dataset.wtFav.split(':');
      const item = findItem(kind, uuid);
      if (item) patchItem(item, { favorite: !item.favorite }, true);
    });
    qsa('[data-wt-move]', root).forEach((sel) => sel.onchange = () => {
      const [kind, uuid] = sel.dataset.wtMove.split(':');
      const item = findItem(kind, uuid);
      const targetSide = sel.value;
      if (!item || !targetSide || item.side === targetSide) return;
      const cloned = duplicateItemForSide(kind, item, targetSide);
      state.side = targetSide;
      state.screen = targetSide === 'juntos' ? 'couple' : (kind === 'movie' ? 'movies' : 'shows');
      state.tab = 'watchlist';
      state.details = cloned ? `${kind}:${cloned.uuid}` : null;
      state.toast = `${item.title} copiado para ${sideName(targetSide)}. O original continua em ${sideName(item.side)}.`;
      saveLocal();
      render();
    });
    qsa('[data-wt-status]', root).forEach((sel) => sel.onchange = () => {
      const [kind, uuid] = sel.dataset.wtStatus.split(':');
      const item = findItem(kind, uuid);
      if (item) patchItem(item, { user_status: sel.value }, true);
    });
    qsa('[data-wt-rating]', root).forEach((sel) => sel.onchange = () => {
      const [kind, uuid] = sel.dataset.wtRating.split(':');
      const item = findItem(kind, uuid);
      if (item) patchItem(item, { rating: sel.value ? Number(sel.value) : null }, true);
    });
    qsa('[data-wt-note]', root).forEach((field) => field.onchange = () => {
      const [kind, uuid] = field.dataset.wtNote.split(':');
      const item = findItem(kind, uuid);
      if (item) patchItem(item, { note: field.value || '' }, true);
    });
    qsa('[data-wt-season]', root).forEach((btn) => btn.onclick = () => { state.season = Number(btn.dataset.wtSeason || 1); render(); });
    qsa('[data-wt-episode]', root).forEach((btn) => btn.onclick = () => {
      const [uuid, key] = btn.dataset.wtEpisode.split(':');
      const item = findItem('show', uuid);
      if (item) toggleEpisode(item, key);
    });
    qsa('[data-wt-season-watch]', root).forEach((btn) => btn.onclick = () => {
      const [uuid, season] = btn.dataset.wtSeasonWatch.split(':');
      const item = findItem('show', uuid);
      if (item) setSeasonWatched(item, season, true);
    });
    qsa('[data-wt-season-clear]', root).forEach((btn) => btn.onclick = () => {
      const [uuid, season] = btn.dataset.wtSeasonClear.split(':');
      const item = findItem('show', uuid);
      if (item) setSeasonWatched(item, season, false);
    });
    qsa('[data-wt-show-complete]', root).forEach((btn) => btn.onclick = () => {
      const item = findItem('show', btn.dataset.wtShowComplete);
      if (item) setAllEpisodesWatched(item, true);
    });
    qsa('[data-wt-show-clear]', root).forEach((btn) => btn.onclick = () => {
      const item = findItem('show', btn.dataset.wtShowClear);
      if (item) setAllEpisodesWatched(item, false);
    });
    qsa('[data-wt-detail-save]', root).forEach((btn) => btn.onclick = () => {
      const [kind, uuid] = btn.dataset.wtDetailSave.split(':');
      const item = findItem(kind, uuid);
      if (!item) return;
      patchItem(item, {
        title: (($('wtEditTitle') || {}).value || item.title).trim(),
        year: (($('wtEditYear') || {}).value || '').trim(),
        summary: (($('wtEditSummary') || {}).value || '').trim()
      }, true);
    });
    qsa('[data-wt-delete]', root).forEach((btn) => btn.onclick = () => {
      const [kind, uuid] = btn.dataset.wtDelete.split(':');
      const item = findItem(kind, uuid);
      const ok = window.confirm(`Remover ${item?.title || 'este item'} da lista?`);
      if (ok) removeItem(kind, uuid);
    });
    qsa('[data-wt-movie-watch]', root).forEach((btn) => btn.onclick = (ev) => {
      ev.stopPropagation();
      const item = findItem('movie', btn.dataset.wtMovieWatch);
      if (item) patchItem(item, { watched: !item.watched, watched_at: !item.watched ? nowISO() : null }, true);
    });
    const search = $('wtSearchInput');
    if (search) search.oninput = () => {
      state.query = search.value;
      if (state.screen === 'explore') scheduleRemoteSearch();
      render();
    };
    const seriesSearch = $('wtShowsSearchInput');
    if (seriesSearch) seriesSearch.oninput = () => { state.seriesQuery = seriesSearch.value; render(); };
    qsa('[data-wt-series-clear]', root).forEach((btn) => btn.onclick = () => { state.seriesQuery = ''; render(); });
    const movieSearch = $('wtMoviesSearchInput');
    if (movieSearch) movieSearch.oninput = () => { state.movieQuery = movieSearch.value; render(); };
    qsa('[data-wt-movie-clear]', root).forEach((btn) => btn.onclick = () => { state.movieQuery = ''; render(); });
    const coupleSearch = $('wtCoupleSearchInput');
    if (coupleSearch) coupleSearch.oninput = () => { state.coupleQuery = coupleSearch.value; render(); };
    qsa('[data-wt-couple-clear]', root).forEach((btn) => btn.onclick = () => { state.coupleQuery = ''; render(); });
    const lauBackup = $('wtLauBackupFile');
    if (lauBackup) lauBackup.onchange = () => importLauBackupFromInput(lauBackup);
    qsa('[data-wt-add-remote]', root).forEach((btn) => btn.onclick = () => { const [kind, key] = btn.dataset.wtAddRemote.split(':'); addRemote(kind, key); });
    qsa('[data-wt-profile-settings]', root).forEach((btn) => btn.onclick = () => { state.profileSettingsOpen = true; render(); });
    qsa('[data-wt-profile-settings-close]', root).forEach((btn) => btn.onclick = () => { state.profileSettingsOpen = false; render(); });
    qsa('[data-wt-profile-settings-reset]', root).forEach((btn) => btn.onclick = () => { if (!currentSideEditable()) { state.toast = `Você só altera o seu perfil e o Juntos.`; render(); return; } saveProfileConfig({ cover: '' }); state.profileSettingsOpen = true; render(); });
    qsa('[data-wt-profile-avatar-clear]', root).forEach((btn) => btn.onclick = () => { if (!currentSideEditable()) { state.toast = `Você só altera o seu perfil e o Juntos.`; render(); return; } saveProfileConfig({ avatar: '' }); state.profileSettingsOpen = true; render(); });
    qsa('[data-wt-profile-settings-save]', root).forEach((btn) => btn.onclick = async () => {
      if (!currentSideEditable()) {
        state.toast = `Você só altera o seu perfil e o Juntos. No perfil da Lau, aqui fica só o importador de backup.`;
        state.profileSettingsOpen = false;
        render();
        return;
      }
      const def = profileDefaults();
      const meta = profileMeta();
      btn.disabled = true;
      btn.textContent = 'Salvando...';
      const avatar = await readImageFileInput($('wtProfileAvatarFile'), meta.avatar, { maxW: 600, maxH: 600, quality: 0.86 });
      const cover = await readImageFileInput($('wtProfileCoverFile'), meta.cover, { maxW: 1600, maxH: 720, quality: 0.82 });
      saveProfileConfig({
        name: (($('wtProfileName') || {}).value || def.name).trim(),
        handle: (($('wtProfileHandle') || {}).value || def.handle).trim(),
        bio: (($('wtProfileBio') || {}).value || def.bio).trim(),
        avatar,
        cover
      });
      state.profileSettingsOpen = false;
      render();
    });
    qsa('[data-wt-cloud-sync]', root).forEach((btn) => btn.onclick = () => cloudPull({ forceRemote: true }));
    qsa('[data-wt-cloud-save]', root).forEach((btn) => btn.onclick = () => cloudSaveNow('manual'));
    const addTitle = $('wtAddTitle');
    if (addTitle) addTitle.oninput = () => { state.addTitle = addTitle.value; };
    const addEpisodes = $('wtAddEpisodes');
    if (addEpisodes) addEpisodes.oninput = () => { state.addEpisodes = addEpisodes.value; };
    const toggle = root.querySelector('[data-wt-add-toggle]');
    if (toggle) toggle.onclick = () => { state.addOpen = !state.addOpen; render(); };
    qsa('[data-wt-add-kind]', root).forEach((btn) => btn.onclick = () => { state.addKind = btn.dataset.wtAddKind; render(); });
    const save = root.querySelector('[data-wt-add-save]');
    if (save) save.onclick = addCustom;
  }

  async function show(root, options = {}) {
    state.root = root;
    state.usuario = options.usuario || state.usuario || 'Namorado';
    if (!state.booted) {
      state.side = sideForUser();
      state.screen = 'profile';
      state.tab = 'watchlist';
      state.booted = true;
      ensureLocalShape();
    }
    ensureActiveObserver();
    syncActiveClasses();
    render();
    syncActiveClasses();
    await loadData();
    if (!state.cloudPullDone) await cloudPull();
    else render();
    syncActiveClasses();
  }

  window.LauOSWatchTimeV1 = { show, render, version: 148, cloudPull, cloudSaveNow, importLauBackupPayload };
})();
