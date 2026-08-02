import Link from "next/link";
import { RelicCard } from "@/components/relic-card";
import { SiteMark } from "@/components/site-mark";
import { IndexerUnavailableError, listArtifacts, pageCursor } from "@/lib/indexer-db";

export const dynamic = "force-dynamic";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor: rawCursor } = await searchParams;
  let result: Awaited<ReturnType<typeof listArtifacts>> | null = null;
  let unavailable = false;
  try {
    result = await listArtifacts({ limit: 24, cursor: pageCursor(rawCursor ?? null) });
  } catch (error) {
    if (error instanceof IndexerUnavailableError) unavailable = true;
    else throw error;
  }

  return (
    <main className="site-shell inner-site">
      <div className="grain" aria-hidden="true" />
      <nav className="nav" aria-label="Main navigation">
        <SiteMark />
        <div className="nav-links"><Link href="/#forge">Forge</Link><Link href="/explore">Explore</Link><Link href="/marketplace">Market</Link><Link href="/wallet">My Relics</Link><span className="chain-status ready"><i aria-hidden="true" />Finalized only</span></div>
      </nav>
      <section className="collection-hero">
        <p className="eyebrow">Canonical collection</p>
        <h1>Relics proven by<br />destroyed alpha.</h1>
        <p>Every number below is assigned from finalized Bittensor block order. Pending transactions and rejected inscriptions never appear.</p>
      </section>
      {unavailable ? (
        <section className="indexer-empty">
          <span>Indexer gate</span>
          <h2>The finalized collection is not online yet.</h2>
          <p>The interface will not substitute test cards or claim ownership before the database completes its first reproducible testnet sync.</p>
          <Link href="/#forge">Return to the testnet forge</Link>
        </section>
      ) : result && result.artifacts.length > 0 ? (
        <>
          <section className="artifact-grid" aria-label="Finalized Bittensor Relics">
            {result.artifacts.map((artifact) => <RelicCard key={artifact.artifactId} artifact={artifact} />)}
          </section>
          {result.nextCursor && <div className="pagination"><Link href={`/explore?cursor=${result.nextCursor}`}>Load earlier relics <span aria-hidden="true">-&gt;</span></Link></div>}
        </>
      ) : (
        <section className="indexer-empty"><span>Finalized collection</span><h2>No valid relic has been indexed.</h2><p>The first successful atomic testnet mint will become Relic #1 after finalization.</p><Link href="/#forge">Forge the first candidate</Link></section>
      )}
      <footer><SiteMark className="footer-brand" /><p>Derived only from finalized Subtensor evidence.</p><Link href="/">Protocol home -&gt;</Link></footer>
    </main>
  );
}
