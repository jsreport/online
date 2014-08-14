var q = require('q'),
    path = require('path');

var options = {
    rootDirectory : require("path").join(__dirname),
    pathToExampleConfig: path.join(__dirname, "example.config.json")
};

require("jsreport").bootstrapper(options)
    .express(function(nconf, app) {
        var sessions = require("client-sessions");
        app.use(sessions({
            cookieName: 'session',
            cookie: nconf.get("cookieSession:cookie"),
            secret: nconf.get("cookieSession:secret"),
            duration: 1000 * 60 * 60 * 24 * 365 * 10 // forever
        }));
    })
    .initialize(function() {
        return q.nfcall(require("./lib/multitenancy.js"), this.config.app, this.config);
    })
    .start();



