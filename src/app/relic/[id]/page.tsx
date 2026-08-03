import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteMark } from "@/components/site-mark";
import { SiteNav } from "@/components/site-nav";
import { RelicListings } from "@/components/relic-listings";
import { BuyerCheckout } from "@/components/buyer-checkout";
import { compactHex, formatRao } from "@/lib/format";
import { readTestnetSubnets } from "@/lib/chain-reader";
import {
  getArtifact,
  getArtifactByGlobalNumber,
  IndexerUnavailableError,
  listActiveListings,
  listArtifactTransfers,
} from "@/lib/indexer-db";
import { buildSubnetNameMap, getSubnetName } from "@/lib/subnet-display";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: /^\d+$/.test(id)
      ? `Relic #${id} — Bittensor Relics`
      : `${compactHex(id, 18, 8)} — Bittensor Relics`,
  };
}

export default async function RelicPage({ params }: Props) {
  const { id: rawId } = await params;
  const id = rawId.includes("%") ? decodeURIComponent(rawId) : rawId;
  const isGlobalNumber = /^\d+$/.test(id);
  if (!isGlobalNumber && !/^br1:0x[0-9a-f]{64}:\d+:\d+$/.test(id)) notFound();

  let artifact: Awaited<ReturnType<typeof getArtifact>> = null;
  let transfers: Awaited<ReturnType<typeof listArtifactTransfers>> = [];
  let listings: Awaited<ReturnType<typeof listActiveListings>> = [];
  let subnetName = "";
  let unavailable = false;
  try {
    artifact = isGlobalNumber
      ? await getArtifactByGlobalNumber(id)
      : await getArtifact(id);
    if (artifact) {
      const [artifactTransfers, activeListings, chainSnapshot] = await Promise.all([
        listArtifactTransfers(artifact.artifactId),
        listActiveListings(artifact.artifactId, 20),
        readTestnetSubnets().catch(() => null),
      ]);
      transfers = artifactTransfers;
      listings = activeListings;
      subnetName = getSubnetName(
        buildSubnetNameMap(chainSnapshot?.subnets ?? []),
        artifact.netuid,
        artifact.subnetGeneration,
      );
    }
  } catch (error) {
    if (error instanceof IndexerUnavailableError) unavailable = true;
    else throw error;
  }
  if (!artifact && !unavailable) notFound();

  return (
    <main className="site-shell inner-site">
      <div className="grain" aria-hidden="true" />
      <SiteNav status="Finalized proof" tone="ready" />
      {unavailable ? (
        <section className="indexer-empty relic-unavailable">
          <span>Proof unavailable</span>
          <h1>The finalized indexer is offline.</h1>
          <p>This page will not render an unverified artifact from URL data alone.</p>
          <Link href="/explore">Return to collection</Link>
        </section>
      ) : artifact ? (
        <article className="relic-detail">
          <header>
            <div>
              <p className="eyebrow">Finalized Relic #{artifact.globalNumber}</p>
              <h1>{artifact.name}</h1>
              <p>SN{artifact.netuid} · Subnet Relic #{artifact.subnetNumber}</p>
            </div>
            {artifact.mediaByteLength ? (
              <div className="detail-media">
                <Image src={`/api/v1/artifacts/${encodeURIComponent(artifact.artifactId)}/media`} alt={artifact.name} width={320} height={320} unoptimized />
              </div>
            ) : (
              <div className="detail-orbit" aria-hidden="true"><i /></div>
            )}
          </header>
          <RelicListings
            initialListings={listings.map(({ listingId, sellerAccountHex, ownershipNonce, priceRao, expiryBlock, createdAt }) => ({ listingId, sellerAccountHex, ownershipNonce, priceRao, expiryBlock, createdAt }))}
            ownerAccountHex={artifact.ownerAccountHex}
            chainGenesis={artifact.artifactId.split(":")[1]}
          />
          {listings[0] && <BuyerCheckout
            artifactId={artifact.artifactId}
            artifactName={artifact.name}
            artifactNumber={artifact.globalNumber}
            chainGenesis={artifact.artifactId.split(":")[1]}
            listing={{
              listingId: listings[0].listingId,
              sellerAccountHex: listings[0].sellerAccountHex,
              ownershipNonce: listings[0].ownershipNonce,
              priceRao: listings[0].priceRao,
              expiryBlock: listings[0].expiryBlock,
            }}
          />}
          <section className="relic-content">
            <span>{artifact.mediaType}{artifact.mediaByteLength ? ` · ${artifact.mediaByteLength.toLocaleString()} bytes fully on-chain` : ""}</span>
            {artifact.body ? (
              <p>{artifact.body}</p>
            ) : artifact.mediaByteLength ? (
              <div><strong>No separate inscription text was finalized. The exact image bytes are stored in the finalized mint transaction.</strong><code>{artifact.contentHash}</code></div>
            ) : (
              <div><strong>External content is not rendered until its hash is verified.</strong><code>{artifact.contentUri}</code><code>{artifact.contentHash}</code></div>
            )}
          </section>
          <section className="proof-grid">
            <div><span>TAO spent</span><strong>{formatRao(artifact.taoSpentRao)} TAO</strong></div>
            <div className="subnet-burn-proof"><span>Subnet token burned</span><strong>{formatRao(artifact.alphaBurnedRao)} SN{artifact.netuid} BURNED</strong><small>{subnetName}</small></div>
            <div><span>Canonical subnet</span><strong>SN{artifact.netuid}:{artifact.subnetGeneration}</strong></div>
            <div><span>Limit price</span><strong>{formatRao(artifact.limitPriceRao)} TAO / alpha</strong></div>
            <div><span>Chain fee</span><strong>{artifact.transactionFeeRao ? `${formatRao(artifact.transactionFeeRao)} TAO` : "Legacy record"}</strong></div>
          </section>
          <section className="chain-proof">
            <h2>Chain proof</h2>
            <dl>
              <div><dt>Artifact ID</dt><dd>{artifact.artifactId}</dd></div>
              <div><dt>Block</dt><dd>#{artifact.blockNumber} · extrinsic {artifact.extrinsicIndex}</dd></div>
              <div><dt>Extrinsic hash</dt><dd>{artifact.extrinsicHash}</dd></div>
              <div><dt>Payload hash</dt><dd>{artifact.payloadHash}</dd></div>
              <div><dt>Creator</dt><dd>{artifact.creatorAccountHex}</dd></div>
              <div><dt>Protocol owner</dt><dd>{artifact.ownerAccountHex}</dd></div>
            </dl>
          </section>
          <section className="ownership-history">
            <div><h2>Ownership history</h2><span>{transfers.length} finalized transfer{transfers.length === 1 ? "" : "s"}</span></div>
            {transfers.length ? (
              <ol>{transfers.map((transfer) => <li key={transfer.transferId}><span>Nonce {transfer.ownershipNonce}</span><strong>{compactHex(transfer.fromAccountHex)} <i aria-hidden="true">-&gt;</i> {compactHex(transfer.toAccountHex)}</strong><small>Block #{transfer.blockNumber} · extrinsic {transfer.extrinsicIndex}{transfer.transactionFeeRao ? ` · fee ${formatRao(transfer.transactionFeeRao)} TAO` : ""}</small></li>)}</ol>
            ) : <p>The creator remains the current protocol owner.</p>}
          </section>
          <div className="detail-actions"><Link href="/marketplace">&lt;- Marketplace</Link><span>Ownership nonce {artifact.ownershipNonce}</span></div>
        </article>
      ) : null}
      <footer><SiteMark className="footer-brand" /><p>Burn evidence, not a contract promise.</p><Link href="/">Protocol home -&gt;</Link></footer>
    </main>
  );
}
