import Image from "next/image";
import Link from "next/link";

export function SiteMark({ className = "" }: { className?: string }) {
  return (
    <Link className={`brand ${className}`.trim()} href="/" aria-label="Bittensor Relics home">
      <Image className="brand-logo" src="/brand-relic.webp" alt="" width={52} height={52} priority />
      <span>Bittensor Relics</span>
    </Link>
  );
}
