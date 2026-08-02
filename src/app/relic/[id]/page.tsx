import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteMark } from "@/components/site-mark";
import { compactHex, formatRao } from "@/lib/format";
import { getArtifact, IndexerUnavailableError } from "@/lib/indexer-db";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `${compactHex(id, 18, 8)} — Neural Relics` };
}

export default async function RelicPage({ params }: Props) {
  const { id } = await params;
  if (!/^nr1:0x[0-9a-f]{64}:\d+:\d+$/.test(id)) notFound();
  let artifact: Awaited<ReturnType<typeof getArtifact>> = null;
  let unavailable = false;
  try {
    artifact = await getArtifact(id);
  } catch (error) {
    if (error instanceof IndexerUnavailableError) unavailable = true;
    else throw error;
  }
  if (!artifact && !unavailable) notFound();

  return (
    <main className="site-shell inner-site">
      <div className="grain" aria-hidden="true" />
      <nav className="nav" aria-label="Main navigation"><SiteMark /><div className="nav-links"><Link href="/#forge">Forge</Link><Link href="/explore">Explore</Link></div></nav>
      {unavailable ? (
        <section className="indexer-empty relic-unavailable"><span>Proof unavailable</span><h1>The finalized indexer is offline.</h1><p>This page will not render an unverified artifact from URL data alone.</p><Link href="/explore">Return to collection</Link></section>
      ) : artifact ? (
        <article className="relic-detail">
          <header><div><p className="eyebrow">Finalized relic #{artifact.globalNumber}</p><h1>{artifact.name}</h1><p>SN{artifact.netuid} artifact #{artifact.subnetNumber}</p></div><div className="detail-orbit" aria-hidden="true"><i /></div></header>
          <section className="relic-content"><span>{artifact.mediaType}</span>{artifact.body ? <p>{artifact.body}</p> : <div><strong>External content is not rendered until its hash is verified.</strong><code>{artifact.contentUri}</code><code>{artifact.contentHash}</code></div>}</section>
          <section className="proof-grid">
            <div><span>TAO spent</span><strong>{formatRao(artifact.taoSpentRao)} TAO</strong></div>
            <div><span>Alpha burned</span><strong>{formatRao(artifact.alphaBurnedRao)}</strong></div>
            <div><span>Subnet identity</span><strong>SN{artifact.netuid}:{artifact.subnetGeneration}</strong></div>
            <div><span>Limit price</span><strong>{formatRao(artifact.limitPriceRao)} TAO / alpha</strong></div>
          </section>
          <section className="chain-proof"><h2>Chain proof</h2><dl><div><dt>Artifact ID</dt><dd>{artifact.artifactId}</dd></div><div><dt>Block</dt><dd>#{artifact.blockNumber} · extrinsic {artifact.extrinsicIndex}</dd></div><div><dt>Extrinsic hash</dt><dd>{artifact.extrinsicHash}</dd></div><div><dt>Payload hash</dt><dd>{artifact.payloadHash}</dd></div><div><dt>Creator</dt><dd>{artifact.creatorAccountHex}</dd></div><div><dt>Protocol owner</dt><dd>{artifact.ownerAccountHex}</dd></div></dl></section>
          <div className="detail-actions"><Link href="/explore">&lt;- All relics</Link><span>Ownership nonce {artifact.ownershipNonce}</span></div>
        </article>
      ) : null}
      <footer><SiteMark className="footer-brand" /><p>Burn evidence, not a contract promise.</p><Link href="/">Protocol home -&gt;</Link></footer>
    </main>
  );
}
