import { SallaPushAPNsEnvironment, SallaPushLogLevel } from '../definitions';
import { warnOnce } from './consoleOnce';

/** The check of one argument, and what the warning says it must be. */
export interface Rule {
  readonly test: (value: unknown) => boolean;
  readonly expected: string;
}

export const string: Rule = {
  test: (value) => typeof value === 'string',
  expected: 'a string',
};

export const boolean: Rule = {
  test: (value) => typeof value === 'boolean',
  expected: 'a boolean',
};

export const record: Rule = { test: isRecord, expected: 'a plain object' };

export function oneOf(values: readonly string[]): Rule {
  return {
    test: (value) => typeof value === 'string' && values.includes(value),
    expected: `one of ${values.map((value) => `'${value}'`).join(', ')}`,
  };
}

export const logLevel = oneOf(Object.values(SallaPushLogLevel));

export const apnsEnvironment = oneOf(Object.values(SallaPushAPNsEnvironment));

/** The rule for an argument that may be left out: undefined and null pass. */
export function optional(rule: Rule): Rule {
  return {
    test: (value) => value === undefined || value === null || rule.test(value),
    expected: rule.expected,
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Whether every argument passes its rule, in order. The bridges would crash or throw on a mistyped argument, so the
 * caller drops a call that fails, and the first failing parameter is reported once per runtime, as native reports
 * `api.invalid_argument`.
 */
export function valid(
  method: string,
  args: Record<string, readonly [value: unknown, rule: Rule]>
): boolean {
  for (const [parameter, [value, rule]] of Object.entries(args)) {
    if (!rule.test(value)) {
      warnOnce(
        `${method}(${parameter})`,
        `${method} ignored: ${parameter} must be ${rule.expected}.`
      );
      return false;
    }
  }
  return true;
}
