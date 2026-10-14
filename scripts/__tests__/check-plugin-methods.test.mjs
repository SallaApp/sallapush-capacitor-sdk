import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  checkPluginMethods,
  FILES,
  kotlinEvents,
  kotlinPlugin,
  PluginMethodsError,
  run,
  swiftPlugin,
  typescriptPlugin,
} from '../check-plugin-methods.mjs';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sallapush-methods-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

const NATIVE_TS = `import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type Value<T> = { value: T };

export interface SallaPushNativePlugin {
  initialize(options: { appId: string }): Promise<void>;
  getSdkVersion(): Promise<Value<string>>;
  requestPermission(options: {
    fallbackToSettings: boolean;
  }): Promise<Value<boolean>>;

  addListener(
    eventName: 'click',
    listenerFunc: (event: unknown) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'log',
    listenerFunc: (event: unknown) => void
  ): Promise<PluginListenerHandle>;
}

export const native = registerPlugin<SallaPushNativePlugin>('SallaPush');
`;
const SWIFT = `import Capacitor

/// The plugin that Capacitor loads.
@objc(SallaPushPlugin)
public final class SallaPushPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SallaPushPlugin"
    public let jsName = "SallaPush"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnNone),
        CAPPluginMethod(name: "getSdkVersion", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise)
    ]

    @objc override public func removeAllListeners(_ call: CAPPluginCall?) {}

    @objc func initialize(_ call: CAPPluginCall) {}

    @objc func getSdkVersion(_ call: CAPPluginCall) {}

    @objc func requestPermission(_ call: CAPPluginCall) {}

    func emitOnClick(_ value: [String: Any]) {
        notifyListeners("click", data: value)
    }

    func emitOnLog(_ value: [String: Any]) {
        notifyListeners("log", data: value)
    }
}
`;
const KOTLIN = `package sa.salla.sallapush.capacitor

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/** The plugin that Capacitor loads; see @PluginMethod below. */
@CapacitorPlugin(name = "SallaPush")
class SallaPushPlugin : Plugin() {
  @PluginMethod(returnType = PluginMethod.RETURN_NONE)
  fun initialize(call: PluginCall) {}

  @PluginMethod
  fun getSdkVersion(call: PluginCall) = call.resolve()

  @PluginMethod(returnType = PluginMethod.RETURN_PROMISE)
  fun requestPermission(call: PluginCall) {}

  @PluginMethod(returnType = PluginMethod.RETURN_PROMISE)
  override fun removeAllListeners(call: PluginCall) {}
}
`;
const REGISTRY = `package sa.salla.sallapush.capacitor

/** The JavaScript events, by their Capacitor event names. */
internal enum class Event(val jsName: String) {
  CLICK("click"),
  LOG("log"),
}

internal class EventRegistry {
  private enum class Kind(val jsName: String) {
    CLICK("click"),
    PERMISSION("permission"),
  }
}
`;

let projects = 0;
function project({
  typescript = NATIVE_TS,
  swift = SWIFT,
  kotlin = KOTLIN,
  registry = REGISTRY,
  extra = {},
} = {}) {
  projects += 1;
  const root = path.join(temporary, `project-${projects}`);
  const files = {
    [FILES.typescript]: typescript,
    [FILES.swift]: swift,
    [FILES.kotlin]: kotlin,
    [FILES.events]: registry,
    'ios/Sources/SallaPushCapacitorPlugin/Console.swift':
      'import os\n\nstruct Console {}\n',
    ...extra,
  };
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

function problems(options) {
  return checkPluginMethods(project(options)).problems;
}

function edit(text, old, replacement) {
  assert.ok(text.includes(old), `the fixture holds ${old}`);
  return text.replace(old, replacement);
}

function capture() {
  const chunks = [];
  return { write: (text) => chunks.push(text), text: () => chunks.join('') };
}

describe('typescriptPlugin', () => {
  test("the interface's methods with their kinds, and the event names of addListener", () => {
    const plugin = typescriptPlugin(NATIVE_TS);
    assert.deepEqual(
      [...plugin.methods],
      [
        ['initialize', 'none'],
        ['getSdkVersion', 'promise'],
        ['requestPermission', 'promise'],
      ]
    );
    assert.deepEqual(plugin.events, ['click', 'log']);
    assert.deepEqual(plugin.problems, []);
  });

  test('a file without the interface is refused', () => {
    assert.throws(
      () => typescriptPlugin('export interface OtherPlugin {}\n'),
      (error) =>
        error instanceof PluginMethodsError &&
        /declares no interface SallaPushNativePlugin/.test(error.message)
    );
  });
});

describe('swiftPlugin and kotlinPlugin', () => {
  test("pluginMethods, the @objc funcs and the events of the Swift plugin, Capacitor's own members left out", () => {
    const plugin = swiftPlugin(SWIFT);
    assert.deepEqual(
      [...plugin.methods],
      [
        ['initialize', 'none'],
        ['getSdkVersion', 'promise'],
        ['requestPermission', 'promise'],
      ]
    );
    assert.deepEqual([...plugin.funcs].sort(), [
      'getSdkVersion',
      'initialize',
      'removeAllListeners',
      'requestPermission',
    ]);
    assert.deepEqual(plugin.events, ['click', 'log']);
  });

  test("the @PluginMethod functions of the Kotlin plugin, promise by default, Capacitor's own members left out", () => {
    const plugin = kotlinPlugin(KOTLIN);
    assert.deepEqual(
      [...plugin.methods],
      [
        ['initialize', 'none'],
        ['getSdkVersion', 'promise'],
        ['requestPermission', 'promise'],
      ]
    );
    assert.deepEqual(plugin.problems, []);
  });

  test("the jsNames of EventRegistry.kt's Event, not of its other enums", () => {
    assert.deepEqual(kotlinEvents(REGISTRY), ['click', 'log']);
    assert.throws(
      () => kotlinEvents('internal enum class Kind(val jsName: String) {}\n'),
      /declares no enum class Event\(val jsName: String\)/
    );
  });
});

describe('checkPluginMethods', () => {
  test('a plugin declared alike on the three sides passes, with the counts', () => {
    assert.deepEqual(checkPluginMethods(project()), {
      problems: [],
      methods: 3,
      promise: 2,
      none: 1,
      events: 2,
    });
  });

  test('a method missing on one platform fails, naming where', () => {
    assert.deepEqual(
      problems({
        kotlin: edit(
          KOTLIN,
          '  @PluginMethod(returnType = PluginMethod.RETURN_PROMISE)\n  fun requestPermission(call: PluginCall) {}\n',
          ''
        ),
      }),
      ['requestPermission: missing from SallaPushPlugin.kt']
    );
    assert.deepEqual(
      problems({
        swift: edit(
          SWIFT,
          ',\n        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise)',
          ''
        ),
      }),
      ['requestPermission: missing from SallaPushPlugin.swift']
    );
    assert.deepEqual(
      problems({
        typescript: edit(
          NATIVE_TS,
          '  initialize(options: { appId: string }): Promise<void>;\n',
          ''
        ),
      }),
      ['initialize: missing from native.ts']
    );
  });

  test('a wrong return kind fails, naming each side', () => {
    assert.deepEqual(
      problems({
        swift: edit(
          SWIFT,
          'name: "requestPermission", returnType: CAPPluginReturnPromise',
          'name: "requestPermission", returnType: CAPPluginReturnNone'
        ),
      }),
      [
        'requestPermission: the kinds differ: native.ts promise, SallaPushPlugin.swift none, SallaPushPlugin.kt promise',
      ]
    );
    assert.deepEqual(
      problems({
        kotlin: edit(
          KOTLIN,
          '  @PluginMethod\n  fun getSdkVersion',
          '  @PluginMethod(returnType = PluginMethod.RETURN_NONE)\n  fun getSdkVersion'
        ),
      }),
      [
        'getSdkVersion: the kinds differ: native.ts promise, SallaPushPlugin.swift promise, SallaPushPlugin.kt none',
      ]
    );
  });

  test('a kind none of the three sides supports fails', () => {
    const result = problems({
      typescript: edit(
        NATIVE_TS,
        'getSdkVersion(): Promise<Value<string>>;',
        'getSdkVersion(): Promise<string>;'
      ),
      swift: edit(
        SWIFT,
        'name: "initialize", returnType: CAPPluginReturnNone',
        'name: "initialize", returnType: CAPPluginReturnCallback'
      ),
      kotlin: edit(
        KOTLIN,
        '  @PluginMethod(returnType = PluginMethod.RETURN_PROMISE)\n  fun requestPermission',
        '  @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)\n  fun requestPermission'
      ),
    });
    assert.match(
      result[0],
      /^src\/internal\/native\.ts:7: getSdkVersion returns Promise<string>; a plugin method returns Promise<Value<…>> or Promise<void>$/
    );
    assert.match(
      result[1],
      /SallaPushPlugin\.swift:9: initialize has the return type CAPPluginReturnCallback/
    );
    assert.match(
      result[2],
      /SallaPushPlugin\.kt:17: requestPermission has the return type RETURN_CALLBACK/
    );
  });

  test('a Swift method without its @objc func fails', () => {
    assert.deepEqual(
      problems({
        swift: edit(
          SWIFT,
          '    @objc func getSdkVersion(_ call: CAPPluginCall) {}\n',
          '    func getSdkVersion(_ call: CAPPluginCall) {}\n'
        ),
      }),
      [
        'getSdkVersion: SallaPushPlugin.swift lists it in pluginMethods but has no @objc func getSdkVersion(_ call: CAPPluginCall)',
      ]
    );
  });

  test('an extra event fails, naming the sides without it', () => {
    assert.deepEqual(
      problems({
        registry: edit(
          REGISTRY,
          '  LOG("log"),\n',
          '  LOG("log"),\n  WILL_DISPLAY("willDisplay"),\n'
        ),
      }),
      ["event 'willDisplay': missing from native.ts and SallaPushPlugin.swift"]
    );
    assert.deepEqual(
      problems({
        swift: edit(
          SWIFT,
          '        notifyListeners("log", data: value)\n',
          '        notifyListeners("log", data: value)\n        notifyListeners("permissionChange", data: value)\n'
        ),
      }),
      ["event 'permissionChange': missing from native.ts and EventRegistry.kt"]
    );
  });

  test("Capacitor's own members are left out of the native sides, and the interface declares none but addListener", () => {
    assert.deepEqual(
      problems({
        swift: edit(
          SWIFT,
          '        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnNone),\n',
          '        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnNone),\n        CAPPluginMethod(name: "removeAllListeners", returnType: CAPPluginReturnPromise),\n'
        ),
      }),
      []
    );
    assert.deepEqual(
      problems({
        typescript: edit(
          NATIVE_TS,
          '  getSdkVersion(): Promise<Value<string>>;\n',
          '  getSdkVersion(): Promise<Value<string>>;\n  removeAllListeners(): Promise<void>;\n'
        ),
      }),
      [
        "src/internal/native.ts:8: removeAllListeners is Capacitor's own plugin member; the interface must not declare it",
      ]
    );
  });

  test('a second @objc(Name) file fails, naming it', () => {
    assert.deepEqual(
      problems({
        extra: {
          'ios/Sources/SallaPushCapacitorPlugin/Helper.swift':
            'import Foundation\n\n@objc(SallaPushHelper)\nfinal class Helper: NSObject {}\n',
        },
      }),
      [
        "ios/Sources/SallaPushCapacitorPlugin/Helper.swift:3: holds @objc(SallaPushHelper); only SallaPushPlugin.swift's @objc(SallaPushPlugin) may name an Objective-C class, since Capacitor's CLI registers the first @objc(Name) of every Swift file as a plugin",
      ]
    );
  });

  test('an @objc( in a comment above the plugin class fails, as Capacitor reads comments too', () => {
    const result = problems({
      swift: edit(
        SWIFT,
        '/// The plugin that Capacitor loads.\n',
        '/// The plugin that Capacitor loads; Objective-C sees it through @objc(Name).\n'
      ),
    });
    assert.deepEqual(result, [
      `${FILES.swift}:3: the first @objc( text is @objc(Name), not @objc(SallaPushPlugin): Capacitor's CLI takes the first one, comments included`,
      `${FILES.swift}:4: holds a second @objc( text, @objc(SallaPushPlugin); @objc(SallaPushPlugin) must be the only one`,
    ]);
  });

  test('@CapacitorPlugin must stand right above class SallaPushPlugin', () => {
    assert.deepEqual(
      problems({
        kotlin: edit(
          KOTLIN,
          '@CapacitorPlugin(name = "SallaPush")\n',
          '@CapacitorPlugin(name = "SallaPush")\n// The class below is the plugin.\n'
        ),
      }),
      [
        `${FILES.kotlin}:9: @CapacitorPlugin must be followed by class SallaPushPlugin, with nothing but whitespace between: Capacitor's CLI takes the first word after "class" that follows it`,
      ]
    );
    assert.match(
      problems({
        kotlin: edit(
          KOTLIN,
          '@CapacitorPlugin(name = "SallaPush")\n',
          '@Suppress("unused")\n'
        ),
      })[0],
      /no line starts with @CapacitorPlugin/
    );
  });

  test('a @PluginMethod without a plugin method after it, and an entry the check cannot read, fail', () => {
    assert.match(
      problems({
        kotlin: edit(
          KOTLIN,
          '  @PluginMethod\n  fun getSdkVersion(call: PluginCall) = call.resolve()\n',
          '  @PluginMethod\n  fun getSdkVersion(call: PluginCall) = call.resolve()\n\n  @PluginMethod\n  val stray = 1\n'
        ),
      })[0],
      /SallaPushPlugin\.kt:17: a @PluginMethod that isn't followed by fun <name>\(call: PluginCall\)/
    );
    assert.match(
      problems({
        swift: edit(
          SWIFT,
          'CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnNone)',
          'CAPPluginMethod(name: methodName, returnType: CAPPluginReturnNone)'
        ),
      })[0],
      /SallaPushPlugin\.swift:9: a pluginMethods entry this check can't read/
    );
  });
});

describe('the command line', () => {
  test('prints what agrees and passes', () => {
    const [out, err] = [capture(), capture()];
    assert.equal(run({ root: project(), out, err }), 0);
    assert.match(
      out.text(),
      /^check-plugin-methods: 3 methods \(2 promise, 1 none\) and 2 events agree/
    );
    assert.equal(err.text(), '');
  });

  test('names each problem and fails', () => {
    const [out, err] = [capture(), capture()];
    const root = project({
      registry: edit(REGISTRY, '  LOG("log"),\n', ''),
    });
    assert.equal(run({ root, out, err }), 1);
    assert.match(err.text(), /event 'log': missing from EventRegistry\.kt$/m);
    assert.match(err.text(), /check-plugin-methods: 1 problem\(s\)/);
  });

  test('a missing file fails with its name, without a stack trace', () => {
    const root = project();
    fs.rmSync(path.join(root, FILES.kotlin));
    const [out, err] = [capture(), capture()];
    assert.equal(run({ root, out, err }), 1);
    assert.equal(
      err.text(),
      `check-plugin-methods: ${FILES.kotlin}: missing\n`
    );
  });
});

test("the repository's plugin has 42 methods and 7 events on the three sides", () => {
  assert.deepEqual(checkPluginMethods(ROOT), {
    problems: [],
    methods: 42,
    promise: 17,
    none: 25,
    events: 7,
  });
});
