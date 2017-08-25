/**
 * This is going to build over the Instagram's public API.
 *
 * Instagram currently allows accessing public posts but misses
 * a lot of functionality like limits, pagination, jsonp, etc.
 * This aims to fix that.
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
 * Handles JSON data fetched from Instagram.
 * @param {object} request
 * @param {object} response
 * @param {object} json
 */
InstaProxy.handleInstagramJSON = function (request, response, json) {
  response.jsonp(this.reconstructJSON(request, json));
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
        this.handleInstagramJSON(request, response, json);
      } catch (error) {
        response.status(404).send('Invalid User').end();
      }
    }.bind(this));
  };
};


/**
 * Fetches content from Instagram API.
 * @param {string} user
 * @param {object} request
 * @param {object} response
 */
InstaProxy.fetchFromInstagram = function (user, request, response) {
  https.get(
    this.constructURL(
      'https', 'www.instagram.com', '/' + user + '/media/', request.query),
    this.buildInstagramHandlerCallback(request, response).bind(this));
};


/**
 * Detects if the URL is safe based on blacklist.
 * @param {string} urlString
 * @return {boolean} url safe or not.
 */
InstaProxy.safeUrl = function (urlString) {
  var hostname = url.parse(urlString).hostname;
  var domain = domainParser(hostname).domainName;
  return !this.filter.has(domain);
}


/**
 * Processing User Request. This works the same way as instagram API.
 * @param {object} request
 * @param {object} response
 */
InstaProxy.processRequest = function (request, response) {
  var user = request.params.user;
  var referer = request.headers.referer;
  if (referer === undefined ||
      referer === 'undefined' ||
      this.safeUrl(referer)) {
    this.log('Processing [User:"' + user + '", ' +
             'Query:"' + JSON.stringify(request.query) + ', ' +
             'Referer:"' + referer + '"]');
    this.fetchFromInstagram(user, request, response);
  } else {
    this.log('Denying access to request from: ' + referer);
    this.accessDenied(request, response);
  }
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
 * Sends User to project repo.
 * @param {object} request
 * @param {object} response
 */
InstaProxy.sendToRepo = function (request, response) {
  response.redirect('https://github.com/whizzzkid/instagram-reverse-proxy');
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
  this.app.get('/:user/media/', cors(), this.processRequest.bind(this));
  this.app.get('*', this.sendToRepo);
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