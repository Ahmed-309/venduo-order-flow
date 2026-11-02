# Venduo: from tech pack to quote request

A brand picks a garment, specs it from a priced catalogue, watches a live estimate, and sends complete tech packs out for a quote. There are five screens: choose a style, build the tech pack, request a quote, confirmation, My orders.

**Deployed:** _add the link here_

## Run it

```bash
npm install && npm run dev
```

Then open <http://localhost:3000>. Use Node 20 or newer. There is no backend and nothing to configure: data lives in your browser.

To see every state, open **Demo** in the header. It loads empty, partial or populated data, and it can make storage slow or failing.

| Command | What it does |
|---|---|
| `npm test` | Domain and application tests (no browser) |
| `npm run test:e2e` | Browser tests at 1280px and 390px, against a production build |
| `npm run verify` | Typecheck, lint, unit tests, build, browser tests |

Before the first browser test run, install the browser with `npx playwright install chromium`. If you call `test:e2e` on its own, run `npm run build` first.

## Structure, and why

```
src/
  domain/          Pure rules and types. No React, no browser, no storage.
    catalogue/     Catalogue types and seed data, including each garment's rules
  application/     Workflows (create, save, submit) and the repository contract
  infrastructure/  IndexedDB, an in-memory repository, fault injection, demo data
  features/        Screens and their components
  app/             Next.js routes, kept to one line of real work each
```

Dependencies point one way: `features → application → domain`. `infrastructure` implements the contract from `application`. ESLint enforces this (`eslint.config.mjs`), whether an import uses the `@/` alias or a relative path, and it also bans browser globals from `domain` and `application`. `src/architecture.test.ts` feeds it violations to prove the rules fire.

| Brief requirement | How it holds |
|---|---|
| **8.1** Rules testable without UI, browser or storage | `src/domain` imports none of them, and lint forbids it. Its tests run in plain Node. |
| **8.2** Storage replaceable without touching rules or screens | Screens and workflows see only `TechPackRepository`. `infrastructure/container.ts` picks the implementation. The Demo panel's fixture loader is the one piece tied to IndexedDB. `repository.contract.test.ts` runs the same tests against IndexedDB and an in-memory repository. |
| **8.3** New garment type is a data change | A category in `seed.ts` holds its fits, points, costs, MOQ and readiness rules. A test adds a new garment using only data and runs it through readiness and pricing. Add two sketch files to `public/sketches` as well. The seed is a TypeScript file today, so a new garment still needs a deploy. |
| **8.4** Real loading and failure states, on demand | `faultInjectingRepository.ts` wraps the real repository and delays or rejects operations. Screens receive ordinary rejected promises and contain no demo logic. |
| **8.5** Find any rule in under a minute | See the table below. |

### Where each rule lives

| Rule | File |
|---|---|
| What each garment needs | `domain/catalogue/seed.ts`, the `rules` on each category |
| How those rules are evaluated, section states | `domain/readiness.ts` |
| Price estimate and lead time | `domain/pricing.ts` |
| Minimum order and its reason | `domain/moq.ts` |
| Hub lock, what fabrics and trims show | `domain/hub.ts` |
| Grading and overrides | `domain/grading.ts` |
| Phone, quantity, delivery, what can be sent | `domain/quote.ts` |
| Description length, upload limits, Pantone format, clear section | `domain/techPack.ts` |
| Idempotent submission | `application/quotes.ts`, `commitQuoteRequest` in `infrastructure/indexedDbRepository.ts` |
| Autosave, debounce, retry | `application/autosaveQueue.ts` |
| Edits caught during page unload | `stashUnsaved` in `infrastructure/indexedDbRepository.ts` |
| Colours, type, radius | `app/globals.css` |

## Data model

- **Catalogue:** families, categories, hubs, fabrics, trims and pricing parameters. A category holds its fits, measurement points, per-hub labour and production time, per-placement fabric use, and readiness rules. Fabrics and trims carry `offers` per hub (price, MOQ, lead time), so being available at a hub simply means having an offer there.
- **Tech pack:** reference, category, details, mockups, measurements, hub, fabric and trim selections, estimate quantity, status. Uploaded images are stored separately as immutable assets, and the pack holds their ids. This keeps the domain free of `Blob`.
- **Quote draft:** the request in progress, including its stable submission id.
- **Quote request:** an immutable copy of each pack as sent, with its quantity, comment and estimate, plus delivery details. Later catalogue changes cannot alter what was sent.

Readiness rules are typed descriptors, not a rules language:

```ts
{ kind: 'trim_kind', trimKind: 'drawcord', severity: 'block', message: 'Add a drawcord. A hoodie needs one.' }
```

The kinds are `field`, `mockups`, `measurements`, `fabric_placement`, `trim_kind` and `any_trim`. Changing what a garment needs is an edit to its list. A brand new *kind* of requirement would need a few lines in `readiness.ts`, and I chose that over building a generic expression language this task does not need.

## Pricing model

These figures are illustrative assessment data, not verified factory prices.

```
fabric   = for each selected placement: placement kg × fit factor × fabric EGP/kg at the hub
trims    = for each selected trim: price at the hub × pieces per garment
unit     = (fabric + trims + labour at the hub + finishing) × quantity factor, ± uncertainty
total    = unit × quantity
```

- **Quantity factor:** 1.00 below 300, 0.95 from 300, 0.90 from 1,000, 0.85 from 3,000.
- **Uncertainty:** ±25% while any required rule fails, ±10% once the pack is complete.
- **Partial packs:** anything not yet chosen is priced as the range of what it could be: body fabric across compatible fabrics, fit across all fits, labour across hubs, a required trim across its compatible trims. The rail lists each of these as an assumption, so the range narrows honestly as the pack fills in.
- **Lead time:** the longest of production, chosen fabrics and chosen trims, plus 2 weeks for a custom colour.
- **Rounding:** money is stored as integer piastres. Unit prices round to whole pounds before the total is calculated, so the total on screen always equals the unit price on screen × quantity.

Worked example, a Regular T-shirt in Cotton jersey at Cairo, 100 units: `0.2 kg × 1 × 340 + 55 + 12 = 135 EGP`, then ±10% gives **122–149 EGP / unit**.

**Effective MOQ** is the maximum of the garment, the hub, each chosen fabric and trim, and 300 for a custom colour. Every source tied at the maximum is named in the reason.

## Decisions I made

- **The hub lock releases with the last fabric.** Trims stay, provisionally, because the brand may pick a fabric from the same hub. If the new hub cannot supply one, a dialog lists exactly those trims. Confirming removes only them; cancelling changes nothing.
- **Changing the base size changes no numbers.** Cell values are stored, not derived, so nothing visibly jumps. Later base edits regrade from the new base and skip hand-set cells. If the new base cell was set by hand, its value becomes the anchor. Each hand-set cell has a reset.
- **Picking a different fit replaces the measurements.** If the brand has edited them, a dialog asks first.
- **Each placement takes one fabric.** To change one, remove it and pick again.
- **Placements depend on the garment.** A hoodie has no collar, and trousers and shorts offer body and lining only. The brief lists four placements; offering one that a garment does not have would only produce an impossible pack.
- **Default sketches satisfy the mockup requirement**, and are labelled as defaults. The brief says they are pre-filled and "either can be replaced".
- **Quantities are per product, in total, from the MOQ up to 5,000** (the slider's ceiling). Allocation by size is left out; the brief asks only for a quantity per product.
- **The per-product comment is optional.** The brief lists it alongside quantity, but a factory can quote a complete tech pack without one, and forcing a comment invites filler.
- **Delivery requires recipient, mobile, governorate and city.** The street is optional. The brief says "address"; I judged governorate and city enough to quote on.
- **Mobile numbers** must begin 010, 011, 012 or 015 with 11 digits. `+20` and `0020` prefixes are accepted and normalized.
- **My orders is one list, newest first.** A row is either a draft or a sent request. A sent pack appears only inside its request, and opens read-only from the confirmation screen.
- **A sent pack shows the estimate it was sent with**, not one recalculated from today's catalogue.
- **Edits survive an immediate reload.** IndexedDB cannot finish a read-then-write while a page unloads, and removing the read would bypass the frozen check. So on `pagehide` any unsaved edit goes to `localStorage`, and the next load applies it through the same rules: never over a sent pack or a newer save.
- **Inputs use 16px text on phones**, not the 14px body size, because iOS Safari zooms the page when a smaller input takes focus.
- **A sent pack is frozen by the storage write itself**, not only hidden by the UI, so another tab cannot change it.
- **Submission is idempotent.** The submission id is stored before sending. A retry looks for an existing request *before* validating, because after a lost response the packs are already frozen and validation would wrongly refuse it. Creating the request, freezing packs and clearing the draft happen in one IndexedDB transaction.
- **Quote received and Sampling** are real statuses with their own pills, but nothing can reach them yet.
- **The Demo panel ships to production**, because reviewers need it on the deployed link.

## What I left out, and limits to know about

Sign-up, payments, chat and the supplier side are out of scope, as the brief asks. "Request quote" creates a local record and reaches no factory, so the "what happens next" text describes the intended product.

Browser storage has real limits:

- Data stays in one browser on one device, and clearing site data erases it.
- Two tabs editing the same draft are last-write-wins. Only frozen packs are protected.
- Replaced mockups stay in storage. I do not garbage-collect them.
- In-app links wait for a save to finish and refuse to leave if it fails. The browser's Back button cannot be held the same way, so a failed edit is lost if the brand goes back.
- Prices are bundled seed data, loaded through the repository so that a server could supply them later.

## Testing choices

I tested what would be expensive to get wrong, at the lowest level that can prove it.

- **Domain tests** cover every rule in section 07 of the brief, including the awkward grading and hub cases. They are the proof of correctness and they run in about a second.
- **Application tests** cover the submission workflow against injected faults: failed sends, lost responses, repeated ids.
- **A repository contract test** runs against IndexedDB (through `fake-indexeddb`) and the in-memory repository, covering atomicity and rollback.
- **Playwright tests** run at 1280px and 390px: the happy path, reload persistence including uploaded images, failure and retry on all five screens, keyboard use and focus trapping. One test walks every screen checking for horizontal overflow, targets under 44px and text under 12px.

I did not write component unit tests. The browser tests exercise the same components through what a user actually does, and the logic worth isolating is already outside React. I also did no visual regression testing or real screen reader testing; accessibility is checked through roles, labels and focus behaviour.

## AI assistance

Claude Code (Anthropic) was used throughout. It wrote the code, the tests and this README from a written plan, and ran the checks. The product decisions in the plan were agreed before implementation began: browser persistence, an explainable pricing model, manual overrides surviving base-size changes, and seven-day scope.

The commit history reflects that work. Commits with AI involvement carry a `Co-Authored-By` trailer.

## With another week

1. **A real backend.** A server implementation of `TechPackRepository`, with accounts and optimistic concurrency, would fix the single-device and two-tab limits. Screens would not change.
2. **Screen reader testing** with VoiceOver and NVDA, and a proper listbox pattern for the pickers.
3. **Search and filtering** for the fabric picker, which is fine with eight fabrics and would not be with eighty.
4. **Duplicate a tech pack**, because a brand iterating on a sent pack currently starts over.
5. **Arabic with a right-to-left layout**, the brief's stretch goal. I held back to polish the core instead.
