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
const Bloom = require('bloomxx');
const Blacklist = require('./blacklist.js');
const Cors = require('cors');
const DomainParser = require('domain-parser');
const Express = require('express');
const Https = require('https');
const ResponseTime = require('response-time');
const Url = require('url');
const QueryID = '17888483320059182';
const GraphOtions = {
  id: '',
  first: 3,
  after: ''
};

// App Namespace.
const InstaProxy = {};

/** @const */ InstaProxy.DEBUG_MODE = (process.env.NODE_ENV === 'dev');
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


/**
 * A simple logging function for consistency.
 * @param {string} msg
 */
InstaProxy.log = function(msg) {
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
InstaProxy.constructURL = function(protocol, host, path, query) {
  return Url.format({
    'protocol': protocol, 'host': host, 'pathname': path, 'query': query
  });
};


/**
 * Reconstructs JSON as per query parameters.
 * @param {object} request
 * @param {object} json
 * @return {object} new data as per query.
 * @this
 * */
InstaProxy.reconstructJSON = function(request, json) {
  if ('items' in json && json.items.length > 0) {

    // Limiting number of posts as per count parameter.
    if ('count' in request.query) {
      json.items = json.items.slice(0, parseInt(request.query.count, 10));
    }

    // We only need to show next page if we have posts available.
    if (json.items.length > 0) {
      delete request.query['max_id'];
      delete request.query['min_id'];

      var query;

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
 * Perform GQL response reconstruction
 * @param {object} request
 * @param {object} response
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
 * @param {object} request
 * @param {object} response
 * @return {function} callback
 * @this
 */
InstaProxy.instagramHandlerCB = function(request, response) {
  return function(serverResponse) {
    serverResponse.setEncoding('utf8');
    var body = '';
    serverResponse.on('data', function(chunk) {
      body += chunk;
    });
    serverResponse.on('end', function() {
      try {
        var json = JSON.parse(body);
        if (!this.isAdvancedRequestValid(request)) {
          json = this.reconstructJSON(request, json);
        }
        if (request.query.user_id) {
          json = this.reconstructJSONfromGQLResponse(request, json);
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
          this.errorMessageGenerator('Invalid User' + error)
        );
      }
    }.bind(this));
  }.bind(this);
};


/**
 * Fetches content from Instagram API.
 * @param {string} path
 * @param {string} query
 * @param {object} request
 * @param {object} response
 * @this
 */
InstaProxy.fetchFromInstagram = function(path, query, request, response) {
  this.log(
    'Processing [P:"' + path + '", ' +
    'Q:"' + JSON.stringify(query) + ', ' +
    'R:"' + request.headers.referer + '"]');
  Https.get(
    this.constructURL(
      'https', 'www.instagram.com', path, query),
    this.instagramHandlerCB(request, response)
  );
};


/**
 * Detects if the URL is safe based on blacklist.
 * @param {string} urlString
 * @return {boolean} url safe or not.
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
 * Verify the request from blacklist.
 * @param {object} request
 * @return {boolean} safe or not
 * @this
 */
InstaProxy.isRefererSafe = function(request) {
  var referer = request.headers.referer;
  // Undefined refer will only be allowed on Prod.
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
 * @return {object}
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
 * @param {object} request
 * @return {boolean}
 */
InstaProxy.isAdvancedRequestValid = function(request) {
  return ('__a' in request.query &&
    request.query['__a'] === '1' &&
    request.path !== '/'
  );
};


/**
 * Perform fetch from instagram if the referrer is safe.
 * @param {string} path
 * @param {string} query
 * @param {object} request
 * @param {object} response
 * @this
 */
InstaProxy.fetchIfSafe = function(path, query, request, response) {
  if (this.isRefererSafe(request)) {
    this.fetchFromInstagram(path, query, request, response);
  } else {
    this.accessDenied(request, response);
  }
};


/**
 * Processing User Request. This works the same way as instagram API.
 * @param {boolean} checkIfAdvanceRequest
 * @return {function}
 * @this
 */
InstaProxy.processCB = function(checkIfAdvanceRequest) {
  return function(request, response) {
    var path = '';
    if (checkIfAdvanceRequest && this.isAdvancedRequestValid(request)) {
      path = request.params[0];
    } else {
      path = '/' + request.params.user + '/media/';
    }
    this.fetchIfSafe(path, request.query, request, response);
  }.bind(this);
};


/**
 * Processes IG's GQL Queries.
 * @param {object} request
 * @param {object} response
 * @this
 */
InstaProxy.processGQL = function(request, response) {
  // if request has user id
  if (request.query.user_id) {
    // Create a copy
    var variables = Object.assign({}, GraphOtions);
    // Assign values
    variables.id = request.query.user_id;
    if (request.query.count != null) {
      variables.first = request.query.count;
    }
    if (request.query.cursor != null) {
      variables.after = request.query.cursor;
    }
    // Generate query for IG-GQL server.
    var query = {
      query_id: QueryID,
      variables: JSON.stringify(variables)
    };
    // Fetch
    this.fetchIfSafe(request.path, query, request, response);
  }
};


/**
 * Send Response.
 * @param {object} response
 * @param {number} statusCode
 * @param {object} jsonMessage
 */
InstaProxy.respond = function(response, statusCode, jsonMessage) {
  response.status(statusCode).jsonp(jsonMessage).end();
};


/**
 * Access Denied.
 * @param {object} request
 * @param {object} response
 * @this
 */
InstaProxy.accessDenied = function(request, response) {
  this.respond(
    response,
    this.STATUS_CODES.ACCESS_DENIED,
    this.errorMessageGenerator(
      'Denying request from referer: ' + request.headers.referer)
  );
};


/**
 * Sends no content as response.
 * @param {object} request
 * @param {object} response
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
 * @param {object} request
 * @param {object} response
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
 * @param {object} request
 * @param {object} response
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
  this.serve();
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
  this.app.get('/graphql/query/', Cors(), this.processGQL.bind(this));
  this.app.get('/:user/media/', Cors(), this.processCB(false).bind(this));
  this.app.get('*', Cors(), this.processCB(true).bind(this));
  this.setUpFilter();
};


/**
 * Sets Up App Params.
 * @this
 */
InstaProxy.setUpApp = function() {
  this.app = Express();
  this.app.use(ResponseTime());
  this.setUpRoutes();
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
