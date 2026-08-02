type CodecValue = { toHex?: () => string; toString: () => string };
type EventRecord = { event: { data: Iterable<CodecValue>; method: string; section: string } };

function data(record: EventRecord) { return Array.from(record.event.data); }
function isEvent(record: EventRecord, section: string, method: string) {
  return record.event.section === section && record.event.method === method;
}
function hex(value: CodecValue, label: string) {
  const encoded = value.toHex?.().toLowerCase();
  if (!encoded) throw new Error(`${label}_IS_NOT_HEX`);
  return encoded;
}

export function verifyFinalizedTransferReceipt(input: {
  eventRecords: readonly EventRecord[];
  signerAccountHex: string;
  payloadHash: string;
}) {
  const signer = input.signerAccountHex.toLowerCase();
  const payloadHash = input.payloadHash.toLowerCase();
  if (!input.eventRecords.some((record) => isEvent(record, "system", "ExtrinsicSuccess"))) {
    throw new Error("TRANSFER_EXTRINSIC_FAILED");
  }
  const remarked = input.eventRecords.find((record) => isEvent(record, "system", "Remarked"));
  if (!remarked) throw new Error("MISSING_REMARK_EVENT");
  const [remarkSigner, remarkHash] = data(remarked);
  if (hex(remarkSigner, "REMARK_SIGNER") !== signer || hex(remarkHash, "REMARK_HASH") !== payloadHash) {
    throw new Error("REMARK_EVENT_MISMATCH");
  }
  const feePaid = input.eventRecords.find((record) => isEvent(record, "transactionPayment", "TransactionFeePaid"));
  if (!feePaid) throw new Error("MISSING_TRANSACTION_FEE_EVENT");
  const [feeSigner, actualFee, tip] = data(feePaid);
  const transactionFeeRao = BigInt(actualFee.toString());
  const transactionTipRao = BigInt(tip.toString());
  if (hex(feeSigner, "TRANSACTION_FEE_SIGNER") !== signer || transactionFeeRao <= 0n || transactionTipRao > transactionFeeRao) {
    throw new Error("TRANSACTION_FEE_EVENT_MISMATCH");
  }
  return { transactionFeeRao, transactionTipRao };
}
