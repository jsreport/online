var activateTenant = require("../lib/activateTenant.js"),
    app = require("express")(),
    should = require("should"),
    baseTest = require("./baseTest.js");


baseTest(function(multitenancy) {

    describe('activating tenant', function () {
        it("should initialize reporter and assign to tenant", function(done) {
            activateTenant(multitenancy, { name: "test", billingSkipping: true }, function(err, tenant) {
                if (err)
                    done(err);

                tenant.should.have.property("reporter");
                done();
            });
        });

        it("should queue multiple tenant activation requests and process all", function(done) {
            activateTenant(multitenancy, { name: "test", billingSkipping: true }, function(err, tenant) {});
            activateTenant(multitenancy, { name: "test2", billingSkipping: true }, function(err, tenant) {
                if (err)
                    done(err);

                tenant.should.have.property("reporter");
                done();
            });
        });

        it("should charge credits", function(done) {
            multitenancy.multitenancyRepository.registerTenant("email", "billingTest", "password").then(function(tenant) {
                return multitenancy.activateTenant(tenant).then(function(tenant) {
                    var req = {
                        template: { content: "foo"},
                        reporter: tenant.reporter,
                        billingSync: true
                    };
                    var res = {

                    };

                    return tenant.reporter.render(req, res).then(function() {
                        return multitenancy.multitenancyRepository.findTenant("email").then(function(tenant) {
                            tenant.creditsUsed.should.be.eql(1);
                            done();
                        });
                    })
                })
            }).catch(done);
        });
    });
});
