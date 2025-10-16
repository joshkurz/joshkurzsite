const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

const customJestConfig = {
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.js'],
};

module.exports = createJestConfig(customJestConfig);
