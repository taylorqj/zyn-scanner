import { useCallback, useState } from 'react';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** `useState` for small per-browser preferences, remembered in localStorage. */
export function usePersistedState<T>(key: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState(() => read(key, fallback));

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage can be unavailable; the preference then lasts for this page view only.
      }
    },
    [key],
  );

  return [value, update];
}
