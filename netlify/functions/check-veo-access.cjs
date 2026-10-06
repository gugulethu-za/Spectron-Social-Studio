const { trackedFetch } = require('../lib/usage.cjs');
const MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
function reply(statusCode, body, extraHeaders = {}) { return {statusCode, headers:{'Content-Type':'application/json', ...extraHeaders}, body:JSON.stringify(body)}; }
exports.handler = async function handler(event) {
  if (event.httpMethod !== 'GET') return reply(405, {error:'Method not allowed.'}, {Allow:'GET'});
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return reply(500, {error:'GEMINI_API_KEY is not configured on the server.'});
  try {
    const response = await trackedFetch(event, {provider:'veo', feature:'veo-access-check', requestType:'diagnostic'}, MODELS_URL, {method:'GET', headers:{'x-goog-api-key':apiKey}, signal:AbortSignal.timeout(20000)});
    if (response.status === 401) return reply(401, {error:'The configured Gemini API key is invalid.'});
    if (response.status === 403) return reply(403, {error:'The configured Gemini API key is not permitted to list Gemini models.'});
    if (response.status === 429) return reply(429, {error:'The Gemini API quota or billing limit was reached.'});
    if (!response.ok) return reply(502, {error:'Google Gemini model access could not be checked.'});
    let result;
    try { result = await response.json(); } catch { return reply(502, {error:'Google returned an invalid model-list response.'}); }
    if (!result || !Array.isArray(result.models)) return reply(502, {error:'Google returned an invalid model-list response.'});
    const models = result.models.map(model => model && typeof model.name === 'string' ? model.name : null).filter(name => name && name.toLowerCase().includes('veo'));
    if (!models.length) return reply(200, {success:true, veoAvailable:false, models:[], message:'No Veo models are available to this API key.'});
    return reply(200, {success:true, veoAvailable:true, models});
  } catch (error) {
    return reply(502, {error:error?.name === 'TimeoutError' ? 'The Google Gemini model-list request timed out.' : 'The Google Gemini model-list request failed.'});
  }
};
