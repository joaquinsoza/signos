-- Multi-language Sign Language Dictionary Database Schema
-- Designed for Chilean Sign Language (LSCh) with extensibility for ASL, LSM, etc.

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- DICTIONARIES TABLE
-- Stores metadata about different sign language dictionaries
-- =============================================
CREATE TABLE IF NOT EXISTS dictionaries (
    id SERIAL PRIMARY KEY,
    language_code VARCHAR(10) NOT NULL,  -- 'lsch', 'asl', 'lsm', 'bsl', etc.
    language_name TEXT NOT NULL,         -- 'Chilean Sign Language', 'American Sign Language', etc.
    target_language VARCHAR(10) NOT NULL, -- 'es', 'en', 'pt', etc. (spoken language)
    region TEXT,                         -- 'Metropolitan', 'Valparaiso', 'Southern', etc.
    version TEXT,                        -- Dictionary version/edition
    source TEXT,                         -- Source institution or publication
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(language_code, region, version)
);

-- =============================================
-- SIGNS TABLE
-- Main table for sign entries (language-agnostic structure)
-- =============================================
CREATE TABLE IF NOT EXISTS signs (
    id SERIAL PRIMARY KEY,
    dictionary_id INT NOT NULL REFERENCES dictionaries(id) ON DELETE CASCADE,
    glosa TEXT NOT NULL,                 -- All-caps identifier (e.g., 'ABANDONAR', 'ABRIR-CAJÓN')
    definition TEXT,                     -- Description of what the sign means
    grammatical_category TEXT,           -- 'v. tr.', 'sust. m.', 'adj.', etc.
    verb_type TEXT,                      -- 'Verbo pleno', 'Verbo espacial locativo', 'Verbo de concordancia'
    variant_number INT DEFAULT 1,        -- For multiple variants of same glosa (1, 2, 3...)
    metadata JSONB DEFAULT '{}',         -- Flexible field for language-specific data
    page_number INT,                     -- Original page in source PDF
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dictionary_id, glosa, variant_number)
);

-- =============================================
-- SIGN_TRANSLATIONS TABLE
-- Multi-language translation support
-- =============================================
CREATE TABLE IF NOT EXISTS sign_translations (
    id SERIAL PRIMARY KEY,
    sign_id INT NOT NULL REFERENCES signs(id) ON DELETE CASCADE,
    target_language VARCHAR(10) NOT NULL,  -- 'es', 'en', 'pt', etc.
    translation TEXT NOT NULL,             -- Individual translation word/phrase
    context TEXT,                          -- Additional context or usage notes
    is_primary BOOLEAN DEFAULT false,      -- Main translation vs alternative
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- SIGN_RELATIONS TABLE
-- Synonyms, antonyms, and related terms
-- =============================================
CREATE TABLE IF NOT EXISTS sign_relations (
    id SERIAL PRIMARY KEY,
    sign_id INT NOT NULL REFERENCES signs(id) ON DELETE CASCADE,
    relation_type VARCHAR(20) NOT NULL,  -- 'synonym', 'antonym', 'related'
    related_word TEXT NOT NULL,          -- The synonym/antonym word
    language VARCHAR(10) NOT NULL,       -- 'es', 'en', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (relation_type IN ('synonym', 'antonym', 'related'))
);

-- =============================================
-- SIGN_IMAGES TABLE
-- Images for each sign (supports movement sequences)
-- =============================================
CREATE TABLE IF NOT EXISTS sign_images (
    id SERIAL PRIMARY KEY,
    sign_id INT NOT NULL REFERENCES signs(id) ON DELETE CASCADE,
    image_path TEXT NOT NULL,            -- Relative path to image file
    sequence_order INT NOT NULL,         -- 0, 1, 2... for movement sequences
    is_primary BOOLEAN DEFAULT true,     -- First image in sequence is typically primary
    width INT,                           -- Image dimensions for reference
    height INT,
    file_size INT,                       -- Size in bytes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sign_id, sequence_order)
);

-- =============================================
-- SIGN_VARIANTS TABLE
-- Links different regional or alternative variants of the same sign
-- =============================================
CREATE TABLE IF NOT EXISTS sign_variants (
    id SERIAL PRIMARY KEY,
    base_sign_id INT NOT NULL REFERENCES signs(id) ON DELETE CASCADE,
    variant_sign_id INT NOT NULL REFERENCES signs(id) ON DELETE CASCADE,
    variant_type TEXT,                   -- 'regional', 'alternative', 'dialectal'
    notes TEXT,                          -- Description of difference
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(base_sign_id, variant_sign_id),
    CHECK (base_sign_id != variant_sign_id)
);

-- =============================================
-- EXTRACTION_LOG TABLE
-- Tracks extraction runs for auditing
-- =============================================
CREATE TABLE IF NOT EXISTS extraction_log (
    id SERIAL PRIMARY KEY,
    dictionary_id INT REFERENCES dictionaries(id) ON DELETE SET NULL,
    pdf_filename TEXT NOT NULL,
    total_entries INT DEFAULT 0,
    successful_entries INT DEFAULT 0,
    failed_entries INT DEFAULT 0,
    start_page INT,
    end_page INT,
    extraction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    error_log JSONB DEFAULT '[]'
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_signs_dictionary ON signs(dictionary_id);
CREATE INDEX IF NOT EXISTS idx_signs_glosa ON signs(glosa);
CREATE INDEX IF NOT EXISTS idx_signs_glosa_lower ON signs(LOWER(glosa));
CREATE INDEX IF NOT EXISTS idx_signs_category ON signs(grammatical_category);

-- Translation indexes
CREATE INDEX IF NOT EXISTS idx_translations_sign ON sign_translations(sign_id);
CREATE INDEX IF NOT EXISTS idx_translations_lang ON sign_translations(target_language);
CREATE INDEX IF NOT EXISTS idx_translations_text ON sign_translations(translation);

-- Relations indexes
CREATE INDEX IF NOT EXISTS idx_relations_sign ON sign_relations(sign_id);
CREATE INDEX IF NOT EXISTS idx_relations_type ON sign_relations(relation_type);

-- Image indexes
CREATE INDEX IF NOT EXISTS idx_images_sign ON sign_images(sign_id);
CREATE INDEX IF NOT EXISTS idx_images_sequence ON sign_images(sign_id, sequence_order);

-- Variant indexes
CREATE INDEX IF NOT EXISTS idx_variants_base ON sign_variants(base_sign_id);
CREATE INDEX IF NOT EXISTS idx_variants_variant ON sign_variants(variant_sign_id);

-- Full-text search indexes (optional, for future search features)
CREATE INDEX IF NOT EXISTS idx_signs_definition_fts ON signs USING gin(to_tsvector('spanish', definition));

-- JSONB metadata index
CREATE INDEX IF NOT EXISTS idx_signs_metadata ON signs USING gin(metadata);

-- =============================================
-- VIEWS FOR COMMON QUERIES
-- =============================================

-- Complete sign view with all related data
CREATE OR REPLACE VIEW v_signs_complete AS
SELECT
    s.id,
    s.glosa,
    s.definition,
    s.grammatical_category,
    s.verb_type,
    s.variant_number,
    s.metadata,
    s.page_number,
    d.language_code,
    d.language_name,
    d.target_language,
    d.region,
    json_agg(DISTINCT jsonb_build_object(
        'translation', st.translation,
        'language', st.target_language,
        'is_primary', st.is_primary
    )) FILTER (WHERE st.id IS NOT NULL) AS translations,
    json_agg(DISTINCT jsonb_build_object(
        'type', sr.relation_type,
        'word', sr.related_word,
        'language', sr.language
    )) FILTER (WHERE sr.id IS NOT NULL) AS relations,
    json_agg(jsonb_build_object(
        'path', si.image_path,
        'sequence', si.sequence_order,
        'is_primary', si.is_primary
    ) ORDER BY si.sequence_order) FILTER (WHERE si.id IS NOT NULL) AS images
FROM signs s
JOIN dictionaries d ON s.dictionary_id = d.id
LEFT JOIN sign_translations st ON s.id = st.sign_id
LEFT JOIN sign_relations sr ON s.id = sr.sign_id
LEFT JOIN sign_images si ON s.id = si.sign_id
GROUP BY s.id, s.glosa, s.definition, s.grammatical_category, s.verb_type,
         s.variant_number, s.metadata, s.page_number, d.language_code,
         d.language_name, d.target_language, d.region;

-- =============================================
-- FUNCTIONS
-- =============================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_dictionaries_updated_at BEFORE UPDATE ON dictionaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_signs_updated_at BEFORE UPDATE ON signs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- SAMPLE DATA (for testing)
-- =============================================

-- Insert default LSCh dictionary
INSERT INTO dictionaries (language_code, language_name, target_language, region, version, source)
VALUES ('lsch', 'Lengua de Señas Chilena', 'es', 'Metropolitan', '1.0', 'Official LSCh Dictionary')
ON CONFLICT (language_code, region, version) DO NOTHING;

-- Grant permissions (adjust as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO signos;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO signos;
