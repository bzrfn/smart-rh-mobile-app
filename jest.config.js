module.exports = {
  preset: "jest-expo",
  testMatch: ["**/src/tests/**/*.test.(ts|tsx|js)"],
  setupFilesAfterEnv: ["<rootDir>/src/tests/setup.ts"],
};
