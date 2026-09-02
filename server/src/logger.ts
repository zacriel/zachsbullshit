/* Tiny leveled logger — zero dependencies, structured-ish output. */

type Level = 'info' | 'warn' | 'error' | 'debug';

function emit(level: Level, scope: string, msg: string, extra?: unknown): void {
  const ts = new Date().toISOString();
  const line = `${ts} [${level.toUpperCase()}] (${scope}) ${msg}`;
  const args = extra === undefined ? [line] : [line, extra];
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(...args);
}

export function createLogger(scope: string) {
  return {
    info: (msg: string, extra?: unknown) => emit('info', scope, msg, extra),
    warn: (msg: string, extra?: unknown) => emit('warn', scope, msg, extra),
    error: (msg: string, extra?: unknown) => emit('error', scope, msg, extra),
    debug: (msg: string, extra?: unknown) => {
      if (process.env.NODE_ENV !== 'production') emit('debug', scope, msg, extra);
    },
  };
}

export const log = createLogger('app');
