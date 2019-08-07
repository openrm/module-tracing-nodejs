const COMBINED_APACHE_FORMAT = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"';

let OPTIONS = {
    traceHeader: 'Sentry-Trace',
    logFormat: COMBINED_APACHE_FORMAT,
    bodyInspectOptions: {
        depth: Infinity,
        maxLengthArray: Infinity,
        maxLengthString: 1000
    }
};

const setOptions = (opts) => {
    Object.keys(OPTIONS).forEach(key => {
        if (opts[key]) OPTIONS[key] = opts[key];
    });
};

module.exports = {
    SPAN_KEY: '__tracing_span',
    LOGGER_KEY: '__tracing_logger',

    setOptions,
    get options() {
        return OPTIONS;
    }
};
