import { test, expect, vi, beforeEach } from "vitest";

const { mockGet, mockSet, mockDelete, mockJwtVerify, mockSign, MockSignJWT } = vi.hoisted(() => {
  const mockSign = vi.fn().mockResolvedValue("signed-token");
  const MockSignJWT = vi.fn(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    sign: mockSign,
  }));
  return {
    mockGet: vi.fn(),
    mockSet: vi.fn(),
    mockDelete: vi.fn(),
    mockJwtVerify: vi.fn(),
    mockSign,
    MockSignJWT,
  };
});

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: mockGet, set: mockSet, delete: mockDelete })),
}));

vi.mock("jose", () => ({
  jwtVerify: mockJwtVerify,
  SignJWT: MockSignJWT,
}));

import { getSession, createSession, deleteSession, verifySession } from "@/lib/auth";
import type { NextRequest } from "next/server";

function makeRequest(cookieValue: string | undefined): NextRequest {
  return {
    cookies: { get: vi.fn().mockReturnValue(cookieValue !== undefined ? { value: cookieValue } : undefined) },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Re-apply default resolved value after clearAllMocks resets it
  mockSign.mockResolvedValue("signed-token");
  MockSignJWT.mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    sign: mockSign,
  }));
});

// --- getSession ---

test("getSession: returns null when no cookie", async () => {
  mockGet.mockReturnValue(undefined);
  expect(await getSession()).toBeNull();
});

test("getSession: returns null when jwtVerify throws", async () => {
  mockGet.mockReturnValue({ value: "bad-token" });
  mockJwtVerify.mockRejectedValue(new Error("invalid token"));
  expect(await getSession()).toBeNull();
});

test("getSession: returns session payload when token is valid", async () => {
  const expiresAt = new Date();
  const expectedPayload = { userId: "1", email: "a@b.com", expiresAt };
  mockGet.mockReturnValue({ value: "valid-token" });
  mockJwtVerify.mockResolvedValue({ payload: expectedPayload });
  expect(await getSession()).toEqual(expectedPayload);
});

test("getSession: calls jwtVerify with the token from the cookie", async () => {
  mockGet.mockReturnValue({ value: "my-token" });
  mockJwtVerify.mockResolvedValue({ payload: { userId: "1", email: "a@b.com", expiresAt: new Date() } });
  await getSession();
  expect(mockJwtVerify).toHaveBeenCalledWith("my-token", expect.anything());
});

test("getSession: returns null when cookie value is an empty string", async () => {
  mockGet.mockReturnValue({ value: "" });
  expect(await getSession()).toBeNull();
});

test("getSession: returns null when jwtVerify throws a non-Error value", async () => {
  mockGet.mockReturnValue({ value: "some-token" });
  mockJwtVerify.mockRejectedValue("string rejection");
  expect(await getSession()).toBeNull();
});

test("getSession: returns the full payload returned by jwtVerify", async () => {
  const payload = { userId: "99", email: "z@z.com", expiresAt: new Date(), extra: "field" };
  mockGet.mockReturnValue({ value: "valid-token" });
  mockJwtVerify.mockResolvedValue({ payload });
  expect(await getSession()).toEqual(payload);
});

// --- createSession ---

test("createSession: signs a JWT with the session payload", async () => {
  await createSession("42", "user@example.com");

  expect(MockSignJWT).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "42", email: "user@example.com" })
  );
  expect(mockSign).toHaveBeenCalled();
});

test("createSession: sets the auth-token cookie with the signed token", async () => {
  await createSession("42", "user@example.com");

  expect(mockSet).toHaveBeenCalledWith(
    "auth-token",
    "signed-token",
    expect.objectContaining({ httpOnly: true, path: "/" })
  );
});

test("createSession: cookie expiry is approximately 7 days from now", async () => {
  const before = Date.now();
  await createSession("42", "user@example.com");
  const after = Date.now();

  const { expires } = mockSet.mock.calls[0][2] as { expires: Date };
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

// --- deleteSession ---

test("deleteSession: deletes the auth-token cookie", async () => {
  await deleteSession();
  expect(mockDelete).toHaveBeenCalledWith("auth-token");
});

test("deleteSession: deletes the cookie exactly once", async () => {
  await deleteSession();
  expect(mockDelete).toHaveBeenCalledTimes(1);
});

// --- verifySession ---

test("verifySession: returns null when no cookie on request", async () => {
  const req = makeRequest(undefined);
  expect(await verifySession(req)).toBeNull();
});

test("verifySession: returns null when cookie value is an empty string", async () => {
  const req = makeRequest("");
  expect(await verifySession(req)).toBeNull();
});

test("verifySession: returns null when jwtVerify throws", async () => {
  const req = makeRequest("bad-token");
  mockJwtVerify.mockRejectedValue(new Error("invalid"));
  expect(await verifySession(req)).toBeNull();
});

test("verifySession: returns null when jwtVerify throws a non-Error value", async () => {
  const req = makeRequest("some-token");
  mockJwtVerify.mockRejectedValue("string rejection");
  expect(await verifySession(req)).toBeNull();
});

test("verifySession: returns session payload when token is valid", async () => {
  const payload = { userId: "7", email: "x@y.com", expiresAt: new Date() };
  const req = makeRequest("valid-token");
  mockJwtVerify.mockResolvedValue({ payload });
  expect(await verifySession(req)).toEqual(payload);
});

test("verifySession: calls jwtVerify with the token from the request cookie", async () => {
  const req = makeRequest("my-request-token");
  mockJwtVerify.mockResolvedValue({ payload: { userId: "1", email: "a@b.com", expiresAt: new Date() } });
  await verifySession(req);
  expect(mockJwtVerify).toHaveBeenCalledWith("my-request-token", expect.anything());
});

test("verifySession: does not call cookies() from next/headers", async () => {
  const { cookies } = await import("next/headers");
  const req = makeRequest("token");
  mockJwtVerify.mockResolvedValue({ payload: { userId: "1", email: "a@b.com", expiresAt: new Date() } });
  await verifySession(req);
  expect(cookies).not.toHaveBeenCalled();
});
