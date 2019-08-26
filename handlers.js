const Sentry = require('@sentry/node');
const { Span } = Sentry;
const { StatusCodeError } = require('request-promise-core');

const { SPAN_KEY, LOGGER_KEY, setOptions, options } = require('./options');
const { loggingHandler, getLogger } = require('./logger');

module.exports = {

    requestHandler: (opts = {}) => {
        const skip = (req) => {
            if (opts.skip) return opts.skip(req);
            return false;
        };

        return (req, res, next) => {
            const trace = req.header(options.traceHeader) || '';
            const span = Span.fromTraceparent(trace) || new Span();

            options.httpContext.set(SPAN_KEY, span);
            req.span = span;

            if (skip(req)) {
                next();
            } else {
                loggingHandler(req, res, next);
            }
        }
    },

    errorHandler: (err, req, res, next) => {
        Sentry.withScope(scope => {
            const span = options.httpContext.get(SPAN_KEY) || req.span;
            if (span) {
                scope.setSpan(span);
            }

            const eventId = Sentry.captureException(err, null, scope);
            res.sentry = { eventId };
        });

        loggingHandler.errorLogger(err, req, res, next);

        if (err instanceof StatusCodeError) {
            const {
                error,
                statusCode,
                options
            } = err;

            res.status(500).send({
                message: `request to ${options.method} ${options.uri} failed with status ${statusCode}`,
                cause: {
                    status: statusCode,
                    error
                }
            });
        }
    }

};
