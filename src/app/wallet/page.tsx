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
      <section className="collection-hero wallet-hero">
        <p className="eyebrow">Your finalized collection</p>
        <h1>Your Relics.</h1>
        <p>
          Every image, inscription, burn receipt, and chain position owned by
          your connected wallet—shown together as a collection, with ownership
          tools kept secondary.
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
