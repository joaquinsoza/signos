"""Entry splitting module - splits combined text blocks into individual entries."""

import re
import logging
from typing import List, Tuple, TYPE_CHECKING
from dataclasses import dataclass

if TYPE_CHECKING:
    from .pdf_processor import ImageBlock

logger = logging.getLogger(__name__)


@dataclass
class SplitEntry:
    """Represents a single entry after splitting combined text."""

    glosa: str
    text: str
    start_pos: int  # Character position in original text
    end_pos: int
    y_position: float = 0.0  # Y-position of glosa in PDF (for image matching)


class EntrySplitter:
    """Splits combined text blocks into individual dictionary entries."""

    # Pattern to match GLOSA (all-caps words at start of line or after newline)
    GLOSA_PATTERN = re.compile(
        r'(?:^|\n)([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\-/]+)(?:\n| )',
        re.MULTILINE
    )

    # Words to exclude (section headers, etc.)
    EXCLUDE_WORDS = {
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
        'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
        'DICCIONARIO', 'LSCh', 'LSCH', 'TABLA', 'ABREVIATURAS', 'SIMBOLOGÍA',
        'DE', 'LA', 'EL', 'LAS', 'LOS', 'EN', 'CON', 'POR'
    }

    def __init__(self):
        """Initialize splitter."""
        pass

    def find_glosa_positions(self, text: str) -> List[Tuple[str, int, int]]:
        """
        Find all GLOSA positions in text.

        Args:
            text: Combined text

        Returns:
            List of (glosa, start_position, end_position) tuples
        """
        glosas = []

        for match in self.GLOSA_PATTERN.finditer(text):
            glosa = match.group(1).strip()

            # Skip excluded words
            if glosa in self.EXCLUDE_WORDS:
                continue

            # Skip if it looks like a number/page marker
            if glosa.isdigit():
                continue

            start_pos = match.start(1)
            end_pos = match.end(1)

            glosas.append((glosa, start_pos, end_pos))

        return glosas

    def split_by_glosas(self, text: str) -> List[SplitEntry]:
        """
        Split text into individual entries based on GLOSA positions.

        Args:
            text: Combined text containing multiple entries

        Returns:
            List of SplitEntry objects
        """
        glosa_positions = self.find_glosa_positions(text)

        if not glosa_positions:
            logger.warning("No glosas found in text")
            return []

        entries = []

        for i, (glosa, start_pos, end_pos) in enumerate(glosa_positions):
            # Determine where this entry ends
            if i < len(glosa_positions) - 1:
                # Entry ends where next glosa starts
                next_start = glosa_positions[i + 1][1]
                entry_text = text[start_pos:next_start].strip()
            else:
                # Last entry - goes to end of text
                entry_text = text[start_pos:].strip()

            # Clean up page numbers at the end
            entry_text = re.sub(r'\n\d{1,3}\s*$', '', entry_text)

            entries.append(SplitEntry(
                glosa=glosa,
                text=entry_text,
                start_pos=start_pos,
                end_pos=start_pos + len(entry_text)
            ))

            logger.debug(f"Split entry: {glosa} ({len(entry_text)} chars)")

        return entries

    def estimate_images_per_entry(
        self,
        entries: List[SplitEntry],
        total_images: int
    ) -> List[Tuple[SplitEntry, int]]:
        """
        Estimate how many images belong to each entry based on text length ratio.

        This is a rough heuristic - entries with more text likely have more images.

        Args:
            entries: List of SplitEntry objects
            total_images: Total number of images in the combined block

        Returns:
            List of (entry, estimated_image_count) tuples
        """
        if not entries:
            return []

        # Calculate text length for each entry
        text_lengths = [len(entry.text) for entry in entries]
        total_length = sum(text_lengths)

        if total_length == 0:
            # Equal distribution
            images_per_entry = total_images // len(entries)
            return [(entry, images_per_entry) for entry in entries]

        # Distribute images proportionally to text length
        result = []
        assigned_images = 0

        for i, entry in enumerate(entries):
            # Ratio of this entry's text length to total
            ratio = text_lengths[i] / total_length

            # Calculate estimated images (at least 1 if there are images)
            if i == len(entries) - 1:
                # Last entry gets remaining images
                estimated = total_images - assigned_images
            else:
                estimated = max(1, round(ratio * total_images))

            result.append((entry, estimated))
            assigned_images += estimated

        return result

    def distribute_images_by_position(
        self,
        entries: List[SplitEntry],
        images: List['ImageBlock'],
        vertical_threshold: float = 80.0
    ) -> List[Tuple[SplitEntry, List['ImageBlock']]]:
        """
        Distribute images to entries based on vertical position proximity.

        This method groups consecutive images that are close together vertically
        (indicating a movement sequence for the same sign) and assigns these
        groups to entries sequentially.

        Args:
            entries: List of SplitEntry objects (in order)
            images: List of ImageBlock objects (sorted by y_position)
            vertical_threshold: Max Y-distance in pixels to group images (default: 80px)

        Returns:
            List of (entry, list_of_images) tuples
        """
        if not entries:
            return []

        if not images:
            return [(entry, []) for entry in entries]

        # Group images by vertical proximity
        image_groups: List[List['ImageBlock']] = []
        current_group = [images[0]]

        for i in range(1, len(images)):
            y_diff = images[i].y_position - images[i - 1].y_position

            if y_diff < vertical_threshold:
                # Close together - same entry (movement sequence)
                current_group.append(images[i])
            else:
                # Far apart - new entry
                image_groups.append(current_group)
                current_group = [images[i]]

        # Don't forget the last group
        if current_group:
            image_groups.append(current_group)

        logger.info(f"Grouped {len(images)} images into {len(image_groups)} groups for {len(entries)} entries")

        # Assign image groups to entries sequentially
        result = []
        for i, entry in enumerate(entries):
            if i < len(image_groups):
                assigned_images = image_groups[i]
                logger.debug(f"Assigned {len(assigned_images)} images to {entry.glosa}")
                result.append((entry, assigned_images))
            else:
                # More entries than image groups - no images for this entry
                logger.warning(f"No images available for {entry.glosa}")
                result.append((entry, []))

        # Warn if we have leftover images
        if len(image_groups) > len(entries):
            logger.warning(f"Have {len(image_groups)} image groups but only {len(entries)} entries - some images may be unassigned")

        return result

    def distribute_images_by_separators(
        self,
        entries: List[SplitEntry],
        images: List['ImageBlock'],
        separator_y_positions: List[float]
    ) -> List[Tuple[SplitEntry, List['ImageBlock']]]:
        """
        Distribute images to entries based on horizontal separator line boundaries.

        This method uses the separator lines that mark entry boundaries in the PDF
        to accurately assign images to their corresponding entries. Within each
        region, images are sorted by Y position (top to bottom) then X position
        (left to right) to handle side-by-side images correctly.

        Args:
            entries: List of SplitEntry objects (in order)
            images: List of ImageBlock objects
            separator_y_positions: Y positions of horizontal separator lines

        Returns:
            List of (entry, list_of_images) tuples
        """
        if not entries:
            return []

        if not images:
            return [(entry, []) for entry in entries]

        # If no separators, fall back to position-based grouping
        if not separator_y_positions:
            logger.warning("No separators found, falling back to position-based distribution")
            return self.distribute_images_by_position(entries, images)

        # Sort separators
        separators = sorted(separator_y_positions)

        # Create boundaries: [0, sep1, sep2, ..., infinity]
        boundaries = [0.0] + separators + [float('inf')]

        # Assign images to regions based on their Y position
        image_regions: List[List['ImageBlock']] = [[] for _ in range(len(boundaries) - 1)]

        for img in images:
            # Find which region this image belongs to
            for i in range(len(boundaries) - 1):
                if boundaries[i] <= img.y_position < boundaries[i + 1]:
                    image_regions[i].append(img)
                    break

        # Sort images within each region by Y position (top to bottom), then X position (left to right)
        # This ensures side-by-side images are ordered correctly
        for region in image_regions:
            region.sort(key=lambda img: (img.y_position, img.bbox[0]))

        # Remove empty regions
        image_regions = [region for region in image_regions if region]

        logger.info(f"Distributed {len(images)} images into {len(image_regions)} regions for {len(entries)} entries")

        # Assign image regions to entries sequentially
        result = []
        for i, entry in enumerate(entries):
            if i < len(image_regions):
                assigned_images = image_regions[i]
                logger.debug(f"Assigned {len(assigned_images)} images to {entry.glosa}")
                result.append((entry, assigned_images))
            else:
                # More entries than image regions - no images for this entry
                logger.warning(f"No images available for {entry.glosa}")
                result.append((entry, []))

        # Warn if we have leftover images
        if len(image_regions) > len(entries):
            logger.warning(f"Have {len(image_regions)} image regions but only {len(entries)} entries - some images may be unassigned")

        return result

    def find_glosa_y_positions(
        self,
        entries: List[SplitEntry],
        text_blocks: List['TextBlock']
    ) -> List[float]:
        """
        Find the Y-position of each GLOSA in the PDF by searching text blocks.

        Args:
            entries: List of SplitEntry objects with glosas
            text_blocks: List of TextBlock objects from PDF

        Returns:
            List of Y-positions corresponding to each entry
        """
        glosa_y_positions = []

        for entry in entries:
            # Search for this glosa in text blocks
            found = False
            for tb in text_blocks:
                # Check if this text block contains the glosa at the start
                if tb.text.strip().startswith(entry.glosa):
                    glosa_y_positions.append(tb.y_position)
                    found = True
                    logger.debug(f"Found {entry.glosa} at Y={tb.y_position}")
                    break

            if not found:
                # Fallback: use infinity to put at end
                glosa_y_positions.append(float('inf'))
                logger.warning(f"Could not find Y-position for {entry.glosa}")

        return glosa_y_positions

    def distribute_images_by_text_regions(
        self,
        entries: List[SplitEntry],
        images: List['ImageBlock'],
        text_blocks: List['TextBlock']
    ) -> List[Tuple[SplitEntry, List['ImageBlock']]]:
        """
        Distribute images to entries based on text Y-position regions.

        This is the most accurate method: it finds where each GLOSA appears in the PDF,
        creates regions between consecutive GLOSAs, and assigns images to the region
        they fall into. When multiple images cluster together, it uses smart distribution.

        Args:
            entries: List of SplitEntry objects (in order)
            images: List of ImageBlock objects
            text_blocks: List of TextBlock objects from PDF

        Returns:
            List of (entry, list_of_images) tuples
        """
        if not entries:
            return []

        if not images:
            return [(entry, []) for entry in entries]

        # Find Y-position of each GLOSA
        glosa_y_positions = self.find_glosa_y_positions(entries, text_blocks)

        # Sort images by Y-position
        sorted_images = sorted(images, key=lambda img: img.y_position)

        # Group images into clusters (images within 30px are in same cluster)
        image_clusters: List[List['ImageBlock']] = []
        if sorted_images:
            current_cluster = [sorted_images[0]]
            for img in sorted_images[1:]:
                if img.y_position - current_cluster[-1].y_position < 30:
                    # Same cluster (within 30px vertically)
                    current_cluster.append(img)
                else:
                    # New cluster
                    image_clusters.append(current_cluster)
                    current_cluster = [img]
            image_clusters.append(current_cluster)

        # Sort images within each cluster by X position (left to right for side-by-side)
        for cluster in image_clusters:
            cluster.sort(key=lambda img: img.bbox[0])

        logger.debug(f"Grouped {len(images)} images into {len(image_clusters)} clusters")

        # Now assign clusters to entries based on which GLOSA they're closest to
        result = []
        used_clusters = set()

        for i, entry in enumerate(entries):
            entry_y = glosa_y_positions[i]

            # Find next entry's Y position (or infinity if this is last)
            next_y = glosa_y_positions[i + 1] if i + 1 < len(entries) else float('inf')

            # Find clusters that fall in this entry's region
            entry_images = []
            for cluster_idx, cluster in enumerate(image_clusters):
                if cluster_idx in used_clusters:
                    continue

                # Use the first image's Y position to represent the cluster
                cluster_y = cluster[0].y_position

                # Check if this cluster falls in this entry's region
                if entry_y <= cluster_y < next_y:
                    entry_images.extend(cluster)
                    used_clusters.add(cluster_idx)
                    logger.debug(f"Assigned cluster {cluster_idx} ({len(cluster)} images) to {entry.glosa}")

            logger.debug(f"Assigned {len(entry_images)} total images to {entry.glosa} (Y={entry_y:.1f})")
            result.append((entry, entry_images))

        # Check for unused clusters
        unused_count = len(image_clusters) - len(used_clusters)
        if unused_count > 0:
            logger.warning(f"{unused_count} image clusters were not assigned to any entry")

        return result
