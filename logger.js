const bunyan = require('bunyan');

const DEFAULT_OPTIONS = {
    name: 'default',
    streams: [
        {
            level: 'info',
            stream: process.stdout
        }
    ],
    serializers: {
        req: bunyan.stdSerializers.req,
        res: bunyan.stdSerializers.res,
        err: bunyan.stdSerializers.err
    }
};

module.exports = (options) =>
    bunyan.createLogger(Object.assign(DEFAULT_OPTIONS, options));
