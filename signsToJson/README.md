# Signos - Sign Language Dictionary Extraction System

A production-ready, Dockerized Python system for extracting and organizing sign language dictionary data from PDFs into a structured PostgreSQL database.

Built for the **Chilean Sign Language (LSCh)** dictionary, but designed to support any sign language with a multi-language database architecture.

---

## 🚀 Features

- **PDF Processing**: Extracts images and text with position-aware grouping
- **Intelligent Parsing**: Identifies glosas, definitions, verb types, synonyms, and antonyms
- **Image Management**: Saves images with semantic filenames (e.g., `abandonar_0.jpeg`)
- **Multi-Language Database**: Extensible schema supporting multiple sign languages and target languages
- **Quality Assurance**: Validation reports, duplicate detection, dry-run mode
- **Dockerized**: Everything runs in Docker - no local installations required
- **CLI Interface**: Flexible command-line tool with extensive options

---

## 📋 Prerequisites

- **Docker** and **Docker Compose** installed
- PDF dictionary files (place in `./pdfs/`)
- `.env` file with database password (see Setup)

---

## ⚡ Quick Start

### 1. Setup Environment

```bash
# Clone repository
cd /path/to/skywardHackathon

# Create .env file from template
cp .env.example .env

# Edit .env and set your database password
# DB_PASSWORD=your_secure_password_here
```

### 2. Start Services

```bash
# Build and start PostgreSQL and extraction service
docker-compose up -d

# Check services are running
docker-compose ps
```

### 3. Run Extraction (Dry-Run)

```bash
# Test extraction without database storage
docker-compose exec extractor python -m src.extract_lsch \
  --pdf /app/pdfs/21pages.pdf \
  --output-dir /app/output/images \
  --language-code lsch \
  --region Metropolitan \
  --start-page 6 \
  --dry-run \
  --preview-output /app/output/preview.json
```

### 4. Run Full Extraction

```bash
# Extract and save to database
docker-compose exec extractor python -m src.extract_lsch \
  --pdf /app/pdfs/diccionario_lsch_1.pdf \
  --output-dir /app/output/images \
  --language-code lsch \
  --region Metropolitan \
  --start-page 6
```

### 5. Verify Data

```bash
# Access PostgreSQL
docker-compose exec postgres psql -U signos -d signos_db

# Run queries
SELECT COUNT(*) FROM signs;
SELECT * FROM v_signs_complete LIMIT 5;
```

---

## 📁 Project Structure

```
skywardHackathon/
├── docker-compose.yml          # Docker services configuration
├── Dockerfile                  # Python service image
├── requirements.txt            # Python dependencies
├── .env.example               # Environment template
├── README.md                  # This file
│
├── src/
│   ├── extract_lsch.py        # Main CLI entry point
│   ├── models/
│   │   └── sign.py            # Pydantic data models
│   ├── extractor/
│   │   ├── pdf_processor.py   # PDF extraction logic
│   │   ├── parser.py          # Text parsing engine
│   │   └── image_handler.py   # Image saving/management
│   └── database/
│       ├── schema.sql         # Database schema
│       └── repository.py      # Database operations
│
├── pdfs/                      # Place PDF files here
├── output/
│   ├── images/               # Extracted images (organized by letter)
│   └── preview.json          # Dry-run output
│
└── README.md
```

---

## 🗄️ Database Schema

### Core Tables

- **`dictionaries`**: Language/region metadata (lsch, asl, lsm, etc.)
- **`signs`**: Main sign entries with glosas, definitions, verb types
- **`sign_translations`**: Multi-language translations (es, en, pt, etc.)
- **`sign_relations`**: Synonyms, antonyms, related terms
- **`sign_images`**: Images with sequence order for movements
- **`sign_variants`**: Regional/alternative sign variants
- **`extraction_log`**: Audit trail of extraction runs

### Multi-Language Design

The schema supports:
- Multiple sign languages (Chilean, American, Mexican, etc.)
- Multiple target languages (Spanish, English, Portuguese, etc.)
- Regional variants within a sign language
- Easy addition of new languages without schema changes

Example: Adding American Sign Language (ASL):

```sql
INSERT INTO dictionaries (language_code, language_name, target_language, region)
VALUES ('asl', 'American Sign Language', 'en', 'General');
```

---

## 🎯 Usage Examples

### Process Multiple PDFs

```bash
docker-compose exec extractor python -m src.extract_lsch \
  --pdf /app/pdfs/dict_volume1.pdf \
  --pdf /app/pdfs/dict_volume2.pdf \
  --output-dir /app/output/images \
  --language-code lsch \
  --start-page 6
```

### Custom Page Range

```bash
docker-compose exec extractor python -m src.extract_lsch \
  --pdf /app/pdfs/dictionary.pdf \
  --output-dir /app/output/images \
  --language-code lsch \
  --start-page 6 \
  --end-page 50
```

### Debug Mode

```bash
docker-compose exec extractor python -m src.extract_lsch \
  --pdf /app/pdfs/test.pdf \
  --output-dir /app/output/images \
  --language-code lsch \
  --log-level DEBUG \
  --log-file /app/output/extraction.log
```

---

## 🔍 CLI Options

```
Required:
  --pdf PATH                PDF file path (can specify multiple times)
  --output-dir PATH         Output directory for images

Dictionary Metadata:
  --language-code CODE      Language code (default: lsch)
  --language-name NAME      Language name (default: Lengua de Señas Chilena)
  --target-language CODE    Target language (default: es)
  --region NAME             Region (default: Metropolitan)
  --version VERSION         Dictionary version

Processing:
  --start-page NUM          First page to process (default: 6)
  --end-page NUM            Last page to process (default: all)

Output:
  --dry-run                 Extract without saving to database
  --preview-output PATH     Save JSON preview file
  --log-file PATH           Log file path
  --log-level LEVEL         DEBUG|INFO|WARNING|ERROR (default: INFO)

Database:
  --db-host HOST            Database host (default: from DB_HOST env)
  --db-port PORT            Database port (default: from DB_PORT env)
  --db-name NAME            Database name (default: from DB_NAME env)
  --db-user USER            Database user (default: from DB_USER env)
  --db-password PASS        Database password (default: from DB_PASSWORD env)
```

---

## 📊 Validation Report

After extraction, you'll see a summary:

```
============================================================
EXTRACTION SUMMARY
============================================================
Total entries: 247
Successful: 242
Failed: 5
Success rate: 98.0%
Entries without images: 3
Entries without definition: 1
Entries without translations: 0
Duplicate glosas found: 2
============================================================
```

---

## 🛠️ Development

### Live Code Editing

Source code is volume-mounted, so you can edit without rebuilding:

```bash
# Edit code on your machine
vim src/extractor/parser.py

# Changes are immediately available in container
docker-compose exec extractor python -m src.extract_lsch --help
```

### Rebuild After Dependency Changes

```bash
# Rebuild image after updating requirements.txt
docker-compose build extractor

# Restart services
docker-compose up -d
```

### Database Migrations

```bash
# Access database
docker-compose exec postgres psql -U signos -d signos_db

# Run custom SQL
\i /docker-entrypoint-initdb.d/01-schema.sql
```

---

## 🧪 Testing

### Test with Sample PDF

```bash
# Test with the 21-page sample
docker-compose exec extractor python -m src.extract_lsch \
  --pdf /app/pdfs/21pages.pdf \
  --output-dir /app/output/test_images \
  --language-code lsch \
  --start-page 6 \
  --dry-run \
  --preview-output /app/output/test_preview.json \
  --log-level DEBUG
```

### Verify Extraction

```bash
# Check output images
ls -lh output/test_images/A/

# View JSON preview
cat output/test_preview.json | jq '.validation_report'

# Check specific entry
cat output/test_preview.json | jq '.entries[] | select(.glosa == "ABANDONAR")'
```

---

## 📈 Example Queries

### Get all signs starting with "A"

```sql
SELECT glosa, definition, grammatical_category
FROM signs
WHERE glosa LIKE 'A%'
ORDER BY glosa;
```

### Get sign with images and translations

```sql
SELECT *
FROM v_signs_complete
WHERE glosa = 'ABANDONAR';
```

### Count signs by grammatical category

```sql
SELECT grammatical_category, COUNT(*)
FROM signs
GROUP BY grammatical_category
ORDER BY count DESC;
```

### Find signs with movement sequences (multiple images)

```sql
SELECT s.glosa, COUNT(si.id) as image_count
FROM signs s
JOIN sign_images si ON s.id = si.sign_id
GROUP BY s.id, s.glosa
HAVING COUNT(si.id) > 1
ORDER BY image_count DESC;
```

---

## 🔧 Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
docker-compose ps

# Check logs
docker-compose logs postgres

# Verify credentials in .env
cat .env
```

### No Images Extracted

- Ensure PDF has images (not scanned text)
- Check page range: `--start-page 6` (skip intro pages)
- Try debug mode: `--log-level DEBUG`

### Parsing Errors

- Check PDF text encoding (should be searchable text, not images)
- Verify entry format matches expected structure
- Review failed entries in preview JSON

### Permission Issues

```bash
# Fix output directory permissions
sudo chown -R $USER:$USER output/
```

---

## 🚀 Next Steps for Hackathon

1. **Extract Full Dictionary**: Run extraction on complete PDF volumes
2. **Build API**: Create REST API to serve signs to your app
3. **3D Avatar Integration**: Map glosas to avatar animations
4. **Real-time Processing**: Connect to live streams/presentations
5. **Mobile App**: Build frontend consuming the API

---

## 📝 Architecture Overview

```
┌─────────────┐
│   PDF File  │
└──────┬──────┘
       │
       v
┌──────────────────┐
│  PDFProcessor    │  Extract images + text with positions
└────────┬─────────┘
         │
         v
┌──────────────────┐
│  EntryParser     │  Parse glosas, definitions, metadata
└────────┬─────────┘
         │
         v
┌──────────────────┐
│  ImageHandler    │  Save images with semantic filenames
└────────┬─────────┘
         │
         v
┌──────────────────┐
│  SignRepository  │  Store in PostgreSQL
└────────┬─────────┘
         │
         v
┌──────────────────┐
│   PostgreSQL     │  Multi-language schema
└──────────────────┘
```

---

## 📄 License

MIT License - built for educational purposes during Skyward Hackathon.

---

## 🤝 Contributing

Contributions welcome! This system is designed to be extensible:

- Add new sign languages by inserting dictionary metadata
- Customize parsing rules in `parser.py`
- Extend database schema for additional metadata

---

## 📧 Support

For issues or questions:
- Check logs: `docker-compose logs extractor`
- Review preview JSON for parsing issues
- Verify database with SQL queries

---

**Built with ❤️ for the Deaf community**
