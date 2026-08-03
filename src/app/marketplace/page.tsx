import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { SiteMark } from "@/components/site-mark";
import { SiteNav } from "@/components/site-nav";
import { formatRao } from "@/lib/format";
import { IndexerUnavailableError, listActiveListings } from "@/lib/indexer-db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Market Research — Bittensor Relics", description: "The signed discovery and loss-safe settlement research surface for Bittensor Relics." };

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
      <SiteNav status="Settlement research" />
      <section className="collection-hero market-hero"><p className="eyebrow">Signed discovery market</p><h1>List the proof.<br />Name your price.</h1><p>Connect TAOStats Wallet, open a Relic you own, choose a TAO asking price, and sign the listing. Listing moves no funds and does not transfer ownership.</p><div className="market-hero-actions"><Link href="/wallet">List my Relic →</Link><Link href="/explore">Explore Relics</Link></div></section>
      <section className="settlement-lock"><strong>Buying is intentionally disabled</strong><p>A listing is an authenticated offer, not an escrow. Bittensor Relics will not ask buyers to send TAO based on an indexer promise.</p></section>
      {unavailable ? <section className="indexer-empty"><span>Indexer gate</span><h2>The discovery market is not online yet.</h2><p>Listings require the finalized ownership database.</p><Link href="/explore">View collection status</Link></section>
      : listings.length ? <section className="listing-grid">{listings.map((listing) => <article key={listing.listingId}><span>Relic for sale</span>{listing.mediaByteLength ? <div className="market-listing-media"><Image src={`/api/v1/artifacts/${encodeURIComponent(listing.artifactId)}/media`} alt={listing.artifactName ?? "Listed Bittensor Relic"} width={420} height={420} unoptimized /></div> : null}<h3>{listing.artifactName ?? "Bittensor Relic"}</h3><h2>{formatRao(listing.priceRao)} TAO</h2><p>{listing.artifactId}</p><dl><div><dt>Ownership nonce</dt><dd>{listing.ownershipNonce}</dd></div><div><dt>Expires</dt><dd>Block #{listing.expiryBlock}</dd></div></dl><Link href={`/relic/${encodeURIComponent(listing.artifactId)}`}>Inspect chain proof</Link><button type="button" disabled>Purchase locked</button></article>)}</section>
      : <section className="indexer-empty"><span>Discovery market</span><h2>Your Relic can be the first listing.</h2><p>Open My Relics, select the artifact, then open its proof page to choose a price and sign with TAOStats Wallet.</p><Link href="/wallet">List my Relic →</Link></section>}
      <footer><SiteMark className="footer-brand" /><p>Signed offers. No custodial settlement.</p><Link href="/explore">Canonical collection -&gt;</Link></footer>
    </main>
  );
}
