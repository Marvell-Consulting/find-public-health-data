GRANT SELECT ON ALL TABLES IN SCHEMA public TO public_api;--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA public TO internal_api;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO public_api;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO internal_api;
