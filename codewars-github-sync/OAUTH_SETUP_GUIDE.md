# GitHub OAuth & Codewars Sync Setup Guide

To enable "Login with GitHub" and Codewars account syncing, you need to configure a GitHub OAuth Application.

## 1. Create a GitHub OAuth App
1. Go to [GitHub Developer Settings > OAuth Apps](https://github.com/settings/developers).
2. Click **New OAuth App**.
3. Fill in the following:
   - **Application Name**: `Codewars to GitHub Sync` (or your preference)
   - **Homepage URL**: `https://www.codewars.com`
   - **Authorization callback URL**: 
     - You need your **Extension ID**. 
     - If you are loading this unpacked, go to `chrome://extensions`, find the extension, and copy the ID (e.g., `abcdefghijklmnop...`).
     - The URL should be: `https://<YOUR_EXTENSION_ID>.chromiumapp.org/`
     - *Note*: If the ID changes (e.g. on a new machine), you must update this. To keep it static, you need to add a `"key"` to `manifest.json`.

4. Click **Register Application**.

## 2. Get Credentials
Once created, you will see:
- **Client ID**: (e.g., `Ov23li...`)
- **Client Secret**: Click "Generate a new client secret" (e.g., `a1b2c3...`).

## 3. Configure the Extension
Open `background.js` and find the `OAUTH_CONFIG` object (I will add this for you).
Replace the placeholders with your values:

```javascript
const OAUTH_CONFIG = {
    clientId: 'YOUR_CLIENT_ID_HERE',
    clientSecret: 'YOUR_CLIENT_SECRET_HERE', // checking in secret for client-side extension (personal use)
    redirectUri: chrome.identity.getRedirectURL() 
};
```

> **Security Note**: Storing the `clientSecret` in a Chrome Extension is generally not recommended for public extensions because users can view the source code. For a personal tool or a specific internal team, this is acceptable. For a public Web Store extension, you should use a proxy server (like a Vercel function) to handle the token exchange.

## 4. Codewars Sync
The extension will now verify your Codewars username using the public API: `https://www.codewars.com/api/v1/users/{username}`.
