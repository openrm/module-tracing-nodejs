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

        const fields = {
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
            referer: req.header('Referrer') || req.header('Referer') || '-',
            userAgent: req.header('User-Agent'),
            contentLength: res.getHeader('Content-Length'),
            body: util.inspect(req.body, { depth: 0 }),
            headers: req.headers,
            responseTime,
            responseHeader: res._headers,
            err
        };

        const formatter = getFormatter();

        const levelLogger = localLogger[level(res, err)];
        levelLogger.call(localLogger, fields, formatter(morgan, req, res));

        res.removeListener('finish', listener);
        res.removeListener('close', listener);

    };

    res.on('finish', listener);
    res.on('close', listener);

    next(err);

};


module.exports = {

    getLogger: () => logger,
    getContextLogger: () => httpContext.get(LOGGER_KEY) || logger,

    createLogger: (options) => {
        logger = bunyan.createLogger(Object.assign(DEFAULT_OPTIONS, options));
        return logger;
    },

    loggingHandler: (req, res, next) => baseLoggingHandler(undefined, req, res, next),

};

module.exports.loggingHandler.errorLogger = baseLoggingHandler;
