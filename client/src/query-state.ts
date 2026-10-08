import { useEffect, useRef, useState } from 'react';

// Only declared keys are read from the URL; API and presentation filters stay separate.
export function useQueryState<T extends Record<string, string>>(defaults: T) {
  const initial = useRef(defaults);
  const read = () => {
    const params = new URLSearchParams(window.location.search);
    return Object.fromEntries(Object.entries(initial.current).map(([key, value]) => [key, params.get(key) ?? value])) as T;
  };
  const [applied, setApplied] = useState<T>(read);
  const [values, setValues] = useState<T>(applied);
  useEffect(() => {
    const restore = () => { const next = read(); setValues(next); setApplied(next); };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const apply = (next = values) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(next).forEach(([key, value]) => { params.set(key, value); });
    window.history.pushState(null, '', `${window.location.pathname}?${params}${window.location.hash}`);
    setValues(next); setApplied({ ...next });
  };
  return { values, setValues, applied, apply };
}

export const queryString = (values: Record<string, string>) => new URLSearchParams(Object.entries(values).filter(([, value]) => value !== '')).toString();
