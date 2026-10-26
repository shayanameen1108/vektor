# Vektor

South African tender compliance for contractors. A Company keeps Compliance documents current, spends Credits to analyse Tenders, and buys Credits by EFT.

## Language

**Company**:
The contractor a signed-in person registers, identified by its name and CIPC number. One person may hold more than one.
_Avoid_: Account, organisation, tenant, workspace

**Credit**:
The unit a Company spends to have a Tender analysed.
_Avoid_: Token, seat, licence

**Tender**:
The tender a Company submits to be scored against its Compliance documents.
_Avoid_: Bid, opportunity, RFP

**Analysis**:
The scoring of one Tender for a Company.
_Avoid_: Scan, audit, report

**Verdict**:
The band of an analysis score: GO at 75 and above, CAUTION at 50 and above, NO-GO below that, and UNKNOWN when the score is missing.
_Avoid_: Pass, fail, recommendation

**Compliance document**:
A statutory file a Company keeps current: a tax pin, COIDA, B-BBEE, a bargaining-council certificate, or a director's identity document.
_Avoid_: Certificate, attachment

**EFT**:
A bank transfer that buys Credits. The Credits belong to the Company once an Admin confirms the payment.
_Avoid_: Stripe, card, checkout, wallet

**Catalog**:
The prices of Credits: three monthly allowances, Starter, Pro, and Scale, and one Single Analysis.
_Avoid_: Price list, plan copy

**Admin**:
Staff who can see every Company, and who confirm or reject an EFT.
_Avoid_: Moderator, support, owner

**Referral**:
An invite from one person to another. The reward belongs to the referrer, after the invited person's first paid subscription is confirmed.
_Avoid_: Affiliate, bounty, signup bonus
