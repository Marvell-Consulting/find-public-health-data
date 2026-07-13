import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { boolSchema, logEnvFields, parseEnv, portSchema } from './env.js';

describe('portSchema', () => {
  it('parses a valid port from env text', () => {
    expect(portSchema.parse('5433')).toBe(5433);
    expect(portSchema.parse('1')).toBe(1);
    expect(portSchema.parse('65535')).toBe(65_535);
  });

  it('rejects non-numeric values rather than passing NaN to a driver', () => {
    expect(() => portSchema.parse('abc')).toThrow();
  });

  it('rejects out-of-range and non-integer ports', () => {
    expect(() => portSchema.parse('0')).toThrow();
    expect(() => portSchema.parse('-1')).toThrow();
    expect(() => portSchema.parse('65536')).toThrow();
    expect(() => portSchema.parse('5432.5')).toThrow();
  });
});

describe('boolSchema', () => {
  it("parses 'true' and '1' as true", () => {
    expect(boolSchema.parse('true')).toBe(true);
    expect(boolSchema.parse('1')).toBe(true);
  });

  it("parses 'false' and '0' as false", () => {
    expect(boolSchema.parse('false')).toBe(false);
    expect(boolSchema.parse('0')).toBe(false);
  });

  it('rejects anything else instead of coercing it to true', () => {
    expect(() => boolSchema.parse('yes')).toThrow();
    expect(() => boolSchema.parse('TRUE')).toThrow();
    expect(() => boolSchema.parse('2')).toThrow();
  });
});

describe('logEnvFields', () => {
  const schema = z.object(logEnvFields);

  it('defaults to info level without pretty printing', () => {
    expect(schema.parse({})).toEqual({ LOG_LEVEL: 'info', LOG_PRETTY: false });
  });

  it('accepts pino level names and boolean text', () => {
    expect(schema.parse({ LOG_LEVEL: 'debug', LOG_PRETTY: '1' })).toEqual({
      LOG_LEVEL: 'debug',
      LOG_PRETTY: true,
    });
  });

  it('rejects unknown level names', () => {
    expect(() => schema.parse({ LOG_LEVEL: 'verbose' })).toThrow();
  });
});

describe('parseEnv', () => {
  const schema = z.object({
    PORT: portSchema.default(4000),
    SECRET: z.string().min(1),
  });

  it('returns the typed, defaulted result', () => {
    expect(parseEnv(schema, { PORT: '4100', SECRET: 's3cret' })).toEqual({
      PORT: 4100,
      SECRET: 's3cret',
    });
    expect(parseEnv(schema, { SECRET: 's3cret' })).toEqual({ PORT: 4000, SECRET: 's3cret' });
  });

  it('treats blank values as unset so defaults still apply', () => {
    expect(parseEnv(schema, { PORT: '', SECRET: 's3cret' })).toEqual({
      PORT: 4000,
      SECRET: 's3cret',
    });
    expect(parseEnv(schema, { PORT: '   ', SECRET: 's3cret' })).toEqual({
      PORT: 4000,
      SECRET: 's3cret',
    });
  });

  it('names the missing variable and points at .env.example', () => {
    expect(() => parseEnv(schema, {})).toThrow(/SECRET/);
    expect(() => parseEnv(schema, {})).toThrow(/\.env\.example/);
  });

  it('reports every problem in one error', () => {
    expect(() => parseEnv(schema, { PORT: 'abc' })).toThrow(/PORT[\s\S]*SECRET/);
  });

  it('ignores env vars the schema does not mention', () => {
    expect(parseEnv(schema, { SECRET: 's3cret', UNRELATED: 'x' })).toEqual({
      PORT: 4000,
      SECRET: 's3cret',
    });
  });
});
