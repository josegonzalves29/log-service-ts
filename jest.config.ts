import type {Config} from 'jest';

const config: Config = {
  preset: 'ts-jest',
  
  testEnvironment: 'node',
  
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'lambda/**/*.ts',
    '!lambda/**/*.d.ts',
    '!lambda/**/types.ts'
  ],
  
  clearMocks: true,
};

export default config;