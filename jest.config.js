// Options for Jest

module.exports = {
    testEnvironment: "node",
    moduleFileExtensions: ["ts", "js"],
    transform: {
        "\\.(ts)$": "ts-jest"
    },
    testRegex: "tests.ts"
};
