const { handler } = require('./download-veo-test.cjs');
exports.handler = (event, context) => handler(event, context, 'ai-video');
