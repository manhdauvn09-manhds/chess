// Giới hạn tần suất đơn giản (fixed window, in-memory) — chống brute-force & spam.
interface Entry {
  count: number;
  reset: number;
}

export function createRateLimiter(maxPerWindow: number, windowMs: number) {
  const hits = new Map<string, Entry>();
  // Dọn định kỳ để map không phình.
  setInterval(() => {
    const now = Date.now();
    for (const [k, e] of hits) if (now > e.reset) hits.delete(k);
  }, windowMs).unref?.();

  return function allow(key: string): boolean {
    const now = Date.now();
    let e = hits.get(key);
    if (!e || now > e.reset) {
      e = { count: 0, reset: now + windowMs };
      hits.set(key, e);
    }
    e.count++;
    return e.count <= maxPerWindow;
  };
}
