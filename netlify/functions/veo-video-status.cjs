const { handler } = require('./veo-test-status.cjs');
exports.handler = (event, context) => handler(event, context, 'ai-video');
