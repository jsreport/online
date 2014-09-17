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

        var transports = [new (winston.transports.Console)(transportSettings)];

        if (options.loggly) {
            transports.push(new winston.transports.Loggly({
                level: options.loggly.level,
                token: options.loggly.token,
                subdomain: options.loggly.subdomain,
                json: true }));
        }

        var logger = winston.loggers.add(getLogName(tenantName), {
            transports: transports
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
