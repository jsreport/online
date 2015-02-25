var Multitenancy = require("../lib/multitenancy.js"),
    app = require("express")(),
    should = require("should"),
    q = require("q"),
    MongoClient = require('mongodb').MongoClient;

//travis has some super multicpu machines allocating too many phantom instances
require("events").EventEmitter.defaultMaxListeners = 50;

module.exports = function (nestedSuite) {
    var multitenancy = Multitenancy(app, require("./defaultOptions.js")());

    describe('multitenancy', function () {

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

