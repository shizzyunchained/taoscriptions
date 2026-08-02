import Link from "next/link";
import { SiteMark } from "@/components/site-mark";
import { formatRao } from "@/lib/format";
import { IndexerUnavailableError, listActiveListings } from "@/lib/indexer-db";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  let listings: Awaited<ReturnType<typeof listActiveListings>> = [];
  let unavailable = false;
  try { listings = await listActiveListings(null, 24); }
  catch (error) {
    if (error instanceof IndexerUnavailableError) unavailable = true;
    else throw error;
  }
  return (
    <main className="site-shell inner-site">
      <div className="grain" aria-hidden="true" />
      <nav className="nav" aria-label="Main navigation"><SiteMark /><div className="nav-links"><Link href="/#forge">Forge</Link><Link href="/explore">Explore</Link><Link href="/marketplace">Market</Link><span className="chain-status"><i aria-hidden="true" />Settlement locked</span></div></nav>
      <section className="collection-hero market-hero"><p className="eyebrow">Signed discovery market</p><h1>Offers without<br />false settlement.</h1><p>Owners can publish wallet-signed asking prices. Purchases stay locked until one chain-enforced action can exchange TAO and ownership without loss.</p></section>
      <section className="settlement-lock"><strong>Buying is intentionally disabled</strong><p>A listing is an authenticated offer, not an escrow. Neural Relics will not ask buyers to send TAO based on an indexer promise.</p></section>
      {unavailable ? <section className="indexer-empty"><span>Indexer gate</span><h2>The discovery market is not online yet.</h2><p>Listings require the finalized ownership database.</p><Link href="/explore">View collection status</Link></section>
      : listings.length ? <section className="listing-grid">{listings.map((listing) => <article key={listing.listingId}><span>Signed listing</span><h2>{formatRao(listing.priceRao)} TAO</h2><p>{listing.artifactId}</p><dl><div><dt>Ownership nonce</dt><dd>{listing.ownershipNonce}</dd></div><div><dt>Expires</dt><dd>Block #{listing.expiryBlock}</dd></div></dl><Link href={`/relic/${listing.artifactId}`}>Inspect chain proof</Link><button type="button" disabled>Purchase locked</button></article>)}</section>
      : <section className="indexer-empty"><span>Discovery market</span><h2>No active signed listings.</h2><p>The current owner can publish an asking price from a relic&apos;s proof page.</p><Link href="/explore">Explore finalized relics</Link></section>}
      <footer><SiteMark className="footer-brand" /><p>Signed offers. No custodial settlement.</p><Link href="/explore">Canonical collection -&gt;</Link></footer>
    </main>
  );
}
