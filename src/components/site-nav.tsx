"use client";

import Link from "next/link";
import { useState } from "react";
import { SiteMark } from "@/components/site-mark";

const links = [
  ["Forge", "/#forge"],
  ["Marketplace", "/marketplace"],
  ["Explore", "/explore"],
  ["My Relics", "/wallet"],
  ["Network", "/network"],
  ["Blackpaper", "/blackpaper"],
  ["Docs", "/docs"],
] as const;

export function SiteNav(_props: { status: string; tone?: string }) {
  const [open, setOpen] = useState(false);
  const networkStatus = "Bittensor Testnet · v440";

  return (
    <nav className={`nav site-nav ${open ? "menu-open" : ""}`} aria-label="Main navigation">
      <SiteMark />
      <div className="nav-desktop">
        <div className="nav-links">
          {links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </div>
        <span className="chain-status ready"><i aria-hidden="true" />{networkStatus}</span>
      </div>
      <button className="nav-toggle" type="button" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen((value) => !value)}>
        <span>{open ? "Close" : "Menu"}</span><i aria-hidden="true" />
      </button>
      <div className="nav-mobile" id="mobile-navigation">
        {links.map(([label, href], index) => <Link key={href} href={href} onClick={() => setOpen(false)}><span>{String(index + 1).padStart(2, "0")}</span>{label}</Link>)}
        <div><span className="chain-status ready"><i aria-hidden="true" />{networkStatus}</span></div>
      </div>
    </nav>
  );
}
