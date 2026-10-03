CREATE TABLE `bookmark_tag` (
	`owner_id` text NOT NULL,
	`bookmark_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`bookmark_id`, `tag_id`),
	FOREIGN KEY (`owner_id`,`bookmark_id`) REFERENCES `bookmark`(`owner_id`,`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`,`tag_id`) REFERENCES `tag`(`owner_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bookmark_tag_owner_tag_idx` ON `bookmark_tag` (`owner_id`,`tag_id`,`bookmark_id`);--> statement-breakpoint
CREATE TABLE `tag` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_owner_name_unique` ON `tag` (`owner_id`,`normalized_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `tag_owner_id_unique` ON `tag` (`owner_id`,`id`);