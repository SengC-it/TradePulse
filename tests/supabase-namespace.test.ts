import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationFiles = [
  "supabase/migrations/20260816000000_initial_schema.sql",
  "supabase/migrations/20260816010000_m0_review_remediation.sql",
  "supabase/migrations/20260823000000_signal_advisory.sql",
  "supabase/migrations/20260823010000_signal_evaluations.sql",
] as const;

const migrationSql = migrationFiles
  .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
  .join("\n");
const runtimeStore = readFileSync(resolve(process.cwd(), "src/lib/signal-advisory/store.ts"), "utf8");

const expectedTables = [
  "tp_strategy_versions",
  "tp_signals",
  "tp_signal_scores",
  "tp_signal_results",
  "tp_user_decisions",
  "tp_notifications",
  "tp_scan_runs",
  "tp_system_events",
  "tp_backtest_runs",
  "tp_backtest_signals",
  "tp_authorized_users",
  "tp_signal_advisories",
  "tp_signal_evaluations",
] as const;

const legacyTables = [
  "strategy_versions",
  "signals",
  "signal_scores",
  "signal_results",
  "user_decisions",
  "notifications",
  "scan_runs",
  "system_events",
  "backtest_runs",
  "backtest_signals",
  "tradepulse_authorized_users",
  "signal_advisories",
] as const;

describe("TradePulse Supabase namespace collision guard", () => {
  it("enumerates only the expected tp-prefixed public tables", () => {
    const createdTables = [...migrationSql.matchAll(/create table public\.([a-z0-9_]+)/gi)].map(
      (match) => match[1],
    );

    expect(createdTables).toEqual(expectedTables);
    expect(createdTables.every((table) => table.startsWith("tp_"))).toBe(true);
    expect(new Set(createdTables).size).toBe(expectedTables.length);
  });

  it("enables RLS for every TradePulse public table", () => {
    for (const table of expectedTables) {
      expect(migrationSql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("does not target unrelated public tables or unprefixed TradePulse names", () => {
    for (const table of legacyTables) {
      expect(migrationSql).not.toMatch(new RegExp(`public\\.${table}(?![a-z0-9_])`, "i"));
    }

    expect(migrationSql).not.toContain("public.signals");
    expect(runtimeStore).not.toMatch(/\.from\("(?:scan_runs|signal_advisories|system_events)"\)/);
    expect(runtimeStore).not.toContain('.rpc("retry_signal_advisory"');
  });

  it("keeps runtime relations and the retry RPC in the tp namespace", () => {
    for (const table of ["tp_scan_runs", "tp_signal_advisories", "tp_signal_evaluations", "tp_system_events"]) {
      expect(runtimeStore).toContain(`.from("${table}")`);
    }
    expect(runtimeStore).toContain('.rpc("tp_retry_signal_advisory"');
    expect(migrationSql).toContain("public.tp_retry_signal_advisory");
    expect(migrationSql).toContain("revoke all on table public.tp_signal_advisories from anon, authenticated");
    expect(migrationSql).toContain("grant select, insert, update, delete on table public.tp_signal_advisories to service_role");
    expect(migrationSql).toContain("revoke all on table public.tp_signal_evaluations from anon, authenticated");
    expect(migrationSql).toContain("grant select, insert, update, delete on table public.tp_signal_evaluations to service_role");
  });
});
