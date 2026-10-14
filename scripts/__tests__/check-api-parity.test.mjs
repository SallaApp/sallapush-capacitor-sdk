import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  androidKeys,
  checkParity,
  FILES,
  iosKeys,
  ParityError,
  run,
} from '../check-api-parity.mjs';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sallapush-parity-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

const IOS = [
  'SallaPush | swift.class | SallaPush | @objc(SallaPush) final class SallaPush',
  'SallaPush | swift.type.method | SallaPush.logout() | @objc static func logout()',
  'SallaPush | swift.method | SallaPushUser.addTags(_:) | @nonobjc func addTags(_ tags: [String : String])',
  'SallaPush | swift.method | SallaPushUser.objcAddTags(_:) | @objc(addTags:) func objcAddTags(_ tags: [AnyHashable : Any])',
  'SallaPush | swift.property | SallaPushNotifications.permissionStatus | @objc var permissionStatus: UNAuthorizationStatus { get }',
];
const ANDROID = `public final class com/salla/push/SallaPush {
\tpublic static final field INSTANCE Lcom/salla/push/SallaPush;
\tpublic static final fun logout ()V
}

public abstract interface class com/salla/push/SallaPushUser {
\tpublic abstract fun addTags (Ljava/util/Map;)V
}

public abstract interface class com/salla/push/SallaPushNotifications {
\tpublic abstract fun removeNotification (I)V
}
`;
const DUMP = [
  'const SallaPush',
  'SallaPush.logout(): void',
  'SallaPush.User.addTags(tags: Record<string, string>): void',
  "SallaPush.User.addEventListener(event: 'change', listener: () => void): SallaPushEventSubscription",
  'SallaPush.Notifications.getPermissionStatus(): Promise<string | null>',
  'SallaPush.Notifications.removeNotification(androidNotificationId: number): void',
];

function entry(id, status, ios, android, ts, reason = null) {
  return { id, status, ios, android, ts, reason };
}

function validMapping() {
  return {
    nativeVersions: { ios: '9.9.9', android: '9.9.9' },
    entries: [
      entry('P01a', 'W', [IOS[0]], ['com/salla/push/SallaPush'], ['SallaPush']),
      entry(
        'P01b',
        'N',
        [],
        ['com/salla/push/SallaPush#INSTANCE'],
        [],
        'Kotlin object plumbing.'
      ),
      entry(
        'P09',
        'W',
        [IOS[1]],
        ['com/salla/push/SallaPush#logout ()V'],
        ['SallaPush.logout']
      ),
      entry(
        'P32a',
        'W',
        [IOS[3]],
        [
          'com/salla/push/SallaPushUser',
          'com/salla/push/SallaPushUser#addTags (Ljava/util/Map;)V',
        ],
        ['SallaPush.User.addTags', "SallaPush.User.addEventListener('change')"]
      ),
      entry(
        'P32b',
        'N',
        [IOS[2]],
        [],
        [],
        'The Swift form takes typed values.'
      ),
      entry(
        'P52',
        'I',
        [IOS[4]],
        [],
        ['SallaPush.Notifications.getPermissionStatus']
      ),
      entry(
        'P71',
        'A',
        [],
        [
          'com/salla/push/SallaPushNotifications',
          'com/salla/push/SallaPushNotifications#removeNotification (I)V',
        ],
        ['SallaPush.Notifications.removeNotification']
      ),
    ],
  };
}

let fixtures = 0;
function fixture({
  mapping = validMapping(),
  podspec = "  s.dependency 'SallaPush', '9.9.9'\n",
  gradle = '  api "com.salla.push:sallapush:9.9.9"\n',
} = {}) {
  fixtures += 1;
  const root = path.join(temporary, `fixture-${fixtures}`);
  const files = {
    [FILES.ios]: `${IOS.join('\n')}\n`,
    [FILES.android]: ANDROID,
    [FILES.mapping]:
      typeof mapping === 'string'
        ? mapping
        : `${JSON.stringify(mapping, null, 2)}\n`,
    [FILES.dump]: `${DUMP.join('\n')}\n`,
    'Salla.saSallapushCapacitor.podspec': podspec,
    'android/build.gradle': gradle,
  };
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

function problemsOf(edit) {
  const mapping = validMapping();
  edit(mapping);
  return checkParity(fixture({ mapping })).problems;
}

function find(mapping, id) {
  return mapping.entries.find((candidate) => candidate.id === id);
}

function capture() {
  const chunks = [];
  return { write: (text) => chunks.push(text), text: () => chunks.join('') };
}

describe('iosKeys', () => {
  test('every non-blank line is a key, as written', () => {
    assert.deepEqual(iosKeys(`${IOS[0]}\n\n${IOS[1]}\n`), [IOS[0], IOS[1]]);
  });

  test('a line without the four fields is refused with its line number', () => {
    assert.throws(
      () => iosKeys(`${IOS[0]}\nSallaPush | swift.class\n`),
      (error) =>
        error instanceof ParityError && error.message.includes(`${FILES.ios}:2`)
    );
  });
});

describe('androidKeys', () => {
  test('classes, functions with descriptors, constructors and fields', () => {
    const text = `public final class com/salla/push/SallaPushConfig$Builder {
\tpublic fun <init> ()V
\tpublic final fun build ()Lcom/salla/push/SallaPushConfig;
}

public final class com/salla/push/SallaPushLogLevel : java/lang/Enum {
\tpublic static final field DEBUG Lcom/salla/push/SallaPushLogLevel;
\tpublic synthetic fun <init> (Lcom/salla/push/SallaPushConfig$Builder;Lkotlin/jvm/internal/DefaultConstructorMarker;)V
}
`;
    assert.deepEqual(androidKeys(text), [
      'com/salla/push/SallaPushConfig$Builder',
      'com/salla/push/SallaPushConfig$Builder#<init> ()V',
      'com/salla/push/SallaPushConfig$Builder#build ()Lcom/salla/push/SallaPushConfig;',
      'com/salla/push/SallaPushLogLevel',
      'com/salla/push/SallaPushLogLevel#DEBUG',
      'com/salla/push/SallaPushLogLevel#<init> (Lcom/salla/push/SallaPushConfig$Builder;Lkotlin/jvm/internal/DefaultConstructorMarker;)V',
    ]);
  });

  test('the real dump has 168 symbols', () => {
    const text = fs.readFileSync(path.join(ROOT, FILES.android), 'utf8');
    assert.equal(androidKeys(text).length, 168);
  });

  for (const [name, text] of [
    [
      'an unknown line',
      'public final class a/B {\n\tpublic final val x I\n}\n',
    ],
    ['a member outside a class', '\tpublic final fun x ()V\n'],
    [
      'a class that is not closed',
      'public final class a/B {\n\tpublic final fun x ()V\n',
    ],
    ['a closing brace outside a class', '}\n'],
  ]) {
    test(`${name} is refused`, () => {
      assert.throws(() => androidKeys(text), ParityError);
    });
  }
});

describe('checkParity', () => {
  test('a complete mapping passes, with the counts per status', () => {
    const result = checkParity(fixture());
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.native, { ios: 5, android: 7 });
    assert.deepEqual(result.counts.W, { entries: 3, ios: 3, android: 4 });
    assert.deepEqual(result.counts.I, { entries: 1, ios: 1, android: 0 });
    assert.deepEqual(result.counts.A, { entries: 1, ios: 0, android: 2 });
    assert.deepEqual(result.counts.N, { entries: 2, ios: 1, android: 1 });
    assert.deepEqual(result.counts.X, { entries: 0, ios: 0, android: 0 });
  });

  test('1: nativeVersions must equal the dependency pins', () => {
    const problems = problemsOf((mapping) => {
      mapping.nativeVersions.android = '9.9.8';
    });
    assert.deepEqual(problems, [
      'nativeVersions.android is 9.9.8, but android/build.gradle pins 9.9.9',
    ]);
  });

  test('1: a dependency file without exactly one pin is refused', () => {
    assert.throws(
      () => checkParity(fixture({ podspec: '' })),
      /Salla\.saSallapushCapacitor\.podspec must declare the SallaPush ios dependency exactly once \(found 0\)/
    );
  });

  test('2: an unmapped native symbol fails, on each platform', () => {
    const problems = problemsOf((mapping) => {
      mapping.entries = mapping.entries.filter(
        (candidate) => !['P09', 'P01b'].includes(candidate.id)
      );
    });
    assert.deepEqual(problems, [
      `unmapped ios symbol: ${IOS[1]}`,
      'unmapped android symbol: com/salla/push/SallaPush#INSTANCE',
      'unmapped android symbol: com/salla/push/SallaPush#logout ()V',
    ]);
  });

  test('2: a native symbol in two entries fails, naming both', () => {
    const problems = problemsOf((mapping) => {
      find(mapping, 'P32b').ios.push(IOS[3]);
    });
    assert.deepEqual(problems, [`ios symbol mapped by P32a, P32b: ${IOS[3]}`]);
  });

  test('3: a mapped symbol the native files lack fails', () => {
    const problems = problemsOf((mapping) => {
      find(mapping, 'P09').android.push('com/salla/push/SallaPush#gone ()V');
    });
    assert.deepEqual(problems, [
      `P09: android symbol not in ${FILES.android}: com/salla/push/SallaPush#gone ()V`,
    ]);
  });

  test('4: the status must be known', () => {
    const problems = problemsOf((mapping) => {
      find(mapping, 'P09').status = 'Y';
    });
    assert.deepEqual(problems, ['P09: status Y is not one of W, I, A, N, X']);
  });

  test('4: N and X need a reason, and W, I and A take none', () => {
    const problems = problemsOf((mapping) => {
      find(mapping, 'P32b').reason = ' ';
      find(mapping, 'P09').reason = 'Wrapped.';
    });
    assert.deepEqual(problems, [
      'P09: status W takes no reason (null)',
      'P32b: status N needs a reason',
    ]);
  });

  test('4: W, I and A need TypeScript symbols, and N and X list none', () => {
    const problems = problemsOf((mapping) => {
      find(mapping, 'P52').ts = [];
      find(mapping, 'P01b').ts = ['SallaPush'];
    });
    assert.deepEqual(problems, [
      'P01b: status N is not wrapped, so it lists no TypeScript symbol',
      'P52: status I needs at least one TypeScript symbol',
    ]);
  });

  test('4: each status takes the platforms it names', () => {
    const problems = problemsOf((mapping) => {
      const moved = find(mapping, 'P09').android.pop();
      find(mapping, 'P52').android.push(moved);
      const ios = find(mapping, 'P32b').ios.pop();
      find(mapping, 'P71').ios.push(ios);
    });
    assert.deepEqual(problems, [
      'P09: status W needs Android symbols',
      'P32b: status N needs at least one native symbol',
      'P52: status I takes no Android symbols',
      'P71: status A takes no iOS symbols',
    ]);
  });

  test('5: every TypeScript symbol must be in the API dump', () => {
    const problems = problemsOf((mapping) => {
      find(mapping, 'P09').ts.push(
        'SallaPush.logOut',
        "SallaPush.User.addEventListener('changed')"
      );
    });
    assert.deepEqual(problems, [
      `P09: TypeScript symbol not in ${FILES.dump}: SallaPush.logOut`,
      `P09: TypeScript symbol not in ${FILES.dump}: SallaPush.User.addEventListener('changed')`,
    ]);
  });

  test('an id used twice fails', () => {
    const problems = problemsOf((mapping) => {
      find(mapping, 'P52').id = 'P09';
    });
    assert.deepEqual(problems, ['P09: the id is used by more than one entry']);
  });

  for (const [name, mapping, message] of [
    [
      'an entry with another key',
      (m) => (find(m, 'P09').dart = []),
      /entry 3 \(P09\) must have exactly the keys/,
    ],
    [
      'a list that is not of strings',
      (m) => (find(m, 'P09').ts = [1]),
      /entry 3 \(P09\): ts must be an array of strings/,
    ],
    [
      'nativeVersions without a platform',
      (m) => delete m.nativeVersions.ios,
      /nativeVersions must be/,
    ],
  ]) {
    test(`${name} is refused`, () => {
      const edited = validMapping();
      mapping(edited);
      assert.throws(() => checkParity(fixture({ mapping: edited })), message);
    });
  }

  test('a mapping that is not JSON is refused', () => {
    assert.throws(
      () => checkParity(fixture({ mapping: '{' })),
      (error) =>
        error instanceof ParityError && error.message.startsWith(FILES.mapping)
    );
  });
});

describe('the command line', () => {
  test('prints the counts and passes', () => {
    const [out, err] = [capture(), capture()];
    assert.equal(run({ root: fixture(), out, err }), 0);
    assert.match(out.text(), /^W: 3 entries, 3 iOS and 4 Android symbols$/m);
    assert.match(
      out.text(),
      /every native symbol is mapped once \(5 iOS, 7 Android\); 0 problems/
    );
    assert.equal(err.text(), '');
  });

  test('names each problem and fails', () => {
    const mapping = validMapping();
    mapping.entries.pop();
    const [out, err] = [capture(), capture()];
    assert.equal(run({ root: fixture({ mapping }), out, err }), 1);
    assert.match(
      err.text(),
      /unmapped android symbol: com\/salla\/push\/SallaPushNotifications$/m
    );
    assert.match(err.text(), /check-api-parity: 2 problem\(s\)/);
  });

  test('a missing file fails with its name', () => {
    const root = fixture();
    fs.rmSync(path.join(root, FILES.dump));
    const [out, err] = [capture(), capture()];
    assert.equal(run({ root, out, err }), 1);
    assert.match(err.text(), /api\/sallapush-capacitor\.api: missing/);
  });
});

test('the repository maps every native symbol of the pinned SDKs once', () => {
  const result = checkParity(ROOT);
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.native, { ios: 175, android: 168 });
});
