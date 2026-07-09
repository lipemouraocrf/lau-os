/* LauOS Core Guard v52
   Carregado antes dos scripts principais para rastrear timers e ajudar na estabilidade. */
(function () {
  if (window.__lauosCoreGuardLoaded) return;
  window.__lauosCoreGuardLoaded = true;

  const nativeSetInterval = window.setInterval.bind(window);
  const nativeClearInterval = window.clearInterval.bind(window);
  const nativeSetTimeout = window.setTimeout.bind(window);

  const intervals = new Map();
  const timeouts = new Map();
  let intervalSeq = 0;
  let timeoutSeq = 0;

  function getFnName(fn) {
    if (!fn) return 'anonymous';
    if (typeof fn === 'string') return 'string-callback';
    return fn.name || 'anonymous';
  }

  window.setInterval = function lauOSSetInterval(fn, delay, ...args) {
    const label = getFnName(fn);
    const id = nativeSetInterval(fn, delay, ...args);
    intervals.set(id, {
      id,
      label,
      delay: Number(delay || 0),
      createdAt: Date.now(),
      order: ++intervalSeq
    });
    return id;
  };

  window.clearInterval = function lauOSClearInterval(id) {
    intervals.delete(id);
    return nativeClearInterval(id);
  };

  window.setTimeout = function lauOSSetTimeout(fn, delay, ...args) {
    const label = getFnName(fn);
    const id = nativeSetTimeout(function (...innerArgs) {
      timeouts.delete(id);
      if (typeof fn === 'function') return fn(...innerArgs);
      return Function(String(fn))();
    }, delay, ...args);
    timeouts.set(id, {
      id,
      label,
      delay: Number(delay || 0),
      createdAt: Date.now(),
      order: ++timeoutSeq
    });
    return id;
  };

  window.LauOSGuard = {
    intervals() {
      return Array.from(intervals.values()).sort((a, b) => a.order - b.order);
    },
    timeouts() {
      return Array.from(timeouts.values()).sort((a, b) => a.order - b.order);
    },
    clearIntervalsByName(names) {
      const set = new Set(Array.isArray(names) ? names : [names]);
      let total = 0;
      intervals.forEach((meta, id) => {
        if (set.has(meta.label)) {
          window.clearInterval(id);
          total += 1;
        }
      });
      return total;
    },
    clearVisualIntervals() {
      return this.clearIntervalsByName(['createFloatingHeart', 'createSparkle']);
    },
    nativeSetInterval,
    nativeClearInterval,
    nativeSetTimeout
  };
})();
