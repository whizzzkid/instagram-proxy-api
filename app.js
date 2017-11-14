/**
 * This is going to build over the Instagram's public API.
 *
 * Instagram currently allows accessing public posts but misses a lot of
 * functionality like limits, pagination, jsonp, etc. This aims to fix that.
 *
 * @author me@nishantarora.in (Nishant Arora)
 */

/* jshint esversion: 6 */
/* jshint node: true */
'use strict';

// Imports.
const Bloom = require('bloomxx');
const Blacklist = require('./blacklist.js');
const Cors = require('cors');
const DomainParser = require('domain-parser');
const Express = require('express');
const Https = require('https');
const ResponseTime = require('response-time');
const Url = require('url');

// App Namespace.
const InstaProxy = {};

/** @const */ InstaProxy.DEBUG_MODE = (process.env.NODE_ENV === 'dev');
/** @const */ InstaProxy.ALLOW_UNDEFINED_REFERRERS = true;
/** @const */ InstaProxy.GITHUB_REPO =
  'https://github.com/whizzzkid/instagram-reverse-proxy';
/** @const */ InstaProxy.PROTOCOL = (InstaProxy.DEBUG_MODE) ?
  'http' : 'https';
/** @const */ InstaProxy.SERVER_PORT = 3000;
/** @const */ InstaProxy.STATUS_CODES = {
  OK: 200,
  NO_CONTENT: 204,
  PERMANENTLY_MOVED: 301,
  ACCESS_DENIED: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500
};
/** @const */ InstaProxy.GRAPH_OPTIONS = {
  id: '',
  first: 3,
  after: ''
};
/** @const */ InstaProxy.GRAPH_PATH = '/graphql/query/';
/** @const */ InstaProxy.GRAPH_QUERY_ID = '17888483320059182';


/**
 * A simple logging function for consistency.
 * @param {String} msg
 */
InstaProxy.log = function(msg) {
  var time = new Date();
  console.log('[' + time.toString() + '] ' + msg);
};


/**
 * Constructs New Url
 * @param {String} protocol
 * @param {String} host
 * @param {String} path
 * @param {String} query
 * @return {String} new url.
 */
InstaProxy.constructURL = function(protocol, host, path, query) {
  return Url.format({
    'protocol': protocol, 'host': host, 'pathname': path, 'query': query
  });
};


/**
 * Perform GQL response reconstruction
 * @param {Object} request
 * @param {Object} json
 * @return {Object} json response
 * @this
 */
InstaProxy.reconstructJSONfromGQLResponse = function(request, json) {
  json = json.data.user.edge_owner_to_timeline_media;
  var response = {};
  var query;

  // just copying.
  query = Object.assign({}, request.query);

  if (json.page_info.has_next_page) {
    query['cursor'] = json.page_info.end_cursor;
    response['next'] = this.constructURL(
      this.PROTOCOL, request.get('host'), request.path, query);
  }

  response.images = [];
  for (var i in json.edges) {
    response.images.push(json.edges[i].node);
  }

  return response;
};


/**
 * Builds the callback function for handling Instagram response.
 * @param {Function} callback
 * @return {Function} callback
 * @this
 */
InstaProxy.instagramFetcher = function(callback) {
  return function(serverResponse) {
    serverResponse.setEncoding('utf8');
    var body = '';
    serverResponse.on('data', function(chunk) {
      body += chunk;
    });
    serverResponse.on('end', function() {
      callback(body);
    });
  };
};


/**
 * Fetches content from Instagram API.
 * @param {String} path
 * @param {String} query
 * @param {Function} callback
 * @this
 */
InstaProxy.fetchFromInstagram = function(path, query, callback) {
  this.log(
    'Processing [P:"' + path + '", ' +
    'Q:"' + JSON.stringify(query) + '"]');
  Https.get(
    this.constructURL(
      'https', 'www.instagram.com', path, query),
    this.instagramFetcher(callback.bind(this))
  );
};


/**
 * Detects if the URL is safe based on blacklist.
 * @param {String} urlString
 * @return {Boolean} url safe or not.
 * @this
 */
InstaProxy.isNotOnBlackList = function(urlString) {
  return !this.filter.has(
    DomainParser(
      Url.parse(urlString).hostname
    ).domainName
  );
};


/**
 * Generate error message response object.
 * @param {String} error
 * @return {Object}
 * @this
 */
InstaProxy.errorMessageGenerator = function(error) {
  if (this.DEBUG_MODE) {
    this.log(error);
  }

  return {
    'error': error
  };
};


/**
 * Check if advanced params are requested.
 * @param {Object} request
 * @param {Object} response
 * @return {Boolean}
 * @this
 */
InstaProxy.isAdvancedRequestValid = function(request, response) {
  if (!('__a' in request.query &&
    request.query['__a'] === '1' &&
    request.path !== '/'
  )) {
    this.respond(
      response,
      this.STATUS_CODES.NOT_FOUND,
      this.errorMessageGenerator('Invalid Query Parameters.')
    );
    return false;
  }
  return true;
};


/**
 * Generates a generic callback to be used along the wrapper.
 * @param {Function} callback
 * @param {Object} response
 * @return {Function} callback
 * @this
 */
InstaProxy.generateCallBackForWrapper = function(callback, response) {
  return function(body) {
    this.respond(
      response,
      this.STATUS_CODES.OK,
      callback(body)
    );
  }.bind(this);
};


/**
 * Wraps the callback in a try-catch callback.
 * @param {Object} response
 * @param {Function} callback
 * @return {Function} callback
 * @this
 */
InstaProxy.callbackWrapper = function(response, callback) {
  return function(body) {
    try {
      callback(body);
    } catch (error) {
      this.respond(
        response,
        this.STATUS_CODES.NOT_FOUND,
        this.errorMessageGenerator(error.toString())
      );
    }
  }.bind(this);
};


/**
 * Processing users by ID from the graph
 * @param {Number} userId
 * @param {Object} request
 * @param {Object} response
 * @this
 */
InstaProxy.processByUserId = function(userId, request, response) {
  // Create a copy
  var variables = Object.assign({}, this.GRAPH_OPTIONS);
  // Assign values
  variables.id = userId;
  if (request.query.count != null) {
    variables.first = request.query.count;
  }
  if (request.query.cursor != null) {
    variables.after = request.query.cursor;
  }
  // Generate query for IG-GQL server.
  var query = {
    query_id: this.GRAPH_QUERY_ID,
    variables: JSON.stringify(variables)
  };
  // Fetch
  var callback = function(body) {
    return this.reconstructJSONfromGQLResponse(request, JSON.parse(body));
  }.bind(this);

  this.fetchFromInstagram(
    this.GRAPH_PATH,
    query,
    this.callbackWrapper(
      response, this.generateCallBackForWrapper(callback, response)));
};


/**
 * Processing User Request. This works the same way as instagram API.
 * @param {Object} request
 * @param {Object} response
 * @this
 */
InstaProxy.processAdvanceParams = function(request, response) {
  if (this.isAdvancedRequestValid(request, response)) {
      var callback = function(body) {
        return JSON.parse(body);
      };
      this.fetchFromInstagram(
        request.params[0],
        request.query,
        this.callbackWrapper(
          response, this.generateCallBackForWrapper(callback, response)));
  }
};


/**
 * Processes IG's GQL Queries.
 * @param {Object} request
 * @param {Object} response
 * @this
 */
InstaProxy.processGQL = function(request, response) {
  // if request has user id
  if (request.query.user_id) {
    this.processByUserId(request.query.user_id, request, response);
  }
};


/**
 * Processing legacy requests. i.e. username/media queries.
 * @param {Object} request
 * @param {Object} response
 * @this
 */
InstaProxy.processLegacy = function(request, response) {
  var callback = function(body) {
    var json = JSON.parse(body);
    this.processByUserId(json.user.id, request, response);
  };
  this.fetchFromInstagram(
    '/' + request.params.username + '/',
    { '__a': 1 },
    this.callbackWrapper(response, callback.bind(this)));
};

/**
 * Send Response.
 * @param {Object} response
 * @param {number} statusCode
 * @param {Object} jsonMessage
 */
InstaProxy.respond = function(response, statusCode, jsonMessage) {
  response.status(statusCode).jsonp(jsonMessage).end();
};


/**
 * Sends no content as response.
 * @param {Object} request
 * @param {Object} response
 * @this
 */
InstaProxy.noContent = function(request, response) {
  this.respond(
    response,
    this.STATUS_CODES.NO_CONTENT,
    this.errorMessageGenerator(request.path + ' Not Found')
  );
};


/**
 * Redirect to Repo.
 * @param {Object} request
 * @param {Object} response
 * @this
 */
InstaProxy.sendToRepo = function(request, response) {
  response.set({
    'location': this.GITHUB_REPO
  });
  this.respond(
    response,
    this.STATUS_CODES.PERMANENTLY_MOVED,
    this.errorMessageGenerator('Redirecting')
  );
};


/**
 * Server Check.
 * @param {Object} request
 * @param {Object} response
 * @this
 */
InstaProxy.serverCheck = function(request, response) {
  this.respond(
    response,
    this.STATUS_CODES.OK,
    { ok: true }
  );
};


/**
 * Run server.
 * @this
 */
InstaProxy.serve = function() {
  this.log('Starting server.');
  this.app.listen(process.env.PORT || this.SERVER_PORT);
};


/**
 * Verify the request from blacklist.
 * @param {Object} request
 * @param {Object} response
 * @param {Function} next
 * @this
 */
InstaProxy.safeRefererMW = function(request, response, next) {
  var referer = request.headers.referer;
  var isSafe = (this.DEBUG_MODE || this.ALLOW_UNDEFINED_REFERRERS) ? (
    referer === undefined ||
    referer === 'undefined' ||
    this.isNotOnBlackList(referer)
  ) : (
    referer !== undefined &&
    referer !== 'undefined' &&
    this.isNotOnBlackList(referer)
  );

  if (!isSafe) {
    this.respond(
      response,
      this.STATUS_CODES.ACCESS_DENIED,
      this.errorMessageGenerator(
        'Denying request from referer: ' + request.headers.referer)
    );
  } else {
    next();
  }
};


/**
 * Sets up app routes.
 * @this
 */
InstaProxy.setUpRoutes = function() {
  this.log('Setting up routes.');
  this.app.get('/', this.sendToRepo.bind(this));
  this.app.get('/*\.(ico|png|css|html|js)', this.noContent.bind(this));
  this.app.get('/server_check_hook', this.serverCheck.bind(this));

  // Graph Queries
  this.app.get(
    '/graphql/query/',
    this.safeRefererMW.bind(this),
    this.processGQL.bind(this));

  // Legacy requests
  this.app.get(
    '/:username/media/',
    this.safeRefererMW.bind(this),
    this.processLegacy.bind(this));

    // remining, including advanced params
  this.app.get(
    '*',
    this.safeRefererMW.bind(this),
    this.processAdvanceParams.bind(this));

  // serve
  this.serve();
};


/**
 * Bloom Filter implementation for blacklisted domains.
 * @this
 */
InstaProxy.setUpFilter = function() {
  this.log('Setting Up Filters');
  this.filter = Bloom.BloomFilter.createOptimal(Blacklist.list.length);
  for (var i in Blacklist.list) {
    // Probably just being paranoid here.
    if (Blacklist.list.hasOwnProperty(i)) {
      this.filter.add(Blacklist.list[i]);
    }
  }
  this.setUpRoutes();
};


/**
 * Sets Up App Params.
 * @this
 */
InstaProxy.setUpApp = function() {
  this.app = Express();
  this.app.use(ResponseTime());
  this.app.use(Cors());
  this.setUpFilter();
};


/**
 * Init Method.
 * @this
 */
InstaProxy.init = function() {
  this.log('Initializing.');
  this.setUpApp();
};

// Init.
InstaProxy.init();
