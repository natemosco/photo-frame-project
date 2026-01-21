import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Users Table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  googleId: text("google_id").notNull().unique(),
  name: text("name"),
  image: text("image"),
  canShareToFrame: boolean("can_share_to_frame").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Photos Table
export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    s3Key: text("s3_key").notNull(),
    publicUrl: text("public_url").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    isShared: boolean("is_shared").default(false).notNull(),
    isLocked: boolean("is_locked").default(false).notNull(),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIsSharedIdx: index("user_is_shared_idx").on(table.userId, table.isShared),
  })
);

// Frames Table
export const frames = pgTable("frames", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isShared: boolean("is_shared").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Frame Photos Junction Table (many-to-many)
export const framePhotos = pgTable(
  "frame_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    frameId: uuid("frame_id")
      .notNull()
      .references(() => frames.id, { onDelete: "cascade" }),
    photoId: uuid("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    framePhotoIdx: unique("frame_photo_unique").on(table.frameId, table.photoId),
  })
);

// Relations (optional, for query convenience)
export const usersRelations = relations(users, ({ many }) => ({
  photos: many(photos),
  frames: many(frames),
}));

export const photosRelations = relations(photos, ({ one, many }) => ({
  user: one(users, {
    fields: [photos.userId],
    references: [users.id],
  }),
  framePhotos: many(framePhotos),
}));

export const framesRelations = relations(frames, ({ one, many }) => ({
  user: one(users, {
    fields: [frames.userId],
    references: [users.id],
  }),
  framePhotos: many(framePhotos),
}));

export const framePhotosRelations = relations(framePhotos, ({ one }) => ({
  frame: one(frames, {
    fields: [framePhotos.frameId],
    references: [frames.id],
  }),
  photo: one(photos, {
    fields: [framePhotos.photoId],
    references: [photos.id],
  }),
}));
