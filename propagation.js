const { options } = require('./options');
const { generate } = require('@opencensus/propagation-stackdriver').v1;
const { TRACEPARENT_REGEXP } = require('@sentry/hub');

const parse = (trace) => {
    const matches = trace.match(TRACEPARENT_REGEXP);
    if (matches) {
        let sampled;
        if (matches[3] === '1') {
            sampled = true;
        } else if (matches[3] === '0') {
            sampled = false;
        }
    }
    return {
        traceId: matches[1] || '',
        spanId: matches[2] || '',
        options: isNaN(Number(matches[3])) ? undefined : Number(matches[3])
    };
};

const serialize = (spanContext) => {
    let header = `${spanContext.traceId}-${spanContext.spanId}`;
    if (spanContext.options) {
        header += `-${spanContext.options}`;
    }
    return header;
};


module.exports = {
    extract (getter) {
        return parse(getter.getHeader(options.traceHeader) || '');
    },
    inject (setter, spanContext) {
        setter.setHeader(options.traceHeader, serialize(spanContext));
    },
    generate
};
