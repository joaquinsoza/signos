"""
CLI tool for extracting Chilean Sign Language (LSCh) dictionary data from PDFs.

This tool processes PDF dictionaries, extracts sign images and metadata,
and stores them in a PostgreSQL database with multi-language support.
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import List, Optional

from .models import Dictionary, ExtractionResult, ExtractedEntry
from .extractor import PDFProcessor, EntryParser, ImageHandler
from .extractor.entry_splitter import EntrySplitter
from .database import SignRepository


def setup_logging(log_level: str = "INFO", log_file: Optional[str] = None) -> None:
    """
    Configure logging.

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR)
        log_file: Optional log file path
    """
    handlers = [logging.StreamHandler(sys.stdout)]

    if log_file:
        handlers.append(logging.FileHandler(log_file))

    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=handlers
    )


def extract_from_pdf(
    pdf_path: str,
    output_dir: str,
    start_page: int,
    end_page: Optional[int],
    dictionary: Dictionary
) -> ExtractionResult:
    """
    Extract dictionary entries from a PDF.

    Args:
        pdf_path: Path to PDF file
        output_dir: Directory for saving images
        start_page: First page to process (1-indexed)
        end_page: Last page to process (1-indexed)
        dictionary: Dictionary metadata

    Returns:
        ExtractionResult with all extracted entries
    """
    logger = logging.getLogger(__name__)
    logger.info(f"Starting extraction from {pdf_path}")

    result = ExtractionResult(dictionary=dictionary)

    # Initialize components
    parser = EntryParser()
    image_handler = ImageHandler(output_dir)
    splitter = EntrySplitter()

    # Process PDF
    with PDFProcessor(pdf_path, start_page, end_page) as processor:
        page_entries = processor.process_all_pages()

        logger.info(f"Processing {len(page_entries)} page entries")

        for page_entry in page_entries:
            try:
                full_text = page_entry.full_text

                # Split combined entries by GLOSA detection
                split_entries = splitter.split_by_glosas(full_text)

                if not split_entries:
                    result.add_error(
                        page_entry.page_num + 1,
                        "No glosas found in text",
                        full_text[:100]
                    )
                    continue

                logger.info(f"Split into {len(split_entries)} entries from page {page_entry.page_num + 1}")

                # Distribute images using text-region method (most accurate)
                # This finds where each GLOSA appears in the PDF and creates regions
                entries_with_images = splitter.distribute_images_by_text_regions(
                    split_entries,
                    page_entry.images,
                    page_entry.text_blocks
                )

                # Process each split entry with its assigned images
                for split_entry, entry_images in entries_with_images:
                    # Parse the individual entry (pass known glosa from splitter)
                    parsed_entry = parser.parse_entry(
                        split_entry.text,
                        page_entry.page_num + 1,
                        known_glosa=split_entry.glosa
                    )

                    if not parsed_entry:
                        logger.warning(f"Failed to parse entry: {split_entry.glosa}")
                        result.add_error(
                            page_entry.page_num + 1,
                            f"Failed to parse {split_entry.glosa}",
                            split_entry.text[:100]
                        )
                        continue

                    # Save images
                    if entry_images:
                        image_paths = image_handler.save_images_for_entry(
                            entry_images,
                            parsed_entry.glosa,
                            parsed_entry.variant_number
                        )
                        parsed_entry.image_paths = image_paths
                    else:
                        logger.warning(f"No images assigned for {parsed_entry.glosa}")

                    result.add_entry(parsed_entry)

            except Exception as e:
                logger.error(f"Error processing entry on page {page_entry.page_num + 1}: {e}", exc_info=True)
                result.add_error(page_entry.page_num + 1, str(e))

    logger.info(f"Extraction complete: {result.successful} successful, {result.failed} failed")
    return result


def save_to_database(
    result: ExtractionResult,
    repository: SignRepository,
    target_language: str = "es"
) -> None:
    """
    Save extraction results to database.

    Args:
        result: ExtractionResult with entries
        repository: SignRepository instance
        target_language: Target language code
    """
    logger = logging.getLogger(__name__)
    logger.info("Saving entries to database")

    # Create/get dictionary
    dict_id = repository.create_dictionary(result.dictionary)
    result.dictionary.id = dict_id

    # Convert entries to Sign models
    signs = [
        entry.to_sign(dict_id, target_language)
        for entry in result.entries
    ]

    # Bulk create signs
    created_count = repository.bulk_create_signs(signs)
    logger.info(f"Saved {created_count} signs to database")


def save_preview_json(result: ExtractionResult, output_path: str) -> None:
    """
    Save extraction result as JSON for preview/validation.

    Args:
        result: ExtractionResult
        output_path: Path to JSON output file
    """
    logger = logging.getLogger(__name__)

    output = {
        "dictionary": result.dictionary.model_dump(exclude_none=True),
        "total_entries": result.total_entries,
        "successful": result.successful,
        "failed": result.failed,
        "validation_report": result.get_validation_report(),
        "entries": [
            entry.model_dump(exclude_none=True)
            for entry in result.entries[:100]  # Limit to first 100 for preview
        ],
        "sample_errors": result.errors[:20]  # First 20 errors
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    logger.info(f"Saved preview JSON to {output_path}")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Extract Chilean Sign Language dictionary data from PDFs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run with preview
  python -m src.extract_lsch --pdf pdfs/dict.pdf --output-dir output/images \\
    --language-code lsch --region Metropolitan --dry-run --preview-output output/preview.json

  # Full extraction with database storage
  python -m src.extract_lsch --pdf pdfs/dict1.pdf --pdf pdfs/dict2.pdf \\
    --output-dir output/images --language-code lsch --start-page 6

  # Custom page range
  python -m src.extract_lsch --pdf pdfs/dict.pdf --output-dir output/images \\
    --language-code lsch --start-page 6 --end-page 50
        """
    )

    # Required arguments
    parser.add_argument(
        '--pdf',
        type=str,
        action='append',
        required=True,
        help='PDF file path(s) - can specify multiple times'
    )
    parser.add_argument(
        '--output-dir',
        type=str,
        required=True,
        help='Output directory for extracted images'
    )

    # Dictionary metadata
    parser.add_argument(
        '--language-code',
        type=str,
        default='lsch',
        help='Language code (default: lsch)'
    )
    parser.add_argument(
        '--language-name',
        type=str,
        default='Lengua de Señas Chilena',
        help='Language name (default: Lengua de Señas Chilena)'
    )
    parser.add_argument(
        '--target-language',
        type=str,
        default='es',
        help='Target spoken language (default: es)'
    )
    parser.add_argument(
        '--region',
        type=str,
        default='Metropolitan',
        help='Region (default: Metropolitan)'
    )
    parser.add_argument(
        '--version',
        type=str,
        help='Dictionary version'
    )

    # Processing options
    parser.add_argument(
        '--start-page',
        type=int,
        default=6,
        help='First page to process (1-indexed, default: 6)'
    )
    parser.add_argument(
        '--end-page',
        type=int,
        help='Last page to process (1-indexed, default: all pages)'
    )

    # Output options
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Extract without saving to database'
    )
    parser.add_argument(
        '--preview-output',
        type=str,
        help='Path to save JSON preview file'
    )
    parser.add_argument(
        '--log-file',
        type=str,
        help='Path to log file'
    )
    parser.add_argument(
        '--log-level',
        type=str,
        default='INFO',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        help='Logging level (default: INFO)'
    )

    # Database options
    parser.add_argument(
        '--db-host',
        type=str,
        default=os.getenv('DB_HOST', 'localhost'),
        help='Database host (default: from DB_HOST env or localhost)'
    )
    parser.add_argument(
        '--db-port',
        type=int,
        default=int(os.getenv('DB_PORT', 5432)),
        help='Database port (default: from DB_PORT env or 5432)'
    )
    parser.add_argument(
        '--db-name',
        type=str,
        default=os.getenv('DB_NAME', 'signos_db'),
        help='Database name (default: from DB_NAME env or signos_db)'
    )
    parser.add_argument(
        '--db-user',
        type=str,
        default=os.getenv('DB_USER', 'signos'),
        help='Database user (default: from DB_USER env or signos)'
    )
    parser.add_argument(
        '--db-password',
        type=str,
        default=os.getenv('DB_PASSWORD', ''),
        help='Database password (default: from DB_PASSWORD env)'
    )

    args = parser.parse_args()

    # Setup logging
    setup_logging(args.log_level, args.log_file)
    logger = logging.getLogger(__name__)

    # Create dictionary metadata
    dictionary = Dictionary(
        language_code=args.language_code,
        language_name=args.language_name,
        target_language=args.target_language,
        region=args.region,
        version=args.version
    )

    # Process each PDF
    all_results = []
    for pdf_path in args.pdf:
        logger.info(f"Processing PDF: {pdf_path}")

        try:
            result = extract_from_pdf(
                pdf_path,
                args.output_dir,
                args.start_page,
                args.end_page,
                dictionary
            )
            all_results.append(result)

        except Exception as e:
            logger.error(f"Failed to process {pdf_path}: {e}", exc_info=True)
            continue

    # Merge results
    if not all_results:
        logger.error("No PDFs were successfully processed")
        sys.exit(1)

    merged_result = all_results[0]
    for result in all_results[1:]:
        merged_result.entries.extend(result.entries)
        merged_result.errors.extend(result.errors)
        merged_result.successful += result.successful
        merged_result.failed += result.failed
        merged_result.total_entries += result.total_entries

    # Print validation report
    report = merged_result.get_validation_report()
    logger.info("=" * 60)
    logger.info("EXTRACTION SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Total entries: {report['total_entries']}")
    logger.info(f"Successful: {report['successful']}")
    logger.info(f"Failed: {report['failed']}")
    logger.info(f"Success rate: {report['success_rate']}")
    logger.info(f"Entries without images: {report['entries_without_images']}")
    logger.info(f"Entries without definition: {report['entries_without_definition']}")
    logger.info(f"Entries without translations: {report['entries_without_translations']}")
    if report['duplicate_glosas']:
        logger.warning(f"Duplicate glosas found: {len(report['duplicate_glosas'])}")
    logger.info("=" * 60)

    # Save preview JSON if requested
    if args.preview_output:
        save_preview_json(merged_result, args.preview_output)

    # Save to database unless dry-run
    if not args.dry_run:
        logger.info("Connecting to database...")

        # Test connection
        repository = SignRepository(
            host=args.db_host,
            port=args.db_port,
            database=args.db_name,
            user=args.db_user,
            password=args.db_password
        )

        if not repository.test_connection():
            logger.error("Failed to connect to database")
            sys.exit(1)

        # Save to database
        try:
            save_to_database(merged_result, repository, args.target_language)

            # Log extraction run
            repository.log_extraction(
                dictionary_id=merged_result.dictionary.id,
                pdf_filename=", ".join(args.pdf),
                total_entries=merged_result.total_entries,
                successful_entries=merged_result.successful,
                failed_entries=merged_result.failed,
                start_page=args.start_page,
                end_page=args.end_page or 0,
                errors=merged_result.errors
            )

            logger.info("✓ Successfully saved to database")

        except Exception as e:
            logger.error(f"Failed to save to database: {e}", exc_info=True)
            sys.exit(1)
    else:
        logger.info("Dry-run mode: skipping database storage")

    logger.info("Extraction complete!")


if __name__ == '__main__':
    main()
