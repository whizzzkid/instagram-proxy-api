/**
 * This is going to build over the Instagram's public API.
 *
 * Instagram currently allows accessing public posts but misses a lot of
 * functionality like limits, pagination, jsonp, etc. This aims to fix that.
 *
 * @author me@nishantarora.in (Nishant Arora)
 */

'use strict';

// Imports.
const bloom = require('bloomxx');
const blacklist = require('./blacklist.js');
const cors = require('cors');
const domainParser = require('domain-parser');
const express = require('express');
const https = require('https');
const responseTime = require('response-time');
const url = require('url');

// App Namespace.
let InstaProxy = {};

// Constants
InstaProxy.DEBUG_MODE = false;
InstaProxy.GITHUB_REPO = 'https://github.com/whizzzkid/instagram-reverse-proxy';
InstaProxy.PROTOCOL = (process.env.NODE_ENV === 'prod') ? 'https' : 'http';
InstaProxy.SERVER_PORT = 3000;
InstaProxy.STATUS_CODES = {
  OK: 200,
  NO_CONTENT: 204,
  PERMANENTLY_MOVED: 301,
  ACCESS_DENIED: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500
};


/**
 * A simple logging function for consistency.
 * @param {string} msg
 */
InstaProxy.log = function (msg) {
  var time = new Date();
  console.log('[' + time.toString() + '] ' + msg);
};


/**
 * Constructs New Url
 * @param {string} protocol
 * @param {string} host
 * @param {string} path
 * @param {string} query
 * @return {string} new url.
 */
InstaProxy.constructURL = function (protocol, host, path, query) {
  return url.format({
    'protocol': protocol, 'host': host, 'pathname': path, 'query': query
  });
};


/**
 * Reconstructs JSON as per query parameters.
 * @param {object} request
 * @param {object} json
 * @return {object} new data as per query.
 */
InstaProxy.reconstructJSON = function (request, json) {
  if ('items' in json && json.items.length > 0) {
    var itemsAvailable = json.items.length;

    // Limiting number of posts as per count parameter.
    if ('count' in request.query) {
      json.items = json.items.slice(0, parseInt(request.query.count, 10));
    }

    // We only need to show next page if we have posts available.
    if (json.items.length > 0) {
      delete request.query['max_id'];
      delete request.query['min_id'];

      var query = {};

      // just copying.
      query = Object.assign({}, request.query);
      query['max_id'] = json.items[json.items.length - 1]['id'];
      json['next'] = this.constructURL(
          this.PROTOCOL, request.get('host'), request.path, query);

      // just copying.
      query = Object.assign({}, request.query);
      query['min_id'] = json.items[0]['id'];
      json['previous'] = this.constructURL(
          this.PROTOCOL, request.get('host'), request.path, query);
    }
  }
  return json;
};


/**
 * Builds the callback function for handling Instagram response.
 * @param {object} request
 * @param {object} response
 * @return {function} callback
 */
InstaProxy.instagramHandlerCB = function (request, response) {
  return function (serverResponse) {
    serverResponse.setEncoding('utf8');
    var body = '';
    serverResponse.on('data', function (chunk) {
      body += chunk;
    });
    serverResponse.on('end', function () {
      try {
        var json = JSON.parse(body);
        if (!this.isAdvancedRequestValid(request)) {
          json = this.reconstructJSON(request, json);
        }
        this.respond(
          response,
          this.STATUS_CODES.OK,
          json
        );
      } catch (error) {
        this.respond(
          response,
          this.STATUS_CODES.NOT_FOUND,
          this.errorMessageGenerator('Invalid User')
        );
      }
    }.bind(this));
  }.bind(this);
};


/**
 * Fetches content from Instagram API.
 * @param {string} user
 * @param {object} request
 * @param {object} response
 */
InstaProxy.fetchFromInstagram = function (path, request, response) {
  this.log(
    'Processing [P:"' + path + '", ' +
    'Q:"' + JSON.stringify(request.query) + ', ' +
    'R:"' + request.headers.referer + '"]');
  https.get(
    this.constructURL(
      'https', 'www.instagram.com', path, request.query),
    this.instagramHandlerCB(request, response));
};


/**
 * Detects if the URL is safe based on blacklist.
 * @param {string} urlString
 * @return {boolean} url safe or not.
 */
InstaProxy.isNotOnBlackList = function (urlString) {
  return !this.filter.has(
    domainParser(
      url.parse(urlString).hostname
    ).domainName
  );
};


/**
 * Verify the request from blacklist.
 * @param {object} request
 * @return {boolean} safe or not
 */
InstaProxy.isReferrerSafe = function (request) {
  var referer = request.headers.referer;
  // Undefined refer will only be allowed in debug mode.
  if (this.DEBUG_MODE) {
    return (
      referer === undefined ||
      referer === 'undefined' ||
      this.isNotOnBlackList(referer)
    );
  }

  return (
    referer !== undefined &&
    referer !== 'undefined' &&
    this.isNotOnBlackList(referer)
  );
};


/**
 * Generate error message response object.
 * @param {string} error
 * @returns {object}
 */
InstaProxy.errorMessageGenerator = function (error) {
  if (this.DEBUG_MODE) {
    this.log(error);
  }

  return {
    'error': error
  };
};


/**
 * Check if advanced params are requested.
 * @param {object} request
 * @return {boolean}
 */
InstaProxy.isAdvancedRequestValid = function (request) {
  return ('__a' in request.query &&
    request.query['__a'] === '1' &&
    request.path !== '/'
  );
}


/**
 * Processing User Request. This works the same way as instagram API.
 * @param {boolean} checkAdvance
 * @returns {function}
 */
InstaProxy.processCB = function (checkAdvance) {
  return function (request, response) {
    var path = '';
    if (checkAdvance && this.isAdvancedRequestValid(request)) {
      path = request.params[0];
    } else {
      path = '/' + request.params.user + '/media/';
    }

    if (this.isReferrerSafe(request)) {
      this.fetchFromInstagram(path, request, response);
    } else {
      this.accessDenied(request, response);
    }
  }.bind(this);
};


/**
 * Send Response.
 * @param {object} response
 * @param {integer} statusCode
 * @param {object} jsonMessage
 */
InstaProxy.respond = function (response, statusCode, jsonMessage) {
  response.status(statusCode).jsonp(jsonMessage).end();
};


/**
 * Access Denied.
 * @param {object} request
 * @param {object} response
 */
InstaProxy.accessDenied = function (request, response) {
  this.respond(
    response,
    this.STATUS_CODES.ACCESS_DENIED,
    this.errorMessageGenerator(
      'Denying access to request from referer: ' + request.headers.referer)
  );
};


/**
 * Sends no content as response.
 * @param {object} request
 * @param {object} response
 */
InstaProxy.noContent = function (request, response) {
  this.respond(
    response,
    this.STATUS_CODES.NO_CONTENT,
    this.errorMessageGenerator(request.path + ' Not Found')
  );
};


/**
 * Server Check
 * @param {object} request
 * @param {object} response
 */
InstaProxy.serverCheck = function (request, response) {
  this.respond(
    response,
    this.STATUS_CODES.OK,
    { ok: true }
  )
};


/**
 * Run server.
 */
InstaProxy.serve = function () {
  this.log('Starting server.');
  this.app.listen(process.env.PORT || this.SERVER_PORT);
};


/**
 * Bloom Filter implementation for blacklisted domains.
 */
InstaProxy.setUpFilter = function () {
  this.log('Setting Up Filters');
  this.filter = bloom.BloomFilter.createOptimal(blacklist.list.length);
  for (var i in blacklist.list) {
    this.filter.add(blacklist.list[i]);
  }
  this.serve();
};


/**
 * Sets up app routes.
 */
InstaProxy.setUpRoutes = function () {
  this.log('Setting up routes.');
  this.app.get('/*\.(ico|png|css|html|js)', this.noContent.bind(this));
  this.app.get('/server_check_hook', this.serverCheck.bind(this));
  this.app.get('/:user/media/', cors(), this.processCB(false).bind(this));
  this.app.get('*', cors(), this.processCB(true).bind(this));
  this.setUpFilter();
};


/**
 * Sets Up App Params.
 */
InstaProxy.setUpApp = function () {
  this.app = express();
  this.app.use(responseTime());
  this.setUpRoutes();
};

/**
 * Init Method.
 */
InstaProxy.init = function () {
  this.log('Initializing.');
  this.setUpApp();
};

// Init.
InstaProxy.init();