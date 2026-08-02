import type { Metadata } from "next";
import Link from "next/link";
import { SiteMark } from "@/components/site-mark";
import { buildPrototypeReport } from "@/lib/subnet-consensus.mjs";

export const metadata: Metadata = {
  title: "Proof Network Prototype — Bittensor Relics",
  description: "A transparent three-miner simulation of the proposed Bittensor Relics index proof network.",
};

export default function NetworkPage() {
  const report = buildPrototypeReport();
  const shortRoot = `${report.checkpoint.stateRoot.slice(0, 21)}...${report.checkpoint.stateRoot.slice(-12)}`;

  return (
    <main className="site-shell inner-site">
      <div className="grain" aria-hidden="true" />
      <nav className="nav" aria-label="Main navigation">
        <SiteMark />
        <div className="nav-links"><Link href="/#forge">Forge</Link><Link href="/explore">Explore</Link><Link href="/network">Network</Link><span className="chain-status prototype"><i aria-hidden="true" />Simulation</span></div>
      </nav>

      <section className="network-hero">
        <div>
          <p className="eyebrow">Subnet prototype 001</p>
          <h1>The subnet<br />before the subnet.</h1>
        </div>
        <div className="network-intro">
          <strong>Three miners. One dishonest answer. A 2-of-3 threshold.</strong>
          <p>This deterministic test shows how independent miners can reconstruct the Relics index while validators challenge exact chain state. The dapp accepts only matching proof responses.</p>
        </div>
      </section>

      <section className="simulation-warning">
        <strong>Conformance simulation</strong>
        <p>No subnet is registered, no miners are live, no emissions are active, and this page performs no chain or wallet transaction.</p>
      </section>

      <section className="consensus-summary" aria-label="Simulation result">
        <article><span>Gateway result</span><strong>{report.consensus.status}</strong><small>Fail closed without quorum</small></article>
        <article><span>Threshold</span><strong>{report.consensus.threshold} / {report.consensus.totalMiners}</strong><small>Identical answers required</small></article>
        <article><span>Challenge</span><strong>{report.challenge.dataset}</strong><small>Checkpoint + random nonce</small></article>
        <article><span>Chain writes</span><strong>None</strong><small>Read-only fixture</small></article>
      </section>

      <section className="miner-section">
        <header><div><p className="eyebrow">Validator scorecard</p><h2>One bad answer cannot become history.</h2></div><p>The validator compares the checkpoint, finalized block, requested dataset hash, response freshness, and identity. Correctness is mandatory; latency only affects the remaining score.</p></header>
        <div className="miner-grid">
          {report.scores.map((score) => (
            <article className={score.valid ? "valid" : "invalid"} key={score.minerId}>
              <div><span>Indexer miner</span><i>{score.valid ? "agrees" : "rejected"}</i></div>
              <h3>{score.minerId}</h3>
              <dl><div><dt>Score</dt><dd>{(score.scoreBps / 100).toFixed(2)}%</dd></div><div><dt>Latency</dt><dd>{score.latencyMs} ms</dd></div><div><dt>Proof</dt><dd>{score.valid ? "Exact" : score.failures.join(", ")}</dd></div></dl>
            </article>
          ))}
        </div>
      </section>

      <section className="checkpoint-panel">
        <div><span>Accepted checkpoint root</span><code>{shortRoot}</code></div>
        <div><span>Finalized fixture block</span><strong>#{report.checkpoint.blockNumber}</strong></div>
        <div><span>Agreed miners</span><strong>{report.consensus.agreedMiners.join(" + ")}</strong></div>
        <div><span>Dissent rejected</span><strong>{report.consensus.dissentingMiners.join(", ")}</strong></div>
      </section>

      <section className="network-flow">
        <article><span>01</span><h3>Miners replay</h3><p>Each indexer derives Relics from finalized Subtensor history and commits every canonical dataset to one root.</p></article>
        <article><span>02</span><h3>Validators challenge</h3><p>A checkpoint, dataset, and unpredictable nonce bind each response so stale or substituted answers fail.</p></article>
        <article><span>03</span><h3>The dapp requires quorum</h3><p>The gateway serves the answer only when the configured threshold agrees. Otherwise it returns no consensus.</p></article>
      </section>

      <div className="network-actions"><a href="/api/v1/network/prototype">Inspect the JSON proof</a><Link href="/#forge">Return to the testnet forge</Link></div>
      <footer><SiteMark className="footer-brand" /><p>Prototype math, openly testable. Subnet registration comes later.</p><Link href="/">Protocol home -&gt;</Link></footer>
    </main>
  );
}
