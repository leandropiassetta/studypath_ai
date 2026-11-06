import { describe, expect, it } from 'vitest';
import { assertSafeTestDatabaseUrl } from '../helpers/test-db.js';

describe('assertSafeTestDatabaseUrl', () => {
  it('accepts local databases whose name ends with _test', () => {
    expect(() =>
      assertSafeTestDatabaseUrl('postgres://u:p@127.0.0.1:5432/studypath_test'),
    ).not.toThrow();
    expect(() => assertSafeTestDatabaseUrl('postgres://u:p@localhost/other_test')).not.toThrow();
  });

  it('refuses the development database, remote hosts and garbage', () => {
    expect(() => assertSafeTestDatabaseUrl('postgres://u:p@127.0.0.1:5432/studypath')).toThrow(
      /Refusing/,
    );
    expect(() => assertSafeTestDatabaseUrl('postgres://u:p@db.example.com/studypath_test')).toThrow(
      /Refusing/,
    );
    expect(() => assertSafeTestDatabaseUrl('postgres://u:p@127.0.0.1/test_data')).toThrow(
      /Refusing/,
    );
    expect(() => assertSafeTestDatabaseUrl('not a url')).toThrow(/valid URL/);
  });
});
