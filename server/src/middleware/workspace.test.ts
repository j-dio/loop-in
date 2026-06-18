import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("../modules/workspaces/workspaces.service", () => ({
  findWorkspaceBySlug: vi.fn(),
  getUserRoleInWorkspace: vi.fn(),
}));

import { findWorkspaceBySlug, getUserRoleInWorkspace } from "../modules/workspaces/workspaces.service";
import { requireParticipant, requireWorkspace } from "./workspace";

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

function wsReq(over: Partial<{ params: unknown; method: string; user: unknown }> = {}): Request {
  return {
    params: { slug: "acme" },
    method: "POST",
    user: { id: "u1" },
    ...over,
  } as unknown as Request;
}

describe("requireWorkspace (relaxed write gate)", () => {
  it("lets a signed-in non-member WRITE on a public board (the unlock)", async () => {
    vi.mocked(findWorkspaceBySlug).mockResolvedValue({ id: "w1", slug: "acme", visibility: "public" } as never);
    vi.mocked(getUserRoleInWorkspace).mockResolvedValue(null as never);
    const req = wsReq({ method: "POST", user: { id: "u1" } });
    const res = mockRes();
    const next = vi.fn();
    await requireWorkspace(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("still blocks a signed-in non-member on an invite_only board (403)", async () => {
    vi.mocked(findWorkspaceBySlug).mockResolvedValue({ id: "w1", slug: "acme", visibility: "invite_only" } as never);
    vi.mocked(getUserRoleInWorkspace).mockResolvedValue(null as never);
    const req = wsReq({ user: { id: "u1" } });
    const res = mockRes();
    const next = vi.fn();
    await requireWorkspace(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("blocks an unauthenticated user on an invite_only board (401)", async () => {
    vi.mocked(findWorkspaceBySlug).mockResolvedValue({ id: "w1", slug: "acme", visibility: "invite_only" } as never);
    const req = wsReq({ user: undefined });
    const res = mockRes();
    const next = vi.fn();
    await requireWorkspace(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("lets an unauthenticated user read a public board", async () => {
    vi.mocked(findWorkspaceBySlug).mockResolvedValue({ id: "w1", slug: "acme", visibility: "public" } as never);
    const req = wsReq({ method: "GET", user: undefined });
    const res = mockRes();
    const next = vi.fn();
    await requireWorkspace(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("lets an unauthenticated WRITE pass the gate (route-level auth enforces 401)", async () => {
    vi.mocked(findWorkspaceBySlug).mockResolvedValue({ id: "w1", slug: "acme", visibility: "public" } as never);
    const req = wsReq({ method: "POST", user: undefined });
    const res = mockRes();
    const next = vi.fn();
    await requireWorkspace(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("attaches the role when the user is a member", async () => {
    vi.mocked(findWorkspaceBySlug).mockResolvedValue({ id: "w1", slug: "acme", visibility: "public" } as never);
    vi.mocked(getUserRoleInWorkspace).mockResolvedValue("admin" as never);
    const req = wsReq({ user: { id: "u1" } });
    const res = mockRes();
    const next = vi.fn();
    await requireWorkspace(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect((req as unknown as { workspaceRole?: string }).workspaceRole).toBe("admin");
  });
});
