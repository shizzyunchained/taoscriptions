import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { SiteMark } from "@/components/site-mark";
import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  title: "The Blackpaper — Bittensor Relics",
  description: "The protocol thesis, verified testnet implementation, trust model, economics, and proposed proof network for Bittensor Relics.",
};

const chapters = [
  ["00", "Executive summary", "summary"],
  ["01", "The permanence gap", "problem"],
  ["02", "Protocol thesis", "thesis"],
  ["03", "The Relic object", "object"],
  ["04", "Creation lifecycle", "lifecycle"],
  ["05", "Atomic chain proof", "chain-proof"],
  ["06", "On-chain media", "media"],
  ["07", "Economics of sacrifice", "economics"],
  ["08", "Canonical state", "state"],
  ["09", "Deterministic indexing", "indexing"],
  ["10", "The proof subnet", "subnet"],
  ["11", "Collections and culture", "collections"],
  ["12", "Marketplace design", "marketplace"],
  ["13", "Safety and limits", "safety"],
  ["14", "Evidence and status", "evidence"],
  ["15", "Path to launch", "roadmap"],
  ["16", "Conclusion", "conclusion"],
] as const;

function Chapter({ number, title, id, children }: { number: string; title: string; id: string; children: ReactNode }) {
  return (
    <section className="blackpaper-chapter" id={id}>
      <header><span>{number}</span><h2>{title}</h2></header>
      <div className="blackpaper-prose">{children}</div>
    </section>
  );
}

export default function BlackpaperPage() {
  return (
    <main className="site-shell inner-site docs-site blackpaper-site">
      <div className="grain" aria-hidden="true" />
      <SiteNav status="Blackpaper · Draft 0.3" tone="prototype" />

      <header className="blackpaper-hero">
        <p className="eyebrow">Bittensor Relics / The Blackpaper</p>
        <h1>The image is permanent.<br />The burn is the proof.</h1>
        <div><span>Protocol v1 / Draft 0.3</span><strong>A rigorous account of the artifact, the burn, the deterministic state machine, and the proposed Bittensor proof network.</strong></div>
      </header>

      <section className="blackpaper-thesis">
        <p>The Relic is the art.</p><p>The burn is the proof.</p><p>The network verifies the memory.</p>
      </section>

      <nav className="blackpaper-contents" aria-label="Blackpaper chapters">
        <span>Contents</span>
        <ol>{chapters.map(([number, title, id]) => <li key={id}><a href={`#${id}`}><i>{number}</i>{title}</a></li>)}</ol>
      </nav>

      <article className="blackpaper-body" aria-label="Bittensor Relics Blackpaper">
        <Chapter number="00" title="Executive summary" id="summary">
          <p>Bittensor Relics is an experimental, non-EVM protocol for creating permanent digital artifacts from native Subtensor transactions. A creator signs one atomic transaction that spends testnet TAO, buys a selected subnet&apos;s alpha, burns the acquired alpha stake, and inscribes a bounded message or image. The exact media bytes live inside finalized chain history. The transaction position becomes the artifact&apos;s identity; emitted runtime events become its economic receipt; deterministic protocol rules produce its number, owner, transfers, collections, and marketplace state.</p>
          <p>The protocol separates two kinds of truth that collectible systems often blur. <b>Subtensor proves execution:</b> who signed, what ran, which bytes were included, how much TAO was committed, how much alpha was actually burned, and where the transaction finalized. <b>Relics interprets that evidence:</b> whether the transaction qualifies, which ordinal number it receives, and how later signed actions change its protocol state. The second layer is not native NFT state, and it is not hidden. It is a published state machine designed to be replayed from genesis by independent implementations.</p>
          <p>The long-term proposal turns that interpretation and retrieval work into a Bittensor commodity. Miners independently replay finalized history, preserve verifiable artifact data, and serve proofs. Validators challenge their answers and reward correctness, freshness, availability, and historical coverage. The objective is not to abolish indexers. It is to make indexing explicit, reproducible, competitive, and measurable.</p>
          <div className="paper-state-grid"><div><span>Verified on testnet</span><strong>Atomic Buy &amp; Burn with exact WebP bytes in finalized history</strong></div><div><span>Live now</span><strong>Primary finalized index, numbering, proof pages, ownership transfers, and listing discovery</strong></div><div><span>Not deployed</span><strong>Independent replay database, live quorum gateway, registered subnet, miners, validators, and emissions</strong></div><div><span>Proposed</span><strong>Authority collections, exact-alpha minting, and loss-safe paid settlement</strong></div></div>
          <p>This paper distinguishes verified behavior from proposed architecture. Mainnet minting is disabled. The subnet is not registered. No miner emissions are live. The public marketplace does not settle purchases. Relics remains testnet software until the implementation, replay infrastructure, incentive system, and settlement guarantees survive independent review.</p>
        </Chapter>

        <Chapter number="01" title="The permanence gap" id="problem">
          <h3>Ownership can be on-chain while the object is elsewhere.</h3>
          <p>Many Ethereum and Solana collectibles put token ownership on-chain while a metadata field points to the image. That image may live on a project server, a cloud bucket, a CDN, IPFS, Arweave, or directly on-chain. Decentralized storage and fully on-chain art are real exceptions, so the honest argument is not that every NFT is stored on Amazon. The problem is that media permanence is optional, dependencies differ from collection to collection, and buyers often cannot see which promises are enforced by a chain and which depend on continued hosting.</p>
          <h3>Ordinals moved the artifact into Bitcoin history.</h3>
          <p>Ordinals demonstrated a powerful alternative: carry the media itself in transaction data. The artifact can then be reconstructed from the chain rather than resolved through a mutable URL. But inscription discovery, numbering, sat tracking, ownership interpretation, and collection views are computed by indexer software. The index is open and reproducible, yet ordinary users still rely on a small group of hosted services to deliver its answers.</p>
          <h3>Permanence and interpretation are separate problems.</h3>
          <p>Putting bytes on-chain solves the media-location problem. It does not make search, numbering, state reconstruction, archival access, or marketplace views appear by magic. Relics begins with that distinction. The chain holds the evidence; deterministic software interprets it; a proposed subnet makes the quality of that interpretation a competitive service. A miner may accelerate access, but it cannot alter the finalized transaction, manufacture a burn, move an artifact without a valid owner signature, or consume a number with an invalid mint.</p>
        </Chapter>

        <Chapter number="02" title="Protocol thesis and invariants" id="thesis">
          <p>Relics links three facts that normally live apart: <b>an exact artifact, an irreversible economic sacrifice, and a reproducible ownership history.</b> Each accepted mint must preserve all three. The design follows six invariants.</p>
          <ol><li><b>One signature, one atomic outcome.</b> The burn and inscription both finalize or neither does.</li><li><b>Chain evidence outranks interface claims.</b> Quotes, wallet popups, databases, and miner responses are never canonical.</li><li><b>Exact bytes outrank URLs.</b> An image Relic commits the WebP itself, not a promise to host it.</li><li><b>Finality precedes existence.</b> A submitted or best-chain transaction is not a Relic.</li><li><b>Every derived answer is replayable.</b> Given the same finalized history and protocol version, honest implementations must produce the same accepted set and state.</li><li><b>Failure is explicit.</b> Unsupported runtimes, missing databases, divergent replays, stale quotes, and validator disagreement stop the system instead of being presented as certainty.</li></ol>
          <div className="paper-call-path"><span>Authority flows in one direction</span><code>Finalized Subtensor history → protocol acceptance rules → canonical Relic state → interfaces and markets</code><p>The website is a tool for composing and reading transactions. It is not the registry. PostgreSQL is a cache. A gateway is a convenience. If all Relics services disappeared, the state could be reconstructed from the activation block and finalized history.</p></div>
          <p>These invariants define the boundary of the claim. Relics does not add an NFT pallet to Subtensor. It does not attach metadata to alpha tokens. It does not require Solidity, an EVM contract, a custodial wallet, or a private database to create the underlying evidence. “Mint,” “owner,” and “transfer” refer to the Relics protocol&apos;s deterministic interpretation of signed Subtensor calls.</p>
        </Chapter>

        <Chapter number="03" title="The Relic object" id="object">
          <p>A Relic is the canonical protocol object derived from one qualifying finalized extrinsic. Its identity is the event in history, not merely the image hash. Every accepted object records the chain genesis, block number and hash, extrinsic index and hash, signer AccountId32, subnet number and registration generation, registered routing hotkey, TAO committed, actual alpha burned, execution limit, paid fee, original payload, and content hashes.</p>
          <p>An image Relic additionally records media type, byte length, dimensions, SHA-256 digest, and exact WebP bytes. A title, inscription, purpose, collection label, and content-policy attestation describe the creator&apos;s intent. They do not prove copyright, originality, legality, market value, or the identity of a depicted person.</p>
          <p>Duplicate media is allowed. Two creators can inscribe the same bytes, just as two transactions can contain the same message. Their content hashes match, but their signers, economic receipts, positions, canonical IDs, and ordinal numbers do not. Indexers disclose matching hashes and can identify the earliest accepted instance. Scarcity belongs to the historical object and its proof, not to a false promise that bytes cannot be copied.</p>
          <div className="paper-metrics"><div><span>Artifact identity</span><strong>Genesis + block + extrinsic position</strong></div><div><span>Creation owner</span><strong>The qualifying mint signer</strong></div><div><span>Economic proof</span><strong>Finalized runtime events</strong></div><div><span>Media authority</span><strong>Exact on-chain bytes and hash</strong></div></div>
        </Chapter>

        <Chapter number="04" title="Creation lifecycle" id="lifecycle">
          <p>The forge makes the protocol accessible from a website while keeping authority in the wallet and chain. A user connects an injected SS58 wallet such as TAOStats Wallet. The extension exposes public accounts and signs the chosen transaction. The site never creates the account, asks for a seed phrase, sees a private key, or holds funds.</p>
          <ol><li><b>Select an alpha economy.</b> The forge reads active non-root subnets from a pinned testnet genesis and shows the subnet number, current registration generation, identity, and owner hotkey.</li><li><b>Choose a TAO commitment.</b> Version 1 is TAO-targeted. The runtime quote estimates the alpha acquired after pool fee, slippage, and price impact.</li><li><b>Compose the artifact.</b> The creator supplies a name, optional inscription, purpose, and optional collection label.</li><li><b>Prepare media locally.</b> PNG, JPEG, or WebP input is cropped and compressed in the browser into a bounded passive WebP. The reference forge does not upload the source image to cloud storage.</li><li><b>Accept the covenant.</b> The creator attests to the <code>br-safe-1</code> content policy, whose identifier is committed in the manifest.</li><li><b>Refresh the proof inputs.</b> Before signing, the forge reloads the finalized subnet generation, route hotkey, quote, price limit, estimated fee, genesis, image size, and balance.</li><li><b>Sign once.</b> The wallet displays the exact atomic call and returns a signed extrinsic. The site broadcasts it without taking custody.</li><li><b>Wait for finality.</b> The receipt is created only after the finalized block is located and all scoped calls and events pass protocol verification.</li></ol>
          <p>Miners are not a per-mint job queue. The chain processes the signed transaction directly. Indexing follows finality and may lag, but no miner has permission to “approve” a valid mint. In the proposed subnet, miners earn emissions for continuously reconstructing and serving correct history; the creator does not sign a separate miner escrow.</p>
        </Chapter>

        <Chapter number="05" title="Atomic chain proof" id="chain-proof">
          <p>A version 1 image or text mint contains exactly two calls in exactly this order:</p>
          <pre><code>{`Utility.batch_all([
  SubtensorModule.add_stake_burn(
    subnet_owner_hotkey,
    netuid,
    tao_amount,
    Some(maximum_ending_spot_price)
  ),
  System.remark_with_event(relic_payload)
])`}</code></pre>
          <p><code>batch_all</code> is the atomic boundary. If Buy &amp; Burn fails, the remark rolls back. If the remark fails, the economic action rolls back. A non-atomic batch, extra inner call, reversed order, wrong subnet generation, or mismatched route hotkey does not qualify. This is how the protocol prevents an inscription without its burn and a burn without its promised inscription.</p>
          <p>The temporary stake routes through the selected subnet&apos;s registered owner hotkey, read from the same finalized snapshot as the quote. This allows a coldkey-only wallet to participate without creating a personal hotkey. The purchased alpha is burned immediately; no acquired stake remains for the user or route hotkey.</p>
          <p>The verifier scopes events to the extrinsic and requires successful atomic execution plus the matching stake-burn, alpha-burn, remark, and fee evidence. The canonical quantity is the emitted <code>AlphaBurned</code> amount. The current runtime can report the nominal stake-burn result one alpha-rao above the actual burn because the burn is capped to the available post-purchase alpha. Protocol v1 permits only that one-unit boundary and rejects a larger mismatch.</p>
          <p>The transaction&apos;s finalized block position orders the mint. A wallet confirmation or transaction hash alone cannot create an artifact. Forked, failed, interrupted, unsupported, or merely included transactions are excluded.</p>
        </Chapter>

        <Chapter number="06" title="On-chain media" id="media">
          <p>Text-only Relics use strict UTF-8 JSON. Image Relics use the compact <code>BRI1</code> binary envelope so exact media does not pay the expansion cost of base64:</p>
          <pre><code>{`4 bytes   ASCII magic "BRI1"
4 bytes   big-endian unsigned manifest length
N bytes   canonical UTF-8 JSON manifest
remainder exact WebP image bytes`}</code></pre>
          <p>The manifest commits protocol version, operation, subnet and generation, name, purpose, policy, media type, encoding, SHA-256 content hash, byte length, width, height, and optional inscription or collection label. The verifier checks the envelope boundaries, canonical fields, declared length and digest, image header, dimensions, and total size.</p>
          <div className="paper-metrics"><div><span>Plain JSON</span><strong>2,048 bytes maximum</strong></div><div><span>Complete image envelope</span><strong>16,384 bytes maximum</strong></div><div><span>WebP payload</span><strong>12,288 bytes maximum</strong></div><div><span>Image dimensions</span><strong>64–256 pixels per side</strong></div></div>
          <p>The constraint is part of the medium. Permanent bytes impose archival cost on infrastructure that stores historical blocks. Relics therefore supports small, deliberately compressed artifacts rather than presenting Subtensor as unlimited file hosting. Thumbnails and caches may be served by Vercel, Hippius, a CDN, or miners, but those copies are replaceable. A valid copy must hash to the exact bytes committed in the finalized transaction.</p>
          <p>“On-chain” means the envelope is included in finalized historical block data. It does not mean every public RPC endpoint retains every old block indefinitely. Reliable access still requires archival nodes and replicated serving. The proposed subnet improves retrieval and makes incorrect responses punishable; the block position and digest make every response auditable.</p>
        </Chapter>

        <Chapter number="07" title="Economics of sacrifice" id="economics">
          <p>Version 1 performs <b>Buy &amp; Burn</b>. The creator does not contribute alpha already held in the wallet. They choose TAO input; the runtime buys alpha from one selected subnet pool and immediately burns the acquired stake. Alpha output varies with pool state, fees, price impact, and transaction ordering. Only the finalized <code>AlphaBurned</code> event proves the amount attached to the Relic.</p>
          <p>The forge computes a maximum acceptable ending spot price from a fresh finalized quote. Protocol v1 uses a 2% tolerance, rounded upward, and disallows partial execution. If the swap would cross that boundary, the atomic transaction fails instead of accepting hidden slippage or retrying as an unrestricted market order.</p>
          <aside className="paper-correction"><span>Critical accounting fact</span><strong>The present Buy &amp; Burn operation proves sacrifice, but it does not reduce total subnet alpha supply.</strong><p>Under the current runtime, the burn removes the creator&apos;s acquired alpha stake without reducing <code>SubnetAlphaOut</code>. The separate recycle path has different supply accounting. Relics v1 uses Buy &amp; Burn, not Recycle. It therefore makes no promise of deflation, reduced issuance, price appreciation, or investment return.</p></aside>
          <p>The valid claim is both narrower and more useful: every accepted mint proves real TAO demand against a selected subnet pool and the exact amount recorded by the runtime&apos;s <code>AlphaBurned</code> event. It creates a public cultural receipt tied to that alpha economy. Communities may value those receipts, and repeated use may generate pool activity and fees, but market outcomes remain uncertain.</p>
          <p>A collection can express a rule such as “burn at least 1,000 SCORE alpha and follow this visual brief.” Today the creator chooses TAO, so the final alpha amount cannot be guaranteed in advance. The forge must show an estimate; the finalized event decides whether a threshold was met. A future exact-alpha mode would require a separately specified transaction path with equally strict price protection.</p>
        </Chapter>

        <Chapter number="08" title="Canonical state" id="state">
          <h3>Identity and numbering</h3>
          <p>The canonical identifier is <code>br1:&lt;full-genesis&gt;:&lt;block&gt;:&lt;extrinsic-index&gt;</code>. Display numbers are assigned by sorting accepted mints by block and extrinsic position from the protocol activation block. Invalid candidates consume no number. Replaying the same finalized range must produce the same IDs, numbers, hashes, and owners.</p>
          <p>Subnet numbers can be reused after deregistration. Relics therefore identifies an alpha economy by <code>(netuid, NetworkRegisteredAt[netuid])</code>, not by a display name or netuid alone. A Relic remains tied to the generation that existed when it was created.</p>
          <h3>Ownership and transfer</h3>
          <p>The mint signer is the initial protocol owner. A transfer is a later finalized standalone <code>remark_with_event</code> signed by the current owner. It identifies the artifact, recipient AccountId32, genesis, protocol domain, and exact next nonce. The indexer accepts it only when the signer owns the artifact and the nonce is sequential. A transfer changes Relics protocol state; it does not move a native runtime asset.</p>
          <p>Ownership is therefore verifiable without giving the marketplace custody. Any implementation can replay mint and transfer events in final order. Invalid signatures, skipped or reused nonces, wrong genesis values, and transfers by former owners are rejected.</p>
          <h3>Purposes and collections</h3>
          <p>A Relic purpose distinguishes a personal artifact, collection entry, subnet milestone, or community message. In v1, collection labels are creator-declared metadata, useful for discovery but not proof of official membership. A later authority layer can define a collection declaration signed by the subnet owner or delegated curator, including generation, eligible window, burn threshold, required imagery or text, supply cap, and curator key policy. Indexers can then evaluate membership from chain evidence rather than a website&apos;s allowlist.</p>
        </Chapter>

        <Chapter number="09" title="Deterministic indexing" id="indexing">
          <p>Relics does not “solve the indexer problem” by denying that an index exists. It solves for a more precise target: <b>no single indexer should be able to invent canonical history without being contradicted by public evidence and independent replay.</b></p>
          <ol><li>Read only finalized blocks from the configured genesis and frozen activation height.</li><li>Decode metadata for the active supported runtime specification.</li><li>Inspect successful extrinsics in block order.</li><li>Require the exact atomic call shape and subnet-generation identity.</li><li>Parse strict bounded payloads; reject unknown versions, malformed JSON, unsafe numeric forms, and envelope mismatches.</li><li>Match only events emitted by that extrinsic and treat actual runtime values as authoritative.</li><li>Insert accepted mints, then apply valid transfers and listings in finalized order.</li><li>Publish the indexed finalized head, rejection reasons, state commitments, and replay audit results.</li></ol>
          <p>The reference indexer is deliberately fail-closed. An unknown runtime version pauses ingestion. A missing database returns <code>INDEXER_UNAVAILABLE</code>, not an empty collection. Reprocessing a block is idempotent. A rollback removes all derived state at and after the affected height before replay. Media served from a cache is checked against its on-chain digest.</p>
          <p>PostgreSQL makes the state searchable but has no authority. A primary worker and an independently configured replay worker must be able to stop at the same finalized block and produce identical canonical datasets. Divergence is a protocol alarm, not a result to average away.</p>
        </Chapter>

        <Chapter number="10" title="The proof subnet" id="subnet">
          <p>The proposed Relics subnet turns deterministic reconstruction and historical availability into measurable work. It is not needed for a transaction to finalize and does not sit between a creator and Subtensor. Its purpose is to prevent one hosted index from becoming the practical authority over discovery, numbering, ownership, and media retrieval.</p>
          <h3>Miner work</h3>
          <p>Each miner follows finalized Subtensor history, independently applies the protocol, maintains canonical state, preserves supported historical media, and answers proof queries. Responses include the indexed finalized head, artifact record, ownership chain, source block position, content digest, and state commitment. Good service requires correctness, freshness, latency, availability, and enough historical coverage to answer adversarial queries—not merely copying the latest answer from another miner.</p>
          <h3>Validator work</h3>
          <p>Validators derive or sample ground truth from finalized blocks and challenge miners across recent and historical ranges. Tests include valid mints, malformed near-mints, runtime boundaries, media bytes, ordinal neighbors, ownership transitions, collection conditions, and deliberately stale heads. Scores reward exact proofs and useful service. Incorrect, unavailable, selectively incomplete, or stale responses lose weight.</p>
          <h3>Consensus at the gateway</h3>
          <p>The dapp queries multiple independent miners or validator-backed gateways. It accepts an answer only when a configured quorum agrees on the same finalized head and canonical result. Disagreement is shown as uncertainty and triggers direct chain verification. Consensus is not a vote that can override history; it is evidence that independent replicas reached the same deterministic answer.</p>
          <p>Bittensor emissions—not a per-user escrow—would compensate miners and validators according to subnet weights and consensus. Registration alone does not guarantee emissions, honest participants, or sustainability. The commodity must prove more valuable than an ordinary replicated service at its true storage, verification, and egress cost before subnet registration is justified.</p>
        </Chapter>

        <Chapter number="11" title="Collections and subnet culture" id="collections">
          <p>Relics is most compelling when the economic action and cultural object belong to the same community. A subnet can define a collection around its own milestones and alpha economy: a 10,000 SCORE burn paired with a founder portrait, a limited anniversary series, a visual record of a major release, or a community message whose cost demonstrates conviction.</p>
          <p>Collection rules should be specific enough to verify and open enough to invite creativity. An authority declaration could require a minimum actual alpha burn, a subnet generation, time window, purpose, image dimensions, edition limit, and visual theme. It could prohibit weapons-focused imagery, sexual or exploitative material, graphic violence, hate, and illegal content. Creators remain free to interpret the theme; indexers determine only whether objective conditions and the declared authority chain are satisfied.</p>
          <p>Not every important Relic needs a collection. A subnet owner can permanently inscribe a launch image, upgrade announcement, research result, or message to the community with a meaningful burn. The result functions as a timestamped receipt: exact bytes, signer, subnet economy, finalized position, and sacrifice preserved together. The owner can later transfer that protocol object, list it, or retain it as part of the subnet&apos;s public history.</p>
        </Chapter>

        <Chapter number="12" title="Marketplace design" id="marketplace">
          <p>Discovery and settlement are intentionally separate. A listing is a signed off-chain order containing the artifact ID, current ownership nonce, seller, price, expiry, genesis, and protocol domain. Anyone may relay it. The marketplace displays it only after independently confirming current ownership and signature validity. A transfer, cancellation, expiry, or nonce change invalidates the listing.</p>
          <p>This discovery model is implemented. Paid settlement is not. The required safety property is simple: <b>a buyer must not lose TAO unless the same enforced operation gives the buyer canonical protocol ownership.</b> Two unrelated signatures do not satisfy that property, and a server-held escrow is not trustless. Subtensor&apos;s native <code>pallet-contracts</code> provides a non-EVM path: an ink!/WASM contract can accept the buyer&apos;s exact payment, verify the current seller, ownership nonce, price, and expiry, pay the seller, move ownership, and clear the listing inside one reverting execution.</p>
          <p>A compiled settlement v2 prototype now demonstrates that state machine for future contract-owned Relics. It does not retroactively make v1 listings safe: v1 ownership comes from replayed remarks, and a new contract must not import that history by trusting one hosted indexer. Existing Relics therefore remain discovery-only. Buying stays disabled until the published contract is deployed on public testnet, live payment and refund behavior is proven, indexer support is complete, and an independent security review is published.</p>
        </Chapter>

        <Chapter number="13" title="Safety, content, and limits" id="safety">
          <p>Permanent media creates responsibilities that a deletable cloud application can postpone. The forge requires the <code>br-safe-1</code> covenant: no sexual or exploitative content, graphic violence, weapons-focused imagery, hate, or illegal material. That attestation is signed into the manifest. It is evidence of the creator&apos;s declaration, not proof that the declaration is true.</p>
          <p>Interfaces, miners, validators, curators, and marketplaces may refuse to ingest, cache, score, or display noncompliant material. They cannot erase bytes already finalized in historical chain data. No upload filter is perfect, so the protocol does not promise universal moderation or removal. It combines bounded passive media, an explicit signed policy, refusal rights, and transparent limits.</p>
          <p>The principal technical defenses are a pinned genesis, finalized-only reads, exact call-shape validation, event-scoped accounting, runtime-version gates, bounded parsing, content hashing, domain-separated signatures, sequential ownership nonces, no custodial keys, price limits, no partial fills, independent replay, and fail-closed APIs.</p>
          <p>Expected failures include wallet rejection, insufficient test TAO, stale quotes, price movement, subnet deregistration, disabled alpha, RPC outages, finality delays, runtime upgrades, database lag, miner disagreement, and policy refusal. A safe failure never broadens a signature, silently increases slippage, invents an artifact, displays stale state as final, or retries an economic transaction without renewed user approval.</p>
        </Chapter>

        <Chapter number="14" title="Evidence and present status" id="evidence">
          <h3>The founding testnet Relic</h3>
          <p>The first independently verified Bittensor Relics image mint finalized on testnet at block 7,698,721, extrinsic index 6. Named <b>Shizzy</b>, it carries an 8,698-byte 256×256 WebP inside the transaction, commits 1 test TAO, and records an actual burn of 1,035.580333229 subnet-one alpha. The transaction fee was 0.001743874 test TAO.</p>
          <div className="founding-proof"><div><span>Canonical ID</span><code>br1:0x8f9cf856…8263105:7698721:6</code></div><div><span>Transaction hash</span><code>0xc465ceb5…9cafdf97</code></div><div><span>Manifest</span><strong>br-safe-1 / personal</strong></div><div><span>Activation block</span><strong>7,698,720</strong></div></div>
          <p>The nominal stake-burn event exceeded the actual alpha-burn event by one alpha-rao. That result exposed an overly strict early verifier and led to the narrow rounding rule described above. The corrected implementation preserves the actual <code>AlphaBurned</code> value as canonical. <a href="/evidence/founding-testnet-relic.json">Download the complete evidence JSON</a> and verify it independently against the finalized block.</p>
          <div className="paper-status-table"><div><span>Works today</span><ul><li>Live testnet subnet discovery and quotes</li><li>Injected SS58 wallet signing</li><li>Local image conversion and exact BRI1 encoding</li><li>Atomic Buy &amp; Burn plus on-chain inscription</li><li>Finality verification and evidence export</li><li>Public primary index, populated Explore, and wallet ownership views</li><li>Direct ownership transfers and signed listing discovery</li><li>Independent-miner conformance simulation</li></ul></div><div><span>Not live today</span><ul><li>Independent replay database and production quorum gateway</li><li>Registered subnet, miners, validators, or emissions</li><li>Authority-defined collections</li><li>Exact alpha-target minting</li><li>Mainnet minting</li><li>Loss-safe paid marketplace settlement</li><li>Native Subtensor NFT ownership</li></ul></div></div>
          <p>Nine accepted image Relics are currently served from a public primary index beginning at activation block 7,698,720. Explore, proof, media, and wallet-ownership APIs fail closed with <code>INDEXER_UNAVAILABLE</code> if that database cannot be verified. Independent replay comparison is still a launch gate.</p>
        </Chapter>

        <Chapter number="15" title="Path to a controlled launch" id="roadmap">
          <ol><li>Freeze and independently review one protocol and source release candidate.</li><li>Complete deterministic builds, dependency review, runtime-compatibility tests, and adversarial transaction fixtures.</li><li>Provision separate primary and replay databases; ingest from block 7,698,720; and require byte-identical state at a shared finalized checkpoint.</li><li>Publish proof APIs and verify every Explore, wallet, media, transfer, rejection, purchase, and collection view against chain evidence.</li><li>Exercise real testnet purchases, cancellations, stale listings, insufficient balances, and listing invalidation before considering mainnet.</li><li>Operate archival and RPC redundancy; rehearse runtime upgrades, rollbacks, stalled finality, and corrupt-cache recovery.</li><li>Run a limited public testnet beta with monitoring, published incidents, and explicit experimental warnings.</li><li>Specify miner queries, validator challenges, commitments, scoring, anti-copying tests, bandwidth budgets, and gateway quorum behavior.</li><li>Demonstrate that independent miners add verifiable availability and correctness beyond conventional replication before registering a subnet.</li><li>Review marketplace settlement and mainnet activation as separate approval gates. Testnet success never implies mainnet approval.</li></ol>
          <p>More subnet capacity may create room for specialized proof services, but it does not guarantee cheap registration, emissions, security, or demand. Relics should register only when its commodity, validation process, operating runway, and adversarial model work without privileged trust. The experiment succeeds by making its evidence stronger, not by making its claims larger.</p>
        </Chapter>

        <Chapter number="16" title="Conclusion" id="conclusion">
          <p>Bittensor Relics does not ask users to trust a website that an image exists, an indexer that a number is real, or a marketplace that a burn occurred. It places the smallest essential artifact and economic receipt in one finalized native transaction, then defines every useful derived answer as deterministic, replayable state.</p>
          <p>The chain secures the evidence. The protocol gives that evidence meaning. Independent indexers reconstruct it. A future subnet can reward the miners who preserve and serve it and the validators who catch dishonest or incomplete answers. No layer is described as more powerful than it is.</p>
          <p>That is the Bittensor-native opportunity: not another token whose image may outlive its host, and not another invisible database treated as truth, but a cultural object whose bytes, cost, provenance, and ownership history can all be challenged against public evidence.</p>
          <blockquote className="paper-final"><p>The Relic is the art.<br />The burn is the proof.<br />The network verifies the memory.</p></blockquote>
        </Chapter>
      </article>

      <aside className="paper-status blackpaper-references">
        <span>Protocol and primary references</span>
        <strong>The Blackpaper explains the design. The specification defines acceptance. Finalized chain evidence decides what happened.</strong>
        <div><a href="https://github.com/shizzyunchained/taoscriptions/blob/feat/neural-relics-v1/docs/PROTOCOL.md" target="_blank" rel="noreferrer">Protocol v1</a><a href="https://github.com/shizzyunchained/taoscriptions/blob/feat/neural-relics-v1/docs/INDEXER.md" target="_blank" rel="noreferrer">Indexer contract</a><Link href="/docs">Technical docs</Link><a href="https://www.bittensor.com/docs/guides/mining" target="_blank" rel="noreferrer">Bittensor mining</a><a href="https://www.bittensor.com/docs/concepts/emissions" target="_blank" rel="noreferrer">Bittensor emissions</a><a href="https://docs.ordinals.com/guides/reindexing.html" target="_blank" rel="noreferrer">Ordinals indexing</a></div>
      </aside>

      <div className="network-actions docs-actions"><Link href="/#forge">Create a testnet Relic</Link><Link href="/docs">Read the technical docs</Link></div>
      <footer><SiteMark className="footer-brand" /><p>Draft 0.3 — experimental, testnet-first, and written to be falsifiable.</p><a href="#summary">Back to top →</a></footer>
    </main>
  );
}
