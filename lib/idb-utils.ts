const isIndexedDbAvailable = (): boolean => {
  return typeof indexedDB !== "undefined";
};

const safeCall = async <T>(fn: () => Promise<T>, fallback: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch {
    return await fallback();
  }
};

export const idbUtils = { isIndexedDbAvailable, safeCall } as const;
