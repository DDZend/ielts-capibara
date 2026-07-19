CREATE TABLE `capi_helper_gifts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`donor_email` text NOT NULL,
	`coins` integer NOT NULL,
	`access_hours` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `capi_helper_gifts_donor_created_at_idx` ON `capi_helper_gifts` (`donor_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `capi_helper_gifts_status_created_at_idx` ON `capi_helper_gifts` (`status`,`created_at`);