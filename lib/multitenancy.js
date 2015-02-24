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
}

var Multitenancy = function (app, options) {
    this.app = app;
    this.options = options;
    this.multitenancyRepository = new MultitenancyRepository(options);
    this.logger = logger(options);
    this.initializeScheduler();
}

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
        rep.scheduling.jobProcessor.executionHandler = function (schedule, task, context) {
            self.logger.info("Processing scheduled report " + schedule.shortid);
            return context.schedules.rawFind({_id: schedule._id}).then(function (schedules) {
                schedule = schedules[0];
                return context.tasks.rawUpdate({_id: task._id}, {
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
                                    scheduling: {taskId: task._id, scheduleShortid: schedule.shortid},
                                    reports: {save: true, mergeProperties: {taskId: task._id}},
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
}


Multitenancy.prototype.activateTenant = function (tenant) {
    return q.nfcall(activateTenant, this, tenant)
}

Multitenancy.prototype.warmup = function (req, res) {
    return warmup(req, res, this.activateTenant.bind(this));
}




