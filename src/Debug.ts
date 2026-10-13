import { send, value } from './internal/calls';
import { native } from './internal/native';
import { logLevel, valid } from './internal/validate';
import type { SallaPushDebugNamespace, SallaPushLogLevel } from './definitions';

export const Debug: Omit<SallaPushDebugNamespace, 'setLogHandler'> = {
  getLogLevel: () => value(native.getLogLevel()) as Promise<SallaPushLogLevel>,
  setLogLevel(level) {
    if (valid('SallaPush.Debug.setLogLevel', { level: [level, logLevel] })) {
      send('SallaPush.Debug.setLogLevel', () => native.setLogLevel({ level }));
    }
  },
};
