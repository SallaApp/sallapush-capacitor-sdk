#!/usr/bin/env node
// Fails unless every public symbol of the pinned native SDKs is mapped exactly once in tool/api-parity/mapping.json.
//   node scripts/check-api-parity.mjs
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { apiSymbols, DUMP_FILE } from './dump-api.mjs';

export const FILES = {
  ios: 'tool/api-parity/native-ios-API.txt',
  android: 'tool/api-parity/native-android-sallapush.api',
  mapping: 'tool/api-parity/mapping.json',
  dump: DUMP_FILE,
};
// The dependency pins that nativeVersions must equal: each file declares its platform's pin exactly once.
export const PINS = {
  ios: {
    file: 'Salla.saSallapushCapacitor.podspec',
    pattern: /s\.dependency\s+["']SallaPush["'],\s*["']([^"']+)["']/g,
  },
  android: {
    file: 'android/build.gradle',
    pattern: /["']com\.salla\.push:sallapush:([^"']+)["']/g,
  },
};
export const STATUSES = ['W', 'I', 'A', 'N', 'X'];
const ENTRY_FIELDS = ['id', 'status', 'ios', 'android', 'ts', 'reason'];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export class ParityError extends Error {}

/** The iOS keys: every line of API.txt (`<module> | <kind> | <name> | <declaration>`). */
export function iosKeys(text) {
  const keys = [];
  text.split('\n').forEach((line, index) => {
    if (line.trim() === '') {
      return;
    }
    if (!/^\S+ \| [\w.]+ \| \S.* \| \S.*$/.test(line)) {
      throw new ParityError(
        `${FILES.ios}:${index + 1}: not an API.txt line: ${line}`
      );
    }
    keys.push(line);
  });
  return keys;
}

/** The Android keys of an apiCheck dump: `<class>`, `<class>#<name> <descriptor>` for a fun, `<class>#<NAME>` for a field. */
export function androidKeys(text) {
  const keys = [];
  let owner = null;
  text.split('\n').forEach((line, index) => {
    const where = `${FILES.android}:${index + 1}`;
    if (line.trim() === '') {
      return;
    }
    const type =
      /^(?:public |protected )?(?:abstract |final |open |sealed |static )*(?:annotation |enum |interface )?class (\S+)(?: : .*)? \{$/.exec(
        line
      );
    if (type) {
      if (owner !== null) {
        throw new ParityError(`${where}: a class inside ${owner}`);
      }
      owner = type[1];
      keys.push(owner);
      return;
    }
    if (line === '}') {
      if (owner === null) {
        throw new ParityError(`${where}: a closing brace outside a class`);
      }
      owner = null;
      return;
    }
    const member =
      /^\t(?:public |protected )?(?:abstract |bridge |final |native |open |static |synchronized |synthetic |transient |volatile )*(fun|field) (\S+) (\S+)$/.exec(
        line
      );
    if (!member || owner === null) {
      throw new ParityError(`${where}: not an apiCheck line: ${line.trim()}`);
    }
    keys.push(
      member[1] === 'fun'
        ? `${owner}#${member[2]} ${member[3]}`
        : `${owner}#${member[2]}`
    );
  });
  if (owner !== null) {
    throw new ParityError(`${FILES.android}: ${owner} is not closed`);
  }
  return keys;
}

/** The pin each dependency file declares for its platform. */
export function readPins(root) {
  const pins = {};
  for (const [platform, { file, pattern }] of Object.entries(PINS)) {
    const text = readText(root, file);
    const found = [...text.matchAll(pattern)].map((match) => match[1]);
    if (found.length !== 1) {
      throw new ParityError(
        `${file} must declare the SallaPush ${platform} dependency exactly once (found ${found.length})`
      );
    }
    pins[platform] = found[0];
  }
  return pins;
}

/** The five checks over the native files, the mapping, the API dump and the pins. */
export function checkParity(root = ROOT) {
  const problems = [];
  const native = {
    ios: iosKeys(readText(root, FILES.ios)),
    android: androidKeys(readText(root, FILES.android)),
  };
  const mapping = readMapping(root);
  const symbols = apiSymbols(
    readText(root, FILES.dump)
      .split('\n')
      .filter((line) => line !== '')
  );
  const pins = readPins(root);

  for (const platform of ['ios', 'android']) {
    const version = mapping.nativeVersions[platform];
    if (version !== pins[platform]) {
      problems.push(
        `nativeVersions.${platform} is ${version}, but ${PINS[platform].file} pins ${pins[platform]}`
      );
    }
  }

  const seenIds = new Set();
  for (const entry of mapping.entries) {
    if (seenIds.has(entry.id)) {
      problems.push(`${entry.id}: the id is used by more than one entry`);
    }
    seenIds.add(entry.id);
    problems.push(...entryProblems(entry, symbols));
  }

  for (const platform of ['ios', 'android']) {
    const known = new Set(native[platform]);
    const owners = new Map(native[platform].map((key) => [key, []]));
    for (const entry of mapping.entries) {
      for (const key of entry[platform]) {
        if (known.has(key)) {
          owners.get(key).push(entry.id);
        } else {
          problems.push(
            `${entry.id}: ${platform} symbol not in ${FILES[platform]}: ${key}`
          );
        }
      }
    }
    for (const [key, ids] of owners) {
      if (ids.length === 0) {
        problems.push(`unmapped ${platform} symbol: ${key}`);
      } else if (ids.length > 1) {
        problems.push(`${platform} symbol mapped by ${ids.join(', ')}: ${key}`);
      }
    }
  }

  const counts = Object.fromEntries(
    STATUSES.map((status) => [status, { entries: 0, ios: 0, android: 0 }])
  );
  for (const entry of mapping.entries) {
    const count = counts[entry.status];
    if (count) {
      count.entries += 1;
      count.ios += entry.ios.length;
      count.android += entry.android.length;
    }
  }
  return {
    problems,
    counts,
    native: { ios: native.ios.length, android: native.android.length },
  };
}

function entryProblems(entry, symbols) {
  const problems = [];
  const id = entry.id;
  if (!STATUSES.includes(entry.status)) {
    return [
      `${id}: status ${entry.status} is not one of ${STATUSES.join(', ')}`,
    ];
  }
  const { status, ios, android, ts } = entry;
  const wrapped = ['W', 'I', 'A'].includes(status);
  if (wrapped && ts.length === 0) {
    problems.push(
      `${id}: status ${status} needs at least one TypeScript symbol`
    );
  }
  if (!wrapped && ts.length > 0) {
    problems.push(
      `${id}: status ${status} is not wrapped, so it lists no TypeScript symbol`
    );
  }
  if (!wrapped && (entry.reason ?? '').trim() === '') {
    problems.push(`${id}: status ${status} needs a reason`);
  }
  if (wrapped && entry.reason !== null) {
    problems.push(`${id}: status ${status} takes no reason (null)`);
  }
  const needs = {
    W: [true, true],
    I: [true, false],
    A: [false, true],
  }[status];
  if (needs) {
    const [needsIos, needsAndroid] = needs;
    if (needsIos !== ios.length > 0) {
      problems.push(
        `${id}: status ${status} ${needsIos ? 'needs' : 'takes no'} iOS symbols`
      );
    }
    if (needsAndroid !== android.length > 0) {
      problems.push(
        `${id}: status ${status} ${needsAndroid ? 'needs' : 'takes no'} Android symbols`
      );
    }
  } else if (ios.length === 0 && android.length === 0) {
    problems.push(`${id}: status ${status} needs at least one native symbol`);
  }
  for (const symbol of ts) {
    if (!symbols.has(symbol)) {
      problems.push(`${id}: TypeScript symbol not in ${FILES.dump}: ${symbol}`);
    }
  }
  return problems;
}

function readMapping(root) {
  let mapping;
  try {
    mapping = JSON.parse(readText(root, FILES.mapping));
  } catch (error) {
    if (error instanceof ParityError) {
      throw error;
    }
    throw new ParityError(`${FILES.mapping}: ${error.message}`);
  }
  const fail = (message) => {
    throw new ParityError(`${FILES.mapping}: ${message}`);
  };
  if (!isObject(mapping) || !sameKeys(mapping, ['nativeVersions', 'entries'])) {
    fail('expected exactly the keys nativeVersions and entries');
  }
  const versions = mapping.nativeVersions;
  if (
    !isObject(versions) ||
    !sameKeys(versions, ['ios', 'android']) ||
    typeof versions.ios !== 'string' ||
    typeof versions.android !== 'string'
  ) {
    fail(
      'nativeVersions must be { "ios": "<version>", "android": "<version>" }'
    );
  }
  if (!Array.isArray(mapping.entries)) {
    fail('entries must be an array');
  }
  mapping.entries.forEach((entry, index) => {
    const where = `entry ${index + 1}${isObject(entry) && typeof entry.id === 'string' ? ` (${entry.id})` : ''}`;
    if (!isObject(entry) || !sameKeys(entry, ENTRY_FIELDS)) {
      fail(`${where} must have exactly the keys ${ENTRY_FIELDS.join(', ')}`);
    }
    if (typeof entry.id !== 'string' || entry.id === '') {
      fail(`${where}: id must be a non-empty string`);
    }
    for (const list of ['ios', 'android', 'ts']) {
      if (
        !Array.isArray(entry[list]) ||
        !entry[list].every((item) => typeof item === 'string')
      ) {
        fail(`${where}: ${list} must be an array of strings`);
      }
    }
    if (entry.reason !== null && typeof entry.reason !== 'string') {
      fail(`${where}: reason must be a string or null`);
    }
  });
  return mapping;
}

function readText(root, file) {
  try {
    return fs
      .readFileSync(path.join(root, file), 'utf8')
      .replace(/\r\n/g, '\n');
  } catch (error) {
    throw new ParityError(
      `${file}: ${error.code === 'ENOENT' ? 'missing' : error.message}`
    );
  }
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sameKeys(object, keys) {
  const actual = Object.keys(object).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

/** Runs the command line; returns the exit status. */
export function run({
  root = ROOT,
  out = process.stdout,
  err = process.stderr,
} = {}) {
  let result;
  try {
    result = checkParity(root);
  } catch (error) {
    if (!(error instanceof ParityError)) {
      throw error;
    }
    err.write(`check-api-parity: ${error.message}\n`);
    return 1;
  }
  for (const problem of result.problems) {
    err.write(`check-api-parity: ${problem}\n`);
  }
  for (const status of STATUSES) {
    const { entries, ios, android } = result.counts[status];
    out.write(
      `${status}: ${entries} entries, ${ios} iOS and ${android} Android symbols\n`
    );
  }
  if (result.problems.length > 0) {
    err.write(`check-api-parity: ${result.problems.length} problem(s)\n`);
    return 1;
  }
  out.write(
    `check-api-parity: every native symbol is mapped once (${result.native.ios} iOS, ${result.native.android} Android); 0 problems\n`
  );
  return 0;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.length > 2) {
    process.stderr.write('usage: node scripts/check-api-parity.mjs\n');
    process.exitCode = 2;
  } else {
    process.exitCode = run();
  }
}
