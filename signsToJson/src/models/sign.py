"""Pydantic models for sign language dictionary data."""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class Dictionary(BaseModel):
    """Metadata about a sign language dictionary."""

    id: Optional[int] = None
    language_code: str = Field(..., description="e.g., 'lsch', 'asl', 'lsm'")
    language_name: str = Field(..., description="e.g., 'Chilean Sign Language'")
    target_language: str = Field(..., description="e.g., 'es', 'en'")
    region: Optional[str] = Field(None, description="e.g., 'Metropolitan', 'Valparaiso'")
    version: Optional[str] = Field(None, description="Dictionary version")
    source: Optional[str] = Field(None, description="Source institution")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SignImage(BaseModel):
    """Image representing a sign or movement sequence."""

    id: Optional[int] = None
    sign_id: Optional[int] = None
    image_path: str = Field(..., description="Relative path to image file")
    sequence_order: int = Field(0, description="Order in movement sequence (0, 1, 2...)")
    is_primary: bool = Field(True, description="First image in sequence")
    width: Optional[int] = None
    height: Optional[int] = None
    file_size: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SignTranslation(BaseModel):
    """Translation of a sign to a target language."""

    id: Optional[int] = None
    sign_id: Optional[int] = None
    target_language: str = Field(..., description="e.g., 'es', 'en'")
    translation: str = Field(..., description="Translated word/phrase")
    context: Optional[str] = Field(None, description="Usage context")
    is_primary: bool = Field(False, description="Primary vs alternative translation")
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SignRelation(BaseModel):
    """Synonym, antonym, or related term for a sign."""

    id: Optional[int] = None
    sign_id: Optional[int] = None
    relation_type: str = Field(..., description="'synonym', 'antonym', 'related'")
    related_word: str = Field(..., description="The related word")
    language: str = Field(..., description="Language of the related word")
    created_at: Optional[datetime] = None

    @field_validator('relation_type')
    @classmethod
    def validate_relation_type(cls, v: str) -> str:
        """Validate relation type is one of allowed values."""
        allowed = {'synonym', 'antonym', 'related'}
        if v not in allowed:
            raise ValueError(f"relation_type must be one of {allowed}")
        return v

    class Config:
        from_attributes = True


class Sign(BaseModel):
    """Main sign entry in the dictionary."""

    id: Optional[int] = None
    dictionary_id: int
    glosa: str = Field(..., description="All-caps identifier (e.g., 'ABANDONAR')")
    definition: Optional[str] = Field(None, description="Sign meaning/description")
    grammatical_category: Optional[str] = Field(None, description="e.g., 'v. tr.', 'sust. m.'")
    verb_type: Optional[str] = Field(None, description="e.g., 'Verbo pleno', 'Verbo espacial locativo'")
    variant_number: int = Field(1, description="Variant number for same glosa")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    page_number: Optional[int] = Field(None, description="Page in source PDF")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Related data (not stored directly, loaded via joins)
    translations: List[SignTranslation] = Field(default_factory=list)
    relations: List[SignRelation] = Field(default_factory=list)
    images: List[SignImage] = Field(default_factory=list)

    class Config:
        from_attributes = True


class ExtractedEntry(BaseModel):
    """Intermediate representation of an extracted dictionary entry."""

    glosa: str
    definition: Optional[str] = None
    grammatical_category: Optional[str] = None
    verb_type: Optional[str] = None
    variant_number: int = 1
    page_number: Optional[int] = None

    # Parsed from "Esp.:" line
    translations: List[str] = Field(default_factory=list)
    synonyms: List[str] = Field(default_factory=list)
    antonyms: List[str] = Field(default_factory=list)

    # Image information
    image_paths: List[str] = Field(default_factory=list)

    # Raw text for debugging
    raw_text: Optional[str] = None

    def to_sign(self, dictionary_id: int, target_language: str = "es") -> Sign:
        """Convert extracted entry to Sign model."""
        sign = Sign(
            dictionary_id=dictionary_id,
            glosa=self.glosa,
            definition=self.definition,
            grammatical_category=self.grammatical_category,
            verb_type=self.verb_type,
            variant_number=self.variant_number,
            page_number=self.page_number,
        )

        # Add translations
        for idx, trans in enumerate(self.translations):
            sign.translations.append(SignTranslation(
                target_language=target_language,
                translation=trans,
                is_primary=(idx == 0)
            ))

        # Add synonyms
        for syn in self.synonyms:
            sign.relations.append(SignRelation(
                relation_type='synonym',
                related_word=syn,
                language=target_language
            ))

        # Add antonyms
        for ant in self.antonyms:
            sign.relations.append(SignRelation(
                relation_type='antonym',
                related_word=ant,
                language=target_language
            ))

        # Add images
        for idx, img_path in enumerate(self.image_paths):
            sign.images.append(SignImage(
                image_path=img_path,
                sequence_order=idx,
                is_primary=(idx == 0)
            ))

        return sign


class ExtractionResult(BaseModel):
    """Result of dictionary extraction process."""

    dictionary: Dictionary
    total_entries: int = 0
    successful: int = 0
    failed: int = 0
    entries: List[ExtractedEntry] = Field(default_factory=list)
    errors: List[Dict[str, Any]] = Field(default_factory=list)

    def add_entry(self, entry: ExtractedEntry) -> None:
        """Add a successfully extracted entry."""
        self.entries.append(entry)
        self.successful += 1
        self.total_entries += 1

    def add_error(self, page: int, error: str, context: Optional[str] = None) -> None:
        """Add an extraction error."""
        self.errors.append({
            'page': page,
            'error': error,
            'context': context,
            'timestamp': datetime.now().isoformat()
        })
        self.failed += 1
        self.total_entries += 1

    def get_validation_report(self) -> Dict[str, Any]:
        """Generate validation report."""
        entries_without_images = sum(1 for e in self.entries if not e.image_paths)
        entries_without_definition = sum(1 for e in self.entries if not e.definition)
        entries_without_translations = sum(1 for e in self.entries if not e.translations)

        # Find duplicate glosas
        glosa_counts: Dict[str, int] = {}
        for entry in self.entries:
            key = f"{entry.glosa}_v{entry.variant_number}"
            glosa_counts[key] = glosa_counts.get(key, 0) + 1
        duplicates = {k: v for k, v in glosa_counts.items() if v > 1}

        return {
            'total_entries': self.total_entries,
            'successful': self.successful,
            'failed': self.failed,
            'success_rate': f"{(self.successful / self.total_entries * 100):.1f}%" if self.total_entries > 0 else "0%",
            'entries_without_images': entries_without_images,
            'entries_without_definition': entries_without_definition,
            'entries_without_translations': entries_without_translations,
            'duplicate_glosas': duplicates,
            'error_count': len(self.errors),
            'sample_errors': self.errors[:10] if self.errors else []
        }
