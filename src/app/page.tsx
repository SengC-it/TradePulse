import {
  RESEARCH_SYMBOLS,
  STRATEGY_VERSION,
  TIMEFRAMES,
} from "@/lib/config/constants";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">M0 · Foundation &amp; Architecture</p>
        <h1 id="page-title">TradePulse</h1>
        <p className="lede">
          A private research dashboard foundation for crypto market analysis,
          candidate signals, forward tracking, and strategy analytics.
        </p>
        <div className="boundary" role="note">
          <strong>TRADEPULSE DOES NOT TRADE</strong>
          <span>
            This project does not connect to Binance private APIs, accounts, or
            order execution.
          </span>
        </div>
      </section>

      <section className="grid" aria-label="M0 scope summary">
        <article className="card">
          <p className="card-label">Research pool</p>
          <ul>
            {RESEARCH_SYMBOLS.map((symbol) => (
              <li key={symbol}>{symbol}</li>
            ))}
          </ul>
        </article>
        <article className="card">
          <p className="card-label">Baseline</p>
          <p className="metric">{STRATEGY_VERSION}</p>
          <p className="muted">
            Trend: {TIMEFRAMES.trend.toUpperCase()} · Signal: {TIMEFRAMES.signal.toUpperCase()}
          </p>
        </article>
        <article className="card">
          <p className="card-label">Next checkpoint</p>
          <p className="metric">M1</p>
          <p className="muted">Public candle adapter and validation, after review.</p>
        </article>
      </section>

      <footer className="footer">
        <span>Foundation only · No production secrets configured</span>
        <a href="/api/health">Health</a>
      </footer>
    </main>
  );
}
