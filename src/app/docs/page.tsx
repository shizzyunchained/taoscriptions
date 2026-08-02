import type { Metadata } from "next";
import Link from "next/link";
import { SiteMark } from "@/components/site-mark";

export const metadata: Metadata = {
  title: "Protocol Thesis & Fact Check — Bittensor Relics",
  description: "What Bittensor Relics proves on-chain, what the subnet would decentralize, and which scarcity claims the current Bittensor runtime supports.",
};

const claims = [
  {
    verdict: "Verified",
    tone: "true",
    claim: "Ordinals depends on an off-chain index for interpreted state.",
    detail: "Bitcoin contains the inscription bytes, but ord maintains an external index to recognize inscriptions, track sat locations, and calculate inscription numbers. The index can be rebuilt from Bitcoin, yet applications still depend on an indexer to read the protocol conveniently.",
  },
  {
    verdict: "Verified",
    tone: "true",
    claim: "A bounded Relic image can be stored in a finalized Subtensor transaction.",
    detail: "The current Relics protocol embeds a compressed WebP directly in System.remark_with_event. The reference client caps the image at 12,288 bytes and the complete envelope at 16,384 bytes. No IPFS or external media URL is required.",
  },
  {
    verdict: "Architecture",
    tone: "planned",
    claim: "Subnet miners can reconstruct and serve the Relics index.",
    detail: "This fits Bittensor’s commodity model: miners produce answers and validators score them. Our three-miner checkpoint prototype demonstrates the rule, but no Relics subnet is registered and no live miner network exists yet.",
  },
  {
    verdict: "Corrected",
    tone: "corrected",
    claim: "Validators derive inscription order; they do not invent or assign it.",
    detail: "Canonical order must come from finalized block number, extrinsic position, and the protocol’s activation rules. Validators independently replay those facts and reject divergent answers. This avoids letting any validator redefine history.",
  },
  {
    verdict: "Qualified",
    tone: "planned",
    claim: "The chain can prove authenticity—but only chain authenticity.",
    detail: "A proof can establish the exact bytes, signer, finalized position, matching burn, and transaction hash. It cannot prove that an image is original, that the signer owns its copyright, or that a depicted event really happened.",
  },
  {
    verdict: "Verified rule",
    tone: "true",
    claim: "Every accepted Relic can require a subnet-alpha burn.",
    detail: "Relics v1 accepts a mint only when one atomic batch contains a successful add_stake_burn and the matching inscription. Bittensor documents add_stake_burn as buying alpha first and immediately burning the acquired amount.",
  },
  {
    verdict: "False today",
    tone: "false",
    claim: "Every Buy & Burn mint reduces the subnet token supply.",
    detail: "The current Bittensor runtime explicitly describes burn_alpha as supply-neutral: it burns the user’s alpha stake without reducing SubnetAlphaOut. The separate recycle_alpha / add_stake_recycle path reduces SubnetAlphaOut. Relics currently uses Buy & Burn, not Recycle.",
  },
  {
    verdict: "Qualified",
    tone: "planned",
    claim: "A 10,000 SCORE Relic is provable after finalization.",
    detail: "The finalized event can prove that 10,000 SCORE was actually burned. However, add_stake_burn takes TAO as input and the received alpha varies with pool price, fees, and price impact. The current forge targets a TAO spend, not an exact alpha output.",
  },
  {
    verdict: "Protocol-level",
    tone: "planned",
    claim: "Relics can be transferred, but they are not native Subtensor NFTs.",
    detail: "Ownership and transfers are deterministic Relics protocol rules derived from signed, finalized remarks. Subtensor itself does not currently enforce a Relic NFT ownership primitive, and marketplace settlement remains intentionally disabled.",
  },
];

export default function DocsPage() {
  return (
    <main className="site-shell inner-site docs-site">
      <div className="grain" aria-hidden="true" />
      <nav className="nav" aria-label="Main navigation">
        <SiteMark />
        <div className="nav-links"><Link href="/#forge">Forge</Link><Link href="/network">Network</Link><Link href="/docs">Docs</Link><span className="chain-status ready"><i aria-hidden="true" />Fact checked</span></div>
      </nav>

      <header className="docs-hero">
        <p className="eyebrow">Protocol thesis / verified 02 Aug 2026</p>
        <h1>Can Bittensor fix<br />the indexer problem?</h1>
        <div><strong>Yes—the architecture is credible.</strong><p>But the honest version is more interesting than the hype: Bittensor can decentralize the interpretation layer around on-chain Relics. The present Buy & Burn operation proves an irreversible economic sacrifice; it does not reduce alpha supply.</p></div>
      </header>

      <section className="docs-verdict">
        <span>Bottom line</span>
        <h2>The Relic is the art.<br />The burn is the proof.</h2>
        <p>That line is accurate when “proof” means a finalized record of the signer, exact image bytes, subnet, TAO committed, and actual alpha burned. The scarcity is the one-of-one chain position plus the irreversible cost attached to it—not a guaranteed reduction in the subnet’s token supply.</p>
      </section>

      <section className="docs-section" id="problem">
        <header><span>01 / The problem</span><h2>On-chain bytes can still need off-chain interpretation.</h2></header>
        <div className="docs-prose">
          <p>Ordinals puts inscription content on Bitcoin, but the chain does not natively expose “Inscription #123” as consensus state. The <code>ord</code> software indexes Bitcoin transactions, recognizes inscription envelopes, follows sats, and computes numbering. Its own documentation describes an index connected to Bitcoin Core, and its reindexing guide explains rebuilding the local database after schema changes or corruption.</p>
          <p>Calling this the “biggest” Ordinals problem is an opinion. The factual point is narrower: applications rely on an off-chain interpreter for derived inscription state, even though anyone can replay the public chain and reproduce it.</p>
        </div>
      </section>

      <section className="docs-section" id="answer">
        <header><span>02 / The Bittensor answer</span><h2>Turn deterministic indexing into a scored commodity.</h2></header>
        <div className="docs-architecture">
          <article><span>Miners</span><h3>Replay finalized history</h3><p>Independent indexers reconstruct valid mints, exact media bytes, numbering, rejections, ownership, and transfers. They commit the result to deterministic checkpoint hashes.</p></article>
          <b aria-hidden="true">-&gt;</b>
          <article><span>Validators</span><h3>Challenge exact facts</h3><p>Validators sample checkpoints and histories, compare roots and dataset proofs, score correctness and freshness, and give zero correctness credit to divergent answers.</p></article>
          <b aria-hidden="true">-&gt;</b>
          <article><span>Dapp</span><h3>Require agreement</h3><p>The gateway accepts an answer only when a configured threshold of independent miners agrees. If quorum fails, the dapp returns no consensus instead of inventing state.</p></article>
        </div>
        <p className="docs-boundary">This subnet would decentralize availability and verification of the index. It would not move the ultimate source of truth away from finalized Subtensor blocks.</p>
      </section>

      <section className="docs-section" id="mint">
        <header><span>03 / The mint</span><h2>One signature binds sacrifice to artifact.</h2></header>
        <div className="mint-callout">
          <code>utility.batchAll([ addStakeBurn(TAO), remarkWithEvent(RELIC_BYTES) ])</code>
          <dl><div><dt>Buy</dt><dd>TAO is exchanged for the selected subnet’s alpha.</dd></div><div><dt>Burn</dt><dd>The acquired alpha stake is immediately and irreversibly burned.</dd></div><div><dt>Inscribe</dt><dd>The exact Relic payload is recorded in the same atomic transaction.</dd></div></dl>
        </div>
        <p className="docs-boundary">Atomic means both calls succeed or the entire batch rolls back. A pending transaction is never a Relic. The protocol recognizes it only after finalization and exact event verification.</p>
      </section>

      <section className="docs-section" id="score-example">
        <header><span>04 / Example</span><h2>Const, inverted. SCORE, sacrificed.</h2></header>
        <div className="score-example">
          <div className="score-art" aria-label="Conceptual on-chain image placeholder"><span>IMAGE BYTES</span><strong>CONST<br />HANDSTAND</strong><i>ON-CHAIN</i></div>
          <div><p className="eyebrow">Concept / not yet minted</p><h3>Relic #—</h3><dl><div><dt>Subnet</dt><dd>SCORE</dd></div><div><dt>Desired burn</dt><dd>10,000 SCORE</dd></div><div><dt>Proven after mint</dt><dd>Actual AlphaBurned event</dd></div><div><dt>Media</dt><dd>Exact WebP bytes in finalized remark</dd></div><div><dt>Supply effect</dt><dd>Supply-neutral under current burn semantics</dd></div></dl></div>
        </div>
        <p className="docs-boundary">To promise exactly 10,000 SCORE, the forge needs an alpha-target quote mode and must verify the finalized amount. Until then, 10,000 is a target—not a fact.</p>
      </section>

      <section className="docs-section" id="audit">
        <header><span>05 / Claim audit</span><h2>What is true, false, or still a plan.</h2></header>
        <div className="claim-audit">
          {claims.map((item) => <article className={item.tone} key={item.claim}><div><span>{item.verdict}</span><i aria-hidden="true" /></div><h3>{item.claim}</h3><p>{item.detail}</p></article>)}
        </div>
      </section>

      <section className="docs-section" id="corrected-thesis">
        <header><span>06 / Publishable thesis</span><h2>The strongest version we can defend.</h2></header>
        <blockquote>
          <p>Ordinals proved that art can live on-chain, but applications still depend on an off-chain index to interpret order, location, and ownership.</p>
          <p>Bittensor Relics turns that indexing work into a verifiable digital commodity. Miners independently replay finalized Subtensor history. Validators challenge their checkpoints. The dapp accepts only threshold agreement.</p>
          <p>Every accepted Relic binds exact on-chain media to a finalized subnet-alpha burn. A Relic can therefore prove what was inscribed, who signed it, where it finalized, and how much alpha was sacrificed.</p>
          <p>Each subnet can support a collectible culture tied to its own token economy—without pretending the burn reduces supply when the current runtime says it does not.</p>
          <strong>The Relic is the art.<br />The burn is the proof.</strong>
        </blockquote>
      </section>

      <section className="docs-section sources" id="sources">
        <header><span>07 / Primary sources</span><h2>Read the underlying rules.</h2></header>
        <div>
          <a href="https://docs.ordinals.com/overview.html" target="_blank" rel="noreferrer"><span>Ordinals</span><strong>Index architecture and on-chain inscriptions</strong></a>
          <a href="https://docs.ordinals.com/inscriptions.html" target="_blank" rel="noreferrer"><span>Ordinals</span><strong>Content, IDs, and inscription numbering</strong></a>
          <a href="https://docs.ordinals.com/guides/reindexing.html" target="_blank" rel="noreferrer"><span>Ordinals</span><strong>Rebuilding the ord index database</strong></a>
          <a href="https://www.bittensor.com/docs" target="_blank" rel="noreferrer"><span>Bittensor</span><strong>Miners produce; validators score</strong></a>
          <a href="https://www.bittensor.com/docs/internals/wasm-contracts" target="_blank" rel="noreferrer"><span>Bittensor</span><strong>Burn is supply-neutral; recycle reduces AlphaOut</strong></a>
          <a href="https://www.bittensor.com/code/pallets/subtensor/src/macros/dispatches.rs" target="_blank" rel="noreferrer"><span>Subtensor source</span><strong>add_stake_burn runtime dispatch</strong></a>
          <a href="https://paritytech.github.io/polkadot-sdk/master/substrate_test_runtime/enum.UtilityCall.html#variant.batch_all" target="_blank" rel="noreferrer"><span>Polkadot SDK</span><strong>Atomic batch_all behavior</strong></a>
          <Link href="/network"><span>Relics prototype</span><strong>Three-miner checkpoint simulation</strong></Link>
        </div>
      </section>

      <div className="network-actions docs-actions"><Link href="/#forge">Open the testnet forge</Link><Link href="/network">Inspect the proof network</Link></div>
      <footer><SiteMark className="footer-brand" /><p>Claims separated from vision. Chain facts first.</p><Link href="/">Protocol home -&gt;</Link></footer>
    </main>
  );
}
