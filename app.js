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
InstaProxy.SERVER_PORT = 3000;
InstaProxy.PROTOCOL = (process.env.NODE_ENV === 'prod') ? 'https' : 'http';


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
InstaProxy.buildInstagramHandlerCallback = function (request, response) {
  return function (serverResponse) {
    serverResponse.setEncoding('utf8');
    var body = '';
    serverResponse.on('data', function (chunk) {
      body += chunk;
    });
    serverResponse.on('end', function () {
      try {
        var json = JSON.parse(body);
        if (!this.isAdvancedRequest(request)) {
          json = this.reconstructJSON(request, json);
        }
        response.jsonp(json).end();
      } catch (error) {
        this.log(error);
        response.status(404).send('Invalid User').end();
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
InstaProxy.fetchFromInstagramCallback = function (path, request, response) {
  return function () {
    this.log(
      'Processing [P:"' + path + '", ' +
      'Q:"' + JSON.stringify(request.query) + ', ' +
      'R:"' + request.headers.referer + '"]');
    https.get(
      this.constructURL(
        'https', 'www.instagram.com', path, request.query),
      this.buildInstagramHandlerCallback(request, response));
  }.bind(this);
};


/**
 * Detects if the URL is safe based on blacklist.
 * @param {string} urlString
 * @return {boolean} url safe or not.
 */
InstaProxy.safeUrl = function (urlString) {
  return !this.filter.has(
    domainParser(
      url.parse(urlString).hostname
    ).domainName
  );
};


/**
 * Verify the request from blacklist.
 * @param {object} request
 * @param {object} response
 * @param {function} callback
 * @return {function}
 */
InstaProxy.validateReferrer = function (request, response, callback) {
  var referer = request.headers.referer;
  if (referer === undefined ||
      referer === 'undefined' ||
      this.safeUrl(referer)) {
    return callback();
  } else {
    this.log('Denying access to request from: ' + referer);
    this.accessDenied(request, response);
  }
};


/**
 * Check if advanced params are requested.
 * @param {object} request
 * @return {boolean}
 */
InstaProxy.isAdvancedRequest = function (request) {
  return ('__a' in request.query && '__a' === "1");
}


/**
 * Processing requests with advanced params.
 * @param {object} request
 * @param {object} response
 */
InstaProxy.checkAdvancedRequest = function (request, response) {
  if (this.isAdvancedRequest) {
    this.validateReferrer(
      request,
      response,
      this.fetchFromInstagramCallback(request.params[0], request, response)
    );
  } else {
    response.redirect('https://github.com/whizzzkid/instagram-reverse-proxy');
  }
};


/**
 * Processing User Request. This works the same way as instagram API.
 * @param {object} request
 * @param {object} response
 */
InstaProxy.processRequest = function (request, response) {
  var user = request.params.user;
  this.validateReferrer(
    request,
    response,
    this.fetchFromInstagramCallback('/' + user + '/media/', request, response)
  );
};


/**
 * Access Denied.
 * @param {object} request
 * @param {object} response
 */
InstaProxy.accessDenied = function (request, response) {
  response.status(403).end(
    'Your website is blackListed. Contact me@nishantarora.in for more info.');
};


/**
 * Sends no content as response.
 * @param {object} request
 * @param {object} response
 */
InstaProxy.noContent = function (request, response) {
  response.status(204).end();
};


/**
 * Server Check
 * @param {object} request
 * @param {object} response
 */
InstaProxy.serverCheck = function (request, response) {
  response.jsonp({ok: true}).end();
};


/**
 * Run server.
 */
InstaProxy.serve = function () {
  this.log('Starting server.');
  this.app.listen(process.env.PORT || this.SERVER_PORT);
};


/**
 * Bloom Filter implementation for blacklisting domains.
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
  this.app.get('/favicon.ico', this.noContent);
  this.app.get('/apple-touch-icon.png', this.noContent);
  this.app.get('/server_check_hook', this.serverCheck);
  this.app.get('/:user/media/', cors(), this.processRequest.bind(this));
  this.app.get('*', cors(), this.checkAdvancedRequest.bind(this));
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