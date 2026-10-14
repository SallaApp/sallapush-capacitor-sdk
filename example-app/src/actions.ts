import { Capacitor } from '@capacitor/core';
import { SallaPush, SallaPushLogLevel } from '@salla.sa/sallapush-capacitor';
import { eventLog, followLogs } from './eventLog';
import { customerDidSignIn, customerDidSignOut } from './session';
import { button, note, row, section, select, textInput, toggle } from './ui';

const LEVELS = Object.values(SallaPushLogLevel);

/** Every SallaPush call the example can make; each one is written to the event log. */
export function renderActions(): HTMLElement[] {
  const sections = [
    customer(),
    tags(),
    subscription(),
    permission(),
    delivered(),
    consent(),
    logs(),
  ];
  if (Capacitor.getPlatform() === 'android') {
    sections.push(migration());
  }
  return sections;
}

function customer(): HTMLElement {
  const externalId = textInput('External id');
  const identityToken = textInput('Identity token', { secure: true });
  return section(
    'Customer',
    externalId,
    identityToken,
    row(
      button('Log in', () =>
        call(`login('${externalId.value}', …)`, () =>
          customerDidSignIn({
            externalId: externalId.value,
            identityToken: identityToken.value,
          })
        )
      ),
      button('Log out', () => call('logout()', () => customerDidSignOut()))
    )
  );
}

function tags(): HTMLElement {
  const key = textInput('Tag key');
  const value = textInput('Tag value');
  const language = textInput("Language, such as ar (empty: the device's)");
  return section(
    'Tags and language',
    key,
    value,
    row(
      button('Add tag', () =>
        call(`User.addTag('${key.value}', '${value.value}')`, () =>
          SallaPush.User.addTag(key.value, value.value)
        )
      ),
      button('Remove tag', () =>
        call(`User.removeTag('${key.value}')`, () =>
          SallaPush.User.removeTag(key.value)
        )
      )
    ),
    language,
    button('Set language', () => {
      const code = language.value.trim() === '' ? null : language.value;
      call(`User.setLanguage(${code === null ? 'null' : `'${code}'`})`, () =>
        SallaPush.User.setLanguage(code)
      );
    })
  );
}

function subscription(): HTMLElement {
  const pushSubscription = SallaPush.User.pushSubscription;
  return section(
    'Push subscription',
    row(
      button('Opt in', () =>
        call('pushSubscription.optIn()', () => pushSubscription.optIn())
      ),
      button('Opt out', () =>
        call('pushSubscription.optOut()', () => pushSubscription.optOut())
      )
    )
  );
}

function permission(): HTMLElement {
  let fallbackToSettings = false;
  const notifications = SallaPush.Notifications;
  const buttons = [
    button('Request', () =>
      result(`requestPermission(${fallbackToSettings})`, () =>
        notifications.requestPermission(fallbackToSettings)
      )
    ),
    button('Refresh', () =>
      call('Notifications.refreshPermission()', () =>
        notifications.refreshPermission()
      )
    ),
  ];
  if (Capacitor.getPlatform() === 'ios') {
    buttons.push(
      button('Provisional', () =>
        result('registerForProvisionalAuthorization()', () =>
          notifications.registerForProvisionalAuthorization()
        )
      ),
      button('Register', () =>
        call('Notifications.registerForRemoteNotifications()', () =>
          notifications.registerForRemoteNotifications()
        )
      )
    );
  }
  return section(
    'Permission',
    toggle('Open the settings after a denial', fallbackToSettings, (value) => {
      fallbackToSettings = value;
    }),
    row(...buttons)
  );
}

function delivered(): HTMLElement {
  const notifications = SallaPush.Notifications;
  const clearAll = button('Clear all', () =>
    call('Notifications.clearAll()', () => notifications.clearAll())
  );
  if (Capacitor.getPlatform() !== 'android') {
    return section('Delivered notifications', clearAll);
  }
  const androidId = textInput('Android notification id', { numeric: true });
  return section(
    'Delivered notifications',
    clearAll,
    androidId,
    button('Remove notification', () => {
      const id = Number(androidId.value);
      if (androidId.value.trim() === '' || !Number.isInteger(id)) {
        eventLog.add('result', 'removeNotification: enter a number');
        return;
      }
      call(`Notifications.removeNotification(${id})`, () =>
        notifications.removeNotification(id)
      );
    })
  );
}

function consent(): HTMLElement {
  return section(
    'Consent',
    toggle('Consent required', false, (value) =>
      call(`setConsentRequired(${value})`, () =>
        SallaPush.setConsentRequired(value)
      )
    ),
    toggle('Consent given', false, (value) =>
      call(`setConsentGiven(${value})`, () => SallaPush.setConsentGiven(value))
    ),
    note(
      'SallaPush started at launch from the static configuration, so setConsentRequired(true) comes too late here: ' +
        'apps that need consent set SallaPushRequiresUserConsent or com.salla.push.REQUIRES_USER_CONSENT.'
    )
  );
}

function logs(): HTMLElement {
  const level = select(LEVELS, eventLog.logLevel(), (next) =>
    call(`Debug.setLogLevel('${next}')`, () => {
      SallaPush.Debug.setLogLevel(next);
      followLogs(next);
    })
  );
  // The self-test sets the event log's level too.
  eventLog.subscribe(() => {
    level.value = eventLog.logLevel();
  });
  return section(
    'Log level',
    level,
    note("Sets SallaPush's console level and the event log's level.")
  );
}

function migration(): HTMLElement {
  return section(
    'OneSignal migration',
    toggle('Show OneSignal-format payloads', true, (value) =>
      call(`Migration.setDisplayOneSignalCompatPayloads(${value})`, () =>
        SallaPush.Migration.setDisplayOneSignalCompatPayloads(value)
      )
    )
  );
}

function call(description: string, action: () => void): void {
  action();
  eventLog.add('call', description);
}

function result(description: string, request: () => Promise<boolean>): void {
  request().then(
    (value) => eventLog.add('result', `${description}: ${value}`),
    (error: unknown) =>
      eventLog.add('result', `${description} failed: ${String(error)}`)
  );
}
