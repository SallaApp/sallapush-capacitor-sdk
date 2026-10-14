#!/usr/bin/env node
// The public API of src/index.ts as committed in api/sallapush-capacitor.api: one sorted line per declaration and member.
//   node scripts/dump-api.mjs [--check | --write]
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const DUMP_FILE = 'api/sallapush-capacitor.api';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OBJECT_LITERAL = '{ ... }';
const printer = ts.createPrinter({ removeComments: true });

export class ApiDumpError extends Error {}

/** The dump's lines for the module `entry` exports, read with the compiler options of `tsconfig`. */
export function dumpApi({
  root = ROOT,
  entry = 'src/index.ts',
  tsconfig = 'tsconfig.json',
} = {}) {
  const entryPath = path.join(root, entry);
  const config = ts.readConfigFile(path.join(root, tsconfig), ts.sys.readFile);
  if (config.error) {
    throw new ApiDumpError(diagnosticText(config.error));
  }
  const { options } = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    root
  );
  const program = ts.createProgram({
    rootNames: [entryPath],
    options: { ...options, noEmit: true },
  });
  const source = program.getSourceFile(entryPath);
  if (!source) {
    throw new ApiDumpError(`${entry} does not exist`);
  }
  const checker = program.getTypeChecker();
  for (const file of program.getSourceFiles()) {
    const [problem] =
      file.isDeclarationFile || isLibrary(file)
        ? []
        : program.getSyntacticDiagnostics(file);
    if (problem) {
      throw new ApiDumpError(
        `${path.relative(root, file.fileName)}: ${diagnosticText(problem)}`
      );
    }
  }
  const module = checker.getSymbolAtLocation(source);
  if (!module) {
    throw new ApiDumpError(`${entry} exports nothing`);
  }
  const dump = new Dump(checker);
  for (const exported of checker.getExportsOfModule(module)) {
    const symbol = isReExport(exported)
      ? checker.getAliasedSymbol(exported)
      : exported;
    for (const declaration of symbol.declarations ?? []) {
      dump.declaration(exported.name, declaration);
    }
  }
  return [...dump.lines].sort(compareLines);
}

/** The symbols the dump's lines name: each declaration and member path, and `path('event')` for an event overload. */
export function apiSymbols(lines) {
  const symbols = new Set();
  for (const line of lines) {
    const declaration = /^(?:const|function|interface|type) ([\w$]+)/.exec(
      line
    );
    if (declaration) {
      symbols.add(declaration[1]);
      continue;
    }
    const member = /^([\w$]+(?:\.[\w$]+)*)(\(\w+\??: '([^']*)'[,)])?/.exec(
      line
    );
    if (member) {
      symbols.add(member[1]);
      if (member[2]) {
        symbols.add(`${member[1]}('${member[3]}')`);
      }
    }
  }
  return symbols;
}

class Dump {
  constructor(checker) {
    this.checker = checker;
    this.lines = new Set();
  }

  declaration(name, node) {
    if (ts.isVariableDeclaration(node)) {
      this.variable(name, node);
    } else if (ts.isInterfaceDeclaration(node)) {
      this.lines.add(
        `interface ${name}${typeParameters(node)}${heritage(node)}`
      );
      this.members(node.members, `${name}.`, null);
    } else if (ts.isTypeAliasDeclaration(node)) {
      if (ts.isTypeLiteralNode(node.type)) {
        this.lines.add(
          `type ${name}${typeParameters(node)} = ${OBJECT_LITERAL}`
        );
        this.members(node.type.members, `${name}.`, null);
      } else {
        this.lines.add(
          `type ${name}${typeParameters(node)} = ${print(node.type)}`
        );
      }
    } else if (ts.isFunctionDeclaration(node)) {
      this.lines.add(`function ${name}${signature(node)}`);
    } else {
      throw new ApiDumpError(
        `${name}: the dump does not support an exported ${ts.SyntaxKind[node.kind]}; extend scripts/dump-api.mjs`
      );
    }
  }

  variable(name, node) {
    this.lines.add(`const ${name}`);
    if (node.type && ts.isTypeLiteralNode(node.type)) {
      this.members(node.type.members, `${name}.`, new Set());
    } else if (node.type) {
      this.lines.add(`${name}: ${print(node.type)}`);
    } else if (
      node.initializer &&
      ts.isAsExpression(node.initializer) &&
      ts.isConstTypeReference(node.initializer.type) &&
      ts.isObjectLiteralExpression(node.initializer.expression)
    ) {
      for (const property of node.initializer.expression.properties) {
        if (!ts.isPropertyAssignment(property)) {
          throw new ApiDumpError(
            `${name}: the dump supports only plain properties in an 'as const' object; extend scripts/dump-api.mjs`
          );
        }
        this.lines.add(
          `${name}.${propertyName(property.name)}: ${print(property.initializer)} [readonly]`
        );
      }
    } else {
      throw new ApiDumpError(
        `${name}: declare the exported const's type, or make it an 'as const' object, so the dump shows it as declared`
      );
    }
  }

  // expand: inside a const, the interfaces on this path, whose members are listed under the property; else null.
  members(members, prefix, expand) {
    for (const member of members) {
      if (ts.isMethodSignature(member)) {
        this.lines.add(
          `${prefix}${propertyName(member.name)}${optional(member)}${signature(member)}`
        );
      } else if (ts.isPropertySignature(member)) {
        this.property(member, prefix, expand);
      } else {
        throw new ApiDumpError(
          `${prefix}: the dump does not support a ${ts.SyntaxKind[member.kind]} member; extend scripts/dump-api.mjs`
        );
      }
    }
  }

  property(member, prefix, expand) {
    const name = `${prefix}${propertyName(member.name)}`;
    const readonly = member.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword
    )
      ? ' [readonly]'
      : '';
    if (!member.type) {
      throw new ApiDumpError(`${name} has no declared type`);
    }
    if (ts.isTypeLiteralNode(member.type)) {
      this.lines.add(
        `${name}${optional(member)}: ${OBJECT_LITERAL}${readonly}`
      );
      this.members(member.type.members, `${name}.`, expand);
      return;
    }
    this.lines.add(
      `${name}${optional(member)}: ${print(member.type)}${readonly}`
    );
    const target = expand && this.projectInterface(member.type);
    if (target && !expand.has(target)) {
      this.members(target.members, `${name}.`, new Set([...expand, target]));
    }
  }

  // The interface a type reference names, when it is declared once in this project (not in a library).
  projectInterface(typeNode) {
    if (!ts.isTypeReferenceNode(typeNode)) {
      return null;
    }
    const symbol = this.checker.getTypeFromTypeNode(typeNode).getSymbol();
    const declarations = symbol?.declarations ?? [];
    if (
      declarations.length !== 1 ||
      !ts.isInterfaceDeclaration(declarations[0])
    ) {
      return null;
    }
    const file = declarations[0].getSourceFile();
    return file.isDeclarationFile || isLibrary(file) ? null : declarations[0];
  }
}

function isReExport(symbol) {
  return (symbol.declarations ?? []).some(
    (declaration) =>
      ts.isExportSpecifier(declaration) ||
      ts.isNamespaceExport(declaration) ||
      ts.isExportAssignment(declaration)
  );
}

function isLibrary(file) {
  return file.fileName.split('/').includes('node_modules');
}

function signature(node) {
  const parameters = node.parameters.map(print).join(', ');
  return `${typeParameters(node)}(${parameters})${node.type ? `: ${print(node.type)}` : ''}`;
}

function optional(member) {
  return member.questionToken ? '?' : '';
}

function propertyName(name) {
  return ts.isIdentifier(name) || ts.isPrivateIdentifier(name)
    ? name.text
    : print(name);
}

function typeParameters(node) {
  const parameters = node.typeParameters ?? [];
  return parameters.length === 0 ? '' : `<${parameters.map(print).join(', ')}>`;
}

function heritage(node) {
  return (node.heritageClauses ?? [])
    .map(
      (clause) =>
        ` ${ts.tokenToString(clause.token)} ${clause.types.map(print).join(', ')}`
    )
    .join('');
}

function print(node) {
  return printer
    .printNode(ts.EmitHint.Unspecified, node, node.getSourceFile())
    .replace(/\s+/g, ' ')
    .trim();
}

function diagnosticText(diagnostic) {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
}

function symbolOf(line) {
  return (
    /^(?:(?:const|function|interface|type) )?([\w$.]+)/.exec(line)?.[1] ?? line
  );
}

function compareLines(a, b) {
  const [symbolA, symbolB] = [symbolOf(a), symbolOf(b)];
  if (symbolA !== symbolB) {
    return symbolA < symbolB ? -1 : 1;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Runs the command line; returns the exit status. */
export function run(
  args,
  { root = ROOT, out = process.stdout, err = process.stderr } = {}
) {
  const mode =
    args.length === 0 ? 'print' : args.length === 1 ? args[0] : 'usage';
  if (!['print', '--check', '--write'].includes(mode)) {
    err.write('usage: node scripts/dump-api.mjs [--check | --write]\n');
    return 2;
  }
  let lines;
  try {
    lines = dumpApi({ root });
  } catch (error) {
    if (!(error instanceof ApiDumpError)) {
      throw error;
    }
    err.write(`dump-api: ${error.message}\n`);
    return 1;
  }
  const text = `${lines.join('\n')}\n`;
  const file = path.join(root, DUMP_FILE);
  if (mode === 'print') {
    out.write(text);
    return 0;
  }
  if (mode === '--write') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    out.write(`dump-api: wrote ${DUMP_FILE} (${lines.length} lines)\n`);
    return 0;
  }
  if (!fs.existsSync(file)) {
    err.write(
      `dump-api: ${DUMP_FILE} is missing; run node scripts/dump-api.mjs --write\n`
    );
    return 1;
  }
  const committed = fs.readFileSync(file, 'utf8');
  if (committed === text) {
    out.write(`dump-api: ${DUMP_FILE} is current (${lines.length} lines)\n`);
    return 0;
  }
  const before = committed.split('\n').filter((line) => line !== '');
  const removed = before.filter((line) => !lines.includes(line));
  const added = lines.filter((line) => !before.includes(line));
  err.write(`dump-api: the public API differs from ${DUMP_FILE}:\n`);
  for (const line of removed) {
    err.write(`- ${line}\n`);
  }
  for (const line of added) {
    err.write(`+ ${line}\n`);
  }
  if (removed.length === 0 && added.length === 0) {
    err.write('  (the same lines, in another order or repeated)\n');
  }
  err.write(
    'Review the change, then run node scripts/dump-api.mjs --write and map new symbols in tool/api-parity/mapping.json\n'
  );
  return 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = run(process.argv.slice(2));
}
