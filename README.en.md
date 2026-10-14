<p align="center"><img src="assets/fate-dev-banner.svg" alt="DSH Desktop · fate-dev community extensions: Workspace, Files, Copilot, and Logcat" width="100%"></p>

<h1 align="center">fate-dev · Extended for your workflow</h1>

<p align="center">This page covers additions maintained on fate-dev beyond upstream DSH Desktop. For the upstream product overview, visit the <a href="https://github.com/anywhere-labs/dsh-desktop">upstream project</a>.<br><a href="README.md">简体中文</a></p>

<p align="center"><strong>Multi-directory workspaces</strong>　·　<strong>Files shortcuts</strong>　·　<strong>GitHub Copilot</strong>　·　<strong>Android Logcat</strong>　·　<strong>Git Review</strong></p>

---

## Multi-directory workspaces

Keep multiple code directories within reach in one workspace. The primary directory remains the workspace identity and session working directory, while attached directories are available from the Files browser. Switching the browser root never silently changes the Agent's session context. Windows currently supports the primary directory only.

<p align="center"><img src="assets/readme/workspace.png" alt="Switch between the primary and attached directories in Files" width="88%"></p>

## Files tree shortcuts

Go from the file tree straight to common actions: reveal an item in the system file manager, open it in VS Code, copy an absolute or relative path, or insert a workspace reference into an Agent conversation. Drag-and-drop inserts a structured reference; it does not upload file contents into the conversation.

<p align="center"><img src="assets/readme/files-shortcuts.png" alt="Context actions for a file-tree item" width="32%"></p>

## Git Review and code review

Git Review presents committed changes for the current session and supports switching between authorized workspace roots. The review directory and Git panel remain independent; local paths and repository details in the screenshots have been redacted.

<table>
  <tr>
    <td width="50%"><img src="assets/readme/code-review.png" alt="Code review directory and multiple workspace roots" width="100%"></td>
    <td width="50%"><img src="assets/readme/git-review.png" alt="Git Review changes and commit graph" width="100%"></td>
  </tr>
</table>

## GitHub Copilot sign-in and model integration

Authorize with a GitHub device code, then choose available Copilot models from the DSH Desktop model picker. Account connection status and the model list are presented together in model settings.

<p align="center"><img src="assets/readme/copilot.png" alt="GitHub Copilot connection status and available models" width="66%"></p>

## Android Logcat integration

Select a device through adb and inspect its live Logcat stream on desktop. Narrow results by process, Tag, excluded Tags, or message regex; pause or resume display, copy or export visible logs, and capture a device screenshot.

<p align="center"><img src="assets/readme/android-logcat.png" alt="Android Logcat device selection and log filters" width="100%"></p>

## Plugins installed in the local Desktop Profile

The table below records the third-party plugins currently installed and enabled in this machine's `desktop` Profile. Versions come from the local Profile manifest; review each author's package and permissions before use.

| Plugin | Version | Role |
| --- | ---: | --- |
| `@michengai/dsh-archive-manager` | 1.0.16 | Archive management |
| `@michengai/dsh-automation` | 0.1.61 | Task automation |
| `@michengai/dsh-btw` | 0.1.18 | BTW extension |
| `@michengai/dsh-skills-manager` | 1.1.13 | Skills management |
| `@smalltailqwq/dsh-client-ui-skin-maid-atelier` | 0.1.7 | Client theme |
| `@wxg-prc-cpg/browser-skill-dsh-plugin` | 0.3.2 | Browser automation skill |
| `billion-context` | 0.1.181 | Context enhancement |
| `dsh-dream-skin` | 10.10.0 | UI theme |
| `dsh-ffmpeg` | 0.4.5 | Audio/video processing |
| `dsh-figma-mcp` | 0.6.0 | Figma MCP integration |
| `dsh-file-review` | 0.8.8 | File review |
| `dsh-ide-git` | 0.16.3 | Git panel |
| `dsh-image-viewer` | 0.1.9 | Image viewer |
| `dsh-prompt` | 0.4.9 | Prompt tools |
| `dsh-rewind-plugin` | 0.15.3 | Session rewind |
| `dsh-session-recycle-bin` | 0.4.3 | Session recycle bin |
| `meow-memory` | 0.31.0 | Cross-session memory |

## Ubuntu Stable downloads

The GitHub Release keeps only the Stable channel. Download the fate-dev Ubuntu x64 builds here:

| Version | AppImage | Debian / Ubuntu |
| --- | --- | --- |
| Stable 2.0.17 | [Download](https://github.com/FateFeng/dsh-desktop/releases/download/v2.0.17-fate-dev/DSH-Desktop-2.0.17-x86_64.AppImage) | [Download](https://github.com/FateFeng/dsh-desktop/releases/download/v2.0.17-fate-dev/DSH-Desktop-2.0.17-amd64.deb) |

---

<p align="center"><sub>README interface captures are kept in <a href="assets/readme/">assets/readme/</a>; local paths, repository details, and personal information in the review screenshots have been redacted.</sub></p>

> **Security note:** screenshots and documentation do not include local sessions, the memory database, credentials, or access tokens. Continue checking new assets and build outputs before publishing so local data is never packaged into the repository or Release.

> **Privacy note:** the plugin list records package names and versions only; it does not record local directories, accounts, session contents, or plugin configuration.

---

<p align="center"><sub>Original interface captures are in <a href="dsh-plugin-desktop/docs/screenshots/">dsh-plugin-desktop/docs/screenshots/</a>.</sub></p>
