#!/usr/bin/env node
// Fails unless the TypeScript plugin interface and both native plugins declare the same methods with the same kinds and
// the same events, and unless the plugin classes are named where Capacitor's CLI reads them. A Capacitor plugin fails a
// missing method only at run time, with "not implemented".
//   node scripts/check-plugin-methods.mjs
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const FILES = {
  typescript: 'src/internal/native.ts',
  swift: 'ios/Sources/SallaPushCapacitorPlugin/SallaPushPlugin.swift',
  kotlin:
    'android/src/main/java/sa/salla/sallapush/capacitor/SallaPushPlugin.kt',
  events: 'android/src/main/java/sa/salla/sallapush/capacitor/EventRegistry.kt',
  swiftSources: 'ios/Sources',
};
// Capacitor's own plugin members. The native plugins override some of them, so they are left out of the native method
// sets, and the interface declares none but addListener, whose overloads name the events.
export const CAPACITOR_MEMBERS = [
  'addListener',
  'removeListener',
  'removeAllListeners',
  'checkPermissions',
  'requestPermissions',
];
const INTERFACE = 'SallaPushNativePlugin';
const PLUGIN_CLASS = 'SallaPushPlugin';
const SIDES = {
  typescript: 'native.ts',
  swift: 'SallaPushPlugin.swift',
  kotlin: 'SallaPushPlugin.kt',
};
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export class PluginMethodsError extends Error {}

/**
 * The methods of the interface SallaPushNativePlugin, each 'promise' (it returns Promise<Value<…>>) or 'none' (it
 * returns Promise<void>), and the event names of its addListener overloads.
 */
export function typescriptPlugin(text, file = FILES.typescript) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(
    (statement) =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === INTERFACE
  );
  if (!declaration) {
    throw new PluginMethodsError(`${file} declares no interface ${INTERFACE}`);
  }
  const methods = new Map();
  const events = [];
  const problems = [];
  for (const member of declaration.members) {
    const name = member.name ? member.name.getText(source) : '(unnamed)';
    const where = `${file}:${lineOf(text, member.getStart(source))}`;
    if (!ts.isMethodSignature(member)) {
      problems.push(`${where}: ${name} is not a method`);
    } else if (name === 'addListener') {
      const type = member.parameters[0]?.type;
      if (
        type &&
        ts.isLiteralTypeNode(type) &&
        ts.isStringLiteral(type.literal)
      ) {
        events.push(type.literal.text);
      } else {
        problems.push(
          `${where}: an addListener overload whose event name is not a string literal`
        );
      }
    } else if (CAPACITOR_MEMBERS.includes(name)) {
      problems.push(
        `${where}: ${name} is Capacitor's own plugin member; the interface must not declare it`
      );
    } else if (methods.has(name)) {
      problems.push(`${where}: ${name} is declared more than once`);
    } else {
      const kind = returnKind(member.type);
      if (kind) {
        methods.set(name, kind);
      } else {
        problems.push(
          `${where}: ${name} returns ${member.type ? member.type.getText(source) : 'no declared type'}; a plugin method returns Promise<Value<…>> or Promise<void>`
        );
      }
    }
  }
  return { methods, events, problems };
}

function returnKind(type) {
  if (
    !type ||
    !ts.isTypeReferenceNode(type) ||
    type.typeName.getText() !== 'Promise' ||
    type.typeArguments?.length !== 1
  ) {
    return null;
  }
  const [argument] = type.typeArguments;
  if (argument.kind === ts.SyntaxKind.VoidKeyword) {
    return 'none';
  }
  return ts.isTypeReferenceNode(argument) &&
    argument.typeName.getText() === 'Value'
    ? 'promise'
    : null;
}

/**
 * The pluginMethods entries of SallaPushPlugin.swift with their kinds, the @objc funcs that take a CAPPluginCall, and the
 * event names of its notifyListeners calls.
 */
export function swiftPlugin(text, file = FILES.swift) {
  const methods = new Map();
  const problems = [];
  const entries = [...text.matchAll(/^[ \t]*CAPPluginMethod\(/gm)];
  for (const entry of entries) {
    const where = `${file}:${lineOf(text, entry.index)}`;
    const match =
      /^[ \t]*CAPPluginMethod\(\s*name:\s*"(\w+)",\s*returnType:\s*(\w+)\s*\)/.exec(
        text.slice(entry.index)
      );
    if (!match) {
      problems.push(
        `${where}: a pluginMethods entry this check can't read; write CAPPluginMethod(name: "<name>", returnType: CAPPluginReturnNone or CAPPluginReturnPromise)`
      );
      continue;
    }
    const [, name, returnType] = match;
    const kind = {
      CAPPluginReturnNone: 'none',
      CAPPluginReturnPromise: 'promise',
    }[returnType];
    if (!kind) {
      problems.push(
        `${where}: ${name} has the return type ${returnType}; the plugin's methods use CAPPluginReturnNone or CAPPluginReturnPromise`
      );
    } else if (methods.has(name)) {
      problems.push(`${where}: ${name} is listed more than once`);
    } else if (!CAPACITOR_MEMBERS.includes(name)) {
      methods.set(name, kind);
    }
  }
  const funcs = new Set(
    [
      ...text.matchAll(
        /^[ \t]*@objc\s+(?:(?:public|internal|open|override|final)\s+)*func\s+(\w+)\s*\(\s*_\s+call\s*:\s*CAPPluginCall\s*\??\s*\)/gm
      ),
    ].map((match) => match[1])
  );
  const events = [
    ...text.matchAll(/^[ \t]*(?:self\.)?notifyListeners\(\s*"([^"]*)"/gm),
  ].map((match) => match[1]);
  return { methods, funcs, events, problems };
}

/**
 * The @PluginMethod functions of SallaPushPlugin.kt with their kinds (RETURN_NONE is 'none'; RETURN_PROMISE, the
 * default, 'promise'), and whether @CapacitorPlugin stands right above class SallaPushPlugin.
 */
export function kotlinPlugin(text, file = FILES.kotlin) {
  const methods = new Map();
  const problems = [];
  for (const annotation of text.matchAll(
    /^[ \t]*@PluginMethod\b(?:[ \t]*\(([^)]*)\))?/gm
  )) {
    const where = `${file}:${lineOf(text, annotation.index)}`;
    const declaration =
      /^\s*(?:(?:public|internal|override|open|final)\s+)*fun\s+(\w+)\s*\(\s*call\s*:\s*PluginCall\s*\)/.exec(
        text.slice(annotation.index + annotation[0].length)
      );
    if (!declaration) {
      problems.push(
        `${where}: a @PluginMethod that isn't followed by fun <name>(call: PluginCall)`
      );
      continue;
    }
    const name = declaration[1];
    const returnType =
      /returnType\s*=\s*(?:PluginMethod\.)?(RETURN_\w+)/.exec(
        annotation[1] ?? ''
      )?.[1] ?? 'RETURN_PROMISE';
    const kind = { RETURN_NONE: 'none', RETURN_PROMISE: 'promise' }[returnType];
    if (CAPACITOR_MEMBERS.includes(name)) {
      continue;
    }
    if (!kind) {
      problems.push(
        `${where}: ${name} has the return type ${returnType}; the plugin's methods use RETURN_NONE or RETURN_PROMISE`
      );
    } else if (methods.has(name)) {
      problems.push(`${where}: ${name} is annotated more than once`);
    } else {
      methods.set(name, kind);
    }
  }
  // Capacitor's CLI takes the first word after "class" that follows a line starting with @CapacitorPlugin, comments
  // included (@capacitor/cli's dist/android/update.js), so only whitespace may stand between them.
  const plugin = /^@CapacitorPlugin\b/m.exec(text);
  if (!plugin) {
    problems.push(
      `${file}: no line starts with @CapacitorPlugin, so Capacitor's CLI finds no plugin class`
    );
  } else if (
    !new RegExp(
      `^@CapacitorPlugin(?:[ \\t]*\\([^)]*\\))?\\s*class\\s+${PLUGIN_CLASS}\\b`
    ).test(text.slice(plugin.index))
  ) {
    problems.push(
      `${file}:${lineOf(text, plugin.index)}: @CapacitorPlugin must be followed by class ${PLUGIN_CLASS}, with nothing but whitespace between: Capacitor's CLI takes the first word after "class" that follows it`
    );
  }
  return { methods, problems };
}

/** The jsName of each case of the enum class Event in EventRegistry.kt. */
export function kotlinEvents(text, file = FILES.events) {
  const start =
    /enum\s+class\s+Event\s*\(\s*val\s+jsName\s*:\s*String\s*\)\s*\{/.exec(
      text
    );
  if (!start) {
    throw new PluginMethodsError(
      `${file} declares no enum class Event(val jsName: String)`
    );
  }
  const body = text.slice(start.index + start[0].length);
  const end = body.search(/[;}]/);
  return [
    ...body
      .slice(0, end < 0 ? body.length : end)
      .matchAll(/\b\w+\(\s*"([^"]*)"\s*\)/g),
  ].map((match) => match[1]);
}

/**
 * The @objc( texts of the Swift sources: SallaPushPlugin.swift's first one must be @objc(SallaPushPlugin), and no other
 * may exist. Capacitor's CLI puts the first @objc(Name) of every Swift file, comments included, into packageClassList
 * (@capacitor/cli's dist/util/iosplugin.js), so another one would register a class that isn't a plugin.
 */
export function objcProblems(root) {
  const problems = [];
  const sources = path.join(root, FILES.swiftSources);
  const files = fs.existsSync(sources)
    ? fs
        .readdirSync(sources, { recursive: true })
        .filter((name) => name.endsWith('.swift'))
        .map((name) =>
          path.posix.join(FILES.swiftSources, name.split(path.sep).join('/'))
        )
        .sort()
    : [];
  if (!files.includes(FILES.swift)) {
    return [`${FILES.swift}: missing`];
  }
  for (const file of files) {
    const text = readText(root, file);
    const found = [...text.matchAll(/@objc\s*\(([^)]*)\)?/g)];
    found.forEach((match, index) => {
      const where = `${file}:${lineOf(text, match.index)}`;
      if (file !== FILES.swift) {
        problems.push(
          `${where}: holds ${match[0]}; only SallaPushPlugin.swift's @objc(${PLUGIN_CLASS}) may name an Objective-C class, since Capacitor's CLI registers the first @objc(Name) of every Swift file as a plugin`
        );
      } else if (index === 0 && match[0] !== `@objc(${PLUGIN_CLASS})`) {
        problems.push(
          `${where}: the first @objc( text is ${match[0]}, not @objc(${PLUGIN_CLASS}): Capacitor's CLI takes the first one, comments included`
        );
      } else if (index > 0) {
        problems.push(
          `${where}: holds a second @objc( text, ${match[0]}; @objc(${PLUGIN_CLASS}) must be the only one`
        );
      }
    });
    if (file === FILES.swift && found.length === 0) {
      problems.push(`${file}: has no @objc(${PLUGIN_CLASS})`);
    }
  }
  return problems;
}

/** Every problem of the plugin's three declarations, and what they agree on. */
export function checkPluginMethods(root = ROOT) {
  const typescript = typescriptPlugin(readText(root, FILES.typescript));
  const swift = swiftPlugin(readText(root, FILES.swift));
  const kotlin = kotlinPlugin(readText(root, FILES.kotlin));
  const kotlinEventNames = kotlinEvents(readText(root, FILES.events));
  const problems = [
    ...typescript.problems,
    ...swift.problems,
    ...kotlin.problems,
  ];

  const methodSides = [
    [SIDES.typescript, typescript.methods],
    [SIDES.swift, swift.methods],
    [SIDES.kotlin, kotlin.methods],
  ];
  const names = [
    ...new Set(methodSides.flatMap(([, methods]) => [...methods.keys()])),
  ].sort();
  for (const name of names) {
    const missing = methodSides
      .filter(([, methods]) => !methods.has(name))
      .map(([side]) => side);
    if (missing.length > 0) {
      problems.push(`${name}: missing from ${missing.join(' and ')}`);
      continue;
    }
    const kinds = methodSides.map(([side, methods]) => [
      side,
      methods.get(name),
    ]);
    if (new Set(kinds.map(([, kind]) => kind)).size > 1) {
      problems.push(
        `${name}: the kinds differ: ${kinds.map(([side, kind]) => `${side} ${kind}`).join(', ')}`
      );
    }
  }
  for (const name of swift.methods.keys()) {
    if (!swift.funcs.has(name)) {
      problems.push(
        `${name}: ${SIDES.swift} lists it in pluginMethods but has no @objc func ${name}(_ call: CAPPluginCall)`
      );
    }
  }

  const eventSides = [
    [SIDES.typescript, new Set(typescript.events)],
    [SIDES.swift, new Set(swift.events)],
    ['EventRegistry.kt', new Set(kotlinEventNames)],
  ];
  const events = [
    ...new Set(eventSides.flatMap(([, found]) => [...found])),
  ].sort();
  for (const event of events) {
    const missing = eventSides
      .filter(([, found]) => !found.has(event))
      .map(([side]) => side);
    if (missing.length > 0) {
      problems.push(`event '${event}': missing from ${missing.join(' and ')}`);
    }
  }

  problems.push(...objcProblems(root));
  const kinds = [...typescript.methods.values()];
  return {
    problems,
    methods: names.length,
    promise: kinds.filter((kind) => kind === 'promise').length,
    none: kinds.filter((kind) => kind === 'none').length,
    events: events.length,
  };
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function readText(root, file) {
  try {
    return fs
      .readFileSync(path.join(root, file), 'utf8')
      .replace(/\r\n/g, '\n');
  } catch (error) {
    throw new PluginMethodsError(
      `${file}: ${error.code === 'ENOENT' ? 'missing' : error.message}`
    );
  }
}

/** Runs the command line; returns the exit status. */
export function run({
  root = ROOT,
  out = process.stdout,
  err = process.stderr,
} = {}) {
  let result;
  try {
    result = checkPluginMethods(root);
  } catch (error) {
    if (!(error instanceof PluginMethodsError)) {
      throw error;
    }
    err.write(`check-plugin-methods: ${error.message}\n`);
    return 1;
  }
  for (const problem of result.problems) {
    err.write(`check-plugin-methods: ${problem}\n`);
  }
  if (result.problems.length > 0) {
    err.write(`check-plugin-methods: ${result.problems.length} problem(s)\n`);
    return 1;
  }
  out.write(
    `check-plugin-methods: ${result.methods} methods (${result.promise} promise, ${result.none} none) and ${result.events} events agree in ${Object.values(SIDES).join(', ')} and EventRegistry.kt; every Swift method has its @objc func; @objc(${PLUGIN_CLASS}) and @CapacitorPlugin are where Capacitor's CLI reads them; 0 problems\n`
  );
  return 0;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.length > 2) {
    process.stderr.write('usage: node scripts/check-plugin-methods.mjs\n');
    process.exitCode = 2;
  } else {
    process.exitCode = run();
  }
}
