const Sentry = require('@sentry/node');
const { Span } = Sentry;
const { StatusCodeError } = require('request-promise-core/errors');

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
        Sentry.withScope(scope => {
            const span = options.httpContext.get(SPAN_KEY) || req.span;
            if (span) {
                scope.setSpan(span);
            }

            const eventId = Sentry.captureException(err, null, scope);
            res.sentry = { eventId };
        });

        if (opts.respondWithError) {
            if (err instanceof StatusCodeError) {
                const {
                    error,
                    statusCode
                } = err;

                res.status(statusCode < 500 ? statusCode : 500).send(error);
            } else {
                res.status(err.statusCode || err.code || 500).send({
                    message: typeof err === 'string' ? err : err.message
                });
            }
        }

        loggingHandler.errorLogger(err, req, res, opts.respondWithError ? stop : next);
    }

};
