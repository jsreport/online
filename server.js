var q = require('q');

require("jsreport").bootstrapper()
    .configure(function(config) {
        config.set("rootDirectory", __dirname)
    })
    .express(function(nconf, app) {
        app.use(require("connect-multiparty")());
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



