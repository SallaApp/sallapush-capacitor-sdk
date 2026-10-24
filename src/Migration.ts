import { send } from './internal/calls';
import { native } from './internal/native';
import { boolean, valid } from './internal/validate';
import type { SallaPushMigrationNamespace } from './definitions';

export const Migration: SallaPushMigrationNamespace = {
  setDisplayCompatPayloads(display) {
    if (
      valid('SallaPush.Migration.setDisplayCompatPayloads', {
        display: [display, boolean],
      })
    ) {
      send('SallaPush.Migration.setDisplayCompatPayloads', () =>
        native.setDisplayCompatPayloads({ display })
      );
    }
  },
};
