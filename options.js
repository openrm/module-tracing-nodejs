const SPAN_KEY = '__tracing_span';

let OPTIONS = {
    traceHeader: 'Sentry-Trace'
};

const setOptions = (opts) => {
    Object.keys(OPTIONS).forEach(key => {
        if (opts[key]) OPTIONS[key] = opts[key];
    });
};

module.exports = {
    SPAN_KEY,
    setOptions,
    get options() {
        return OPTIONS;
    }
};
