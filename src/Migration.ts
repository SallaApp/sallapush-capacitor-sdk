import { send } from './internal/calls';
import { native } from './internal/native';
import { boolean, valid } from './internal/validate';
import type { SallaPushMigrationNamespace } from './definitions';

export const Migration: SallaPushMigrationNamespace = {
  setDisplayOneSignalCompatPayloads(display) {
    if (
      valid('SallaPush.Migration.setDisplayOneSignalCompatPayloads', {
        display: [display, boolean],
      })
    ) {
      send('SallaPush.Migration.setDisplayOneSignalCompatPayloads', () =>
        native.setDisplayOneSignalCompatPayloads({ display })
      );
    }
  },
};
