ALTER TABLE `compliance_documents` ADD `scopeKey` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `compliance_documents`
SET `scopeKey` = `bargainingCouncil`
WHERE `docType` = 'BARGAINING_COUNCIL_GOS' AND `bargainingCouncil` IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `compliance_company_type_scope_unique` ON `compliance_documents` (`companyId`,`docType`,`scopeKey`);--> statement-breakpoint
ALTER TABLE `eft_payments` ADD `processingToken` text;--> statement-breakpoint
ALTER TABLE `referrals` ADD `rewardClaimToken` text;--> statement-breakpoint
CREATE UNIQUE INDEX `referral_rewards_first_paid_referee_unique` ON `referral_rewards` (`refereeUserId`);