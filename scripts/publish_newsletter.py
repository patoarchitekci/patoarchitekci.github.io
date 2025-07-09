#!/usr/bin/env python3

import argparse
import datetime
import logging
import os
import random
import re
import sys

from dotenv import load_dotenv
from jinja2 import Environment, FileSystemLoader
from pyairtable import Api
import requests

# --- Configuration ---
load_dotenv()
# Also try to load from .env.local for local testing
load_dotenv('.env.local')

AIRTABLE_API_KEY = os.getenv("AIRTABLE_API_KEY")
AIRTABLE_NEWSLETTER_BASE_ID = os.getenv("AIRTABLE_NEWSLETTER_BASE_ID")
AIRTABLE_EPISODES_BASE_ID = os.getenv("AIRTABLE_EPISODES_BASE_ID")
NEWSLETTER_TABLE_NAME = os.getenv("NEWSLETTER_TABLE_NAME", "Newsletter")
LINK_TABLE_NAME = os.getenv("LINK_TABLE_NAME", "Link")
EPISODES_TABLE_NAME = os.getenv("EPISODES_TABLE_NAME", "episodes")

# --- Logging Setup ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

# --- Utility Functions ---
def get_week_number(date_str):
    """Zwraca numer tygodnia w roku dla danej daty"""
    date = datetime.datetime.strptime(date_str, '%Y-%m-%d')
    return date.isocalendar()[1]

def determine_link_order(date_str):
    """Określa kolejność linków na podstawie parzystości tygodnia"""
    week_num = get_week_number(date_str)
    if week_num % 2 == 0:  # Parzysty tydzień
        return ['lukasz', 'szymon']
    else:  # Nieparzysty tydzień
        return ['szymon', 'lukasz']

def get_random_emoji():
    """Zwraca losowe emoji dla social media post"""
    emojis = ["🔗", "📝", "🚀", "💡", "🎯", "🛠️", "📊", "🌟", "🔥", "⚡", "🎨", "📱", "💻", "🔧", "📚"]
    return random.choice(emojis)

# --- Airtable Functions ---
def fetch_newsletter_data(api: Api, newsletter_id: int) -> dict | None:
    """Pobiera dane newsletter z bazy newsletterów"""
    logger.info(f"Fetching newsletter data for ID {newsletter_id}...")
    try:
        newsletter_table = api.table(AIRTABLE_NEWSLETTER_BASE_ID, NEWSLETTER_TABLE_NAME)
        formula = f"{{Id}} = {newsletter_id}"
        
        newsletter_record = newsletter_table.first(formula=formula)
        
        if not newsletter_record:
            logger.error(f"Newsletter {newsletter_id} not found in Airtable.")
            return None
            
        logger.info(f"Successfully fetched newsletter data for ID {newsletter_id}")
        return newsletter_record
    except Exception as e:
        logger.error(f"Error fetching newsletter data: {e}", exc_info=True)
        return None

def fetch_episode_data_for_recommendation(api: Api, episode_number: int) -> dict | None:
    """Pobiera dane odcinka z głównej bazy dla poleceń"""
    if not episode_number:
        return None
        
    logger.info(f"Fetching episode data for recommendation: {episode_number}")
    try:
        episode_table = api.table(AIRTABLE_EPISODES_BASE_ID, EPISODES_TABLE_NAME)
        formula = f"{{episode_number}} = {episode_number}"
        
        episode_record = episode_table.first(formula=formula)
        
        if not episode_record:
            logger.warning(f"Episode {episode_number} not found in episodes base.")
            return None
            
        logger.info(f"Successfully fetched episode data for {episode_number}")
        return episode_record
    except Exception as e:
        logger.error(f"Error fetching episode data: {e}", exc_info=True)
        return None

def fetch_link_data(api: Api, link_id: str) -> dict | None:
    """Pobiera dane pojedynczego linku"""
    if not link_id:
        return None
        
    logger.info(f"Fetching link data for ID {link_id}")
    try:
        link_table = api.table(AIRTABLE_NEWSLETTER_BASE_ID, LINK_TABLE_NAME)
        link_record = link_table.get(link_id)
        
        if not link_record:
            logger.warning(f"Link {link_id} not found.")
            return None
            
        return link_record
    except Exception as e:
        logger.error(f"Error fetching link data: {e}", exc_info=True)
        return None

def fix_airtable_paragraphs(text):
    """Naprawia paragrafy z Airtable - dodaje puste linie między paragrafami"""
    if not text:
        return text
    
    # Normalizuj line breaks
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    
    # Podziel na linie
    lines = text.split('\n')
    result = []
    
    for i, line in enumerate(lines):
        # Sprawdź czy trzeba dodać pustą linię PRZED obecną linią
        if i > 0 and line.strip():
            prev_line = lines[i-1].strip()
            
            # Dodaj pustą linię przed bullet points jeśli poprzednia linia nie była pusta
            if (line.startswith('• ') or line.startswith('- ')) and prev_line and not prev_line.endswith(':'):
                if result and result[-1] != '':
                    result.append('')
            
            # Dodaj pustą linię przed bold text jeśli poprzednia linia nie była pusta i nie kończy się dwukropkiem i nie jest nagłówkiem
            elif line.startswith('**') and prev_line and not prev_line.endswith(':') and not prev_line.startswith('#'):
                if result and result[-1] != '':
                    result.append('')
        
        result.append(line)
        
        # Dodaj pustą linię po każdej niepustej linii, jeśli następna linia też nie jest pusta
        if line.strip() and i < len(lines) - 1 and lines[i + 1].strip():
            next_line = lines[i + 1].strip()
            
            # NIE dodawaj pustej linii przed headingami, listami, cytatami, bold text
            if not (next_line.startswith('#') or next_line.startswith('*') or 
                   next_line.startswith('-') or next_line.startswith('•') or
                   next_line.startswith('>')):
                result.append('')
    
    return '\n'.join(result)

def fetch_links_data(api: Api, lukasz_link_ids: list, szymon_link_ids: list) -> dict:
    """Pobiera dane linków dla Łukasza i Szymona"""
    links = {'lukasz': None, 'szymon': None}
    
    # Pobierz link Łukasza
    if lukasz_link_ids:
        links['lukasz'] = fetch_link_data(api, lukasz_link_ids[0])
    
    # Pobierz link Szymona
    if szymon_link_ids:
        links['szymon'] = fetch_link_data(api, szymon_link_ids[0])
    
    return links

# --- File Operations ---
NEWSLETTERS_DIR = "_newsletters"
ASSETS_IMG_DIR = "assets/img/mail"
SOCIAL_POSTS_DIR = "_social_posts"

def download_and_save_image(attachment_list: list, target_dir: str, base_filename: str) -> str | None:
    """Pobiera obrazek z Airtable i zapisuje z nazwą YYYY-MM-DD-person.ext"""
    if not attachment_list or not isinstance(attachment_list, list):
        logger.info(f"No attachment data for '{base_filename}'. Skipping download.")
        return None
        
    try:
        attachment_data = attachment_list[0]
        image_url = attachment_data.get('url')
        airtable_filename = attachment_data.get('filename')

        if not image_url:
            logger.warning(f"No URL in attachment data for '{base_filename}'.")
            return None

        # Określ rozszerzenie
        if airtable_filename:
            file_extension = os.path.splitext(airtable_filename)[-1]
        else:
            file_extension = os.path.splitext(image_url.split('?')[0])[-1]
            if file_extension not in ['.jpg', '.jpeg', '.png', '.gif']:
                file_extension = '.jpg'
            
        if not file_extension.startswith('.'):
            file_extension = '.' + file_extension
            
        filename = f"{base_filename}{file_extension}"
        filepath = os.path.join(target_dir, filename)

        logger.info(f"Downloading image from {image_url} to {filepath}...")
        
        os.makedirs(target_dir, exist_ok=True)

        response = requests.get(image_url, stream=True)
        response.raise_for_status()

        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                
        logger.info(f"Image '{filename}' saved successfully.")
        return filepath
        
    except Exception as e:
        logger.error(f"Error downloading image: {e}", exc_info=True)
        return None

def process_link_data(link_record: dict, person: str, newsletter_date: str) -> dict | None:
    """Przetwarza dane linku i pobiera obrazek"""
    if not link_record:
        return None
        
    fields = link_record.get('fields', {})
    
    # Pobierz obrazek jeśli istnieje
    image_attachment = fields.get('Link_Image', [])
    image_path = None
    image_ext = None
    
    if image_attachment:
        image_filename = f"{newsletter_date}-{person}"
        image_path = download_and_save_image(image_attachment, ASSETS_IMG_DIR, image_filename)
        if image_path:
            image_ext = os.path.splitext(image_path)[-1][1:]  # bez kropki
    
    comment = fields.get('Link_Comment', '')
    logger.info(f"RAW Link_Comment from Airtable:\n{repr(comment)}")
    
    # Napraw paragrafy z Airtable
    comment_fixed = fix_airtable_paragraphs(comment)
    logger.info(f"FIXED Link_Comment:\n{repr(comment_fixed)}")
    
    return {
        'url': fields.get('Link', ''),
        'name': fields.get('Link_Name', ''),
        'comment': comment_fixed,
        'image_path': image_path,
        'image_ext': image_ext
    }

def save_markdown_file(content: str, newsletter_fields: dict) -> str | None:
    """Zapisuje plik markdown newslettera"""
    try:
        newsletter_id = newsletter_fields.get('Id')
        newsletter_date = newsletter_fields.get('Date')
        
        if not newsletter_id or not newsletter_date:
            logger.error("Newsletter ID or date missing. Cannot determine filename.")
            return None

        filename = f"{newsletter_date}-{newsletter_id}.md"
        filepath = os.path.join(NEWSLETTERS_DIR, filename)

        logger.info(f"Saving newsletter file to: {filepath}")
        
        os.makedirs(NEWSLETTERS_DIR, exist_ok=True)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
            
        logger.info("Newsletter file saved successfully.")
        return filepath
    except Exception as e:
        logger.error(f"Error saving newsletter file: {e}", exc_info=True)
        return None

def clean_markdown_for_social(text: str) -> str:
    """Usuwa formatowanie markdown i dostosowuje do social media"""
    if not text:
        return text
    
    # Usuń bold/italic
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)  # **bold**
    text = re.sub(r'\*([^*]+)\*', r'\1', text)      # *italic*
    text = re.sub(r'_([^_]+)_', r'\1', text)        # _italic_
    
    # Usuń linki markdown [text](url) - zostaw tylko tekst
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    
    # Usuń nagłówki ### ## # ale dodaj puste linie przed i po
    text = re.sub(r'^(#{1,6}\s*)', r'\n\1', text, flags=re.MULTILINE)  # Dodaj pustą linię przed nagłówkiem
    text = re.sub(r'^#{1,6}\s*(.+)$', r'\1\n', text, flags=re.MULTILINE)  # Usuń # i dodaj pustą linię po
    
    # Zamień bullet points na emoji
    text = re.sub(r'^[-•]\s*', '🔸 ', text, flags=re.MULTILINE)
    
    # Usuń cytaty >
    text = re.sub(r'^>\s*', '', text, flags=re.MULTILINE)
    
    # Usuń podwójne puste linie
    text = re.sub(r'\n\n\n+', '\n\n', text)
    
    return text.strip()

def generate_social_posts(links: dict, newsletter_fields: dict) -> list:
    """Generuje posty do social media z linków newslettera"""
    posts = []
    newsletter_date = newsletter_fields.get('Date')
    newsletter_id = newsletter_fields.get('Id')
    
    if not newsletter_date or not newsletter_id:
        logger.error("Newsletter date or ID missing. Cannot generate social posts.")
        return posts
    
    for person, link_data in links.items():
        if not link_data:
            continue
            
        # Określ pełną nazwę osoby
        person_name = 'Łukasz' if person == 'lukasz' else 'Szymon'
        
        # Losowe emoji
        emoji = get_random_emoji()
        
        # Tytuł postu
        post_title = f"{emoji} {link_data['name']} od {person_name}"
        
        # Treść postu - tytuł + treść
        post_content = f"{emoji} {link_data['name']} od {person_name}\n\n"
        post_content += clean_markdown_for_social(link_data['comment'])
        post_content += f"\n\n🔗 {link_data['url']}"
        post_content += "\n\n📬 To fragment z ostatniego newslettera Patoarchitekci! Zapisz się na https://patoarchitekci.io/"
        
        # Dane postu
        post_data = {
            'title': post_title,
            'content': post_content,
            'date': newsletter_date,
            'person': person,
            'person_name': person_name,
            'newsletter_id': newsletter_id,
            'original_link': link_data['url'],
            'image_url': f"https://patoarchitekci.io/assets/img/mail/{newsletter_date}-{person}.{link_data['image_ext']}" if link_data['image_ext'] else None,
            'image_ext': link_data['image_ext']
        }
        
        posts.append(post_data)
        
    logger.info(f"Generated {len(posts)} social media posts")
    return posts

def save_social_posts(posts: list) -> list:
    """Zapisuje posty social media do plików markdown"""
    saved_files = []
    
    if not posts:
        logger.info("No social posts to save.")
        return saved_files
    
    os.makedirs(SOCIAL_POSTS_DIR, exist_ok=True)
    
    for i, post in enumerate(posts, 1):
        try:
            # Nazwa pliku: YYYY-MM-DD-newsletter-ID-person-N.md
            filename = f"{post['date']}-{post['newsletter_id']}-{post['person']}-{i}.md"
            filepath = os.path.join(SOCIAL_POSTS_DIR, filename)
            
            # Front matter
            front_matter = f"""---
layout: post
title: "{post['title']}"
date: {post['date']} 08:00:00 +0200
person: {post['person']}
person_name: {post['person_name']}
newsletter_id: {post['newsletter_id']}
original_link: {post['original_link']}
"""
            
            if post['image_url']:
                front_matter += f"""image_url: {post['image_url']}
image_ext: {post['image_ext']}
"""
            
            front_matter += "---\n\n"
            
            # Pełna treść pliku
            full_content = front_matter + post['content']
            
            logger.info(f"Saving social post to: {filepath}")
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(full_content)
                
            saved_files.append(filepath)
            logger.info(f"Social post saved: {filename}")
            
        except Exception as e:
            logger.error(f"Error saving social post {i}: {e}", exc_info=True)
            continue
    
    logger.info(f"Successfully saved {len(saved_files)} social posts")
    return saved_files

# --- Markdown Generation ---
TEMPLATE_FILENAME = "newsletter_post.md.j2"

def render_markdown(context: dict) -> str | None:
    """Renderuje template newslettera"""
    logger.info(f"Rendering newsletter template from '{TEMPLATE_FILENAME}'...")
    try:
        script_dir = os.path.dirname(__file__)
        env = Environment(
            loader=FileSystemLoader(script_dir), 
            trim_blocks=True, 
            lstrip_blocks=True
        )
        template = env.get_template(TEMPLATE_FILENAME)
        rendered_content = template.render(context)
        logger.info("Newsletter template rendered successfully.")
        return rendered_content
    except Exception as e:
        logger.error(f"Error rendering newsletter template: {e}", exc_info=True)
        return None

# --- Main Execution ---
def main():
    """Główna funkcja publikowania newslettera"""
    parser = argparse.ArgumentParser(description="Publish newsletter from Airtable to GitHub Pages.")
    parser.add_argument("--newsletter-id", type=int, required=True, help="Newsletter ID to publish.")
    args = parser.parse_args()

    logger.info(f"Starting newsletter publishing process for ID #{args.newsletter_id}...")

    # Walidacja konfiguracji
    if not all([AIRTABLE_API_KEY, AIRTABLE_NEWSLETTER_BASE_ID, AIRTABLE_EPISODES_BASE_ID]):
        logger.error("Missing required environment variables.")
        sys.exit(1)
    logger.info("Configuration loaded.")

    # Inicjalizacja klientów Airtable
    try:
        airtable_api = Api(AIRTABLE_API_KEY)
        logger.info("Airtable client initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize Airtable client: {e}", exc_info=True)
        sys.exit(1)

    # Pobierz dane newslettera
    newsletter_data = fetch_newsletter_data(airtable_api, args.newsletter_id)
    if not newsletter_data:
        sys.exit(1)
        
    newsletter_fields = newsletter_data.get('fields', {})
    newsletter_date = newsletter_fields.get('Date')
    
    # Loguj surowe dane richText z newslettera
    raw_intro = newsletter_fields.get('Intro', '')
    raw_episode_desc = newsletter_fields.get('Recommended_Episode_Description', '')
    
    logger.info(f"RAW Newsletter Intro from Airtable:\n{repr(raw_intro)}")
    logger.info(f"RAW Newsletter Recommended_Episode_Description from Airtable:\n{repr(raw_episode_desc)}")
    
    # Napraw paragrafy w polach newslettera
    newsletter_fields['Intro'] = fix_airtable_paragraphs(raw_intro)
    newsletter_fields['Recommended_Episode_Description'] = fix_airtable_paragraphs(raw_episode_desc)
    
    logger.info(f"FIXED Newsletter Intro:\n{repr(newsletter_fields['Intro'])}")
    logger.info(f"FIXED Newsletter Recommended_Episode_Description:\n{repr(newsletter_fields['Recommended_Episode_Description'])}")
    
    # Określ kolejność linków
    link_order = determine_link_order(newsletter_date)
    logger.info(f"Link order for {newsletter_date}: {link_order}")

    # Pobierz dane linków
    lukasz_link_ids = newsletter_fields.get('Link_Lukasz', [])
    szymon_link_ids = newsletter_fields.get('Link_Szymon', [])
    
    links_raw = fetch_links_data(airtable_api, lukasz_link_ids, szymon_link_ids)
    
    # Przetwórz dane linków i pobierz obrazki
    links = {}
    if links_raw['lukasz']:
        links['lukasz'] = process_link_data(links_raw['lukasz'], 'lukasz', newsletter_date)
    if links_raw['szymon']:
        links['szymon'] = process_link_data(links_raw['szymon'], 'szymon', newsletter_date)

    # Pobierz dane polecanego odcinka
    recommended_episode = None
    episode_number = newsletter_fields.get('Recommend_Episode')
    if episode_number:
        episode_data = fetch_episode_data_for_recommendation(airtable_api, episode_number)
        if episode_data:
            episode_fields = episode_data.get('fields', {})
            # Przygotuj linki do platform
            recommended_episode = {
                'episode_number': episode_fields.get('episode_number'),
                'title': episode_fields.get('title'),
                'spotify_url': episode_fields.get('spotify_url'),
                'apple_id': episode_fields.get('apple_id'),
                'youtube_url': episode_fields.get('youtube_url'),
                'spotify_id': episode_fields.get('spotify_id')
            }

    # Przygotuj kontekst dla template
    template_context = {
        "newsletter": newsletter_fields,
        "links": links,
        "link_order": link_order,
        "recommended_episode": recommended_episode,
        "site_url": "https://patoarchitekci.io"
    }

    # Renderuj markdown
    markdown_content = render_markdown(template_context)
    if not markdown_content:
        logger.error("Failed to render newsletter content.")
        sys.exit(1)
        
    # Zapisz plik
    markdown_filepath = save_markdown_file(markdown_content, newsletter_fields)
    if not markdown_filepath:
        logger.error("Failed to save newsletter file.")
        sys.exit(1)

    # Generuj posty social media
    social_posts = generate_social_posts(links, newsletter_fields)
    if social_posts:
        saved_social_files = save_social_posts(social_posts)
        logger.info(f"Generated {len(saved_social_files)} social media posts")

    logger.info(f"Successfully processed newsletter #{args.newsletter_id}.")

if __name__ == "__main__":
    main()