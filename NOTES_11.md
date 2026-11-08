# 峡谷争锋 v1.1（白屏修复）

## 修复内容
- **根因**：Android 10+ 的 WebView 默认禁止 `file://` 页面加载同目录下的外部资源，导致 `css/ui.css`、`js/*.js`、`img/*` 全部加载失败，页面只剩白底。
- **修复一**：`WebSettings.setAllowFileAccessFromFileURLs(true)` + `setAllowUniversalAccessFromFileURLs(true)`，放开同源文件访问。
- **修复二**：把 CSS / JS / 8 张立绘全部内联进单个 `canyon.html`（2.4MB），彻底不依赖跨文件加载，与「喷气风暴」采用同一套做法。
- **修复三**：启动失败不再白屏——WebView 主资源加载错误或渲染进程退出时，直接显示错误码与设备信息。
- **修复四**：资源出错时页面顶部显示红色错误条，便于定位。

## 安装
下载 `canyon-clash-v1.1.apk` 直接覆盖安装（同包名，versionCode 2）。

若仍异常，请把屏上红色错误条或「启动失败」页里的文字发我，那串信息包含 WebView 版本与错误码。
