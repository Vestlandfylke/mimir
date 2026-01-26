#!/usr/bin/env python3
"""Extract text from PDFs and create JSON files for Azure AI Search upload."""

import json
import os
import sys
from pathlib import Path
import hashlib
from datetime import datetime

import PyPDF2

def extract_pdf_text(pdf_path: Path) -> str:
    """Extract text from a PDF file."""
    text_parts = []
    try:
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
    except Exception as e:
        print(f"  Error reading {pdf_path.name}: {e}")
        return ""
    return '\n\n'.join(text_parts)

def generate_id(title: str) -> str:
    """Generate a unique ID from title."""
    return hashlib.md5(title.encode()).hexdigest()[:16]

def get_category(filename: str) -> str:
    """Determine category based on filename."""
    lower = filename.lower()
    if 'kompetanse' in lower:
        return 'kompetanse'
    elif 'medarbeidar' in lower:
        return 'hr'
    elif 'leiar' in lower:
        return 'leiarutvikling'
    elif 'strategi' in lower or 'organisasjon' in lower:
        return 'strategi'
    elif 'likestil' in lower or 'handlingsplan' in lower:
        return 'policy'
    else:
        return 'generelt'

def main():
    input_dir = Path(r"D:\mimir_experimental\mimir\leiar documents")
    output_dir = Path(r"D:\mimir_experimental\mimir\tools\leiar-kontekst-index\extracted-documents")
    output_dir.mkdir(exist_ok=True)
    
    documents = []
    
    for pdf_file in input_dir.glob("*.pdf"):
        print(f"Processing: {pdf_file.name}")
        
        text = extract_pdf_text(pdf_file)
        if not text:
            print(f"  Skipped (no text extracted)")
            continue
        
        # Clean up title from filename
        title = pdf_file.stem.replace('-', ' ').replace('_', ' ')
        title = ' '.join(title.split())  # Normalize whitespace
        
        # Remove year prefixes like "2025 " or "2025.02 "
        import re
        title = re.sub(r'^\d{4}\.?\d{0,2}\s*', '', title)
        
        category = get_category(pdf_file.name)
        
        doc = {
            "id": generate_id(title),
            "title": title,
            "content": text,
            "category": category,
            "source": str(pdf_file),
            "lastUpdated": datetime.utcnow().isoformat() + "Z"
        }
        
        documents.append(doc)
        
        # Also write individual file
        doc_file = output_dir / f"{doc['id']}.json"
        with open(doc_file, 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, indent=2)
        
        print(f"  Extracted: {len(text)} chars, category: {category}")
    
    # Write combined file
    combined_file = output_dir / "all-documents.json"
    with open(combined_file, 'w', encoding='utf-8') as f:
        json.dump(documents, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ Extracted {len(documents)} PDFs")
    print(f"✓ Output written to: {output_dir}")

if __name__ == "__main__":
    main()
