# TradePulse Dashboard V1

Dashboard V1 是中文、服务端读取的信号监控后台，入口为 `/dashboard`，包含：

- 总览：扫描、检测、正式信号、邮件发送与待复盘计数；
- 信号检测：分页查看 `tp_signal_evaluations`；
- 信号发送：查看 `tp_signal_advisories` 的脱敏发送状态；
- 信号复盘：展示正式信号，但在没有 authoritative resolved result 时保持“待复盘”；
- 策略表现：只使用已经存在的 resolved `result_r` 或回测记录，不推算本金、杠杆或 USDT 盈亏。

所有 Dashboard 页面先检查 Supabase 当前用户是否存在于启用的
`tp_authorized_users`。未授权请求不会创建 service-role client，也不会读取生产表。
页面的数据查询位于 `src/lib/dashboard/queries.ts`，仅由 Server Components 使用；
浏览器不会接触 `SUPABASE_SECRET_KEY`、SMTP 配置、完整收件邮箱或 message id。

## Evaluation observability

每次 `runSignalAdvisoryScan` 完成 Strategy Engine evaluation 后，以
`(scan_run_id, symbol, direction)` 为唯一键保存每个 evaluation。记录失败只会将
scan 标记为 `PARTIAL` 并写入系统事件，不会改变 Strategy Engine 结果、正式信号资格
或邮件发送行为。

## 当前边界

TradePulse 仍然是人工决策的合约交易信号提醒系统。Dashboard 不提供自动下单、账户、
杠杆、仓位或执行功能。TIME_EXIT、同一根 K 线 TP/SL 顺序和 forward-tracking
invalidation ordering 仍待正式规范；本版本不会生成假的 `tp_signal_results`。

Dashboard 使用现有授权框架，但本 PR 不新增登录页面；若生产环境尚未配置登录入口，
需要后续处理 `DASHBOARD_AUTH_REQUIRED_FOLLOWUP`。
