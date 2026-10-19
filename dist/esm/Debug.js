import { LogHandlerHub } from './internal/EventHub';
import { send, value } from './internal/calls';
import { native } from './internal/native';
import { func, logLevel, nullable, valid } from './internal/validate';
const logHandler = new LogHandlerHub();
export const Debug = {
    getLogLevel: () => value(native.getLogLevel()),
    setLogLevel(level) {
        if (valid('SallaPush.Debug.setLogLevel', { level: [level, logLevel] })) {
            send('SallaPush.Debug.setLogLevel', () => native.setLogLevel({ level }));
        }
    },
    setLogHandler(level, handler) {
        if (valid('SallaPush.Debug.setLogHandler', {
            level: [level, logLevel],
            handler: [handler, nullable(func)],
        })) {
            logHandler.set(level, handler);
        }
    },
};
//# sourceMappingURL=Debug.js.map