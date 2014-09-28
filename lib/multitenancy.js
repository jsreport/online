/*!
 * Copyright(c) 2014 Jan Blaha
 *
 */

var activateTenant = require("./activateTenant.js"),
    warmup = require("./warmup.js"),
    q = require("q"),
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
}

Multitenancy.prototype.activateTenant = function (tenant) {
    return q.nfcall(activateTenant, this, tenant)
}

Multitenancy.prototype.warmup = function (req, res) {
    return warmup(req, res, this.activateTenant.bind(this));
}




