var warmingUp = false;

module.exports = function(req, res, activateTenant) {
    function doWarmUp() {
        warmingUp = true;
        activateTenant({ name: "warmup"}, function () {
            res.end("ok");
            warmingUp = false;
        });
    }

    if (!warmingUp)
        return doWarmUp();

    function warmUp(retry) {
        setTimeout(function() {
            if (!warmingUp)
                return doWarmUp();

            if (retry++ > 100) {
                res.writeHead(500);
                return res.end("Warmup timeout");
            }
            warmUp(retry);
        }, 500);
    }

    warmUp(0);
};
