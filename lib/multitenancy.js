/*!
 * Copyright(c) 2014 Jan Blaha
 *
 */

var activateTenant = require("./activateTenant.js"),
    warmup = require("./warmup.js"),
    q = require("q"),
    extend = require("node.extend"),
    Reporter = require("jsreport").Reporter,
    logger = require("./logger.js"),
    MultitenancyRepository = require("./multitenancyRepository.js");

module.exports = function (app, options) {
    return new Multitenancy(app, options);
};

var Multitenancy = function (app, options) {
    this.app = app;
    this.options = options;
    this.multitenancyRepository = new MultitenancyRepository(options);
    this.logger = logger(options);

    //if (!options.forwardToBackgroundWorker)
        this.initializeScheduler();
};

Multitenancy.prototype.initializeScheduler = function() {
    var opts = extend(true, {}, this.options);
    opts.extensions = ["templates", "reports", "scheduling"];
    opts.scheduling = {
        autoStart: false
    };
    opts.connectionString.databaseName = "multitenant";
    opts.logger = this.logger;
    var rep = new Reporter(opts);

    var self = this;

    rep.init().then(function () {
        rep.scheduling.jobProcessor.executionHandler = function (schedule, task) {
            self.logger.info("Processing scheduled report " + schedule.shortid);

            return rep.documentStore.collection("schedules").find({_id: schedule._id}).then(function (schedules) {
                schedule = schedules[0];
                return rep.documentStore.collection("tasks").update({_id: task._id}, {
                    $set: {
                        tenantId: schedule.tenantId
                    }
                }).then(function () {
                    return self.multitenancyRepository.findTenantByName(schedule.tenantId).then(function (tenant) {
                        return self.activateTenant(tenant).then(function (tenant) {                            
                            return tenant.reporter.render({
                                template: {shortid: schedule.templateShortid},
                                user: {isAdmin: true},
                                options: {
                                    scheduling: {taskId: task._id.toString(), scheduleShortid: schedule.shortid},
                                    reports: {save: true, mergeProperties: {taskId: task._id.toString()}},
                                    isRootRequest: true
                                }
                            })
                        })
                    });
                })
            }).catch(function (e) {
                self.logger.error("Error during processing schedule " + e);
            });
        };
        rep.scheduling.start();
    }).catch(function (e) {
         self.logger.error("Error during scheduler reporter init " + e);
    });
};

Multitenancy.prototype.activateTenant = function (tenant) {
    return q.nfcall(activateTenant, this, tenant)
};

var querystring = require("querystring");
var url = require("url");
Multitenancy.prototype.gumroad = function (req, res) {
    this.logger.info("Processing gumroad webhook");
    var self = this;
    var body = "";
    req.on('data', function(chunk) {
        body += chunk.toString();
    });

    req.on('end', function() {
        try {
            var qs = querystring.parse(body);
            var sourceUrl = url.parse(qs["url_params[source_url]"]);
            var tenantName = sourceUrl.hostname.split(".")[0];
            var plan = self._protuctNameToPlan(qs["product_name"]);
            self.multitenancyRepository.updateTenant(tenantName, {$set: plan});
            self.logger.info("Updated tenant " + tenantName + " to plan " + plan.plan);
            res.end("ok");
        }
        catch(e) {
            self.logger.error(e.stack);
            res.writeHead(500);
            res.end(e.stack);
        }
    });
};

Multitenancy.prototype._protuctNameToPlan = function (name) {
    switch (name) {
        case "jsreportonline free": return { plan: "free", creditsAvailable: 200 };
        case "jsreportonline bronze": return { plan: "bronze", creditsAvailable: 10000 };
        case "jsreportonline silver": return { plan: "silver", creditsAvailable: 100000 };
        case "jsreportonline gold": return { plan: "gold", creditsAvailable: 300000 };
    }

    throw new Error("Unsupported gumroad product " + name);
};



Multitenancy.prototype.warmup = function (req, res) {
    return warmup(req, res, this.activateTenant.bind(this));
};




