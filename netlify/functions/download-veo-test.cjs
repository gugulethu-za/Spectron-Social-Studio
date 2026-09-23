const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const OPERATION_PATTERN = /^(?:operations\/[A-Za-z0-9._-]+|models\/[A-Za-z0-9._-]+\/operations\/[A-Za-z0-9._-]+)$/;
const GOOGLE_HOSTS = new Set(['generativelanguage.googleapis.com','storage.googleapis.com']);
function reply(statusCode, body) { return {statusCode, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}; }
function validVideoUri(value) { try { const url = new URL(value); return GOOGLE_HOSTS.has(url.hostname) && (url.hostname === 'storage.googleapis.com' || url.pathname.startsWith('/v1beta/')); } catch { return false; } }
function extractVideoUri(result) { return result?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri || result?.response?.generatedVideos?.[0]?.video?.uri || ''; }
exports.handler = async function handler(event) {
  if (event.httpMethod !== 'GET') return reply(405,{error:'Method not allowed.'});
  const operation = event.queryStringParameters?.operation || '';
  if (!OPERATION_PATTERN.test(operation)) return reply(400,{error:'Invalid video operation name.'});
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return reply(500,{error:'GEMINI_API_KEY is not configured on the server.'});
  try {
    const statusResponse = await fetch(`${API_BASE}/${operation}`,{headers:{'x-goog-api-key':apiKey},signal:AbortSignal.timeout(20000)});
    let status = null; try { status = await statusResponse.json(); } catch {}
    if (!statusResponse.ok) return reply(statusResponse.status === 401 || statusResponse.status === 403 ? statusResponse.status : 502,{error:'Google operation status could not be read.'});
    if (status?.done !== true) return reply(409,{error:'The Veo video is not ready yet.'});
    if (status.error) return reply(422,{error:/safety|blocked|unsafe|policy/i.test(JSON.stringify(status.error)) ? 'Google safety checks blocked this video request.' : 'Google reported that the video request failed.'});
    const videoUri = extractVideoUri(status);
    if (!validVideoUri(videoUri)) return reply(502,{error:'Google returned an unavailable or unsafe video reference.'});
    const videoResponse = await fetch(videoUri,{headers:new URL(videoUri).hostname === 'generativelanguage.googleapis.com' ? {'x-goog-api-key':apiKey} : {},signal:AbortSignal.timeout(60000)});
    if (!videoResponse.ok) return reply(502,{error:'The generated video is unavailable or has expired.'});
    const bytes = Buffer.from(await videoResponse.arrayBuffer());
    if (!bytes.length) return reply(502,{error:'Google returned an empty video.'});
    return {statusCode:200,isBase64Encoded:true,headers:{'Content-Type':'video/mp4','Content-Disposition':'attachment; filename="veo-test.mp4"','Cache-Control':'no-store'},body:bytes.toString('base64')};
  } catch (error) { return reply(502,{error:error?.name === 'TimeoutError' ? 'The video download timed out.' : 'The video download failed.'}); }
};
