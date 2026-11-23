# Plan 002 — several editions (dates) of one training

Status: APPROVED 2026-11-23 (D1–D3 decided by the owner, see Decisions).
Owner: Łukasz. Repository: this one (`patoarchitekci/patoarchitekci.github.io`,
branch `hugo`). No change in `tap-router`.

## Goal

One training page sells several editions. First user:
`data/trainings/observability-stos-grafana.yaml` with three editions:

| Edition | EasyCart product (slug) | Stripe `product_id` | State on 2026-11-23 |
|---|---|---|---|
| 2026-12-07, 2026-12-08 | `observability-ze-stosem-grafana` | `prod_TEA06WG0HrD0yc` | sold out, still upcoming |
| 2027-03-15, 2027-03-16 | `observability-ze-stosem-grafana-2027-03` | `prod_VgRfLUqeC7OvKV` | on sale |
| 2027-06-07, 2027-06-08 | `observability-ze-stosem-grafana-2027-06` | `prod_VgRfhQogJgcxxh` | on sale |

One EasyCart product per edition (decided 2026-11-23). The reason:
`tap-router` finds a training by `product_id` in `/szkolenia/trainings.json`
and takes the dates, the Discord channel slug and the MailerLite group from
that one entry. One product per edition keeps `tap-router` unchanged.

Prices (decided 2026-11-23, EasyCart already live):

- Each product has variant 3799.99 PLN gross, active until 2026-12-31 23:59,
  12 seats, countdown, crossed-out `old_price` 4198, `show_lowest_price` on.
- Each product has variant 4197.99 PLN gross (3413.00 net, exact at VAT 23%),
  active from 2027-01-01, 12 seats.
- Seats count per variant (tested 2026-11-23 with a 100% code: a purchase of
  variant A did not change the stock of variant B). On 2027-01-01 the owner
  sets the 4197.99 stock to 12 minus seats sold (Todoist task, p1).

After this plan:

- The training page lists every upcoming edition that is on sale, with its
  dates, its own buy button and its own seat counter. A sold-out edition is
  not shown (D1). The page is in waitlist mode only when no edition is on sale.
- The training list, the home page, `llms.txt` and the links page sort and
  show the training by its next bookable edition.
- `trainings.json` has one entry per upcoming edition, each with its own
  `product_id`, `dates` and `slug` (`<first date>-<id>`).
- Schema.org `Course` has one `CourseInstance` and one `Offer` per edition
  on sale.
- The page price stays one number, `price_gross` (3799.99 until 2026-12-31,
  no crossed-out price, no text about the increase; D2).
- `scripts/update_tickets.py` bakes the stock of every edition slug.
- Trainings without `editions` render byte-identically to today.

## Non-goals

- Changes in `tap-router`, EasyCart or the episode pipeline.
- Automatic price switch on 2027-01-01. The owner's Todoist task (p1,
  2027-01-01 08:00) covers both steps: the 4197.99 variant stock in EasyCart
  and `price_net`/`price_gross` = 3413.00/4197.99 in the YAML.
- Several editions with different prices, instructors or locations. Price,
  instructor, time and location stay on the training.

## Design

Data shape (D1). The training keeps every field it has today. It may add:

```yaml
editions:
  - dates: ["2026-12-07", "2026-12-08"]
    purchase_url: "https://cart.easy.tools/checkout/patoarchitekci/observability-ze-stosem-grafana"
    product_id: "prod_TEA06WG0HrD0yc"
  - dates: ["2027-03-15", "2027-03-16"]
    purchase_url: "https://cart.easy.tools/checkout/patoarchitekci/observability-ze-stosem-grafana-2027-03"
    product_id: "prod_VgRfLUqeC7OvKV"
  - dates: ["2027-06-07", "2027-06-08"]
    purchase_url: "https://cart.easy.tools/checkout/patoarchitekci/observability-ze-stosem-grafana-2027-06"
    product_id: "prod_VgRfhQogJgcxxh"
```

A training with `editions` has no top-level `dates`, `purchase_url` or
`product_id` (one source of truth).

One normalizing partial, `partials/training-current.html`. Input: a
training. Output: the training merged with `dates`, `purchase_url` and
`product_id` of its current edition, plus `saleEditions` (editions whose
first date is after today and whose slug is not at 0 in `data/tickets.yaml`,
in date order). The current edition is the first of `saleEditions`; if it is
empty, the first upcoming edition (sold out); if none is upcoming, the last
edition. A training without `editions` comes back unchanged with
`saleEditions` = one edition built from its top-level fields (or empty when
it has no future date).

Every existing reader calls this partial first and keeps its own logic:
`training-sorter.html` (feeds the list page, the home page, `llms.txt`, the
links page, `trainings-list-schema.html`), `training/single.html`,
`training-schema.html`. Only two places loop over `saleEditions`: the page
body (`single.html`) and `training-schema.html`.

`list.trainings-json.json` loops over all `editions` with its own filter,
first date `ge` today (the current contract at line 13: an edition stays in
the file on its first day, so webhooks on that day still match).

`trainings-list-schema.html` keeps one `CourseInstance` per training, built
from the current edition (no other change; `availability` stays as it is).

Live counters: the script in `single.html` switches to waitlist mode
(`enterWaitlistMode()`, line 578) only when every edition counter on the
page is at 0. An edition that sells out live hides its own row (dates,
button, counter); the next build drops it for good (D1).

## Tasks

Each task: scenario first (Given / When / Then), then code, then the local
build with no ERROR lines and the check in the scenario.

Local build (Hugo 0.169 on macOS; env only, `hugo.toml` unchanged). Hugo
0.169 blocks `tailwindcss` in `security.exec.allow`, and its Node sandbox
blocks Tailwind's browserslist from reading parent directories:

```
HUGO_SECURITY_EXEC_ALLOW='^(go|git|node|npx|postcss|tailwindcss)$' \
HUGO_SECURITY_NODE_PERMISSIONS_DISABLE=true \
hugo --gc --minify -d <scratch dir>
```

- [x] T01 `training-current.html` + `training-sorter.html`.
  Given the Observability YAML with three editions and today = 2026-11-23,
  When Hugo builds, Then the list page and the home page show the card with
  date `15.03.2027, 16.03.2027` (December is sold out), price and link of the
  March edition, and every other card is byte-identical to the build before
  the change (diff of `public/szkolenia/index.html` and `public/index.html`
  outside the Observability card is empty).
- [x] T02 Training page (`single.html`).
  Given the same data, When I open `/szkolenia/observability-stos-grafana/`,
  Then I see two editions, March and June (December is sold out and not
  shown), each with its dates, "Kup" with its own `purchase_url` and a seat
  counter with its own `data-tickets-slug`; the price is 3799.99 zł. The
  live counter script (`/api/tickets-left`) updates each counter by its
  slug. When I force the March counter to 0 in the browser (DevTools: the
  fetch returns 0), only the March row disappears; June stays on sale and
  the page is not in waitlist mode.
- [x] T03 `trainings.json`.
  Given the same data, When Hugo builds, Then `public/szkolenia/trainings.json`
  has three Observability entries with slugs `2026-12-07-…`, `2027-03-15-…`,
  `2027-06-07-…` and their own `product_id`; the other entries are unchanged.
  Then a replay of a March `product_assigned` event in the `tap-router` admin
  (after deploy) finds the training (no `no-match`).
- [x] T04 Schema.org (`training-schema.html`, `trainings-list-schema.html`).
  Given the same data, When Hugo builds, Then the page JSON-LD has one
  `CourseInstance` and one `Offer` per edition on sale (March and June,
  `InStock`; no December), and Google's Rich
  Results Test reports no errors for the page. Then the list page JSON-LD
  (`trainings-list-schema.html`) has one Observability `CourseInstance` with
  `startDate` 2027-03-15.
- [x] T05 `scripts/update_tickets.py`.
  Given the same data, When I run `python scripts/update_tickets.py`, Then
  `data/tickets.yaml` has the three Observability slugs, and trainings
  without `editions` keep their slugs.
- [x] T06 Data + deploy.
  Given T01–T05, When I push `hugo`, Then Cloudflare Pages deploys, the live
  page shows March and June on sale at 3799.99 zł, and
  `https://patoarchitekci.io/szkolenia/trainings.json` lists December, March
  and June.

## Decisions (owner)

- D1 (2026-11-23): `editions` list. Sold-out editions are not shown; the
  editions on sale show as separate dates with separate buttons. A sold-out
  edition stays in the YAML and in `trainings.json` until its first day
  (late `product_assigned` events, e.g. 100% codes, still match).
- D2 (2026-11-23): the page shows only the price, 3799.99 zł. No crossed-out
  price, no text about the increase.
- D3 (2026-11-23): no purchases of March or June are expected before the
  deploy; no replay task.

## Codex review (plan)

Run 1, 2026-11-23, 6 defects, all fixed: `trainings.json` keeps the `ge`
filter (edition stays on its first day); T06 expects December too; T07 got
a scenario; live sold-out scoped per edition (`enterWaitlistMode` only when
all are at 0); list schema output and its check defined; the status line
says no task starts before D1–D3.

Run 2, 2026-11-23 (partly on the file before D1–D3 were written in), 6 points:

- Fixed: the list-schema `availability` change is dropped, so trainings
  without `editions` stay byte-identical.
- Fixed: the 2027-01-01 price edit now names its owner and steps (Non-goals).
- Already gone after D1: the per-edition waitlist button (sold-out editions
  are not shown; waitlist only when no edition is on sale).
- Rejected: "page uses `gt`, `trainings.json` uses `ge`". Both filters are
  today's behaviour (`training-date-display.html:23`, `list.trainings-json.json:13`);
  the plan keeps them as they are.
- Rejected: "two variants, the ticket parser takes the first quantity". The
  variants have disjoint sale windows and the checkout serializes only the
  active one (checked live 2026-11-23: one `amount` 379999, one `quantity`
  12 per product). A risk line covers it.
- Rejected: "no `CLAUDE.md` in the repository". The workspace `CLAUDE.md`
  lives one directory up, outside the review scope.

Code review, 2026-11-23, 2 points:

- Rejected: "`merge` in `training-schema.html:39` keeps the March dates for
  every instance". Hugo `merge` lets the right map win; the built JSON-LD has
  two instances, 2027-03-15/16 and 2027-06-07/08.
- Fixed: `data/tickets.yaml` now has the 2027 slugs (ran
  `scripts/update_tickets.py`: March 12, June 12, December sold out).

Deviations from the plan (implementation, accepted): when an edition sells
out live, the main "Zapisz się" buttons switch to the next edition on sale.

UI follow-up (owner, 2026-11-23): for 2+ editions on sale, "Termin N" pills
in the info box and on the list card, no per-edition "Kup", and the
"Zapisz się" CTAs open a "Wybierz termin" modal with one button per edition.

Codex review of the UI, run 1: P1 fixed (the modal closes when the last
edition sells out live); P3 rejected (`static/js/training.js` is CRLF in the
whole file on HEAD). Run 2: focus fixed (focus returns to the first CTA when
waitlist mode closes the modal). Rejected: "with one edition left live, the
CTA still opens a one-button modal and the row keeps its pill". This is a
transient state until the next build; the daily ticket refresh rebuilds the
page with the single-edition markup (KISS).

## Risks

- If EasyCart ever serializes an inactive variant on the checkout page,
  `update_tickets.py` and `tickets-left.js` read the first `quantity`. On
  2027-01-01 check one product page with `curl … | grep quantity`.

- `tap-router` caches `trainings.json` for 1 hour: a replay right after the
  deploy can still see the old file. Replay at least 1 hour after T06.
- The Hugo `merge` of a training with edition fields must not leak `editions`
  into pages that print the whole training (none today; T01 diff checks it).
- `old_price` on EasyCart is whole złoty (4198, not 4197.99).
