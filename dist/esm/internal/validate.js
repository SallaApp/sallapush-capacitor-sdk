import { SallaPushAPNsEnvironment, SallaPushLogLevel } from '../definitions';
import { warnOnce } from './consoleOnce';
export const string = {
    test: (value) => typeof value === 'string',
    expected: 'a string',
};
export const boolean = {
    test: (value) => typeof value === 'boolean',
    expected: 'a boolean',
};
// Native takes a Java int: a fraction or a larger number would reach it as another notification's id.
export const integer = {
    test: (value) => typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= -2147483648 &&
        value <= 2147483647,
    expected: 'a 32-bit integer',
};
export const func = {
    test: (value) => typeof value === 'function',
    expected: 'a function',
};
export const record = { test: isRecord, expected: 'a plain object' };
export const array = { test: Array.isArray, expected: 'an array' };
export function oneOf(values) {
    return {
        test: (value) => typeof value === 'string' && values.includes(value),
        expected: `one of ${values.map((value) => `'${value}'`).join(', ')}`,
    };
}
export const logLevel = oneOf(Object.values(SallaPushLogLevel));
export const apnsEnvironment = oneOf(Object.values(SallaPushAPNsEnvironment));
/** The rule for an argument that may be null. */
export function nullable(rule) {
    return {
        test: (value) => value === null || rule.test(value),
        expected: `${rule.expected} or null`,
    };
}
/** The rule for an argument that may be left out: undefined and null pass. */
export function optional(rule) {
    return {
        test: (value) => value === undefined || value === null || rule.test(value),
        expected: rule.expected,
    };
}
export function isRecord(value) {
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
export function valid(method, args) {
    for (const [parameter, [value, rule]] of Object.entries(args)) {
        if (!rule.test(value)) {
            warnOnce(`${method}(${parameter})`, `${method} ignored: ${parameter} must be ${rule.expected}.`);
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=validate.js.map