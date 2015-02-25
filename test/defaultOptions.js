var path = require("path"),
    logger = require("../lib/logger.js");

module.exports = function() {
    return {
        connectionString: { name: "mongoDB", databaseName: "multitenant-root", address: "127.0.0.1", port: 27017 },
        extensions: ["templates", "express", "phantom-pdf", "html", "authentication"],
            useSubDomains: true,
        subdomainsCount: 3,
        logger: logger({}),
        rootDirectory: path.join(__dirname, "../"),
        NODE_ENV: 'development',
        tempDirectory: require("os").tmpdir(),
        phantom: {
            numberOfWorkers: 1
        },
        "tasks": {
            "numberOfWorkers" : 1
        }
    };
}

