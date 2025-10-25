import json
import psycopg2
from pathlib import Path
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def export_signs_to_json(output_path: str) -> None:
    """Export all signs with embeddings metadata to JSON."""
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_NAME", "signos_db"),
        user=os.getenv("DB_USER", "signos"),
        password=os.getenv("DB_PASSWORD", "password")
    )

    cursor = conn.cursor()

    # Query complete sign data with all relations
    query = """
        SELECT
            s.id,
            s.glosa,
            s.definition,
            s.grammatical_category,
            s.variant_number,
            json_agg(DISTINCT st.translation) FILTER (WHERE st.id IS NOT NULL) as translations,
            json_agg(DISTINCT sr.related_word) FILTER (WHERE sr.id IS NOT NULL AND sr.relation_type = 'synonym') as synonyms,
            json_agg(
                jsonb_build_object(
                    'path', si.image_path,
                    'sequence', si.sequence_order
                ) ORDER BY si.sequence_order
            ) FILTER (WHERE si.id IS NOT NULL) as images
        FROM signs s
        LEFT JOIN sign_translations st ON s.id = st.sign_id
        LEFT JOIN sign_relations sr ON s.id = sr.sign_id
        LEFT JOIN sign_images si ON s.id = si.sign_id
        WHERE s.dictionary_id IN (SELECT id FROM dictionaries WHERE language_code = 'lsch')
        GROUP BY s.id
        ORDER BY s.glosa;
    """

    cursor.execute(query)
    rows = cursor.fetchall()

    signs = []
    for row in rows:
        sign_id, glosa, definition, category, variant, translations, synonyms, images = row

        # Build search text for embeddings (what user might say)
        search_terms = [glosa.lower()]
        if translations:
            search_terms.extend([t.lower() for t in translations if t])
        if synonyms:
            search_terms.extend([s.lower() for s in synonyms if s])
        if definition:
            search_terms.append(definition.lower())

        signs.append({
            "id": f"sign_{sign_id}",
            "glosa": glosa,
            "definition": definition,
            "category": category,
            "variant": variant,
            "translations": translations or [],
            "synonyms": synonyms or [],
            "images": images or [],
            "search_text": " | ".join(search_terms),  # For embedding generation
        })

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(signs, f, indent=2, ensure_ascii=False)

    print(f"Exported {len(signs)} signs to {output_path}")
    conn.close()

if __name__ == '__main__':
    export_signs_to_json('output/signs_complete.json')
