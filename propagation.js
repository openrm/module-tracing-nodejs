const { options } = require('./options');
const { generate } = require('@opencensus/propagation-stackdriver').v1;

const TRACEPARENT_REGEXP = new RegExp(
  '^[ \\t]*' + // whitespace
  '([0-9a-f]{32})?' + // trace_id
  '-?([0-9a-f]+)?' + // span_id
  '-?([01])?' + // sampled
    '[ \\t]*$', // whitespace
);

const parse = (trace) => {
    const matches = trace.match(TRACEPARENT_REGEXP);
    if (!matches) return {};

    let sampled;
    if (matches[3] === '1') {
        sampled = true;
    } else if (matches[3] === '0') {
        sampled = false;
    }

    return {
        traceId: matches[1] || '',
        spanId: matches[2] || '',
        options: isNaN(Number(matches[3])) ? 0 : Number(matches[3])
    };
};

const serialize = (spanContext) =>
    `${spanContext.traceId}-${spanContext.spanId}-${spanContext.options || 0}`;


module.exports = {
    extract (getter) {
        return parse(getter.getHeader(options.traceHeader) || '');
    },
    inject (setter, spanContext) {
        setter.setHeader(options.traceHeader, serialize(spanContext));
    },
    generate
};
