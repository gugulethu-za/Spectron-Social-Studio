const { handler } = require('./start-veo-test.cjs');
exports.handler = (event, context) => handler(event, context, 'ai-video');
