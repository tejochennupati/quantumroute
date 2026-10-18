const serverless = require('serverless-http');
const { app } = require('../../server.js');

const serverlessHandler = serverless(app);

module.exports.handler = async (event, context) => {
    // Normalize event path so Express matches /api/* routes accurately
    if (event.path) {
        if (event.path.startsWith('/.netlify/functions/api')) {
            const stripped = event.path.replace('/.netlify/functions/api', '');
            event.path = stripped.startsWith('/api') ? stripped : ('/api' + (stripped.startsWith('/') ? stripped : '/' + stripped));
        } else if (!event.path.startsWith('/api')) {
            event.path = '/api' + (event.path.startsWith('/') ? event.path : '/' + event.path);
        }
    }

    return await serverlessHandler(event, context);
};

