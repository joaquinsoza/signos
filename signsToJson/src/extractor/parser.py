"""Parser module for extracting structured data from sign language dictionary text."""

import re
import logging
from typing import List, Optional, Tuple

from ..models import ExtractedEntry

logger = logging.getLogger(__name__)


class EntryParser:
    """Parses text from dictionary entries into structured data."""

    # Regex patterns
    GLOSA_PATTERN = re.compile(r'^([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\-/]+)$', re.MULTILINE)
    VERB_TYPE_PATTERN = re.compile(r'Verbo\s+(pleno|de\s+concordancia|espacial\s+locativo)', re.IGNORECASE)
    ESP_LINE_PATTERN = re.compile(r'Esp\.:\s*(.+?)(?:\s+Sin\.|\s+Ant\.|$)', re.DOTALL)
    SYNONYM_PATTERN = re.compile(r'(?:Sin\.|Sinón\.)\s+([^.]+?)(?:\s+Ant\.|$)', re.DOTALL)
    ANTONYM_PATTERN = re.compile(r'Ant\.\s+([^.]+?)\.?\s*$', re.DOTALL)

    # Grammatical category abbreviations
    GRAMMATICAL_ABBREV = {
        'adj.': 'Adjetivo',
        'adv.': 'Adverbio',
        'int.': 'Interrogativo',
        'interj.': 'Interjección',
        'intr.': 'Intransitivo',
        'Loc.': 'Locución',
        'prep.': 'Preposición',
        'pron.': 'Pronombre',
        'p.': 'Propio',
        'sust.': 'Sustantivo',
        'tr.': 'Transitivo',
        'v.': 'Verbo',
        'f.': 'Femenino',
        'm.': 'Masculino',
    }

    def __init__(self):
        """Initialize parser."""
        pass

    def parse_entry(self, raw_text: str, page_number: int, known_glosa: Optional[str] = None) -> Optional[ExtractedEntry]:
        """
        Parse raw text from a dictionary entry into structured data.

        Args:
            raw_text: Raw text extracted from PDF
            page_number: Page number in source PDF
            known_glosa: Optional pre-identified glosa from splitter

        Returns:
            ExtractedEntry object or None if parsing fails
        """
        if not raw_text or not raw_text.strip():
            logger.warning(f"Empty text on page {page_number}")
            return None

        try:
            # Use known glosa if provided, otherwise extract
            if known_glosa:
                glosa = known_glosa
                logger.debug(f"Using pre-identified glosa: {glosa}")
            else:
                # Extract glosa (all-caps word)
                glosa = self._extract_glosa(raw_text)
                if not glosa:
                    logger.warning(f"No glosa found on page {page_number}: {raw_text[:100]}")
                    return None

            # Check for variant number (e.g., "1. ACUARIO", "2. ACUARIO")
            variant_number, glosa = self._extract_variant_number(glosa)

            # Extract verb type if present
            verb_type = self._extract_verb_type(raw_text)

            # Extract definition (text before "Esp.:")
            definition = self._extract_definition(raw_text, glosa)

            # Parse the Spanish line (after "Esp.:")
            grammatical_category, translations = self._parse_esp_line(raw_text)

            # Fallback: If no translations found, use glosa as translation
            if not translations and glosa:
                translations = [glosa.replace('-', ' ').replace('/', ' o ').title()]
                logger.debug(f"No translations found, using glosa as translation: {translations[0]}")

            # Extract synonyms
            synonyms = self._extract_synonyms(raw_text)

            # Extract antonyms
            antonyms = self._extract_antonyms(raw_text)

            entry = ExtractedEntry(
                glosa=glosa,
                definition=definition,
                grammatical_category=grammatical_category,
                verb_type=verb_type,
                variant_number=variant_number,
                page_number=page_number,
                translations=translations,
                synonyms=synonyms,
                antonyms=antonyms,
                raw_text=raw_text
            )

            logger.debug(f"Parsed entry: {glosa} (variant {variant_number})")
            return entry

        except Exception as e:
            logger.error(f"Error parsing entry on page {page_number}: {e}", exc_info=True)
            return None

    def _extract_glosa(self, text: str) -> Optional[str]:
        """
        Extract the GLOSA (all-caps identifier) from text.

        Args:
            text: Raw text

        Returns:
            Glosa string or None
        """
        # First try to extract from beginning of text (for split entries)
        first_line = text.split('\n')[0].strip() if text else ""

        # Check if first line is all-caps word (likely a glosa)
        if first_line and re.match(r'^[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\-/]+$', first_line):
            # Filter out single letters and headers
            if len(first_line) > 1 and first_line not in ['DICCIONARIO', 'LSCh', 'LSCH', 'TABLA', 'ABREVIATURAS', 'SIMBOLOGÍA']:
                return first_line

        # Fallback: Look for all-caps words anywhere in text
        matches = self.GLOSA_PATTERN.findall(text)

        if not matches:
            return None

        # Return the first match (should be the glosa)
        # Filter out common false positives
        for match in matches:
            # Skip if it's just "A" (section header)
            if match == 'A':
                continue
            # Skip common headers
            if match in ['DICCIONARIO', 'LSCh', 'TABLA', 'ABREVIATURAS']:
                continue
            return match

        return matches[0] if matches else None

    def _extract_variant_number(self, glosa: str) -> Tuple[int, str]:
        """
        Extract variant number if present (e.g., "1. ACUARIO" -> (1, "ACUARIO")).

        Args:
            glosa: Glosa string

        Returns:
            Tuple of (variant_number, clean_glosa)
        """
        match = re.match(r'^(\d+)\.\s*(.+)$', glosa)
        if match:
            variant_num = int(match.group(1))
            clean_glosa = match.group(2)
            return variant_num, clean_glosa

        return 1, glosa

    def _extract_verb_type(self, text: str) -> Optional[str]:
        """
        Extract verb type classification if present.

        Args:
            text: Raw text

        Returns:
            Verb type string or None
        """
        match = self.VERB_TYPE_PATTERN.search(text)
        if match:
            return f"Verbo {match.group(1)}"
        return None

    def _extract_definition(self, text: str, glosa: str) -> Optional[str]:
        """
        Extract definition text (between glosa and "Esp.:").

        Args:
            text: Raw text
            glosa: Glosa to search after

        Returns:
            Definition string or None
        """
        # Find position of glosa
        glosa_pos = text.find(glosa)
        if glosa_pos == -1:
            return None

        # Find position of "Esp.:"
        esp_pos = text.find('Esp.:')
        if esp_pos == -1:
            # No "Esp.:" line, take everything after glosa
            definition = text[glosa_pos + len(glosa):].strip()
        else:
            # Take text between glosa and "Esp.:"
            definition = text[glosa_pos + len(glosa):esp_pos].strip()

        # Remove verb type from definition if present
        definition = self.VERB_TYPE_PATTERN.sub('', definition).strip()

        # Clean up multiple spaces/newlines
        definition = re.sub(r'\s+', ' ', definition)

        return definition if definition else None

    def _parse_esp_line(self, text: str) -> Tuple[Optional[str], List[str]]:
        """
        Parse the "Esp.:" line to extract grammatical category and translations.

        Args:
            text: Raw text

        Returns:
            Tuple of (grammatical_category, list of translations)
        """
        match = self.ESP_LINE_PATTERN.search(text)
        if not match:
            # Try to find even partial "Esp.:" line (might be truncated)
            esp_pos = text.find('Esp.:')
            if esp_pos != -1:
                # Extract what we can from the partial line
                remaining_text = text[esp_pos + 5:].strip()
                # Try to extract at least grammatical category
                category_match = re.match(r'^((?:[a-z]+\.\s*)+)', remaining_text)
                if category_match:
                    return category_match.group(1).strip(), []
            return None, []

        esp_line = match.group(1).strip()

        # Extract grammatical category (e.g., "v. tr.", "sust. m.")
        category_match = re.match(r'^((?:[a-z]+\.\s*)+)', esp_line)
        grammatical_category = None
        if category_match:
            grammatical_category = category_match.group(1).strip()
            # Remove category from line
            esp_line = esp_line[len(category_match.group(1)):].strip()

        # Extract translations (comma-separated words/phrases)
        # Stop at first period followed by capital letter or at "Sin." or "Ant."
        translations_text = re.split(r'\.\s+[A-Z]|Sin\.|Ant\.', esp_line)[0]

        # Split by commas and clean up
        translations = [
            t.strip().rstrip('.')
            for t in re.split(r',\s*', translations_text)
            if t.strip()
        ]

        return grammatical_category, translations

    def _extract_synonyms(self, text: str) -> List[str]:
        """
        Extract synonyms from "Sin." or "Sinón." section.

        Args:
            text: Raw text

        Returns:
            List of synonym strings
        """
        match = self.SYNONYM_PATTERN.search(text)
        if not match:
            return []

        synonyms_text = match.group(1).strip()

        # Split by commas
        synonyms = [
            s.strip().rstrip('.')
            for s in re.split(r',\s*', synonyms_text)
            if s.strip()
        ]

        return synonyms

    def _extract_antonyms(self, text: str) -> List[str]:
        """
        Extract antonyms from "Ant." section.

        Args:
            text: Raw text

        Returns:
            List of antonym strings
        """
        match = self.ANTONYM_PATTERN.search(text)
        if not match:
            return []

        antonyms_text = match.group(1).strip()

        # Split by commas
        antonyms = [
            a.strip().rstrip('.')
            for a in re.split(r',\s*', antonyms_text)
            if a.strip()
        ]

        return antonyms

    def clean_text(self, text: str) -> str:
        """
        Clean and normalize text.

        Args:
            text: Raw text

        Returns:
            Cleaned text
        """
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)

        # Remove page numbers
        text = re.sub(r'\b\d{1,3}\b\s*$', '', text)

        return text.strip()
