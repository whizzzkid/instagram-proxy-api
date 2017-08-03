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
InstaProxy.REFERER_BLACKLIST = 'www.bnk48.com' +
  'www.likedike.com' +
  'www.flowerwholesale.com' +
  'www.flowers.darwinapps.com' +
  'www.darwinapps.com' +
  'www.potomacfloralwholesale.com' +
  'www.estacaodaluz.com.br' +
  'www.leonidasoy.fi' +
  'www.social.mplaeleicoes2017.com' +
  'www.ofuturocomcerteza.pt' +
'';


/**
 * A simple logging function for consistency.
 * @param {string} msg
 */
InstaProxy.log = function (msg) {
  let time = new Date();
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
    let itemsAvailable = json.items.length;

    // Limiting number of posts as per count parameter.
    if ('count' in request.query) {
      json.items = json.items.slice(0, parseInt(request.query.count, 10));
    }

    // We only need to show next page if we have posts available.
    if (json.items.length > 0) {
      delete request.query['max_id'];
      delete request.query['min_id'];

      let query = {};

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
    let body = '';
    serverResponse.on('data', function (chunk) {
      body += chunk;
    });
    serverResponse.on('end', function () {
      try {
        let json = JSON.parse(body);
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
 * Processing User Request. This works the same way as instagram API.
 * @param {object} request
 * @param {object} response
 */
InstaProxy.processRequest = function (request, response) {
  let user = request.params.user;
  let referer = request.headers.referer;
  if (referer == undefined || referer == 'undefined' ||
      this.REFERER_BLACKLIST.indexOf(url.parse(referer).hostname) == -1) {
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
 * Sets up app routes.
 */
InstaProxy.setUpRoutes = function () {
  this.log('Setting up routes.');
  this.app.get('/favicon.ico', this.noContent);
  this.app.get('/apple-touch-icon.png', this.noContent);
  this.app.get('/:user/media/', this.processRequest.bind(this));
  this.app.get('*', this.sendToRepo);
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

// Init.
InstaProxy.init();