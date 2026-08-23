import { signIn } from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const next = first(params.next)?.startsWith("/") && !first(params.next)?.startsWith("//") ? first(params.next)! : "/dashboard";
  const hasError = first(params.error) === "invalid_credentials";

  return (
    <main className="access-required">
      <section className="access-panel login-panel" aria-labelledby="login-title">
        <p className="eyebrow">TradePulse / 登录</p>
        <h1 id="login-title">登录信号监控中心</h1>
        <p>使用管理员预先创建的 Supabase 账号登录。当前不开放公开注册。</p>
        {hasError ? <p className="form-error" role="alert">邮箱或密码不正确，请重试。</p> : null}
        <form action={signIn} className="login-form">
          <input type="hidden" name="next" value={next} />
          <label>
            邮箱
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            密码
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit">登录</button>
        </form>
        <p className="muted">登录成功后仍需获得 TradePulse Dashboard 权限。</p>
      </section>
    </main>
  );
}
