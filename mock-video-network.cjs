'use strict';
// Test-only preload for Netlify Dev. Never use this for normal generation.
const realFetch=globalThis.fetch;
globalThis.fetch=async function(input,options={}){
 const url=new URL(typeof input==='string'?input:input.url);
 if(['localhost','127.0.0.1','::1','[::1]'].includes(url.hostname))return realFetch(input,options);
 if(url.hostname==='generativelanguage.googleapis.com'){
  if(url.pathname.endsWith(':predictLongRunning'))return Response.json({name:'operations/local-mock-video'});
  if(url.pathname==='/v1beta/operations/local-mock-video')return Response.json({done:true,response:{generateVideoResponse:{generatedSamples:[{video:{uri:'https://generativelanguage.googleapis.com/v1beta/files/local-mock:download'}}]}}});
  if(url.pathname==='/v1beta/files/local-mock:download')return new Response('mock-mp4',{headers:{'Content-Type':'video/mp4'}});
 }
 throw new Error('External network blocked by local video test preload');
};
