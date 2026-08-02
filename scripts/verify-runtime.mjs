import { ApiPromise, WsProvider } from "@polkadot/api";

const networks = [
  {
    name: "mainnet",
    endpoint: "wss://entrypoint-finney.opentensor.ai:443",
  },
  {
    name: "testnet",
    endpoint: "wss://test.chain.opentensor.ai",
  },
];

function assertCapability(value, label) {
  if (!value) {
    throw new Error(`Missing required runtime capability: ${label}`);
  }
}

async function inspectNetwork({ name, endpoint }) {
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
      alphaBurnedEvent: Boolean(api.events.subtensorModule?.AlphaBurned),
      addStakeBurnEvent: Boolean(api.events.subtensorModule?.AddStakeBurn),
      remarkedEvent: Boolean(api.events.system?.Remarked),
      batchCompletedEvent: Boolean(api.events.utility?.BatchCompleted),
    };

    for (const [capability, available] of Object.entries(capabilities)) {
      assertCapability(available, `${name}.${capability}`);
    }

    return {
      name,
      endpoint,
      genesisHash: api.genesisHash.toHex(),
      specName: api.runtimeVersion.specName.toString(),
      specVersion: api.runtimeVersion.specVersion.toNumber(),
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
