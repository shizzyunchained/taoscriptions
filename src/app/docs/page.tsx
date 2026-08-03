import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { SiteMark } from "@/components/site-mark";
import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  title: "Protocol Docs — Bittensor Relics",
  description: "The practical Bittensor Relics protocol manual: mint flow, on-chain media, burn evidence, indexing, ownership, APIs, and current implementation status.",
};

const navigation = [
  ["Overview", "overview"],
  ["Architecture", "architecture"],
  ["Mint transaction", "mint"],
  ["On-chain media", "media"],
  ["Future miner queue", "miner-queue"],
  ["Burn economics", "economics"],
  ["Identity & ownership", "ownership"],
  ["Proof network", "proof-network"],
  ["Claim audit", "claim-audit"],
  ["API map", "api"],
  ["Reference library", "library"],
] as const;

const claims = [
  { state: "Verified", tone: "verified", title: "The image can live in finalized Subtensor history.", body: "Relics embeds a bounded passive WebP inside remarkWithEvent. The image is not represented by an IPFS, S3, or CDN URL." },
  { state: "Verified", tone: "verified", title: "One atomic extrinsic binds the burn and inscription.", body: "Only batchAll(addStakeBurn, remarkWithEvent) qualifies. Failure of either inner call rolls back both operations." },
  { state: "Correction", tone: "corrected", title: "Buy & Burn does not currently reduce SubnetAlphaOut.", body: "The finalized AlphaBurned event proves the user's economic sacrifice. Current runtime accounting makes this burn supply-neutral, not guaranteed deflation." },
  { state: "Protocol", tone: "protocol", title: "Relics are transferable, but they are not native Subtensor NFTs.", body: "Ownership is deterministic derived state from signed finalized remarks. Subtensor itself does not expose a Relic asset balance." },
  { state: "Prototype", tone: "prototype", title: "Miners and validators can reproduce the index.", body: "The three-miner conformance simulation works, but no Relics subnet is registered and no live miner receives emissions today." },
  { state: "Testnet", tone: "ready", title: "Atomic marketplace settlement is live on testnet.", body: "Sale V2 listings authorize one exact-price purchase. The buyer payment and signed ownership receipt execute together in a finalized batchAll transaction." },
  { state: "Creator claim", tone: "protocol", title: "Collection labels are not verified membership yet.", body: "Version 1 signs a creator-declared label. Authority rules, burn thresholds, mint windows, and supply caps require a future collection declaration." },
  { state: "Boundary", tone: "corrected", title: "Chain authenticity is not artistic or legal authenticity.", body: "The proof establishes bytes, signer, time, chain position, and burn. It cannot prove originality, copyright, identity, or truth of the depicted event." },
];

const apiRows = [
  ["GET", "/api/v1/status", "Indexer chain, checkpoint, activation block, and artifact count"],
  ["GET", "/api/v1/artifacts", "Paginated finalized Relics"],
  ["GET", "/api/v1/artifacts/:id", "Artifact, burn receipt, owner, and media manifest"],
  ["GET", "/api/v1/artifacts/:id/media", "Exact verified WebP reconstructed from the chain"],
  ["GET", "/api/v1/accounts/:account/artifacts", "Current protocol-owned Relics for one SS58 account"],
  ["GET", "/api/v1/subnets/:netuid/:generation/artifacts", "Relics scoped to one subnet generation"],
  ["GET", "/api/v1/operations/:block/:extrinsic", "Accepted operation or deterministic rejection"],
  ["GET", "/api/v1/listings", "Active signed discovery listings; no settlement"],
];

function Section({ id, label, title, children }: { id: string; label: string; title: string; children: ReactNode }) {
  return (
    <section className="manual-section" id={id}>
      <header><span>{label}</span><h2>{title}</h2></header>
      {children}
    </section>
  );
}

export default function DocsPage() {
  return (
    <main className="site-shell inner-site manual-site">
      <div className="grain" aria-hidden="true" />
      <SiteNav status="Protocol v1" tone="ready" />

      <div className="manual-layout">
        <aside className="manual-sidebar">
          <div className="manual-sidebar-head"><span>Documentation</span><strong>Field Manual</strong><small>Draft v1 · Testnet</small></div>
          <nav aria-label="Documentation sections"><ol>{navigation.map(([label, id], index) => <li key={id}><a href={`#${id}`}><i>{String(index + 1).padStart(2, "0")}</i>{label}</a></li>)}</ol></nav>
          <div className="manual-sidebar-foot"><i aria-hidden="true" /><span>Experiment</span><p>Use testnet TAO only. Atomic purchases are experimental; mainnet remains disabled.</p></div>
        </aside>

        <div className="manual-content">
          <header className="manual-hero" id="overview">
            <div className="manual-kicker"><span>Protocol documentation</span><i>Last revised 03 Aug 2026</i></div>
            <h1>Build the artifact.<br /><em>Prove the history.</em></h1>
            <p>Bittensor Relics is a non-EVM protocol for binding exact on-chain media to a finalized subnet-alpha burn. This manual explains what the chain proves, what the index derives, and what the proposed subnet must verify.</p>
            <div className="manual-hero-actions"><Link href="/#forge">Enter the Forge <span>→</span></Link><Link href="/blackpaper">Read the Blackpaper</Link></div>
            <div className="manual-status-strip"><div><span>Network</span><strong>Testnet only</strong></div><div><span>Execution</span><strong>Native SS58</strong></div><div><span>Media</span><strong>Exact WebP bytes</strong></div><div><span>Indexer</span><strong>Built / not deployed</strong></div></div>
          </header>

          <section className="manual-alert"><div><span>!</span></div><p><strong>Experimental software.</strong> Never risk TAO you cannot afford to lose. The current forge is pinned to testnet, the public indexer database is not deployed, and marketplace payment is unavailable.</p></section>

          <Section id="architecture" label="01 / Architecture" title="One chain of evidence. Three layers of interpretation.">
            <div className="manual-flow">
              <article><span>01</span><i>Wallet</i><h3>Signs intent</h3><p>The creator reviews subnet, TAO, quote, price limit, fee, manifest, and exact image size.</p></article>
              <b aria-hidden="true">→</b>
              <article><span>02</span><i>Subtensor</i><h3>Finalizes facts</h3><p>The chain records signer, atomic execution, TAO input, alpha burned, fee, and inscription bytes.</p></article>
              <b aria-hidden="true">→</b>
              <article><span>03</span><i>Relics index</i><h3>Derives state</h3><p>Strict rules calculate the canonical ID, number, owner, transfers, and rejection history.</p></article>
              <b aria-hidden="true">→</b>
              <article><span>04</span><i>Proof network</i><h3>Replicates answers</h3><p>Proposed miners replay history; validators challenge their commitments; the dapp requires quorum.</p></article>
            </div>
            <div className="manual-trust-grid"><article><span>Chain authority</span><p>Finality, transaction order, execution, signer, TAO movement, alpha events, and remark bytes.</p></article><article><span>Protocol authority</span><p>Qualification rules, canonical IDs, ordinal numbers, ownership nonces, transfers, and listings.</p></article><article><span>Never proven</span><p>Copyright, originality, artistic value, depicted identity, legality, or future market price.</p></article></div>
          </Section>

          <Section id="mint" label="02 / Mint transaction" title="Buy, Burn, and Inscribe under one signature.">
            <div className="manual-code"><div><span>Canonical v1 call</span><i>Atomic · two inner calls · exact order</i></div><pre><code>{`Utility.batch_all([
  SubtensorModule.add_stake_burn(
    subnet_owner_hotkey,
    netuid,
    tao_amount,
    Some(maximum_ending_spot_price)
  ),
  System.remark_with_event(relic_payload)
])`}</code></pre></div>
            <div className="manual-rule-grid"><article><span>Buy</span><strong>TAO enters one selected subnet pool.</strong><p>The fresh runtime quote estimates alpha output after the pool fee and price impact.</p></article><article><span>Burn</span><strong>The acquired alpha stake is immediately burned.</strong><p>The finalized AlphaBurned event—not the preview—is the canonical amount.</p></article><article><span>Inscribe</span><strong>The manifest and optional image share the same atomic outcome.</strong><p>If either call fails, the entire batch rolls back and no Relic exists.</p></article></div>
            <div className="manual-requirements"><span>Acceptance requires</span><ul><li>Finalized block</li><li>ExtrinsicSuccess</li><li>BatchCompleted</li><li>AddStakeBurn</li><li>AlphaBurned</li><li>Remarked</li><li>TransactionFeePaid</li><li>Matching signer, hotkey, netuid, generation, amount, and hash</li></ul></div>
          </Section>

          <Section id="media" label="03 / On-chain media" title="The image is transaction data—not a gateway promise.">
            <div className="manual-media-layout">
              <div className="manual-envelope"><span>Binary envelope</span><div><i>4 bytes</i><strong>BRI1 magic</strong></div><div><i>4 bytes</i><strong>Manifest length</strong></div><div><i>N bytes</i><strong>Strict UTF-8 JSON</strong></div><div><i>Remainder</i><strong>Exact WebP bytes</strong></div></div>
              <div className="manual-media-copy"><p>The browser converts PNG, JPEG, or WebP input into a small passive WebP before the wallet signs. The manifest commits the SHA-256 hash, byte length, dimensions, subnet generation, purpose, content policy, and optional inscription.</p><p>The reference forge does not upload canonical media to AWS, IPFS, Arweave, or Vercel. Any thumbnail or miner response is a replaceable cache and must match the finalized chain bytes.</p></div>
            </div>
            <div className="manual-metrics"><div><span>JSON remark</span><strong>≤ 2,048 B</strong></div><div><span>Full envelope</span><strong>≤ 16,384 B</strong></div><div><span>WebP bytes</span><strong>≤ 12,288 B</strong></div><div><span>Dimensions</span><strong>64–256 px</strong></div></div>
          </Section>

          <Section id="miner-queue" label="04 / Future miner queue" title="Miners prepare the candidate. The creator approves the exact bytes.">
            <div className="manual-queue-intro">
              <span>Proposed subnet workflow · not live</span>
              <p>The production vision moves image preparation into a competitive queue. Miners may optimize an original before inscription, but they can never modify a finalized Relic. The creator keeps final authority: no TAO is committed until the exact candidate image and transaction are reviewed and signed.</p>
            </div>
            <ol className="manual-queue">
              <li><i>01</i><div><strong>Upload the original</strong><p>The creator submits the source image and defines the Relic, subnet, byte limit, and permitted transformation rules.</p></div></li>
              <li><i>02</i><div><strong>Open a preparation job</strong><p>The queue publishes a content-addressed task so competing miners work from the same original and requirements.</p></div></li>
              <li><i>03</i><div><strong>Miners produce candidates</strong><p>Miners compete to create the best on-chain version within the protocol&apos;s dimensions and byte budget while preserving aspect ratio and legibility.</p></div></li>
              <li><i>04</i><div><strong>Validators verify</strong><p>Validators check dimensions, encoding, byte length, source and candidate hashes, declared quality rules, content policy, and transaction construction.</p></div></li>
              <li><i>05</i><div><strong>Preview the exact result</strong><p>The site displays the exact miner-produced bytes at actual size and enlarged. The preview hash must equal the hash placed in the signed manifest.</p></div></li>
              <li><i>06</i><div><strong>Approve and sign</strong><p>The creator chooses a candidate and signs only after reviewing the image, subnet, TAO amount, price limit, fees, burn call, and inscription. Rejection costs no mint TAO.</p></div></li>
              <li><i>07</i><div><strong>Finalize, index, and archive</strong><p>The approved bytes are inscribed in finalized chain history. Miners then reconstruct the Relic, preserve its media, and serve proofs to the network.</p></div></li>
            </ol>
            <div className="manual-queue-rule"><span>Immutable boundary</span><strong>Optimization happens before the signature—never after finalization.</strong><p>This prevents silent cropping, distortion, or substitution. A miner cannot replace the approved candidate because the signed manifest commits its SHA-256 hash and byte length, and validators reject any mismatch.</p></div>
            <p className="manual-note">Today&apos;s testnet Forge prepares the WebP locally in the browser; the live miner preparation queue does not exist yet. This section defines the intended workflow that a future Relics subnet must implement and prove.</p>
          </Section>

          <Section id="economics" label="05 / Burn economics" title="The sacrifice is real. The supply claim is not.">
            <div className="manual-correction"><span>Important correction</span><h3>Buy & Burn is supply-neutral under the current Bittensor runtime.</h3><p>The operation removes the user&apos;s acquired alpha stake and emits a provable burn event, but it does not reduce <code>SubnetAlphaOut</code>. Relics uses Buy & Burn—not the separate recycle path. We therefore make no promise of deflation, reduced issuance, or token appreciation.</p></div>
            <div className="manual-economics-grid"><article><span>What is proven</span><ul><li>TAO permanently committed</li><li>Selected subnet and generation</li><li>Actual alpha burned</li><li>Pool fee and execution evidence</li><li>Finalized transaction fee</li></ul></article><article><span>What is variable</span><ul><li>Alpha output for a TAO input</li><li>Price impact and pool state</li><li>Ending spot price</li><li>Future subnet value</li><li>Market demand for a Relic</li></ul></article></div>
            <p className="manual-note">The forge targets a TAO amount, not an exact alpha amount. A collection promising “at least 1,000 SCORE burned” needs a future alpha-target quote mode and must verify the finalized event before accepting membership.</p>
          </Section>

          <Section id="ownership" label="06 / Identity & ownership" title="Chain position makes the Relic. Signed history assigns the owner.">
            <div className="manual-id"><span>Canonical artifact ID</span><code>br1:&lt;full-genesis-hash&gt;:&lt;finalized-block&gt;:&lt;extrinsic-index&gt;</code></div>
            <div className="manual-two-column"><article><span>Numbering</span><p>Accepted mints receive one global number and one number inside <code>(netuid, subnet_generation)</code>. Order follows finalized block number then extrinsic index. Invalid candidates consume no number.</p></article><article><span>Ownership</span><p>The mint signer starts as protocol owner. A valid standalone transfer remark must be signed by the current owner and use the exact next ownership nonce. This prevents replay.</p></article><article><span>Subnet identity</span><p>Netuid alone is insufficient because numbers can be reused after deregistration. Relics binds every mint to <code>NetworkRegisteredAt[netuid]</code>.</p></article><article><span>Marketplace</span><p>Sale V2 listings bind the exact seller, ownership nonce, price, expiry, and buyer policy. A purchase is accepted only when the matching TAO payment and ownership receipt succeed together in one finalized atomic batch.</p></article></div>
            <div className="manual-founding"><span>Verified founding testnet Relic</span><div><h3>Shizzy</h3><p>Block 7,698,721 · Extrinsic 6 · 1 test TAO · 1,035.580333229 SN1 alpha burned · 8,698 on-chain image bytes</p></div><a href="/evidence/founding-testnet-relic.json">Evidence JSON →</a></div>
          </Section>

          <Section id="proof-network" label="07 / Proof network" title="Miners replay. Validators challenge. The dapp requires agreement.">
            <div className="manual-network-grid"><article><div><span>Miner work</span><i>Proposed</i></div><h3>Reconstruct the complete index</h3><ul><li>Follow finalized blocks</li><li>Verify accepted and rejected operations</li><li>Preserve exact media</li><li>Publish checkpoint commitments</li><li>Serve state and history queries</li></ul></article><article><div><span>Validator work</span><i>Proposed</i></div><h3>Challenge exact public facts</h3><ul><li>Maintain independent replay</li><li>Sample unpredictable checkpoints</li><li>Check roots, ownership, and media hashes</li><li>Measure freshness and availability</li><li>Reject divergence</li></ul></article><article><div><span>Gateway rule</span><i>Prototype</i></div><h3>Fail closed without quorum</h3><ul><li>Query multiple miners</li><li>Require identical checkpoint and answer</li><li>Never let one fast miner redefine history</li><li>Return no consensus when threshold fails</li></ul></article></div>
            <p className="manual-note">The public Network page is a deterministic three-miner simulation. No Relics subnet, live miners, validator weights, netuid, or emissions exist today. If launched, subnet emissions—not a per-mint user escrow—would compensate miners for the continuous service.</p>
          </Section>

          <Section id="claim-audit" label="08 / Claim audit" title="Facts, corrections, and unfinished work.">
            <div className="manual-claims">{claims.map((claim) => <article className={claim.tone} key={claim.title}><div><span>{claim.state}</span><i aria-hidden="true" /></div><h3>{claim.title}</h3><p>{claim.body}</p></article>)}</div>
          </Section>

          <Section id="api" label="09 / API map" title="Finalized reads only. No endpoint creates chain truth.">
            <div className="manual-api"><header><span>Method</span><span>Path</span><span>Returns</span></header>{apiRows.map(([method, path, detail]) => <div key={path}><b>{method}</b><code>{path}</code><p>{detail}</p></div>)}</div>
            <p className="manual-note">Until the public database is configured, index-backed routes return <code>503 INDEXER_UNAVAILABLE</code> instead of presenting an empty collection. That is intentional fail-closed behavior.</p>
          </Section>

          <Section id="library" label="10 / Reference library" title="Go deeper without hunting through the repository.">
            <div className="manual-library">
              <Link href="/blackpaper"><span>Vision + system design</span><strong>The Blackpaper</strong><p>The complete narrative, economics, subnet design, safety limits, founding mint, and roadmap.</p></Link>
              <a href="https://github.com/shizzyunchained/taoscriptions/blob/feat/neural-relics-v1/docs/PROTOCOL.md" target="_blank" rel="noreferrer"><span>Normative</span><strong>Protocol v1</strong><p>Exact payload, call, validation, identity, ownership, and marketplace rules.</p></a>
              <a href="https://github.com/shizzyunchained/taoscriptions/blob/feat/neural-relics-v1/docs/INDEXER.md" target="_blank" rel="noreferrer"><span>Implementation</span><strong>Indexer contract</strong><p>Replay pipeline, evidence schema, failure behavior, recovery, and deployment gate.</p></a>
              <a href="https://github.com/shizzyunchained/taoscriptions/blob/feat/neural-relics-v1/docs/SECURITY.md" target="_blank" rel="noreferrer"><span>Threat model</span><strong>Security invariants</strong><p>Protected assets, adversarial cases, wallet boundaries, and launch requirements.</p></a>
              <a href="https://github.com/shizzyunchained/taoscriptions/blob/feat/neural-relics-v1/docs/API.md" target="_blank" rel="noreferrer"><span>Interface</span><strong>Read API v1</strong><p>Endpoints, cache rules, response behavior, and marketplace discovery.</p></a>
              <a href="https://github.com/shizzyunchained/taoscriptions/blob/feat/neural-relics-v1/docs/ROADMAP.md" target="_blank" rel="noreferrer"><span>Launch</span><strong>Ten release gates</strong><p>The ordered path from testnet evidence to controlled production approval.</p></a>
            </div>
            <div className="manual-primary-sources"><span>Primary sources</span><div><a href="https://docs.ordinals.com/overview.html" target="_blank" rel="noreferrer">Ordinals handbook ↗</a><a href="https://eips.ethereum.org/EIPS/eip-721" target="_blank" rel="noreferrer">ERC-721 ↗</a><a href="https://www.bittensor.com/docs/tx/stake-burn" target="_blank" rel="noreferrer">Bittensor Stake & Burn ↗</a><a href="https://github.com/RaoFoundation/subtensor" target="_blank" rel="noreferrer">Subtensor source ↗</a><a href="https://docs.rs/pallet-utility/latest/pallet_utility/pallet/enum.Call.html#variant.batch_all" target="_blank" rel="noreferrer">Utility batch_all ↗</a></div></div>
          </Section>

          <div className="manual-end"><span>End of field manual</span><h2>The Relic is the art.<br />The burn is the proof.</h2><div><Link href="/#forge">Forge on testnet</Link><Link href="/blackpaper">Continue to the Blackpaper</Link></div></div>
        </div>
      </div>

      <footer><SiteMark className="footer-brand" /><p>Protocol docs · Testnet experiment · Mainnet disabled</p><Link href="/">Protocol home →</Link></footer>
    </main>
  );
}
