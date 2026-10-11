# fate-dev 分支额外功能

本 README 只介绍 `fate-dev` 分支相较上游 DSH Desktop 的额外改动，不重复上游产品介绍。 [English](README.en.md)

## 多目录工作区

保留主工作区作为工作区身份和会话工作目录，同时允许附加其他源目录，并在文件浏览器中切换访问；切换文件浏览器目录不会更改会话工作目录。Windows 当前仅支持主目录。

![多目录工作区：在文件浏览器中切换主目录和附加目录](dsh-plugin-desktop/docs/screenshots/workspace.png)

## 文件树快捷操作

文件和目录的快捷菜单支持在系统文件管理器中显示、用 VS Code 打开、复制绝对或相对路径，以及将工作区引用插入 Agent 对话。拖入文件或目录时插入结构化工作区引用，不上传文件内容。

![文件树快捷菜单](dsh-plugin-desktop/docs/screenshots/short.png)

## GitHub Copilot 登录与模型接入

通过 GitHub 设备码授权登录 Copilot，并将可用的 Copilot 模型加入 DSH Desktop 模型选择器。

![GitHub Copilot 已连接及其可用模型](dsh-plugin-desktop/docs/screenshots/copilot.png)

## Android Logcat 集成

通过 adb 选择 Android 设备并查看实时日志，支持进程、Tag、排除 Tag 和消息正则过滤，以及暂停/继续显示、复制或导出可见日志和设备截图。

![Android Logcat 面板](dsh-plugin-desktop/docs/screenshots/android_logcat.png)

---

本分支所列截图存放于 [`dsh-plugin-desktop/docs/screenshots/`](dsh-plugin-desktop/docs/screenshots/)。
