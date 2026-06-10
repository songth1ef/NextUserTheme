// 进程内按 key 串行化异步操作:manifest 的读-改-写不加锁时,
// 同一用户的并发请求会互相覆盖(后写赢),这里把同 key 的写操作排成队列。
// 仅进程内有效——多实例部署需换共享存储,见 docs/KNOWN_ISSUES.md。
const tails = new Map<string, Promise<unknown>>();

export function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.then(
    () => undefined,
    () => undefined
  );
  tails.set(key, tail);
  void tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
}
