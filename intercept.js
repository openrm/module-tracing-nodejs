const traceAgent = require('@google-cloud/trace-agent');
const { options } = require('./options');
const { inject } = require('./propagation');

const interceptor = (request) => (opts) => {
    const tracer = traceAgent.get();
    const span = tracer.getCurrentRootSpan().getTraceContext();

    if (span) {
        const setter = {
            setHeader: (key, value) => {
                opts.headers = { ...opts.headers, [key]: value };
            }
        };
        inject(setter, span);
    }

    return request(opts);
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
