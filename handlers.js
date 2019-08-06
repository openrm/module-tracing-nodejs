const httpContext = require('express-http-context');
const Sentry = require('@sentry/node');
const { Span } = Sentry;

const { SPAN_KEY, setOptions, options } = require('./options');

module.exports = {

    requestHandler: (req, res, next) => {
        const trace = req.header(options.traceHeader) || '';
        const span = Span.fromTraceparent(trace) || new Span();

        httpContext.set(SPAN_KEY, span);
        req.span = span;
        next();
    },

    errorHandler: (err, req, res, next) => {
        Sentry.withScope(scope => {
            if (httpContext.get(SPAN_KEY) || req.span) {
                scope.setSpan(httpContext.get(SPAN_KEY) || req.span);
            }

            const eventId = Sentry.captureException(err, null, scope);
            res.sentry = eventId;

            next(err);
        });
    }

};
