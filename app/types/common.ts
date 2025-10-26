export type NumDict = Record<string, number>;
export type StrDict = Record<string, string>;

export interface TimePoint {
  date: string;
}
export type FlatPoint = TimePoint & NumDict;

export type KeyOf<T> = Extract<keyof T, string>;
export type ValuesOf<T> = T[Extract<keyof T, string>];
