import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { articles } from "../articles/articles.js";

export const risks = pgTable(
  "risks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    riskTitle: text("risk_title").notNull(),
    domains: text("domains"),
    primaryRisk: varchar("primary_risk", { length: 128 }),
    secondaryRisk: varchar("secondary_risk", { length: 256 }),
    sector: varchar("sector", { length: 128 }),
    industry: varchar("industry", { length: 256 }),
    intent: varchar("intent", { length: 128 }),
    qualityScore: integer("quality_score"),
    likelihood: integer("likelihood"),
    impact: integer("impact"),
    severityScore: integer("severity_score"),
    severityBand: varchar("severity_band", { length: 16 }),
    aiProductName: varchar("ai_product_name", { length: 256 }),
    aiProductVendor: varchar("ai_product_vendor", { length: 256 }),
    extractionJson: jsonb("extraction_json").notNull(),
    modelName: varchar("model_name", { length: 128 }),
    sourceFlag: varchar("source_flag", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("risks_article_id_idx").on(table.articleId),
    index("risks_primary_risk_idx").on(table.primaryRisk),
    index("risks_created_at_idx").on(table.createdAt),
    index("risks_severity_band_idx").on(table.severityBand),
    index("risks_severity_score_idx").on(table.severityScore),
  ],
);

export type Risk = typeof risks.$inferSelect;
export type NewRisk = typeof risks.$inferInsert;
