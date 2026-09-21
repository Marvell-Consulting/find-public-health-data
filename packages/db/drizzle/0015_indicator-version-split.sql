CREATE SCHEMA "published";
--> statement-breakpoint
CREATE TABLE "indicator_version" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"indicator_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"name" text NOT NULL,
	"value_type_id" uuid,
	"unit_id" uuid,
	"year_type_id" uuid,
	"ci_method_id" uuid,
	"polarity_id" uuid,
	"frequency_id" uuid,
	"comparator_method_id" uuid,
	"disclosure_threshold" smallint,
	"ci_confidence_level" text,
	"config" jsonb,
	"definition" text,
	"rationale" text,
	"methodology" text,
	"numerator_definition" text,
	"denominator_definition" text,
	"disclosure_control" text,
	"caveats" text,
	"notes" text,
	"data_source_id" uuid,
	"numerator_source_id" uuid,
	"denominator_source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"updated_by" text NOT NULL,
	CONSTRAINT "indicator_version_ci_confidence_level_check" CHECK ("indicator_version"."ci_confidence_level" IN ('95', '99.8', 'both')),
	CONSTRAINT "indicator_version_status_check" CHECK ("indicator_version"."status" IN ('draft', 'published'))
);
--> statement-breakpoint
ALTER TABLE "indicator_metadata" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "indicator_metadata" CASCADE;--> statement-breakpoint
ALTER TABLE "indicator" DROP CONSTRAINT "indicator_ci_confidence_level_check";--> statement-breakpoint
ALTER TABLE "indicator" DROP CONSTRAINT "indicator_status_check";--> statement-breakpoint
ALTER TABLE "indicator_classification" DROP CONSTRAINT "indicator_classification_indicator_id_indicator_id_fk";
--> statement-breakpoint
ALTER TABLE "indicator" DROP CONSTRAINT "indicator_value_type_id_value_type_id_fk";
--> statement-breakpoint
ALTER TABLE "indicator" DROP CONSTRAINT "indicator_unit_id_unit_id_fk";
--> statement-breakpoint
ALTER TABLE "indicator" DROP CONSTRAINT "indicator_year_type_id_year_type_id_fk";
--> statement-breakpoint
ALTER TABLE "indicator" DROP CONSTRAINT "indicator_ci_method_id_ci_method_id_fk";
--> statement-breakpoint
ALTER TABLE "indicator" DROP CONSTRAINT "indicator_polarity_id_polarity_id_fk";
--> statement-breakpoint
ALTER TABLE "indicator" DROP CONSTRAINT "indicator_frequency_id_frequency_id_fk";
--> statement-breakpoint
ALTER TABLE "indicator" DROP CONSTRAINT "indicator_comparator_method_id_comparator_method_id_fk";
--> statement-breakpoint
ALTER TABLE "indicator" DROP CONSTRAINT "indicator_supersedes_id_indicator_id_fk";
--> statement-breakpoint
ALTER TABLE "indicator_topic" DROP CONSTRAINT "indicator_topic_indicator_id_indicator_id_fk";
--> statement-breakpoint
DROP INDEX "idx_indicator_name_trgm";--> statement-breakpoint
DROP INDEX "idx_indicator_topic_indicator";--> statement-breakpoint
ALTER TABLE "indicator_classification" DROP CONSTRAINT "indicator_classification_indicator_id_classification_id_pk";--> statement-breakpoint
ALTER TABLE "indicator_topic" DROP CONSTRAINT "indicator_topic_topic_id_indicator_id_pk";--> statement-breakpoint
ALTER TABLE "indicator_classification" ADD COLUMN "indicator_version_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "indicator_topic" ADD COLUMN "indicator_version_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "indicator_classification" ADD CONSTRAINT "indicator_classification_indicator_version_id_classification_id_pk" PRIMARY KEY("indicator_version_id","classification_id");--> statement-breakpoint
ALTER TABLE "indicator_topic" ADD CONSTRAINT "indicator_topic_topic_id_indicator_version_id_pk" PRIMARY KEY("topic_id","indicator_version_id");--> statement-breakpoint
ALTER TABLE "indicator_version" ADD CONSTRAINT "indicator_version_indicator_id_indicator_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "public"."indicator"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicator_version" ADD CONSTRAINT "indicator_version_value_type_id_value_type_id_fk" FOREIGN KEY ("value_type_id") REFERENCES "public"."value_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicator_version" ADD CONSTRAINT "indicator_version_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicator_version" ADD CONSTRAINT "indicator_version_year_type_id_year_type_id_fk" FOREIGN KEY ("year_type_id") REFERENCES "public"."year_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicator_version" ADD CONSTRAINT "indicator_version_ci_method_id_ci_method_id_fk" FOREIGN KEY ("ci_method_id") REFERENCES "public"."ci_method"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicator_version" ADD CONSTRAINT "indicator_version_polarity_id_polarity_id_fk" FOREIGN KEY ("polarity_id") REFERENCES "public"."polarity"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicator_version" ADD CONSTRAINT "indicator_version_frequency_id_frequency_id_fk" FOREIGN KEY ("frequency_id") REFERENCES "public"."frequency"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicator_version" ADD CONSTRAINT "indicator_version_comparator_method_id_comparator_method_id_fk" FOREIGN KEY ("comparator_method_id") REFERENCES "public"."comparator_method"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicator_version" ADD CONSTRAINT "indicator_version_data_source_id_data_source_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicator_version" ADD CONSTRAINT "indicator_version_numerator_source_id_numerator_denominator_source_id_fk" FOREIGN KEY ("numerator_source_id") REFERENCES "public"."numerator_denominator_source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicator_version" ADD CONSTRAINT "indicator_version_denominator_source_id_numerator_denominator_source_id_fk" FOREIGN KEY ("denominator_source_id") REFERENCES "public"."numerator_denominator_source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_indicator_version_one_draft" ON "indicator_version" USING btree ("indicator_id") WHERE "indicator_version"."status" = 'draft';--> statement-breakpoint
CREATE INDEX "idx_indicator_version_indicator" ON "indicator_version" USING btree ("indicator_id");--> statement-breakpoint
CREATE INDEX "idx_indicator_version_name_trgm" ON "indicator_version" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_indicator_version_definition_trgm" ON "indicator_version" USING gin ("definition" gin_trgm_ops);--> statement-breakpoint
ALTER TABLE "indicator_classification" ADD CONSTRAINT "indicator_classification_indicator_version_id_indicator_version_id_fk" FOREIGN KEY ("indicator_version_id") REFERENCES "public"."indicator_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicator_topic" ADD CONSTRAINT "indicator_topic_indicator_version_id_indicator_version_id_fk" FOREIGN KEY ("indicator_version_id") REFERENCES "public"."indicator_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_indicator_topic_indicator_version" ON "indicator_topic" USING btree ("indicator_version_id");--> statement-breakpoint
ALTER TABLE "indicator_classification" DROP COLUMN "indicator_id";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "value_type_id";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "unit_id";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "year_type_id";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "ci_method_id";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "polarity_id";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "frequency_id";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "comparator_method_id";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "disclosure_threshold";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "ci_confidence_level";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "supersedes_id";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "reviewed_at";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "reviewed_by";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "config";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "created_by";--> statement-breakpoint
ALTER TABLE "indicator" DROP COLUMN "updated_by";--> statement-breakpoint
ALTER TABLE "indicator_topic" DROP COLUMN "indicator_id";