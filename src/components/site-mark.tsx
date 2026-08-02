import Link from "next/link";

export function SiteMark({ className = "" }: { className?: string }) {
  return (
    <Link className={`brand ${className}`.trim()} href="/" aria-label="Neural Relics home">
      <span className="brand-sigil" aria-hidden="true"><i /></span>
      <span>Neural Relics</span>
    </Link>
  );
}
