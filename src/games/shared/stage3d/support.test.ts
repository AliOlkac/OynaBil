import { describe, expect, it } from "vitest";
import { createFrameWatch } from "./support";

/** `count` kareyi verilen süreyle besler; ilk dönen kararı verir. */
function feed(watch: ReturnType<typeof createFrameWatch>, ms: number, count: number) {
  for (let i = 0; i < count; i++) {
    const verdict = watch.sample(ms);
    if (verdict) return verdict;
  }
  return null;
}

describe("kare süresi izleyici", () => {
  it("akıcı sahnede kademeye dokunmaz", () => {
    const watch = createFrameWatch("yuksek");
    expect(feed(watch, 16.7, 2000)).toBeNull();
    expect(watch.tier).toBe("yuksek");
  });

  it("yavaş sahnede bir alt kademeye iner, tek bir yavaş ölçümle inmez", () => {
    const watch = createFrameWatch("yuksek");
    expect(feed(watch, 45, 90)).toBeNull();
    expect(feed(watch, 45, 90)).toBe("in");
    expect(watch.tier).toBe("orta");
    expect(feed(watch, 45, 180)).toBe("in");
    expect(watch.tier).toBe("dusuk");
  });

  it("araya akıcı bir ölçüm girerse sayaç sıfırlanır", () => {
    const watch = createFrameWatch("orta");
    expect(feed(watch, 45, 90)).toBeNull();
    expect(feed(watch, 16, 90)).toBeNull();
    expect(feed(watch, 45, 90)).toBeNull();
    expect(watch.tier).toBe("orta");
  });

  it("en düşük kademede çok yavaşsa vazgeçer, biraz yavaşsa sürdürür", () => {
    const slow = createFrameWatch("dusuk");
    expect(feed(slow, 45, 600)).toBeNull();
    const hopeless = createFrameWatch("dusuk");
    expect(feed(hopeless, 90, 180)).toBe("vazgec");
  });

  it("sekme arka plandayken gelen dev kareleri saymaz", () => {
    const watch = createFrameWatch("yuksek");
    expect(feed(watch, 5000, 500)).toBeNull();
    expect(watch.tier).toBe("yuksek");
  });
});
