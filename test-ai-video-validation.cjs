const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const page=fs.readFileSync('spectron-social-studio.html','utf8');
assert.doesNotMatch(page,/aiVideoHelp|Gebruik de geselecteerde Brand Image voor/);
assert.match(page,/<details class="selected-image-details" hidden>/);
assert.match(page,/id="aiVideoNoImage"[^>]*hidden/);
const els={outputType:{value:'ai-video'},aiVideoOptions:{},generateAIVideoBtn:{setAttribute(){}},aiVideoNoImage:{hidden:true},aiVideoSourcePreview:{},aiVideoAspect:{value:'9:16'}};
let requests=0,confirmations=0;
const context=vm.createContext({document:{getElementById:id=>els[id]},window:{addEventListener(){}},selectedImage:null,getFormatSpec:()=>({}),fetch(){requests++;throw Error('Unexpected network request');}});
vm.runInContext(fs.readFileSync('ai-video.js','utf8'),context);
vm.runInContext('syncAIVideoImage=window.syncAIVideoImage',context);
context.requestAIVideoConfirmation=async()=>{confirmations++;return false;};
(async()=>{
 context.updateVideoMode();assert.equal(els.aiVideoNoImage.hidden,true);assert.equal(els.generateAIVideoBtn.disabled,false);
 await context.generateAIVideo();assert.equal(els.aiVideoNoImage.hidden,false);assert.equal(confirmations,0);assert.equal(requests,0);
 context.selectedImage='data:image/png;base64,YWJj';context.window.syncAIVideoImage();assert.equal(els.aiVideoNoImage.hidden,true);assert.equal(els.aiVideoSourcePreview.src,context.selectedImage);
 await context.generateAIVideo();assert.equal(confirmations,1);assert.equal(requests,0);
 context.selectedImage=null;context.window.syncAIVideoImage();assert.equal(els.aiVideoNoImage.hidden,true);assert.equal(els.generateAIVideoBtn.disabled,false);
 console.log('PASS: hidden source section, click-only missing-image validation, selected image retained and confirmation cancellation sends no request');
})().catch(error=>{console.error(error);process.exitCode=1;});
