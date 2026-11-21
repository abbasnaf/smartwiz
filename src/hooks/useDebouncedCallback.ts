import { useEffect, useRef } from 'react';

export function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay: number) {
  const fnRef = useRef(fn);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgs = useRef<Parameters<T> | null>(null);
  useEffect(() => { fnRef.current = fn; }, [fn]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return Object.assign(
    (...args: Parameters<T>) => {
      if (timer.current) clearTimeout(timer.current);
      pendingArgs.current = args;
      timer.current = setTimeout(() => {
        timer.current = null;
        const latestArgs = pendingArgs.current;
        pendingArgs.current = null;
        if (latestArgs) fnRef.current(...latestArgs);
      }, delay);
    },
    {
      flush: () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        const latestArgs = pendingArgs.current;
        pendingArgs.current = null;
        if (latestArgs) fnRef.current(...latestArgs);
      },
    },
  );
}
