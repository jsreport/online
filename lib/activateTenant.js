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
    routes = require("./routes.js");

var activatedTenants = {};
var lockQueue = [];
var activationRunning = false;

/**
 * Create child vhost for tenant and initialize dedicated {Reporter}
 * @param {express} app
 * @param {$entity.Tenant} tenant
 * @param {object} options - jsreport configuration
 * @param {function} tcb
 */
module.exports = activateTenant = function (app, tenant, options, tcb) {
    if (activationRunning) {
        lockQueue.push({ tenant: tenant, cb: tcb});
        return;
    }

    if (activatedTenants[tenant.name]) {
        return tcb(null, activatedTenants[tenant.name]);
    }

    options.logger.info("activating tenant " + tenant.name);

    activationRunning = true;

    var opts = extend(true, {}, options);
    var main = express();

    opts.express = { app: main };
    opts.tenant = tenant;
    opts.DataProvider = MultitenantDataProvider;
    //single databased for all tenants
    opts.connectionString.databaseName = "multitenant";

    opts.logger = logger(opts, tenant.name);

    var rep = new Reporter(opts);
//    rep.afterRenderListeners.add("billing", function(req, res) {
//        console.log(res.headers["Number-Of-Pages"]);
//    });

    rep.init().then(function () {
        activatedTenants[tenant.name] = tenant;
        tenant.reporter = rep;
        activationRunning = false;
        flushQueue();
        tcb(null, tenant);
    }).fail(function (e) {
        options.logger.info("tenant activation failed " + tenant.name + " " + e.stack);
        activationRunning = false;
        flushQueue();
        tcb(e);
    });

    function flushQueue() {
        var queueClone = lockQueue.slice();
        lockQueue = [];
        queueClone.forEach(function (i) {
            activateTenant(app, i.tenant, options, i.cb);
        });
    };
};


