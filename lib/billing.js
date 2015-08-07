

module.exports.chargeCredits = function(tenant, req, res) {
    var creditsToTake = Math.ceil((res.headers["Number-Of-Pages"] || 1) / 5);

    return {
        $inc: {
            creditsUsed: creditsToTake
        }
    }
};

module.exports.checkBilling = function(tenant, now) {
    now = now || new Date();

    if (shouldBillNow(tenant, now)) {
        return {
            $set: {
                lastBilledDate: now,
                creditsBilled: tenant.creditsUsed
            }
        };
    }

    return null;
};

function shouldBillNow(tenant, now) {
    return !tenant.billingSkipping && isBillingDate(tenant, now);
};

function isBillingDate(tenant, now) {
    var currentDay = now.getDate();
    var billingDay = tenant.createdOn.getDate();
    var daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    //completely different year
    if (tenant.lastBilledDate.getFullYear() !== now.getFullYear()) {
        return true;
    }

    //the billing day is already in and not billed in this month
    if (billingDay <= currentDay && (tenant.lastBilledDate.getMonth() < now.getMonth())) {
        return true;
    }

    return (billingDay > currentDay && currentDay === daysInCurrentMonth);
};