const httpContext = require('express-http-context');
const Sentry = require('@sentry/node');
const { Span } = Sentry;

const { SPAN_KEY, setOptions, options } = require('./options');

const loggingHandler = require('express-bunyan-logger');

const loggingOptions = {
    logger: require('./logger').logger,
    serializers: {
        req: require('bunyan-express-serializer')
    },
    includesFn: (req, res) => {
        const fields = {};
        const span = httpContext.get(SPAN_KEY) || req.span;
        if (span) {
            Object.assign(fields, {
                spanId: span._spanId,
                traceId: span._traceId
            });
        }
        return fields;
    }
};

module.exports = {

    requestHandler: (req, res, next) => {
        const trace = req.header(options.traceHeader) || '';
        const span = Span.fromTraceparent(trace) || new Span();

        httpContext.set(SPAN_KEY, span);
        req.span = span;
        loggingHandler(loggingOptions)(req, res, next);
    },

    errorHandler: (err, req, res, next) => {
        Sentry.withScope(scope => {
            if (httpContext.get(SPAN_KEY) || req.span) {
                scope.setSpan(httpContext.get(SPAN_KEY) || req.span);
            }

            const eventId = Sentry.captureException(err, null, scope);
            res.sentry = eventId;
        });

        loggingHandler.errorLogger(loggingOptions)(err, req, res, next);
    }

};
