module.exports = {
  testEnvironment: 'jsdom',
  coverageDirectory: './coverage',
  collectCoverageFrom: [
    '../*.js',
    '!../**/node_modules/**',
    '!../**/test/**'
  ],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  moduleNameMapper: {
    '^firebase/(.*)$': '<rootDir>/__mocks__/firebase.js'
  },
  setupFilesAfterEnv: ['<rootDir>/setup.js']
};

