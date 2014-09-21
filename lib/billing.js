

module.exports.chargeCredits = function(tenant, req, res) {
    var creditsToTake = Math.ceil((res.headers["Number-Of-Pages"] || 1) / 5);

    return {
        creditsUsed: creditsToTake
    }
};

module.exports.checkBilling = function(tenant, now) {
    now = now || new Date();

    if (shouldBillNow(tenant, now)) {
        return {
            lastBilledDate : now,
            creditsBilled: tenant.creditsUsed
        }
    }

    return null;
};

function shouldBillNow(tenant, now) {
    return !tenant.billingSkipping && isBillingDate(tenant, now) && tenant.lastBilledDate.getMonth() < now.getMonth();
};

function isBillingDate(tenant, now) {
    var currentDay = now.getDate();
    var billingDay = tenant.createdOn.getDate();
    var daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    return billingDay <= currentDay || (billingDay > currentDay && currentDay === daysInCurrentMonth);
};