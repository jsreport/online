var foo = require("odata-server"),
    DataProvider = require("../lib/multitenantDataProvider.js"),
    should = require("should"),
    logger = require("../logger.js")


describe('multitenant data provider', function () {

    it('should filter data by tenants', function (done) {

        var dataProvider = new DataProvider({ name: "mongoDB", databaseName: "test", address: "127.0.0.1", port: 27017, logger: logger({}) }, {  tenant: { name: "test1"} });
        dataProvider.buildContext();
        dataProvider.dropStore().then(

            function () {

                var TestType = dataProvider.createEntityType("TestType", {
                    _id: { type: "id", key: true, computed: true, nullable: false },
                    foo: { type: "string" }
                });

                dataProvider.registerEntitySet("tests", TestType);
                dataProvider.buildContext();

                //first store data into one tenant
                return dataProvider.startContext().then(function (context) {
                    context.tests.add(new TestType({ foo: "value"}));
                    return context.saveChanges();
                }).then(function () {
                    //opening another tenant and loading same tests collection should resoult into empty array
                    var dataProvider2 = new DataProvider({ name: "mongoDB", databaseName: "test", address: "127.0.0.1", port: 27017 }, {   tenant: { name: "test2"} });
                    dataProvider2.registerEntitySet("tests", TestType);
                    dataProvider2.buildContext();

                    return dataProvider2.startContext().then(function(context2) {
                        return context2.tests.toArray().then(function(res) {
                            res.length.should.be.exactly(0);
                            done();
                        });
                    });
                });
            }).catch(done);
    });
});