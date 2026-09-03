module.exports = {
    // Scoped to the pure/injectable Piper logic only. Nothing here renders a React tree or touches the real
    // react-native package, so a plain node environment with the app's own babel config is all this needs - the full
    // WebdriverIO suite remains the E2E coverage for everything else.
    testEnvironment: 'node',
    testMatch: [ '<rootDir>/react/features/**/__tests__/**/*.test.ts' ],
    transform: {
        '^.+\\.tsx?$': 'babel-jest'
    }
};
