var billing = require("../lib/billing.js");
    should = require("should");

describe('chargeCredits', function () {
    it("should take number of pages from header", function() {
        billing.chargeCredits({ }, {}, { headers:  { "Number-Of-Pages": 6} }).$inc.creditsUsed.should.be.eql(2);
    });

    it("default number of pages should be 1", function() {
        billing.chargeCredits({ }, {}, { headers:  {} }).$inc.creditsUsed.should.be.eql(1);
    });
});

describe('checkBilling', function () {
    it("should charge when current day is billing day and did not yet charged", function() {
        var tenant = {
            createdOn : new Date(2014,05,05),
            creditsUsed : 100,
            lastBilledDate : new Date(2014,05,05)
        };

        var now = new Date(2014, 06, 05);

        var update = billing.checkBilling(tenant, now);
        (update === null).should.be.false;
        update.$set.lastBilledDate.should.be.eql(now);
        update.$inc.creditsBilled.should.be.eql(100);
    });

    it("should charge when the last billed day is way in past", function() {
        var tenant = {
            createdOn : new Date(2014,05,12),
            creditsUsed : 100,
            lastBilledDate : new Date(2014,11,11)
        };

        var now = new Date(2015, 03, 03);

        var update = billing.checkBilling(tenant, now);
        (update === null).should.be.false;
        update.$set.lastBilledDate.should.be.eql(now);
        update.$inc.creditsBilled.should.be.eql(100);
    });

    it("should charge when current day is the last day of the month and billing day is greater then current", function() {
        var tenant = {
            createdOn : new Date(2014,00,31),
            creditsUsed : 100,
            lastBilledDate : new Date(2014,00,31)
        }

        var now = new Date(2014, 03, 30);

        var update = billing.checkBilling(tenant, now);
        (update === null).should.be.false;
        update.$set.lastBilledDate.should.be.eql(now);
        update.$inc.creditsBilled.should.be.eql(100);
    });

    it("should NOT charge when already charged this month", function() {
        var tenant = {
            createdOn : new Date(2014, 05, 05),
            creditsUsed : 100,
            lastBilledDate : new Date(2014, 06, 04)
        }

        var now = new Date(2014, 06, 05);

        var update = billing.checkBilling(tenant, now);
        (update === null).should.be.true;
    });

    it("should NOT charge when now month day lower", function() {
        var tenant = {
            createdOn : new Date(2014, 05, 05),
            creditsUsed : 100,
            lastBilledDate : new Date(2014, 05, 05)
        }

        var now = new Date(2014, 06, 04);

        var update = billing.checkBilling(tenant, now);
        (update === null).should.be.true;
    });
});


