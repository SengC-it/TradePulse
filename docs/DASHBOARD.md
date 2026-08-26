# TradePulse Dashboard V1

Dashboard V1 是中文、服务端读取的信号监控后台，入口为 `/dashboard`，包含：

- 总览：扫描、检测、正式信号、邮件发送与未完成复盘计数；
- 信号检测：分页查看 `tp_signal_evaluations`；
- 信号发送：查看 `tp_signal_advisories` 的脱敏发送状态；
- 信号复盘：展示已发送正式信号及 `tp_advisory_reviews` 的真实复盘状态；
- 策略表现：生产提醒只使用 `tp_advisory_reviews` 的 TP / SL 复盘结果；没有已结算样本时显示“暂无已结算 TP / SL 复盘样本”，不读取 `tp_signal_results` 推算生产盈亏；研究 / 回测记录单独展示。

所有 Dashboard 页面先检查 Supabase 当前用户是否存在于启用的
`tp_authorized_users`。未登录请求会跳转 `/login`；已登录但未授权会显示权限提示。
未授权请求不会创建 service-role client，也不会读取生产表。登录页使用 Supabase
email/password，当前不开放公开注册；退出登录会清除当前会话。
页面的数据查询位于 `src/lib/dashboard/queries.ts`，仅由 Server Components 使用；
浏览器不会接触 `SUPABASE_SECRET_KEY`、SMTP 配置、完整收件邮箱或 message id。

## Evaluation observability

每次 `runSignalAdvisoryScan` 完成 Strategy Engine evaluation 后，以
`(scan_run_id, symbol, direction)` 为唯一键保存每个 evaluation。记录失败只会将
scan 标记为 `PARTIAL` 并写入系统事件，不会改变 Strategy Engine 结果、正式信号资格
或邮件发送行为。

## 生产提醒复盘边界

Production advisory review/result identity 使用 `tp_advisory_reviews` 的文本
`signal_id`；不复用 `tp_signal_results`。`/dashboard/reviews` 只展示已发送
提醒及其复盘状态。首页“未完成复盘”包括没有复盘行、`WAITING_ENTRY` 和 `OPEN`；
`TP`、`SL`、`NO_ENTRY`、`AMBIGUOUS` 不计入未完成数量。`/dashboard/performance`
只从 TP / SL 终态计算理论 R，未结算时显示“暂无已结算 TP / SL 复盘样本”。

## 当前边界

TradePulse 仍然是人工决策的合约交易信号提醒系统。Dashboard 不提供自动下单、账户、
杠杆、仓位或执行功能。TIME_EXIT、同一根 K 线 TP/SL 顺序和 forward-tracking
invalidation ordering 仍待正式规范；本版本不会生成假的 `tp_signal_results`。

Dashboard 使用现有 Supabase Auth；本 PR 不创建 Production 用户、不授予
`tp_authorized_users` 权限，也不执行 Production 数据库迁移。
