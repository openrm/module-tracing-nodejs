const { options } = require('./options');

require('@google-cloud/trace-agent').start({
    enabled: process.env.NODE_ENV === 'production',
    propagation: require('./propagation'),
    ignoreUrls: ['/healthz', '/_ah/health'],
    samplingRate: options.samplingRate
});
