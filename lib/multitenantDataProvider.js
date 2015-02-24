/*!
 * Copyright(c) 2014 Jan Blaha
 *
 * This data provider is prefixing collections with tenant name
 */

/*globals $data */

var _ = require("underscore"),
    mongoProvider = require("../node_modules/jsreport/lib/jaydata/mongoDBStorageProvider.js"),
    events = require("events"),
    util = require("util"),
    EventEmitter = events.EventEmitter;


var MultitenantDataProvider = module.exports = function(connectionString, options) {
    this.connectionString = connectionString;
    this.tenant = options.tenant;
    this.connectionString.logger = options.logger;
    this.options = options;

    if (this.tenant)
        this.connectionString.tenantId = this.tenant.name;

    this._entitySets = {};
};

util.inherits(MultitenantDataProvider, events.EventEmitter);

MultitenantDataProvider.prototype.buildContext = function() {
    this.emit("building-context", this._entitySets);

    this.ContextDefinition = $data.Class.defineEx(this.tenant ? "jsreport.Context" : "jsreport.RootContext",
        [$data.EntityContext, $data.ServiceBase], null, this._entitySets);
};

MultitenantDataProvider.prototype.createEntityType = function(name, attributes) {
    return $data.Class.define(name, $data.Entity, null, attributes, null);
};

MultitenantDataProvider.prototype.registerEntitySet = function(name, type, options) {
    var entitySet = { type: $data.EntitySet, elementType: type };
    _.extend(entitySet, options);
    entitySet.tableName = name;
    this._entitySets[name] = entitySet;
    return this._enhanceEntitySet(name, entitySet);
};

MultitenantDataProvider.prototype.dropStore = function(fn) {
    var droppingConnection = _.extend({}, this.connectionString);
    droppingConnection.dbCreation = $data.storageProviders.DbCreationType.DropAllExistingTables;
    var context = new this.ContextDefinition(droppingConnection);

    if (fn) {
        return context.onReady(fn);
    }

    return context.onReady();
};

MultitenantDataProvider.prototype.startContext = function(fn) {

    var context = new this.ContextDefinition(this.connectionString);
    context.events = new EventEmitter();
    var self = this;

    this.emit("context-created", context);

    var context = new this.ContextDefinition(this.connectionString);

    if (fn) {
        return context.onReady(fn);
    }

    return context.onReady();
};

MultitenantDataProvider.prototype._enhanceEntitySet = function(name, entitySet) {
    var self = this;
    var methods = ["Update", "Delete", "Create"];

    ["before", "after"].forEach(function(event) {
        methods.forEach(function (m) {
            entitySet[event + m] = function (i) {
                return function (callback, items) {
                    entitySet[event + m + "Listeners"].fire(name, items).then(function (res) {
                        var successes = res.filter(function (r) {
                            return r;
                        });

                        callback(successes.length === res.length);
                    }).catch(function (e) {
                        self.options.logger.error(e.stack);
                        callback(false);
                    });
                };
            };

            entitySet[event + m + "Listeners"] = new ListenerCollection();
        });
    });

    entitySet.beforeRead = function (i) {
        return function (callback, successResult, sets, query) {
            entitySet.beforeReadListeners.fire(name, successResult, sets, query).then(function(res) {
                callback();
            }).catch(function(e) {
                self.options.logger.error(e.stack);
                callback(false);
            });
        };
    };

    entitySet.afterRead = function (i) {
        return function (callback, successResult, sets, query) {
            entitySet.afterReadListeners.fire(name, successResult, sets, query).then(function(res) {
                callback();
            }).catch(function(e) {
                self.options.logger.error(e.stack);
                callback(false);
            });
        };
    };

    entitySet.afterReadListeners = new ListenerCollection();
    entitySet.beforeReadListeners = new ListenerCollection();

    return entitySet;
};