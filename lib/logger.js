var winston = require("winston"),
    loggly = require("winston-loggly")


module.exports = function (options, tenantName) {
    var transportSettings = {
        timestamp: true,
        colorize: true,
        level: "debug"
    };

    if (!winston.loggers.has(getLogName(tenantName))) {
        var transportSettings = {
            timestamp: true,
            colorize: true,
            level: "debug"
        };

        var consoleTransport = new (winston.transports.Console)(transportSettings);

        var logglyTransport = new (winston.transports.Loggly)({
            level: "debug",
            token: "281a478d-7430-4b0d-a4e8-52422808a0c2",
            subdomain: "jsreport",
            json: true });

        var logger = winston.loggers.add(getLogName(tenantName), {
            transports: [consoleTransport, logglyTransport]
        });

        var methods = ["info", "warn", "error", "debug"];
        methods.forEach(function (m) {
            var originalMethod = logger[m];
            logger[m] = function (message) {
                var meta = {
                    tenant: tenantName,
                    hostname: require("os").hostname()
                }
                originalMethod(message, meta);
            };
        });
    }

    return winston.loggers.get(getLogName(tenantName));
}

function getLogName(tenantName) {
    return tenantName ? ("jsreport-" + tenantName) : "jsreport";
}
