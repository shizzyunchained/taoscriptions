"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatRao } from "@/lib/format";
import type { Artifact, Listing } from "@/lib/indexer-db";

type SortOrder = "newest" | "oldest" | "burn-high" | "burn-low" | "price-low" | "price-high";
type PriceBand = "all" | "under-10" | "10-50" | "50-plus";

function compareBigInt(left: bigint, right: bigint) {
  return left === right ? 0 : left < right ? -1 : 1;
}

export function MarketplaceBrowser({ artifacts, listings }: { artifacts: Artifact[]; listings: Listing[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [subnet, setSubnet] = useState("all");
  const [purpose, setPurpose] = useState("all");
  const [priceBand, setPriceBand] = useState<PriceBand>("all");
  const listingByArtifact = useMemo(
    () => new Map(listings.map((listing) => [listing.artifactId, listing])),
    [listings],
  );
  const listedArtifacts = useMemo(
    () => artifacts.filter((artifact) => listingByArtifact.has(artifact.artifactId)),
    [artifacts, listingByArtifact],
  );
  const subnetOptions = useMemo(
    () => [...new Set(listedArtifacts.map((artifact) => artifact.netuid))].toSorted((left, right) => left - right),
    [listedArtifacts],
  );
  const purposeOptions = useMemo(
    () => [...new Set(listedArtifacts.map((artifact) => artifact.purpose))].toSorted(),
    [listedArtifacts],
  );
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return listedArtifacts
      .filter((artifact) => {
        const listing = listingByArtifact.get(artifact.artifactId);
        if (!listing) return false;
        if (subnet !== "all" && String(artifact.netuid) !== subnet) return false;
        if (purpose !== "all" && artifact.purpose !== purpose) return false;
        const price = BigInt(listing.priceRao);
        if (priceBand === "under-10" && price >= 10_000_000_000n) return false;
        if (priceBand === "10-50" && (price < 10_000_000_000n || price > 50_000_000_000n)) return false;
        if (priceBand === "50-plus" && price <= 50_000_000_000n) return false;
        if (!normalizedQuery) return true;
        return `${artifact.name} ${artifact.body ?? ""} ${artifact.globalNumber} ${artifact.subnetNumber} ${artifact.netuid} ${artifact.purpose}`.toLowerCase().includes(normalizedQuery);
      })
      .toSorted((left, right) => {
        if (sort === "burn-high") return compareBigInt(BigInt(right.alphaBurnedRao), BigInt(left.alphaBurnedRao));
        if (sort === "burn-low") return compareBigInt(BigInt(left.alphaBurnedRao), BigInt(right.alphaBurnedRao));
        if (sort === "price-low" || sort === "price-high") {
          const leftPrice = BigInt(listingByArtifact.get(left.artifactId)?.priceRao ?? "999999999999999999");
          const rightPrice = BigInt(listingByArtifact.get(right.artifactId)?.priceRao ?? "999999999999999999");
          return sort === "price-low" ? compareBigInt(leftPrice, rightPrice) : compareBigInt(rightPrice, leftPrice);
        }
        return sort === "oldest"
          ? compareBigInt(BigInt(left.globalNumber), BigInt(right.globalNumber))
          : compareBigInt(BigInt(right.globalNumber), BigInt(left.globalNumber));
      });
  }, [listedArtifacts, listingByArtifact, priceBand, purpose, query, sort, subnet]);
  const filterCount = Number(subnet !== "all") + Number(purpose !== "all") + Number(priceBand !== "all") + Number(Boolean(query.trim()));

  function clearFilters() {
    setQuery("");
    setSubnet("all");
    setPurpose("all");
    setPriceBand("all");
  }

  return (
    <section className="market-browser" aria-label="Relic marketplace">
      <div className="market-toolbar">
        <label className="market-search">
          <span className="sr-only">Search Relics</span>
          <i aria-hidden="true">⌕</i>
          <input list="relic-search-suggestions" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, inscription, number, or subnet" />
          <datalist id="relic-search-suggestions">
            {listedArtifacts.map((artifact) => <option key={artifact.artifactId} value={artifact.name} />)}
          </datalist>
        </label>
        <Link href="/wallet#listing" className="market-list-button">List a Relic</Link>
      </div>
      <div className="market-content">
        <aside className="market-filters">
          <div>
            <span>Inventory</span>
            <div className="market-active-filter"><strong>Active listings</strong><small>{listings.length}</small></div>
            <Link href="/explore">Explore all Relics</Link>
          </div>
          <div className="market-filter-control">
            <label htmlFor="market-subnet">Subnet</label>
            <select id="market-subnet" value={subnet} onChange={(event) => setSubnet(event.target.value)}>
              <option value="all">All subnets</option>
              {subnetOptions.map((netuid) => <option key={netuid} value={netuid}>SN{netuid}</option>)}
            </select>
          </div>
          <div className="market-filter-control">
            <label htmlFor="market-purpose">Relic type</label>
            <select id="market-purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)}>
              <option value="all">All types</option>
              {purposeOptions.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
            </select>
          </div>
          <div className="market-filter-control">
            <label htmlFor="market-price">Asking price</label>
            <select id="market-price" value={priceBand} onChange={(event) => setPriceBand(event.target.value as PriceBand)}>
              <option value="all">Any price</option>
              <option value="under-10">Under 10 TAO</option>
              <option value="10-50">10–50 TAO</option>
              <option value="50-plus">Over 50 TAO</option>
            </select>
          </div>
          <div className="market-filter-actions">
            <span>{filterCount ? `${filterCount} active filter${filterCount === 1 ? "" : "s"}` : "No filters applied"}</span>
            <button type="button" onClick={clearFilters} disabled={!filterCount}>Clear filters</button>
          </div>
          <div className="market-filter-proof"><span>Proof standard</span><strong>Finalized only</strong><p>On-chain image · burn receipt · current owner</p></div>
        </aside>
        <div className="market-results">
          <header>
            <div><strong>{visible.length} items</strong><span>Finalized collection</span></div>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortOrder)} aria-label="Sort marketplace items">
              <option value="newest">Recently forged</option>
              <option value="oldest">Oldest first</option>
              <option value="burn-high">Alpha burn: high to low</option>
              <option value="burn-low">Alpha burn: low to high</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
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
                      <span>#{artifact.globalNumber}</span>
                      <i>{listing ? "Listed" : "Finalized"}</i>
                    </Link>
                    <div className="market-card-body">
                      <span>SN{artifact.netuid} · Subnet Relic #{artifact.subnetNumber} · {artifact.purpose.replaceAll("_", " ")}</span>
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
            <div className="market-no-results"><span>{listings.length ? "No matches" : "No active listings"}</span><h2>{listings.length ? "No listed Relics match these filters." : "List the first Relic."}</h2>{listings.length ? <button type="button" onClick={clearFilters}>Clear filters</button> : <Link href="/wallet#listing">List a Relic</Link>}</div>
          )}
        </div>
      </div>
    </section>
  );
}
