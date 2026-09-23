const assert=require('node:assert/strict');
const {handler}=require('./netlify/functions/check-veo-access.cjs');
const request=method=>({httpMethod:method}); const body=response=>JSON.parse(response.body);
(async()=>{const originalFetch=global.fetch,originalKey=process.env.GEMINI_API_KEY;try{
 delete process.env.GEMINI_API_KEY; let response=await handler(request('GET')); assert.equal(response.statusCode,500); assert.doesNotMatch(JSON.stringify(body(response)),/test-only-key|private|secret/i); assert.equal((await handler(request('POST'))).statusCode,405);
 process.env.GEMINI_API_KEY='test-only-key';let calls=0;global.fetch=async(url,options)=>{calls++;assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models');assert.equal(options.method,'GET');assert.equal(options.headers['x-goog-api-key'],'test-only-key');return {ok:true,status:200,json:async()=>({models:[{name:'models/gemini-2.5-flash'},{name:'models/veo-3.1-generate-preview'},{name:'models/VEO-2'},{displayName:'veo-without-name'}]})};};
 response=await handler(request('GET'));assert.deepEqual(body(response),{success:true,veoAvailable:true,models:['models/veo-3.1-generate-preview','models/VEO-2']});assert.equal(calls,1);
 global.fetch=async()=>({ok:true,status:200,json:async()=>({models:[{name:'models/gemini-2.5-flash'}]})});response=await handler(request('GET'));assert.deepEqual(body(response),{success:true,veoAvailable:false,models:[],message:'No Veo models are available to this API key.'});
 for(const [status,expected] of [[401,/invalid/i],[403,/not permitted/i],[429,/quota|billing/i],[500,/could not be checked/i]]){global.fetch=async()=>({ok:false,status});response=await handler(request('GET'));assert.equal(response.statusCode,status===500?502:status);assert.match(body(response).error,expected);assert.doesNotMatch(JSON.stringify(body(response)),/test-only-key/);}
 global.fetch=async()=>({ok:true,status:200,json:async()=>({invalid:true})});response=await handler(request('GET'));assert.equal(response.statusCode,502);assert.match(body(response).error,/invalid/i);
 global.fetch=async()=>{throw Object.assign(new Error('private network details'),{name:'TypeError'});};response=await handler(request('GET'));assert.deepEqual(body(response),{error:'The Google Gemini model-list request failed.'});
 global.fetch=async()=>{throw Object.assign(new Error('private timeout details'),{name:'TimeoutError'});};response=await handler(request('GET'));assert.deepEqual(body(await handler(request('GET'))),{error:'The Google Gemini model-list request timed out.'});
 global.fetch=async()=>({ok:true,status:200,json:async()=>{throw new Error('private invalid details');}});response=await handler(request('GET'));assert.equal(response.statusCode,502);assert.doesNotMatch(JSON.stringify(body(response)),/details|key|secret/i);
 console.log('PASS: Veo access diagnostic method/key safety, filtering, safe errors, invalid responses and network handling');
}finally{global.fetch=originalFetch;if(originalKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=originalKey;}})().catch(error=>{console.error(error);process.exitCode=1;});

