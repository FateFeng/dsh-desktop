<p align="center"><img src="assets/fate-dev-banner.svg" alt="DSH Desktop · fate-dev community extensions: Workspace, Files, Copilot, and Logcat" width="100%"></p>

<h1 align="center">fate-dev · Extended for your workflow</h1>

<p align="center">This page covers additions maintained on fate-dev beyond upstream DSH Desktop. For the upstream product overview, visit the <a href="https://github.com/anywhere-labs/dsh-desktop">upstream project</a>.<br><a href="README.md">简体中文</a></p>

<p align="center"><strong>Multi-directory workspaces</strong>　·　<strong>Files shortcuts</strong>　·　<strong>GitHub Copilot</strong>　·　<strong>Android Logcat</strong></p>

---

## Multi-directory workspaces

Keep multiple code directories within reach in one workspace. The primary directory remains the workspace identity and session working directory, while attached directories are available from the Files browser. Switching the browser root never silently changes the Agent's session context. Windows currently supports the primary directory only.

<p align="center"><img src="assets/readme/workspace.png" alt="Switch between the primary and attached directories in Files" width="88%"></p>

## Files tree shortcuts

Go from the file tree straight to common actions: reveal an item in the system file manager, open it in VS Code, copy an absolute or relative path, or insert a workspace reference into an Agent conversation. Drag-and-drop inserts a structured reference; it does not upload file contents into the conversation.

<p align="center"><img src="assets/readme/files-shortcuts.png" alt="Context actions for a file-tree item" width="32%"></p>

## GitHub Copilot sign-in and model integration

Authorize with a GitHub device code, then choose available Copilot models from the DSH Desktop model picker. Account connection status and the model list are presented together in model settings.

<p align="center"><img src="assets/readme/copilot.png" alt="GitHub Copilot connection status and available models" width="66%"></p>

## Android Logcat integration

Select a device through adb and inspect its live Logcat stream on desktop. Narrow results by process, Tag, excluded Tags, or message regex; pause or resume display, copy or export visible logs, and capture a device screenshot.

<p align="center"><img src="assets/readme/android-logcat.png" alt="Android Logcat device selection and log filters" width="100%"></p>

## Ubuntu downloads

These are fate-dev builds. Download the Ubuntu x64 packages from the [GitHub Release](https://github.com/FateFeng/dsh-desktop/releases/tag/v2.0.17-fate-dev):

| Version | AppImage | Debian / Ubuntu |
| --- | --- | --- |
| Stable 2.0.17 | [Download](https://github.com/FateFeng/dsh-desktop/releases/download/v2.0.17-fate-dev/DSH-Desktop-2.0.17-x86_64.AppImage) | [Download](https://github.com/FateFeng/dsh-desktop/releases/download/v2.0.17-fate-dev/DSH-Desktop-2.0.17-amd64.deb) |
| Beta 2.0.17-beta.1 | [Download](https://github.com/FateFeng/dsh-desktop/releases/download/v2.0.17-fate-dev/DSH-Desktop-Beta-2.0.17-beta.1-x86_64.AppImage) | [Download](https://github.com/FateFeng/dsh-desktop/releases/download/v2.0.17-fate-dev/DSH-Desktop-Beta-2.0.17-beta.1-amd64.deb) |

---

<p align="center"><sub>Original interface captures are in <a href="dsh-plugin-desktop/docs/screenshots/">dsh-plugin-desktop/docs/screenshots/</a>; README-ready crops and color treatments are in <a href="assets/readme/">assets/readme/</a>.</sub></p>
