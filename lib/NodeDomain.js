/*
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */


/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define */

define(function (require, exports, module) {
    "use strict";
    
    var Promise = require("bluebird"),
        EventEmitter = require("eventEmitter");

    var NodeConnection = require("./NodeConnection");
    
    /**
     * Provides a simple abstraction for executing the commands of a single
     * domain loaded via a NodeConnection. Automatically handles connection
     * management and domain loading, and exposes each command in the domain as
     * a promise-returning method that can safely be called regardless of the
     * current status of the underlying connection. Example usage:
     * 
     * var myDomain = new NodeDomain("someDomain", "/path/to/SomeDomainDef.js"),
     *     result = myDomain.exec("someCommand", arg1, arg2);
     * 
     * result.then(function (value) {
     *     // the command succeeded!
     * });
     * 
     * result.catch(function (err) {
     *     // the command failed; act accordingly!
     * });
     * 
     * To handle domain events, just listen for the event on the domain:
     * 
     * myDomain.on("someEvent", someHandler);
     * 
     * @constructor
     * @param {string} domainName Name of the registered Node Domain
     * @param {string} domainPath Full path of the JavaScript Node domain specification
     */
    function NodeDomain(domainName, domainPath) {
        EventEmitter.call(this);

        var connection = new NodeConnection();
        
        this.connection = connection;
        this._domainName = domainName;
        this._domainPath = domainPath;
        this._domainLoaded = false;
        this._load = this._load.bind(this);
        this._connectionPromise = connection.connect(true)
            .then(this._load);

        var domainPrefix = new RegExp("^" + this._domainName + ":*");
        connection.on("close", function (promise) {
            this.connection.off(domainPrefix);
            this._domainLoaded = false;
            this._connectionPromise = promise.then(this._load);
        }.bind(this));
    }

    NodeDomain.prototype = Object.create(EventEmitter.prototype);
    
    /** 
     * The underlying Node connection object for this domain.
     * 
     * @type {!NodeConnection} 
     */
    NodeDomain.prototype.connection = null;

    /**
     * A promise that is resolved once the NodeConnection is connected and the
     * domain has been loaded.
     * 
     * @type {?Promise}
     * @private
     */
    NodeDomain.prototype._connectionPromise = null;
    
    /**
     * The name of this domain.
     * 
     * @type {string}
     * @private
     */
    NodeDomain.prototype._domainName = null;
    
    /**
     * The path at which the Node definition of this domain resides.
     * 
     * @type {string}
     * @private
     */
    NodeDomain.prototype._domainPath = null;
    
    /**
     * Whether or not the domain has been successfully loaded.
     * 
     * @type {boolean}
     * @private
     */
    NodeDomain.prototype._domainLoaded = false;
    
    /**
     * Loads the domain via the underlying connection object and exposes the
     * domain's commands as methods on this object. Assumes the underlying
     * connection has already been opened.
     * 
     * @return {Promise} Resolves once the domain is been loaded.
     * @private
     */
    NodeDomain.prototype._load = function () {
        var connection = this.connection;
        return connection.loadDomains(this._domainPath, true)
            .then(function () {
                this._domainLoaded = true;
                this._connectionPromise = null;
                this.refreshInterface();
            }.bind(this))
            .catch(function (err) {
                console.error("[NodeDomain] Error loading domain \"" + this._domainName + "\": " + err);
            }.bind(this));
    };
    
    /**
     * A NodeDomain listens to all of the events emitted by its underlying
     * NodeConnection instance in order to re-emit them with their original
     * event name (i.e., without the domain prefix). These listers are added
     * when the domain is originally loaded, but event registration can occur
     * at any time. This method is used to add the listeners at the time of 
     * domain loading, but can also be called by clients after executing a
     * command that registers additional event types.
     */
    NodeDomain.prototype.refreshInterface = function () {
        var connection = this.connection,
            eventNames = Object.keys(connection.domainEvents[this._domainName]);

        eventNames.forEach(function (domainEvent) {
            var connectionEvent = this._domainName + ":" + domainEvent,
                listeners = connection.getListeners(connectionEvent);
            
            if (listeners.length === 0) {
                connection.on(connectionEvent, function () {
                    var params = Array.prototype.slice.call(arguments, 0);
                    this.emitEvent(domainEvent, params);
                }.bind(this));
            }
        }, this);
    };

    /**
     * Synchronously determine whether the domain is ready; i.e., whether the
     * connection is open and the domain is loaded.
     * 
     * @return {boolean} Whether or not the domain is currently ready.
     */
    NodeDomain.prototype.ready = function () {
        return this._domainLoaded && this.connection.connected();
    };
    
    /**
     * Get a promise that resolves when the connection is open and the domain
     * is loaded.
     *
     * @return {Promise}
     */
    NodeDomain.prototype.promise = function () {
        if (this._connectionPromise) {
            return this._connectionPromise;
        } else {
            var promise;

            if (this.ready()) {
                promise = Promise.resolve();
            } else {
                promise = Promise.reject();
            }
            
            return promise;
        }
    };
    
    /**
     * Applies the named command from the domain to a list of parameters, which
     * are passed as extra arguments to this method. If the connection is open
     * and the domain is loaded, the function is applied immediately. Otherwise
     * the function is applied as soon as the connection has been opened and the
     * domain has finished loading.
     * 
     * @param {string} name The name of the domain command to execute
     * @return {Promise} Resolves with the result of the command
     */
    NodeDomain.prototype.exec = function (name) {
        var connection = this.connection,
            params = Array.prototype.slice.call(arguments, 1),
            execConnected = function () {
                var domain  = connection.domains[this._domainName],
                    fn      = domain && domain[name],
                    execResult;
        
                if (fn) {
                    execResult = fn.apply(domain, params);
                } else {
                    execResult = Promise.reject();
                }
                return execResult;
            }.bind(this);
        
        var result;
        if (this.ready()) {
            result = execConnected();
        } else if (this._connectionPromise) {
            result = this._connectionPromise.then(execConnected);
        } else {
            result = Promise.reject();
        }
        return result;
    };
        
    module.exports = NodeDomain;
});
