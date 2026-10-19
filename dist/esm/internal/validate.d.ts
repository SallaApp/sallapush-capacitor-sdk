/** The check of one argument, and what the warning says it must be. */
export interface Rule {
    readonly test: (value: unknown) => boolean;
    readonly expected: string;
}
export declare const string: Rule;
export declare const boolean: Rule;
export declare const integer: Rule;
export declare const func: Rule;
export declare const record: Rule;
export declare const array: Rule;
export declare function oneOf(values: readonly string[]): Rule;
export declare const logLevel: Rule;
export declare const apnsEnvironment: Rule;
/** The rule for an argument that may be null. */
export declare function nullable(rule: Rule): Rule;
/** The rule for an argument that may be left out: undefined and null pass. */
export declare function optional(rule: Rule): Rule;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
/**
 * Whether every argument passes its rule, in order. The bridges would crash or throw on a mistyped argument, so the
 * caller drops a call that fails, and the first failing parameter is reported once per runtime, as native reports
 * `api.invalid_argument`.
 */
export declare function valid(method: string, args: Record<string, readonly [value: unknown, rule: Rule]>): boolean;
