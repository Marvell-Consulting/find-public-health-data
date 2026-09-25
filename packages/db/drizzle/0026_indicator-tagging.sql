ALTER TABLE "indicator_version" ADD COLUMN "has_risk_factor" boolean;--> statement-breakpoint
ALTER TABLE "indicator_version" ADD COLUMN "has_framework" boolean;--> statement-breakpoint
-- A version already given a risk factor or framework has answered yes; the rest stay unanswered.
UPDATE "indicator_version" SET "has_risk_factor" = true
WHERE EXISTS (
  SELECT 1 FROM "indicator_classification" ic
  JOIN "classification" c ON c.id = ic.classification_id
  WHERE ic.indicator_version_id = "indicator_version".id AND c.dimension = 'risk_factor'
);--> statement-breakpoint
UPDATE "indicator_version" SET "has_framework" = true
WHERE EXISTS (
  SELECT 1 FROM "indicator_classification" ic
  JOIN "classification" c ON c.id = ic.classification_id
  WHERE ic.indicator_version_id = "indicator_version".id AND c.dimension = 'framework'
);
