import type { Metadata } from "next";
import Link from "next/link";
import { MarketplaceBrowser } from "@/components/marketplace-browser";
import { SiteMark } from "@/components/site-mark";
import { SiteNav } from "@/components/site-nav";
import { readTestnetSubnets } from "@/lib/chain-reader";
import {
  IndexerUnavailableError,
  listActiveListings,
  listArtifacts,
} from "@/lib/indexer-db";
import { buildSubnetNameMap, type SubnetNameMap } from "@/lib/subnet-display";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Marketplace — Bittensor Relics",
  description: "Discover, inspect, and list finalized on-chain Bittensor Relics.",
};

export default async function MarketplacePage() {
  let listings: Awaited<ReturnType<typeof listActiveListings>> = [];
  let artifacts: Awaited<ReturnType<typeof listArtifacts>>["artifacts"] = [];
  let subnetNames: SubnetNameMap = {};
  let unavailable = false;
  try {
    const [activeListings, collection, chainSnapshot] = await Promise.all([
      listActiveListings(null, 100),
      listArtifacts({ limit: 100, cursor: null }),
      readTestnetSubnets().catch(() => null),
    ]);
    listings = activeListings;
    artifacts = collection.artifacts;
    subnetNames = buildSubnetNameMap(chainSnapshot?.subnets ?? []);
  } catch (error) {
    if (error instanceof IndexerUnavailableError) unavailable = true;
    else throw error;
  }
  const subnetEconomies = new Set(
    artifacts.map((artifact) => `${artifact.netuid}:${artifact.subnetGeneration}`),
  ).size;

  return (
    <main className="site-shell inner-site">
      <div className="grain" aria-hidden="true" />
      <SiteNav status="Marketplace" tone="ready" />
      <section className="market-hero">
        <div>
          <p className="eyebrow">The Relic market</p>
          <h1>Collect proof.<br />Discover history.</h1>
          <p>Discover permanent on-chain art backed by a finalized subnet-token burn. Every card identifies the subnet economy and links to the media bytes, inscription, owner, and chain receipt.</p>
          <div className="market-hero-actions">
            <Link href="/wallet#listing">List a Relic</Link>
            <Link href="/wallet">My Relics</Link>
          </div>
        </div>
        <dl className="market-stats">
          <div><dt>Relics</dt><dd>{artifacts.length}</dd></div>
          <div><dt>Listed</dt><dd>{listings.length}</dd></div>
          <div><dt>Subnet economies</dt><dd>{subnetEconomies}</dd></div>
          <div><dt>Network</dt><dd>Testnet</dd></div>
        </dl>
      </section>
      <section className="settlement-lock"><strong>Discovery marketplace</strong><p>Asking prices are wallet-signed and checked against current indexed ownership. Buying is disabled until one native state transition can enforce both TAO payment and Relic ownership.</p></section>
      <section className="market-rules" aria-label="Marketplace safety rules">
        <div><span>01</span><strong>Finalized ownership</strong><p>Only the current indexed owner can publish or cancel a listing.</p></div>
        <div><span>02</span><strong>Portable authorization</strong><p>Every asking price is bound to the Relic, owner, nonce, network, and expiry.</p></div>
        <div><span>03</span><strong>Buyer no-loss gate</strong><p>Payment stays locked until TAO and ownership can settle together.</p></div>
      </section>
      {unavailable ? (
        <section className="indexer-empty"><span>Indexer gate</span><h2>The marketplace index is temporarily unavailable.</h2><p>Relics will never display unverified market inventory.</p><Link href="/explore">View collection status</Link></section>
      ) : (
        <MarketplaceBrowser artifacts={artifacts} listings={listings} subnetNames={subnetNames} />
      )}
      <footer><SiteMark className="footer-brand" /><p>Wallet-signed listings. Chain-verifiable ownership.</p><Link href="/wallet#listing">List a Relic -&gt;</Link></footer>
    </main>
  );
}
