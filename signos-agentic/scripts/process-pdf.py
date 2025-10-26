#!/usr/bin/env python3
"""
Script para procesar PDFs y generar embeddings para el Knowledge RAG

Uso:
    python process-pdf.py --pdf documento.pdf --title "Título" --category historia
    python process-pdf.py --pdf-dir data/pdfs/ --batch
"""

import argparse
import json
import os
import re
from pathlib import Path
from typing import List, Dict
import pdfplumber
import requests
from dotenv import load_dotenv

load_dotenv()

WORKER_URL = os.getenv('WORKER_URL', 'http://localhost:53973')
CHUNK_SIZE = 1000  # caracteres por chunk
CHUNK_OVERLAP = 200  # overlap entre chunks


def extract_text_from_file(file_path: str) -> str:
    """Extrae texto de un PDF o archivo de texto"""
    print(f"📄 Extrayendo texto de: {file_path}")
    
    # Si es un archivo .txt, leer directamente
    if file_path.endswith('.txt'):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
                print(f"✅ Extraídos {len(text)} caracteres")
                return text
        except Exception as e:
            print(f"❌ Error leyendo archivo: {e}")
            return ""
    
    # Si es PDF, usar pdfplumber
    text_parts = []
    
    try:
        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
                    print(f"  ✓ Página {i+1}/{len(pdf.pages)}")
    except Exception as e:
        print(f"❌ Error extrayendo PDF: {e}")
        return ""
    
    full_text = "\n\n".join(text_parts)
    print(f"✅ Extraídos {len(full_text)} caracteres")
    return full_text


def clean_text(text: str) -> str:
    """Limpia el texto extraído"""
    # Eliminar múltiples espacios/newlines
    text = re.sub(r'\s+', ' ', text)
    # Eliminar caracteres especiales problemáticos
    text = text.replace('\x00', '')
    # Normalizar quotes
    text = text.replace('"', '"').replace('"', '"')
    text = text.replace(''', "'").replace(''', "'")
    return text.strip()


def split_into_chunks(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Divide el texto en chunks con overlap"""
    print(f"📦 Dividiendo en chunks de {chunk_size} caracteres (overlap: {overlap})")
    
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        
        # Intentar cortar en punto o párrafo
        if end < len(text):
            last_period = chunk.rfind('.')
            last_newline = chunk.rfind('\n')
            cut_point = max(last_period, last_newline)
            
            if cut_point > chunk_size * 0.5:  # Si está en la segunda mitad
                chunk = chunk[:cut_point + 1]
                end = start + cut_point + 1
        
        chunks.append(chunk.strip())
        start = end - overlap
    
    print(f"✅ Generados {len(chunks)} chunks")
    return chunks


def generate_embedding(text: str) -> List[float]:
    """Genera embedding usando el worker"""
    try:
        response = requests.post(
            f"{WORKER_URL}/api/embedding",
            json={"text": text},
            timeout=30
        )
        response.raise_for_status()
        return response.json()['embedding']
    except Exception as e:
        print(f"❌ Error generando embedding: {e}")
        return []


def process_pdf_to_knowledge(
    pdf_path: str,
    title: str,
    category: str,
    tags: List[str] = None
) -> List[Dict]:
    """Procesa un PDF completo y genera chunks con embeddings"""
    
    print(f"\n🚀 Procesando PDF: {pdf_path}")
    print(f"   Título: {title}")
    print(f"   Categoría: {category}")
    
    # Extraer texto
    text = extract_text_from_file(pdf_path)
    if not text:
        return []
    
    # Limpiar texto
    text = clean_text(text)
    
    # Dividir en chunks
    chunks = split_into_chunks(text)
    
    # Generar ID base
    pdf_filename = Path(pdf_path).stem
    
    # Procesar cada chunk
    knowledge_items = []
    
    for i, chunk in enumerate(chunks):
        print(f"📊 Procesando chunk {i+1}/{len(chunks)}...")
        
        chunk_id = f"{pdf_filename}_chunk_{i}"
        chunk_title = f"{title} (Parte {i+1}/{len(chunks)})" if len(chunks) > 1 else title
        
        knowledge_item = {
            "id": chunk_id,
            "title": chunk_title,
            "content": chunk,
            "category": category,
            "tags": tags or [category],
            "source": pdf_filename,
            "chunk_index": i,
            "total_chunks": len(chunks)
        }
        
        knowledge_items.append(knowledge_item)
    
    print(f"✅ Procesado: {len(knowledge_items)} items de conocimiento")
    return knowledge_items


def generate_embeddings_for_items(items: List[Dict]) -> List[Dict]:
    """Genera embeddings para items de conocimiento"""
    print(f"\n🔢 Generando embeddings para {len(items)} items...")
    
    vectorize_items = []
    
    for i, item in enumerate(items):
        print(f"  {i+1}/{len(items)}: {item['id']}")
        
        # Generar embedding del contenido
        embedding = generate_embedding(item['content'])
        
        if not embedding:
            print(f"  ⚠️  Saltando (error en embedding)")
            continue
        
        vectorize_item = {
            "id": item['id'],
            "values": embedding,
            "metadata": {
                "title": item['title'],
                "content": item['content'][:2000],  # Truncar para metadata
                "category": item['category'],
                "tags": json.dumps(item.get('tags', [])),
                "source": item.get('source', ''),
                "chunk_index": item.get('chunk_index', 0),
                "total_chunks": item.get('total_chunks', 1)
            }
        }
        
        vectorize_items.append(vectorize_item)
    
    print(f"✅ Generados {len(vectorize_items)} embeddings")
    return vectorize_items


def save_to_ndjson(items: List[Dict], output_file: str):
    """Guarda items en formato NDJSON para Vectorize"""
    print(f"\n💾 Guardando en {output_file}...")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        for item in items:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    
    print(f"✅ Guardado: {len(items)} vectores")
    print(f"\n📤 Para subir a Vectorize:")
    print(f"   wrangler vectorize insert signos-knowledge-index --file={output_file}")


def main():
    parser = argparse.ArgumentParser(description='Procesar PDFs para Knowledge RAG')
    parser.add_argument('--pdf', type=str, help='Ruta al PDF')
    parser.add_argument('--pdf-dir', type=str, help='Directorio con PDFs (modo batch)')
    parser.add_argument('--title', type=str, help='Título del documento')
    parser.add_argument('--category', type=str, required=True,
                       choices=['historia', 'gramatica', 'cultura', 'tecnica', 'linguistica', 'aprendizaje'],
                       help='Categoría del contenido')
    parser.add_argument('--tags', type=str, help='Tags separados por comas')
    parser.add_argument('--output', type=str, default='knowledge-embeddings.ndjson',
                       help='Archivo de salida')
    parser.add_argument('--batch', action='store_true', help='Procesar todos los PDFs en directorio')
    
    args = parser.parse_args()
    
    all_knowledge_items = []
    
    # Modo single PDF
    if args.pdf:
        if not args.title:
            parser.error("--title es requerido cuando se usa --pdf")
        
        tags = args.tags.split(',') if args.tags else [args.category]
        
        items = process_pdf_to_knowledge(
            args.pdf,
            args.title,
            args.category,
            tags
        )
        all_knowledge_items.extend(items)
    
    # Modo batch directory
    elif args.pdf_dir:
        pdf_dir = Path(args.pdf_dir)
        pdf_files = list(pdf_dir.glob('*.pdf')) + list(pdf_dir.glob('*.txt'))
        
        print(f"\n📚 Encontrados {len(pdf_files)} archivos en {pdf_dir}")
        
        for pdf_file in pdf_files:
            title = args.title or pdf_file.stem.replace('_', ' ').replace('-', ' ').title()
            tags = args.tags.split(',') if args.tags else [args.category]
            
            items = process_pdf_to_knowledge(
                str(pdf_file),
                title,
                args.category,
                tags
            )
            all_knowledge_items.extend(items)
    
    else:
        parser.error("Debe especificar --pdf o --pdf-dir")
    
    if not all_knowledge_items:
        print("❌ No se generaron items de conocimiento")
        return
    
    # Generar embeddings
    vectorize_items = generate_embeddings_for_items(all_knowledge_items)
    
    if not vectorize_items:
        print("❌ No se generaron embeddings")
        return
    
    # Guardar
    save_to_ndjson(vectorize_items, args.output)
    
    print("\n✅ ¡Proceso completado!")
    print(f"\n📊 Resumen:")
    print(f"   Total items: {len(all_knowledge_items)}")
    print(f"   Vectores generados: {len(vectorize_items)}")
    print(f"   Categoría: {args.category}")


if __name__ == '__main__':
    main()

