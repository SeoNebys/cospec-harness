import ipaddr from "ipaddr.js";

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type IpClassification =
  | "public"
  | "invalid"
  | "unspecified"
  | "loopback"
  | "private"
  | "carrier-grade-nat"
  | "link-local"
  | "multicast"
  | "reserved";

function normalizedInput(address: string): string {
  const withoutBrackets =
    address.startsWith("[") && address.endsWith("]") ? address.slice(1, -1) : address;
  return withoutBrackets;
}

export function classifyIpAddress(address: string): IpClassification {
  const input = normalizedInput(address);
  if (input.includes("%") || !ipaddr.isValid(input)) return "invalid";

  const parsed = ipaddr.parse(input);
  if (parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()) {
    return classifyIpAddress(parsed.toIPv4Address().toString());
  }

  switch (parsed.range()) {
    case "unicast":
      return "public";
    case "unspecified":
      return "unspecified";
    case "loopback":
      return "loopback";
    case "private":
    case "uniqueLocal":
      return "private";
    case "carrierGradeNat":
      return "carrier-grade-nat";
    case "linkLocal":
      return "link-local";
    case "multicast":
      return "multicast";
    default:
      return "reserved";
  }
}

export function isPublicIpAddress(address: string): boolean {
  return classifyIpAddress(address) === "public";
}

export function validatePublicAddresses(
  addresses: readonly ResolvedAddress[],
): readonly ResolvedAddress[] {
  if (addresses.length === 0) {
    throw new Error("Destination did not resolve to an address");
  }

  for (const answer of addresses) {
    const parsed = normalizedInput(answer.address);
    if (!ipaddr.isValid(parsed)) {
      throw new Error("Destination resolved to an invalid address");
    }
    const expectedFamily = ipaddr.parse(parsed).kind() === "ipv4" ? 4 : 6;
    if (answer.family !== expectedFamily || !isPublicIpAddress(parsed)) {
      throw new Error("Destination resolved to a non-public address");
    }
  }

  return addresses;
}
