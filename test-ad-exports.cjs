const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const page=fs.readFileSync('spectron-social-studio.html','utf8');
const source=page.slice(page.indexOf('async function downloadCardImage('),page.indexOf('async function downloadTikTokVideo('));
const node={querySelectorAll:()=>[]};
let captures=0,downloads=0;
const context=vm.createContext({document:{getElementById:id=>id.startsWith('cardVisual-')?{querySelector:()=>node}:null,createElement:tag=>{assert.equal(tag,'a');return {click(){downloads++;}};},body:{appendChild(){},removeChild(){}}},window:{html2canvas:async target=>{assert.equal(target,node);captures++;return {toBlob:cb=>cb({type:'image/png'})};}},PLATFORM_FORMATS:{},currentPlatform:'Instagram / Facebook post',currentFormat:'1080x1080',askExportName:()=> 'ad.png',exportLabel:()=> 'ad',URL:{createObjectURL:()=> 'blob:ad',revokeObjectURL(){}},alert:message=>assert.fail(message)});
vm.runInContext(source,context);
(async()=>{
 for(let i=0;i<4;i++){
  await vm.runInContext(`downloadCardImage(${i})`,context);
  assert.equal((await vm.runInContext(`downloadCardImage(${i},true)`,context)).type,'image/png');
 }
 assert.equal(captures,8);assert.equal(downloads,4);
 const video=page.slice(page.indexOf('async function downloadTikTokVideo('),page.indexOf('let uploadedImages ='));
 assert.doesNotMatch(source+video,/SPECTRON_LOGO_SRC|ad-logo|ai-image-badge|drawImage\(logo/);
 assert.match(video,/const photo = await loadCanvasImage\(selectedImage\)/);
 assert.match(video,/drawCoverImage\(ctx, photo,/);
 console.log('PASS: PNG downloads and clipboard capture for four variants; video source preserves image without overlay');
})().catch(error=>{console.error(error);process.exitCode=1;});
