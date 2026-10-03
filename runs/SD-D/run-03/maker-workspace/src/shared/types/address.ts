export const ADDRESS_ERROR_CODES = {
  required: "ADDRESS_REQUIRED",
  invalid: "ADDRESS_INVALID",
  unsupportedScheme: "ADDRESS_UNSUPPORTED_SCHEME",
} as const;

export type AddressValidationErrorCode =
  (typeof ADDRESS_ERROR_CODES)[keyof typeof ADDRESS_ERROR_CODES];

/** A field-specific failure safe to map to an API problem or inline form guidance. */
export class AddressValidationError extends Error {
  readonly field = "address" as const;

  constructor(
    readonly code: AddressValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AddressValidationError";
  }
}

export interface NormalizedAddress {
  /** The user's destination with surrounding whitespace removed. */
  address: string;
  /** The exact key used by the database uniqueness constraint. */
  normalizedAddress: string;
  /** The successfully parsed WHATWG URL. */
  url: URL;
}

const SCHEME_PATTERN = /^([A-Za-z][A-Za-z\d+.-]*):/u;
const EXPLICIT_AUTHORITY_PATTERN = /^([A-Za-z][A-Za-z\d+.-]*):\/\/([^/?#]*)(.*)$/su;

function containsAsciiControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function invalidAddress(
  message = "Enter a complete web address, such as https://example.com.",
): never {
  throw new AddressValidationError(ADDRESS_ERROR_CODES.invalid, message);
}

function rawPortFromAuthority(authority: string): string | undefined {
  const hostAndPort = authority.slice(authority.lastIndexOf("@") + 1);

  if (hostAndPort.startsWith("[")) {
    const closingBracket = hostAndPort.indexOf("]");
    if (closingBracket === -1) {
      return invalidAddress();
    }

    const remainder = hostAndPort.slice(closingBracket + 1);
    if (remainder === "") return undefined;
    if (!remainder.startsWith(":")) return invalidAddress();
    return remainder.slice(1);
  }

  const colon = hostAndPort.lastIndexOf(":");
  return colon === -1 ? undefined : hostAndPort.slice(colon + 1);
}

/**
 * Validates a bookmark destination with the WHATWG parser and derives the
 * deliberately narrow FR-005 identity. Path, query and fragment source text
 * stays distinct; only scheme/host case, default ports, and the root path are
 * normalized.
 */
export function normalizeAddress(input: string): NormalizedAddress {
  const address = input.trim();
  if (address === "") {
    throw new AddressValidationError(ADDRESS_ERROR_CODES.required, "Enter a web address to save.");
  }

  const schemeMatch = SCHEME_PATTERN.exec(address);
  if (schemeMatch && !/^https?$/iu.test(schemeMatch[1] ?? "")) {
    throw new AddressValidationError(
      ADDRESS_ERROR_CODES.unsupportedScheme,
      "Use an address beginning with http:// or https://.",
    );
  }

  const sourceMatch = EXPLICIT_AUTHORITY_PATTERN.exec(address);
  if (!sourceMatch || containsAsciiControl(address)) return invalidAddress();

  const [, rawScheme = "", rawAuthority = "", rawSuffix = ""] = sourceMatch;
  if (!/^https?$/iu.test(rawScheme) || rawAuthority === "") return invalidAddress();

  // For special URLs WHATWG treats backslashes as slashes. Reject that
  // surprising spelling outside query/fragment instead of silently changing
  // its destination or duplicate identity.
  const beforeQueryOrFragment = address.split(/[?#]/u, 1)[0] ?? address;
  if (beforeQueryOrFragment.includes("\\")) return invalidAddress();

  const rawPort = rawPortFromAuthority(rawAuthority);
  if (rawPort !== undefined && !/^\d+$/u.test(rawPort)) return invalidAddress();

  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return invalidAddress();
  }

  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.hostname === "") {
    return invalidAddress();
  }

  const at = rawAuthority.lastIndexOf("@");
  const credentials = at === -1 ? "" : rawAuthority.slice(0, at + 1);
  const port = url.port === "" ? "" : `:${url.port}`;
  const suffix = rawSuffix === "" ? "/" : /^[?#]/u.test(rawSuffix) ? `/${rawSuffix}` : rawSuffix;
  const normalizedAddress = `${url.protocol}//${credentials}${url.hostname.toLowerCase()}${port}${suffix}`;

  return { address, normalizedAddress, url };
}

export function addressesHaveSameIdentity(left: string, right: string): boolean {
  return normalizeAddress(left).normalizedAddress === normalizeAddress(right).normalizedAddress;
}
