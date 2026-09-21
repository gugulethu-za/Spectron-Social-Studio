/* Image editing uses the same server-side Gemini key as ad generation. */
let backgroundOriginal = null;
let backgroundAccepted = null;
let backgroundPreview = null;
let backgroundRequest = null;
let backgroundSaving = false;
let backgroundPreviewMetadata = null;
const backgroundElement = id => document.getElementById(id);
function syncBackgroundImage() {
  if(selectedImage !== backgroundOriginal && (!backgroundAccepted || selectedImage !== backgroundAccepted)) {
    backgroundRequest?.abort();
    backgroundRequest = null;
    backgroundOriginal = selectedImage;
    backgroundAccepted = null;
    backgroundPreview = null;
    backgroundElement('backgroundPanel').hidden = true;
    backgroundElement('backgroundDescription').value = '';
    backgroundElement('backgroundError').textContent = '';
  }
  backgroundElement('backgroundButton').hidden = !selectedImage;
  renderBackgroundControls();
}
function renderBackgroundControls() {
  const busy = !!backgroundRequest || backgroundSaving;
  backgroundElement('backgroundPanel').setAttribute('aria-busy', String(busy));
  backgroundElement('backgroundGenerate').disabled = busy;
  backgroundElement('backgroundGenerate').textContent = busy ? 'Bezig met genereren…' : backgroundPreview ? 'Opnieuw genereren' : 'Generate';
  backgroundElement('backgroundDescription').disabled = busy;
  backgroundElement('backgroundAccept').disabled = busy || !backgroundPreview;
  backgroundElement('backgroundRestore').disabled = backgroundSaving;
  backgroundElement('backgroundAccept').hidden = !backgroundPreview;
  backgroundElement('backgroundStatus').textContent = busy ? 'Achtergrond wordt gegenereerd…' : '';
  const preview = backgroundElement('backgroundPreview');
  preview.hidden = !backgroundPreview;
  if(backgroundPreview) preview.src = backgroundPreview;
  else preview.removeAttribute('src');
}
function openBackground() {
  syncBackgroundImage();
  if(!selectedImage) return;
  backgroundElement('backgroundPanel').hidden = false;
  backgroundElement('backgroundDescription').focus();
}
async function backgroundImageData(src, signal) {
  const response = await fetch(src, {signal});
  if(!response.ok) throw new Error('De originele afbeelding kon niet worden geladen.');
  const blob = await response.blob();
  if(!['image/png','image/jpeg','image/webp'].includes(blob.type)) throw new Error('Gebruik een PNG-, JPEG- of WebP-afbeelding.');
  if(blob.size > 3 * 1024 * 1024) throw new Error('De afbeelding is te groot (maximaal 3 MB).');
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('De afbeelding kon niet worden gelezen.'));
    reader.readAsDataURL(blob);
  });
}
async function generateBackground() {
  if(backgroundRequest || backgroundSaving) return;
  const error = backgroundElement('backgroundError');
  error.textContent = '';
  const description = backgroundElement('backgroundDescription').value.trim();
  if(!selectedImage || !backgroundOriginal) { error.textContent = 'Selecteer eerst een afbeelding.'; return; }
  if(!description || description.length > 1000) { error.textContent = 'Beschrijf de achtergrond (maximaal 1000 tekens).'; return; }
  const metadata = {brand:backgroundElement('brand').value, prompt:description, originalImage:backgroundOriginal, originalImageId:brandImageRecords.find(item => item.image === backgroundOriginal)?.id || null};
  const request = new AbortController();
  backgroundRequest = request;
  const timer = setTimeout(() => request.abort(), 65000);
  renderBackgroundControls();
  try {
    const image = await backgroundImageData(backgroundOriginal, request.signal);
    if(request.signal.aborted) throw new Error('Genereren geannuleerd.');
    const response = await fetch('/.netlify/functions/generate-ai-image', {
      method:'POST', headers:{'Content-Type':'application/json'}, signal:request.signal,
      body:JSON.stringify({image, description})
    });
    const result = await response.json();
    if(!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Genereren is mislukt. Probeer opnieuw.');
    if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(result.image || '')) throw new Error('Geen geldige afbeelding ontvangen. Probeer opnieuw.');
    if(backgroundRequest === request) { backgroundPreview = result.image; backgroundPreviewMetadata = metadata; }
  } catch(e) {
    if(backgroundRequest === request) error.textContent = request.signal.aborted ? 'Genereren duurde te lang. Probeer opnieuw.' : e instanceof SyntaxError ? 'Ongeldig antwoord van de server. Probeer opnieuw.' : e.message;
  } finally {
    clearTimeout(timer);
    if(backgroundRequest === request) { backgroundRequest = null; renderBackgroundControls(); }
  }
}
function applyBackgroundImage(src) {
  if(!brandImageRecords.some(item => item.image === src) && !uploadedImages.includes(src)) uploadedImages.unshift(src);
  selectImage(src);
}
async function acceptBackground() {
  if(backgroundRequest || backgroundSaving || !backgroundPreview || !backgroundPreviewMetadata) return;
  const preview = backgroundPreview;
  const original = backgroundOriginal;
  const metadata = backgroundPreviewMetadata;
  backgroundSaving = true;
  backgroundElement('backgroundError').textContent = '';
  renderBackgroundControls();
  let saved = false;
  try {
    await persistBrandImage({id:crypto.randomUUID(), source:'ai-background', image:preview,
      createdAt:new Date().toISOString(), ...metadata});
    saved = true;
    if(backgroundPreview === preview && backgroundOriginal === original && backgroundElement('brand').value === metadata.brand) {
      backgroundAccepted = preview;
      applyBackgroundImage(preview);
    } else renderImageGallery();
  } catch {
    backgroundElement('backgroundError').textContent = 'Afbeelding kon niet worden opgeslagen. Controleer vrije browseropslag en probeer opnieuw. De preview blijft beschikbaar.';
  } finally {
    backgroundSaving = false;
    renderBackgroundControls();
    if(saved) backgroundElement('backgroundStatus').textContent = 'AI image added to Brand Images.';
  }
}
function restoreBackground() {
  if(backgroundSaving) return;
  backgroundRequest?.abort();
  backgroundRequest = null;
  backgroundPreview = null;
  backgroundElement('backgroundError').textContent = '';
  if(backgroundOriginal) applyBackgroundImage(backgroundOriginal);
  backgroundAccepted = null;
  renderBackgroundControls();
}
syncBackgroundImage();
