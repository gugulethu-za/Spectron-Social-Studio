const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {handler} = require('./netlify/functions/generate-ai-image.cjs');
const page = fs.readFileSync('spectron-social-studio.html','utf8');
const actions = page.match(/<div class="background-actions">([\s\S]*?)<\/div>/)[1];
assert.match(actions, /id="backgroundAccept"[^>]*onclick="acceptBackground\(\)"[\s\S]*id="backgroundRestore"[^>]*onclick="restoreBackground\(\)"/);
assert.equal((actions.match(/class="upload-btn"/g)||[]).length,2);
assert.match(page, /class="upload-btn library-upload"[\s\S]*id="libraryUploadInput"/);
assert.match(page, /id="libraryUploadLabel"/);
assert.doesNotMatch(actions,/<br\b/);
assert.match(page,/\.img-field \.background-actions\{[^}]*display:flex;flex-direction:column;gap:12px;background:transparent;width:100%/);
assert.match(page,/\.background-actions>\.upload-btn\{width:100%;margin:0;padding:11px;box-sizing:border-box;/);
assert.match(page,/#backgroundPanel\[hidden\]\+\.background-actions #backgroundRestore\{display:none;/);
const image = 'data:image/png;base64,iVBORw0KGgo=';
const event = data => ({httpMethod:'POST',body:JSON.stringify(data)});
(async () => {
 const originalFetch = global.fetch, originalKey = process.env.GEMINI_API_KEY;
 try {
  process.env.GEMINI_API_KEY = 'test-only';
  let calls = 0;
  global.fetch = async (url, options) => {
   calls++;
   assert.match(url,/gemini-2\.5-flash-image:generateContent$/);
   assert.equal(options.headers['x-goog-api-key'],'test-only');
   const body = JSON.parse(options.body);
   assert.equal(body.contents[0].parts[0].inlineData.data,image.split(',')[1]);
   assert.match(body.contents[0].parts[1].text,/Preserve the main person/);
   assert.deepEqual(body.generationConfig.responseModalities,['TEXT','IMAGE']);
   return {ok:true,json:async()=>({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:image.split(',')[1]}}]}}]})};
  };
  assert.equal((await handler({httpMethod:'GET'})).statusCode,405);
  assert.equal((await handler({httpMethod:'POST',body:'{'})).statusCode,400);
  for(const data of [null,{}, {image,description:' '},{description:'Beach'},{image:'data:image/png;base64,YWJj',description:'Beach'},{image,description:'x'.repeat(1001)}]) assert.equal((await handler(event(data))).statusCode,400);
  assert.equal((await handler(event({image:'data:image/png;base64,'+'A'.repeat(4194308),description:'Beach'}))).statusCode,413);
  assert.equal(calls,0);
  const success = await handler(event({image,description:'Beach'}));
  assert.equal(success.headers['Content-Type'],'application/json'); assert.equal(success.statusCode,200); assert.equal(JSON.parse(success.body).image,image);
  delete process.env.GEMINI_API_KEY;
  assert.equal((await handler(event({image,description:'Beach'}))).statusCode,500);
  process.env.GEMINI_API_KEY = 'test-only';
  for(const status of [429,403,500]) {
   global.fetch=async()=>({ok:false,status});
   assert.equal((await handler(event({image,description:'Beach'}))).statusCode,status===429?429:502);
  }
  global.fetch=async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Cannot edit'}]}}]})});
  assert.equal((await handler(event({image,description:'Beach'}))).statusCode,502);
  global.fetch=async()=>{throw Object.assign(new Error(),{name:'TimeoutError'});};
  assert.match(JSON.parse((await handler(event({image,description:'Beach'}))).body).error,/lang/);
 } finally { global.fetch=originalFetch; if(originalKey===undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY=originalKey; }
 console.log('PASS: three separate ordered action controls, scoped transparent 12px vertical gaps, full-width padding, original handlers');
 console.log('PASS: API validation, size limit, server key, Gemini request, success, quota, errors, empty output, timeout');
 const elements = new Map();
 const el = id => {if(!elements.has(id)) elements.set(id,{value:'',hidden:false,disabled:false,textContent:'',setAttribute(){},removeAttribute(){},focus(){}}); return elements.get(id);};
 let resolveRequest, requests=0, sources=[];
 const context = vm.createContext({console,AbortController,setTimeout,clearTimeout,selectedImage:null,uploadedImages:[],brandImageRecords:[],crypto:require('node:crypto').webcrypto,
  async persistBrandImage(record){if(!context.brandImageRecords.some(item=>item.image===record.image)) context.brandImageRecords.push(record);},
  document:{getElementById:el,querySelectorAll:()=>[]},
  fetch:async(url)=>{assert.equal(url,'/.netlify/functions/generate-ai-image');requests++;return new Promise(resolve=>{resolveRequest=resolve;});},
  selectImage(src){context.selectedImage=src;vm.runInContext('syncBackgroundImage()',context);}
 });
 vm.runInContext(fs.readFileSync('ai-background.js','utf8'),context);
 const run = code => vm.runInContext(code,context);
 assert.equal(el('backgroundButton').hidden,true);
 await run('generateBackground()');assert.match(el('backgroundError').textContent,/Selecteer/);
 context.selectedImage=image;run('syncBackgroundImage();openBackground()');
 assert.equal(el('backgroundButton').hidden,false);assert.equal(el('backgroundPanel').hidden,false);
 await run('generateBackground()');assert.match(el('backgroundError').textContent,/Beschrijf/);
 context.capture = src => {sources.push(src);return image;};
 run('backgroundImageData = async src => capture(src)');
 el('backgroundDescription').value='Beach';
 let pending=run('generateBackground()');await Promise.resolve();await Promise.resolve();
 await run('generateBackground()');assert.equal(requests,1);assert.equal(el('backgroundGenerate').disabled,true);
 const edited='data:image/png;base64,YWJj';
 resolveRequest({ok:true,json:async()=>({image:edited})});await pending;
 assert.equal(el('backgroundPreview').src,edited);assert.equal(context.selectedImage,image);
 el('backgroundDescription').value='Changed after generation';
 await run('Promise.all([acceptBackground(),acceptBackground()])');assert.equal(context.selectedImage,edited);
 await run('acceptBackground()');assert.equal(context.brandImageRecords.length,1);
 assert.equal(context.brandImageRecords[0].prompt,'Beach');
 assert.equal(context.brandImageRecords[0].source,'ai-background');
 assert.equal(context.brandImageRecords[0].originalImage,image);
 assert.ok(context.brandImageRecords[0].id);assert.ok(context.brandImageRecords[0].createdAt);
 assert.match(el('backgroundStatus').textContent,/added to Brand Images/);
 pending=run('generateBackground()');await Promise.resolve();await Promise.resolve();
 assert.deepEqual(sources,[image,image]);
 resolveRequest({ok:false,json:async()=>({error:'Quota reached'})});await pending;
 assert.equal(el('backgroundError').textContent,'Quota reached');assert.equal(el('backgroundGenerate').disabled,false);
 run('restoreBackground()');assert.equal(context.selectedImage,image);assert.equal(el('backgroundPreview').hidden,true);
 pending=run('generateBackground()');await Promise.resolve();await Promise.resolve();
 context.selectedImage='other.png';run('syncBackgroundImage()');
 resolveRequest({ok:true,json:async()=>({image:edited})});await pending;
 assert.equal(el('backgroundPreview').hidden,true);assert.equal(context.selectedImage,'other.png');
 context.selectedImage=null;run('syncBackgroundImage()');assert.equal(el('backgroundButton').hidden,true);
 assert.equal(context.brandImageRecords.length,1,'Restore and failed generations do not save');
 context.selectedImage=image;run('syncBackgroundImage()');
 el('backgroundDescription').value='Office';
 pending=run('generateBackground()');await Promise.resolve();await Promise.resolve();
 resolveRequest({ok:true,json:async()=>({image:'data:image/png;base64,ZGVm'})});await pending;
 run('restoreBackground()');await run('acceptBackground()');assert.equal(context.brandImageRecords.length,1,'Restored previews cannot be saved');
 pending=run('generateBackground()');await Promise.resolve();await Promise.resolve();
 resolveRequest({ok:true,json:async()=>({image:'data:image/png;base64,ZGVm'})});await pending;
 context.persistBrandImage=async()=>{throw new Error('QuotaExceededError');};
 await run('acceptBackground()');assert.equal(context.selectedImage,image);
 assert.equal(el('backgroundPreview').hidden,false);assert.equal(el('backgroundAccept').disabled,false);
 assert.match(el('backgroundError').textContent,/browseropslag/);
 console.log('PASS: acceptance metadata, repeat prevention, confirmation, restore without saving, storage failure retains preview');
 let uploadHandler, galleryRenders=0;
 const uploadContext=vm.createContext({Promise,Array,uploadedLibraryImages:{},alert:message=>assert.fail(message),
  document:{getElementById:id=>id==='brand'?{value:'Gear2Play'}:{addEventListener(type,handler){uploadHandler=handler;}}},
  FileReader:class {readAsDataURL(file){this.onload({target:{result:file.data}});}},
  renderImageGallery(){galleryRenders++;}
 });
 vm.runInContext(page.slice(page.indexOf("document.getElementById('libraryUploadInput').addEventListener"),page.indexOf('const USP_LABELS =')),uploadContext);
 const uploadEvent={target:{files:[{data:image}],value:'photo.png'}};
 uploadHandler(uploadEvent);await Promise.resolve();await Promise.resolve();
 assert.equal(uploadContext.uploadedLibraryImages.Gear2Play[0],image);
 assert.equal(galleryRenders,1);assert.equal(uploadEvent.target.value,'');
 console.log('PASS: library upload retains selected brand, refreshes images, and resets file input');
 console.log('PASS: selection visibility, required input, duplicate prevention, preview, accept, regeneration from original, restore, errors, stale response');
})().catch(error=>{console.error(error);process.exitCode=1;});
