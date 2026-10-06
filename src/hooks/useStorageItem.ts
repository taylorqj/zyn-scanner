import { useEffect, useState } from 'react';
import type { WxtStorageItem } from 'wxt/utils/storage';

/** Subscribes to an extension storage item. `initial` is shown until the stored value arrives. */
export function useStorageItem<T>(item: WxtStorageItem<T, Record<string, unknown>>, initial: T): T {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    let active = true;
    void item.getValue().then((stored) => {
      if (active) setValue(stored);
    });
    const unwatch = item.watch((next) => setValue(next));
    return () => {
      active = false;
      unwatch();
    };
  }, [item]);

  return value;
}
