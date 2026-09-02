/**
 * Coalesce high-frequency progress callbacks (e.g. FFmpeg -progress lines)
 * so IPC / React updates stay around `intervalMs` without dropping the final value.
 */
export type ProgressThrottle = {
  (emit: () => void): void;
  flush: () => void;
};

export function createProgressThrottle(intervalMs = 150): ProgressThrottle {
  let lastEmitAt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: (() => void) | null = null;

  const run = ((emit: () => void): void => {
    const now = Date.now();
    const elapsed = now - lastEmitAt;
    if (elapsed >= intervalMs) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pending = null;
      lastEmitAt = now;
      emit();
      return;
    }

    pending = emit;
    if (timer) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      if (!pending) {
        return;
      }
      const next = pending;
      pending = null;
      lastEmitAt = Date.now();
      next();
    }, intervalMs - elapsed);
  }) as ProgressThrottle;

  run.flush = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending) {
      const next = pending;
      pending = null;
      lastEmitAt = Date.now();
      next();
    }
  };

  return run;
}
