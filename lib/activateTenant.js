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
module.exports = activateTenant = function (multitenancy, user, tcb) {
    var tenant = extend(true, {}, user);
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
    main.isAuthenticated = true;
    opts.express = { app: main };

    opts.tenant = tenant;
    //single databased for all tenants
    opts.authentication = {
        "cookieSession": {
            "secret": "dasd321as56d1sd5s61vdv32"
        },
        admin : {
            username : tenant.email
        }
    };

    opts.connectionString.databaseName = "multitenant";
    opts.connectionString.tenantId = tenant.name;

    opts.logger = logger(opts, tenant.name);

    var rep = new Reporter(opts);

    rep.init().then(function () {

        try {
            for (var key in rep.documentStore.collections) {
                var col = rep.documentStore.collections[key];

                col.beforeFindListeners.add("multitenancy", function (q) {
                    q.tenantId = tenant.name;
                });
                col.beforeInsertListeners.add("multitenancy", function (doc) {
                    doc.tenantId = tenant.name;
                });
                col.beforeRemoveListeners.add("multitenancy", function (q) {
                    q.tenantId = tenant.name;
                });
                col.beforeUpdateListeners.add("multitenancy", function (q, upd) {
                    q.tenantId = tenant.name;
                });
            }
        }
        catch(e) {
            console.log(e);
        }

        rep.afterRenderListeners.add("billing", function (req, res) {
            var promise = multitenancy.multitenancyRepository.updateTenant(req.reporter.options.tenant.name, billing.chargeCredits(tenant, req, res))
                .catch(function (e) {
                    req.reporter.logger.error("billing failed " + e.stack);
                });

            if (req.billingSync)
                return promise;
        });

        rep.authentication.usersRepository.validate = multitenancy.multitenancyRepository.validate.bind(multitenancy.multitenancyRepository);
        activatedTenants[tenant.name] = tenant;
        tenant.reporter = rep;
        activationRunning = false;
        flushQueue();
        checkBilling(function (err) {
            multitenancy.options.logger.info("tenant " + tenant.name + " activated.");

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

        multitenancy.multitenancyRepository.updateTenant(tenant.name, update).then(function () {
            cb();
        }).fail(function (e) {
            cb(e);
        });
    }
};






