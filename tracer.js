const { options } = require('./options');

require('@google-cloud/trace-agent').start({
    enabled: options.enableTrace,
    propagation: require('./propagation'),
    ignoreUrls: ['/healthz', '/_ah/health'],
    samplingRate: options.samplingRate,
    serviceContext: {
        service: options.service.name,
        version: options.service.version
    }
});
