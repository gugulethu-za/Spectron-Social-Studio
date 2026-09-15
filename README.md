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
