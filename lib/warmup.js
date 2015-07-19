var warmingUp = false;
var statusSet = false;
module.exports = function (req, res, activateTenant) {
    function doWarmUp() {
        warmingUp = true;

        var d = require('domain').create();
        d.on('error', function (e) {
            warmingUp = false;
            res.statusCode = 500;
            res.end(e.stack);
        });

        d.run(function () {
            activateTenant({name: "warmup", billingSkipping: true}).then(function (tenant) {
                return tenant.reporter.documentStore.collection("templates").find({tenantId: 'warmup'}).then(function () {
                    warmingUp = false;

                    if (!statusSet) {
                        statusSet = true;
                        require("fs").appendFile("jsreportout.txt", new Date() + " Setting Ready", function(err) { ; });
                        require("azure").RoleEnvironment.setStatus("ready",
                            new Date('9999-12-31T23:59:59.9999999'), function (error1) {
                                require("fs").appendFile("jsreportout.txt", new Date() + " Setting Ready Done " + error1, function(err) { ; });
                            });
                    }

                    res.end("ok");
                });
            }).fail(function (e) {
                warmingUp = false;
                res.statusCode = 500;
                res.end(e.stack);
            });
        });
    }

    if (!warmingUp)
        return doWarmUp();

    function warmUp(retry) {
        setTimeout(function () {
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
