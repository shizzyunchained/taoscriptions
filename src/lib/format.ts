const UNITS = 1_000_000_000n;

export function formatRao(value: string, maximumFractionDigits = 6) {
  const raw = BigInt(value);
  const whole = raw / UNITS;
  const fraction = (raw % UNITS)
    .toString()
    .padStart(9, "0")
    .slice(0, maximumFractionDigits)
    .replace(/0+$/, "");
  return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ""}`;
}

export function compactHex(value: string, leading = 10, trailing = 8) {
  return value.length <= leading + trailing + 3
    ? value
    : `${value.slice(0, leading)}...${value.slice(-trailing)}`;
}
