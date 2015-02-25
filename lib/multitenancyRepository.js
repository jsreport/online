var extend = require("node.extend"),
    passwordHash = require('password-hash'),
    q = require("q"),
    mongoConnectionProvider = require("jsreport/lib/jaydata/mongoConnectionProvider.js"),
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
    var self = this;
    this.options.connectionString.getLogger = function() { return self.options.logger };
 };

MultitenancyRepository.prototype.initialize = function () {

};

MultitenancyRepository.prototype.findTenant = function (email) {
    if (this._cacheFind[email] && (new Date(this._cacheFind[email].time.getTime() + 10000) > new Date())) {
        return this._cacheFind[email].tenantPromise;
    }

    var self = this;

    var promise = this._createContext().then(function (context) {
        return context.tenants.filter(function(t) {
            return t.email == this.email;
        }, { email: email}).take(1).toArray().then(function(tenants) {
            if (tenants.length === 1) {
                var tenant = tenants[0];
                tenant = tenant.toJSON();
                tenant.isAdmin = true;
                return tenant;
            }

            return self.findTenantInExtension(email);
        });
    });

    this._cacheFind[email] = {
        tenantPromise : promise,
        time : new Date()
    };

    return promise;
};

MultitenancyRepository.prototype.findTenantInExtension = function (email) {
    var self = this;
    var connectionString = extend(true, {}, this.options.connectionString);
    connectionString.databaseName = "multitenant";

    return q.nfcall(mongoConnectionProvider(connectionString)).then(function(db) {
        var fn = db.collection('users').find({
            username : email
        });

        return q.ninvoke(fn, "toArray").then(function(users) {
            if (users.length !== 1) {
                return null;
            }

            return self.findTenantByName(users[0].tenantId).then(function(tenant) {
                var user = extend(true, tenant.toJSON(), users[0]);
                user.email = users[0].username;
                user.password = users[0].password;;
                user._id = btoa(users[0]._id.toHexString());
                return user;
            });
        })
    });
};

MultitenancyRepository.prototype.authenticateTenantInExtension = function (username, password) {
    return this.findTenantInExtension(username).then(function(user) {
        if (user === null)
            return;

        if (passwordHash.verify(password, user.password))
            return user;

        return null;
    });
};

MultitenancyRepository.prototype.findTenantByName = function (name) {
    return this._createContext().then(function(context) {
        return context.tenants.rawFind({ name: new RegExp("^" + name + "$", "i") }).then(function (tenants) {
            if (tenants.length !== 1)
                throw new Error("Tenant " + name + " not found");

            return tenants[0];
        });
    });

};

MultitenancyRepository.prototype.updateTenant = function (name, props) {
   return this._createContext().then(function (context) {
         return context.tenants.filter(function (t) { return t.name == this.name;}, { name: name}).take(1).toArray().then(function (tenants) {
            var tenant = tenants[0];
             context.attach(tenant);
             _.extend(tenant, props);

             return context.saveChanges();
        });
    });
};

MultitenancyRepository.prototype.validate = function (user) {
    return this.findTenant(user.username).then(function(user) {
        if (user) {
            process.domain.req.customError = new Error("User already exists in one of the accounts");
            throw process.domain.req.customError;
        }

        return true;
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

    var self = this;

    var promise = this._createContext().then(function (context) {
        return context.tenants.filter(function (t) {
            return t.email == this.username;
        }, { username: username}).take(1).toArray().then(function (tenants) {
            if (tenants.length === 1 && passwordHash.verify(password, tenants[0].password)) {
                context.attach(tenants[0]);
                tenants[0].lastLogin = new Date();
                return context.saveChanges().then(function () {
                    var tenant = tenants[0];
                    tenant = tenant.toJSON();
                    tenant.isAdmin = true;
                    return tenant;
                });
            } else {
                return self.authenticateTenantInExtension(username, password);
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

    var context = new $entity.TenantContext(this.options.connectionString);
    return context.onReady().then(function() {
        return context;
    });
};