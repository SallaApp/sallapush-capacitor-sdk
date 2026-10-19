import { send } from './internal/calls';
import { native } from './internal/native';
import { boolean, valid } from './internal/validate';
export const Migration = {
    setDisplayOneSignalCompatPayloads(display) {
        if (valid('SallaPush.Migration.setDisplayOneSignalCompatPayloads', {
            display: [display, boolean],
        })) {
            send('SallaPush.Migration.setDisplayOneSignalCompatPayloads', () => native.setDisplayOneSignalCompatPayloads({ display }));
        }
    },
};
//# sourceMappingURL=Migration.js.map