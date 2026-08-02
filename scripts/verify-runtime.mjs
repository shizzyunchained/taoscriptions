import { ApiPromise, WsProvider } from "@polkadot/api";

const networks = [
  {
    name: "mainnet",
    endpoint: "wss://entrypoint-finney.opentensor.ai:443",
    expectedGenesis: "0x2f0555cc76fc2840a25a6ea3b9637146806f1f44b090c175ffde2a7e5ab36c03",
    expectedSpec: 440,
  },
  {
    name: "testnet",
    endpoint: "wss://test.chain.opentensor.ai",
    expectedGenesis: "0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105",
    expectedSpec: 440,
  },
];

function assertCapability(value, label) {
  if (!value) {
    throw new Error(`Missing required runtime capability: ${label}`);
  }
}

async function inspectNetwork({ name, endpoint, expectedGenesis, expectedSpec }) {
  const provider = new WsProvider(endpoint, 3_000);
  const api = await ApiPromise.create({ provider, noInitWarn: true });

  try {
    const capabilities = {
      addStakeBurn: Boolean(api.tx.subtensorModule?.addStakeBurn),
      burnAlpha: Boolean(api.tx.subtensorModule?.burnAlpha),
      batchAll: Boolean(api.tx.utility?.batchAll),
      remarkWithEvent: Boolean(api.tx.system?.remarkWithEvent),
      networkRegisteredAt: Boolean(
        api.query.subtensorModule?.networkRegisteredAt,
      ),
      subnetOwnerHotkey: Boolean(api.query.subtensorModule?.subnetOwnerHotkey),
      hotkeyOwner: Boolean(api.query.subtensorModule?.owner),
      subtokenEnabled: Boolean(api.query.subtensorModule?.subtokenEnabled),
      initialMinStake: Boolean(api.consts.subtensorModule?.initialMinStake),
      currentAlphaPrice: Boolean(api.call.swapRuntimeApi?.currentAlphaPrice),
      simSwapTaoForAlpha: Boolean(api.call.swapRuntimeApi?.simSwapTaoForAlpha),
      alphaBurnedEvent: Boolean(api.events.subtensorModule?.AlphaBurned),
      addStakeBurnEvent: Boolean(api.events.subtensorModule?.AddStakeBurn),
      remarkedEvent: Boolean(api.events.system?.Remarked),
      batchCompletedEvent: Boolean(api.events.utility?.BatchCompleted),
      transactionFeePaidEvent: Boolean(api.events.transactionPayment?.TransactionFeePaid),
    };

    for (const [capability, available] of Object.entries(capabilities)) {
      assertCapability(available, `${name}.${capability}`);
    }

    const genesisHash = api.genesisHash.toHex();
    const specVersion = api.runtimeVersion.specVersion.toNumber();
    if (genesisHash !== expectedGenesis) throw new Error(`${name}.GENESIS_HASH_MISMATCH:${genesisHash}`);
    if (specVersion !== expectedSpec) throw new Error(`${name}.UNSUPPORTED_RUNTIME_SPEC:${specVersion}`);

    return {
      name,
      endpoint,
      genesisHash,
      specName: api.runtimeVersion.specName.toString(),
      specVersion,
      capabilities,
    };
  } finally {
    await api.disconnect();
  }
}

const results = [];

for (const network of networks) {
  results.push(await inspectNetwork(network));
}

process.stdout.write(`${JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2)}\n`);
