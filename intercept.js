const httpContext = require('express-http-context');

const { SPAN_KEY, options } = require('./options');

const interceptor = (request) => (opts) => {
    const span = httpContext.get(SPAN_KEY);

    if (!span) return request(opts);

    return request({
        ...opts,
        headers: {
            ...opts.headers,
            [options.traceHeader]: span.toTraceparent()
        }
    });
};

/*
 * Register interceptor globally
 */

const Module = require('module');

const _request = require('request');
const _load = Module._load;

Module._load = function(path, parent) {
    if (path === 'request' && parent) {
        const request = _request.defaults(interceptor(_request));
        request.Request = _request.Request;

        return request;
    }
    return _load.apply(this, arguments);
};
