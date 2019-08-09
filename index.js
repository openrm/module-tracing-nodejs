const assert = require('assert');
const Sentry = require('@sentry/node');

const { SPAN_KEY, setOptions, options } = require('./options');

module.exports = {

    SPAN_KEY,

    init: (opts = {}) => {
        assert(Sentry.getCurrentHub().getStackTop().client, 'Sentry client is not initialized');

        setOptions(opts);
        require('./intercept');
    },

    ...require('./handlers'),
    ...require('./logger')

};
