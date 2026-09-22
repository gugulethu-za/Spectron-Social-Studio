# Spectron Social Studio

An ad text generator for Spectron, powered by Google Gemini AI. Choose a brand, platform, and tone to create Dutch advertising text and previews. You can edit the text, adjust images, and download the results.

## Run it locally

These steps use Windows PowerShell.

### 1. Install Node.js and Netlify CLI

Install the **LTS version of Node.js** from [nodejs.org](https://nodejs.org/). It includes npm. Reopen PowerShell after installing it.

Check the installation, then install Netlify CLI (only needed once):

```powershell
node --version
npm --version
npm install -g netlify-cli
netlify --version
```

### 2. Open the project folder

```powershell
cd "C:\Users\User\Downloads\spectron-social-studio"
```

Change the path if you saved the project somewhere else.

### 3. Add your Gemini API key

Get a key from [Google AI Studio](https://aistudio.google.com/apikey).

Copy the example settings if `.env` does not already exist, then open it:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Replace the placeholder with your actual key, then save and close Notepad:

```dotenv
GEMINI_API_KEY=your_actual_google_gemini_key
```

**GEMINI_API_KEY is the only required environment variable.** Keep your key private. The `.gitignore` excludes `.env`; do not put the key in the HTML or commit it to Git.

### 4. Start the app

```powershell
netlify dev --offline --port 8888
```

This runs the page and its Netlify function using your local `.env`. The `--offline` flag skips linking to a Netlify project; Gemini still needs an internet connection.

Leave PowerShell running and open **http://localhost:8888** in your browser. Use this address instead of double-clicking the HTML file.

Choose your options and click **Genereer advertentie**. If the result says **offline modus**, the built-in fallback was used instead of Gemini. Check your API key and internet connection.

Press **Ctrl+C** to stop. Restart the command after changing `.env`.

See Netlify's [local development guide](https://docs.netlify.com/api-and-cli-guides/cli-guides/local-development/) for more details.

## Save, duplicate, and copy

Each generated ad now has **Opslaan** (Save) and **Dupliceren** (Duplicate).
Duplicate lets you select two to four channels and saves the entire batch:
Facebook 1080×1080, Instagram Post 1080×1350, Instagram Story and TikTok 1080×1920.
Text, image, and image adjustments are preserved. Saved previews appear below the editor;
choose **Openen en bewerken** to edit one and **Opslaan** to update it.
Saved ads use IndexedDB in the current browser and site address. Clearing site data removes them.

**Kopieer tekst** copies the edited text; **Kopieer afbeelding** copies the rendered PNG.
Image clipboard access requires a supporting browser on HTTPS or localhost and clipboard permission.
The existing download buttons remain available.

Local verification:

1. Generate an ad and edit its headline, body, and image positioning.
2. Save, refresh, and reopen it; check that the content and adjustments survived.
3. Duplicate into two, three, then four formats; inspect each preview and reopen it.
4. Download the images and check their pixel dimensions; inspect vertical text margins and confirm no logo overlay or AI badge is added.
5. Copy text into a text editor and copy an image into an app that accepts pasted images.
6. Edit a saved ad and save again; its existing library entry should update.

Run `node test-studio-library.cjs` for isolated logic checks with simulated browser storage
and clipboard. Actual browser persistence, rendering, and clipboard pasting still need the checks above.

## Deploy to Netlify

### Set the production API key

In your Netlify project's **Environment variables** settings, add:

| Name | Value |
| --- | --- |
| `GEMINI_API_KEY` | Your Google AI Studio API key |

Make it available to **Functions** in the **Production** context (or all scopes and contexts). Your local `.env` does not configure the live site. Deploy again after changing the production key.

The included `netlify.toml` already sets:

- Publish directory: `.` (the project folder)
- Functions directory: `netlify/functions`
- No build command is needed.

### Option A: Deploy through Git

If your repository is connected to Netlify with automatic deployments enabled, commit your changes and push to the configured production branch:

```powershell
git status
git add README.md spectron-social-studio.html netlify/functions/generate.js netlify.toml .env.example .gitignore
git commit -m "Update Spectron Social Studio"
git push
```

Review `git status` first and add only the files you want to publish. Never add `.env`. Netlify deploys after the push; check its **Deploys** page for progress.

If you downloaded this project as a ZIP, use the manual option below, or first create a Git repository and connect it to Netlify.

### Option B: Deploy manually

From the project folder, sign in and link to your Netlify project (only needed once):

```powershell
netlify login
netlify link
```

If you do not have a Netlify project yet, create one in the Netlify dashboard, then link it. Add the production API key as described above.

Deploy the page and function:

```powershell
netlify deploy --prod
```

This updates the live site. Open the production URL printed in the terminal and test generation. See the [Netlify deploy command reference](https://cli.netlify.com/commands/deploy/) for details.

## AI Background

Select a gallery image or upload a PNG, JPEG, or WebP (up to 3 MB), then click
**AI Background**. Describe the background and click **Generate**. Review the
preview, choose **Afbeelding gebruiken**, **Opnieuw genereren**, or **Terug naar origineel**.
Regeneration always starts from the original image. Gemini is instructed to preserve
the subject, but review fine details before accepting. Accepted images use the existing
ad preview, save, duplicate, and download flows.

No additional dependencies or environment variables are required. The new Netlify
function reuses server-side `GEMINI_API_KEY` and the existing Gemini REST integration,
using `gemini-2.5-flash-image`. The Google project must have access and quota for this
image model (billing may be required). Run through Netlify Dev as described above.

Run `node test-ai-background.cjs` for mocked API and editor lifecycle checks, alongside
`node test-studio-library.cjs`. No lint or TypeScript configuration is present.

### Accepted AI images in Brand Images

**Afbeelding gebruiken** saves the generated image to the selected brand's image
library and selects it immediately. Saved AI thumbnails have a small **AI** badge
and remain available after refresh in this browser and site address. Images accepted
without a selected brand remain available across brands, like standalone uploads.
Repeated acceptance does not create duplicate images. Restoring the original does
not save an unaccepted preview or delete an image that was already accepted.

AI image records include a unique ID, source, background prompt, creation timestamp,
and original image reference. They use a new store in the existing IndexedDB
saved-ad database; the upgrade preserves saved ads. Clearing browser site data
removes saved ads and AI images. Existing ordinary uploads remain session-only.
If storage is unavailable or full, an error appears and the preview remains for retry.
Close older Spectron tabs if a database upgrade is blocked.

Run `node test-brand-images.cjs` for persistence, gallery selection, duplicate
prevention, and advertisement rendering checks, in addition to the two existing tests.
