var fs = require("fs"),
    request = require('supertest'),
    Multitenancy = require('../lib/multitenancy.js'),
    logger = require('../lib/logger.js'),
    routes = require('../lib/routes.js'),
    express = require("express"),
    path = require("path"),
    extend = require("node.extend"),
    should = require("should"),
    baseTest = require("./baseTest"),
    serveStatic = require('serve-static');

baseTest(function (multitenancy) {

    var app;
    describe('multitenancy with testing account', function () {
        this.timeout(30000);

        var registrationResponse;

        beforeEach(function (done) {
            app = express();
            app.use(require("body-parser")());
            app.use(require("method-override")());
            var sessions = require("client-sessions");
            app.use(sessions({
                cookieName: 'session',
                cookie: { domain: "local.net"},
                secret: "foo",
                duration: 1000 * 60 * 60 * 24 * 365 * 10 // forever
            }));
            app.use(serveStatic(path.join(__dirname, 'views')));
            app.engine('html', require('ejs').renderFile);

            routes(app, multitenancy.options, multitenancy);

            request(app).post('/register')
                .type('form')
                .send({ username: "test@test.cz", name: "joj", password: "password", passwordConfirm: "password", terms: true })
                .end(function (err, res) {
                    registrationResponse = res;
                    done();
                });
        });

        describe('with subdomain', function () {
            beforeEach(function () {
                multitenancy.options.useSubDomains = true;
            });

            it('should redirect to subdomain after registration', function (done) {
                request(app).get(registrationResponse.header.location)
                    .set("cookie", registrationResponse.headers['set-cookie'])
                    .end(function (err, res) {
                        res.text.should.containEql("joj.");
                        done();
                    });
            });

            it('GET /  should work', function (done) {
                request(app).get('/').expect(200, done);
            });

            it('POST /login with invalid password should redirect to login', function (done) {
                request(app).post('/login')
                    .type('form')
                    .send({ username: "xxxx@test.cz" })
                    .end(function (err, res) {
                        if (err) return done(err);
                        request(app).get(res.header.location)
                            .set("cookie", res.headers['set-cookie'])
                            .end(function (err, res) {
                                res.text.should.containEql("jsreport$login");
                                done();
                            });
                    });

            });

            it('POST /login with valid password should redirect to subdomain', function (done) {
                request(app).post("/login")
                    .type('form')
                    .send({ username: "test@test.cz", password: "password" })
                    .end(function (err, res) {
                        if (err) return done(err);
                        request(app).get(res.header.location)
                            .set("cookie", res.headers['set-cookie'])
                            .end(function (err, res) {
                                res.text.should.containEql("joj.");
                                done();
                            });
                    });
            });

            it('POST /api should be able to start another reporter on another multitenancy instance', function (done) {
                routes(app, multitenancy.options, multitenancy);
                request(app)
                    .get('/api/version')
                    .set("host", "joj.local.net")
                    .set("cookie", registrationResponse.headers['set-cookie'])
                    .expect(200, done);
            });

            it('GET /odata should response 401 for invalid credentials', function (done) {
                request(app).get("/odata/templates")
                    .expect(401, done);
            });
        });
    });
});
