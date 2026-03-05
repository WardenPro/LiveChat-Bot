export type RequestFieldSource = Record<string, unknown> | null | undefined;

export type RequestFieldParser<TOutput> = (value: unknown) => TOutput;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object';
};

const toRequestFieldSource = (value: unknown): RequestFieldSource => {
  return isRecord(value) ? value : undefined;
};

const getFieldValue = (source: RequestFieldSource, fieldName: string): unknown => {
  if (!source) {
    return undefined;
  }

  return source[fieldName];
};

export const parseRequestField = <TOutput>(
  source: unknown,
  fieldName: string,
  parser: RequestFieldParser<TOutput>,
): TOutput => {
  const value = getFieldValue(toRequestFieldSource(source), fieldName);
  return parser(value);
};

export const parseBodyField = <TOutput>(
  body: unknown,
  fieldName: string,
  parser: RequestFieldParser<TOutput>,
): TOutput => {
  return parseRequestField(body, fieldName, parser);
};

export const parseParamField = <TOutput>(
  params: unknown,
  fieldName: string,
  parser: RequestFieldParser<TOutput>,
): TOutput => {
  return parseRequestField(params, fieldName, parser);
};

export const parseQueryField = <TOutput>(
  query: unknown,
  fieldName: string,
  parser: RequestFieldParser<TOutput>,
): TOutput => {
  return parseRequestField(query, fieldName, parser);
};

export const parseNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const parseNonEmptyStringOrUndefined = (value: unknown): string | undefined => {
  return parseNonEmptyString(value) || undefined;
};

export const parseBodyNonEmptyString = (body: unknown, fieldName: string): string | null => {
  return parseBodyField(body, fieldName, parseNonEmptyString);
};

export const parseParamNonEmptyString = (params: unknown, fieldName: string): string | null => {
  return parseParamField(params, fieldName, parseNonEmptyString);
};

export const parseQueryNonEmptyString = (query: unknown, fieldName: string): string | null => {
  return parseQueryField(query, fieldName, parseNonEmptyString);
};

export const parseBooleanFlag = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
  }

  return false;
};

export const parseOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }

  return undefined;
};

export const parseOptionalInt = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value);
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const parseOptionalDurationSec = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.ceil(value);
};
