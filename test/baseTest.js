var Multitenancy = require("../lib/multitenancy.js"),
    app = require("express")(),
    should = require("should"),
    q = require("q"),
    MongoClient = require('mongodb').MongoClient;

module.exports = function (nestedSuite) {
    var multitenancy = Multitenancy(app, require("./defaultOptions.js")());

    describe('multitenancy', function () {
        this.timeout(5000);

        beforeEach(function (done) {
            multitenancy = Multitenancy(app, require("./defaultOptions.js")());
            MongoClient.connect('mongodb://127.0.0.1:27017/multitenant-root', {}, function (err, db) {
                db.dropDatabase(function () {
                    db.db("multitenant").dropDatabase(function () {
                        done();
                    });
                });
            });
        });

        nestedSuite(multitenancy);
    });
}

