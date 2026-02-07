# Codewars to GitHub Sync

A Chrome Extension that allows you to sync your Codewars solutions to a GitHub repository with a single click.

## Features
- **One-Click Sync**: Sync your current solution directly from the Codewars trainer page.
- **GitHub Integration**: Authenticate securely using GitHub OAuth.
- **Organization**: Solutions are automatically organized by language, rank (kyu), and kata slug.
- **Duplicate Prevention**: Checks if the exact solution already exists to avoid redundant commits.

## Installation (Developer Mode)
1. Clone or download this repository.
2. Open Chrome/Edge and go to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked**.
5. Select the folder containing `manifest.json`.

## Configuration
1. Click the extension icon in your browser toolbar.
2. Enter your **Codewars Username** and click "Verify".
3. Click **Sign in with GitHub** and authorize the application.
4. Select a **Target Repository** from the dropdown list.

## Usage
1. Solve a Kata on Codewars.
2. Open the extension popup.
3. Click **⚡ Sync Current Solution**.
4. Check your GitHub repository to see the new file!

## Structure
Files are saved in the following structure:
`codewars/<language>/<rank>/<kata-slug>.<extension>`

| Variable | Description | Example |
| :--- | :--- | :--- |
| `codewars/` | The root directory for all synced solutions. | `codewars/` |
| `<language>/` | The programming language of the solution. | `javascript` |
| `<rank>/` | The difficulty rank of the challenge. | `6-kyu` |
| `<kata-slug>` | The URL-friendly identifier of the challenge. | `multiples-of-3-or-5` |
| `.<extension>` | The file extension corresponding to the language. | `.js` |

Example: `codewars/javascript/6-kyu/multiples-of-3-or-5.js`
