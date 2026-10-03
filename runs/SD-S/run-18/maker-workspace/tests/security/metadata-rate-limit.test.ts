import { beforeEach, describe, expect, it } from "vitest";
import { reserveMetadataPreview, resetMetadataLimitsForTests } from "~/services/metadata/metadata-rate-limit.server";

describe("metadata limits", () => {
  beforeEach(resetMetadataLimitsForTests);
  it("bounds concurrent work per user and releases reservations", () => {
    const first = reserveMetadataPreview("alice", "example.com", 1);
    const second = reserveMetadataPreview("alice", "other.com", 1);
    expect(first).toBeTypeOf("function");
    expect(second).toBeTypeOf("function");
    expect(reserveMetadataPreview("alice", "third.com", 1)).toBeNull();
    first?.();
    expect(reserveMetadataPreview("alice", "third.com", 1)).toBeTypeOf("function");
  });
});
