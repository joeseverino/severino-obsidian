export type Guard<T> = (value: unknown) => value is T;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isString: Guard<string> = (value): value is string => typeof value === 'string';
export const isNumber: Guard<number> = (value): value is number => typeof value === 'number';
export const isBoolean: Guard<boolean> = (value): value is boolean => typeof value === 'boolean';
export const isUnknown: Guard<unknown> = (_value): _value is unknown => true;

export const arrayOf =
  <T>(item: Guard<T>): Guard<T[]> =>
  (value): value is T[] =>
    Array.isArray(value) && value.every(item);

export const optional =
  <T>(inner: Guard<T>): Guard<T | undefined> =>
  (value): value is T | undefined =>
    value === undefined || inner(value);

type Spec = Readonly<Record<string, Guard<unknown>>>;
type GuardType<G> = G extends Guard<infer T> ? T : never;
type OptionalKeys<S extends Spec> = {
  [K in keyof S]: undefined extends GuardType<S[K]> ? K : never;
}[keyof S];

export type Infer<S extends Spec> = {
  [K in Exclude<keyof S, OptionalKeys<S>>]: GuardType<S[K]>;
} & {
  [K in OptionalKeys<S>]?: Exclude<GuardType<S[K]>, undefined>;
};

export const shape =
  <S extends Spec>(spec: S): Guard<Infer<S>> =>
  (value): value is Infer<S> =>
    isRecord(value) && Object.entries(spec).every(([key, guard]) => guard(value[key]));
