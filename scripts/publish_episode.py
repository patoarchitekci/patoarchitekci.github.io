#!/usr/bin/env python3

import argparse
import logging
import os
import sys

from dotenv import load_dotenv
from jinja2 import Environment, FileSystemLoader
from pyairtable import Api
import requests

# --- Configuration ---
# Load environment variables from .env file
load_dotenv()

AIRTABLE_API_KEY = os.getenv("AIRTABLE_API_KEY")
AIRTABLE_BASE_ID = os.getenv("AIRTABLE_BASE_ID")
EPISODES_TABLE_NAME = os.getenv("EPISODES_TABLE_NAME", "episodes")
LINKS_TABLE_NAME = os.getenv("LINKS_TABLE_NAME", "links")
TAGS_TABLE_NAME = os.getenv("TAGS_TABLE_NAME", "tags")
# Field name/ID for the checkbox indicating the episode is published
# It's recommended to use the Field ID (e.g., fld1kRM6VC3ouCqGi) for stability
IS_PUBLISHED_FIELD = os.getenv("IS_PUBLISHED_FIELD", "is_published")

# --- Logging Setup ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout) # Log to stdout
    ]
)

logger = logging.getLogger(__name__)

# --- Airtable Functions ---
def fetch_episode_data(api: Api, episode_number: int) -> dict | None:
    """Fetches the episode record from Airtable based on the episode number."""
    logger.info(f"Fetching data for episode {episode_number} from Airtable...")
    try:
        episode_table = api.table(AIRTABLE_BASE_ID, EPISODES_TABLE_NAME)
        # Assuming the field name in Airtable is exactly 'episode_number'
        formula = f"{{episode_number}} = {episode_number}"
        
        episode_record = episode_table.first(formula=formula)
        
        if not episode_record:
            logger.error(f"Episode {episode_number} not found in Airtable table '{EPISODES_TABLE_NAME}'.")
            return None
            
        logger.info(f"Successfully fetched data for episode: {episode_record['fields'].get('name', '[No Name]')}")
        return episode_record
    except Exception as e:
        logger.error(f"Error fetching episode data from Airtable: {e}", exc_info=True)
        return None

def fetch_linked_data(api: Api, table_name: str, record_ids: list[str], field_to_extract: str) -> list:
    """Fetches records from a specified table by IDs and extracts a given field."""
    if not record_ids:
        logger.info(f"No record IDs provided for table '{table_name}', skipping fetch.")
        return []

    logger.info(f"Fetching {len(record_ids)} linked records from table '{table_name}'...")
    extracted_data = []
    try:
        # Get the table object first
        target_table = api.table(AIRTABLE_BASE_ID, table_name)
        
        # Construct an OR formula to fetch records by ID
        # Formula: OR(RECORD_ID()='rec1', RECORD_ID()='rec2', ...)
        id_conditions = [f"RECORD_ID()='{rec_id}'" for rec_id in record_ids]
        formula = f"OR({ ', '.join(id_conditions) })"
        logger.debug(f"Using formula for fetching linked records: {formula}")

        # Use table.all() with the constructed formula
        records = target_table.all(formula=formula)
        
        if len(records) != len(record_ids):
             logger.warning(f"Fetched {len(records)} records, but {len(record_ids)} IDs were provided. Some records might be missing or duplicated in the result.")

        for record in records:
            try:
                if field_value := record.get('fields', {}).get(field_to_extract):
                    extracted_data.append(field_value)
                else:
                    logger.warning(f"Field '{field_to_extract}' not found or empty in record {record['id']} from table '{table_name}'.")
            except KeyError:
                 logger.warning(f"Record {record.get('id', '[Unknown ID]')} from '{table_name}' missing 'fields' key or field '{field_to_extract}'.")
                    
        logger.info(f"Successfully extracted '{field_to_extract}' field from {len(extracted_data)}/{len(record_ids)} linked records in '{table_name}'.")
        return extracted_data
        
    except Exception as e:
        logger.error(f"Error fetching linked data from Airtable table '{table_name}': {e}", exc_info=True)
        return [] # Return empty list on error to allow processing to potentially continue

def update_airtable_published_flag(api: Api, record_id: str):
    """Updates the 'is_published' flag for the given record ID in Airtable."""
    logger.info(f"Updating '{IS_PUBLISHED_FIELD}' flag for record {record_id}...")
    # if IS_PUBLISHED_FIELD == "is_published":
    #     logger.warning("Using default field name 'is_published'. Consider setting IS_PUBLISHED_FIELD env var to the actual Field ID for stability.")
    try:
        episode_table = api.table(AIRTABLE_BASE_ID, EPISODES_TABLE_NAME)
        episode_table.update(record_id, {IS_PUBLISHED_FIELD: True})
        logger.info(f"Successfully updated '{IS_PUBLISHED_FIELD}' flag for record {record_id}.")
        return True
    except Exception as e:
        logger.error(f"Error updating Airtable record {record_id}: {e}", exc_info=True)
        return False

# --- File Operations ---
POSTS_DIR = "_posts"
ASSETS_IMG_DIR = "assets/img"

def save_markdown_file(content: str, episode_fields: dict) -> str | None:
    """Saves the markdown content to the correct file in the _posts directory."""
    try:
        episode_number = episode_fields.get('episode_number')
        publish_date = episode_fields.get('date') # Expecting YYYY-MM-DD format
        
        if not episode_number or not publish_date:
            logger.error("Episode number or date missing in episode data. Cannot determine filename.")
            return None

        filename = f"{publish_date}-{episode_number}.md"
        # Assume the script is run from the repository root
        filepath = os.path.join(POSTS_DIR, filename)

        logger.info(f"Saving markdown file to: {filepath}")
        
        # Ensure the _posts directory exists
        os.makedirs(POSTS_DIR, exist_ok=True)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
            
        logger.info("Markdown file saved successfully.")
        return filepath
    except Exception as e:
        logger.error(f"Error saving markdown file: {e}", exc_info=True)
        return None

def download_and_save_image(attachment_list: list, target_dir: str, base_filename: str) -> str | None:
    """Downloads an image from an Airtable attachment field structure and saves it."""
    if not attachment_list or not isinstance(attachment_list, list):
        logger.warning(f"No attachment data provided or invalid format for '{base_filename}'. Skipping download.")
        return None
        
    try:
        # Airtable attachment field is a list, usually with one item for single attachments
        attachment_data = attachment_list[0]
        image_url = attachment_data.get('url')
        airtable_filename = attachment_data.get('filename')

        if not image_url:
            logger.warning(f"No URL found in attachment data for '{base_filename}'. Skipping download.")
            return None

        # Try to get extension from Airtable filename, otherwise parse URL or default
        if airtable_filename:
            file_extension = os.path.splitext(airtable_filename)[-1]
            logger.info(f"Using extension '{file_extension}' from Airtable filename '{airtable_filename}'.")
        else:
            logger.warning(f"No filename found in Airtable data for '{base_filename}'. Trying to parse URL.")
            file_extension = os.path.splitext(image_url.split('?')[0])[-1] 
            if not file_extension in ['.jpg', '.jpeg', '.png', '.gif']:
                logger.warning(f"Could not determine valid image extension for {base_filename} from URL. Defaulting to .jpg")
                file_extension = '.jpg'
            
        # Ensure extension starts with a dot
        if not file_extension.startswith('.'):
            file_extension = '.' + file_extension
            
        filename = f"{base_filename}{file_extension}"
        filepath = os.path.join(target_dir, filename)

        logger.info(f"Downloading image from {image_url} to {filepath}...")
        
        # Ensure the target directory exists
        os.makedirs(target_dir, exist_ok=True)

        response = requests.get(image_url, stream=True)
        response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)

        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                
        logger.info(f"Image '{filename}' saved successfully.")
        return filepath
        
    except (IndexError, TypeError, KeyError) as e:
        logger.error(f"Error parsing attachment data for '{base_filename}': {e}", exc_info=False)
        return None
    except requests.exceptions.RequestException as e:
        logger.error(f"Error downloading image {image_url}: {e}", exc_info=False)
        return None
    except Exception as e:
        # Add filepath to error message if it was defined
        err_filepath = filepath if 'filepath' in locals() else "target path"
        logger.error(f"Error saving image {image_url} to {err_filepath}: {e}", exc_info=True)
        return None

# --- Markdown Generation ---

TEMPLATE_FILENAME = "podcast_post.md.j2"

def render_markdown(context: dict) -> str | None:
    """Renders the Markdown content using the Jinja template file and context."""
    logger.info(f"Rendering Markdown template from '{TEMPLATE_FILENAME}'...")
    try:
        # Assuming the template file is in the same directory as the script
        script_dir = os.path.dirname(__file__)
        env = Environment(
            loader=FileSystemLoader(script_dir), 
            trim_blocks=True, 
            lstrip_blocks=True
        )
        template = env.get_template(TEMPLATE_FILENAME)
        rendered_content = template.render(context)
        logger.info("Markdown template rendered successfully.")
        return rendered_content
    except Exception as e:
        logger.error(f"Error rendering Markdown template: {e}", exc_info=True)
        return None

# --- Main Execution --- 
def main():
    """Main function to publish a podcast episode."""
    parser = argparse.ArgumentParser(description="Publish a podcast episode from Airtable to GitHub Pages.")
    parser.add_argument("--episode-number", type=int, required=True, help="The episode number to publish.")
    args = parser.parse_args()

    logger.info(f"Starting publishing process for episode #{args.episode_number}...")

    # 1. Validate Configuration
    if not all([AIRTABLE_API_KEY, AIRTABLE_BASE_ID]):
        logger.error("Airtable API Key or Base ID not configured in environment variables.")
        sys.exit(1)
    logger.info("Configuration loaded.")

    # 2. Initialize Airtable Client
    try:
        airtable_api = Api(AIRTABLE_API_KEY)
        logger.info("Airtable client initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize Airtable client: {e}", exc_info=True)
        sys.exit(1)

    # 3. Fetch Data from Airtable
    episode_data = fetch_episode_data(airtable_api, args.episode_number)
    if not episode_data:
        sys.exit(1)
        
    episode_fields = episode_data.get('fields', {})
        
    # Fetch linked links (markdown field)
    link_ids = episode_fields.get('links', [])
    link_markdowns = fetch_linked_data(airtable_api, LINKS_TABLE_NAME, link_ids, 'markdown')
    # Combine link markdowns into a single string
    links_content = "\n\n".join(link_markdowns) # Separate links by double newline
    logger.info(f"Combined markdown content for {len(link_markdowns)} links.")

    # TODO: Fetch linked tags
    tag_ids = episode_fields.get('tags', [])
    tag_names = fetch_linked_data(airtable_api, TAGS_TABLE_NAME, tag_ids, 'Name') # Assuming the field is 'Name' based on blueprint analysis
    logger.info(f"Fetched {len(tag_names)} tag names.")

    # 4. Prepare Template Context
    template_context = {
        "episode": episode_fields,      # Pass the whole fields dictionary
        "links_markdown": links_content, # Pass the combined links string
        "tags": tag_names                # Pass the list of tag names
    }
    logger.info("Prepared context dictionary for Jinja template.")
    # Example: Access title in template via {{ episode.title }}

    # 5. Render Markdown
    markdown_content = render_markdown(template_context)
    if not markdown_content:
        logger.error("Failed to render markdown content. Exiting.")
        sys.exit(1)
        
    # 6. Save Files
    markdown_filepath = save_markdown_file(markdown_content, episode_fields)
    if not markdown_filepath:
        logger.error("Failed to save markdown file. Exiting.")
        sys.exit(1)
        
    generated_files = [markdown_filepath] # Start list of files for output
    
    # Download and save images
    episode_num = episode_fields.get('episode_number')
    if episode_num:
        # Square Image (og_square)
        og_square_list = episode_fields.get('og_square', [])
        square_filepath = download_and_save_image(og_square_list, ASSETS_IMG_DIR, f"{episode_num}-square")
        if square_filepath:
            generated_files.append(square_filepath)
        # Warning logged within download_and_save_image if og_square_list is empty/invalid

        # Portrait Image (og_portrait)
        og_portrait_list = episode_fields.get('og_portrait', [])
        portrait_filepath = download_and_save_image(og_portrait_list, ASSETS_IMG_DIR, f"{episode_num}-portrait")
        if portrait_filepath:
            generated_files.append(portrait_filepath)
        # Warning logged within download_and_save_image if og_portrait_list is empty/invalid
    else:
        logger.error("Cannot download images, episode number is missing.")
        

    # 7. Update Airtable
    update_airtable_published_flag(airtable_api, episode_data['id'])

    # 8. Output File Paths for GitHub Action
    print(" ".join(generated_files)) # Print paths space-separated

    logger.info(f"Successfully processed episode #{args.episode_number}.")

if __name__ == "__main__":
    main() 