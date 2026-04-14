# /konferencja · Konferencja Pato #200

Statyczna strona landing page konferencji. **Nie jest generowana przez Hugo** —
to czyste HTML + CSS + vanilla JS, serwowane bezpośrednio z `/static/konferencja/`.

URL: `https://patoarchitekci.io/konferencja/` (Hugo kopiuje zawartość `static/`
bez przetwarzania).

## Struktura

```
static/konferencja/
├── index.html          ← strona
├── konferencja.css     ← skompilowany Tailwind v4 (do NIEEDYTOWANIA ręcznie)
├── pato-graphics/      ← SVG: fale, kształty, hero.png
├── pato-logo/          ← logo Patoarchitekci (SVG, różne warianty)
├── logo/               ← logo Protopia (SVG, różne warianty)
└── README.md
```

## Źródło

Pliki źródłowe do edycji żyją poza Hugo w:

```
/Users/lukasz/tmp/experiments/tailwind-brandings/
├── konferencja.html    ← źródło HTML
├── pato.css            ← Tailwind v4 @theme z tokenami brandu
└── ...
```

## Jak zregenerować CSS

Tailwind v4 ma natywny CLI. Potrzebne tylko node + npx (zero setupu).

```bash
cd /Users/lukasz/tmp/experiments/tailwind-brandings

# Jednorazowy build → skopiuj do static/konferencja
npx @tailwindcss/cli \
  -i ./pato.css \
  -o /Users/lukasz/tmp/experiments/pato-tickets/patoarchitekci.github.io/static/konferencja/konferencja.css \
  --minify
```

Albo watch mode podczas edycji:

```bash
npx @tailwindcss/cli -i ./pato.css -o ./pato-dist.css --watch
```

## Jak zaktualizować całą stronę (HTML + CSS + grafiki)

```bash
cd /Users/lukasz/tmp/experiments/tailwind-brandings

TARGET=/Users/lukasz/tmp/experiments/pato-tickets/patoarchitekci.github.io/static/konferencja

npx @tailwindcss/cli -i ./pato.css -o "$TARGET/konferencja.css" --minify
cp konferencja.html "$TARGET/index.html"
sed -i '' 's|./pato-dist.css|./konferencja.css|g' "$TARGET/index.html"
cp -R pato-graphics "$TARGET/"
cp -R pato-logo "$TARGET/"
cp -R logo "$TARGET/"
```

## Integracja z `/api/tickets-left`

Strona robi async `fetch('/api/tickets-left')` przy załadowaniu i aktualizuje
wszystkie `<span data-tickets-left>` na podstawie odpowiedzi JSON. Oczekiwany
format:

```json
{ "remaining": 99 }
```

(obsługiwane też `tickets_left` i `left` jako klucze alternatywne).

Jeśli API nie odpowiada → pozostaje statyczny fallback **99** wpisany w HTML.
Brak akcji przy błędzie (silent fail).

API endpoint: `functions/api/tickets-left.js` (Cloudflare Pages function).

## Aktualizacja danych sesji / prelegentów

JSON z sesjami i prelegentami jest w `<script id="session-data" type="application/json">`
wewnątrz `index.html`. Edytuj bezpośrednio — nie wymaga rebuildu CSS, tylko
kopia HTML.
