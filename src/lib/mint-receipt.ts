type CodecValue = {
  toHex?: () => string;
  toString: () => string;
};

type EventRecord = {
  event: {
    data: Iterable<CodecValue>;
    method: string;
    section: string;
  };
};

export type MintReceiptExpectation = {
  signerAccountHex: string;
  routeHotkeyHex: string;
  netuid: number;
  taoAmountRao: bigint;
  remarkHash: string;
};

function codecHex(value: CodecValue, label: string) {
  const hex = value.toHex?.().toLowerCase();
  if (!hex) throw new Error(`${label}_IS_NOT_ACCOUNT_HEX`);
  return hex;
}

function eventData(record: EventRecord) {
  return Array.from(record.event.data);
}

function isEvent(record: EventRecord, section: string, method: string) {
  return record.event.section === section && record.event.method === method;
}

export function verifyFinalizedMintReceipt(input: {
  eventRecords: readonly EventRecord[];
  expected: MintReceiptExpectation;
}) {
  const { eventRecords, expected } = input;
  const signerHex = expected.signerAccountHex.toLowerCase();
  const hotkeyHex = expected.routeHotkeyHex.toLowerCase();
  const remarkHash = expected.remarkHash.toLowerCase();

  if (!eventRecords.some((record) => isEvent(record, "system", "ExtrinsicSuccess"))) {
    throw new Error("MINT_EXTRINSIC_FAILED");
  }
  if (!eventRecords.some((record) => isEvent(record, "utility", "BatchCompleted"))) {
    throw new Error("ATOMIC_BATCH_FAILED");
  }

  const feePaid = eventRecords.find((record) => isEvent(record, "transactionPayment", "TransactionFeePaid"));
  if (!feePaid) throw new Error("MISSING_TRANSACTION_FEE_EVENT");
  const [feeSigner, actualFee, tip] = eventData(feePaid);
  const transactionFeeRao = BigInt(actualFee.toString());
  const transactionTipRao = BigInt(tip.toString());
  if (
    codecHex(feeSigner, "TRANSACTION_FEE_SIGNER") !== signerHex
    || transactionFeeRao <= 0n
    || transactionTipRao > transactionFeeRao
  ) throw new Error("TRANSACTION_FEE_EVENT_MISMATCH");

  const stakeBurn = eventRecords.find((record) => isEvent(record, "subtensorModule", "AddStakeBurn"));
  if (!stakeBurn) throw new Error("MISSING_ADD_STAKE_BURN_EVENT");
  const [eventNetuid, eventHotkey, eventAmount, eventAlpha] = eventData(stakeBurn);
  const alphaBurnedRao = BigInt(eventAlpha.toString());
  if (
    Number(eventNetuid.toString()) !== expected.netuid
    || codecHex(eventHotkey, "ADD_STAKE_BURN_HOTKEY") !== hotkeyHex
    || BigInt(eventAmount.toString()) !== expected.taoAmountRao
    || alphaBurnedRao <= 0n
  ) {
    throw new Error("ADD_STAKE_BURN_EVENT_MISMATCH");
  }

  const alphaBurn = eventRecords.find((record) => isEvent(record, "subtensorModule", "AlphaBurned"));
  if (!alphaBurn) throw new Error("MISSING_ALPHA_BURNED_EVENT");
  const [eventSigner, burnedHotkey, burnedAlpha, burnedNetuid] = eventData(alphaBurn);
  if (
    codecHex(eventSigner, "ALPHA_BURNED_SIGNER") !== signerHex
    || codecHex(burnedHotkey, "ALPHA_BURNED_HOTKEY") !== hotkeyHex
    || BigInt(burnedAlpha.toString()) !== alphaBurnedRao
    || Number(burnedNetuid.toString()) !== expected.netuid
  ) {
    throw new Error("ALPHA_BURNED_EVENT_MISMATCH");
  }

  const remarked = eventRecords.find((record) => isEvent(record, "system", "Remarked"));
  if (!remarked) throw new Error("MISSING_REMARK_EVENT");
  const [remarkSigner, eventRemarkHash] = eventData(remarked);
  if (
    codecHex(remarkSigner, "REMARK_SIGNER") !== signerHex
    || codecHex(eventRemarkHash, "REMARK_HASH") !== remarkHash
  ) {
    throw new Error("REMARK_EVENT_MISMATCH");
  }

  return { alphaBurnedRao, transactionFeeRao, transactionTipRao };
}
