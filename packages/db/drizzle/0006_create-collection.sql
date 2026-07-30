CREATE TABLE "collection" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"source_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "indicator_collection" (
	"indicator_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "indicator_collection_indicator_id_collection_id_pk" PRIMARY KEY("indicator_id","collection_id")
);
--> statement-breakpoint
ALTER TABLE "indicator" ADD COLUMN "data_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "indicator_collection" ADD CONSTRAINT "indicator_collection_indicator_id_indicator_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "public"."indicator"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicator_collection" ADD CONSTRAINT "indicator_collection_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_collection_source" ON "collection" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_indicator_collection_collection" ON "indicator_collection" USING btree ("collection_id");