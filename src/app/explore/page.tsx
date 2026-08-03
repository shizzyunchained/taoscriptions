import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { RelicCard } from "@/components/relic-card";
import { SiteMark } from "@/components/site-mark";
import { SiteNav } from "@/components/site-nav";
import {
  IndexerUnavailableError,
  listArtifacts,
  pageCursor,
} from "@/lib/indexer-db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Explore Relics — Bittensor Relics",
  description:
    "Explore finalized Relics, alpha-burn receipts, media proofs, and ownership history.",
};

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor: rawCursor } = await searchParams;
  let result: Awaited<ReturnType<typeof listArtifacts>> | null = null;
  let unavailable = false;
  try {
    result = await listArtifacts({
      limit: 24,
      cursor: pageCursor(rawCursor ?? null),
    });
  } catch (error) {
    if (error instanceof IndexerUnavailableError) unavailable = true;
    else throw error;
  }

  return (
    <main className="site-shell inner-site">
      <div className="grain" aria-hidden="true" />
      <SiteNav status="Finalized only" tone="ready" />
      <section className="collection-hero">
        <p className="eyebrow">Canonical collection</p>
        <h1>
          Relics proven by
          <br />
          burned alpha.
        </h1>
        <p>
          Every number below is assigned from finalized Bittensor block order.
          Pending transactions and rejected inscriptions never appear.
        </p>
      </section>
      {unavailable ? (
        <section className="founding-explorer">
          <div className="founding-explorer-art">
            <Image
              src="/founding-relic.webp"
              alt="Shizzy Unchained, recovered and hash-verified from the founding Relic transaction"
              fill
              sizes="(max-width: 640px) 260px, 360px"
            />
          </div>
          <div className="founding-explorer-copy">
            <span>Founding Relic · #0001</span>
            <h2>Shizzy</h2>
            <p>
              The public collection index is preparing its first reproducible
              sync. The founding receipt remains independently verifiable from
              finalized chain evidence.
            </p>
            <dl>
              <div>
                <dt>Position</dt>
                <dd>Block 7,698,721 · 6</dd>
              </div>
              <div>
                <dt>TAO committed</dt>
                <dd>1 test TAO</dd>
              </div>
              <div>
                <dt>Alpha relinquished</dt>
                <dd>1,035.580333229 α</dd>
              </div>
              <div>
                <dt>Transaction</dt>
                <dd>0xc465ceb5…9cafdf97</dd>
              </div>
            </dl>
            <div className="founding-explorer-actions">
              <a href="/evidence/founding-testnet-relic.json">
                Verify evidence →
              </a>
              <Link href="/#forge">Enter the Forge</Link>
            </div>
          </div>
        </section>
      ) : result && result.artifacts.length > 0 ? (
        <>
          <section
            className="artifact-grid"
            aria-label="Finalized Bittensor Relics"
          >
            {result.artifacts.map((artifact) => (
              <RelicCard key={artifact.artifactId} artifact={artifact} />
            ))}
          </section>
          {result.nextCursor && (
            <div className="pagination">
              <Link href={`/explore?cursor=${result.nextCursor}`}>
                Load earlier relics <span aria-hidden="true">-&gt;</span>
              </Link>
            </div>
          )}
        </>
      ) : (
        <section className="indexer-empty">
          <span>Finalized collection</span>
          <h2>The collection is ready for its next Relic.</h2>
          <p>Accepted Relics appear only after finalized chain verification.</p>
          <Link href="/#forge">Enter the Forge</Link>
        </section>
      )}
      <footer>
        <SiteMark className="footer-brand" />
        <p>Derived only from finalized Subtensor evidence.</p>
        <Link href="/">Protocol home -&gt;</Link>
      </footer>
    </main>
  );
}
