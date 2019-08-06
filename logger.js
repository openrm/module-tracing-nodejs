const bunyan = require('bunyan');

let logger;

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

module.exports = {

    get logger() {
        return logger;
    },

    createLogger: (options) => {
        logger = bunyan.createLogger(Object.assign(DEFAULT_OPTIONS, options));
        return logger;
    }

};
