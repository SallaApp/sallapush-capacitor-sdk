#!/usr/bin/env node
// Keeps README.md and docs/*.md equal to code the checks build, and to the pinned versions.
//   node scripts/check-readme-snippets.mjs                              checks; exits 1 on drift
//   node scripts/check-readme-snippets.mjs --print <source>[#<region>]  prints a snippet source, or one region of it,
//                                                                       as the check compares it (scripts/verify.sh
//                                                                       consumer applies them to fresh apps)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { ParityError, readPins } from './check-api-parity.mjs';

// Code blocks in these languages must follow a marker.
export const CHECKED_LANGUAGES = new Set([
  'dart',
  'gradle',
  'groovy',
  'java',
  'javascript',
  'js',
  'json',
  'jsonc',
  'jsx',
  'kotlin',
  'kt',
  'kts',
  'obj-c',
  'objc',
  'objective-c',
  'objectivec',
  'rb',
  'ruby',
  'swift',
  'ts',
  'tsx',
  'typescript',
  'xml',
  'yaml',
  'yml',
]);
// Snippet sources: files that scripts/verify.sh builds, in the example app or in its consumer apps.
export const SOURCE_ROOTS = ['example-app/', 'docs/snippets/'];
const GENERATED = new Set(['node_modules', 'Pods', 'build', '.gradle']);
const VERSION = '\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z]+(?:\\.[0-9A-Za-z]+)*)?';
const MARKER = /^\s*<!--\s*(snippet|unchecked):(.*?)\s*-->\s*$/;
const FENCE = /^( {0,3})(`{3,}|~{3,})\s*([^\s`]*)/;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The Markdown files the check reads: README.md, and each .md file directly in docs/. */
export function markdownFiles(root) {
  const docs = path.join(root, 'docs');
  const inDocs = fs.existsSync(docs)
    ? fs
        .readdirSync(docs)
        .filter((name) => name.endsWith('.md'))
        .sort()
        .map((name) => `docs/${name}`)
    : [];
  return ['README.md', ...inDocs].filter((file) =>
    fs.existsSync(path.join(root, file))
  );
}

/** The fenced code blocks of a Markdown text: the opening and closing lines (1-based), the language and the content. */
export function codeBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const open = FENCE.exec(lines[index]);
    if (!open) {
      continue;
    }
    const [, indent, fence, language] = open;
    const close = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`);
    let end = index + 1;
    while (end < lines.length && !close.test(lines[end])) {
      end += 1;
    }
    blocks.push({
      line: index + 1,
      end: end + 1,
      language: language.toLowerCase(),
      content: lines
        .slice(index + 1, end)
        .map((line) => stripIndent(line, indent.length)),
    });
    index = end;
  }
  return blocks;
}

/** The lines of the region <name> of a source file: its parts between snippet:<name> and end-snippet, joined and dedented. */
export function region(text, name, file) {
  const comment = (body) =>
    new RegExp(`^\\s*(?://|#|<!--)\\s*${body}\\s*(?:-->)?\\s*$`);
  const start = comment('snippet:([\\w.-]+)');
  const finish = comment('end-snippet');
  const parts = [];
  let open = null;
  text.split('\n').forEach((line, index) => {
    const opening = start.exec(line);
    if (opening) {
      if (open) {
        throw new SnippetError(
          `${file}:${index + 1}: region ${opening[1]} starts inside region ${open.name}`
        );
      }
      open = { name: opening[1], lines: [] };
    } else if (finish.test(line)) {
      if (!open) {
        throw new SnippetError(
          `${file}:${index + 1}: end-snippet without a region`
        );
      }
      if (open.name === name) {
        parts.push(...open.lines);
      }
      open = null;
    } else if (open) {
      open.lines.push(line);
    }
  });
  if (open) {
    throw new SnippetError(`${file}: region ${open.name} has no end-snippet`);
  }
  if (parts.length === 0) {
    return null;
  }
  // The indentation every line shares, in spaces or tabs: Xcode indents plists with tabs.
  const indents = parts
    .filter((line) => line.trim() !== '')
    .map((line) => /^[ \t]*/.exec(line)[0]);
  if (indents.length === 0) {
    return parts.map(() => '');
  }
  const shared = indents.reduce((common, indent) => {
    let length = 0;
    while (length < common.length && common[length] === indent[length]) {
      length += 1;
    }
    return common.slice(0, length);
  });
  return parts.map((line) => line.slice(Math.min(shared.length, line.length)));
}

export class SnippetError extends Error {}

/** Every problem of README.md and docs/*.md: markers, snippet sources and versions. */
export function checkSnippets({
  root = ROOT,
  tracked = trackedFiles(root),
} = {}) {
  const problems = [];
  const counts = { blocks: 0, snippets: 0, unchecked: 0 };
  const pins = readPins(root);
  const version = JSON.parse(
    fs.readFileSync(path.join(root, 'package.json'), 'utf8')
  ).version;
  for (const file of markdownFiles(root)) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const lines = text.split('\n');
    const markedLines = new Set();
    const insideBlocks = new Set();
    for (const block of codeBlocks(text)) {
      counts.blocks += 1;
      for (let line = block.line; line <= block.end; line += 1) {
        insideBlocks.add(line);
      }
      const markers = precedingMarkers(lines, block.line - 1);
      markers.forEach((marker) => markedLines.add(marker.line));
      const where = `${file}:${block.line}`;
      if (markers.length > 1) {
        problems.push(
          `${where}: the block follows ${markers.length} markers; it takes exactly one`
        );
        continue;
      }
      const [marker] = markers;
      if (!marker) {
        if (CHECKED_LANGUAGES.has(block.language)) {
          problems.push(
            `${where}: the ${block.language} block has no <!-- snippet:<path>[#<name>] --> or <!-- unchecked: <reason> --> line before it`
          );
        }
        continue;
      }
      if (marker.kind === 'unchecked') {
        counts.unchecked += 1;
        if (marker.value === '') {
          problems.push(`${where}: <!-- unchecked: --> needs a reason`);
        }
        continue;
      }
      counts.snippets += 1;
      problems.push(
        ...snippetProblems(root, tracked, where, marker.value, block.content)
      );
    }
    lines.forEach((line, index) => {
      if (
        MARKER.test(line) &&
        !markedLines.has(index + 1) &&
        !insideBlocks.has(index + 1)
      ) {
        problems.push(
          `${file}:${index + 1}: the marker is not followed by a code block`
        );
      }
    });
    problems.push(...versionProblems(file, lines, pins, version));
  }
  return { problems, counts };
}

// The marker lines right before a block (blank lines between them allowed), nearest first.
function precedingMarkers(lines, fenceIndex) {
  const markers = [];
  for (let index = fenceIndex - 1; index >= 0; index -= 1) {
    if (lines[index].trim() === '') {
      continue;
    }
    const match = MARKER.exec(lines[index]);
    if (!match) {
      break;
    }
    markers.push({ line: index + 1, kind: match[1], value: match[2].trim() });
  }
  return markers;
}

/**
 * The lines a block that shows <source>[#<name>] must hold: the whole committed file, or its region <name>, dedented.
 * Throws a SnippetError for a source that isn't a committed file the checks build, or a region it lacks.
 */
export function snippetLines(root, value, tracked = trackedFiles(root)) {
  const [source, name] = value.split('#');
  if (
    path.posix.normalize(source) !== source ||
    source.startsWith('/') ||
    source.split('/').includes('..')
  ) {
    throw new SnippetError(
      `${source} is not a plain path from the repository's root`
    );
  }
  if (
    !SOURCE_ROOTS.some((prefix) => source.startsWith(prefix)) ||
    source.split('/').some((part) => GENERATED.has(part))
  ) {
    throw new SnippetError(
      `${source} is not a file the checks build; snippets come from ${SOURCE_ROOTS.join(' or ')}`
    );
  }
  if (!tracked.has(source)) {
    throw new SnippetError(`${source} is not a committed file`);
  }
  const text = fs.readFileSync(path.join(root, source), 'utf8');
  if (name === undefined) {
    return text.endsWith('\n')
      ? text.slice(0, -1).split('\n')
      : text.split('\n');
  }
  const lines = region(text, name, source);
  if (lines === null) {
    throw new SnippetError(`${source} has no region ${name}`);
  }
  return lines;
}

function snippetProblems(root, tracked, where, value, content) {
  let expected;
  try {
    expected = snippetLines(root, value, tracked);
  } catch (error) {
    if (error instanceof SnippetError) {
      return [`${where}: ${error.message}`];
    }
    throw error;
  }
  const length = Math.max(expected.length, content.length);
  for (let index = 0; index < length; index += 1) {
    if (expected[index] !== content[index]) {
      return [
        `${where}: the block differs from ${value} at its line ${index + 1}: ` +
          `the source has ${JSON.stringify(expected[index] ?? '(nothing)')}, ` +
          `the block ${JSON.stringify(content[index] ?? '(nothing)')}`,
      ];
    }
  }
  return [];
}

function versionProblems(file, lines, pins, version) {
  const problems = [];
  const mention = new RegExp(`SallaPush (iOS|Android) (${VERSION})`, 'g');
  lines.forEach((line, index) => {
    for (const match of line.matchAll(mention)) {
      const pin = match[1] === 'iOS' ? pins.ios : pins.android;
      if (match[2] !== pin) {
        problems.push(
          `${file}:${index + 1}: names SallaPush ${match[1]} ${match[2]}, but the pin is ${pin}`
        );
      }
    }
  });
  lines.forEach((line, index) => {
    const header = cells(line);
    if (
      header?.[0] !== 'Wrapper' ||
      header[1] !== 'SallaPush iOS' ||
      header[2] !== 'SallaPush Android'
    ) {
      return;
    }
    let rows = 0;
    for (
      let row = index + 2;
      row < lines.length && cells(lines[row]);
      row += 1
    ) {
      const [wrapper, ios, android] = cells(lines[row]);
      const where = `${file}:${row + 1}`;
      if (ios !== pins.ios || android !== pins.android) {
        problems.push(
          `${where}: the versions table says iOS ${ios} and Android ${android}; the pins are ${pins.ios} and ${pins.android}`
        );
      }
      if (/\bCapacitor\b/.test(wrapper)) {
        rows += 1;
        if (!wrapper.includes(version)) {
          problems.push(
            `${where}: the versions table names ${wrapper}; package.json is ${version}`
          );
        }
      }
    }
    if (rows === 0) {
      problems.push(
        `${file}:${index + 1}: the versions table has no Capacitor row`
      );
    }
  });
  return problems;
}

function cells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return null;
  }
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function stripIndent(line, width) {
  const indent = /^ */.exec(line)[0].length;
  return line.slice(Math.min(indent, width));
}

function trackedFiles(root) {
  let output;
  try {
    output = execFileSync('git', ['-C', root, 'ls-files', '-z'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new SnippetError(
      `cannot list the committed files of ${root} (git ls-files failed); run the check in a clone of the repository`
    );
  }
  return new Set(output.split('\0').filter((name) => name !== ''));
}

/** Prints a snippet source or one region of it, as the check compares it; returns the exit status. */
export function print(
  value,
  { root = ROOT, out = process.stdout, err = process.stderr } = {}
) {
  let lines;
  try {
    lines = snippetLines(root, value);
  } catch (error) {
    if (!(error instanceof SnippetError)) {
      throw error;
    }
    err.write(`check-readme-snippets: ${error.message}\n`);
    return 1;
  }
  out.write(`${lines.join('\n')}\n`);
  return 0;
}

/** Runs the command line; returns the exit status. */
export function run({
  root = ROOT,
  out = process.stdout,
  err = process.stderr,
} = {}) {
  let result;
  try {
    result = checkSnippets({ root });
  } catch (error) {
    if (!(error instanceof ParityError || error instanceof SnippetError)) {
      throw error;
    }
    err.write(`check-readme-snippets: ${error.message}\n`);
    return 1;
  }
  for (const problem of result.problems) {
    err.write(`check-readme-snippets: ${problem}\n`);
  }
  const { blocks, snippets, unchecked } = result.counts;
  if (result.problems.length > 0) {
    err.write(`check-readme-snippets: ${result.problems.length} problem(s)\n`);
    return 1;
  }
  out.write(
    `check-readme-snippets: ${blocks} code block(s), ${snippets} checked against their sources, ${unchecked} unchecked with a reason; every SallaPush version named is the pinned one\n`
  );
  return 0;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  if (args.length === 2 && args[0] === '--print') {
    process.exitCode = print(args[1]);
  } else if (args.length > 0) {
    process.stderr.write(
      'usage: node scripts/check-readme-snippets.mjs [--print <source>[#<region>]]\n'
    );
    process.exitCode = 2;
  } else {
    process.exitCode = run();
  }
}
