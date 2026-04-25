// AbortController / timeout 工具
// 设计参考 Claude Code: tool 调用从来不裸 await，
// 而是 race(real, timer, signal) —— 主控权永远在调用方手里。
//
// 故意不使用 AbortSignal.timeout(ms)：
// 在 Node/Bun 下其内部定时器要等触发后才回收，长超时会累积内存。
// 这里手写 setTimeout + clearTimeout，cleanup 时立刻释放。

class TimeoutError extends Error {
  constructor(label, ms) {
    super(`${label || 'operation'} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
    this.code = 'TIMEOUT';
    this.timeoutMs = ms;
  }
}

class AbortError extends Error {
  constructor(reason) {
    super(typeof reason === 'string' ? reason : 'aborted');
    this.name = 'AbortError';
    this.code = 'ABORT';
    this.reason = reason;
  }
}

/**
 * Promise.race 包一层超时。底层 promise 不会被中断（如 pdf-parse 这种同步密集），
 * 但调用方立刻拿回控制权。
 */
function withTimeout(promise, ms, label = 'operation') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    if (typeof timer.unref === 'function') timer.unref();
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * 让一个 promise 服从 AbortSignal —— signal abort 时立刻 reject。
 * 底层 promise 不一定真的停下，但调用方不再等。
 */
function raceWithAbort(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new AbortError(signal.reason));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new AbortError(signal.reason));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => { signal.removeEventListener('abort', onAbort); resolve(v); },
      (e) => { signal.removeEventListener('abort', onAbort); reject(e); }
    );
  });
}

/**
 * fetch + 超时 + 可选外部 signal。任一触发都会 abort 网络层。
 */
async function fetchWithTimeout(url, options = {}, ms = 15000) {
  const ac = new AbortController();
  const externalSignal = options.signal;
  const onExternalAbort = () => ac.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) ac.abort(externalSignal.reason);
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const timer = setTimeout(() => ac.abort(new TimeoutError('fetch', ms)), ms);
  if (typeof timer.unref === 'function') timer.unref();

  try {
    return await fetch(url, { ...options, signal: ac.signal });
  } catch (err) {
    // node/undici 在 abort 时抛 DOMException(AbortError)；统一转成我们的类型
    if (err && (err.name === 'AbortError' || ac.signal.aborted)) {
      const reason = ac.signal.reason;
      if (reason instanceof TimeoutError) throw reason;
      throw new AbortError(reason || 'aborted');
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * 合并多个 AbortSignal —— 任意一个 abort 就 abort 出口。
 * 返回的 cleanup 用于解绑监听（避免长生命周期 signal 上的事件累积）。
 */
function combineSignals(signals = []) {
  const valid = signals.filter(Boolean);
  const out = new AbortController();
  if (valid.some(s => s.aborted)) {
    out.abort(valid.find(s => s.aborted)?.reason);
    return { signal: out.signal, cleanup: () => {} };
  }
  const onAbort = (e) => out.abort(e?.target?.reason);
  for (const s of valid) s.addEventListener('abort', onAbort, { once: true });
  return {
    signal: out.signal,
    cleanup: () => { for (const s of valid) s.removeEventListener('abort', onAbort); }
  };
}

module.exports = {
  TimeoutError,
  AbortError,
  withTimeout,
  raceWithAbort,
  fetchWithTimeout,
  combineSignals
};
