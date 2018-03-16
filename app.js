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

/**
 * App Namespace
 * @const
 */
const InstaProxy = {
  ALLOW_UNDEFINED_REFERER: false,
  DEBUG_MODE: false || (process.env.NODE_ENV === 'dev'),
  ERROR_LOG_SEVERITY: 2,
  ENABLE_REFERER_CHECK: true,
  FETCH_COUNT_LIMIT: 25,
  GRAPH_PATH: '/graphql/query/',
  GRAPH_USER_QUERY_ID: '17888483320059182',
  GRAPH_TAG_QUERY_ID: '17875800862117404',
  GITHUB_REPO: 'https://github.com/whizzzkid/instagram-reverse-proxy',
  SERVER_PORT: 3000
};

/**
 * Status Codes
 * @enum
 */
InstaProxy.STATUS_CODES = {
  OK: 200,
  NO_CONTENT: 204,
  PERMANENTLY_MOVED: 301,
  ACCESS_DENIED: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500
};

/**
 * Error Messages
 * @enum
 */
InstaProxy.ERROR_MESSAGES = {
  INVALID_QUERY: {
    code: 1,
    sevr: 3,
    desc: 'Invalid Query Parameters Passed.'
  },
  FETCH_FAILED: {
    code: 2,
    sevr: 0,
    desc: 'Failed to fetch from Instagram.'
  },
  NOT_FOUND: {
    code: 3,
    sevr: 3,
    desc: 'The resource requested was not found.'
  },
  REDIRECT: {
    code: 4,
    sevr: 4,
    desc: 'Redirecting...'
  },
  REFERER_DENIED: {
    code: 5,
    sevr: 2,
    desc: 'Referer was denied access.'
  }
};

/**
 * A simple logging function for consistency.
 * @param {String} mesg
 */
InstaProxy.log = function (mesg) {
  let time = new Date();
  console.log('[' + time.toString() + '] ' + mesg);
};

/**
 * Generate error message response object.
 * @param {Object} mesg
 * @param {String} info
 * @return {Object} error response
 * @this
 */
InstaProxy.errorMessageGenerator = function (mesg, info) {
  var response = {
    code: mesg.code,
    desc: mesg.desc,
    info: info
  };

  if (this.DEBUG_MODE && mesg.sevr <= this.ERROR_LOG_SEVERITY) {
    this.log(JSON.stringify(response));
  }

  return response;
};

/**
 * Constructs New Url
 * @param {String} protocol
 * @param {String} host
 * @param {String} path
 * @param {String} query
 * @return {String} new url.
 */
InstaProxy.constructURL = function (protocol, host, path, query) {
  return Url.format({
    'protocol': protocol, 'host': host, 'pathname': path, 'query': query
  });
};

/**
 * Builds the callback function for handling Instagram response.
 * @param {Function} callback
 * @return {Function} callback
 * @this
 */
InstaProxy.instagramFetcher = function (callback) {
  return function (serverResponse) {
    serverResponse.setEncoding('utf8');
    let body = '';
    serverResponse.on('data', function (chunk) {
      body += chunk;
    });
    serverResponse.on('end', function () {
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
InstaProxy.fetchFromInstagram = function (path, query, callback) {
  Https.get(
    this.constructURL(
      'https', 'www.instagram.com', path, query),
    this.instagramFetcher(callback.bind(this))
  );
};

/**
 * Performs fetch from IG's GQL servers.
 * @param {object} param
 * @param {object} request
 * @param {object} response
 * @this
 */
InstaProxy.fetchFromInstagramGQL = function (param, request, response) {
  let queryId;

  if (param.id != null) {
    queryId = this.GRAPH_USER_QUERY_ID;
  } else if (param.tag_name != null) {
    queryId = this.GRAPH_TAG_QUERY_ID;
  } else {
    queryId = '';
  }

  if (queryId !== '') {
    let query = this.generateGraphQLQuery(queryId, param, request);

    let callback = function (body) {
      let json = JSON.parse(body).data;
      if (param.id != null) {
        json = json.user.edge_owner_to_timeline_media;
      } else {
        json = json.hashtag.edge_hashtag_to_media;
      }
      let response = {};
      let query;

      // just copying.
      query = Object.assign({}, request.query);

      if (json.page_info.has_next_page) {
        query.cursor = json.page_info.end_cursor;
        response.next = this.constructURL(
          request.protocol, request.get('host'), request.path, query);
      }

      response.posts = [];
      for (let i in json.edges) {
        response.posts.push(json.edges[i].node);
      }

      return response;
    }.bind(this);

    this.fetchFromInstagram(
      this.GRAPH_PATH,
      query,
      this.callbackWrapper(
        response, this.generateCallBackForWrapper(callback, response)));
  }
};

/**
 * Detects if the URL is safe based on blacklist.
 * @param {String} urlString
 * @return {Boolean} url safe or not.
 * @this
 */
InstaProxy.isNotOnBlackList = function (urlString) {
  return !this.filter.has(
    DomainParser(
      Url.parse(urlString).hostname
    ).domainName
  );
};

/**
 * Check if advanced params are requested.
 * @param {Object} request
 * @param {Object} response
 * @return {Boolean}
 * @this
 */
InstaProxy.isAdvancedRequestValid = function (request, response) {
  if (!('__a' in request.query &&
    request.query.__a === '1' &&
    request.path !== '/'
  )) {
    this.respond(
      response,
      this.STATUS_CODES.NOT_FOUND,
      this.errorMessageGenerator(this.ERROR_MESSAGES.INVALID_QUERY)
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
InstaProxy.generateCallBackForWrapper = function (callback, response) {
  return function (body) {
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
InstaProxy.callbackWrapper = function (response, callback) {
  return function (body) {
    try {
      callback(body);
    } catch (error) {
      this.respond(
        response,
        this.STATUS_CODES.NOT_FOUND,
        this.errorMessageGenerator(
          this.ERROR_MESSAGES.FETCH_FAILED,
          'encountered: ' + error.toString() +
          'fetched:' + body)
      );
    }
  }.bind(this);
};

/**
 * Generates query object for graphQL.
 * @param {string} queryId
 * @param {object} extraParams
 * @param {object} request
 * @return {object} query
 * @this
 */
InstaProxy.generateGraphQLQuery = function (queryId, extraParams, request) {
  let variables = {};

  // Assign values
  variables.first = (request.query.count != null) ?
    Math.min(request.query.count, this.FETCH_COUNT_LIMIT) :
    1;
  if (request.query.cursor != null) {
    variables.after = request.query.cursor;
  }

  for (let i in extraParams) {
    variables[i] = extraParams[i];
  }

  return {
    query_id: queryId,
    variables: JSON.stringify(variables)
  };
};

/**
 * Processing User Request. This works the same way as instagram API.
 * @param {Object} request
 * @param {Object} response
 * @this
 */
InstaProxy.processAdvanceParams = function (request, response) {
  if (this.isAdvancedRequestValid(request, response)) {
    let callback = function (body) {
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
InstaProxy.processGQL = function (request, response) {
  // if request has user id
  if (request.query.user_id) {
    this.fetchFromInstagramGQL(
      { id: request.query.user_id }, request, response);
  }

  if (request.query.tag) {
    this.fetchFromInstagramGQL(
      { tag_name: request.query.tag }, request, response);
  }
};

/**
 * Processing legacy requests. i.e. username/media queries.
 * @param {Object} request
 * @param {Object} response
 * @this
 */
InstaProxy.processLegacy = function (request, response) {
  let callback = function (body) {
    let json = JSON.parse(body);
    this.fetchFromInstagramGQL({ id: json.graphql.user.id }, request, response);
  };
  this.fetchFromInstagram(
    '/' + request.params.username + '/',
    { '__a': 1 },
    this.callbackWrapper(response, callback.bind(this)));
};

/**
 * Process by tagname.
 * @param {object} request
 * @param {object} response
 * @this
 */
InstaProxy.processTagName = function (request, response) {
  this.fetchFromInstagramGQL(
    { tag_name: request.params.tag }, request, response);
};

/**
 * Send Response.
 * @param {Object} response
 * @param {number} statusCode
 * @param {Object} jsonMessage
 */
InstaProxy.respond = function (response, statusCode, jsonMessage) {
  response.status(statusCode).jsonp(jsonMessage).end();
};

/**
 * Sends no content as response.
 * @param {Object} request
 * @param {Object} response
 * @this
 */
InstaProxy.noContent = function (request, response) {
  this.respond(
    response,
    this.STATUS_CODES.NO_CONTENT,
    this.errorMessageGenerator(this.ERROR_MESSAGES.NOT_FOUND, request.path)
  );
};

/**
 * Redirect to Repo.
 * @param {Object} request
 * @param {Object} response
 * @this
 */
InstaProxy.sendToRepo = function (request, response) {
  response.set({
    'location': this.GITHUB_REPO
  });
  this.respond(
    response,
    this.STATUS_CODES.PERMANENTLY_MOVED,
    this.errorMessageGenerator(this.ERROR_MESSAGES.REDIRECT)
  );
};

/**
 * Server Check.
 * @param {Object} request
 * @param {Object} response
 * @this
 */
InstaProxy.serverCheck = function (request, response) {
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
InstaProxy.serve = function () {
  this.log('Starting server.');
  this.app.listen(process.env.PORT || this.SERVER_PORT);
};

/**
 * Verify the request from blacklist.
 * @param {Object} request
 * @param {Object} response
 * @param {Function} next
 * @return {next}
 * @this
 */
InstaProxy.safeRefererMW = function (request, response, next) {
  if (this.ENABLE_REFERER_CHECK) {
    let referer = request.headers.referer;
    let isSafe = (this.DEBUG_MODE || this.ALLOW_UNDEFINED_REFERER) ? (
        referer === undefined ||
        referer === 'undefined' ||
        this.isNotOnBlackList(referer)
      ) : (
        referer !== undefined &&
        referer !== 'undefined' &&
        this.isNotOnBlackList(referer)
      );

    if (!isSafe) {
      return this.respond(
        response,
        this.STATUS_CODES.ACCESS_DENIED,
        this.errorMessageGenerator(
          this.ERROR_MESSAGES.REFERER_DENIED, request.headers.referer)
      );
    }
  }
  this.log(
    'Processing [P:"' + request.path + '", ' +
    'Q:"' + JSON.stringify(request.query) + '", ' +
    'R:"' + request.headers.referer + '"]');
  return next();
};

/**
 * Sets up app routes.
 * @this
 */
InstaProxy.setUpRoutes = function () {
  this.log('Setting up routes.');
  this.app.get('/', this.sendToRepo.bind(this));
  this.app.get('/*.(ico|png|css|html|js)', this.noContent.bind(this));
  this.app.get('/server_check_hook', this.serverCheck.bind(this));
  let routeMap = this.getRouteMap();
  for (let route in routeMap) {
    this.app.get(
      route, this.safeRefererMW.bind(this), routeMap[route].bind(this));
  }

  // serve
  this.serve();
};

/**
 * Gets the route map.
 * @return {object} map
 * @this
 */
InstaProxy.getRouteMap = function () {
  return {
    '/graphql/query/': this.processGQL,
    '/:username/media/': this.processLegacy,
    '/explore/tags/:tag/media/': this.processTagName,
    '*': this.processAdvanceParams
  };
};

/**
 * Bloom Filter implementation for blacklisted domains.
 * @this
 */
InstaProxy.setUpFilter = function () {
  this.log('Setting Up Filters');
  this.filter = Bloom.BloomFilter.createOptimal(Blacklist.list.length);
  for (let i in Blacklist.list) {
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
InstaProxy.setUpApp = function () {
  this.app = Express();
  this.app.use(ResponseTime());
  this.app.use(Cors());
  this.setUpFilter();
};

/**
 * Init Method.
 * @this
 */
InstaProxy.init = function () {
  this.log('Initializing.');
  this.setUpApp();
};

// Init.
InstaProxy.init();
