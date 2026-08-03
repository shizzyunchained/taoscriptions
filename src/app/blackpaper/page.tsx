import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { SiteMark } from "@/components/site-mark";

export const metadata: Metadata = {
  title: "The Blackpaper — Bittensor Relics",
  description: "The complete design and implementation paper for on-chain Relics, alpha-burn receipts, deterministic ownership, and a proposed miner-served proof network on Bittensor.",
};

const chapters = [
  ["00", "Status and warning", "status"],
  ["01", "Abstract", "abstract"],
  ["02", "The problem", "problem"],
  ["03", "What a Relic is", "definition"],
  ["04", "Trust and finality", "trust"],
  ["05", "The forge", "forge"],
  ["06", "Atomic mint", "atomic-mint"],
  ["07", "On-chain media", "media"],
  ["08", "Buy & Burn economics", "economics"],
  ["09", "Identity and numbering", "identity"],
  ["10", "Ownership and transfer", "ownership"],
  ["11", "Purposes and collections", "collections"],
  ["12", "Content covenant", "content"],
  ["13", "Indexer rules", "indexer"],
  ["14", "The Relics subnet", "subnet"],
  ["15", "Marketplace safety", "marketplace"],
  ["16", "Security and failures", "security"],
  ["17", "Founding testnet Relic", "founding-relic"],
  ["18", "Current status", "current-status"],
  ["19", "Road to mainnet", "roadmap"],
  ["20", "Open questions", "questions"],
  ["21", "Conclusion", "conclusion"],
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
      <nav className="nav" aria-label="Main navigation">
        <SiteMark />
        <div className="nav-links"><Link href="/#forge">Forge</Link><Link href="/network">Network</Link><Link href="/blackpaper">Blackpaper</Link><Link href="/docs">Fact check</Link><span className="chain-status prototype"><i aria-hidden="true" />Draft 0.2</span></div>
      </nav>

      <header className="blackpaper-hero">
        <p className="eyebrow">Bittensor Relics / The Blackpaper</p>
        <h1>Memory should<br />carry proof.</h1>
        <div><span>Protocol v1 / Draft 0.2</span><strong>A complete account of the experiment, its working testnet implementation, its hard limits, and its proposed path to a Bittensor subnet.</strong></div>
      </header>

      <section className="blackpaper-thesis">
        <p>The Relic is the art.</p><p>The burn is the proof.</p><p>The network verifies the memory.</p>
      </section>

      <nav className="blackpaper-contents" aria-label="Blackpaper chapters">
        <span>Contents</span>
        <ol>{chapters.map(([number, title, id]) => <li key={id}><a href={`#${id}`}><i>{number}</i>{title}</a></li>)}</ol>
      </nav>

      <article className="blackpaper-body" aria-label="Bittensor Relics Blackpaper">
        <Chapter number="00" title="Status, language, and the experimental boundary" id="status">
          <p>This paper explains both the software that exists today and the network Bittensor Relics is designed to become. Those are not the same thing. A label beside each major claim matters: <b>implemented</b> means code exists in the reference application; <b>verified on testnet</b> means a real finalized Subtensor transaction has exercised it; <b>prototype</b> means the behavior is executable but not connected to live miners; and <b>proposed</b> means the mechanism still requires engineering, adversarial testing, and review.</p>
          <div className="paper-state-grid"><div><span>Verified on testnet</span><strong>Atomic Buy & Burn plus an exact on-chain WebP image</strong></div><div><span>Implemented locally</span><strong>Strict indexer, numbering, ownership transfers, proof APIs, and signed listing discovery</strong></div><div><span>Not deployed</span><strong>Public indexer databases, independent replay worker, and live artifact explorer data</strong></div><div><span>Proposed</span><strong>Registered Relics subnet, live miners and validators, emissions, and loss-safe marketplace settlement</strong></div></div>
          <p>The words “mint,” “artifact,” and “ownership” describe Bittensor Relics protocol state. They do not mean Subtensor has gained a native NFT pallet. The protocol observes public finalized chain facts and applies deterministic rules to them. The reference implementation is non-EVM, uses no Solidity contract, and never asks the website to hold a seed phrase or private key.</p>
        </Chapter>

        <Chapter number="01" title="Abstract" id="abstract">
          <p>Bittensor Relics is an experimental protocol for creating numbered, transferable digital artifacts from native Subtensor transactions. A creator uses an SS58 wallet to sign one atomic transaction that spends TAO to acquire a chosen subnet&apos;s alpha, burns the acquired alpha stake, and records a bounded inscription. For image Relics, the inscription contains the exact compressed WebP bytes rather than a URL. Finalized block position, signer, subnet identity, TAO input, actual alpha burned, transaction fee, manifest, and media hash form a reproducible creation receipt.</p>
          <p>The chain establishes the objective evidence. A deterministic index interprets that evidence into Relic IDs, ordinal numbers, ownership histories, collection views, and marketplace discovery. The long-term proposal is to make this interpretation layer a Bittensor commodity: miners independently replay finalized history and serve proofs; validators challenge their state commitments and reward exactness, freshness, availability, and historical coverage; the dapp accepts answers only when a configured threshold agrees.</p>
          <p>This creates a different relationship between art and a subnet economy. A mint is not merely a database row or a token pointing at a cloud image. It is an exact piece of media bound to a finalized economic action in a selected alpha economy. The resulting scarcity comes from the unique chain position, the signer&apos;s irreversible cost, and protocol ownership—not from a claim that the current burn reduces total alpha supply, and not from preventing another creator from inscribing duplicate bytes.</p>
        </Chapter>

        <Chapter number="02" title="The problem: storage solved only halfway" id="problem">
          <h3>Token ownership can be on-chain while the art is somewhere else.</h3>
          <p>A common Ethereum or Solana collectible stores a token and ownership state on-chain while metadata points to an image URI. That URI may resolve through a project server, Amazon S3, a CDN, IPFS, Arweave, or fully on-chain data. IPFS and Arweave materially improve persistence, and fully on-chain NFTs exist, so the honest criticism is not that every conventional NFT uses AWS. The criticism is that direct media permanence is usually optional and users often cannot tell which dependency they are buying.</p>
          <h3>Ordinals placed the bytes on Bitcoin and exposed a second layer.</h3>
          <p>Bitcoin Ordinals demonstrated that the artifact itself can be carried in transaction history. Yet inscription numbering, sat tracking, ownership interpretation, transfers, and collection views are produced by indexer software rather than exposed as a native Bitcoin NFT state. That software is open and reproducible, but most users consume the answers of a small set of hosted indexers. On-chain bytes remove one trust dependency while leaving interpretation and availability as operational dependencies.</p>
          <h3>Relics treats interpretation as work that can be checked.</h3>
          <p>Bittensor cannot eliminate indexing; any searchable artifact system needs computation and storage. The opportunity is to stop pretending the index is invisible. Relics defines one strict replay rule, makes finalized Subtensor history the authority, and proposes that competing miners perform the replay while validators measure whether their answers are identical. A miner can accelerate retrieval. It cannot rewrite the transaction, change the burn, invent an owner, or consume an ordinal number with an invalid mint.</p>
        </Chapter>

        <Chapter number="03" title="What a Relic is—and is not" id="definition">
          <p>A Relic is a protocol object derived from one qualifying finalized Subtensor extrinsic. Its irreducible evidence includes the chain genesis, finalized block number and hash, extrinsic position and hash, signer AccountId32, selected subnet generation, TAO committed, actual alpha burned, limit price, paid transaction fee, original inscription bytes, and their hashes. An image Relic additionally commits its media type, byte length, dimensions, SHA-256 content hash, and exact WebP bytes.</p>
          <ul><li>It <b>is</b> a permanent chain receipt for specific bytes and a specific signed economic action.</li><li>It <b>is</b> assigned a canonical ID and deterministic order by public Relics rules.</li><li>It <b>can</b> have a protocol owner and signed transfer history derived from later finalized remarks.</li><li>It <b>is not</b> an EVM NFT, a smart-contract token, an alpha token with metadata attached to it, or a native asset known to the Subtensor runtime.</li><li>It <b>does not</b> prove copyright, artistic originality, legality, factual truth, or the identity of a person depicted in the image.</li><li>It <b>does not</b> guarantee that every gateway will display the content forever. The historical bytes remain the source from which compliant archives and miners can reconstruct it.</li></ul>
          <p>Duplicates are allowed because the chain can prove position and provenance, not human originality. Indexers disclose matching content hashes and can identify the earliest accepted instance. The unique object is the signed chain event at its canonical position, even when two objects carry identical media.</p>
        </Chapter>

        <Chapter number="04" title="Trust model: the chain is evidence; the index is a deterministic lens" id="trust">
          <p>Subtensor is authoritative for transaction order, execution success, signer, TAO movement, alpha operations, emitted events, remark bytes, and finality. Relics software is authoritative only to the extent that it faithfully applies the published protocol to those facts. Only finalized blocks can create canonical state. A submitted transaction, wallet popup, transaction hash, best-chain block, or optimistic interface message is never enough.</p>
          <p>The chain&apos;s validators validate runtime execution and consensus. They do not semantically certify that an image is safe, valuable, original, or a “Relic.” Relics miners and validators would validate the additional deterministic interpretation: whether the exact call shape qualifies, whether all required events match, what number the artifact receives, who currently owns it under the protocol, and whether served media matches the on-chain hash.</p>
          <div className="paper-call-path"><span>Authority flows one way</span><code>Finalized Subtensor history → strict Relics rules → reproducible index → dapp views</code><p>The website, database, gateway, miner, validator, and marketplace cannot create a chain fact. If every Relics server disappeared, a clean implementation could rebuild the state from the published activation block and finalized history.</p></div>
        </Chapter>

        <Chapter number="05" title="The forge: what the creator does" id="forge">
          <p>The forge is designed so a person can create a Relic from one website without running a node, command-line wallet, or hotkey. The user connects an injected SS58 wallet such as TAOStats Wallet. The site receives public accounts and requests signatures through the extension; it never creates, sees, transmits, or stores the private key.</p>
          <ol><li><b>Select an alpha economy.</b> The site reads active non-root subnets from a pinned testnet genesis and displays the subnet number, current registration generation, name, symbol, and registered owner hotkey.</li><li><b>Choose a TAO commitment.</b> Version 1 is TAO-targeted. The user chooses how much TAO to spend; the runtime quote estimates how much alpha that TAO will acquire after the pool fee, slippage, and price impact.</li><li><b>Compose the Relic.</b> The creator supplies a name, an optional inscription, a purpose, and—when the purpose is a collection entry—a collection label.</li><li><b>Add media.</b> PNG, JPEG, or WebP input is cropped and compressed locally into a passive bounded WebP. The reference site does not upload the image to IPFS, S3, Vercel Blob, or another media gateway.</li><li><b>Accept the covenant.</b> The creator explicitly attests to the <code>br-safe-1</code> content policy. That policy identifier becomes part of the signed manifest.</li><li><b>Review fresh chain facts.</b> Immediately before signing, the site refreshes the finalized snapshot, subnet generation, route hotkey, quote, ending spot-price limit, price impact, estimated fee, spend, image size, genesis, and wallet balance.</li><li><b>Sign once.</b> The wallet presents the exact atomic call. The website submits the signed bytes without obtaining custody of the account.</li><li><b>Wait for finality.</b> The site follows finalized blocks, locates the extrinsic, scopes its events, and constructs evidence only if every check passes.</li></ol>
          <p>The creator does not send work to a miner queue and does not escrow a separate miner fee. Mining is not on the critical path for transaction finality. The chain either finalizes the mint or it does not. Indexing follows afterward and may take additional time depending on worker or subnet lag.</p>
        </Chapter>

        <Chapter number="06" title="The atomic mint: Buy, Burn, and Inscribe" id="atomic-mint">
          <p>A version 1 mint contains exactly two calls in exactly this order:</p>
          <pre><code>{`Utility.batch_all([
  SubtensorModule.add_stake_burn(
    subnet_owner_hotkey,
    netuid,
    tao_amount,
    Some(maximum_ending_spot_price)
  ),
  System.remark_with_event(relic_payload)
])`}</code></pre>
          <p><code>batch_all</code> is the atomic boundary. If the swap-and-burn fails, the inscription rolls back. If the remark fails, the burn rolls back. Extra inner calls, a different order, or a non-atomic <code>batch</code> do not qualify. This prevents a burn without its promised artifact and an artifact without its matching burn.</p>
          <p>The site routes the momentary stake through the selected subnet&apos;s registered owner hotkey read from the same finalized snapshot as the quote. This lets a coldkey-only wallet participate without creating its own hotkey. No purchased alpha stake is left for the user or route hotkey after the burn operation. The route hotkey remains visible in the transaction evidence.</p>
          <p>The indexer requires matching <code>ExtrinsicSuccess</code>, <code>BatchCompleted</code>, <code>AddStakeBurn</code>, <code>AlphaBurned</code>, <code>Remarked</code>, and <code>TransactionFeePaid</code> evidence. The actual <code>AlphaBurned</code> value is canonical. The current runtime can report a nominal <code>AddStakeBurn.alpha</code> one alpha-rao above the actual amount because the burn caps at the alpha available after the stake leg; protocol v1 permits only that one-unit rounding difference and rejects anything larger.</p>
        </Chapter>

        <Chapter number="07" title="On-chain media: exact bytes, bounded deliberately" id="media">
          <p>A text-only Relic uses strict UTF-8 JSON. An image Relic uses a binary envelope so the exact WebP does not need base64 inflation:</p>
          <pre><code>{`4 bytes   ASCII magic "BRI1"
4 bytes   big-endian unsigned manifest length
N bytes   canonical UTF-8 JSON manifest
remainder exact WebP image bytes`}</code></pre>
          <p>The manifest records protocol and version, operation, subnet number and generation, name, purpose, content policy, media type, binary encoding, SHA-256 content hash, content length, width, height, and optional inscription or collection label. The indexer verifies that the appended bytes are a passive WebP, their length and hash match the manifest, and the envelope respects all limits.</p>
          <div className="paper-metrics"><div><span>Plain JSON</span><strong>2,048 bytes maximum</strong></div><div><span>Image envelope</span><strong>16,384 bytes maximum</strong></div><div><span>WebP payload</span><strong>12,288 bytes maximum</strong></div><div><span>Dimensions</span><strong>64–256 pixels per side</strong></div></div>
          <p>The small limits are a feature, not an accident. Permanent bytes impose chain-wide archival cost. Relics chooses a constrained visual medium that can be reconstructed without trusting a media URL while preventing the forge from pretending Subtensor is an unlimited file-storage service. The on-chain transaction is canonical; any CDN thumbnail, database copy, Hippius snapshot, or miner response is a replaceable cache whose hash must match the chain.</p>
          <p>“Stored on-chain” means the exact envelope is part of finalized historical block data. It does not mean every lightweight RPC retains every historical block forever. Durable retrieval still depends on archival infrastructure. A Relics subnet improves replicated retrieval and verification, while the hash and block position let anyone audit what it serves.</p>
        </Chapter>

        <Chapter number="08" title="Buy & Burn economics: what the burn proves" id="economics">
          <p>The user is not depositing alpha already held in the wallet. Version 1 spends TAO into a selected subnet pool and immediately burns the acquired alpha stake. The selected amount in the forge is TAO input. Alpha output varies with the current pool state, fee, price impact, and the order&apos;s execution limit. The post-finality receipt records the actual result; a preview estimate never substitutes for the emitted event.</p>
          <p>The site computes a maximum acceptable <b>ending spot price</b> from the fresh current spot price. Version 1 uses a 2% tolerance and rounds upward. The runtime call disallows partial execution. If the swap would end above the limit, the entire atomic batch fails rather than silently widening the price or filling a worse market order.</p>
          <aside className="paper-correction"><span>Critical correction</span><strong>Buy & Burn is an irreversible economic sacrifice, but it is supply-neutral under the current runtime.</strong><p>The <code>burn_alpha</code> path removes the user&apos;s acquired alpha stake without reducing <code>SubnetAlphaOut</code>. The separate recycle path changes that accounting. Relics v1 uses Buy & Burn, not Recycle. Therefore the paper does not promise subnet deflation, reduced total alpha issuance, or token-price appreciation.</p></aside>
          <p>The defensible economic claim is narrower and stronger: every accepted Relic requires real demand against one chosen subnet pool and proves the exact amount of alpha sacrificed in a finalized event. That gives subnet communities a measurable cultural use for their alpha economy. It may create recurring buy activity, fees, and attention, but market outcomes are uncertain and cannot be inferred from protocol design.</p>
          <p>A creator may want a collection requiring “at least 1,000 SCORE burned.” The current forge cannot promise an exact alpha target because it starts from TAO. A future alpha-target quoting mode can calculate the necessary TAO and accept the mint only when the finalized actual alpha meets the declared threshold. Until then, an alpha figure shown before execution is an estimate, not a collection guarantee.</p>
        </Chapter>

        <Chapter number="09" title="Canonical identity, subnet generations, and numbering" id="identity">
          <p>A Relic&apos;s canonical identifier is objective chain position:</p>
          <pre><code>br1:&lt;full-genesis-hash&gt;:&lt;finalized-block-number&gt;:&lt;extrinsic-index&gt;</code></pre>
          <p>The full genesis prevents testnet and mainnet histories from mixing. The block and extrinsic index identify the exact qualifying operation. Version 1 permits one mint in that extrinsic, so no inner-operation suffix is required.</p>
          <p>A subnet is identified by <code>(netuid, NetworkRegisteredAt[netuid])</code>, which Relics calls <code>subnet_generation</code>. Netuid alone is unsafe because a deregistered number may later belong to a different subnet. A mint signed for an old generation cannot silently become a collectible for the new occupant.</p>
          <p>After the immutable activation block, accepted mints receive a global number and a number within their subnet generation. Order is ascending finalized block number and extrinsic index. Invalid candidates never consume numbers. The friendly number is derived display state; the canonical artifact ID remains stable even if an interface chooses a different numbering presentation.</p>
        </Chapter>

        <Chapter number="10" title="Ownership and transfers without pretending they are native NFTs" id="ownership">
          <p>The signer and funder of a valid mint becomes its initial Relics protocol owner. Ownership is derived rather than stored in a Subtensor NFT pallet. A version 1 transfer is a standalone, signed, successful <code>System.remark_with_event</code> containing the artifact ID, destination AccountId32, and the next ownership nonce.</p>
          <p>The index accepts a transfer only when the signer is the current owner immediately before that extrinsic, the destination is valid and different, the nonce is exactly next, the remark and success events match, and the block is finalized. Each accepted transfer increments the nonce. This prevents an old signature from being replayed after the artifact changes hands and even after it later returns to the same address.</p>
          <p>This makes Relics transferable under open deterministic rules. It does not make them natively transferable by Subtensor itself. Wallets and explorers unaware of the protocol will see signed remarks and balance effects, not an NFT balance. If competing indexers disagree, the answer is resolved by replaying finalized history against the published rules—not by asking the website operator which database row is correct.</p>
        </Chapter>

        <Chapter number="11" title="Purposes, collections, milestones, and community memory" id="collections">
          <p>The signed manifest can identify four creation purposes: personal artifact, collection entry, subnet milestone, or community message. This lets the same primitive serve more than profile art.</p>
          <ul><li><b>Personal artifacts</b> bind a creator&apos;s chosen image and words to a subnet-alpha sacrifice.</li><li><b>Collections</b> can establish shared themes—for example, cartoon interpretations of a subnet founder with a minimum finalized alpha burn—while preserving creative variation.</li><li><b>Subnet milestones</b> can preserve an upgrade announcement, launch image, research result, or important public post as permanent historical evidence.</li><li><b>Community messages</b> can attach a conspicuous burn to a statement, memorial, commitment, or celebration so the transaction acts as a timestamped receipt.</li></ul>
          <p>Version 1 collection labels are creator-declared metadata only. They do not yet prove that the subnet owner approved the work, that a minimum burn was met, that the piece falls within a capped supply, or that it follows a canonical theme. Interfaces must not display these labels as verified membership.</p>
          <p>The proposed collection declaration is a separate authority-signed operation binding the authority, full genesis, subnet generation, eligible mint window, minimum finalized alpha burn, maximum supply, content rules, and any delegated curators. Membership would then be derived from both the declaration and the mint&apos;s finalized evidence. This design lets a subnet define a serious collectible economy without giving a web administrator discretionary power to insert pieces after the fact.</p>
        </Chapter>

        <Chapter number="12" title="The content covenant and the limit of moderation" id="content">
          <p>The reference forge requires the creator to sign the <code>br-safe-1</code> attestation: no sexual or exploitative content, graphic violence, weapons-focused imagery, hate, or illegal material. The identifier sits inside the permanent manifest, making the creator&apos;s statement auditable.</p>
          <p>The attestation is not automated proof that content is lawful or safe. Once accepted into finalized history, the bytes cannot be deleted by the Relics team, miners, validators, or marketplace. The practical enforcement layer is refusal: the reference forge may prevent creation, and miners, validators, indexers, gateways, marketplaces, and front ends may reject, quarantine, or decline to display material that violates their published policies.</p>
          <p>This boundary must remain explicit. Immutability prevents retroactive censorship of the chain record, but it also eliminates deletion as a remedy. A responsible permanent-media protocol therefore uses narrow file formats, small limits, clear creator attestations, interface policy, safe rendering, and conservative public indexing.</p>
        </Chapter>

        <Chapter number="13" title="The deterministic indexer" id="indexer">
          <p>The indexer follows finalized heads from one published activation block. For each block it fetches the signed extrinsics, events, runtime version, parent relationship, and relevant state. It decodes using compatible metadata, finds candidate Relics operations, validates the exact call shape and payload, records accepted or rejected outcomes, assigns numbers, updates ownership, and commits the entire block atomically.</p>
          <p>Every accepted artifact retains enough evidence to reproduce the decision: original remark bytes, payload hash, signer, call path, burn and fee events, subnet generation, limit price, media hash, and chain position. Every rejected candidate receives a stable reason without rendering unsafe payloads. Duplicate delivery is idempotent, and database constraints prevent two artifacts from claiming the same position or number.</p>
          <p>The worker fails closed. An unknown runtime specification, undecodable call, duplicate JSON key, missing success event, wrong genesis, mismatched hotkey, stale subnet generation, oversized image, invalid hash, or burn discrepancy pauses or rejects processing; it never guesses. A supported runtime upgrade requires tests before indexing resumes.</p>
          <p>A second clean database must replay the same bounded finalized range. A read-only audit compares checkpoint, block sequence, artifacts, ownership, transfers, and rejection digests. Zero divergence is a release requirement. The first conventional deployment uses replaceable Node workers and PostgreSQL because no evaluated public subnet currently supplies the required persistent worker-plus-relational-database service contract. Those databases are caches, not authorities.</p>
        </Chapter>

        <Chapter number="14" title="The proposed Relics subnet: miners replay, validators challenge" id="subnet">
          <p>The long-term commodity is verifiable Relics state and historical availability—not one miner manually processing one mint job. Miners continuously replay finalized Subtensor history, preserve and verify media, publish checkpoint commitments, and answer current-state, historical, ownership, rejection, and media queries. A newly finalized mint naturally enters every honest miner&apos;s next replay window.</p>
          <p>Validators maintain independent reference state and issue unpredictable challenges bound to a finalized checkpoint, a dataset, and a nonce. They check accepted and rejected operations, ordinal numbers, current ownership, transfer history, media hashes, freshness, latency, availability, and historical coverage. Correctness is mandatory; speed matters only after correctness. Commit-reveal weighting and unpredictable sampling are proposed to make copying another validator less useful.</p>
          <p>The dapp gateway queries multiple miners and returns canonical data only when a configured threshold agrees. A fast dissenting miner receives no power to redefine history. Without quorum, the gateway fails closed rather than choosing the most convenient answer. Users can always fall back to direct chain evidence and independent replay.</p>
          <h3>Who pays the miners?</h3>
          <p>Once a subnet is registered and operating, miners would compete for emissions according to validator-assigned weights under Bittensor&apos;s incentive mechanism. The minting user does not need to negotiate an escrow or wait for a miner to claim a one-off task. Chain fees pay for the mint transaction; subnet emissions would pay miners for maintaining the ongoing verified service. Registration cost, emissions design, validator operations, and runway remain unresolved economic work and must be evaluated from live chain conditions before launch.</p>
          <p>The public Network page currently demonstrates only a deterministic three-miner simulation: two matching state commitments reach a 2-of-3 threshold and one divergent answer is rejected. No Relics subnet is registered, no live miner is earning emissions, and no validator is currently attesting production data.</p>
        </Chapter>

        <Chapter number="15" title="Marketplace design and the no-loss rule" id="marketplace">
          <p>Version 1 supports the foundation for non-custodial discovery. An owner can sign a portable listing message containing the domain, full genesis, artifact ID, normalized seller, current ownership nonce, price, expiry, unique nonce, and optional buyer. The server reconstructs and verifies the message; it cannot change its terms. A transfer, expiry, or signed cancellation makes the listing inactive.</p>
          <p>A listing signature authorizes discovery only. It cannot move TAO, transfer a Relic, spend from a wallet, or give custody to the website. Marketplace settlement is intentionally disabled because an atomic TAO payment plus remark is not sufficient: Subtensor does not know Relics ownership, so a competing transfer ordered first could make the index reject the purchase after the buyer&apos;s TAO moved.</p>
          <blockquote><p>A conforming buyer must never irreversibly pay TAO unless the same chain-enforced outcome makes that buyer the protocol owner.</p></blockquote>
          <p>Mainnet trading cannot launch until a reviewed non-EVM construction proves that invariant. An indexer promise, web escrow, miner vote, or “trust us” refund policy is not enough. The final mechanism may require a native runtime primitive or another construction whose payment and ownership effects cannot diverge.</p>
        </Chapter>

        <Chapter number="16" title="Security model and failure behavior" id="security">
          <ul><li><b>No custody:</b> the site never handles seed phrases or private keys. The injected wallet signs reviewed bytes.</li><li><b>Genesis pinning:</b> the client refuses an RPC serving the wrong chain.</li><li><b>Finality only:</b> pending and best-chain operations never receive canonical state.</li><li><b>Fresh review:</b> subnet generation, hotkey, quote, price limit, fee, and balance are refreshed before signing.</li><li><b>Atomicity:</b> only the exact <code>batch_all</code> burn-plus-inscription shape qualifies.</li><li><b>Actual events:</b> TAO input, alpha burned, and paid fee come from finalized events, not JSON claims or estimates.</li><li><b>Runtime compatibility:</b> unknown specifications stop the index rather than being decoded optimistically.</li><li><b>Replay protection:</b> full genesis, protocol domains, artifact IDs, and sequential ownership nonces bind signatures.</li><li><b>Media safety:</b> the forge accepts bounded passive WebP; user text is escaped and never treated as HTML.</li><li><b>Loss controls:</b> mainnet minting and paid settlement remain disabled while testnet and no-loss gates are incomplete.</li></ul>
          <p>Expected failures include wallet rejection, insufficient test TAO, stale quotes, price movement beyond the limit, subnet deregistration, disabled alpha, RPC outage, finality delay, unsupported runtime upgrades, database lag, miner disagreement, and policy rejection. A good failure is explicit and does not request a broader signature, retry as a market order, invent a Relic, or hide uncertainty from the user.</p>
        </Chapter>

        <Chapter number="17" title="The founding testnet Relic" id="founding-relic">
          <p>The first independently verified Bittensor Relics image mint finalized on the test network at block 7,698,721, extrinsic index 6. It is named <b>Shizzy</b>, carries an 8,698-byte 256×256 WebP inside the finalized transaction, commits 1 test TAO, and records an actual burn of 1,035.580333229 subnet-one alpha. The paid transaction fee was 0.001743874 test TAO.</p>
          <div className="founding-proof"><div><span>Canonical ID</span><code>br1:0x8f9cf856…8263105:7698721:6</code></div><div><span>Transaction</span><code>0xc465ceb5…9cafdf97</code></div><div><span>Manifest policy</span><strong>br-safe-1 / personal</strong></div><div><span>Activation block</span><strong>7,698,720</strong></div></div>
          <p>The transaction emitted a nominal <code>AddStakeBurn.alpha</code> one alpha-rao above the canonical <code>AlphaBurned</code> amount. This exposed an overly strict verifier, not a failed mint. The protocol and indexer were corrected to accept only that runtime rounding boundary and to preserve <code>AlphaBurned</code> as the actual proof.</p>
          <p><a href="/evidence/founding-testnet-relic.json">Download the complete founding evidence JSON</a>. The proof can be independently re-read against the finalized block without trusting the website&apos;s database.</p>
        </Chapter>

        <Chapter number="18" title="What works now, what does not, and what comes next" id="current-status">
          <div className="paper-status-table"><div><span>Working now</span><ul><li>Live testnet subnet discovery and alpha quotes</li><li>TAOStats/injected SS58 wallet connection</li><li>Local bounded image conversion</li><li>Atomic Buy & Burn plus on-chain inscription</li><li>Finalized receipt verification and evidence download</li><li>Verified founding testnet image Relic</li><li>Strict indexer and replay audit code</li><li>Protocol transfers and signed marketplace discovery code</li><li>Three-miner conformance simulation</li></ul></div><div><span>Not live yet</span><ul><li>Public primary and independent replay databases</li><li>Indexed Explore, My Relics, media, transfer, and listing data</li><li>Registered subnet, miners, validators, or emissions</li><li>Verified authority-defined collections</li><li>Exact alpha-target mint mode</li><li>Mainnet minting</li><li>TAO purchase settlement or escrow</li><li>Native Subtensor NFT ownership</li><li>Any promise of alpha supply reduction</li></ul></div></div>
          <p>The current API intentionally returns <code>INDEXER_UNAVAILABLE</code> rather than pretending an absent database is an empty collection. The founding Relic is on-chain and independently proven, but it will not appear in Explore or My Relics until the public indexer deployment replays from the frozen activation block.</p>
        </Chapter>

        <Chapter number="19" title="Road to a controlled launch" id="roadmap">
          <ol><li>Freeze and review one exact source commit as the release candidate.</li><li>Run deterministic build, dependency, runtime-compatibility, and unsigned transaction checks on that commit.</li><li>Rehearse wallet rejection, wrong-genesis, stale-quote, disconnected-wallet, and insufficient-balance paths without submission.</li><li>Retain the founding finalized mint evidence and independent verification report.</li><li>Provision separate primary and replay PostgreSQL databases and start both workers from block 7,698,720.</li><li>Stop both at one finalized checkpoint, compare every canonical dataset, and require zero divergence.</li><li>Publish the primary read API and prove Explore, wallet, Relic, media, ownership, and rejection pages against chain evidence.</li><li>Exercise a real testnet transfer plus listing invalidation while keeping payment disabled.</li><li>Run adversarial review, monitoring, runtime-upgrade drills, and a limited public testnet beta.</li><li>Design and test miner/validator services before considering subnet registration; then separately solve chain-enforced marketplace settlement and mainnet approval.</li></ol>
          <p>More subnet capacity may improve the opportunity for a specialized proof commodity, but it does not guarantee an inexpensive registration or viable emissions. The registration lock is dynamic. Relics should register only when the service, incentive model, validator independence, security budget, and operating runway work without privileged trust.</p>
        </Chapter>

        <Chapter number="20" title="Open questions the experiment must answer" id="questions">
          <ul><li>Can independent indexers replay the full supported range and produce byte-identical state under real runtime upgrades?</li><li>What challenge schedule makes dishonest history, selective availability, and copied validator weights unprofitable?</li><li>How much archival storage, egress, and verification work should the incentive function reward?</li><li>Should the first live subnet serve only the index, or also encrypted snapshots and historical media redundancy?</li><li>How should authority-defined collections delegate curators, resolve key rotation, and remain valid across subnet generations?</li><li>Can exact alpha-target minting provide predictable collection thresholds without hiding slippage or inducing unsafe retries?</li><li>What native non-EVM settlement primitive can satisfy the buyer no-loss invariant?</li><li>How should interfaces coordinate content refusal without falsely claiming the chain bytes can be erased?</li><li>What is the smallest sustainable on-chain media envelope once real demand and archival cost are measured?</li><li>Does the resulting subnet commodity produce more verifiable value than a conventional replicated index at its true operating cost?</li></ul>
          <p>These are research and engineering questions, not marketing details. A Blackpaper is useful only if it makes falsification easier. Where evidence contradicts the story, the story must change.</p>
        </Chapter>

        <Chapter number="21" title="Conclusion" id="conclusion">
          <p>Bittensor Relics combines three facts that normally live apart: exact media, an irreversible economic action, and a reproducible history of protocol ownership. Subtensor provides the finalized execution record. The Relics protocol defines what qualifies. A deterministic index makes the history usable. A future Bittensor subnet can turn that indexing and retrieval into a competitive, validator-measured service.</p>
          <p>The strongest claim is not that Relics eliminates off-chain computation, creates native NFTs, guarantees deflation, or makes bad content disappear. It is that the essential artifact and burn receipt can be carried in one finalized non-EVM transaction, while every derived answer can be rebuilt and challenged against public chain evidence.</p>
          <blockquote className="paper-final"><p>The Relic is the art.<br />The burn is the proof.<br />The network verifies the memory.</p></blockquote>
        </Chapter>
      </article>

      <aside className="paper-status blackpaper-references">
        <span>Normative and implementation references</span>
        <strong>The Blackpaper explains the system. The protocol specification defines acceptance.</strong>
        <div><a href="https://github.com/shizzyunchained/taoscriptions/blob/feat/neural-relics-v1/docs/PROTOCOL.md" target="_blank" rel="noreferrer">Protocol v1</a><a href="https://github.com/shizzyunchained/taoscriptions/blob/feat/neural-relics-v1/docs/INDEXER.md" target="_blank" rel="noreferrer">Indexer contract</a><Link href="/docs">Claim fact check</Link><Link href="/network">Proof-network simulation</Link></div>
      </aside>

      <div className="network-actions docs-actions"><Link href="/#forge">Create a testnet Relic</Link><Link href="/docs">Read the fact check</Link></div>
      <footer><SiteMark className="footer-brand" /><p>Draft 0.2 — experimental, testnet-first, and written to be falsifiable.</p><a href="#status">Back to top →</a></footer>
    </main>
  );
}
