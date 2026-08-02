import Link from "next/link";

export function SiteMark({ className = "" }: { className?: string }) {
  return (
    <Link className={`brand ${className}`.trim()} href="/" aria-label="Bittensor Relics home">
      <span className="brand-sigil" aria-hidden="true"><i /></span>
      <span>Bittensor Relics</span>
    </Link>
  );
}
