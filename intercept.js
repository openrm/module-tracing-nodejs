const crypto = require('crypto');
const traceAgent = require('@google-cloud/trace-agent');
const { SPAN_KEY, options } = require('./options');
const { inject } = require('./propagation');

const randomSpanId = () => parseInt(crypto.randomBytes(6).toString('hex'), 16).toString();

const newSpan = (spanContext) => {
    if (!spanContext) return null;
    return {
        traceId: spanContext.traceId,
        spanId: randomSpanId(),
        options: spanContext.options
    };
};

const interceptor = (request) => (opts) => {
    const tracer = traceAgent.get();
    const span = tracer.getCurrentRootSpan().getTraceContext()
        || newSpan(options.httpContext.get(SPAN_KEY)); // fallback for occasionally lost contexts

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
