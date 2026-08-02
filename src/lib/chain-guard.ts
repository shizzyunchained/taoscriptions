const FULL_HASH = /^0x[0-9a-f]{64}$/;

export function assertExpectedGenesis(actual: string, expected: string) {
  const normalizedActual = actual.toLowerCase();
  const normalizedExpected = expected.toLowerCase();
  if (!FULL_HASH.test(normalizedExpected)) throw new Error("The configured chain genesis hash is invalid.");
  if (normalizedActual !== normalizedExpected) {
    throw new Error(`Wrong Bittensor network. Expected ${normalizedExpected}, received ${normalizedActual}.`);
  }
  return normalizedActual;
}
