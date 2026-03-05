import { z } from 'zod';

const INTEGER_PATTERN = /^[-+]?\d+$/;
const FLOAT_PATTERN = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/;

const addInvalidValueIssue = (
  context: z.RefinementCtx,
  envKey: string,
  reason: string,
  value: string,
): typeof z.NEVER => {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: `${envKey} ${reason}`,
    params: {
      envKey,
      valueType: typeof value,
    },
  });

  return z.NEVER;
};

interface IntegerParserOptions {
  min?: number;
  max?: number;
}

const normalizeNumericInput = (value: string): string => {
  return value.trim();
};

export const parseIntegerEnv = (envKey: string, defaultValue: number, options?: IntegerParserOptions) => {
  return z
    .string()
    .default(String(defaultValue))
    .transform((rawValue, context) => {
      const normalizedValue = normalizeNumericInput(rawValue);

      if (!INTEGER_PATTERN.test(normalizedValue)) {
        return addInvalidValueIssue(context, envKey, 'must be an integer', rawValue);
      }

      const parsedValue = Number.parseInt(normalizedValue, 10);
      if (!Number.isSafeInteger(parsedValue)) {
        return addInvalidValueIssue(context, envKey, 'must be a safe integer', rawValue);
      }

      if (typeof options?.min === 'number' && parsedValue < options.min) {
        return addInvalidValueIssue(context, envKey, `must be >= ${options.min}`, rawValue);
      }

      if (typeof options?.max === 'number' && parsedValue > options.max) {
        return addInvalidValueIssue(context, envKey, `must be <= ${options.max}`, rawValue);
      }

      return parsedValue;
    });
};

export const parseFloatEnv = (envKey: string, defaultValue: number) => {
  return z
    .string()
    .default(String(defaultValue))
    .transform((rawValue, context) => {
      const normalizedValue = normalizeNumericInput(rawValue);

      if (!FLOAT_PATTERN.test(normalizedValue)) {
        return addInvalidValueIssue(context, envKey, 'must be a finite number', rawValue);
      }

      const parsedValue = Number(normalizedValue);
      if (!Number.isFinite(parsedValue)) {
        return addInvalidValueIssue(context, envKey, 'must be a finite number', rawValue);
      }

      return parsedValue;
    });
};

export const parseBooleanEnv = (defaultValue: boolean) => {
  return z
    .enum(['true', 'false'])
    .default(defaultValue ? 'true' : 'false')
    .transform((value) => value === 'true');
};
