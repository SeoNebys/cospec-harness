CREATE TABLE `bookmark` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`url` text NOT NULL,
	`normalized_url` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookmark_owner_url_unique` ON `bookmark` (`owner_id`,`normalized_url`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookmark_owner_id_unique` ON `bookmark` (`owner_id`,`id`);--> statement-breakpoint
CREATE INDEX `bookmark_owner_created_idx` ON `bookmark` (`owner_id`,`created_at`,`id`);