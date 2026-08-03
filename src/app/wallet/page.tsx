import type { Metadata } from "next";
import Link from "next/link";
import { SiteMark } from "@/components/site-mark";
import { SiteNav } from "@/components/site-nav";
import { WalletWorkspace } from "@/components/wallet-workspace";

export const metadata: Metadata = {
  title: "My Relics — Bittensor Relics",
  description:
    "Your finalized Bittensor Relics, inscriptions, burn receipts, and ownership controls.",
};

export default function WalletPage() {
  return (
    <main className="site-shell inner-site">
      <div className="grain" aria-hidden="true" />
      <SiteNav status="My Relics" tone="ready" />
      <section className="wallet-hero">
        <div>
          <p className="eyebrow">Wallet collection</p>
          <h1>My Relics</h1>
        </div>
        <p>
          View the finalized Relics held by your connected SS58 wallet. Select
          an item only when you want its proof, listing, or transfer controls.
        </p>
      </section>
      <WalletWorkspace />
      <footer>
        <SiteMark className="footer-brand" />
        <p>No account database. No recovery custody.</p>
        <Link href="/explore">Public collection -&gt;</Link>
      </footer>
    </main>
  );
}
