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
        password: { type: "string" },
        creditsUsed: { type: "int", increment: true },
        creditsBilled: { type: "int" },
        creditsAvailable: { type: "int" },
        lastBilledDate: { type: "date" }
    });

    $data.EntityContext.extend("$entity.TenantContext", {
        tenants: { type: $data.EntitySet, elementType: $entity.Tenant }
    });

    this.options = extend(true, {}, options);

    this._cacheFind = {};
    this._cacheAuthenticate = {};
 };

MultitenancyRepository.prototype.initialize = function () {

};

MultitenancyRepository.prototype.findTenant = function (email) {
    if (this._cacheFind[email] && (new Date(this._cacheFind[email].time.getTime() + 10000) > new Date())) {
        return this._cacheFind[email].tenantPromise;
    }

    var promise = this._createContext().then(function (context) {
        return context.tenants.filter(function(t) {
            return t.email == this.email;
        }, { email: email}).take(1).toArray().then(function(tenants) {
            return (tenants.length === 1) ? (tenants[0]) : null;
        });
    });

    this._cacheFind[email] = {
        tenantPromise : promise,
        time : new Date()
    };

    return promise;
};

MultitenancyRepository.prototype.findTenantByName = function (name) {
    return this._createContext().then(function (context) {
        return context.tenants.single(function(t) {
            return t.name == this.name;
        }, { name: name});
    });
};

MultitenancyRepository.prototype.updateTenant = function (email, props) {
   return this._createContext().then(function (context) {
         return context.tenants.filter(function (t) { return t.email == this.email;}, { email: email}).take(1).toArray().then(function (tenants) {
            var tenant = tenants[0];
             context.attach(tenant);
             _.extend(tenant, props);

             return context.saveChanges();
        });
    });
};

MultitenancyRepository.prototype.registerTenant = function (email, name, password) {
    return this._createContext().then(function (context) {
        var tenant = new $entity.Tenant({
            email: email,
            password: passwordHash.generate(password),
            createdOn: new Date(),
            name: name,
            creditsUsed: 0,
            creditsBilled: 0,
            creditsAvailable: 300000,
            lastBilledDate: new Date()
        });

        context.tenants.add(tenant);

        return context.saveChanges().then(function () {
            return tenant;
        });
    });

};

MultitenancyRepository.prototype.authenticate = function (username, password) {
    if (this._cacheAuthenticate[username] && (new Date(this._cacheAuthenticate[username].time.getTime() + 10000) > new Date())) {
        return this._cacheAuthenticate[username].tenantPromise;
    }

    var promise = this._createContext().then(function (context) {
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

    this._cacheAuthenticate[username] = {
        tenantPromise : promise,
        time : new Date()
    };

    return promise;
};

MultitenancyRepository.prototype._createContext = function () {
    var self = this;
    this.options.connectionString.getLogger = function() { return self.options.logger };

    var context = new $entity.TenantContext(this.options.connectionString);
    return context.onReady().then(function() {
        return context;
    });
};