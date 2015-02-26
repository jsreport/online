var warmingUp = false;

module.exports = function(req, res, activateTenant) {
    function doWarmUp() {
        warmingUp = true;
        activateTenant({ name: "warmup", billingSkipping: true}).then(function (tenant) {
            return tenant.reporter.dataProvider.startContext(function(context) {
                return context.templates.rawFind({ tenantId: 'warmup' }).then(function() {
                    warmingUp = false;
                    res.end("ok");
                });
            });
        }).fail(function(e) {
            warmingUp = false;
            res.statusCode = 500;
            res.end(e.stack);
        });
    }

    if (!warmingUp)
        return doWarmUp();

    function warmUp(retry) {
        setTimeout(function() {
            if (!warmingUp)
                return doWarmUp();

            if (retry++ > 100) {
                warmingUp = false;
                return doWarmUp();
            }
            warmUp(retry);
        }, 500);
    }

    warmUp(0);
};
