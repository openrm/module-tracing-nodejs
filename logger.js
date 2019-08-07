const bunyan = require('bunyan');
const morgan = require('morgan');
const httpContext = require('express-http-context');
const util = require('util');

const { LOGGER_KEY, options } = require('./options');

let logger;
let formatter;

const DEFAULT_OPTIONS = {
    name: 'default',
    streams: [
        {
            level: 'info',
            stream: process.stdout
        }
    ],
    serializers: {
        err: bunyan.stdSerializers.err
    }
};

const truncate = (object, opts = { maxLengthString: 1000 }) => {

    if (typeof object === 'string') {
        if (object.length > opts.maxLengthString) {
            return object.substring(0, 50) + ` ... ${object.length - 50} more characters`;
        }
    }

    if (typeof object === 'object') {
        Object.keys(object).forEach(key => {
            object[key] = truncate(object[key]);
        });

        return object;
    }

    return object;

};

const inspect = (data, opts) => util.inspect(truncate(data, opts), opts);

const level = (res, err) => {
    const code = res.statusCode;
    return err || code >= 500 ? 'error' : code > 400 ? 'warn' : 'info';
};

const getFormatter = () => {
    if (formatter) return formatter;
    formatter = morgan.compile(options.logFormat);
    return formatter;
}

const baseLoggingHandler = (err, req, res, next) => {

    const start = process.hrtime();

    let localLogger = logger;

    if (req.span) {
        const span = req.span;
        localLogger = logger.child({
            spanId: span._spanId,
            traceId: span._traceId
        });
    }

    httpContext.set(LOGGER_KEY, localLogger);
    req.logger = localLogger;

    const listener = () => {

        const [s, ns] = process.hrtime(start);
        const responseTime = (s * 1e9 + ns) / 1e6; // ms

        const protocol = `${req.protocol}/${req.httpVersion}`;

        const log = {
            status: res.statusCode,
            ip: req.ip || '127.0.0.1',
            remoteAdress: req.connection.remoteAddress,
            remotePort: req.connection.remotePort,
            protocol,
            method: req.method,
            url: req.originalUrl || req.url,
            cookies: req.cookies,
            query: req.query,
            params: req.params,
            user: req.user,
            span: req.span,
            fields: req.fields,
            files: inspect(req.files),
            referer: req.header('Referrer') || req.header('Referer') || '-',
            userAgent: req.header('User-Agent'),
            contentLength: res.getHeader('Content-Length'),
            body: inspect(req.body, options.bodyInspectOptions),
            headers: req.headers,
            responseTime,
            responseHeaders: res._headers,
            err
        };

        options.beforeOutput(log);

        const formatter = getFormatter();

        const levelLogger = localLogger[level(res, err)];
        levelLogger.call(localLogger, log, formatter(morgan, req, res));

        res.removeListener('finish', listener);
        res.removeListener('close', listener);

    };

    res.on('finish', listener);
    res.on('close', listener);

    next(err);

};


module.exports = {

    truncate,

    getLogger: () => logger,
    getContextLogger: () => httpContext.get(LOGGER_KEY) || logger,

    createLogger: (options) => {
        logger = bunyan.createLogger(Object.assign(DEFAULT_OPTIONS, options));
        return logger;
    },

    loggingHandler: (req, res, next) => baseLoggingHandler(undefined, req, res, next),

};

module.exports.loggingHandler.errorLogger = baseLoggingHandler;
