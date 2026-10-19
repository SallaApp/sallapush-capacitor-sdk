import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readPins } from '../check-api-parity.mjs';
import {
  checkSnippets,
  codeBlocks,
  markdownFiles,
  print,
  region,
  run,
  snippetLines,
  SnippetError,
} from '../check-readme-snippets.mjs';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sallapush-snippets-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

const START = `import { SallaPush } from '@salla.sa/sallapush-capacitor';

export function startSallaPush(): void {
  // snippet:click-listener
  SallaPush.Notifications.addEventListener('click', (event) => {
    route(event.notification);
  });
  // end-snippet
  // snippet:split
  const first = 1;
  // end-snippet
  const hidden = 'example only';
  // snippet:split
  const second = 2;
  // end-snippet
}
`;
const PODFILE = `target 'App' do
  # snippet:pods
  pod 'SallaPush', :git => 'git@github.com:SallaApp/sallapush-ios-sdk.git', :tag => '1.0.2'
  # end-snippet
end
`;
const MANIFEST = `<application>
  <!-- snippet:meta-data -->
  <meta-data android:name="com.salla.push.APP_ID" android:value="\${sallaPushAppId}" />
  <!-- end-snippet -->
</application>
`;
const EXTENSION = 'import SallaPushExtension\n';

const EXTENSION_SOURCE =
  'example-app/ios/App/SallaPushNotificationService/NotificationService.swift';

let projects = 0;
function project(readme, { docs = {}, untracked = [] } = {}) {
  projects += 1;
  const root = path.join(temporary, `project-${projects}`);
  const files = {
    'README.md': readme,
    'package.json': '{ "version": "1.0.0" }\n',
    'Salla.saSallapushCapacitor.podspec':
      '  s.dependency "SallaPush", "1.0.2"\n',
    'android/build.gradle': '  api "com.salla.push:sallapush:1.0.2"\n',
    'example-app/src/start.ts': START,
    'docs/snippets/Podfile': PODFILE,
    'example-app/android/app/src/main/AndroidManifest.xml': MANIFEST,
    [EXTENSION_SOURCE]: EXTENSION,
    'src/index.ts': 'export {};\n',
    ...Object.fromEntries(
      Object.entries(docs).map(([name, text]) => [`docs/${name}`, text])
    ),
  };
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  const tracked = new Set(
    Object.keys(files).filter((file) => !untracked.includes(file))
  );
  return { root, tracked };
}

function problems(readme, options) {
  return checkSnippets(project(readme, options)).problems;
}

const CLICK = `<!-- snippet:example-app/src/start.ts#click-listener -->
\`\`\`ts
SallaPush.Notifications.addEventListener('click', (event) => {
  route(event.notification);
});
\`\`\`
`;

describe('codeBlocks', () => {
  test('fences of either kind, their language, and the content without the fence indentation', () => {
    const blocks = codeBlocks(
      [
        '# Title',
        '```ts',
        'const a = 1;',
        '```',
        '1. A step:',
        '',
        '   ~~~swift',
        '   import UIKit',
        '     let b = 2',
        '   ~~~',
        '```',
        'plain',
        '```',
      ].join('\n')
    );
    assert.deepEqual(blocks, [
      { line: 2, end: 4, language: 'ts', content: ['const a = 1;'] },
      {
        line: 7,
        end: 10,
        language: 'swift',
        content: ['import UIKit', '  let b = 2'],
      },
      { line: 11, end: 13, language: '', content: ['plain'] },
    ]);
  });
});

describe('region', () => {
  test('the lines between the markers, dedented, in any comment syntax', () => {
    assert.deepEqual(region(START, 'click-listener', 'start.ts'), [
      "SallaPush.Notifications.addEventListener('click', (event) => {",
      '  route(event.notification);',
      '});',
    ]);
    assert.deepEqual(region(PODFILE, 'pods', 'Podfile'), [
      "pod 'SallaPush', :git => 'git@github.com:SallaApp/sallapush-ios-sdk.git', :tag => '1.0.2'",
    ]);
    assert.deepEqual(region(MANIFEST, 'meta-data', 'AndroidManifest.xml'), [
      '<meta-data android:name="com.salla.push.APP_ID" android:value="${sallaPushAppId}" />',
    ]);
  });

  test('the parts of a split region are joined in file order', () => {
    assert.deepEqual(region(START, 'split', 'start.ts'), [
      'const first = 1;',
      'const second = 2;',
    ]);
  });

  test('indentation in tabs, as Xcode writes plists, is removed as spaces are', () => {
    const plist =
      '<dict>\n\t<!-- snippet:app-id -->\n\t<key>SallaPushAppId</key>\n\t<array>\n\t\t<string>x</string>\n' +
      '\n\t</array>\n\t<!-- end-snippet -->\n</dict>\n';
    assert.deepEqual(region(plist, 'app-id', 'Info.plist'), [
      '<key>SallaPushAppId</key>',
      '<array>',
      '\t<string>x</string>',
      '',
      '</array>',
    ]);
    assert.deepEqual(
      region(
        '\t// snippet:a\n\tone\n  two\n\t// end-snippet\n',
        'a',
        'mixed.txt'
      ),
      ['\tone', '  two'],
      'lines that share no indentation keep theirs'
    );
  });

  test('an unknown region is null', () => {
    assert.equal(region(START, 'missing', 'start.ts'), null);
  });

  for (const [name, text, message] of [
    [
      'a region without its end',
      '// snippet:a\nx\n',
      /region a has no end-snippet/,
    ],
    [
      'an end without a region',
      'x\n// end-snippet\n',
      /:2: end-snippet without a region/,
    ],
    [
      'a region inside another',
      '// snippet:a\n// snippet:b\n// end-snippet\n',
      /:2: region b starts inside region a/,
    ],
  ]) {
    test(`${name} is refused`, () => {
      assert.throws(
        () => region(text, 'a', 'file.ts'),
        (error) => error instanceof SnippetError && message.test(error.message)
      );
    });
  }
});

describe('checkSnippets', () => {
  test('blocks equal to their regions and files pass', () => {
    const readme = `# SallaPush

${CLICK}
<!-- snippet:docs/snippets/Podfile#pods -->
\`\`\`ruby
pod 'SallaPush', :git => 'git@github.com:SallaApp/sallapush-ios-sdk.git', :tag => '1.0.2'
\`\`\`

<!-- snippet:example-app/src/start.ts#split -->

\`\`\`ts
const first = 1;
const second = 2;
\`\`\`

1. Replace the extension:

   <!-- snippet:${EXTENSION_SOURCE} -->
   \`\`\`swift
   import SallaPushExtension
   \`\`\`

<!-- unchecked: needs @capacitor/push-notifications in the app -->
\`\`\`java
public class AppMessagingService extends MessagingService {}
\`\`\`

\`\`\`bash
npx cap sync
\`\`\`
`;
    const result = checkSnippets(project(readme));
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.counts, { blocks: 6, snippets: 4, unchecked: 1 });
  });

  test('a changed block fails, naming the line that differs', () => {
    const readme = CLICK.replace('route(event', 'navigate(event');
    assert.deepEqual(problems(readme), [
      'README.md:2: the block differs from example-app/src/start.ts#click-listener at its line 2: the source has "  route(event.notification);", the block "  navigate(event.notification);"',
    ]);
  });

  test('a block longer or shorter than its source fails', () => {
    assert.match(
      problems(CLICK.replace('});\n```', '});\nextra();\n```'))[0],
      /at its line 4: the source has "\(nothing\)", the block "extra\(\);"/
    );
    assert.match(
      problems(CLICK.replace('});\n```', '```'))[0],
      /at its line 3: the source has "}\);", the block "\(nothing\)"/
    );
  });

  test('a whole file must be shown byte for byte', () => {
    const readme = `<!-- snippet:${EXTENSION_SOURCE} -->\n\`\`\`swift\nimport SallaPushExtension\n\n\`\`\`\n`;
    assert.match(
      problems(readme)[0],
      /differs from example-app\/ios\/App\/SallaPushNotificationService/
    );
  });

  test('a code block without a marker fails, in a checked language only', () => {
    const readme =
      '```tsx\n<App />\n```\n\n```sh\nnpx cap sync\n```\n\n```\nplain\n```\n\n```java\nclass A {}\n```\n';
    assert.deepEqual(problems(readme), [
      'README.md:1: the tsx block has no <!-- snippet:<path>[#<name>] --> or <!-- unchecked: <reason> --> line before it',
      'README.md:13: the java block has no <!-- snippet:<path>[#<name>] --> or <!-- unchecked: <reason> --> line before it',
    ]);
  });

  test('a block takes exactly one marker', () => {
    const readme = `<!-- unchecked: an excerpt -->\n${CLICK}`;
    assert.deepEqual(problems(readme), [
      'README.md:3: the block follows 2 markers; it takes exactly one',
    ]);
  });

  test('a marker shown inside a code block is text', () => {
    const readme =
      '<!-- unchecked: the marker syntax -->\n```markdown\n<!-- snippet:docs/snippets/Podfile -->\n```\n';
    assert.deepEqual(problems(readme), []);
  });

  test('a marker without a block fails', () => {
    assert.deepEqual(
      problems('<!-- snippet:docs/snippets/Podfile -->\n\nText.\n'),
      ['README.md:1: the marker is not followed by a code block']
    );
  });

  test('an unchecked block needs a reason', () => {
    assert.deepEqual(problems('<!-- unchecked: -->\n```ts\nx;\n```\n'), [
      'README.md:2: <!-- unchecked: --> needs a reason',
    ]);
  });

  test('an unknown region fails', () => {
    assert.deepEqual(
      problems(CLICK.replace('#click-listener', '#tap-listener')),
      ['README.md:2: example-app/src/start.ts has no region tap-listener']
    );
  });

  test('a source must be a committed file of the example or of docs/snippets', () => {
    const block = '\n```ts\nexport {};\n```\n';
    assert.deepEqual(problems(`<!-- snippet:src/index.ts -->${block}`), [
      'README.md:2: src/index.ts is not a file the checks build; snippets come from example-app/ or docs/snippets/',
    ]);
    assert.deepEqual(
      problems(`<!-- snippet:example-app/node_modules/x/index.ts -->${block}`),
      [
        'README.md:2: example-app/node_modules/x/index.ts is not a file the checks build; snippets come from example-app/ or docs/snippets/',
      ]
    );
    assert.deepEqual(
      problems(`<!-- snippet:example-app/../src/index.ts -->${block}`),
      [
        "README.md:2: example-app/../src/index.ts is not a plain path from the repository's root",
      ]
    );
    assert.deepEqual(
      problems(CLICK, { untracked: ['example-app/src/start.ts'] }),
      ['README.md:2: example-app/src/start.ts is not a committed file']
    );
  });

  test('every SallaPush version named must be the pin, in README.md and docs/*.md', () => {
    const readme =
      'Built on SallaPush iOS 1.0.2 and SallaPush Android 1.0.3.\n';
    assert.deepEqual(
      problems(readme, {
        docs: { 'REFERENCE.md': 'Requires SallaPush iOS 1.0.1.\n' },
      }),
      [
        'README.md:1: names SallaPush Android 1.0.3, but the pin is 1.0.2',
        'docs/REFERENCE.md:1: names SallaPush iOS 1.0.1, but the pin is 1.0.2',
      ]
    );
  });

  test('the versions table must give the pins and the package version', () => {
    const table = (row) =>
      `| Wrapper | SallaPush iOS | SallaPush Android | Framework |\n|---|---|---|---|\n${row}\n\nAfter.\n`;
    assert.deepEqual(
      problems(table('| Capacitor 1.0.0 | 1.0.2 | 1.0.2 | Capacitor 8 |')),
      []
    );
    assert.deepEqual(
      problems(table('| Capacitor 1.0.1 | 1.0.2 | 1.0.3 | Capacitor 8 |')),
      [
        'README.md:3: the versions table says iOS 1.0.2 and Android 1.0.3; the pins are 1.0.2 and 1.0.2',
        'README.md:3: the versions table names Capacitor 1.0.1; package.json is 1.0.0',
      ]
    );
    assert.deepEqual(
      problems(table('| Flutter 1.0.0 | 1.0.2 | 1.0.2 | Flutter ≥ 3.44 |')),
      ['README.md:1: the versions table has no Capacitor row']
    );
  });

  test('docs/*.md files are read, other files are not', () => {
    const { root } = project('# SallaPush\n', {
      docs: {
        'REFERENCE.md': '# Reference\n',
        'notes.txt': '```ts\nx;\n```\n',
      },
    });
    assert.deepEqual(markdownFiles(root), ['README.md', 'docs/REFERENCE.md']);
  });
});

function capture() {
  const chunks = [];
  return { write: (text) => chunks.push(text), text: () => chunks.join('') };
}

describe('snippetLines and --print', () => {
  test('a region prints dedented, as the check compares it, with a final newline', () => {
    const { root, tracked } = project('# SallaPush\n');
    assert.deepEqual(
      snippetLines(root, 'docs/snippets/Podfile#pods', tracked),
      [
        "pod 'SallaPush', :git => 'git@github.com:SallaApp/sallapush-ios-sdk.git', :tag => '1.0.2'",
      ]
    );
    execFileSync('git', ['init', '--quiet', root]);
    execFileSync('git', ['-C', root, 'add', '-A']);
    const [out, err] = [capture(), capture()];
    assert.equal(
      print('example-app/src/start.ts#split', { root, out, err }),
      0
    );
    assert.equal(out.text(), 'const first = 1;\nconst second = 2;\n');
    assert.equal(err.text(), '');
  });

  test('a whole file prints as it is', () => {
    const { root } = project('# SallaPush\n');
    execFileSync('git', ['init', '--quiet', root]);
    execFileSync('git', ['-C', root, 'add', '-A']);
    const [out, err] = [capture(), capture()];
    assert.equal(print(EXTENSION_SOURCE, { root, out, err }), 0);
    assert.equal(out.text(), EXTENSION);
  });

  test('a source the check refuses prints nothing and fails, saying why', () => {
    const { root } = project('# SallaPush\n');
    execFileSync('git', ['init', '--quiet', root]);
    execFileSync('git', ['-C', root, 'add', '-A']);
    for (const [value, message] of [
      [
        'example-app/src/start.ts#tap-listener',
        'example-app/src/start.ts has no region tap-listener',
      ],
      [
        'src/index.ts',
        'src/index.ts is not a file the checks build; snippets come from example-app/ or docs/snippets/',
      ],
    ]) {
      const [out, err] = [capture(), capture()];
      assert.equal(print(value, { root, out, err }), 1);
      assert.equal(out.text(), '');
      assert.equal(err.text(), `check-readme-snippets: ${message}\n`);
    }
  });

  test('the command line prints a region of the repository, and refuses other arguments', () => {
    const script = path.join(ROOT, 'scripts/check-readme-snippets.mjs');
    // The repository's own pin, so that a native bump needs no change here.
    const { ios } = readPins(ROOT);
    assert.equal(
      execFileSync(
        process.execPath,
        [script, '--print', 'docs/snippets/Podfile#podfile-app'],
        { encoding: 'utf8' }
      ),
      `pod 'SallaPushCore', :git => 'git@github.com:SallaApp/sallapush-ios-sdk.git', :tag => '${ios}'\n` +
        `pod 'SallaPush', :git => 'git@github.com:SallaApp/sallapush-ios-sdk.git', :tag => '${ios}'\n`
    );
    assert.throws(
      () =>
        execFileSync(process.execPath, [script, '--print'], {
          stdio: 'pipe',
        }),
      (error) => error.status === 2 && /^usage:/.test(String(error.stderr))
    );
  });
});

describe('the command line', () => {
  test('names each problem and fails', () => {
    const { root } = project('```ts\nx;\n```\n');
    execFileSync('git', ['init', '--quiet', root]);
    const [out, err] = [capture(), capture()];
    assert.equal(run({ root, out, err }), 1);
    assert.match(err.text(), /README\.md:1: the ts block has no/);
    assert.match(err.text(), /1 problem\(s\)/);
  });

  test('outside a git repository it fails without a stack trace', () => {
    const { root } = project('# SallaPush\n');
    const [out, err] = [capture(), capture()];
    assert.equal(run({ root, out, err }), 1);
    assert.match(err.text(), /git ls-files failed/);
  });

  test('the repository passes', () => {
    const [out, err] = [capture(), capture()];
    assert.equal(run({ root: ROOT, out, err }), 0, err.text());
    assert.match(out.text(), /every SallaPush version named is the pinned one/);
  });
});
