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
    billing = require("./billing.js"),
    routes = require("./routes.js");

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
        lockQueue.push({tenant: tenant, cb: tcb});
        return;
    }

    if (activatedTenants[tenant.name]) {
        return tcb(null, activatedTenants[tenant.name]);
    }

    multitenancy.options.logger.info("activating tenant " + tenant.name);

    activationRunning = true;

    var opts = extend(true, {}, multitenancy.options);
    var main = express();
    main.isAuthenticated = true;
    opts.express = {app: main};

    opts.tenant = tenant;
    //single databased for all tenants
    opts.authentication = {
        "cookieSession": {
            "secret": "dasd321as56d1sd5s61vdv32"
        },
        admin: {
            username: tenant.email
        }
    };

    opts.connectionString.databaseName = "multitenant";
    opts.connectionString.tenantId = tenant.name;

    opts.logger = logger(opts, tenant.name);
    opts.tasks.scriptManager = multitenancy.scriptManager;

    var rep = new Reporter(opts);

    function addMultitenancyListenersToCollections(col) {
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

    rep.on("before-settings-init", function () {
        addMultitenancyListenersToCollections(rep.documentStore.collection("settings"));
    });
    rep.on("before-init", function () {
        for (var key in rep.documentStore.collections) {
            var col = rep.documentStore.collections[key];
            addMultitenancyListenersToCollections(col);
        }
    });

    rep.init().then(function () {
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
        //to support logout from client application
        main.post("/logout", function (req, res) {
            req.logout();
            var domains = req.headers.host.split('.');
            res.redirect("https://" + domains[domains.length - 2] + "." + domains[domains.length - 1]);
        });
        multitenancy.options.logger.info("tenant " + tenant.name + " activated.");
        tcb(null, tenant);
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
};






