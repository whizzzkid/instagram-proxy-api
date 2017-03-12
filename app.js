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
const https = require('https');
const express = require('express');
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
    'protocol': protocol,
    'host': host,
    'pathname': path,
    'query': query
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
      this.handleInstagramJSON(request, response, JSON.parse(body));
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
 * Processing User Request. This works the same way as instagram API.
 * @param {object} request
 * @param {object} response
 */
InstaProxy.processRequest = function (request, response) {
    var user = request.params.user;
    this.log('Processing User: ' + user + ' ' + JSON.stringify(request.query));
    this.fetchFromInstagram(user, request, response);
};


/**
 * Sends no content as response.
 * @param {object} request
 * @param {object} response
 */
InstaProxy.noContent = function (request, response) {
  response.send(204);
};


/**
 * Sets up app routes.
 */
InstaProxy.setUpRoutes = function () {
  this.log('Setting up routes.')
  this.app.get('/favicon.ico', this.noContent);
  this.app.get('/apple-touch-icon.png', this.noContent);
  this.app.get('/:user/media/', this.processRequest.bind(this));
};


/**
 * Run server.
 */
InstaProxy.serve = function () {
  this.log('Starting server.');
  this.app.listen(process.env.PORT || this.SERVER_PORT);
};


/**
 * Init Method.
 */
InstaProxy.init = function () {
  this.log('Initializing.');
  this.app = express();
  this.setUpRoutes();
  this.serve();
};

// Init
InstaProxy.init();