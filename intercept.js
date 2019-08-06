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

const requestFamily = [
    'request',
    'request-promise',
    'request-promise-native',
    'request-promise-any'
];

const Module = require('module');

const load = Module._load;

Module._load = function(path, parent) {
    if (requestFamily.includes(path) && parent) {
        const original = load.call(this, path, parent);

        const request = original.defaults(interceptor(original));
        request.Request = request;

        return request;
    }
    return load.apply(this, arguments);
};
