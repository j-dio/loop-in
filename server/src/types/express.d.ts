export {};

declare global {
  namespace Express {
    interface User {
      id?: string;
      email?: string;
      name?: string | null;
    }

    interface Request {
      user?: User;

      workspace?: {
        id: string;
        ownerId: string;
        name: string;
        slug: string;
        primaryColor: string;
        visibility: "public" | "invite_only";
        requireApproval: boolean;
        createdAt: Date;
      };

      workspaceRole?: "owner" | "admin" | "member";
    }
  }
}

