var extend = require("node.extend"),
    passwordHash = require('password-hash'),
    q = require("q"),
    mongoConnectionProvider = require("jsreport/lib/store/mongoConnectionProvider.js"),
    _ = require("underscore");


/**
 * Repository over tenants.
 */
module.exports = MultitenancyRepository = function (options) {
    this.options = options;
    this.options.connectionString.logger = this.options.logger;
    this.db = q.denodeify(mongoConnectionProvider(this.options.connectionString));
    this._cacheFind = {};
    this._cacheAuthenticate = {};
};

MultitenancyRepository.prototype.initialize = function () {

};

MultitenancyRepository.prototype.findTenant = function (email) {
    if (this._cacheFind[email] && (new Date(this._cacheFind[email].time.getTime() + 10000) > new Date())) {
        return this._cacheFind[email].tenantPromise;
    }
    var self = this;

    var promise = this.db().then(function(db) {
        return q.ninvoke(db.collection("tenants").find({email: email}), "toArray").then(function (tenants) {
            if (tenants.length > 0) {
                var tenant = tenants[0];
                tenant.username = email;
                tenant.isAdmin = true;
                return tenant;
            }

            return self.findTenantInExtension(email);
        });
    });


    this._cacheFind[email] = {
        tenantPromise: promise,
        time: new Date()
    };

    return promise;
};

MultitenancyRepository.prototype.findTenantInExtension = function (email) {
    var self = this;
    var connectionString = extend(true, {}, this.options.connectionString);
    connectionString.databaseName = "multitenant";

    return q.nfcall(mongoConnectionProvider(connectionString)).then(function (db) {
        var fn = db.collection('users').find({
            username: email
        });

        return q.ninvoke(fn, "toArray").then(function (users) {
            if (users.length !== 1) {
                return null;
            }

            return self.findTenantByName(users[0].tenantId).then(function (tenant) {
                var user = extend(true, tenant, users[0]);
                user.email = users[0].username;
                user.password = users[0].password;
                return user;
            });
        })
    });
};

MultitenancyRepository.prototype.authenticateTenantInExtension = function (username, password) {
    return this.findTenantInExtension(username).then(function (user) {
        if (user === null)
            return;

        if (passwordHash.verify(password, user.password))
            return user;

        return null;
    });
};

MultitenancyRepository.prototype.findTenantByName = function (name) {
    return this.db().then(function (db) {
        return q.ninvoke(db.collection("tenants").find({name: new RegExp("^" + name + "$", "i")}), "toArray").then(function (tenants) {
            if (tenants.length < 1)
                throw new Error("Tenant " + name + " not found");

            return tenants[0];
        });
    });
};

MultitenancyRepository.prototype.updateTenant = function (name, props) {
    return this.db().then(function (db) {
        return q.ninvoke(db.collection("tenants"), "updateMany", { name: name}, props).then(function (res) {
            if (!res.result.ok)
                throw new Error("Update not successful");

            return res.result.n;
        });
    });
};

MultitenancyRepository.prototype.validate = function (user) {
    return this.findTenant(user.username).then(function (user) {
        if (user) {
            process.domain.req.customError = new Error("User already exists in one of the accounts");
            throw process.domain.req.customError;
        }

        return true;
    });
};

MultitenancyRepository.prototype.registerTenant = function (email, name, password) {
    return this.db().then(function (db) {
        var tenant = {
            email: email,
            password: passwordHash.generate(password),
            createdOn: new Date(),
            name: name,
            creditsUsed: 0,
            creditsBilled: 0,
            creditsAvailable: 200,
            lastBilledDate: new Date()
        };

        return q.ninvoke(db.collection("tenants"), "insert",tenant).then(function() {
            return tenant;
        });
    });
};

MultitenancyRepository.prototype.authenticate = function (username, password) {
    if (this._cacheAuthenticate[username] && (new Date(this._cacheAuthenticate[username].time.getTime() + 10000) > new Date())) {
        return this._cacheAuthenticate[username].tenantPromise;
    }

    var self = this;

    var promise = this.db().then(function (db) {
        return q.ninvoke(db.collection("tenants").find( { email: username }), "toArray").then(function (tenants) {
            if (tenants.length > 0 && passwordHash.verify(password, tenants[0].password)) {
                return q.ninvoke(db.collection("tenants"), "updateMany", { email: username} ,
                    { $set: { lastLogin: new Date() } }).then(function() {
                        tenants[0].isAdmin = true;
                        tenants[0].username = username;
                       return tenants[0];
                    });
            } else {
                return self.authenticateTenantInExtension(username, password);
            }
        });
    });

    this._cacheAuthenticate[username] = {
        tenantPromise: promise,
        time: new Date()
    };

    return promise;
};