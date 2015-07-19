var passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy,
    BasicStrategy = require('passport-http').BasicStrategy,
    validator = require('validator'),
    bodyParser = require("body-parser"),
    path = require("path"),
    _ = require("underscore"),
    url = require("url"),
    request = require("request"),
    S = require("string"),
    serveStatic = require('serve-static');

module.exports = function (app, options, multitenancy) {
    logger = require("./logger.js")(options);

    /*app.use(function(req,res, next) {
        res.set('Connection', 'close');
        next();
    });*/
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(serveStatic(path.join(__dirname, '../', 'views')));
    app.engine('html', require('ejs').renderFile);

    app.get("/terms", function (req, res) {
        res.render("terms.html");
    });

    app.get("/api/ping", function (req, res, next) {
        res.send("pong");
    });

    passport.use(new LocalStrategy(function (username, password, done) {
        logger.debug("authenticating " + username + " " + password);
        multitenancy.multitenancyRepository.authenticate(username, password).then(function (tenant) {
            if (!tenant) {
                logger.debug("invalid credentials for " + username);
                return done(null, false, {message: "Invalid password or user does not exists."});
            }

            logger.debug("auth ok for " + username);
            return done(null, tenant);
        }).catch(function (e) {
            logger.error("error when searching for user " + username + " " + e.stack);
            done(e);
        });
    }));

    passport.use(new BasicStrategy(function (username, password, done) {
        logger.debug("authenticating " + username);
        multitenancy.multitenancyRepository.authenticate(username, password).then(function (user) {
            if (!user) {
                logger.debug("invalid credentials for" + username);
                return done(null, false, {message: "Invalid password or user does not exists."});
            }

            return multitenancy.activateTenant(user).then(function (tenant) {
                logger.debug("auth ok for " + username);
                return done(null, user);
            });
        }).catch(function (e) {
            logger.error("error when searching for user " + username + " " + e.stack);
            done(e);
        })
    }));

    passport.serializeUser(function (user, done) {
        done(null, user.email);
    });

    passport.deserializeUser(function (id, done) {
        multitenancy.multitenancyRepository.findTenant(id).then(function (tenant) {
            if (!tenant) {
                logger.debug("tenant not found for deserialization " + id);
                return done({
                    message: "Tenant not found.",
                    code: "TENANT_NOT_FOUND"
                });
            }

            done(null, tenant);
        }).catch(function (e) {
            logger.warn("error when searching for user " + username + " " + e.stack);
            return done(e);
        });
    });

    app.post('/login', bodyParser.urlencoded({extended: true, limit: "2mb"}), function (req, res, next) {
        req.session.viewModel = req.session.viewModel || {};

        passport.authenticate('local', function (err, user, info) {
            if (err) {
                return next(err);
            }

            logger.debug("login successfull " + user.email + " " + user.isAdmin + " " + user.name);

            if (!user) {
                req.session.viewModel.login = info.message;
                return res.redirect('/');
            }

            req.session.viewModel = {};
            req.logIn(user, function (err) {
                if (err) {
                    logger.error(err);
                    return next(err);
                }
                return res.redirect('/');
            });
        })(req, res, next);
    });

    app.post("/register", bodyParser.urlencoded({extended: true, limit: "2mb"}), function (req, res, next) {
        req.session.viewModel = req.session.viewModel || {};
        req.session.viewModel.previousName = req.body.name;
        req.session.viewModel.previousUsername = req.body.username;

        if (!req.body.terms) {
            req.session.viewModel.terms = "You must agree with terms and conditions to sign up.";
            return res.redirect('/');
        }

        var regex = /^[a-zA-Z0-9\-]+$/;
        if (!regex.test(req.body.name)) {
            req.session.viewModel.name = "Name must contain only numbers and letters and '-'.";
            return res.redirect('/');
        }

        if (multitenancy.multitenancyRepository.findTenantByName(req.body.name).then(function () {
                req.session.viewModel.name = "Tenant name is already taken.";
                return res.redirect('/');
            }).fail(function () {
                if (!validator.isEmail(req.body.username)) {
                    req.session.viewModel.username = "Not valid email.";
                    return res.redirect('/');
                }

                if (req.body.password == null || req.body.password.length < 4) {
                    req.session.viewModel.password = "Password must be at least 4 characters long.";
                    return res.redirect('/');
                }

                if (req.body.password != req.body.passwordConfirm) {
                    req.session.viewModel.passwordConfirm = "Passwords are not the same.";
                    return res.redirect('/');
                }

                multitenancy.multitenancyRepository.registerTenant(req.body.username, req.body.name, req.body.password).then(function (tenant) {
                    passport.authenticate('local', function (err, user, info) {
                        if (err) {
                            return next(err);
                        }

                        req.logIn(user, function (err) {
                            if (err) {
                                return next(err);
                            }
                            return res.redirect('/');
                        });
                    })(req, res);
                }, function (err) {
                    next(err);
                });
            }));
    });

    app.post("/logout", function (req, res) {
        req.logout();

        logger.debug("loging out");

        var domains = req.headers.host.split('.');

        res.redirect("https://" + domains[domains.length - 2] + "." + domains[domains.length - 1]);
    });

    //activate tenant
    app.use(function (req, res, next) {
        var domains = req.headers.host.split('.');

        var tenantName = req.user ? req.user.name : domains[0];
        multitenancy.multitenancyRepository.findTenantByName(tenantName).then(function (tenant) {
            if (!tenant)
                return next();

            return multitenancy.activateTenant(tenant).then(function (tenant) {
                req.tenant = tenant;
                next();
            });
        }).catch(function (e) {
            next();
        });
    });

    app.use(function(req, res, next) {
        if (!req.tenant)
            return next();

        var publicRoute = _.find(req.tenant.reporter.authentication.publicRoutes, function (r) {
            return S(req.url).startsWith(r);
        });

        var pathname = url.parse(req.url).pathname;

        req.isPublic = publicRoute || S(pathname).endsWith(".js") || S(pathname).endsWith(".css");
        next();
    });

    app.get("/", function (req, res, next) {
        if (!req.user && !req.isPublic) {
            var viewModel = _.extend({}, req.session.viewModel || {});
            req.session.viewModel = null;
            res.render(path.join(__dirname, '../', 'views', 'tenantRegistration.html'), {viewModel: viewModel});
        } else {
            next();
        }
    });

    app.get("/gumroad", function (req, res) {
        multitenancy.multitenancyRepository.findTenantByName(req.user.name).then(function (tenant) {
            res.render(path.join(__dirname, '../', 'views', 'gumroad.html'), {viewModel: tenant});
        });
    });

    //authenticate basic if request to API
    app.use(function (req, res, next) {
        if ((!req.isAuthenticated || !req.isAuthenticated()) &&
            (req.url.lastIndexOf("/api", 0) === 0 || req.url.lastIndexOf("/odata", 0) === 0)) {
            req.isBasicAuth = true;
            passport.authenticate('basic', function (err, user, info) {
                if (!user) {

                    if (req.isPublic) {
                        return next();
                    }

                    res.setHeader('WWW-Authenticate', 'Basic realm=\"realm\"');
                    return res.status(401).end();
                }

                req.logIn(user, function () {
                    next();
                });
            })(req, res, next);
        } else {
            next();
        }
    });

    app.use(function (req, res, next) {
        res.set('Connection', 'close');

        var domains = req.headers.host.split('.');

        if (!req.user && !req.isPublic) {
            if (options.subdomainsCount == domains.length + 1)
            //user not authenticated, redirect to login page
                return res.redirect("/");
            else {
                //user sending not authenticated request to subdomain, redirect to root login page
                domains.shift();
                return res.redirect("https://" + domains.join("."));
            }
        }	


        if (req.tenant && (options.subdomainsCount == domains.length)) {
            //route rendering request to worker if its a call from API and this is not a worker
            if (req.isBasicAuth && options.forwardToBackgroundWorker && req.url.lastIndexOf("/api/report", 0) === 0 && req.method === "POST") {
                req.pipe(request({
                    url: 'https://' + options.forwardToBackgroundWorker + '/api/report',
                    headers: {
                        host: req.tenant.name + "." + options.cookieSession.cookie.domain
                    },
                    strictSSL: false,
                    method: "POST"
                })).pipe(res);
                return;
            }

            return req.tenant.reporter.options.express.app(req, res, next);
        }

        if (req.tenant) {
            domains.unshift(req.tenant.name);
            return res.redirect("https://" + domains.join("."));
        }

        req.logout();
        res.redirect("https://" + domains[domains.length - 2] + "." + domains[domains.length - 1]);
    });

    //error handling
    app.use(function (err, req, res, next) {
        res.status(500);

        if (_.isString(err)) {
            err = {
                message: err
            };
        }

        err = err || {};
        err.message = err.message || "Unrecognized error";

        if (err.code == "TENANT_NOT_FOUND") {
            req.session = {};
            return res.redirect("/");
        }

        var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;

        logger.error("Error during processing request: " + fullUrl + " details: " + err.message + " " + err.stack);

        if (req.get('Content-Type') != "application/json") {
            res.write("Error occured - " + err.message + "\n");
            if (err.stack != null)
                res.write("Stack - " + err.stack);
            res.end();
            return;
        }

        res.json(err);
    });
};