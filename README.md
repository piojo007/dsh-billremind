# dsh-billremind

信用卡账单日、还款日与年费日提醒插件，运行于 DeepSeek Harness。

## 功能

- 管理账单日、还款日、年费扣取日和可选卡号尾号。
- 记录本期账单金额，并显示近期到期提醒。
- 支持全局提醒默认值和卡片级自定义提醒。
- 支持版本冲突检测、显式确认覆盖和删除后恢复。
- 支持 JSON 备份导出与导入。
- 提供中文和英文界面。

## 数据与隐私

账单数据默认保存在本地 DSH profile 数据目录（`DSH_HOME` 或 `DSH_PROFILE_DIR`），本插件不会主动上传卡片数据到第三方服务。导出备份和导入操作由用户主动触发。

建议不要把实际账单数据、备份文件或运行时状态文件提交到代码仓库。

## 开发与验证

```powershell
npm test
node --check index.js
node --check client.js
```

测试会覆盖日期边界、并发写入、版本冲突、备份校验、删除恢复、锁租约和客户端契约。

## 插件结构

- `index.js`：Host 端插件入口和 HTTP API
- `service.js`：账单业务逻辑
- `store.js`：本地持久化、锁和备份恢复
- `tools.js`：Agent 工具入口
- `client.js`：桌面 Web UI
- `cordis.patch.yml`：插件加载补丁

## 许可证

MIT License，详见 `LICENSE`。
