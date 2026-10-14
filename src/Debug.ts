import { LogHandlerHub } from './internal/EventHub';
import { send, value } from './internal/calls';
import { native } from './internal/native';
import { func, logLevel, nullable, valid } from './internal/validate';
import type { SallaPushDebugNamespace, SallaPushLogLevel } from './definitions';

const logHandler = new LogHandlerHub();

export const Debug: SallaPushDebugNamespace = {
  getLogLevel: () => value(native.getLogLevel()) as Promise<SallaPushLogLevel>,
  setLogLevel(level) {
    if (valid('SallaPush.Debug.setLogLevel', { level: [level, logLevel] })) {
      send('SallaPush.Debug.setLogLevel', () => native.setLogLevel({ level }));
    }
  },
  setLogHandler(level, handler) {
    if (
      valid('SallaPush.Debug.setLogHandler', {
        level: [level, logLevel],
        handler: [handler, nullable(func)],
      })
    ) {
      logHandler.set(level, handler);
    }
  },
};
