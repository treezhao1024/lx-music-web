export default {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js'],
  verbose: true,
  coveragePathIgnorePatterns: ['/node_modules/'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  testTimeout: 30000,
  transform: {},
  moduleFileExtensions: ['js'],
  testEnvironmentOptions: {
    globals: true
  }
}
