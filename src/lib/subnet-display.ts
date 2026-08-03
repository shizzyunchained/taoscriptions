export type SubnetNameMap = Record<string, string>;

type SubnetIdentity = {
  netuid: number;
  generation: string;
  name: string;
};

export function subnetIdentityKey(netuid: number, generation: string) {
  return `${netuid}:${generation}`;
}

export function buildSubnetNameMap(subnets: SubnetIdentity[]): SubnetNameMap {
  return Object.fromEntries(
    subnets.map((subnet) => [
      subnetIdentityKey(subnet.netuid, subnet.generation),
      subnet.name,
    ]),
  );
}

export function getSubnetName(
  subnetNames: SubnetNameMap,
  netuid: number,
  generation: string,
) {
  return subnetNames[subnetIdentityKey(netuid, generation)] ?? `Subnet ${netuid}`;
}
