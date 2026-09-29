const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const OPERATION_PATTERN = /^(?:operations\/[A-Za-z0-9._-]+|models\/[A-Za-z0-9._-]+\/operations\/[A-Za-z0-9._-]+)$/;
function reply(statusCode, body) { return {statusCode, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}; }
function extractVideoUri(result) { return result?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri || result?.response?.generatedVideos?.[0]?.video?.uri || ''; }
function safeFailure(error) { return /safety|blocked|unsafe|policy/i.test(JSON.stringify(error || {})) ? 'Google safety checks blocked this video request.' : 'Google reported that the video request failed.'; }
exports.OPERATION_PATTERN = OPERATION_PATTERN; exports.extractVideoUri = extractVideoUri;
exports.handler = async function handler(event) {
  if (event.httpMethod !== 'GET') return reply(405,{error:'Method not allowed.'});
  const operation = event.queryStringParameters?.operation || '';
  if (!OPERATION_PATTERN.test(operation)) return reply(400,{error:'Invalid video operation name.'});
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return reply(500,{error:'GEMINI_API_KEY is not configured on the server.'});
  try {
    const response = await fetch(`${API_BASE}/${operation}`,{headers:{'x-goog-api-key':apiKey},signal:AbortSignal.timeout(20000)});
    let result = null; try { result = await response.json(); } catch {}
    if (!response.ok) return reply(response.status === 401 || response.status === 403 ? response.status : 502,{error:response.status === 403 ? 'The configured Gemini API key is not permitted to read this operation.' : response.status === 401 ? 'The configured Gemini API key is invalid.' : 'Google operation status could not be read.'});
    if (!result || typeof result !== 'object' || Array.isArray(result) || (result.done !== undefined && typeof result.done !== 'boolean')) return reply(502,{error:'Google returned an invalid operation status.'});
    if (result.done !== true) return reply(200,{state:'pending',operation});
    if (result.error || !extractVideoUri(result)) return reply(200,{state:'failed',operation,message:safeFailure(result.error)});
    return reply(200,{state:'completed',operation,videoReference:operation});
  } catch (error) { return reply(502,{error:error?.name === 'TimeoutError' ? 'The Google operation status request timed out.' : 'The Google operation status request failed.'}); }
};
