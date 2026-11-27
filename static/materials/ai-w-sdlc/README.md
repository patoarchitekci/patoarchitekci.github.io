# /materials/ai-w-sdlc - recap of the webinar "AI w SDLC: proces, nie narzędzie"

Static page. Hugo does not generate it; Hugo copies `static/` as it is.

URL: `https://patoarchitekci.io/materials/ai-w-sdlc/`

## Files

- `index.html` - the page.
- `materials.css` - the styles. Generated, do not edit by hand.
- `patoarchitekci.svg` - the logo used in the header.
- Episode covers come from `/img/<number>-square.webp`.

## Source

The source lives outside this repository, in `~/Desktop/7n/build/`:

- `recap.tpl.html` - the template to edit.
- `build_site.py` - writes this folder: `python3 build_site.py ~/Desktop/7n <this repository>`.

## Indexing

The page has `noindex, follow` and is not in `layouts/sitemap.xml`.
To make it public for search engines, change the robots meta tag in `build_site.py`
and add the URL to the static block of `layouts/sitemap.xml`.
