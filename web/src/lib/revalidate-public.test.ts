import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { PUBLIC_CACHE_PATHS, revalidatePublicSite } from "./revalidate-public";

describe("revalidatePublicSite", () => {
  it("revalidates all public cache paths", () => {
    revalidatePublicSite();
    expect(revalidatePath).toHaveBeenCalledTimes(PUBLIC_CACHE_PATHS.length);
    for (const path of PUBLIC_CACHE_PATHS) {
      expect(revalidatePath).toHaveBeenCalledWith(path);
    }
  });
});
