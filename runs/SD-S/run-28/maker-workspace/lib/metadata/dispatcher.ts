import dns from "node:dns";
import { Agent } from "undici";
import { isPublicAddress } from "@/lib/security/ip";

export function createSafeDispatcher(): Agent {
  return new Agent({
    connect: {
      lookup(hostname, options, callback) {
        dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
          if (error) { callback(error, "", 0); return; }
          if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address))) {
            callback(new Error("UNSAFE_DESTINATION"), "", 0); return;
          }
          const first = addresses[0];
          if ((options as { all?: boolean }).all) {
            (callback as unknown as (error: null, result: typeof addresses) => void)(null, addresses);
          } else callback(null, first.address, first.family);
        });
      },
    },
    headersTimeout: 3500,
    bodyTimeout: 3500,
  });
}
