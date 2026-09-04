# Plan 001 — the website reads `patoarchitekci/episodes` instead of Airtable

Status: APPROVED 2026-09-04 (all five decisions taken by the owner; work
started the same day).
Owner: Łukasz. Repositories: this one (`patoarchitekci/patoarchitekci.github.io`,
branch `hugo`) and the episode store (`patoarchitekci/episodes`, branch `main`,
local clone `/Users/lukasz/tmp/experiments/podcast`).

## Goal

`publish_podcast.yml` renders `content/episodes/<N>.md` and the two cover
files from the episode store instead of Airtable. Nothing else about the
website changes: the same front matter, the same layouts, the same trigger
(`pato publish website <N>` dispatches the workflow), the same go-live (the
page carries a future date, Hugo skips it, the Friday `pato publish
cloudflare` rebuild puts it live), IndexNow untouched.

After this plan:

- `python scripts/publish_episode.py --episodes-dir <clone>/data --episode-number N`
  writes `content/episodes/N.md`, `static/img/N-square.webp` and
  `static/img/N-landscape.webp` from `data/episodes/NNN/*` and `data/links/*.yaml`.
- The workflow checks out the episode store next to this repository and runs
  that script; the commit message names the store commit it rendered.
- Episode 200 rendered from the store is byte-identical with the current
  `content/episodes/200.md` (the local acceptance test — never committed,
  decision 5), except the deltas recorded in T02.
- The first live run is episode 10 (owner, 2026-09-04): a legacy episode
  with `transcript.md` in the store and a placeholder on the site.
- Airtable is gone from the episode path. The newsletter path
  (`publish_newsletter.py`, a separate Airtable base) is untouched.

## Non-goals

- The newsletter pipeline (`scripts/publish_newsletter.py`,
  `publish_newsletter.yml`): its own plan later. `AIRTABLE_API_KEY` and
  `AIRTABLE_BASE_ID` stay as repository secrets because that workflow reads
  them (`AIRTABLE_EPISODES_BASE_ID: secrets.AIRTABLE_BASE_ID`); `pyairtable`
  stays in `requirements.txt` for the same reason.
- New things on the page (chapters, guests, `summary.md`, people links): phase
  2, listed at the end. This plan keeps the front matter identical so the
  200 diff proves the port.
- Rendering at Cloudflare build time, Hugo content adapters, Hugo modules:
  rejected in decision 1.
- Automatic dispatch from the episode store on push: phase 2.
- Any backfill or re-render of a range (decision 5): none. The owner
  re-triggers single episodes by hand when wanted.

## Facts (verified 2026-09-04)

1. What the site reads today: `scripts/publish_episode.py` +
   `scripts/podcast_post_hugo.md.j2`. Front matter keys the layouts use
   (`grep -rhoE '\.Params\.[a-zA-Z_]+' layouts`): `title`, `date`, `episode`,
   `tags`, `description`, `seo_keywords`, `youtube_id`, `youtube_url`,
   `youtube_embed_url`, `spotify_url`, `apple_id`, `duration`, `audio_url`,
   `og_landscape`, `og_square`, `intro`, `newsletter`, `links[].title/url`;
   the body is the transcript. `mailerlite-rss.xml` reads `newsletter`,
   `og_landscape`, the three platform urls.
2. The episode store: `data/episodes/NNN/episode.yaml` (+ `transcript.md`,
   `summary.md`, optional `newsletter.md`), `data/links/<slug>.yaml`
   (`url`, `title`, ...), `data/people/<slug>.yaml`, `data/tags.yaml`. Schema:
   `src/pato/schema/episode.py`. 201 episodes (1–200 published, 201
   scaffolded), 163 transcripts, 84 `newsletter.md`, 1699 links.
3. The store is PRIVATE (`gh repo view`: visibility PRIVATE, default branch
   `main`). The workflow needs a read credential.
4. Go-live mechanism, proven on 200: "Publish episode 200" commits landed
   2026-06-25 20:33 UTC and 2026-06-26 06:02 UTC; the page date is
   `2026-06-26T08:00:00+02:00`. Hugo does not build future-dated pages
   (`buildFuture` unset), so the auto-deploy on push renders without the
   episode and the Friday deploy hook rebuild includes it.
5. Cloudflare Pages (`cf-build-saved.png`, 2026-05-03): production branch
   `hugo`, build command `git fetch --unshallow 2>/dev/null || true; hugo
   --minify`, automatic deployments enabled, deploy hook `mcp` on `hugo`.
6. Transcript formats differ. Site body: `**Name**: text` paragraphs, no
   timestamps. Store `transcript.md`: a `# N.mp3` heading, then
   `[HH:MM:SS.ff] **Name:** text` paragraphs (colon inside the bold).
7. Transcript coverage differs. 14 episodes have a real transcript on the
   site (from Airtable) but no `transcript.md` in the store: 15, 21, 22, 23,
   29, 47, 48, 49, 51, 52, 53, 54, 55, 56. 7 episodes have `transcript.md` in
   the store but a placeholder on the site: 4, 5, 6, 7, 8, 9, 10. 30 site
   pages carry a placeholder body ("Pełna transkrypcja dostępna w pliku" or
   "AI jeszcze nie zdążyło przepisać tego odcinka").
8. `pato publish website <N>` dispatches the workflow, THEN writes
   `is_published: true`, and the operator commits and pushes `data/` after
   the command (README step 11). The workflow reads `main` HEAD, so at
   dispatch time the flag is never pushed yet; everything from steps 1–10 is
   (the README rule: lint, commit, push after every step).
9. Covers: the store holds public-read blob urls
   (`images.square`/`images.landscape`, png or jpg). The site serves
   `/img/N-square.webp` and `/img/N-landscape.webp`; `social-meta.html`,
   `episodes-list-schema.html` and `mailerlite-rss.xml` prefix
   `.Site.BaseURL`, so the path has to stay local.
10. Type deltas: `seo.keywords` is a list in the store, a comma-joined string
    on the site (`"a, b, c"`); `date` is a date, the site appends
    `T08:00:00+02:00`; `apple_id` on the site is the full `urls.apple`;
    `youtube_url` is derived from `ids.youtube`, never copied.
11. `links` in the store are slugs in website order; a slug resolves to
    `data/links/<slug>.yaml`. Placeholder titles exist (199:
    `⚠️ Manual Title Needed (wiki.c2.com)`) and are already on the site as-is.
12. Repository secrets today (`gh secret list`): `AIRTABLE_API_KEY`,
    `AIRTABLE_BASE_ID`, `AIRTABLE_NEWSLETTER_BASE_ID`, `CF_ACCOUNT_ID`,
    `CF_API_TOKEN`, `CF_PAGES_PROJECT`, `INDEXNOW_KEY`.
13. `scripts/podcast_post.md.j2` is dead (nothing references it);
    `scripts/backfill_spreaker.py` does not use Airtable.
14. Local Hugo: v0.165.0 extended.

## Decisions (owner; one recommended option each)

1. **Where the render runs.** DECIDED 2026-09-04: A.
   A) In `publish_podcast.yml` on dispatch, committing `content/episodes/N.md`
   and the webp files, as today (RECOMMENDED).
   B) At Cloudflare build time, regenerating every episode from a clone of
   the store.
   Why A: the IndexNow workflow diffs `content/episodes/**`; the go-live
   mechanism (fact 4) stays; every render is a reviewable git diff; no store
   credential on Cloudflare; a store outage cannot break a site build.
2. **Read access to the private store.** DECIDED 2026-09-04: A (PAT).
   A) A fine-grained PAT, repository `patoarchitekci/episodes`, permission
   Contents: read, as the secret `EPISODES_TOKEN` of this repository
   (RECOMMENDED; note the expiry date in this plan when created).
   B) A deploy key. C) Make the store public (`sources.notes` and
   `sources.teaser_video` are Drive links — not for the public).
3. **The flag and the dispatch order (fact 8).** DECIDED 2026-09-04: A
   ("when it gets the dispatch, it publishes, and that is it"). C stays
   here as a later option; nothing of it is built.
   The site never reads `is_published` (Airtable's flag was written by the
   site script and read by nobody there); the flag matters only to the
   store's lint and `pato episode next`. The real question is which store
   state the workflow renders: it checks out `main` on GitHub, and at
   dispatch time the flag write (after the dispatch) and any unpushed local
   change are not there.
   A) The workflow does not require the flag; the dispatch is the publish
   decision. It refuses only when the folder, `title` or `date` is missing;
   every other key falls back exactly as the Airtable script did (empty
   tags, empty description, placeholder transcript). Zero change in `pato`;
   `pato publish all` already gates completeness with the full lint. A
   forgotten push renders stale data, visible only through the sha in the
   run log and the commit message.
   B) `pato publish website` writes the flag, commits and pushes before the
   dispatch, and the workflow requires `is_published: true`. The CLI starts
   running git (pull, commit, push, the multi-session rules of the store's
   CLAUDE.md); a bigger change over there, and Hermes on the Pi runs the
   same code.
   C) A, plus a guard in `pato publish website` (T06): it refuses when the
   episode folder has uncommitted changes or when HEAD is not on
   `origin/main`, and it passes its HEAD sha as the workflow input
   `episodes_ref`; the workflow checks out exactly that sha, so an unpushed
   state fails loudly at checkout instead of rendering stale data. Read-only
   git calls, no commits by the CLI (recommended at the time; not taken).
   In every option the workflow gains the input `episodes_ref` (default
   `main`) and prints and commits the store sha it rendered.
4. **Transcript body.** DECIDED 2026-09-04: A. A) Normalize to the site's current form: drop the
   `# N.mp3` heading, drop the `[timestamp] ` prefix, `**Name:** ` →
   `**Name**: ` (RECOMMENDED — the 200 diff stays clean and re-rendered legacy
   pages stay identical). B) Keep timestamps (a visible change on every page;
   a layout decision, not a migration one).
5. **Backfill scope.** DECIDED 2026-09-04: no backfill of any range. The
   owner tests by hand, starting with episode 10, then re-triggers single
   episodes when wanted; 201 is the first new one. Episode 200 stays the
   local byte-identity check (a diff, never a commit). The 14 transcripts of
   fact 7 are not touched; the script still refuses to replace a real body
   with the placeholder unless `--allow-placeholder`, so a hand re-trigger
   of one of those 14 cannot lose a transcript.
6. **Front matter extras** (`chapters`, `guests`, `summary`). A) Not in this
   plan (RECOMMENDED; byte-identity first). B) Add now as unused keys.

## Design

| File | Change |
|---|---|
| `scripts/publish_episode.py` | Rewrite the source half: `--episodes-dir` (default `episodes/data`, the CI checkout path), `--episode-number`, `--no-images`, `--allow-placeholder`. Reads `episode.yaml`, `transcript.md`, `newsletter.md`, `links/<slug>.yaml`. Keeps: the Jinja render, control-character cleaning, ISO-8601 duration, the newsletter fallback (intro + `data/trainings` section), the blob → webp download. Drops: `pyairtable`, `python-dotenv`, the Airtable flag write. Prints the store sha (`git -C <dir> rev-parse HEAD`) when the dir is a checkout. |
| `scripts/podcast_post_hugo.md.j2` | Unchanged (goal: byte-identity). |
| `.github/workflows/publish_podcast.yml` | Second `actions/checkout@v6`: `repository: patoarchitekci/episodes`, `ref: ${{ inputs.episodes_ref }}`, `token: ${{ secrets.EPISODES_TOKEN }}`, `path: episodes`, `sparse-checkout: data`, `fetch-depth: 1`. New inputs `episodes_ref` (default `main`) and `dry_run` (boolean; render, validate, skip the commit). Airtable env removed. The YAML validation step stays. Commit message `Publish episode N (episodes@<sha7>)`. |
| `requirements.txt` | Unchanged (`pyairtable` stays for the newsletter script). |
| `scripts/podcast_post.md.j2` | Deleted (dead). |
| `docs/plan/001-episodes-repo-source.md` | This plan; decisions and the T02 delta list recorded. |
| Episode store (T06) | `commands/publish.py`: the docstring and the `website` pre-flight (`title`, `date` per decision 3A); README step 11 and the `publish website` row; `TODO.md` "Website switch" → done; `docs/site-fields.md` gets a "superseded by" line; its own `docs/plan/014-website-source.md` per that repository's rules. |

### Mapping: store → front matter

| Front matter | Store | Transform |
|---|---|---|
| `title` | `title` | `#N ` + title |
| `date` | `date` | + `T08:00:00+02:00` (as today; the winter-offset quirk is pre-existing) |
| `episode` | `episode_number` | string |
| `tags` | `seo.tags` | list; `[]` when absent |
| `description` | `seo.description` | `""` when absent |
| `seo_keywords` | `seo.keywords` | `", ".join(list)`; `""` when absent |
| `youtube_id` | `ids.youtube` | |
| `youtube_url` | `ids.youtube` | `https://www.youtube.com/watch?v=<id>` |
| `youtube_embed_url` | `ids.youtube` | `https://www.youtube.com/embed/<id>?enablejsapi=1` |
| `spotify_url` | `urls.spotify` | |
| `apple_id` | `urls.apple` | the full url, as today |
| `duration` | `audio.duration_ms` | ISO 8601 (`PT1H14M13S`) |
| `audio_url` | `audio.url` | |
| `og_landscape` / `og_square` | `images.landscape` / `images.square` | download the blob, save `/img/N-landscape.webp` / `/img/N-square.webp` (quality 85, overwritten on every run, as today); `--no-images` skips both |
| `intro` | `intro` | |
| `newsletter` | `newsletter.md` | file content; else intro + upcoming trainings (today's fallback) |
| `links` | `links[]` → `data/links/<slug>.yaml` | `{title, url}` in store order; a missing slug is a warning and is skipped |
| body | `transcript.md` | decision 4A; absent → "AI jeszcze nie zdążyło przepisać tego odcinka. Wracaj niedługo! 🤖" |

Not rendered (available for phase 2): `guests`, `chapters`, `summary.md`,
`social.*`, `sources.*`, `transcript.id`, `image_template_number`, `legacy`.

### Testing

- Unit-free by design (this repository has no test suite): the acceptance
  test is the diff. `python scripts/publish_episode.py --episodes-dir
  /Users/lukasz/tmp/experiments/podcast/data --episode-number 200 --no-images`
  then `git diff content/episodes/200.md`.
- `hugo --minify` builds locally after every render.
- Workflow: one `dry_run: true` dispatch of 10 (proves the token, the
  checkout, the render and the validation), then the real dispatch of 10
  (T05) — the commit is reviewed before anything else is triggered.
- First new episode: 201 on 2026-09-11 through `pato publish all 201`.

## Tasks

### T01 — Store credential and checkout (0.5 h)

- Create the PAT (decision 2A), add `EPISODES_TOKEN` to this repository,
  add the second checkout and the `episodes_ref` / `dry_run` inputs to the
  workflow with a temporary `ls episodes/data/episodes/200` step.
- Done: a `dry_run: true` dispatch lists `episode.yaml` of 200 in the run log.
  The PAT expiry date is written here.
- 2026-09-04: the workflow half is written (with T04, one file). OPEN on the
  owner's side: the PAT (github.com → Settings → Developer settings →
  Fine-grained tokens; resource owner `patoarchitekci`, repository
  `episodes` only, permission Contents: Read-only) and
  `gh secret set EPISODES_TOKEN -R patoarchitekci/patoarchitekci.github.io`.
  Expiry: ______ (fill in).

### T02 — The reader and the renderer (2 h)

- `scripts/publish_episode.py`: `load_episode`, `resolve_links`,
  `transcript_body`, `keywords`, `newsletter_text`; the CLI; the placeholder
  guard of decision 5.
- Done: the 200 render diffs empty against `content/episodes/200.md`, or the
  deltas are listed here with a verdict each (expected: the trailing space
  of 200's title, trimmed by the store; nothing else). `hugo --minify` green.
- DONE 2026-09-04. The 200 render (`--no-images`, store commit `de12af5`)
  differs from the page in exactly three ways, all accepted: (1) the title's
  trailing space, trimmed by the store; (2) 12 link urls lose their trailing
  slash (the store normalizes urls, rule R015 — the targets redirect);
  (3) the transcript: the Airtable copy carried a glitch for every guest and
  audience paragraph (`Mariusz Gil` on its own line, the text below it,
  32 paragraphs), the store's HappyScribe export has the proper
  `**Mariusz Gil**: ` — a fix, not a regression. Front matter, intro block,
  newsletter block and the body's ending are byte-identical. Episode 10
  previewed locally and reverted: the deltas listed in T05, plus one store
  defect found — the knative link's url lost its `#!` fragment in the
  store's normalization (recorded in the store's TODO). Local `hugo
  --minify` cannot run on this machine: Hugo 0.165 refuses the `tailwindcss`
  exec (`security.exec.allow`), on the untouched tree too — a local policy,
  not the pages; the Cloudflare build (Hugo pinned there) is the check.

### T03 — Covers from blob storage (0.5 h)

- The blob download replaces the Airtable attachment; webp conversion
  unchanged.
- Done: `--episode-number 200` with images writes both files; a visual check
  against the current ones (bytes will differ: a different source encoding).
- DONE 2026-09-04. Both covers of 200 downloaded from the blobs into a
  scratch directory and converted: `cmp` says byte-identical with
  `static/img/200-square.webp` and `static/img/200-landscape.webp` (same
  source file, same encoder) — risk 4 does not materialize for episodes whose
  Airtable attachment was the blob original.

### T04 — Workflow wiring (0.5 h)

- Airtable env removed; `--episodes-dir episodes/data`; the sha in the commit
  message; the `dry_run` branch of the commit step.
- Done: a `dry_run: true` dispatch of 10 is green end to end and prints the
  rendered front matter and the store sha in the run log; nothing committed.
- 2026-09-04: written (`.github/workflows/publish_podcast.yml`: second
  checkout with `sparse-checkout: data`, inputs `episodes_ref` and
  `dry_run`, "Store revision" and "Show the change" steps, commit message
  `Publish episode N (episodes@<sha7>)`, commit skipped on dry run). The
  dry-run dispatch waits for the secret (T01) and the push of this branch.

### T05 — Live test on episode 10 (0.5 h, owner's choice)

- `pato publish website 10` (or a hand dispatch) for real. Expected diff of
  `content/episodes/10.md` against today: the transcript replaces the
  placeholder (store has `transcript.md`); `youtube_url` becomes the watch
  url (today it holds the embed url); `spotify_url` and `apple_id` appear;
  the two links come in store order (today the site lists them reversed);
  the trailing space of the title goes; `tags`, `description` and
  `seo_keywords` stay empty (no `seo` in the store for 10). Covers:
  re-encoded from the blobs (two binary changes).
- Done: the commit is on `hugo`, IndexNow pinged `/10/`, the page shows the
  transcript after the next deploy; the deltas above are confirmed here.

### T06 — Episode store side (0.5 h)

- `commands/publish.py` (docstring, pre-flight), README, TODO,
  `docs/site-fields.md`, plan 014 there; `uv run ruff check . && uv run pytest`
  green.
- Done: `grep -n "Airtable" src/pato/commands/publish.py` names only history.
- DONE 2026-09-04 (edits in the clone, not committed — the owner commits):
  the two docstrings, README step 11, TODO ("Website switch" done + the
  knative link defect), `docs/site-fields.md` superseded note,
  `docs/plan/014-website-source.md`. Ruff clean, 859 tests passed.

### T07 — Cleanup (0.5 h)

- Delete `scripts/podcast_post.md.j2`; drop the Airtable env from
  `publish_podcast.yml` only (the secrets stay for the newsletter workflow).
- Done: `git grep -l airtable -- scripts .github` lists only
  `publish_newsletter.py` and `publish_newsletter.yml`.
- DONE 2026-09-04: the dead template deleted, the Airtable env gone from
  `publish_podcast.yml`, `requirements.txt` unchanged.

### T08 — First real episode (2026-09-11)

- `pato publish all 201` → the workflow → the Friday `pato publish cloudflare`.
- Done: `https://patoarchitekci.io/201/` shows the page; the result is
  recorded here and in the store's README "State".

Total: about 5 h of work plus the Friday check.

## Risks

1. 14 legacy pages lose their transcript if 1–179 are re-rendered before the
   import of fact 7 — guarded by decision 5 and the `--allow-placeholder`
   refusal.
2. A render of stale store data (fact 8) when the operator dispatches before
   pushing — visible: the run log and the commit name the store sha.
3. PAT expiry: the checkout fails loudly with 401/404; the fix is the secret.
4. Cover bytes differ from today's webp files for every re-rendered episode
   (a different source file, re-encoded on every run as today); visually
   identical; a hand re-trigger therefore always commits two binaries.
5. Keyword and title normalization on legacy episodes shows up only when a
   legacy episode is re-triggered by hand (episode 10 in T05); new episodes
   are unaffected.

## Phase 2 (not in this plan; separate decisions)

- Chapters on the episode page and in Schema.org `hasPart`; guests with
  their `data/people` links; `summary.md` on the page or in `llms.txt`.
- A workflow in the episode store that dispatches this one on a push that
  sets `is_published: true`.
- The newsletter pipeline off Airtable.
- Import the 14 Airtable-era transcripts into the store (fact 7); a
  re-render of old episodes only if the owner ever wants one (decision 5
  says none now).
