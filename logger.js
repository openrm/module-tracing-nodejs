const bunyan = require('bunyan');
const morgan = require('morgan');
const util = require('util');
const traceAgent = require('@google-cloud/trace-agent');
const { LoggingBunyan, LOGGING_TRACE_KEY } = require('@google-cloud/logging-bunyan');

const { LOGGER_KEY, SPAN_KEY, options, mask } = require('./options');
const propagation = require('./propagation');

const logging = new LoggingBunyan();

const defaultOptions = () => ({
    name: options.service.name || 'default',
    version: options.service.version,
    streams: [
        options.enableStackdriver ?
        logging.stream('info') : { level: 'info', stream: process.stdout }
    ],
    serializers: {
        errTimeout: bunyan.stdSerializers.err,
        err: bunyan.stdSerializers.err
    }
});

let defaultLogger, formatter;

const getFormatter = () => {
    if (formatter) return formatter;
    formatter = morgan.compile(options.logFormat);
    return formatter;
};

const truncate = (object, opts = { maxLengthString: 1000 }) => {

    if (typeof object === 'string') {
        if (object.length > opts.maxLengthString) {
            return object.substring(0, 50) + ` ... ${object.length - 50} more characters`;
        }
    }

    if (object && typeof object === 'object') {
        Object.keys(object).forEach(key => {
            object[key] = truncate(object[key], opts);
        });

        return object;
    }

    return object;

};

const inspect = (data, opts) => data && util.inspect(truncate(data, opts), opts);

const stringifySpan = (span) => ({
    parent: span._parent && stringifySpan(span._parent),
    spanId: span._spanId,
    traceId: span._traceId
});

const formatTrace = (agent) => {
    if (!agent || !agent.getCurrentContextId || !agent.getWriterProjectId) {
        return null;
    }
    const traceId = agent.getCurrentContextId();
    if (!traceId) {
        return null;
    }
    const traceProjectId = agent.getWriterProjectId();
    if (!traceProjectId) {
        return null;
    }
    return `projects/${traceProjectId}/traces/${traceId}`;
};

const baseLoggingHandler = (err, req, res, next) => {

    if (err) {
        req._thrown = true;
    }

    const start = process.hrtime();

    let localLogger = defaultLogger;

    const tracer = traceAgent.get();

    const rootSpan = propagation.extract({ getHeader: req.header.bind(req) });
    options.httpContext.set(SPAN_KEY, rootSpan);

    localLogger = logger.child({
        span: {
            ...tracer.getCurrentRootSpan().getTraceContext(),
            parent: rootSpan
        },
        [LOGGING_TRACE_KEY]: formatTrace(tracer)
    });

    options.httpContext.set(LOGGER_KEY, localLogger);
    req.logger = localLogger;

    const log = {
        ip: req.ip || '127.0.0.1',
        remoteAdress: req.connection.remoteAddress,
        remotePort: req.connection.remotePort,
        protocol: `${req.protocol}/${req.httpVersion}`,
        method: req.method,
        url: req.originalUrl || req.url,
        query: req.query,
        referer: req.header('Referrer') || req.header('Referer'),
        userAgent: req.header('User-Agent'),
        body: inspect(req.body && JSON.parse(JSON.stringify(req.body)), options.bodyInspectOptions),
        headers: req.headers,
    };

    let logged = false, timedout;

    const listener = () => {

        // When failed, skip regular logging
        if (logged || req._thrown && !err) return;

        if (!timedout) {
            logged = true;

            res.removeListener('finish', listener);
            res.removeListener('close', listener);
        }

        const [s, ns] = process.hrtime(start);
        const responseTime = (s * 1e9 + ns) / 1e6; // ms

        Object.assign(log, {
            locals: truncate(res.locals),
            params: req.params,
            user: req.user,
            cookies: req.cookies,
            fields: req.fields,
            files: inspect(req.files),
            status: res.statusCode,
            responseTime,
            responseHeaders: res.getHeaders(),
            responseContentLength: res.getHeader('Content-Length'),
            sentry: res.sentry,
            errTimeout: timedout,
            err
        });

        Object.assign(log, {
            httpRequest: {
                remoteIp: log.ip,
                status: log.status,
                requestUrl: log.url,
                requestMethod: log.method,
                requestSize: req.header('Content-Length'),
                responseSize: log.responseContentLength,
                referer: log.referer,
                protocol: log.protocol,
                userAgent: log.userAgent,
                latency: {
                    seconds: s,
                    nanos: ns
                }
            }
        });

        const utils = { mask };

        try {
            options.beforeOutput(log, utils);
        } catch (e) {
            return localLogger.error(e);
        }

        const levelLogger = localLogger[level(res, err, timedout)];
        levelLogger.call(localLogger, log, getFormatter()(morgan, req, res));

    };

    res.on('finish', listener);
    res.on('close', listener);

    const timeoutListener = () => {
        timedout = new Error(`Response time exceeded the limit: ${options.timeout} ms`);
        listener();
    };

    setTimeout(timeoutListener, options.timeout);

    next(err);

};

const level = (res, err, timedout) => {
    const code = res.statusCode;
    return err || timedout || code >= 500 ? 'error' : code > 400 ? 'warn' : 'info';
};

const getContextLogger = () => options.httpContext.get(LOGGER_KEY) || defaultLogger;

const wrapLogger = (logger) => {
    const _emit = logger._emit;
    logger._emit = function() {
        const contextLogger = getContextLogger();
        Object.assign(arguments[0], contextLogger ? contextLogger.fields : {});
        return _emit.apply(this, arguments);
    };
    return logger;
};


module.exports = {

    truncate,

    getLogger: getContextLogger,

    createLogger: (options) => {
        defaultLogger = bunyan.createLogger(Object.assign(defaultOptions(), options));
        return wrapLogger(defaultLogger);
    },

    loggingHandler: (req, res, next) => baseLoggingHandler(undefined, req, res, next),

};

module.exports.loggingHandler.errorLogger = baseLoggingHandler;
