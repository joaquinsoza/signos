"""PDF processing module for extracting images and text from sign language dictionaries."""

import logging
from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict, Any
from pathlib import Path

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)


@dataclass
class ImageBlock:
    """Represents an extracted image with position information."""

    xref: int  # Image reference in PDF
    bbox: Tuple[float, float, float, float]  # (x0, y0, x1, y1)
    image_bytes: bytes
    ext: str  # Image extension (png, jpeg, etc.)
    page_num: int

    @property
    def y_position(self) -> float:
        """Get vertical position (y0) for sorting."""
        return self.bbox[1]

    @property
    def height(self) -> float:
        """Get image height."""
        return self.bbox[3] - self.bbox[1]

    @property
    def width(self) -> float:
        """Get image width."""
        return self.bbox[2] - self.bbox[0]


@dataclass
class TextBlock:
    """Represents extracted text with position information."""

    text: str
    bbox: Tuple[float, float, float, float]  # (x0, y0, x1, y1)
    page_num: int

    @property
    def y_position(self) -> float:
        """Get vertical position (y0) for sorting."""
        return self.bbox[1]


@dataclass
class PageEntry:
    """Represents a single dictionary entry extracted from a page."""

    images: List[ImageBlock]
    text_blocks: List[TextBlock]
    page_num: int
    y_start: float  # Starting Y position
    y_end: float  # Ending Y position
    separators: List[float]  # Y positions of separators for this page

    @property
    def full_text(self) -> str:
        """Concatenate all text blocks."""
        return '\n'.join(tb.text for tb in sorted(self.text_blocks, key=lambda x: x.y_position))


class PDFProcessor:
    """Processes PDF files to extract images and text for sign language entries."""

    def __init__(self, pdf_path: str, start_page: int = 6, end_page: Optional[int] = None):
        """
        Initialize PDF processor.

        Args:
            pdf_path: Path to PDF file
            start_page: First page to process (1-indexed)
            end_page: Last page to process (inclusive, 1-indexed), None for all
        """
        self.pdf_path = Path(pdf_path)
        if not self.pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        self.doc = fitz.open(str(self.pdf_path))
        self.start_page = start_page - 1  # Convert to 0-indexed
        self.end_page = (end_page - 1) if end_page else (len(self.doc) - 1)

        logger.info(f"Loaded PDF: {self.pdf_path.name} ({len(self.doc)} pages)")
        logger.info(f"Processing pages {start_page} to {end_page or len(self.doc)}")

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()

    def close(self) -> None:
        """Close PDF document."""
        if self.doc:
            self.doc.close()

    def extract_images_from_page(self, page_num: int) -> List[ImageBlock]:
        """
        Extract all images from a page with position information.

        Args:
            page_num: Page number (0-indexed)

        Returns:
            List of ImageBlock objects
        """
        page = self.doc[page_num]
        images = []

        # Get list of images
        image_list = page.get_images(full=True)

        for img_index, img_info in enumerate(image_list):
            xref = img_info[0]

            try:
                # Get image bounding box
                rects = page.get_image_rects(xref)
                if not rects:
                    logger.warning(f"No bbox found for image xref {xref} on page {page_num + 1}")
                    continue

                bbox = rects[0]  # Use first rectangle

                # Extract image bytes
                base_image = self.doc.extract_image(xref)
                image_bytes = base_image["image"]
                ext = base_image["ext"]

                images.append(ImageBlock(
                    xref=xref,
                    bbox=(bbox.x0, bbox.y0, bbox.x1, bbox.y1),
                    image_bytes=image_bytes,
                    ext=ext,
                    page_num=page_num
                ))

            except Exception as e:
                logger.error(f"Error extracting image {xref} from page {page_num + 1}: {e}")
                continue

        logger.debug(f"Extracted {len(images)} images from page {page_num + 1}")
        return images

    def extract_text_from_page(self, page_num: int) -> List[TextBlock]:
        """
        Extract text blocks from a page with position information.

        Args:
            page_num: Page number (0-indexed)

        Returns:
            List of TextBlock objects
        """
        page = self.doc[page_num]
        text_blocks = []

        # Extract text with bounding boxes
        blocks = page.get_text("dict")["blocks"]

        for block in blocks:
            if block.get("type") != 0:  # Type 0 is text
                continue

            # Concatenate all lines in the block
            lines = []
            for line in block.get("lines", []):
                line_text = ""
                for span in line.get("spans", []):
                    line_text += span.get("text", "")
                lines.append(line_text)

            text = " ".join(lines).strip()
            if not text:
                continue

            bbox = block["bbox"]
            text_blocks.append(TextBlock(
                text=text,
                bbox=(bbox[0], bbox[1], bbox[2], bbox[3]),
                page_num=page_num
            ))

        logger.debug(f"Extracted {len(text_blocks)} text blocks from page {page_num + 1}")
        return text_blocks

    def detect_horizontal_lines(self, page_num: int, min_length: float = 100) -> List[float]:
        """
        Detect horizontal separator lines on a page.

        Args:
            page_num: Page number (0-indexed)
            min_length: Minimum line length to consider

        Returns:
            List of Y positions of horizontal lines
        """
        page = self.doc[page_num]
        horizontal_lines = []

        # Get all drawings/paths on the page
        paths = page.get_drawings()

        for path in paths:
            # Check if it's a horizontal line
            if path.get("type") == "l":  # Line type
                rect = path.get("rect")
                if rect:
                    x0, y0, x1, y1 = rect
                    # Check if it's horizontal (small y difference, large x difference)
                    if abs(y1 - y0) < 2 and abs(x1 - x0) > min_length:
                        y_pos = (y0 + y1) / 2
                        horizontal_lines.append(y_pos)

        # Also check for stroked rectangles that are thin horizontal lines
        for path in paths:
            if path.get("type") == "r":  # Rectangle
                rect = path.get("rect")
                if rect:
                    x0, y0, x1, y1 = rect
                    # Very thin horizontal rectangle
                    if abs(y1 - y0) < 5 and abs(x1 - x0) > min_length:
                        y_pos = (y0 + y1) / 2
                        horizontal_lines.append(y_pos)

        horizontal_lines = sorted(set(horizontal_lines))
        logger.debug(f"Detected {len(horizontal_lines)} horizontal lines on page {page_num + 1}")
        return horizontal_lines

    def group_into_entries(
        self,
        images: List[ImageBlock],
        text_blocks: List[TextBlock],
        separator_y_positions: List[float],
        page_num: int
    ) -> List[PageEntry]:
        """
        Group images and text blocks into dictionary entries using separators.

        Args:
            images: List of images from page
            text_blocks: List of text blocks from page
            separator_y_positions: Y positions of horizontal separator lines
            page_num: Page number for reference

        Returns:
            List of PageEntry objects
        """
        if not separator_y_positions:
            # No separators, treat entire page as one entry
            return [PageEntry(
                images=images,
                text_blocks=text_blocks,
                page_num=page_num,
                y_start=0,
                y_end=float('inf'),
                separators=[]
            )]

        entries = []
        separator_y_positions = sorted(separator_y_positions)

        # Add page boundaries
        y_boundaries = [0] + separator_y_positions + [float('inf')]

        for i in range(len(y_boundaries) - 1):
            y_start = y_boundaries[i]
            y_end = y_boundaries[i + 1]

            # Find images within this range
            entry_images = [
                img for img in images
                if y_start <= img.y_position < y_end
            ]

            # Find text blocks within this range
            entry_text_blocks = [
                tb for tb in text_blocks
                if y_start <= tb.y_position < y_end
            ]

            # Only create entry if there's content
            if entry_images or entry_text_blocks:
                entries.append(PageEntry(
                    images=entry_images,
                    text_blocks=entry_text_blocks,
                    page_num=page_num,
                    y_start=y_start,
                    y_end=y_end,
                    separators=separator_y_positions
                ))

        logger.debug(f"Grouped into {len(entries)} entries on page {page_num + 1}")
        return entries

    def process_page(self, page_num: int) -> List[PageEntry]:
        """
        Process a single page and extract all entries.

        Args:
            page_num: Page number (0-indexed)

        Returns:
            List of PageEntry objects
        """
        logger.info(f"Processing page {page_num + 1}")

        images = self.extract_images_from_page(page_num)
        text_blocks = self.extract_text_from_page(page_num)
        separators = self.detect_horizontal_lines(page_num)

        entries = self.group_into_entries(images, text_blocks, separators, page_num)

        return entries

    def process_all_pages(self) -> List[PageEntry]:
        """
        Process all pages in the configured range.

        Returns:
            List of all PageEntry objects from all pages
        """
        all_entries = []

        for page_num in range(self.start_page, self.end_page + 1):
            try:
                entries = self.process_page(page_num)
                all_entries.extend(entries)
            except Exception as e:
                logger.error(f"Error processing page {page_num + 1}: {e}", exc_info=True)
                continue

        logger.info(f"Extracted {len(all_entries)} total entries from {self.end_page - self.start_page + 1} pages")
        return all_entries

    def get_page_count(self) -> int:
        """Get total number of pages in document."""
        return len(self.doc)
