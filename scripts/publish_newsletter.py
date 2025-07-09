#!/usr/bin/env python3

import argparse
import datetime
import logging
import os
import sys

from dotenv import load_dotenv
from jinja2 import Environment, FileSystemLoader
from pyairtable import Api
import requests

# --- Configuration ---
load_dotenv()

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
    
    return {
        'url': fields.get('Link', ''),
        'name': fields.get('Link_Name', ''),
        'comment': fields.get('Link_Comment', ''),
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

    logger.info(f"Successfully processed newsletter #{args.newsletter_id}.")

if __name__ == "__main__":
    main()