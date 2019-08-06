const assert = require('assert');
const Sentry = require('@sentry/node');

assert(Sentry.getCurrentHub().getStackTop().client, 'Sentry client is not initialized');

const { SPAN_KEY, setOptions, options } = require('./options');

module.exports = {

    SPAN_KEY,

    init: (opts) => {
        setOptions(opts);
        require('./intercept');
    },

    ...require('./handlers'),

    createLogger: require('./logger')

};

