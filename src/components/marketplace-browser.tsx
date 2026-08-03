"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatRao } from "@/lib/format";
import type { Artifact, Listing } from "@/lib/indexer-db";

type SortOrder = "newest" | "burn-high" | "burn-low" | "price-low";

export function MarketplaceBrowser({ artifacts, listings }: { artifacts: Artifact[]; listings: Listing[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");
  const listingByArtifact = useMemo(
    () => new Map(listings.map((listing) => [listing.artifactId, listing])),
    [listings],
  );
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return artifacts
      .filter((artifact) => {
        if (!listingByArtifact.has(artifact.artifactId)) return false;
        if (!normalizedQuery) return true;
        return `${artifact.name} ${artifact.body ?? ""} ${artifact.globalNumber} ${artifact.netuid}`
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .toSorted((left, right) => {
        if (sort === "burn-high") return Number(BigInt(right.alphaBurnedRao) - BigInt(left.alphaBurnedRao));
        if (sort === "burn-low") return Number(BigInt(left.alphaBurnedRao) - BigInt(right.alphaBurnedRao));
        if (sort === "price-low") {
          const leftPrice = BigInt(listingByArtifact.get(left.artifactId)?.priceRao ?? "999999999999999999");
          const rightPrice = BigInt(listingByArtifact.get(right.artifactId)?.priceRao ?? "999999999999999999");
          return Number(leftPrice - rightPrice);
        }
        return Number(BigInt(right.globalNumber) - BigInt(left.globalNumber));
      });
  }, [artifacts, listingByArtifact, query, sort]);

  return (
    <section className="market-browser" aria-label="Relic marketplace">
      <div className="market-toolbar">
        <label className="market-search">
          <span className="sr-only">Search Relics</span>
          <i aria-hidden="true">⌕</i>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, inscription, number, or subnet" />
        </label>
        <Link href="/wallet#listing" className="market-list-button">List a Relic</Link>
      </div>
      <div className="market-content">
        <aside className="market-filters">
          <div>
            <span>Status</span>
            <div className="market-active-filter"><strong>Active listings</strong><small>{listings.length}</small></div>
            <Link href="/explore">Explore all Relics</Link>
          </div>
          <div className="market-filter-proof"><span>Proof standard</span><strong>Finalized only</strong><p>On-chain image · burn receipt · current owner</p></div>
          <div className="market-filter-proof"><span>Network</span><strong>Bittensor testnet</strong><p>Non-EVM · native Subtensor</p></div>
        </aside>
        <div className="market-results">
          <header>
            <div><strong>{visible.length} items</strong><span>Finalized collection</span></div>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortOrder)} aria-label="Sort marketplace items">
              <option value="newest">Recently forged</option>
              <option value="burn-high">Alpha burn: high to low</option>
              <option value="burn-low">Alpha burn: low to high</option>
              <option value="price-low">Price: low to high</option>
            </select>
          </header>
          {visible.length ? (
            <div className="market-card-grid">
              {visible.map((artifact) => {
                const listing = listingByArtifact.get(artifact.artifactId);
                return (
                  <article className="market-card" key={artifact.artifactId}>
                    <Link className="market-card-media" href={`/relic/${artifact.globalNumber}`}>
                      <Image src={`/api/v1/artifacts/${encodeURIComponent(artifact.artifactId)}/media`} alt={artifact.name} fill sizes="(max-width: 640px) 92vw, (max-width: 1100px) 42vw, 24vw" unoptimized />
                      <span>#{artifact.globalNumber.padStart(4, "0")}</span>
                      <i>{listing ? "For sale" : "Finalized"}</i>
                    </Link>
                    <div className="market-card-body">
                      <span>SN{artifact.netuid} · Subnet Relic #{artifact.subnetNumber}</span>
                      <h2>{artifact.name}</h2>
                      <p>{artifact.body ?? "Image-only Relic"}</p>
                      <dl>
                        <div><dt>{listing ? "Price" : "Status"}</dt><dd>{listing ? `${formatRao(listing.priceRao)} TAO` : "Not listed"}</dd></div>
                        <div><dt>Alpha burned</dt><dd>{formatRao(artifact.alphaBurnedRao)} α</dd></div>
                      </dl>
                      <Link href={`/relic/${artifact.globalNumber}`}>{listing ? "View listing" : "View Relic"}</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="market-no-results"><span>{listings.length ? "No matches" : "No active listings"}</span><h2>{listings.length ? "No listed Relics match your search." : "List the first Relic."}</h2>{listings.length ? <button type="button" onClick={() => setQuery("")}>Clear search</button> : <Link href="/wallet#listing">List a Relic</Link>}</div>
          )}
        </div>
      </div>
    </section>
  );
}
