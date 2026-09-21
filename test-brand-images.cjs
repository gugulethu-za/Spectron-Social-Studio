const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const page=fs.readFileSync('spectron-social-studio.html','utf8');
const stores=new Map([['ads',new Map([['existing',{id:'existing',savedAt:'2026-01-01',format:'1080x1080',variant:{headline:'Keep',body:'',cta:''},visual:{imgScale:1,imgPosX:50,imgPosY:50,textScale:1}}]])]]);
let version=1, failWrites=false, queue=Promise.resolve();
const db={objectStoreNames:{contains:name=>stores.has(name)},createObjectStore(name){stores.set(name,new Map());},close(){},transaction(name,mode){
 const tx={};let finish;const done=new Promise(resolve=>{finish=resolve;});const previous=queue;queue=done;
 previous.then(()=>setTimeout(()=>{
  if(mode==='readwrite' && failWrites){tx.error=new Error('QuotaExceededError');tx.onabort?.();finish();return;}
  if(request){request.result=structuredClone([...stores.get(name).values()]);request.onsuccess();}
  for(const record of writes) stores.get(name).set(record.id,structuredClone(record));
  tx.oncomplete?.();finish();
 },0));
 let request;const writes=[];
 tx.objectStore=()=>({getAll(){request={};return request;},put(record){writes.push(record);}});return tx;
}};
const indexedDB={open(name,next){assert.equal(name,'spectron-saved-ads');const request={};queueMicrotask(()=>{request.result=db;if(version<next){request.onupgradeneeded();version=next;}request.onsuccess();});return request;}};
function session(){
 const elements=new Map();const el=id=>{if(!elements.has(id)) elements.set(id,{value:'',style:{},textContent:'',innerHTML:'',classList:{add(){}},append(){},replaceChildren(){},scrollIntoView(){},getAttribute(){return context.selectedImage;}});return elements.get(id);};
 el('brand').value='Bluey';
 const context=vm.createContext({console,structuredClone,indexedDB,crypto:require('node:crypto').webcrypto,
  document:{getElementById:el,createElement:()=>el(Symbol()),querySelector:()=>el('image'),querySelectorAll:()=>[]},
  brandImageRecords:[],uploadedImages:[],uploadedLibraryImages:{},BRAND_IMAGES:{Bluey:['original.png'],Stitch:['stitch.png']},selectedImage:'original.png',currentBrand:'Bluey',variantVisuals:[],
  escapeHtml:value=>String(value).replaceAll('"','&quot;'),SPECTRON_LOGO_SRC:'logo.png',selectVariant(){},applyImageTransform(){},applyTextScale(){},
  canvasResizeObserver:{disconnect(){},observe(){}},imgScale:1,imgPosX:50,imgPosY:50,DEFAULT_TEXT_SCALE:1.5,
  getFormatSpec(){return {width:1080,height:context.testHeight,value:`1080x${context.testHeight}`};},
  PLATFORM_LIMITS:{'Instagram / Facebook post':{mock:'social'},'Instagram / Facebook story':{mock:'social'},TikTok:{mock:'social'},'Google Ads (zoekadvertentie)':{mock:'google'},LinkedIn:{mock:'linkedin'}}
 });
 const run=code=>vm.runInContext(code,context);
 run(page.slice(page.indexOf('function renderImageGallery()'),page.indexOf("document.getElementById('uploadInput').addEventListener")));
 run(page.slice(page.indexOf('function renderResults('),page.indexOf('function onEdit(')));
 run(fs.readFileSync('studio-library.js','utf8'));
 return {context,run,el};
}
(async()=>{
 let {context,run,el}=session();await run('refreshBrandImages()');
 assert.equal(version,2);assert.equal(stores.get('ads').size,1,'Upgrade preserves saved advertisements');
 const image='data:image/png;base64,YWJj';
 context.record={id:require('node:crypto').randomUUID(),brand:'Bluey',image,source:'ai-background',prompt:'Snow',createdAt:new Date().toISOString(),originalImage:'original.png',originalImageId:null};
 await run('Promise.all([persistBrandImage(record),persistBrandImage({...record,id:crypto.randomUUID()})])');
 assert.equal(stores.get('brandImages').size,1);assert.equal(context.brandImageRecords.length,1);
 run('selectImage(record.image)');assert.equal(context.selectedImage,image);
 assert.match(el('imgGallery').innerHTML,/ai-image-badge/);assert.ok(el('imgGallery').innerHTML.includes(image));
 ({context,run,el}=session());await run('refreshBrandImages()');
 assert.equal(context.brandImageRecords.length,1);assert.equal(context.brandImageRecords[0].prompt,'Snow');
 run('selectImage(brandImageRecords[0].image)');assert.equal(context.selectedImage,image);
 for(const [platform,height] of [['Instagram / Facebook post',1080],['Instagram / Facebook post',1350],['Instagram / Facebook story',1920],['TikTok',1920],['Google Ads (zoekadvertentie)',1080],['LinkedIn',1080]]){
  context.testHeight=height;context.platform=platform;
  run("renderResults([{headline:'AI ad',body:'Body',cta:'Shop'}],platform,'Toy',false)");
  assert.ok(el('resultsArea').innerHTML.includes(image),platform+' renders persisted image');
  assert.equal(run('snapshotAd(0).image'),image,platform+' saves selected image');
 }
 el('brand').value='Stitch';context.selectedImage=null;run('renderImageGallery()');
 assert.ok(!el('imgGallery').innerHTML.includes(image),'Brand images stay with their brand');
 failWrites=true;context.record={id:'failed',brand:'Stitch',image:'failed.png'};
 await assert.rejects(run('persistBrandImage(record)'));
 assert.equal(stores.get('brandImages').size,1);assert.equal(context.brandImageRecords.length,1);
 console.log('PASS: database upgrade, committed saves, transactional deduplication, refresh persistence, AI thumbnail, brand scope, selection, all ad renderers, saved ad image, storage failure');
})().catch(error=>{console.error(error);process.exitCode=1;});
