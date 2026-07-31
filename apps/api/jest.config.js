/**
 * Minimal ts-jest setup. `jest --passWithNoTests` was previously green purely
 * because nothing was ever collected — there was no config and no spec files,
 * so CI's "Test" step passed vacuously.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  // Source is CommonJS but written with ESM-style '.js' specifiers so the
  // compiled output resolves; strip the extension for ts-jest.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
};
