const Sentry = require('@sentry/node');
const { Span } = require('@sentry/types');
const { StatusCodeError } = require('request-promise-core/errors');
const traceAgent = require('@google-cloud/trace-agent');

const { SPAN_KEY, LOGGER_KEY, setOptions, options } = require('./options');
const { loggingHandler, getLogger } = require('./logger');

const stop = () => {};

module.exports = {

    requestHandler: (opts = {}) => {
        const skip = (req) => {
            if (opts.skip) return opts.skip(req);
            return false;
        };

        return (req, res, next) => {
            if (skip(req)) {
                next();
            } else {
                loggingHandler(req, res, next);
            }
        }
    },

    errorHandler: (opts = {}) => (err, req, res, next) => {
        const _code = parseInt(err.statusCode)
            || parseInt(err.status)
            || parseInt(err.code)
            || 500;
        const code = 100 <= _code && _code < 600 ? _code : 500;

        if (code >= 500) {
            Sentry.withScope(scope => {
                const tracer = traceAgent.get();
                const span = tracer.getCurrentRootSpan().getTraceContext();

                if (span) {
                    try {
                        scope.setSpan(new Span(span.traceId, span.spanId, span.options === 1));
                    } catch {}
                }

                const eventId = Sentry.captureException(err, null, scope);
                res.sentry = { eventId };
            });
        }

        if (opts.respondWithError) {
            if (err instanceof StatusCodeError) {
                // deeper error
                const { error } = err;
                res.status(code < 500 ? code : 500).send(error);
            } else {
                res.status(code).send({
                    message: typeof err === 'string' ? err : err.message || err.name
                });
            }
        }

        loggingHandler.errorLogger(err, req, res, opts.respondWithError ? stop : next);
    }

};
