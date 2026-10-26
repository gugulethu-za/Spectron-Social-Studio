const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const usage = require('./netlify/lib/usage.cjs');
const records = [], requests = [];
const originalTracker = usage.trackedFetch;
const originalKeys = {GEMINI_API_KEY:process.env.GEMINI_API_KEY, GOOGLE_DEVELOPER_API_KEY:process.env.GOOGLE_DEVELOPER_API_KEY};
let payload, responseStatus = 200, networkError;
usage.trackedFetch = usage.createTracker({
  storeFactory:() => ({async setJSON(key, record) { records.push(record); }}),
  fetcher:async (url, options) => {
    requests.push({url, options});
    if (networkError) throw networkError;
    if (typeof payload === 'function') return payload(url, options);
    return payload instanceof Response ? payload : Response.json(payload, {status:responseStatus});
  }
}).trackedFetch;
const start = require('./netlify/functions/start-veo-video.cjs').handler;
const status = require('./netlify/functions/veo-video-status.cjs').handler;
const download = require('./netlify/functions/download-veo-video.cjs').handler;
const event = (method = 'GET', operation = 'interactions/mock') => ({httpMethod:method, queryStringParameters:{operation}});
const input = {image:'data:image/png;base64,YWJj', prompt:'Product showcase', aspectRatio:'9:16'};
const post = body => ({httpMethod:'POST', body:JSON.stringify(body)});
const read = response => JSON.parse(response.body);
const completed = video => ({status:'completed', steps:[{type:'model_output', content:[{type:'video', mime_type:'video/mp4', ...video}]}]});
function reset() {
  payload = {id:'mock', status:'in_progress'}; responseStatus = 200; networkError = null;
  requests.length = 0; records.length = 0;
  process.env.GEMINI_API_KEY = 'mock-key'; delete process.env.GOOGLE_DEVELOPER_API_KEY;
}
after(() => {
  usage.trackedFetch = originalTracker;
  for (const [key, value] of Object.entries(originalKeys)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test('start submits exactly one background Omni interaction and returns immediately without polling', async () => {
  reset(); process.env.GOOGLE_DEVELOPER_API_KEY = 'preferred-mock-key';
  const response = await start(post(input));
  assert.equal(response.statusCode, 202); assert.equal(read(response).operation, 'interactions/mock');
  assert.equal(requests.length, 1); assert.equal(requests[0].url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  const {options} = requests[0];
  assert.equal(options.headers['x-goog-api-key'], 'preferred-mock-key');
  assert.equal(options.headers['Api-Revision'], '2026-05-20');
  assert.deepEqual(JSON.parse(options.body), {
    model:'gemini-omni-1.1-flash', background:true, store:true,
    input:[{type:'image', data:'YWJj', mime_type:'image/png'}, {type:'text', text:'Product showcase'}],
    generation_config:{video_config:{task:'image_to_video'}},
    response_format:{type:'video', aspect_ratio:'9:16', duration:'4s', resolution:'720p', delivery:'uri'}
  });
  assert.equal(usage.summarize(records).totals.veo.submitted, 1);
  assert.doesNotMatch(JSON.stringify(records), /mock-key|Product showcase|YWJj/);
});
test('input validation, missing key, unsupported methods and malformed provider responses', async () => {
  reset(); delete process.env.GEMINI_API_KEY;
  assert.equal((await start(post(input))).statusCode, 500);
  process.env.GEMINI_API_KEY = 'mock-key';
  assert.equal((await start(event('GET'))).statusCode, 405);
  for (const body of [null, [], {}, {...input, prompt:''}, {...input, aspectRatio:'4:3'},
    {...input, image:'data:image/gif;base64,YWJj'}, {...input, image:'data:image/png;base64,!!!'},
    {...input, image:`data:image/png;base64,${Buffer.alloc(20 * 1024 * 1024 + 1).toString('base64')}`}]) {
    assert.equal((await start(post(body))).statusCode, 400);
  }
  assert.equal((await start({httpMethod:'POST', body:'{'})).statusCode, 400);
  assert.equal(requests.length, 0);
  for (const id of ['', '../evil', 'mock?key=secret', 'https://evil.test']) {
    payload = {id}; assert.equal((await start(post(input))).statusCode, 502);
  }
  payload = new Response('not json'); assert.equal((await start(post(input))).statusCode, 502);
});
test('friendly quota, authentication, permission, network and timeout errors never echo secrets', async () => {
  reset();
  for (const handler of [() => start(post(input)), () => status(event()), () => download(event())]) {
    for (const code of [400, 401, 403, 404, 429, 500]) {
      responseStatus = code; payload = {error:{message:'mock-key private prompt data:image/png;base64,YWJj'}};
      const response = await handler();
      assert.equal(response.statusCode, code === 429 ? 429 : 502);
      assert.doesNotMatch(response.body, /mock-key|private prompt|YWJj/);
      if (code === 429) assert.match(read(response).error, /Google usage limit reached/);
    }
  }
  responseStatus = 200;
  for (const name of ['Error', 'TimeoutError']) {
    networkError = Object.assign(new Error('mock-key'), {name});
    const response = await start(post(input)); assert.equal(response.statusCode, 502);
    assert.doesNotMatch(response.body, /mock-key/);
  }
});
test('status supports pending/completed/failed/cancelled, omits video data and deduplicates usage', async () => {
  reset(); await start(post(input));
  for (const state of ['in_progress', 'completed', 'failed', 'cancelled', 'incomplete', 'requires_action', 'bogus']) {
    payload = state === 'completed' ? completed({data:Buffer.from('fake-mp4').toString('base64')}) : {status:state};
    const response = await status(event());
    assert.equal(response.statusCode, state === 'bogus' ? 502 : 200);
    if (state !== 'bogus') assert.equal(read(response).state, state === 'in_progress' ? 'pending' : state === 'completed' ? 'completed' : 'failed');
    assert.doesNotMatch(response.body, /steps|fake-mp4|ZmFrZS1tcDQ/);
  }
  payload = completed({data:Buffer.from('fake-mp4').toString('base64')});
  await status(event()); await status(event());
  const summary = usage.summarize(records);
  assert.equal(summary.totals.veo.attempts, 1); assert.equal(summary.totals.veo.completed, 1);
  assert.equal(summary.totals.veo.videos, 1); assert.equal(summary.totals.veo.estimatedCompletedSeconds, 4);
  assert.doesNotMatch(JSON.stringify(records), /ZmFrZS1tcDQ/);
  for (const operation of ['interactions/../evil', 'interactions/mock?key=x', 'https://evil.test']) {
    assert.equal((await status(event('GET', operation))).statusCode, 400);
  }
});
test('download returns inline MP4, waits for pending and rejects malformed, oversized or unsafe media', async () => {
  reset(); payload = {status:'in_progress'};
  assert.equal((await download(event())).statusCode, 409);
  payload = {status:'failed'}; assert.equal((await download(event())).statusCode, 422);
  payload = completed({data:Buffer.from('fake-mp4').toString('base64')});
  const response = await download(event());
  assert.equal(response.statusCode, 200); assert.equal(response.headers['Content-Type'], 'video/mp4');
  assert.equal(Buffer.from(response.body, 'base64').toString(), 'fake-mp4');
  for (const video of [{data:'!!!'}, {data:Buffer.alloc(4 * 1024 * 1024 + 1).toString('base64')},
    {uri:'https://evil.test/video.mp4'}, {uri:'http://generativelanguage.googleapis.com/v1beta/files/x:download'}]) {
    payload = completed(video); assert.equal((await download(event())).statusCode, 502);
  }
  assert.equal(requests.filter(request => !request.url.includes('/interactions/')).length, 0);
});
test('URI download stays on Google, sends credentials only there and rejects redirects or non-video content', async () => {
  reset();
  payload = (url, options) => {
    if (url.endsWith('/interactions/mock')) return Response.json(completed({uri:'files/mock:download?key=untrusted'}));
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/files/mock:download?alt=media');
    assert.equal(options.headers['x-goog-api-key'], 'mock-key');
    assert.equal(options.redirect, 'error');
    return new Response('fake-mp4', {headers:{'Content-Type':'video/mp4'}});
  };
  const response = await download(event()); assert.equal(response.statusCode, 200);
  assert.equal(Buffer.from(response.body, 'base64').toString(), 'fake-mp4');
  payload = url => url.endsWith('/interactions/mock')
    ? Response.json(completed({uri:'files/mock:download'})) : new Response('<html>not video</html>');
  assert.equal((await download(event())).statusCode, 502);
});
test('the new environment-key alias is also redacted from historical Veo diagnostics', () => {
  reset(); process.env.GOOGLE_DEVELOPER_API_KEY = 'private-alias-key';
  const {failureDetails} = require('./netlify/lib/veo-failure.cjs');
  const result = failureDetails({error:{message:'Authentication failed: private-alias-key'}});
  assert.doesNotMatch(JSON.stringify(result), /private-alias-key/);
});
test('historical Veo operation status and downloads remain compatible', async () => {
  reset();
  payload = url => url.includes('/operations/')
    ? Response.json({done:true, response:{generatedVideos:[{video:{uri:'https://generativelanguage.googleapis.com/v1beta/files/legacy:download'}}]}})
    : new Response('legacy-mp4', {headers:{'Content-Type':'video/mp4'}});
  const legacy = event('GET', 'operations/legacy');
  assert.equal(read(await status(legacy)).state, 'completed');
  assert.equal(Buffer.from((await download(legacy)).body, 'base64').toString(), 'legacy-mp4');
});
test('status and downloads do not need a second paid generation', async () => {
  reset(); await start(post(input));
  payload = completed({data:Buffer.from('fake-mp4').toString('base64')});
  await status(event()); await download(event()); await download(event());
  assert.equal(requests.filter(request => request.options.method === 'POST').length, 1);
});
