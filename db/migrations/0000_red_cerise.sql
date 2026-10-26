CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`issuer` text NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_issuer_accountId_uidx` ON `account` (`issuer`,`accountId`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	`impersonatedBy` text,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'user' NOT NULL,
	`banned` integer DEFAULT false,
	`banReason` text,
	`banExpires` integer,
	`referralCode` text,
	`referredByUserId` text,
	`referredByCode` text,
	`referredAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `user_role_idx` ON `user` (`role`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_referral_code_unique` ON `user` (`referralCode`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`companyName` text NOT NULL,
	`cipcNum` text NOT NULL,
	`csdMaaaNum` text,
	`sarsTcsPin` text,
	`cidbCrsNum` text,
	`bbbeeLevel` integer,
	`contactEmail` text,
	`contactPhone` text,
	`authorisedSignatoryName` text,
	`authorisedSignatoryPosition` text,
	`bargainingCouncils` text,
	`preferredPppfaSystem` text,
	`alertsEnabled` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `companies_userId_idx` ON `companies` (`userId`);--> statement-breakpoint
CREATE TABLE `compliance_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`companyId` text NOT NULL,
	`docType` text NOT NULL,
	`fileName` text NOT NULL,
	`storageKey` text,
	`expiryDate` integer,
	`isCompliant` integer DEFAULT true NOT NULL,
	`bargainingCouncil` text,
	`extractedBbbeeLevel` integer,
	`extractedExpiryDate` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `compliance_company_idx` ON `compliance_documents` (`companyId`);--> statement-breakpoint
CREATE INDEX `compliance_docType_idx` ON `compliance_documents` (`docType`);--> statement-breakpoint
CREATE INDEX `compliance_expiry_idx` ON `compliance_documents` (`expiryDate`);--> statement-breakpoint
CREATE TABLE `sent_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`companyId` text NOT NULL,
	`documentId` text NOT NULL,
	`threshold` integer NOT NULL,
	`sentAt` integer NOT NULL,
	`resendId` text,
	`toEmail` text,
	FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`documentId`) REFERENCES `compliance_documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sent_reminders_company_idx` ON `sent_reminders` (`companyId`);--> statement-breakpoint
CREATE INDEX `sent_reminders_document_idx` ON `sent_reminders` (`documentId`);--> statement-breakpoint
CREATE UNIQUE INDEX `sent_reminders_unique` ON `sent_reminders` (`companyId`,`documentId`,`threshold`);--> statement-breakpoint
CREATE TABLE `tenders` (
	`id` text PRIMARY KEY NOT NULL,
	`companyId` text NOT NULL,
	`tenderNumber` text,
	`title` text NOT NULL,
	`issuingEntity` text,
	`closingDate` text,
	`requiredCidbGrade` text,
	`preferencePointSystem` text DEFAULT '80/20' NOT NULL,
	`parsedReturnables` text,
	`evaluationCriteria` text,
	`fitScore` integer NOT NULL,
	`riskFlags` text,
	`eligibleBbbeePoints` real DEFAULT 0 NOT NULL,
	`returnableStatus` text,
	`pdfStorageKey` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tenders_companyId_idx` ON `tenders` (`companyId`);--> statement-breakpoint
CREATE INDEX `tenders_createdAt_idx` ON `tenders` (`createdAt`);--> statement-breakpoint
CREATE TABLE `company_credits` (
	`companyId` text PRIMARY KEY NOT NULL,
	`credits` integer DEFAULT 0 NOT NULL,
	`subscriptionLookupKey` text,
	`subscriptionCycleCredits` integer,
	`subscriptionRolloverCap` integer,
	`subscriptionStartedAt` integer,
	`subscriptionActive` integer DEFAULT false NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `eft_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`userId` text NOT NULL,
	`userEmail` text NOT NULL,
	`companyId` text NOT NULL,
	`companyName` text DEFAULT '' NOT NULL,
	`lookupKey` text NOT NULL,
	`packageName` text NOT NULL,
	`amount` integer NOT NULL,
	`credits` integer NOT NULL,
	`billingPeriod` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'awaiting_proof' NOT NULL,
	`proofPath` text,
	`proofContentType` text,
	`proofFilename` text,
	`rejectReason` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`confirmedAt` integer,
	`confirmedBy` text,
	`rejectedAt` integer,
	`rejectedBy` text,
	`creditsGranted` integer,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`companyId`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `eft_payments_reference_unique` ON `eft_payments` (`reference`);--> statement-breakpoint
CREATE INDEX `eft_userId_idx` ON `eft_payments` (`userId`);--> statement-breakpoint
CREATE INDEX `eft_companyId_idx` ON `eft_payments` (`companyId`);--> statement-breakpoint
CREATE INDEX `eft_status_idx` ON `eft_payments` (`status`);--> statement-breakpoint
CREATE INDEX `eft_createdAt_idx` ON `eft_payments` (`createdAt`);--> statement-breakpoint
CREATE TABLE `referral_rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`referrerUserId` text NOT NULL,
	`refereeUserId` text NOT NULL,
	`referrerCompanyId` text NOT NULL,
	`creditsGranted` integer NOT NULL,
	`type` text DEFAULT 'first_paid_subscription' NOT NULL,
	`planLookupKey` text,
	`triggerReference` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`referrerUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`refereeUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`referrerCompanyId`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `referral_rewards_referrer_idx` ON `referral_rewards` (`referrerUserId`);--> statement-breakpoint
CREATE INDEX `referral_rewards_created_at_idx` ON `referral_rewards` (`createdAt`);--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` text PRIMARY KEY NOT NULL,
	`referrerUserId` text NOT NULL,
	`refereeUserId` text NOT NULL,
	`refereeEmail` text NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'signed_up' NOT NULL,
	`signupBonusGranted` integer DEFAULT false NOT NULL,
	`referrerFirstPaidBonusGranted` integer DEFAULT false NOT NULL,
	`referrerSubBonusGranted` integer DEFAULT false NOT NULL,
	`cappedAt` integer,
	`capReason` text,
	`pendingReferrerCredits` integer,
	`pendingPlanLookupKey` text,
	`firstPaidAt` integer,
	`firstPaidPlanLookupKey` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`referrerUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`refereeUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `referrals_referrer_idx` ON `referrals` (`referrerUserId`);--> statement-breakpoint
CREATE UNIQUE INDEX `referrals_referee_unique` ON `referrals` (`refereeUserId`);--> statement-breakpoint
CREATE INDEX `referrals_code_idx` ON `referrals` (`code`);