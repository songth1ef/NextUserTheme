import { describe, expect, it } from "vitest";
import { getUserIdFromRequest } from "@/lib/server/user-session";

const makeRequest = (headers: Record<string, string>): Request => {
  return new Request("http://localhost/api/test", { headers });
};

describe("getUserIdFromRequest", () => {
  it("优先从 cookie 取 userId", () => {
    const req = makeRequest({ cookie: "a=1; userId=alice; b=2" });
    expect(getUserIdFromRequest(req)).toBe("alice");
  });

  it("cookie 值做 URL 解码", () => {
    const req = makeRequest({ cookie: "userId=user%20one" });
    expect(getUserIdFromRequest(req)).toBe("user one");
  });

  it("无 cookie 时回退 Bearer token", () => {
    const req = makeRequest({ authorization: "Bearer bob" });
    expect(getUserIdFromRequest(req)).toBe("bob");
  });

  it("cookie 存在时优先于 Bearer", () => {
    const req = makeRequest({ cookie: "userId=alice", authorization: "Bearer bob" });
    expect(getUserIdFromRequest(req)).toBe("alice");
  });

  it("都没有时返回 demo-user", () => {
    expect(getUserIdFromRequest(makeRequest({}))).toBe("demo-user");
  });

  it("空白 userId 归一化为 demo-user", () => {
    const req = makeRequest({ cookie: "userId=%20%20" });
    expect(getUserIdFromRequest(req)).toBe("demo-user");
  });
});
