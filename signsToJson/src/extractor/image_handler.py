"""Image handling module for saving and managing sign language images."""

import logging
import re
from pathlib import Path
from typing import List, Optional

from PIL import Image
import io

from .pdf_processor import ImageBlock

logger = logging.getLogger(__name__)


class ImageHandler:
    """Handles saving and organizing sign language images."""

    def __init__(self, output_dir: str):
        """
        Initialize image handler.

        Args:
            output_dir: Base directory for saving images
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Image output directory: {self.output_dir}")

    def normalize_glosa_for_filename(self, glosa: str) -> str:
        """
        Normalize glosa for use in filename.

        Examples:
            "ABANDONAR" -> "abandonar"
            "ABRIR-CAJÓN" -> "abrir_cajon"
            "A-VECES" -> "a_veces"
            "BUENOS-DÍAS" -> "buenos_dias"

        Args:
            glosa: Original glosa string

        Returns:
            Normalized filename-safe string
        """
        # Convert to lowercase
        normalized = glosa.lower()

        # Replace hyphens with underscores
        normalized = normalized.replace('-', '_')

        # Replace forward slashes with underscores
        normalized = normalized.replace('/', '_')

        # Remove accents
        replacements = {
            'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
            'ñ': 'n', 'ü': 'u'
        }
        for accented, plain in replacements.items():
            normalized = normalized.replace(accented, plain)

        # Remove any other non-alphanumeric characters except underscores
        normalized = re.sub(r'[^a-z0-9_]', '', normalized)

        return normalized

    def get_image_filename(
        self,
        glosa: str,
        sequence_order: int,
        extension: str,
        variant_number: int = 1
    ) -> str:
        """
        Generate semantic filename for image.

        Examples:
            get_image_filename("ABANDONAR", 0, "jpeg") -> "abandonar_0.jpeg"
            get_image_filename("ABANICO", 0, "jpeg") -> "abanico_0.jpeg"
            get_image_filename("ABANICO", 1, "jpeg") -> "abanico_1.jpeg"
            get_image_filename("ACUARIO", 0, "jpeg", 2) -> "acuario_v2_0.jpeg"

        Args:
            glosa: Original glosa
            sequence_order: Order in sequence (0, 1, 2...)
            extension: File extension (without dot)
            variant_number: Variant number (default 1)

        Returns:
            Filename string
        """
        normalized = self.normalize_glosa_for_filename(glosa)

        # Ensure extension doesn't have leading dot
        ext = extension.lstrip('.')

        # Add variant number if not 1
        if variant_number > 1:
            return f"{normalized}_v{variant_number}_{sequence_order}.{ext}"

        return f"{normalized}_{sequence_order}.{ext}"

    def get_relative_path(
        self,
        glosa: str,
        sequence_order: int,
        extension: str,
        variant_number: int = 1,
        organize_by_letter: bool = True
    ) -> str:
        """
        Get relative path for image (including subdirectory organization).

        Args:
            glosa: Original glosa
            sequence_order: Order in sequence
            extension: File extension
            variant_number: Variant number
            organize_by_letter: If True, organize into A/, B/, C/ subdirectories

        Returns:
            Relative path string
        """
        filename = self.get_image_filename(glosa, sequence_order, extension, variant_number)

        if organize_by_letter:
            # Get first letter for subdirectory
            first_letter = glosa[0].upper() if glosa else 'OTHER'
            return f"{first_letter}/{filename}"

        return filename

    def save_image(
        self,
        image_block: ImageBlock,
        glosa: str,
        sequence_order: int,
        variant_number: int = 1,
        organize_by_letter: bool = True
    ) -> str:
        """
        Save image to disk with semantic filename.

        Args:
            image_block: ImageBlock from PDF extraction
            glosa: Glosa for this sign
            sequence_order: Order in movement sequence
            variant_number: Variant number
            organize_by_letter: Organize into subdirectories by first letter

        Returns:
            Relative path to saved image
        """
        # Get relative path
        relative_path = self.get_relative_path(
            glosa, sequence_order, image_block.ext, variant_number, organize_by_letter
        )

        # Full path
        full_path = self.output_dir / relative_path

        # Create subdirectory if needed
        full_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            # Save image
            with open(full_path, 'wb') as f:
                f.write(image_block.image_bytes)

            logger.debug(f"Saved image: {relative_path}")
            return relative_path

        except Exception as e:
            logger.error(f"Error saving image {relative_path}: {e}")
            raise

    def save_images_for_entry(
        self,
        image_blocks: List[ImageBlock],
        glosa: str,
        variant_number: int = 1,
        organize_by_letter: bool = True
    ) -> List[str]:
        """
        Save all images for a single entry.

        Args:
            image_blocks: List of ImageBlock objects
            glosa: Glosa for this sign
            variant_number: Variant number
            organize_by_letter: Organize into subdirectories

        Returns:
            List of relative paths to saved images (in sequence order)
        """
        saved_paths = []

        # Sort images by vertical position (top to bottom)
        sorted_images = sorted(image_blocks, key=lambda img: img.y_position)

        for sequence_order, image_block in enumerate(sorted_images):
            try:
                path = self.save_image(
                    image_block, glosa, sequence_order, variant_number, organize_by_letter
                )
                saved_paths.append(path)
            except Exception as e:
                logger.error(f"Failed to save image {sequence_order} for {glosa}: {e}")
                continue

        logger.info(f"Saved {len(saved_paths)} images for {glosa} (variant {variant_number})")
        return saved_paths

    def verify_image(self, image_path: str) -> bool:
        """
        Verify that an image file is valid and readable.

        Args:
            image_path: Relative path to image

        Returns:
            True if image is valid, False otherwise
        """
        full_path = self.output_dir / image_path

        if not full_path.exists():
            logger.warning(f"Image not found: {image_path}")
            return False

        try:
            with Image.open(full_path) as img:
                img.verify()
            return True
        except Exception as e:
            logger.error(f"Invalid image {image_path}: {e}")
            return False

    def get_image_dimensions(self, image_path: str) -> Optional[tuple[int, int]]:
        """
        Get dimensions of an image.

        Args:
            image_path: Relative path to image

        Returns:
            Tuple of (width, height) or None if error
        """
        full_path = self.output_dir / image_path

        try:
            with Image.open(full_path) as img:
                return img.size
        except Exception as e:
            logger.error(f"Error reading image dimensions {image_path}: {e}")
            return None

    def cleanup_empty_directories(self) -> None:
        """Remove empty subdirectories in output directory."""
        for subdir in self.output_dir.iterdir():
            if subdir.is_dir() and not any(subdir.iterdir()):
                subdir.rmdir()
                logger.info(f"Removed empty directory: {subdir.name}")
