# Sprint 1 — Acceptance criteria (PS Product Manager, 2026-10-22)
Scope: Search → Work Order → Invoice → Contractor payment links. NO payment processing (no Connect, no card capture, no webhooks for shop money). Runs parallel to Phase-2 P1.0/P1.X.
Schema ground truth (main): no people table — homeowner_name/email/phone + homeowner_user_id live on `properties`; estimates = `proposals` (status draft|sent|accepted|completed, accepted_at); `jobs` filed on accept (0031, unique proposal_id+property_id); invoice today is derived from proposal (`invoiceNumber`, `invoice.ts`); links = `companies.payment_link`, `companies.paint_payment_link`, `proposals.payment_link`, routed by `shopPaymentLinkForWork` (gutters → payment_link; else paint_payment_link || payment_link).
Global rule (all items): every query is scoped by caller's `company_id` (shop) / portfolio membership (PM) / `homeowner_user_id` (HO). Each item ships a test proving shop A cannot read, search, preview, or mutate shop B's rows, even when both quoted the same address.

## 1. Search index (P0 for Coder)
1.1 Indexed types: Property (address_line, city, state, zip, homeowner_name/email/phone), Proposal (id, title, item names), Job (title, summary), Work order, Invoice (number). No Person type — "people" hits are Property hits matched on homeowner fields.
1.2 Implementation: Postgres FTS + pg_trgm in a migration (`search_documents` table or generated columns — Coder's call). Each doc carries `company_id` and `property_id`.
1.3 Freshness: a write is searchable within 5s (trigger or same-transaction upsert). Backfill migration covers all existing rows; idempotent on re-run.
1.4 Shared-address rule: a property row belongs to one company; a second shop's quote on the same address yields its own doc under its own company_id. No cross-company doc.

## 2. Search API
2.1 `GET /api/search?q=&type=` returns typed hits {type, id, property_id, label, sublabel, url}, max 20.
2.2 Rank: exact record id/number (proposal id, INV number from `invoiceNumber`, WO number) → address (partial + fuzzy) → homeowner name/phone/email → other text.
2.3 Phone matches regardless of formatting ((555) 123-4567 = 5551234567); full email with @ works; special chars never error.
2.4 Scoping per Global rule, enforced in SQL (WHERE company_id = session company), not filtered in JS. Unauthenticated → 401.
2.5 p95 < 300 ms on a 100k-doc seed; test included.
2.4a Portfolio scoping joins `portfolio_properties` (entitled Portfolio only). Homeowners and PMs see the shop jobs copied onto their own property rows (0031) only; their access comes from their entitlement to that row, never from the shop's company_id. Tests: HO sees own copy; PM sees only entitled addresses; removing an address from the Portfolio removes it from that PM's search results.
2.6 Empty q → caller's 10 most recently touched records.

## 3. Search box UI
3.1 In shop app header (/app) first; PM portfolio + /home HO reuse the same component (HO scope = own properties only).
3.2 Type chips: Properties, Estimates, Jobs, Work orders, Invoices. Up/Down/Enter navigate; Esc closes; Cmd/Ctrl-K focuses.
3.3 Right-arrow preview: property address + homeowner fields, open estimates, open WO, unpaid invoices, last activity — all from caller's scope.
3.4 No-results state suggests "New estimate at this address" for shops (existing flow).

## 4. Work order from estimate (rev 2026-10-22: manual create; Albin confirmed Oct 22, 5:29 PM ET)
4.1 Manual only: an accepted proposal shows "Create work order" to its own shop. No auto-create on accept, no backfill. At most ONE WO per proposal (`work_orders.proposal_id` UNIQUE). Once a WO exists, the action becomes "Open work order". A double click or race never creates two.
4.2 Columns: id, company_id, property_id, proposal_id, number, assignee_email, start_date, end_date, status, notes, created_at, updated_at. Line items are copied from proposal_items at creation as a snapshot, with no live link.
4.3 Assignment by email: the email is validated and stored lowercased. The assignee doesn't need an account. The assignee can be changed, and every change is logged.
4.3a Assignment email (Albin confirmed Oct 22, 5:29 PM ET): send one email via the existing mail.ts when assignee_email is first set, and one more only when it changes to a different address. Saving the same address again, a case-only change, or any status or date edit sends nothing. The email goes to the new assignee only; the previous assignee gets nothing. Content: shop name, property address, WO number, dates, and a line-item summary. Prices follow the 4.3b toggle. The email never includes homeowner phone or email. Each send is recorded in the activity log. Tests: first assign sends 1; re-saving the same address sends 0; changing the address sends 1.
4.3b Show prices (Albin, Oct 22, 5:30 PM ET; default ON confirmed 5:33 PM ET): add `work_orders.show_prices boolean not null default true`. Prices show by default, and the issuing shop can turn them off for any WO. Only that shop can change the setting.
- When ON, the worker-facing WO view and the assignment email show line-item prices and the total.
- When OFF, neither shows any price or total.
- Changing the toggle sends no email; the next assignment email follows the current value.
- Homeowner contact info is excluded either way. The shop's own WO editor always shows prices.
- Tests: a new WO has show_prices = true, so its view and email show prices. After the shop turns it off, the view and the next assignment email show no prices or total. Homeowner contact info is absent in both cases.
4.4 Statuses: scheduled, in_progress, complete; cancelled from any status before complete. Each change writes an activity row (who, from, to, at).
4.5 Filing is unchanged: the job still files on accept. Creating a WO or changing its status never creates or duplicates jobs rows. "Mark job complete" and WO complete are one action, with no double writeback.
4.6 Only the issuing shop can create or edit a WO. PM and HO see WO status read-only on their own record, with no internal notes.

## 5. Invoice from work order
5.1 One invoice per WO for sprint 1 (deposit/partial = Phase 2). Created from WO (any status except cancelled); line items prefilled from WO, editable while draft.
5.2 Keep current numbering (`invoiceNumber(proposal)`) so existing PDFs/emails don't change numbers.
5.3 Statuses: draft → sent → paid; void from draft/sent. Paid is set MANUALLY by the shop ("Mark paid", optional method: check/cash/card/ACH/other, optional note). No processor involvement.
5.4 On Paid: ONLY invoice status (+ paid_at, method) updates. No new jobs row, no re-filing, no writeback, no warranty/product publish — those already happened on accept / job complete.
5.5 Amount due = total − sum of payment entries. No fee anywhere (see 6.9).
5.6 HO sees invoice on /home with status; PM sees on portfolio file; neither can change status.

5.8 (rev 2026-10-22) Partial payments are allowed. "Mark paid" defaults to the full amount due, and the shop can edit it down. Status is partially_paid while 0 < paid < total and paid at total. Each payment is an append-only entry (5.7).
5.9 Corrections: within 7 days the issuing shop can add a negative entry that references the original; after that, the shop can only append a note. Entries are never edited or deleted.
5.10 HO and PM invoice visibility comes from entitlement to the property row (homeowner_user_id; entitled portfolio_properties), never from matching addresses. Test: the same address on another row shows nothing.
5.11 "Send invoice" email: From "{Shop} via PlanitService", reply-to set to the shop's email, sent through the existing mail.ts. Each send is logged.

## 6. Contractor payment links (generic, alongside gutters/paint)
6.1 RULING (2026-10-22): two link slots total and ONE Pay button per invoice. Slot 1 is `companies.payment_link` (generic/gutters). Slot 2 is `companies.paint_payment_link`, shown in settings as a second labeled link with an optional label. The extra label+URL buttons Coder built are removed, so an invoice never shows more than one Pay button, chosen by 6.2. Superseded original: Shop settings: a generic "Payment link" field — this IS existing `companies.payment_link`; label it generic. `paint_payment_link` stays as the paint override. No new processor.
6.2 Resolution order for a given invoice: `proposals.payment_link` (per-estimate override) → `shopPaymentLinkForWork(workId, shop)` (gutters → payment_link; paint/other → paint_payment_link || payment_link) → none. Existing gutters and paint behavior must produce byte-identical URLs (regression test on both).
6.3 Validation via `normalizePaymentLink`; https only; reject javascript:/data:.
6.4 Invoice view/email shows "Pay now" button only when a link resolves; otherwise shows payment terms text. Clicking does not change status (shop marks paid per 5.3).
6.5 Links never appear on another shop's records (Global rule).

## Out of scope sprint 1
Stripe Connect, application fee, webhook-paid, text-to-pay, saved searches, partial/deposit invoices, crew mobile view, PM-issued WOs. Counsel flag: "not a GC/escrow" copy only matters once we process money — not triggered by links.

## Counsel conditions folded in (memo /workspace/legal/2026-10-22-sprint1-contractor-payments-review.md, CONDITIONAL) — added 2026-10-22
### 5.7 Paid marks: attributed, append-only, restricted (amends §5.3–5.6)
- Each "Mark paid" writes an append-only `invoice_status_events` row (invoice_id, company_id, actor user id, from, to, method, note, at). Never update/delete in place.
- Display label: "Marked paid by {Shop} on {date}" + who entered it. Never "Paid" alone; no "receipt" title.
- Retraction: the issuing shop may retract within 7 days (data-rights matrix) by appending a reversal event; after 7 days, append-only amend notes only. Full history visible to permitted viewers.
- Visibility: amounts + paid status shown only to the homeowner (homeowner_user_id), the issuing shop, and PMs whose entitled Portfolio contains the address. Other shops see nothing (no row, no search hit, no preview count). Tests for each viewer class.
### 6.7 Copy (amends §6.4)
- Rename "Payment Portal"/"Pay now" to "Pay {Shop name} online".
- Disclaimer under the button, always: "Payments go directly to {Shop name}. PlanitService does not process or hold payments." Editor may polish, not change meaning.
### 6.8 Routing safety (amends §6.2, §6.5)
- A link may only resolve from the issuing shop's own fields (that proposal's company_id → its companies row, or that proposal's payment_link). No hardcoded URLs, no fallback to any other company.
- Required test: shops A and B each set gutters/paint/generic links; every invoice for A resolves only to A's URLs across all work types; a shop with no link shows terms text, never another shop's link.
- Remove/neutralize the "Painting Plus" assumption in the shopPaymentLinkForWork comment and logic; behavior stays per-shop.
### 6.9 Fees: none (rev 2026-10-22, Albin confirmed Oct 22, 5:29 PM ET)
- No fee logic or fee copy anywhere, Painting Plus included. Remove `CARD_FEE_RATE`, the fee math in `withCardFee`/`checkoutAmount`, and the invoice "3% card fee" line.
- The MX/link prefill is the invoice amount only. Every shop shows the plain "Pay {Shop name} online" link plus the disclaimer.
- Test: the prefilled amount equals the invoice total for both a gutters invoice and a paint invoice.
- This satisfies Counsel's (a)1 by removal rather than a per-shop setting. Counsel to confirm.

### Release gate for #6
- Ship #6 only with 5.7, 6.7, and 6.8 done. The ToS paragraph (links, surcharge responsibility, manual records, no processing) and the privacy line (prefill to the contractor's processor) are Counsel's to draft, and they gate the release.
