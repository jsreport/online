var extend = require("node.extend"),
    passwordHash = require('password-hash'),
    q = require("q"),
    _ = require("underscore");


    /**
 * Repository over tenants.
 */
module.exports = MultitenancyRepository = function (options) {
    $data.Entity.extend("$entity.Tenant", {
        _id: { type: "id", key: true, computed: true, nullable: false },
        createdOn: { type: "date" },
        lastLogin: { type: "date" },
        email: { type: "string" },
        name: { type: "string" },
        password: { type: "string" }
    });

    $data.EntityContext.extend("$entity.TenantContext", {
        tenants: { type: $data.EntitySet, elementType: $entity.Tenant }
    });

    this.options = extend(true, {}, options);
 };

MultitenancyRepository.prototype.initialize = function () {

};

MultitenancyRepository.prototype.findTenant = function (email) {
    return this._createContext().then(function (context) {
        return context.tenants.filter(function(t) {
            return t.email == this.email;
        }, { email: email}).take(1).toArray().then(function(tenants) {
            return (tenants.length === 1) ? (tenants[0]) : null;
        });
    });
};

MultitenancyRepository.prototype.findTenantByName = function (name) {
    return this._createContext().then(function (context) {
        return context.tenants.single(function(t) {
            return t.name == this.name;
        }, { name: name});
    });
};

MultitenancyRepository.prototype.registerTenant = function (email, name, password) {
    var self = this;
    return this._createContext().then(function (context) {
        var tenant = new $entity.Tenant({
            email: email,
            password: passwordHash.generate(password),
            createdOn: new Date(),
            name: name
        });

        context.tenants.add(tenant);

        return context.saveChanges().then(function () {
            return tenant;
        });
    });

};

MultitenancyRepository.prototype.authenticate = function (username, password) {
    return this._createContext().then(function (context) {
        return context.tenants.filter(function (t) {
            return t.email == this.username;
        }, { username: username}).take(1).toArray().then(function (tenants) {
            if (tenants.length === 1 && passwordHash.verify(password, tenants[0].password)) {
                context.attach(tenants[0]);
                tenants[0].lastLogin = new Date();
                return context.saveChanges().then(function () {
                    return tenants[0];
                });
            } else {
                return null;
            }
        });
    });
};

MultitenancyRepository.prototype._createContext = function () {
    this.options.connectionString.logger = this.options.logger;
    var context = new $entity.TenantContext(this.options.connectionString);
    return context.onReady();
};