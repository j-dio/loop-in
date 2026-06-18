import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { requireParticipant } from "./workspace";

function mockRes(): Response {
  const res = {} as Record<string, unknown>;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as unknown as Response;
}

function partReq(over: Partial<{ user: unknown; workspace: unknown; workspaceRole: unknown }> = {}): Request {
  return {
    user: { id: "u1" },
    workspace: { id: "w1", slug: "acme", visibility: "public" },
    workspaceRole: undefined,
    ...over,
  } as unknown as Request;
}

describe("requireParticipant", () => {
  it("allows a signed-in non-member on a public board", () => {
    const req = partReq();
    const res = mockRes();
    const next = vi.fn();
    requireParticipant(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("401s when there is no signed-in user", () => {
    const req = partReq({ user: undefined });
    const res = mockRes();
    const next = vi.fn();
    requireParticipant(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("404s when the workspace is missing", () => {
    const req = partReq({ workspace: undefined });
    const res = mockRes();
    const next = vi.fn();
    requireParticipant(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it("403s a signed-in non-member on an invite_only board", () => {
    const req = partReq({ workspace: { id: "w1", slug: "acme", visibility: "invite_only" } });
    const res = mockRes();
    const next = vi.fn();
    requireParticipant(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows a member on an invite_only board", () => {
    const req = partReq({
      workspace: { id: "w1", slug: "acme", visibility: "invite_only" },
      workspaceRole: "member",
    });
    const res = mockRes();
    const next = vi.fn();
    requireParticipant(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
