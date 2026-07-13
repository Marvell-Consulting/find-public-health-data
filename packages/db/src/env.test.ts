import { afterEach, describe, expect, it } from 'vitest';

import { parsePort, requireEnv } from './env.js';

describe('requireEnv', () => {
  const name = 'FPHD_TEST_ENV_VAR';

  afterEach(() => {
    delete process.env[name];
  });

  it('returns the value when set', () => {
    process.env[name] = 'a-secret';
    expect(requireEnv(name)).toBe('a-secret');
  });

  it('throws when the variable is unset', () => {
    expect(() => requireEnv(name)).toThrow(`${name} is not set (see .env.example).`);
  });

  it('throws when the variable is blank', () => {
    process.env[name] = '';
    expect(() => requireEnv(name)).toThrow(`${name} is not set (see .env.example).`);
  });
});

describe('parsePort', () => {
  it('returns the fallback when the variable is unset', () => {
    expect(parsePort(undefined, 5432)).toBe(5432);
  });

  it('returns the fallback when the variable is blank', () => {
    expect(parsePort('', 5432)).toBe(5432);
    expect(parsePort('   ', 5432)).toBe(5432);
  });

  it('parses a valid port', () => {
    expect(parsePort('5433', 5432)).toBe(5433);
    expect(parsePort('1', 5432)).toBe(1);
    expect(parsePort('65535', 5432)).toBe(65_535);
  });

  it('rejects non-numeric values rather than passing NaN to the driver', () => {
    expect(() => parsePort('abc', 5432)).toThrow(/between 1 and 65535/);
  });

  it('rejects out-of-range and non-integer ports', () => {
    expect(() => parsePort('0', 5432)).toThrow(/between 1 and 65535/);
    expect(() => parsePort('-1', 5432)).toThrow(/between 1 and 65535/);
    expect(() => parsePort('65536', 5432)).toThrow(/between 1 and 65535/);
    expect(() => parsePort('5432.5', 5432)).toThrow(/between 1 and 65535/);
  });
});
