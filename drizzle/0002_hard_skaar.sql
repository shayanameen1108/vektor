PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_referral_rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`referrerUserId` text NOT NULL,
	`refereeUserId` text NOT NULL,
	`referrerCompanyId` text,
	`creditsGranted` integer NOT NULL,
	`type` text DEFAULT 'first_paid_subscription' NOT NULL,
	`planLookupKey` text,
	`triggerReference` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`referrerUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`refereeUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`referrerCompanyId`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_referral_rewards`("id", "referrerUserId", "refereeUserId", "referrerCompanyId", "creditsGranted", "type", "planLookupKey", "triggerReference", "createdAt") SELECT "id", "referrerUserId", "refereeUserId", "referrerCompanyId", "creditsGranted", "type", "planLookupKey", "triggerReference", "createdAt" FROM `referral_rewards`;--> statement-breakpoint
DROP TABLE `referral_rewards`;--> statement-breakpoint
ALTER TABLE `__new_referral_rewards` RENAME TO `referral_rewards`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `referral_rewards_referrer_idx` ON `referral_rewards` (`referrerUserId`);--> statement-breakpoint
CREATE INDEX `referral_rewards_created_at_idx` ON `referral_rewards` (`createdAt`);--> statement-breakpoint
CREATE UNIQUE INDEX `referral_rewards_first_paid_referee_unique` ON `referral_rewards` (`refereeUserId`);