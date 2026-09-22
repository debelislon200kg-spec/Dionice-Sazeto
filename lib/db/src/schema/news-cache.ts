import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const newsCacheTable = pgTable("news_cache", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});