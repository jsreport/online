/*! 
 * Copyright(c) 2014 Jan Blaha 
 *
 * expressjs server wrapping Reporter.
 */

var path = require("path"),
    express = require('express'),
    _ = require("underscore"),
    http = require('http'),
    https = require('https'),
    join = require("path").join,
    fs = require("fs"),
    Q = require("q"),
    Reporter = require("jsreport").Reporter;


/**
 * Create reporting server based on configuration
 * @param {object} config see config.json
 */

var ReportingServer = function (config) {
    this.config = config;
    Q.longStackSupport = true;
};

ReportingServer.prototype._initReporter = function (app, cb) {
    this.config.express = { app: app };
    require("./multitenancy.js")(app, this.config, cb);
};

ReportingServer.prototype.start = function () {
    if (!fs.existsSync(path.join(this.config.rootDirectory, "data"))) {
        fs.mkdir(path.join(this.config.rootDirectory, "data"));
    }

    var app = express();

    app.use(require("body-parser")({
        limit: 2 * 1024 * 1024 * 1//2MB
    }));

    app.use(require("method-override")());
    app.use(require("connect-multiparty")());
    var sessions = require("client-sessions");
    app.use(sessions({
        cookieName: 'session',
        cookie: this.config.cookieSession.cookie,
        secret: this.config.cookieSession.secret,
        duration: 1000 * 60 * 60 * 24 * 365 * 10 // forever
    }));

    var self = this;
    this._initReporter(app, function () {

        if (self.config.iisnode) {
            app.listen(self.config.port || process.env.PORT);
            return;
        }

        var credentials = {
            key: fs.readFileSync(join(self.config.rootDirectory, self.config.certificate.key), 'utf8'),
            cert: fs.readFileSync(join(self.config.rootDirectory, self.config.certificate.cert), 'utf8'),
            rejectUnauthorized: false //support invalid certificates
        };

        https.createServer(credentials, app).listen(self.config.port);
    });
};

module.exports = ReportingServer;
