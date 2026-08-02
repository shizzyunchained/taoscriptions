import Link from "next/link";
import { SiteMark } from "@/components/site-mark";
import { WalletWorkspace } from "@/components/wallet-workspace";

export default function WalletPage() {
  return <main className="site-shell inner-site"><div className="grain" aria-hidden="true" /><nav className="nav" aria-label="Main navigation"><SiteMark /><div className="nav-links"><Link href="/#forge">Forge</Link><Link href="/explore">Explore</Link><Link href="/marketplace">Market</Link><Link href="/wallet">My Relics</Link><span className="chain-status ready"><i aria-hidden="true" />Testnet ownership</span></div></nav><section className="collection-hero wallet-hero"><p className="eyebrow">Wallet-owned collection</p><h1>Hold the proof.<br />Move the relic.</h1><p>Your connected SS58 account determines the collection. Canonical transfers are finalized Subtensor remarks signed directly by the current owner.</p></section><WalletWorkspace /><footer><SiteMark className="footer-brand" /><p>No account database. No recovery custody.</p><Link href="/explore">Public collection -&gt;</Link></footer></main>;
}
