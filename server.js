var q = require('q'),
    path = require('path'),
    app = require("express")(),
    fs = require("fs"),
    https = require("https"),
    http = require("http"),
    cluster = require("cluster"),
    routes = require("./lib/routes.js"),
    clusterDomainMiddleware = require("./node_modules/jsreport/extension/express/lib/clusterDomainMiddleware.js"),
    Multitenancy = require("./lib/multitenancy.js");

var multitenancy;

if (cluster.isMaster) {
    cluster.fork();
    cluster.on('disconnect', function (worker) {
        cluster.fork();
    });

    return;
}

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
        pfx: config.certificate.pfx ? fs.readFileSync(config.certificate.pfx) : undefined,
        passphrase: config.certificate.passphrase,
        key: config.certificate.key ? fs.readFileSync(config.certificate.key, 'utf8') : undefined,
        cert: config.certificate.cert ? fs.readFileSync(config.certificate.cert, 'utf8') : undefined,
        rejectUnauthorized: false //support invalid certificates
    };

    if (config.certificate.ca) {
        credentials.ca = config.certificate.ca.map(function(c) {
            return fs.readFileSync(c, 'utf8');
        });
    }

    var server = https.createServer(credentials, function(req, res) { clusterDomainMiddleware(cluster, server, multitenancy.logger, req, res, app); }).on('error', function (e) {
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





