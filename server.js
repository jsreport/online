var q = require('q'),
    path = require('path'),
    app = require("express")(),
    bodyParser = require("body-parser"),
    fs = require("fs"),
    https = require("https");


var startApp = function (app, config) {
    if (!config.httpsPort) {
        return app.listen(process.env.PORT);
    }

    var credentials = {
        key: fs.readFileSync(config.certificate.key, 'utf8'),
        cert: fs.readFileSync(config.certificate.cert, 'utf8'),
        rejectUnauthorized: false //support invalid certificates
    };

    var server = https.createServer(credentials, app).on('error', function (e) {
        console.error("Error when starting https server on port " + config.httpsPort + " " + e.stack);
    }).listen(config.httpsPort);
};

require("jsreport").bootstrapper({
    rootDirectory: __dirname
}).createReporter(function () {
    //we dont wont any reporter right now
}).start().then(function (bootstrapper) {
    var sessions = require("client-sessions");
    app.use(sessions({
        cookieName: 'session',
        cookie: bootstrapper.config.cookieSession.cookie,
        secret: bootstrapper.config.cookieSession.secret,
        duration: 1000 * 60 * 60 * 24 * 365 * 10 // forever
    }));

    app.use(bodyParser.urlencoded({ extended: true, limit: "2mb"}));
    app.use(bodyParser.json({
        limit: "2mb"
    }));

    return q.nfcall(require("./lib/multitenancy.js"), app, bootstrapper.config).then(function () {
        return startApp(app, bootstrapper.config);
    });
}).catch(function (e) {
    console.log(e);
});



