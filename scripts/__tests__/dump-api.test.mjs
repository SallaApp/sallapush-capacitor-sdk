import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ApiDumpError,
  apiSymbols,
  DUMP_FILE,
  dumpApi,
  run,
} from '../dump-api.mjs';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sallapush-dump-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

const TSCONFIG = JSON.stringify({
  compilerOptions: {
    strict: true,
    target: 'ESNext',
    module: 'ESNext',
    moduleResolution: 'bundler',
    lib: ['ESNext'],
    skipLibCheck: true,
  },
});

const INDEX = `export { Facade, run } from './facade';
export { Level } from './types';
export type { Config, Notification, Options, Subscription } from './types';
export type { Props } from './other/props';
`;
const FACADE = `import type { Config, SubNamespace } from './types';

/** The facade. */
export const Facade: {
  start(id: string, config?: Config): void;
  readonly Sub: SubNamespace;
} = {
  start() {},
  Sub: {} as SubNamespace,
};

export function run<T>(value: T, times = 1): T[] {
  return Array(times).fill(value);
}
`;
const TYPES = `export const Level = {
  Off: 'off',
  Debug: 'debug',
} as const;
export type Level = (typeof Level)[keyof typeof Level];

export interface Subscription {
  remove(): void;
}

export interface InnerNamespace {
  count(): Promise<number>;
}

export interface SubNamespace {
  readonly inner: InnerNamespace;
  on(event: 'click', listener: (id: string) => void): Subscription;
  on(event: 'change', listener: (value: number) => void): Subscription;
  get(key?: string): string | null;
}

export interface Config {
  level?: Level;
  mode?: 'development' | 'production';
  ios?: {
    group?: string;
  };
}

export interface Notification extends Subscription {
  readonly title: string | null;
  getString(key: string): string | null;
}

export type Options = 'a' | 'b';
`;
const PROPS = `export type Props = {
  ios?: { appId?: string };
  android?: { appId?: string; icon?: string };
};
`;

let projects = 0;
function project(files) {
  projects += 1;
  const root = path.join(temporary, `project-${projects}`);
  for (const [file, text] of Object.entries({
    'tsconfig.json': TSCONFIG,
    ...files,
  })) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

function sample(overrides = {}) {
  return project({
    'src/index.ts': INDEX,
    'src/facade.ts': FACADE,
    'src/types.ts': TYPES,
    'src/other/props.ts': PROPS,
    ...overrides,
  });
}

function capture() {
  const chunks = [];
  return { write: (text) => chunks.push(text), text: () => chunks.join('') };
}

describe('dumpApi', () => {
  test('every exported declaration and member, sorted, with the const expanded', () => {
    assert.deepEqual(dumpApi({ root: sample() }), [
      'interface Config',
      'Config.ios?: { ... }',
      'Config.ios.group?: string',
      'Config.level?: Level',
      "Config.mode?: 'development' | 'production'",
      'const Facade',
      'Facade.Sub: SubNamespace [readonly]',
      'Facade.Sub.get(key?: string): string | null',
      'Facade.Sub.inner: InnerNamespace [readonly]',
      'Facade.Sub.inner.count(): Promise<number>',
      "Facade.Sub.on(event: 'change', listener: (value: number) => void): Subscription",
      "Facade.Sub.on(event: 'click', listener: (id: string) => void): Subscription",
      'Facade.start(id: string, config?: Config): void',
      'const Level',
      'type Level = (typeof Level)[keyof typeof Level]',
      "Level.Debug: 'debug' [readonly]",
      "Level.Off: 'off' [readonly]",
      'interface Notification extends Subscription',
      'Notification.getString(key: string): string | null',
      'Notification.title: string | null [readonly]',
      "type Options = 'a' | 'b'",
      'type Props = { ... }',
      'Props.android?: { ... }',
      'Props.android.appId?: string',
      'Props.android.icon?: string',
      'Props.ios?: { ... }',
      'Props.ios.appId?: string',
      'interface Subscription',
      'Subscription.remove(): void',
      'function run<T>(value: T, times = 1): T[]',
    ]);
  });

  test('formatting, comments and member order never change the dump', () => {
    const reformatted = TYPES.replace(
      "mode?: 'development' | 'production';",
      "/** The mode. */\n  mode?:\n    | 'development'\n    // the store build\n    | 'production';"
    )
      .replace(
        "on(event: 'click', listener: (id: string) => void): Subscription;\n  on(event: 'change', listener: (value: number) => void): Subscription;",
        "on(\n    event: 'click',\n    listener: (id: string) => void\n  ): Subscription;\n  on(event: 'change', listener: (value: number) => void): Subscription;"
      )
      .replace(
        'export interface Subscription {\n  remove(): void;\n}',
        'export interface Subscription { remove ( ) : void }'
      );
    assert.notEqual(reformatted, TYPES);
    const reordered = TYPES.replace(
      "  level?: Level;\n  mode?: 'development' | 'production';",
      "  mode?: 'development' | 'production';\n  level?: Level;"
    );
    assert.notEqual(reordered, TYPES);
    const expected = dumpApi({ root: sample() });
    assert.deepEqual(
      dumpApi({ root: sample({ 'src/types.ts': reformatted }) }),
      expected
    );
    assert.deepEqual(
      dumpApi({ root: sample({ 'src/types.ts': reordered }) }),
      expected
    );
  });

  test('union members keep their declared order, whatever other types the program creates first', () => {
    const lines = dumpApi({
      root: sample({
        'src/facade.ts': `${FACADE}export const order: 'production' = 'production';\n`,
      }),
    });
    assert.ok(lines.includes("Config.mode?: 'development' | 'production'"));
  });

  test('a const with another declared type shows that type', () => {
    const root = project({
      'src/index.ts':
        'export const handler: (value: number) => void = () => {};\n',
    });
    assert.deepEqual(dumpApi({ root }), [
      'const handler',
      'handler: (value: number) => void',
    ]);
  });

  for (const [kind, source] of [
    ['an enum', 'export enum Kind { A }\n'],
    ['a class', 'export class Thing {}\n'],
    ['an index signature', 'export interface Bag { [key: string]: string }\n'],
    ['a property without a type', 'export interface Loose { value; }\n'],
    [
      "a spread in an 'as const' object",
      'const base = { A: 1 };\nexport const Kind = { ...base } as const;\n',
    ],
    ['a const without a declared type', "export const Kind = '1.0.0';\n"],
  ]) {
    test(`${kind} is refused, naming the declaration`, () => {
      const root = project({ 'src/index.ts': source });
      assert.throws(
        () => dumpApi({ root }),
        (error) =>
          error instanceof ApiDumpError &&
          /^(Kind|Thing|Bag\.|Loose\.value)/.test(error.message)
      );
    });
  }

  test('a syntax error is refused with its file', () => {
    const root = sample({
      'src/types.ts': `${TYPES}export interface Broken {\n`,
    });
    assert.throws(
      () => dumpApi({ root }),
      (error) =>
        error instanceof ApiDumpError &&
        error.message.startsWith('src/types.ts:')
    );
  });

  test('a missing entry is refused', () => {
    assert.throws(
      () => dumpApi({ root: project({}) }),
      /src\/index\.ts does not exist/
    );
  });
});

describe('apiSymbols', () => {
  test('declarations, members and event overloads', () => {
    assert.deepEqual(
      [
        ...apiSymbols([
          'const Facade',
          'type Level = (typeof Level)[keyof typeof Level]',
          'interface Notification extends Subscription',
          'function run<T>(value: T, times = 1): T[]',
          'Facade.Sub.inner: InnerNamespace [readonly]',
          "Facade.Sub.on(event: 'click', listener: (id: string) => void): Subscription",
          'Facade.Sub.get(key?: string): string | null',
          "Facade.Sub.off(event?: 'click'): void",
          'Config.ios?: { ... }',
        ]),
      ].sort(),
      [
        'Config.ios',
        'Facade',
        'Facade.Sub.get',
        'Facade.Sub.inner',
        'Facade.Sub.off',
        "Facade.Sub.off('click')",
        'Facade.Sub.on',
        "Facade.Sub.on('click')",
        'Level',
        'Notification',
        'run',
      ]
    );
  });
});

describe('the command line', () => {
  test('--write, then --check passes, and a change of the API fails with the lines', () => {
    const root = sample();
    const [out, err] = [capture(), capture()];
    assert.equal(run(['--check'], { root, out, err }), 1);
    assert.match(
      err.text(),
      /is missing; run node scripts\/dump-api\.mjs --write/
    );

    assert.equal(run(['--write'], { root, out, err }), 0);
    assert.match(
      out.text(),
      /wrote api\/sallapush-capacitor\.api \(30 lines\)/
    );
    assert.equal(run(['--check'], { root, out, err }), 0);

    fs.writeFileSync(
      path.join(root, 'src/types.ts'),
      TYPES.replace('  remove(): void;', '  remove(all?: boolean): void;')
    );
    const failure = capture();
    assert.equal(run(['--check'], { root, out, err: failure }), 1);
    assert.match(failure.text(), /^- Subscription\.remove\(\): void$/m);
    assert.match(
      failure.text(),
      /^\+ Subscription\.remove\(all\?: boolean\): void$/m
    );
    assert.match(failure.text(), /node scripts\/dump-api\.mjs --write/);
  });

  test('without an argument it prints the dump', () => {
    const [out, err] = [capture(), capture()];
    assert.equal(run([], { root: sample(), out, err }), 0);
    assert.match(
      out.text(),
      /^Facade\.Sub\.inner\.count\(\): Promise<number>$/m
    );
  });

  test('an unknown argument is a usage error', () => {
    const [out, err] = [capture(), capture()];
    assert.equal(run(['--fix'], { root: sample(), out, err }), 2);
    assert.match(err.text(), /^usage:/);
  });

  test('an error of the dump fails without a stack trace', () => {
    const [out, err] = [capture(), capture()];
    const root = project({ 'src/index.ts': 'export enum Kind { A }\n' });
    assert.equal(run(['--check'], { root, out, err }), 1);
    assert.match(err.text(), /^dump-api: Kind:/);
  });
});

test(`the repository's ${DUMP_FILE} is current`, () => {
  const [out, err] = [capture(), capture()];
  assert.equal(run(['--check'], { root: ROOT, out, err }), 0, err.text());
});
