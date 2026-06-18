import "../config/env";
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import {
  appLinks,
  appScreenshots,
  comments,
  follows,
  postUpdates,
  posts,
  upvotes,
  users,
  workspaceMembers,
  workspaces,
} from "./schema";

/**
 * Idempotent demo seed — gives a fresh deploy (or a reviewer's local DB) a couple of *public*
 * workspaces full of realistic feedback so the boards and the /explore page don't look broken.
 *
 * Run:  npm run seed
 * In production it refuses to run unless SEED_CONFIRM=1 is set (so it can never be triggered by
 * accident). It skips any workspace whose slug already exists, so re-running is safe.
 */

type Category = "bug" | "feature_request" | "ui_tweak";
type Moderation = "pending" | "approved" | "spam" | "rejected";
type Board = "inbox" | "under_review" | "planned" | "in_progress" | "shipped";

type SeedComment = { author: string; content: string; official?: boolean };
type SeedPost = {
  title: string;
  description: string;
  category: Category;
  moderation: Moderation;
  board: Board;
  anonymous?: boolean;
  upvotes: number;
  comments?: SeedComment[];
  update?: string;
};
type SeedWorkspace = {
  name: string;
  slug: string;
  ownerKey: string;
  tagline?: string;
  description?: string;
  platform?: "web" | "mobile" | "desktop" | "other";
  category?: string;
  websiteUrl?: string;
  screenshots?: string[];
  links?: { kind: "github" | "appstore" | "playstore" | "x" | "other"; url: string }[];
  followerKeys?: string[];
  posts: SeedPost[];
};

// Demo accounts (provider "seed" so they never collide with real OAuth users).
const SEED_USERS: { key: string; name: string; email: string }[] = [
  { key: "maya", name: "Maya Chen", email: "maya@loopin-demo.dev" },
  { key: "devon", name: "Devon Park", email: "devon@loopin-demo.dev" },
  { key: "priya", name: "Priya Nair", email: "priya@loopin-demo.dev" },
  { key: "sam", name: "Sam Rivera", email: "sam@loopin-demo.dev" },
  { key: "lena", name: "Lena Ortiz", email: "lena@loopin-demo.dev" },
  { key: "theo", name: "Theo Walsh", email: "theo@loopin-demo.dev" },
];

const WORKSPACES: SeedWorkspace[] = [
  {
    name: "Loop In",
    slug: "demo",
    ownerKey: "maya",
    tagline: "The organized feedback layer for builders.",
    description:
      "Loop In turns scattered feedback into a public board with upvotes, triage, a Kanban roadmap, and official updates. Built for indie devs and small teams.",
    platform: "web",
    category: "Developer tools",
    websiteUrl: "https://example.com/loopin",
    screenshots: [
      "https://placehold.co/1200x750/0f172a/ffffff/png?text=Loop+In+Board",
      "https://placehold.co/1200x750/1e293b/ffffff/png?text=Kanban+Roadmap",
    ],
    links: [
      { kind: "github", url: "https://github.com/example/loopin" },
      { kind: "x", url: "https://x.com/example" },
    ],
    followerKeys: ["devon", "priya", "sam", "lena"],
    posts: [
      {
        title: "Dark mode for the dashboard",
        description:
          "Working late and the bright board is rough on the eyes. A proper dark theme would be a huge quality-of-life win.",
        category: "feature_request",
        moderation: "approved",
        board: "shipped",
        upvotes: 5,
        comments: [
          { author: "devon", content: "+1, my eyes thank you in advance." },
          { author: "maya", content: "Shipped in this week's release — toggle is in the top bar!", official: true },
        ],
        update: "Dark mode is live 🎉 Toggle it from the top bar or it follows your system setting.",
      },
      {
        title: "Email digest of new feedback",
        description:
          "As an admin I'd love a weekly summary email of top posts so I don't have to check the board daily.",
        category: "feature_request",
        moderation: "approved",
        board: "in_progress",
        upvotes: 4,
        comments: [{ author: "priya", content: "Weekly would be perfect. Maybe configurable cadence?" }],
        update: "In progress — first version will be a weekly Monday digest, cadence options to follow.",
      },
      {
        title: "Search returns deleted posts sometimes",
        description:
          "Occasionally a post I removed still shows up in search results for a few seconds. Looks like a caching issue.",
        category: "bug",
        moderation: "approved",
        board: "under_review",
        upvotes: 3,
        comments: [{ author: "sam", content: "Saw this too — refreshing fixes it." }],
      },
      {
        title: "Keyboard shortcuts for triage",
        description: "Power-user request: j/k to move between posts and a/r to approve/reject in the inbox.",
        category: "feature_request",
        moderation: "approved",
        board: "planned",
        upvotes: 6,
        comments: [],
      },
      {
        title: "Upvote button hit area is too small on mobile",
        description: "On my phone I keep missing the upvote arrow. The tap target could be bigger.",
        category: "ui_tweak",
        moderation: "approved",
        board: "inbox",
        anonymous: true,
        upvotes: 2,
      },
      {
        title: "Add a public roadmap view",
        description: "Let visitors see what's planned vs shipped without signing in.",
        category: "feature_request",
        moderation: "approved",
        board: "under_review",
        upvotes: 4,
        comments: [{ author: "theo", content: "This would help us share progress with customers." }],
      },
      {
        title: "BUY CHEAP FOLLOWERS NOW!!!",
        description: "spam spam spam http://totally-not-spam.example",
        category: "feature_request",
        moderation: "spam",
        board: "inbox",
        upvotes: 0,
      },
      {
        title: "Integrate with Slack",
        description: "Post new feedback to a Slack channel so the team sees it in real time.",
        category: "feature_request",
        moderation: "pending",
        board: "inbox",
        upvotes: 0,
      },
    ],
  },
  {
    name: "Orbit Notes",
    slug: "orbit-notes",
    ownerKey: "devon",
    tagline: "Notes that sync everywhere, even offline.",
    description:
      "Orbit Notes is a fast markdown notebook with offline editing, folder colors, and PDF export. Take notes anywhere; sync when you reconnect.",
    platform: "mobile",
    category: "Productivity",
    websiteUrl: "https://example.com/orbit",
    screenshots: ["https://placehold.co/1200x750/3730a3/ffffff/png?text=Orbit+Notes"],
    links: [{ kind: "playstore", url: "https://play.google.com/store/apps/details?id=com.example.orbit" }],
    followerKeys: ["maya", "priya", "theo"],
    posts: [
      {
        title: "Offline editing support",
        description: "I take notes on flights — please let me edit offline and sync when I reconnect.",
        category: "feature_request",
        moderation: "approved",
        board: "planned",
        upvotes: 5,
        comments: [{ author: "lena", content: "Yes! Sync conflicts handled gracefully would be key." }],
      },
      {
        title: "Markdown tables render with no borders",
        description: "Tables in preview mode are missing cell borders, making them hard to read.",
        category: "bug",
        moderation: "approved",
        board: "in_progress",
        upvotes: 3,
        update: "Fix is in review — borders return in the next patch.",
      },
      {
        title: "Folder colors",
        description: "Let me color-code folders so I can scan my sidebar faster.",
        category: "ui_tweak",
        moderation: "approved",
        board: "inbox",
        upvotes: 2,
      },
      {
        title: "Export a note to PDF",
        description: "Need to share polished notes with clients who don't use Orbit.",
        category: "feature_request",
        moderation: "approved",
        board: "shipped",
        upvotes: 4,
        update: "PDF export shipped — find it under the ••• menu on any note.",
      },
      {
        title: "App crashes when pasting large images",
        description: "Pasting a screenshot over ~10MB freezes the editor and then crashes.",
        category: "bug",
        moderation: "pending",
        board: "inbox",
        upvotes: 0,
      },
    ],
  },
];

async function findOrCreateUser(u: { name: string; email: string }) {
  const [existing] = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
  if (existing) return existing;
  const [inserted] = await db
    .insert(users)
    .values({
      provider: "seed",
      providerId: `seed:${u.email}`,
      email: u.email,
      name: u.name,
      avatarUrl: null,
    })
    .returning();
  if (!inserted) throw new Error(`Failed to create seed user ${u.email}`);
  return inserted;
}

async function seed() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_CONFIRM !== "1") {
    throw new Error(
      "Refusing to seed in production without SEED_CONFIRM=1. Set it explicitly if this is intended."
    );
  }

  // Ensure all demo users exist; build a key -> id map.
  const userIdByKey = new Map<string, string>();
  for (const su of SEED_USERS) {
    const row = await findOrCreateUser(su);
    userIdByKey.set(su.key, row.id);
  }
  const upvoterIds = SEED_USERS.map((u) => userIdByKey.get(u.key)!).filter(Boolean);

  for (const ws of WORKSPACES) {
    const [existing] = await db.select().from(workspaces).where(eq(workspaces.slug, ws.slug)).limit(1);
    if (existing) {
      // eslint-disable-next-line no-console
      console.log(`• workspace "${ws.slug}" already exists — skipping`);
      continue;
    }

    const ownerId = userIdByKey.get(ws.ownerKey)!;
    const [workspace] = await db
      .insert(workspaces)
      .values({
        ownerId,
        name: ws.name,
        slug: ws.slug,
        visibility: "public",
        requireApproval: true,
        tagline: ws.tagline ?? null,
        description: ws.description ?? null,
        platform: ws.platform ?? null,
        category: ws.category ?? null,
        websiteUrl: ws.websiteUrl ?? null,
      })
      .returning();
    if (!workspace) throw new Error(`Failed to create workspace ${ws.slug}`);

    await db.insert(workspaceMembers).values({ workspaceId: workspace.id, userId: ownerId, role: "owner" });

    if (ws.screenshots?.length) {
      await db.insert(appScreenshots).values(
        ws.screenshots.map((url, i) => ({ workspaceId: workspace.id, url, sortOrder: i }))
      );
    }
    if (ws.links?.length) {
      await db.insert(appLinks).values(
        ws.links.map((l) => ({ workspaceId: workspace.id, kind: l.kind, url: l.url }))
      );
    }

    if (ws.followerKeys?.length) {
      await db
        .insert(follows)
        .values(
          ws.followerKeys
            .map((k) => userIdByKey.get(k))
            .filter((id): id is string => Boolean(id))
            .map((userId) => ({ userId, workspaceId: workspace.id }))
        )
        .onConflictDoNothing();
    }

    for (const p of ws.posts) {
      const cappedUpvotes = Math.min(p.upvotes, upvoterIds.length);
      const [post] = await db
        .insert(posts)
        .values({
          workspaceId: workspace.id,
          authorId: ownerId,
          title: p.title,
          description: p.description,
          category: p.category,
          moderationStatus: p.moderation,
          boardStatus: p.board,
          isAnonymous: p.anonymous ?? false,
          upvoteCount: cappedUpvotes,
        })
        .returning();
      if (!post) throw new Error(`Failed to create post "${p.title}"`);

      if (cappedUpvotes > 0) {
        await db
          .insert(upvotes)
          .values(upvoterIds.slice(0, cappedUpvotes).map((userId) => ({ postId: post.id, userId })));
      }

      for (const c of p.comments ?? []) {
        await db.insert(comments).values({
          postId: post.id,
          workspaceId: workspace.id,
          authorId: userIdByKey.get(c.author) ?? ownerId,
          content: c.content,
          isOfficialReply: c.official ?? false,
        });
      }

      if (p.update) {
        await db.insert(postUpdates).values({
          postId: post.id,
          workspaceId: workspace.id,
          authorId: ownerId,
          content: p.update,
        });
      }
    }

    // eslint-disable-next-line no-console
    console.log(`✓ seeded workspace "${ws.slug}" with ${ws.posts.length} posts`);
  }
}

seed()
  .then(async () => {
    // eslint-disable-next-line no-console
    console.log("Seed complete.");
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error("Seed failed:", err);
    await pool.end();
    process.exit(1);
  });
