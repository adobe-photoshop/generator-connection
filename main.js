/*
 * Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
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

define(function (require, exports) {
    "use strict";

    /**
     * This helper function will convert a generator domain name into
     * the key that is used to store its custom preferences in photoshop.
     *
     * This assumes that the plugin registered a domain
     * with the same name as the plugin itself
     *
     * The replacement logic must match generator-core
     * See: generator's escapePluginId() function
     *
     * @param {string} domainName
     * @return {string}
     */
    exports.domainPrefKey = function (domainName) {
        return domainName && domainName.replace(/[^a-zA-Z0-9]/g, function (char) {
            return "_" + char.charCodeAt(0) + "_";
        });
    };

    exports.NodeDomain = require("./lib/NodeDomain");
    exports.NodeConnection = require("./lib/NodeConnection");
});
