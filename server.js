//"connectionString": { "name": "mongoDB", "address": "localhost", "port": 27017, "databaseName" : "multitenant-root" },
//"connectionString": { "name": "mongoDB", "address": ["191.233.107.229", "191.233.107.229", "191.233.107.229"],  "port": [27017,64296, 55348], "replicaSet" : "rs", "databaseName" : "multitenant-root" },
var q = require('q'),
    path = require('path'),
    app = require("express")(),
    fs = require("fs"),
    https = require("https"),
    http = require("http"),
    routes = require("./lib/routes.js"),
    Multitenancy = require("./lib/multitenancy.js");

var multitenancy;

var startApp = function (app, config) {
    if (config.httpPort) {
        http.createServer(function (req, res) {
            if (req.url === '/api/warmup') {
                return multitenancy.warmup(req, res);
            }

            res.writeHead(302, {
                'Location': "https://" + (req.headers.host ? req.headers.host.split(':')[0] : config.cookieSession.cookie.domain) + ':' + config.httpsPort + req.url
            });
            res.end();
        }).listen(config.httpPort).on('error', function (e) {
            console.error("Error when starting http server on port " + config.httpPort + " " + e.stack);
        });
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

require("jsreport").bootstrapper({ rootDirectory: __dirname})
    .createReporter(function () {   /*we dont wont any reporter right now */
    })
    .start().then(function (bootstrapper) {
        var sessions = require("client-sessions");

        app.use(sessions({
            cookieName: 'session',
            cookie: bootstrapper.config.cookieSession.cookie,
            secret: bootstrapper.config.cookieSession.secret,
            duration: 1000 * 60 * 60 * 24 * 365 * 10 // forever
        }));

        multitenancy = Multitenancy(app, bootstrapper.config);

        routes(app, bootstrapper.config, multitenancy);

        startApp(app, bootstrapper.config);
    }).catch(function (e) {
        fs.writeFileSync("startup-error.txt", e.stack);
        console.log(e.stack);
    });





