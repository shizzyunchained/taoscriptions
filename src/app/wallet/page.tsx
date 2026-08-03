import type { Metadata } from "next";
import Link from "next/link";
import { SiteMark } from "@/components/site-mark";
import { SiteNav } from "@/components/site-nav";
import { WalletWorkspace } from "@/components/wallet-workspace";

export const metadata: Metadata = { title: "My Relics — Bittensor Relics", description: "Connect an SS58 wallet to inspect and transfer the Relics it owns." };

export default function WalletPage() {
  return <main className="site-shell inner-site"><div className="grain" aria-hidden="true" /><SiteNav status="Wallet ownership" tone="ready" /><section className="collection-hero wallet-hero"><p className="eyebrow">Wallet-owned collection</p><h1>Hold the proof.<br />Move the relic.</h1><p>Your connected SS58 account determines the collection. Canonical transfers are finalized Subtensor remarks signed directly by the current owner.</p></section><WalletWorkspace /><footer><SiteMark className="footer-brand" /><p>No account database. No recovery custody.</p><Link href="/explore">Public collection -&gt;</Link></footer></main>;
}
