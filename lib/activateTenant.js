/*! 
 * Copyright(c) 2014 Jan Blaha 
 * 
 * Create child vhost for tenant and initialize dedicated {Reporter}
 */

var _ = require("underscore"),
    extend = require("node.extend"),
    fs = require("fs"),
    logger = require("./logger");
express = require("express"),
    Reporter = require("jsreport").Reporter,
    MultitenantDataProvider = require("./multitenantDataProvider.js"),
    path = require("path"),
    routes = require("./routes.js"),
    billing = require("./billing.js");

var activatedTenants = {};
var lockQueue = [];
var activationRunning = false;

/**
 * Create child vhost for tenant and initialize dedicated {Reporter}
 * @param {$ Multitenancy} multitenancy
 * @param {$entity.Tenant} tenant
 * @param {function} cb
 */
module.exports = activateTenant = function (multitenancy, tenant, tcb) {
    if (activationRunning) {
        lockQueue.push({ tenant: tenant, cb: tcb});
        return;
    }

    if (activatedTenants[tenant.name]) {
        checkBilling(function (err) {
            tcb(null, activatedTenants[tenant.name]);
        });
        return;
    }

    multitenancy.options.logger.info("activating tenant " + tenant.name);

    activationRunning = true;

    var opts = extend(true, {}, multitenancy.options);
    var main = express();

    opts.express = { app: main };
    opts.tenant = tenant;
    opts.DataProvider = MultitenantDataProvider;
    //single databased for all tenants
    opts.connectionString.databaseName = "multitenant";

    opts.logger = logger(opts, tenant.name);

    var rep = new Reporter(opts);

    rep.afterRenderListeners.add("billing", function (req, res) {
        var promise = multitenancy.multitenancyRepository.updateTenant(req.reporter.options.tenant.email, billing.chargeCredits(tenant, req, res))
            .catch(function (e) {
                req.reporter.logger.error("billing failed " + e.stack);
            });

        if (req.billingSync)
            return promise;
    });

    rep.init().then(function () {
        activatedTenants[tenant.name] = tenant;
        tenant.reporter = rep;
        activationRunning = false;
        flushQueue();
        checkBilling(function (err) {
            tcb(err, tenant);
        });
    }).fail(function (e) {
        multitenancy.options.logger.info("tenant activation failed " + tenant.name + " " + e.stack);
        activationRunning = false;
        flushQueue();
        tcb(e);
    });

    function flushQueue() {
        var queueClone = lockQueue.slice();
        lockQueue = [];
        queueClone.forEach(function (i) {
            activateTenant(multitenancy, i.tenant, i.cb);
        });
    };

    function checkBilling(cb) {
        var update = billing.checkBilling(tenant);

        if (!update) {
            return cb();
        }

        multitenancy.multitenancyRepository.updateTenant(tenant.email, update).then(function () {
            cb();
        }).fail(function (e) {
            cb(e);
        });
    }
};




