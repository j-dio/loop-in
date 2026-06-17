import {
  pgTable,
  pgEnum,
  varchar,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { desc, sql } from 'drizzle-orm';

export const workspaceVisibility = pgEnum('workspace_visibility', [
  'public',
  'invite_only',
]);

export const workspaceRole = pgEnum('workspace_role', ['owner', 'admin', 'member']);

export const postCategory = pgEnum('post_category', [
  'bug',
  'feature_request',
  'ui_tweak',
]);

export const moderationStatus = pgEnum('moderation_status', [
  'pending',
  'approved',
  'spam',
  'rejected',
]);

export const boardStatus = pgEnum('board_status', [
  'inbox',
  'under_review',
  'planned',
  'in_progress',
  'shipped',
]);

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .defaultRandom(), // generate a random UUID

  email: varchar('email', { length: 255 })
    .notNull(),

  name: varchar('name', { length: 255 }),
  
  avatarUrl: text('avatar_url'),

  provider: varchar('provider', { length: 50 })
    .notNull(),

  providerId: varchar('provider_id', { length: 255 })
    .notNull(),
  
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  emailUnique: uniqueIndex('users_email_unique').on(table.email),
  providerUnique: uniqueIndex('users_provider_provider_id_unique').on(
    table.provider,
    table.providerId,
  ),
}));

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),

  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).notNull(),

  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  userIdIdx: index('sessions_user_id_idx').on(table.userId),
}));

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),

  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),

  name: varchar('name', { length: 255 }).notNull(),

  slug: varchar('slug', { length: 100 }).notNull(),

  primaryColor: varchar('primary_color', { length: 7 })
    .notNull()
    .default('#0F172A'),

  visibility: workspaceVisibility('visibility').notNull().default('public'),

  requireApproval: boolean('require_approval').notNull().default(true),

  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  slugUnique: uniqueIndex('workspaces_slug_unique').on(table.slug),
  ownerIdIdx: index('workspaces_owner_id_idx').on(table.ownerId),
  // Public-discovery (explore) lists workspaces by visibility.
  visibilityIdx: index('workspaces_visibility_idx').on(table.visibility),
}));

export const workspaceMembers = pgTable('workspace_members', {
  id: uuid('id').primaryKey().defaultRandom(),

  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),

  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  role: workspaceRole('role').notNull(),

  joinedAt: timestamp('joined_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  workspaceUserUnique: uniqueIndex('workspace_members_workspace_id_user_id_unique').on(
    table.workspaceId,
    table.userId,
  ),
  workspaceIdIdx: index('workspace_members_workspace_id_idx').on(table.workspaceId),
  userIdIdx: index('workspace_members_user_id_idx').on(table.userId),
}));

export const pendingInvites = pgTable(
  'pending_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    email: varchar('email', { length: 255 }).notNull(),

    /** `member` or `admin` at the API layer; stored as varchar per PRD. */
    role: varchar('role', { length: 20 }).notNull().default('member'),

    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    token: varchar('token', { length: 255 }).notNull(),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    workspaceEmailUnique: uniqueIndex('pending_invites_workspace_id_email_unique').on(
      table.workspaceId,
      table.email,
    ),
    tokenUnique: uniqueIndex('pending_invites_token_unique').on(table.token),
    workspaceIdIdx: index('pending_invites_workspace_id_idx').on(table.workspaceId),
    emailIdx: index('pending_invites_email_idx').on(table.email),
  }),
);

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),

  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),

  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),

  title: varchar('title', { length: 255 }).notNull(),

  description: text('description'),

  category: postCategory('category').notNull(),

  moderationStatus: moderationStatus('moderation_status')
    .notNull()
    .default('pending'),

  boardStatus: boardStatus('board_status').notNull().default('inbox'),

  isAnonymous: boolean('is_anonymous').notNull().default(false),

  imageUrl: text('image_url'),

  upvoteCount: integer('upvote_count').notNull().default(0),

  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),

  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  workspaceIdIdx: index('posts_workspace_id_idx').on(table.workspaceId),
  workspaceModerationIdx: index('posts_workspace_id_moderation_status_idx').on(
    table.workspaceId,
    table.moderationStatus,
  ),
  workspaceBoardIdx: index('posts_workspace_id_board_status_idx').on(
    table.workspaceId,
    table.boardStatus,
  ),
  workspaceCreatedAtDescIdx: index('posts_workspace_id_created_at_desc_idx').on(
    table.workspaceId,
    desc(table.createdAt),
  ),
  // Hot path: per-workspace "newest" public feed (approved + not deleted), ordered by created_at desc.
  feedNewestIdx: index('posts_feed_newest_idx')
    .on(table.workspaceId, desc(table.createdAt), desc(table.id))
    .where(sql`moderation_status = 'approved' AND deleted_at IS NULL`),
  // Hot path: per-workspace "top" public feed, ordered by upvote_count desc.
  feedTopIdx: index('posts_feed_top_idx')
    .on(table.workspaceId, desc(table.upvoteCount), desc(table.createdAt), desc(table.id))
    .where(sql`moderation_status = 'approved' AND deleted_at IS NULL`),
  // Cross-workspace explore feed: newest approved posts across all (public) workspaces.
  publicFeedIdx: index('posts_public_feed_idx')
    .on(desc(table.createdAt), desc(table.id))
    .where(sql`moderation_status = 'approved' AND deleted_at IS NULL`),
}));

export const upvotes = pgTable('upvotes', {
  id: uuid('id').primaryKey().defaultRandom(),

  postId: uuid('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),

  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  postUserUnique: uniqueIndex('upvotes_post_id_user_id_unique').on(
    table.postId,
    table.userId,
  ),
  postIdIdx: index('upvotes_post_id_idx').on(table.postId),
  userIdIdx: index('upvotes_user_id_idx').on(table.userId),
}));

export const postUpdates = pgTable('post_updates', {
  id: uuid('id').primaryKey().defaultRandom(),

  postId: uuid('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),

  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),

  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),

  content: text('content').notNull(),

  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  postIdIdx: index('post_updates_post_id_idx').on(table.postId),
  workspaceIdIdx: index('post_updates_workspace_id_idx').on(table.workspaceId),
}));

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),

  postId: uuid('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),

  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),

  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),

  content: text('content').notNull(),

  isOfficialReply: boolean('is_official_reply').notNull().default(false),

  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),

  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  postIdIdx: index('comments_post_id_idx').on(table.postId),
  workspaceIdIdx: index('comments_workspace_id_idx').on(table.workspaceId),
}));