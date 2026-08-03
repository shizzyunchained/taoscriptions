import type { Metadata } from "next";
import Link from "next/link";
import { SiteMark } from "@/components/site-mark";

export const metadata: Metadata = {
  title: "White Paper V1 — Bittensor Relics",
  description: "The working Bittensor Relics paper: on-chain media, alpha-burn receipts, decentralized indexing, collections, and ownership.",
};

export default function WhitepaperPage() {
  return (
    <main className="site-shell inner-site docs-site whitepaper-site">
      <div className="grain" aria-hidden="true" />
      <nav className="nav" aria-label="Main navigation">
        <SiteMark />
        <div className="nav-links"><Link href="/#forge">Forge</Link><Link href="/network">Network</Link><Link href="/whitepaper">Whitepaper</Link><Link href="/docs">Fact check</Link><span className="chain-status prototype"><i aria-hidden="true" />Working paper</span></div>
      </nav>

      <header className="whitepaper-hero">
        <p className="eyebrow">Bittensor Relics / White Paper V1</p>
        <h1>Art, sacrifice,<br />and verifiable memory.</h1>
        <div><span>Draft 0.1</span><strong>Two paragraphs published</strong></div>
      </header>

      <article className="paper-body" aria-label="Bittensor Relics white paper draft">
        <section>
          <span>01</span>
          <p>Most NFTs on Ethereum and Solana do not store their image bytes directly onchain; the token usually contains a reference to media hosted through IPFS, Arweave, or conventional cloud infrastructure such as AWS. Bitcoin Ordinals addressed this weakness by inscribing the actual content into Bitcoin transactions, but introduced a different dependency: offchain indexers must interpret inscription order, ownership, transfers, and collection state. Although Ordinals indexing is open and reproducible, most users still trust a small number of services to perform it correctly. Bittensor Relics proposes a system that addresses both problems: the exact artwork and its economic proof are anchored in a finalized Subtensor transaction, while competing miners retrieve, preserve, and index each Relic and validators independently verify their accuracy. Every mint also purchases and burns alpha from a chosen subnet, binding the artwork to a provable economic sacrifice and creating recurring demand for that subnet’s token economy. The Relic is the art; the burn is the proof; Bittensor is the verification network.</p>
        </section>

        <section>
          <span>02</span>
          <p>A Relic begins in the Bittensor Relics forge, where a creator selects a subnet, commits TAO to purchase and burn its alpha, names the artifact, writes an optional permanent inscription, and uploads the image whose compressed bytes will be included in the signed transaction; the manifest also identifies whether the work is a personal artifact, a collection entry, a subnet milestone, or a community message. Under the proposed collection protocol, a subnet owner or delegated collection authority can publish an onchain rule declaration—for example, a series requiring a verified minimum burn of 1,000 subnet alpha and a cartoon portrait of the subnet owner—while leaving artists free to interpret the theme within clear safety boundaries that exclude sexual or exploitative material, graphic violence, weapons-focused imagery, hate, and illegal content. Collections are only one form of Relic: a subnet team could permanently preserve the image and words announcing a major network upgrade, archive the visual record of an important public post, or attach a large burn to a message for its community so the finalized transaction becomes a timestamped receipt of both the statement and the sacrifice. Once finalized, protocol ownership begins with the SS58 account that signed and funded the mint; the Relic remains assigned to that account until its owner authorizes a valid transfer or a marketplace sale produces a finalized ownership event, allowing cultural memory, economic commitment, and transferable provenance to live in one reproducible chain history.</p>
        </section>
      </article>

      <aside className="paper-status">
        <span>Implementation boundary</span>
        <strong>The forge now signs purpose and the BR-SAFE-1 content attestation.</strong>
        <ul><li>Collection labels are creator-declared in the current prototype.</li><li>Verified collection authorities, burn thresholds, and rule manifests are the next protocol stage.</li><li>Content can be rejected by the Relics interface and proof network, but finalized chain bytes cannot be deleted.</li></ul>
      </aside>

      <div className="network-actions docs-actions"><Link href="/#forge">Create a testnet Relic</Link><Link href="/docs">Read the fact check</Link></div>
      <footer><SiteMark className="footer-brand" /><p>Written one verified paragraph at a time.</p><Link href="/network">Proof network -&gt;</Link></footer>
    </main>
  );
}
