"""Database repository for sign language dictionary data."""

import logging
from typing import List, Optional, Dict, Any
from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor, execute_values

from ..models import Dictionary, Sign, SignTranslation, SignRelation, SignImage

logger = logging.getLogger(__name__)


class SignRepository:
    """Repository for managing sign language dictionary data in PostgreSQL."""

    def __init__(
        self,
        host: str,
        port: int,
        database: str,
        user: str,
        password: str
    ):
        """
        Initialize repository with database connection parameters.

        Args:
            host: Database host
            port: Database port
            database: Database name
            user: Database user
            password: Database password
        """
        self.connection_params = {
            'host': host,
            'port': port,
            'database': database,
            'user': user,
            'password': password
        }
        logger.info(f"Initialized repository for database: {database}")

    @contextmanager
    def get_connection(self):
        """Context manager for database connections."""
        conn = psycopg2.connect(**self.connection_params)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    @contextmanager
    def get_cursor(self, cursor_factory=None):
        """Context manager for database cursors."""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=cursor_factory)
            try:
                yield cursor
            finally:
                cursor.close()

    # =============================================
    # DICTIONARY OPERATIONS
    # =============================================

    def create_dictionary(self, dictionary: Dictionary) -> int:
        """
        Create a new dictionary entry.

        Args:
            dictionary: Dictionary model

        Returns:
            Dictionary ID
        """
        query = """
            INSERT INTO dictionaries (language_code, language_name, target_language, region, version, source)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (language_code, region, version)
            DO UPDATE SET
                language_name = EXCLUDED.language_name,
                target_language = EXCLUDED.target_language,
                source = EXCLUDED.source,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        """

        with self.get_cursor() as cursor:
            cursor.execute(query, (
                dictionary.language_code,
                dictionary.language_name,
                dictionary.target_language,
                dictionary.region,
                dictionary.version,
                dictionary.source
            ))
            result = cursor.fetchone()
            dict_id = result[0]
            logger.info(f"Created/updated dictionary: {dictionary.language_code} (ID: {dict_id})")
            return dict_id

    def get_dictionary_by_code(
        self,
        language_code: str,
        region: Optional[str] = None,
        version: Optional[str] = None
    ) -> Optional[Dictionary]:
        """
        Get dictionary by language code.

        Args:
            language_code: Language code
            region: Optional region filter
            version: Optional version filter

        Returns:
            Dictionary model or None
        """
        query = """
            SELECT * FROM dictionaries
            WHERE language_code = %s
        """
        params = [language_code]

        if region:
            query += " AND region = %s"
            params.append(region)

        if version:
            query += " AND version = %s"
            params.append(version)

        query += " ORDER BY created_at DESC LIMIT 1"

        with self.get_cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, params)
            row = cursor.fetchone()
            if row:
                return Dictionary(**dict(row))
            return None

    # =============================================
    # SIGN OPERATIONS
    # =============================================

    def create_sign(self, sign: Sign) -> int:
        """
        Create a new sign entry with all related data (translations, relations, images).

        Args:
            sign: Sign model with nested data

        Returns:
            Sign ID
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            try:
                # Insert sign
                sign_query = """
                    INSERT INTO signs (
                        dictionary_id, glosa, definition, grammatical_category,
                        verb_type, variant_number, metadata, page_number
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (dictionary_id, glosa, variant_number)
                    DO UPDATE SET
                        definition = EXCLUDED.definition,
                        grammatical_category = EXCLUDED.grammatical_category,
                        verb_type = EXCLUDED.verb_type,
                        metadata = EXCLUDED.metadata,
                        page_number = EXCLUDED.page_number,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING id
                """

                cursor.execute(sign_query, (
                    sign.dictionary_id,
                    sign.glosa,
                    sign.definition,
                    sign.grammatical_category,
                    sign.verb_type,
                    sign.variant_number,
                    psycopg2.extras.Json(sign.metadata),
                    sign.page_number
                ))

                sign_id = cursor.fetchone()[0]

                # Insert translations
                if sign.translations:
                    translation_query = """
                        INSERT INTO sign_translations (sign_id, target_language, translation, context, is_primary)
                        VALUES %s
                    """
                    translation_values = [
                        (sign_id, t.target_language, t.translation, t.context, t.is_primary)
                        for t in sign.translations
                    ]
                    execute_values(cursor, translation_query, translation_values)

                # Insert relations
                if sign.relations:
                    relation_query = """
                        INSERT INTO sign_relations (sign_id, relation_type, related_word, language)
                        VALUES %s
                    """
                    relation_values = [
                        (sign_id, r.relation_type, r.related_word, r.language)
                        for r in sign.relations
                    ]
                    execute_values(cursor, relation_query, relation_values)

                # Insert images
                if sign.images:
                    image_query = """
                        INSERT INTO sign_images (sign_id, image_path, sequence_order, is_primary, width, height, file_size)
                        VALUES %s
                    """
                    image_values = [
                        (sign_id, img.image_path, img.sequence_order, img.is_primary, img.width, img.height, img.file_size)
                        for img in sign.images
                    ]
                    execute_values(cursor, image_query, image_values)

                logger.debug(f"Created sign: {sign.glosa} (ID: {sign_id})")
                return sign_id

            except Exception as e:
                logger.error(f"Error creating sign {sign.glosa}: {e}")
                raise

    def bulk_create_signs(self, signs: List[Sign]) -> int:
        """
        Bulk create multiple signs with all related data.

        Args:
            signs: List of Sign models

        Returns:
            Number of signs created
        """
        created = 0
        for sign in signs:
            try:
                self.create_sign(sign)
                created += 1
            except Exception as e:
                logger.error(f"Failed to create sign {sign.glosa}: {e}")
                continue

        logger.info(f"Bulk created {created}/{len(signs)} signs")
        return created

    def get_sign_by_glosa(
        self,
        dictionary_id: int,
        glosa: str,
        variant_number: int = 1
    ) -> Optional[Sign]:
        """
        Get a sign by glosa.

        Args:
            dictionary_id: Dictionary ID
            glosa: Glosa string
            variant_number: Variant number

        Returns:
            Sign model with all related data or None
        """
        query = """
            SELECT * FROM v_signs_complete
            WHERE dictionary_id = %s AND glosa = %s AND variant_number = %s
        """

        with self.get_cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, (dictionary_id, glosa, variant_number))
            row = cursor.fetchone()

            if not row:
                return None

            # Convert row to Sign model
            return self._row_to_sign(dict(row))

    def search_signs(
        self,
        dictionary_id: int,
        query: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Sign]:
        """
        Search signs by glosa or definition.

        Args:
            dictionary_id: Dictionary ID
            query: Search query
            limit: Maximum results
            offset: Result offset

        Returns:
            List of Sign models
        """
        if query:
            sql = """
                SELECT * FROM v_signs_complete
                WHERE dictionary_id = %s
                AND (LOWER(glosa) LIKE LOWER(%s) OR definition ILIKE %s)
                ORDER BY glosa
                LIMIT %s OFFSET %s
            """
            params = (dictionary_id, f"%{query}%", f"%{query}%", limit, offset)
        else:
            sql = """
                SELECT * FROM v_signs_complete
                WHERE dictionary_id = %s
                ORDER BY glosa
                LIMIT %s OFFSET %s
            """
            params = (dictionary_id, limit, offset)

        with self.get_cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            return [self._row_to_sign(dict(row)) for row in rows]

    def get_sign_count(self, dictionary_id: int) -> int:
        """
        Get total number of signs in a dictionary.

        Args:
            dictionary_id: Dictionary ID

        Returns:
            Count of signs
        """
        query = "SELECT COUNT(*) FROM signs WHERE dictionary_id = %s"

        with self.get_cursor() as cursor:
            cursor.execute(query, (dictionary_id,))
            return cursor.fetchone()[0]

    # =============================================
    # EXTRACTION LOG OPERATIONS
    # =============================================

    def log_extraction(
        self,
        dictionary_id: int,
        pdf_filename: str,
        total_entries: int,
        successful_entries: int,
        failed_entries: int,
        start_page: int,
        end_page: int,
        errors: List[Dict[str, Any]]
    ) -> int:
        """
        Log an extraction run.

        Args:
            dictionary_id: Dictionary ID
            pdf_filename: PDF filename
            total_entries: Total entries processed
            successful_entries: Successful entries
            failed_entries: Failed entries
            start_page: Start page
            end_page: End page
            errors: List of error dicts

        Returns:
            Log ID
        """
        query = """
            INSERT INTO extraction_log (
                dictionary_id, pdf_filename, total_entries, successful_entries,
                failed_entries, start_page, end_page, error_log
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """

        with self.get_cursor() as cursor:
            cursor.execute(query, (
                dictionary_id,
                pdf_filename,
                total_entries,
                successful_entries,
                failed_entries,
                start_page,
                end_page,
                psycopg2.extras.Json(errors)
            ))
            log_id = cursor.fetchone()[0]
            logger.info(f"Logged extraction run (ID: {log_id})")
            return log_id

    # =============================================
    # HELPER METHODS
    # =============================================

    def _row_to_sign(self, row: Dict[str, Any]) -> Sign:
        """Convert database row to Sign model."""
        sign = Sign(
            id=row['id'],
            dictionary_id=row.get('dictionary_id'),
            glosa=row['glosa'],
            definition=row.get('definition'),
            grammatical_category=row.get('grammatical_category'),
            verb_type=row.get('verb_type'),
            variant_number=row.get('variant_number', 1),
            metadata=row.get('metadata', {}),
            page_number=row.get('page_number')
        )

        # Parse nested JSON data
        if row.get('translations'):
            sign.translations = [
                SignTranslation(**t) for t in row['translations']
                if t  # Filter None values
            ]

        if row.get('relations'):
            sign.relations = [
                SignRelation(**r) for r in row['relations']
                if r  # Filter None values
            ]

        if row.get('images'):
            sign.images = [
                SignImage(**img) for img in row['images']
                if img  # Filter None values
            ]

        return sign

    def test_connection(self) -> bool:
        """Test database connection."""
        try:
            with self.get_cursor() as cursor:
                cursor.execute("SELECT 1")
                logger.info("Database connection successful")
                return True
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            return False
