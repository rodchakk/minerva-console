import dns from "node:dns/promises";
import net from "node:net";

export type ResolvedAddress = {
  address: string;
};

export type ResolveHost = (hostname: string) => Promise<ResolvedAddress[]>;

export type ConnectionSafetyResult =
  | {
      ok: true;
      url: URL;
    }
  | {
      detail: string;
      ok: false;
      title: string;
    };

const IPV4_MAPPED_IPV6_PREFIX = "::ffff:";

function isPrivateIpv4(first: number, second: number) {
  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19))
  );
}

function isReservedIpv4(first: number, second: number, third: number) {
  return (
    first >= 224 ||
    (first === 192 && second === 0 && third === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113)
  );
}

function isPublicIpv4(address: string) {
  const parts = address.split(".").map((part) => Number.parseInt(part, 10));

  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [first, second, third] = parts;

  return !isPrivateIpv4(first, second) && !isReservedIpv4(first, second, third);
}

function expandIpv6(address: string) {
  const [head = "", tail = ""] = address.toLowerCase().split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missingGroups = 8 - headParts.length - tailParts.length;

  if (missingGroups < 0) {
    return null;
  }

  const groups = [
    ...headParts,
    ...Array.from({ length: missingGroups }, () => "0"),
    ...tailParts,
  ];

  if (
    groups.length !== 8 ||
    groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))
  ) {
    return null;
  }

  return groups.map((group) => Number.parseInt(group, 16));
}

function isPublicIpv6(address: string) {
  const normalized = address.toLowerCase();

  if (normalized.startsWith(IPV4_MAPPED_IPV6_PREFIX)) {
    return isPublicIpv4(normalized.slice(IPV4_MAPPED_IPV6_PREFIX.length));
  }

  const groups = expandIpv6(normalized);

  if (!groups) {
    return false;
  }

  const [first, second] = groups;
  const isUnspecified = groups.every((group) => group === 0);
  const isLoopback = groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1;

  return !(
    isUnspecified ||
    isLoopback ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00 ||
    (first === 0x2001 && second === 0x0db8)
  );
}

export function isPublicIpAddress(address: string) {
  const normalizedAddress = address.replace(/^\[|\]$/g, "");
  const family = net.isIP(normalizedAddress);

  if (family === 4) {
    return isPublicIpv4(normalizedAddress);
  }

  if (family === 6) {
    return isPublicIpv6(normalizedAddress);
  }

  return false;
}

function isLocalHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host.endsWith(".localhost");
}

async function defaultResolveHost(hostname: string) {
  return dns.lookup(hostname, { all: true, verbatim: true });
}

export async function validateOutboundHttpUrl(
  value: string,
  {
    fieldLabel,
    productionRequiresHttps = false,
    resolveHost = defaultResolveHost,
  }: {
    fieldLabel: string;
    productionRequiresHttps?: boolean;
    resolveHost?: ResolveHost;
  },
): Promise<ConnectionSafetyResult> {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return {
      detail: `Enter a valid http or https ${fieldLabel}.`,
      ok: false,
      title: `${fieldLabel} needs attention`,
    };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return {
      detail: `Enter a valid http or https ${fieldLabel}.`,
      ok: false,
      title: `${fieldLabel} needs attention`,
    };
  }

  if (productionRequiresHttps && url.protocol !== "https:") {
    return {
      detail: `Production Overview API endpoints must use https.`,
      ok: false,
      title: `${fieldLabel} must use https`,
    };
  }

  if (url.username || url.password) {
    return {
      detail: `${fieldLabel} must not include username or password credentials.`,
      ok: false,
      title: `${fieldLabel} contains credentials`,
    };
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  if (!hostname || isLocalHostname(hostname)) {
    return {
      detail: `${fieldLabel} must use a public hostname or IP address.`,
      ok: false,
      title: `${fieldLabel} host is not allowed`,
    };
  }

  const literalFamily = net.isIP(hostname);

  if (literalFamily) {
    if (!isPublicIpAddress(hostname)) {
      return {
        detail: `${fieldLabel} resolves to a non-public network address.`,
        ok: false,
        title: `${fieldLabel} host is not allowed`,
      };
    }

    return { ok: true, url };
  }

  let addresses: ResolvedAddress[];

  try {
    addresses = await resolveHost(hostname);
  } catch {
    return {
      detail: `${fieldLabel} hostname could not be resolved safely.`,
      ok: false,
      title: `${fieldLabel} DNS resolution failed`,
    };
  }

  if (
    addresses.length === 0 ||
    addresses.some((address) => !isPublicIpAddress(address.address))
  ) {
    return {
      detail: `${fieldLabel} resolves to a non-public network address.`,
      ok: false,
      title: `${fieldLabel} host is not allowed`,
    };
  }

  return { ok: true, url };
}
