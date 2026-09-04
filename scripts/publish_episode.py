#!/usr/bin/env python3
"""Render one episode page of patoarchitekci.io from the episode store.

The store is a checkout of github.com/patoarchitekci/episodes (plan 001,
docs/plan/001-episodes-repo-source.md): `data/episodes/NNN/episode.yaml`,
`transcript.md`, the optional `newsletter.md`, and `data/links/<slug>.yaml`.
The output is `content/episodes/N.md` (front matter plus the transcript as
the body, template `podcast_post_hugo.md.j2`) and the two covers
`static/img/N-square.webp` and `static/img/N-landscape.webp`, converted from
the store's blob urls.

Usage (from the repository root):

    python scripts/publish_episode.py --episode-number 200 --episodes-dir episodes/data

The dispatch of the workflow is the publish decision (plan 001, decision 3):
the script never reads `is_published`. It refuses only an episode without a
folder, a title or a date; every other key falls back the way the Airtable
script did (empty tags, empty description, the transcript placeholder).
"""

from __future__ import annotations

import argparse
import datetime
import glob
import logging
import os
import re
import subprocess
import sys
from io import BytesIO
from pathlib import Path

import requests
import yaml
from jinja2 import Environment, FileSystemLoader
from PIL import Image

# --- Configuration ---
STORE_DIR_DEFAULT = "episodes/data"  # the workflow's checkout of the episode store
POSTS_DIR = "content/episodes"  # Hugo episodes directory (relative to repo root)
ASSETS_IMG_DIR = "static/img"  # Hugo static assets directory (relative to repo root)
TRAININGS_DIR = "data/trainings"  # Hugo trainings data directory (relative to repo root)
TEMPLATE_FILENAME = "podcast_post_hugo.md.j2"

TRANSCRIPT_PLACEHOLDER = "AI jeszcze nie zdążyło przepisać tego odcinka. Wracaj niedługo! 🤖"
# Every placeholder body a page ever carried; a real transcript is anything else.
KNOWN_PLACEHOLDERS = (TRANSCRIPT_PLACEHOLDER, "Pełna transkrypcja dostępna w pliku")

# --- Logging Setup ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)


# --- Store readers ---
def episode_dir(store: Path, episode_number: int) -> Path:
    """The folder of one episode: `episodes/<NNN>/`, zero-padded to three digits."""
    return store / "episodes" / f"{episode_number:03d}"


def read_yaml(path: Path) -> dict:
    """One YAML mapping; an empty file is an empty mapping."""
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data if isinstance(data, dict) else {}


def read_text(path: Path) -> str | None:
    """The content of a text file, or None when the file does not exist."""
    if not path.is_file():
        return None
    return path.read_text(encoding="utf-8")


def load_episode(store: Path, episode_number: int) -> dict | None:
    """The `episode.yaml` of one episode, checked for the keys the render cannot do without."""
    path = episode_dir(store, episode_number) / "episode.yaml"
    if not path.is_file():
        logger.error(f"Episode {episode_number} not found in the store: {path}")
        return None
    try:
        episode = read_yaml(path)
    except yaml.YAMLError as e:
        logger.error(f"Invalid YAML in {path}: {e}")
        return None
    if episode.get("episode_number") != episode_number:
        logger.error(
            f"{path}: episode_number {episode.get('episode_number')!r} is not {episode_number}"
        )
        return None
    for key in ("title", "date"):
        if not episode.get(key):
            logger.error(f"{path}: no {key}; the render needs it")
            return None
    logger.info(f"Loaded episode {episode_number}: {episode['title']}")
    return episode


def resolve_links(store: Path, slugs: list | None) -> list[dict]:
    """The `{title, url}` of every link slug, in store order (= website order)."""
    links = []
    for slug in slugs or []:
        path = store / "links" / f"{slug}.yaml"
        if not path.is_file():
            logger.warning(f"Link {slug!r} has no file at {path}; skipped.")
            continue
        try:
            link = read_yaml(path)
        except yaml.YAMLError as e:
            logger.warning(f"Link {slug!r}: invalid YAML ({e}); skipped.")
            continue
        title, url = link.get("title"), link.get("url")
        if title and url:
            links.append({"title": title, "url": url})
        else:
            logger.warning(f"Link {slug!r} misses title or url; skipped.")
    logger.info(f"Resolved {len(links)} of {len(slugs or [])} links.")
    return links


def store_revision(store: Path) -> str | None:
    """The short commit of the store checkout, when the directory is inside a git repository."""
    try:
        result = subprocess.run(
            ["git", "-C", str(store), "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return None
    return result.stdout.strip() or None


# --- Transcript ---
# `[HH:MM:SS.ff] ` at the start of a paragraph (the HappyScribe export).
_TIMESTAMP = re.compile(r"^\[\d{2}:\d{2}:\d{2}(?:\.\d+)?\][ \t]*", re.MULTILINE)
# `**Name:** ` at the start of a paragraph; the site's form is `**Name**: `.
_SPEAKER = re.compile(r"^\*\*([^*\n]+?):\*\*[ \t]*", re.MULTILINE)


def transcript_body(text: str) -> str:
    """The store's `transcript.md` in the form the site pages carry.

    Drops the `# N.mp3` heading and the timestamp of every paragraph, moves
    the speaker's colon outside the bold (`**Name:** ` -> `**Name**: `), and
    ends the text with exactly one newline (the shape of the Airtable value
    the template was written for).
    """
    text = text.replace("\r\n", "\n")
    if text.startswith("# "):
        text = text.split("\n", 1)[1] if "\n" in text else ""
    text = _TIMESTAMP.sub("", text)
    text = _SPEAKER.sub(r"**\1**: ", text)
    text = text.strip()
    return text + "\n" if text else ""


def existing_body(path: Path) -> str:
    """The body of an already published page, without its front matter; "" when absent."""
    text = read_text(path)
    if text is None:
        return ""
    m = re.match(r"^---\n.*?\n---\n", text, re.DOTALL)
    return text[m.end():].strip() if m else text.strip()


def is_placeholder(body: str) -> bool:
    """Whether a page body is one of the placeholders, or empty."""
    return body.strip() in KNOWN_PLACEHOLDERS or not body.strip()


# --- File Operations ---
def save_markdown_file(content: str, episode_number: int) -> str | None:
    """Saves the markdown content to the correct file in the content/episodes directory."""
    try:
        filename = f"{episode_number}.md"  # Hugo format: just episode number
        filepath = os.path.join(POSTS_DIR, filename)
        logger.info(f"Saving markdown file to: {filepath}")
        os.makedirs(POSTS_DIR, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        logger.info("Markdown file saved successfully.")
        return filepath
    except Exception as e:
        logger.error(f"Error saving markdown file: {e}", exc_info=True)
        return None


def download_and_save_image(
    image_url: str | None, target_dir: str, base_filename: str, quality: int = 85
) -> str | None:
    """Downloads a cover from its blob url, converts it to WebP, and saves it."""
    if not image_url:
        logger.warning(f"No image url for '{base_filename}'. Skipping download.")
        return None

    filename = f"{base_filename}.webp"
    filepath = os.path.join(target_dir, filename)
    try:
        logger.info(
            f"Downloading image from {image_url} and converting to WebP: {filepath}..."
        )
        os.makedirs(target_dir, exist_ok=True)

        response = requests.get(image_url, timeout=60)
        response.raise_for_status()

        with Image.open(BytesIO(response.content)) as img:
            # Convert RGBA/P mode to RGB for WebP compatibility
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            img.save(filepath, format="WEBP", quality=quality, optimize=True)

        logger.info(f"Image '{filename}' converted to WebP and saved successfully.")
        return filepath
    except requests.exceptions.RequestException as e:
        logger.error(f"Error downloading image {image_url}: {e}", exc_info=False)
        return None
    except Exception as e:
        logger.error(f"Error processing image {image_url} to {filepath}: {e}", exc_info=True)
        return None


# --- Markdown Generation ---
def clean_control_characters(text: str) -> str:
    """Remove control characters that cause YAML parsing issues."""
    if not text:
        return text
    # Remove control characters except tab, LF, CR
    return "".join(char for char in text if ord(char) >= 32 or char in "\t\n\r")


def prose(text: str | None) -> str:
    """A multi-line text field for the template: cleaned, ending with exactly one newline.

    The `intro: |` and `newsletter: |` blocks of the template were written
    for Airtable values that ended with a newline; the store trims its prose.
    """
    if not text or not text.strip():
        return ""
    return clean_control_characters(text).rstrip("\n") + "\n"


def convert_duration_to_iso8601(duration_ms: int) -> str:
    """Converts duration from milliseconds to ISO 8601 format (PT1H23M45S)."""
    if not duration_ms or duration_ms <= 0:
        return ""

    total_seconds = int(duration_ms / 1000)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60

    duration_parts = ["PT"]
    if hours > 0:
        duration_parts.append(f"{hours}H")
    if minutes > 0:
        duration_parts.append(f"{minutes}M")
    if seconds > 0 or (hours == 0 and minutes == 0):
        duration_parts.append(f"{seconds}S")

    return "".join(duration_parts)


POLISH_MONTHS_GENITIVE = [
    "", "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
    "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
]


def format_date_polish(d: datetime.date) -> str:
    """Formats a date as '13 kwietnia 2026'."""
    return f"{d.day} {POLISH_MONTHS_GENITIVE[d.month]} {d.year}"


def load_upcoming_trainings(max_count: int = 3) -> list[dict]:
    """Loads training YAML files and returns upcoming active trainings sorted by date."""
    today = datetime.date.today()
    trainings = []

    yaml_files = glob.glob(os.path.join(TRAININGS_DIR, "*.yaml"))
    for filepath in yaml_files:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
            if not data or not data.get("active", False):
                continue
            if data.get("waitlist_only", False):
                continue
            if data.get("hidden", False):
                continue

            dates = data.get("dates", [])
            future_dates = []
            for d in dates:
                if isinstance(d, str):
                    d = datetime.date.fromisoformat(d)
                if isinstance(d, datetime.date) and d > today:
                    future_dates.append(d)

            if not future_dates:
                continue

            data["_earliest_date"] = min(future_dates)
            data["_all_future_dates"] = sorted(future_dates)
            trainings.append(data)
        except Exception as e:
            logger.warning(f"Error reading training file {filepath}: {e}")
            continue

    trainings.sort(key=lambda t: t["_earliest_date"])
    result = trainings[:max_count]
    logger.info(f"Found {len(result)} upcoming trainings (from {len(yaml_files)} files)")
    return result


def format_trainings_section(trainings: list[dict]) -> str:
    """Formats upcoming trainings as a markdown section for the newsletter."""
    if not trainings:
        return ""

    lines = [
        "",
        "---",
        "",
        "### 🎓 Najbliższe szkolenia",
        "",
        "Kod: \\*\\*{$promo_code}\\*\\* - taniej o {$promo_discount}%!",
        "",
    ]

    for t in trainings:
        training_id = t.get("id", "")
        title = t.get("title", "")
        instructor = t.get("instructor", "")
        time_str = t.get("time", "")
        description_list = t.get("description", [])
        short_desc = description_list[0] if description_list else ""

        future_dates = t.get("_all_future_dates", [])
        if len(future_dates) == 1:
            date_str = format_date_polish(future_dates[0])
        else:
            date_str = f"{format_date_polish(future_dates[0])} - {format_date_polish(future_dates[-1])}"

        lines.append(f"#### {title}")
        lines.append(f"**Prowadzący:** {instructor}")
        lines.append(f"**Termin:** {date_str} | {time_str}")
        lines.append("")
        lines.append(short_desc)
        lines.append("")
        lines.append(
            f"[Szczegóły i zapisy →]"
            f"(https://patoarchitekci.io/szkolenia/{training_id}/?promo={{$promo_code}})"
        )
        lines.append("")

    lines.append(
        "[Zobacz pełną ofertę szkoleń →]"
        "(https://patoarchitekci.io/szkolenia/?promo={$promo_code})"
    )

    return "\n".join(lines)


def render_markdown(context: dict) -> str | None:
    """Renders the Markdown content using the Jinja template file and context."""
    logger.info(f"Rendering Markdown template from '{TEMPLATE_FILENAME}'...")
    try:
        script_dir = os.path.dirname(__file__)
        env = Environment(
            loader=FileSystemLoader(script_dir), trim_blocks=True, lstrip_blocks=True
        )
        template = env.get_template(TEMPLATE_FILENAME)
        rendered_content = template.render(context)
        logger.info("Markdown template rendered successfully.")
        return rendered_content
    except Exception as e:
        logger.error(f"Error rendering Markdown template: {e}", exc_info=True)
        return None


def build_context(store: Path, episode: dict, transcript: str | None, newsletter: str | None) -> dict:
    """The template context of one episode: the store's keys in the shape the template reads."""
    episode_number = episode["episode_number"]
    ids = episode.get("ids") or {}
    urls = episode.get("urls") or {}
    audio = episode.get("audio") or {}
    seo = episode.get("seo") or {}

    date = episode["date"]
    if isinstance(date, (datetime.date, datetime.datetime)):
        date = date.isoformat()[:10]

    fields: dict = {
        "episode_number": episode_number,
        "title": clean_control_characters(str(episode["title"])),
        "date": date,
        "intro": prose(episode.get("intro")),
        "spotify_url": urls.get("spotify") or "",
        "apple_id": urls.get("apple") or "",
        "audio_url": audio.get("url") or "",
        "links": resolve_links(store, episode.get("links")),
    }

    youtube_id = ids.get("youtube") or ""
    fields["youtube_id"] = youtube_id
    if youtube_id:
        fields["youtube_embed_url"] = f"https://www.youtube.com/embed/{youtube_id}?enablejsapi=1"
        fields["youtube_url"] = f"https://www.youtube.com/watch?v={youtube_id}"
        logger.info(f"Created YouTube URLs for ID: {youtube_id}")
    else:
        fields["youtube_url"] = ""
        logger.warning("No ids.youtube in episode data")

    if fields["spotify_url"]:
        logger.info(f"Found Spotify URL: {fields['spotify_url']}")
    else:
        logger.warning("No urls.spotify in episode data")
    if fields["apple_id"]:
        logger.info(f"Found Apple URL: {fields['apple_id']}")
    else:
        logger.warning("No urls.apple in episode data")

    duration_ms = audio.get("duration_ms")
    fields["duration_iso"] = convert_duration_to_iso8601(duration_ms) if duration_ms else ""
    if fields["duration_iso"]:
        logger.info(f"Converted duration: {duration_ms}ms -> {fields['duration_iso']}")
    else:
        logger.warning("No audio.duration_ms in episode data")

    if transcript and transcript.strip():
        fields["transcription"] = clean_control_characters(transcript_body(transcript))
    else:
        fields["transcription"] = TRANSCRIPT_PLACEHOLDER
        logger.info("No transcript.md in the store, using the placeholder text.")

    if newsletter and newsletter.strip():
        fields["newsletter"] = prose(newsletter)
        logger.info("newsletter.md found (multiline content preserved)")
    elif fields["intro"]:
        # Fallback: the intro plus the upcoming trainings, as before the switch.
        # `intro` ends with a newline and the section opens with one, so the
        # `---` rule lands after a blank line and never becomes a heading.
        trainings_section = format_trainings_section(load_upcoming_trainings(max_count=3))
        fields["newsletter"] = prose(fields["intro"] + trainings_section)
        logger.info("No newsletter.md - using intro + trainings as fallback")
    else:
        fields["newsletter"] = ""
        logger.info("No newsletter.md and no intro in episode data")

    keywords = seo.get("keywords") or []
    if isinstance(keywords, list):
        keywords = ", ".join(str(k) for k in keywords)
    tags = seo.get("tags") or []
    logger.info(f"Extracted {len(tags)} tags from seo.")

    return {
        "episode": fields,
        "tags": [str(t) for t in tags],
        "seo_description": seo.get("description") or "",
        "seo_keywords": str(keywords),
    }


# --- Main Execution ---
def main():
    """Main function to publish a podcast episode."""
    parser = argparse.ArgumentParser(
        description="Render a podcast episode page from the episode store."
    )
    parser.add_argument(
        "--episode-number", type=int, required=True, help="The episode number to publish."
    )
    parser.add_argument(
        "--episodes-dir",
        default=STORE_DIR_DEFAULT,
        help=f"The `data/` directory of the episode store checkout (default: {STORE_DIR_DEFAULT}).",
    )
    parser.add_argument(
        "--no-images", action="store_true", help="Skip downloading and processing images."
    )
    parser.add_argument(
        "--allow-placeholder",
        action="store_true",
        help="Replace an existing transcript on the page with the placeholder when the store has none.",
    )
    args = parser.parse_args()
    episode_number = args.episode_number
    store = Path(args.episodes_dir)

    logger.info(f"Starting publishing process for episode #{episode_number}...")

    # 1. The store
    if not (store / "episodes").is_dir():
        logger.error(f"No episode store at {store} (expected {store / 'episodes'}).")
        sys.exit(1)
    revision = store_revision(store)
    logger.info(f"Episode store: {store} (commit {revision or 'unknown'})")

    # 2. Read the episode
    episode = load_episode(store, episode_number)
    if not episode:
        sys.exit(1)
    folder = episode_dir(store, episode_number)
    transcript = read_text(folder / "transcript.md")
    newsletter = read_text(folder / "newsletter.md")

    # 3. The placeholder guard: never lose a transcript the page already has
    page_path = Path(POSTS_DIR) / f"{episode_number}.md"
    if not (transcript and transcript.strip()):
        body = existing_body(page_path)
        if body and not is_placeholder(body) and not args.allow_placeholder:
            logger.error(
                f"Episode {episode_number} has no transcript.md in the store, but {page_path} "
                f"holds a transcript; refusing to replace it with the placeholder "
                f"(re-run with --allow-placeholder to do it anyway)."
            )
            sys.exit(1)

    # 4. Covers (before the render; the template reads the paths)
    if not args.no_images:
        images = episode.get("images") or {}
        square_filepath = download_and_save_image(
            images.get("square"), ASSETS_IMG_DIR, f"{episode_number}-square"
        )
        landscape_filepath = download_and_save_image(
            images.get("landscape"), ASSETS_IMG_DIR, f"{episode_number}-landscape"
        )
    else:
        square_filepath = landscape_filepath = None
        logger.info("Skipping image download (--no-images flag set).")

    # 5. Render
    context = build_context(store, episode, transcript, newsletter)
    if square_filepath:
        context["episode"]["og_square_path"] = f"/img/{os.path.basename(square_filepath)}"
    if landscape_filepath:
        context["episode"]["og_landscape_path"] = f"/img/{os.path.basename(landscape_filepath)}"

    markdown_content = render_markdown(context)
    if not markdown_content:
        logger.error("Failed to render markdown content. Exiting.")
        sys.exit(1)

    # 6. Save
    if not save_markdown_file(markdown_content, episode_number):
        logger.error("Failed to save markdown file. Exiting.")
        sys.exit(1)

    logger.info(
        f"Successfully processed episode #{episode_number} from store commit {revision or 'unknown'}."
    )


if __name__ == "__main__":
    main()
