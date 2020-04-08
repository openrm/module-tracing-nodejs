const httpContext = require('express-http-context');
const COMBINED_APACHE_FORMAT = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';

const MASK = '[Filtered]';
const mask = (object, field) => object && object[field] && (object[field] = MASK);

const MASK_CREDENTIALS = (log) => {
    mask(log.headers, 'authorization');
    mask(log.fields, 'password');
};

let OPTIONS = {
    traceHeader: 'Sentry-Trace',
    logFormat: COMBINED_APACHE_FORMAT,
    bodyInspectOptions: {
        depth: Infinity,
        maxLengthArray: Infinity,
        maxLengthString: 1000
    },
    service: {},
    beforeOutput: MASK_CREDENTIALS,
    httpContext,
    timeout: 5000,
    enableTrace: true,
    enableStackdriver: true,
    samplingRate: 100
};

const setOptions = (opts) => {
    Object.keys(OPTIONS).forEach(key => {
        if (opts[key] !== undefined) OPTIONS[key] = opts[key];
    });
};

module.exports = {
    SPAN_KEY: '__tracing_span',
    LOGGER_KEY: '__tracing_logger',

    mask,

    setOptions,
    get options() {
        return OPTIONS;
    }
};
