import { pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

/** URLs marked so ingest jobs skip LLM extraction. */
export const urlExecutionBlocks = pgTable("url_execution_blocks", {
  id: serial("id").primaryKey(),
  url: varchar("url", { length: 2048 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UrlExecutionBlock = typeof urlExecutionBlocks.$inferSelect;
export type NewUrlExecutionBlock = typeof urlExecutionBlocks.$inferInsert;
