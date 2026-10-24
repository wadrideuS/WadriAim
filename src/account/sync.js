/** Sequential cloud queue: a slower earlier request cannot overwrite a newer edit. */
export function createSyncQueue({ write, onError = () => {}, onSuccess = () => {} }) {
  const pending = new Map();
  let running = false,
    closed = false;
  const flush = async () => {
    if (running || closed) return;
    running = true;
    try {
      while (pending.size && !closed) {
        const [key, item] = pending.entries().next().value;
        try {
          await write(key, item.value);
        } catch (error) {
          onError(error);
          return;
        }
        if (pending.get(key) === item) pending.delete(key);
      }
      onSuccess();
    } finally {
      running = false;
    }
  };
  return {
    save(key, value) {
      pending.set(key, { value: structuredClone(value) });
      void flush();
    },
    retry: flush,
    get pending() {
      return pending.size;
    },
    dispose() {
      closed = true;
    },
  };
}
