import type { Metadata } from "next";
import Link from "next/link";
import { MarketplaceBrowser } from "@/components/marketplace-browser";
import { SiteMark } from "@/components/site-mark";
import { SiteNav } from "@/components/site-nav";
import { formatRao } from "@/lib/format";
import {
  IndexerUnavailableError,
  listActiveListings,
  listArtifacts,
} from "@/lib/indexer-db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Marketplace — Bittensor Relics",
  description: "Discover, inspect, and list finalized on-chain Bittensor Relics.",
};

export default async function MarketplacePage() {
  let listings: Awaited<ReturnType<typeof listActiveListings>> = [];
  let artifacts: Awaited<ReturnType<typeof listArtifacts>>["artifacts"] = [];
  let unavailable = false;
  try {
    const [activeListings, collection] = await Promise.all([
      listActiveListings(null, 100),
      listArtifacts({ limit: 100, cursor: null }),
    ]);
    listings = activeListings;
    artifacts = collection.artifacts;
  } catch (error) {
    if (error instanceof IndexerUnavailableError) unavailable = true;
    else throw error;
  }
  const totalAlpha = artifacts
    .reduce((total, artifact) => total + BigInt(artifact.alphaBurnedRao), 0n)
    .toString();

  return (
    <main className="site-shell inner-site">
      <div className="grain" aria-hidden="true" />
      <SiteNav status="Marketplace" tone="ready" />
      <section className="market-hero">
        <div>
          <p className="eyebrow">The Relic market</p>
          <h1>Collect proof.<br />Trade history.</h1>
          <p>Discover permanent on-chain art backed by a finalized alpha burn. Every card links to the media bytes, inscription, owner, and chain receipt.</p>
          <div className="market-hero-actions">
            <Link href="/wallet#listing">List a Relic</Link>
            <Link href="/wallet">My Relics</Link>
          </div>
        </div>
        <dl className="market-stats">
          <div><dt>Relics</dt><dd>{artifacts.length}</dd></div>
          <div><dt>For sale</dt><dd>{listings.length}</dd></div>
          <div><dt>Alpha burned</dt><dd>{formatRao(totalAlpha)}</dd></div>
          <div><dt>Network</dt><dd>Testnet</dd></div>
        </dl>
      </section>
      <section className="settlement-lock"><strong>Testnet marketplace</strong><p>Listing is live and wallet-signed. Paid settlement remains locked until a buyer cannot lose TAO without receiving ownership in the same chain-enforced result.</p></section>
      {unavailable ? (
        <section className="indexer-empty"><span>Indexer gate</span><h2>The marketplace index is temporarily unavailable.</h2><p>Relics will never display unverified market inventory.</p><Link href="/explore">View collection status</Link></section>
      ) : (
        <MarketplaceBrowser artifacts={artifacts} listings={listings} />
      )}
      <footer><SiteMark className="footer-brand" /><p>Wallet-signed listings. Chain-verifiable ownership.</p><Link href="/wallet#listing">List a Relic -&gt;</Link></footer>
    </main>
  );
}
