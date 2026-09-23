# /hal9000 · HAL9000 session page

A static page that shows one HAL9000 Discord thread: the participants, the questions, the agent steps, the answers and the sources. Hugo does **not** generate it. It is plain HTML + CSS + vanilla JS, served as is from `/static/hal9000/`.

URL: `https://patoarchitekci.io/hal9000/?id=<thread_id>&t=<message_id>`

- `id`: the Discord thread id (15–22 digits). Any other value shows "Nie ma takiej sesji".
- `t` (optional): the message id of one turn. The page highlights that turn and scrolls to it.
- `sample=1` (dev aid, only on localhost): loads `./sample.json` instead of the blob.

The page has `noindex, nofollow`. The session file is public to anyone who has the thread id.

## Structure

```
static/hal9000/
├── index.html        ← the page (markup + inline JS)
├── hal9000.src.css   ← Tailwind input: imports pato.css + page CSS
├── hal9000.css       ← compiled Tailwind v4 (do NOT edit by hand)
├── sample.json       ← hal9000/1 example for ?sample=1
└── README.md
```

Brand graphics (logo, cloud wave, shapes) are loaded from `/konferencja/pato-logo/` and `/konferencja/pato-graphics/`.

## Data source

The page fetches `https://patodeepresearch.blob.core.windows.net/hal9000/<id>.json` with `cache: "no-store"`. HAL9000 writes this file after each answer. The file format is `hal9000/1`: see Appendix B of `docs/plan/self-hosted/004-hal9000-v2.md` in the pato-knowledge workspace.

The page needs the container to allow public blob read and CORS `GET` from `https://patoarchitekci.io`.

If the file is missing (404), or `t` is given and no turn has that `message_id`, the page shows "Zapisuję sesję…" and tries again every 3 s for 60 s. After that it shows "Sesja jeszcze się nie zapisała — odśwież za chwilę". If a file was found, it also shows the turns that are already saved.

Security: every string in the JSON is untrusted user text. Plain fields go in with `textContent`. The Markdown answer goes through `marked` and then `DOMPurify` (`<img>` is removed; links get `target=_blank rel=noopener noreferrer`). Source links must be `https:`. Discord ids stay strings (JavaScript numbers lose precision on 64-bit ids).

Libraries (pinned, with SRI): `marked@18.0.14`, `dompurify@3.4.16` from cdn.jsdelivr.net.

## How to rebuild the CSS

Rebuild after you add or change Tailwind classes in `index.html`. Tailwind v4 CLI; you need only node + npx. The brand tokens come from `/Users/lukasz/tmp/experiments/tailwind-brandings/pato.css` (read-only; `hal9000.src.css` imports it by a relative path, so the two repositories must stay side by side).

```bash
cd /Users/lukasz/tmp/experiments/pato-knowledge/patoarchitekci.github.io/static/hal9000
npx @tailwindcss/cli -i ./hal9000.src.css -o ./hal9000.css --minify
```

Run it from this folder: Tailwind scans the current folder for classes, and `hal9000.src.css` also adds `@source "./index.html"`.

## Local preview

```bash
cd /Users/lukasz/tmp/experiments/pato-knowledge/patoarchitekci.github.io
python3 -m http.server -d static 8765
# http://localhost:8765/hal9000/?id=1395038920126894143&sample=1
```
