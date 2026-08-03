import Link from "next/link";
import Image from "next/image";
import type { Artifact } from "@/lib/indexer-db";
import { compactHex, formatRao } from "@/lib/format";

export function RelicCard({ artifact }: { artifact: Artifact }) {
  return (
    <article className="artifact-card">
      <div className="artifact-card-top">
        <span>Relic #{artifact.globalNumber}</span>
        <span>SN{artifact.netuid} / #{artifact.subnetNumber}</span>
      </div>
      {artifact.mediaByteLength ? <div className="artifact-media"><Image src={`/api/v1/artifacts/${encodeURIComponent(artifact.artifactId)}/media`} alt={artifact.name} width={320} height={320} unoptimized /></div> : <div className="artifact-mini-orbit" aria-hidden="true"><i /></div>}
      <h2>{artifact.name}</h2>
      <p>{artifact.body ?? `${artifact.mediaType} · ${compactHex(artifact.contentHash ?? "unverified")}`}</p>
      <dl>
        <div><dt>Alpha burned</dt><dd>{formatRao(artifact.alphaBurnedRao)}</dd></div>
        <div><dt>TAO spent</dt><dd>{formatRao(artifact.taoSpentRao)}</dd></div>
      </dl>
      <Link href={`/relic/${artifact.globalNumber}`}>Open finalized proof <span aria-hidden="true">-&gt;</span></Link>
    </article>
  );
}
