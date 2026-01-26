#!/usr/bin/env python3
"""
Document Chunking and Embedding Script for Leiar Kontekst Index

This script:
1. Reads documents from various formats (PDF, DOCX, TXT, MD)
2. Chunks them into appropriate sizes for search
3. Generates embeddings using Azure OpenAI
4. Outputs JSON files ready for upload to Azure AI Search

Requirements:
    pip install openai tiktoken python-docx PyPDF2 langchain-text-splitters

Usage:
    python chunk-and-embed.py --input ./raw-documents --output ./chunked-documents
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime
import hashlib

try:
    import tiktoken
    from openai import AzureOpenAI
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install openai tiktoken langchain-text-splitters")
    sys.exit(1)

# Optional dependencies for document parsing
try:
    from docx import Document as DocxDocument
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False
    print("Warning: python-docx not installed. DOCX files will be skipped.")

try:
    import PyPDF2
    HAS_PDF = True
except ImportError:
    HAS_PDF = False
    print("Warning: PyPDF2 not installed. PDF files will be skipped.")


class DocumentProcessor:
    """Processes documents into chunks with embeddings."""
    
    def __init__(
        self,
        azure_endpoint: str = None,
        azure_api_key: str = None,
        embedding_model: str = "text-embedding-ada-002",
        chunk_size: int = 512,
        chunk_overlap: int = 50,
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.embedding_model = embedding_model
        
        # Initialize tokenizer
        self.encoding = tiktoken.get_encoding("cl100k_base")
        
        # Initialize text splitter
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=self._token_length,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        
        # Initialize Azure OpenAI client if credentials provided
        self.client = None
        if azure_endpoint and azure_api_key:
            self.client = AzureOpenAI(
                azure_endpoint=azure_endpoint,
                api_key=azure_api_key,
                api_version="2024-02-01"
            )
            print(f"Embedding enabled with model: {embedding_model}")
        else:
            print("Warning: No Azure OpenAI credentials. Embeddings will be skipped.")
    
    def _token_length(self, text: str) -> int:
        """Count tokens in text."""
        return len(self.encoding.encode(text))
    
    def _generate_id(self, title: str, chunk_index: int) -> str:
        """Generate a unique ID for a document chunk."""
        base = f"{title}-{chunk_index}"
        return hashlib.md5(base.encode()).hexdigest()[:16]
    
    def _extract_title(self, content: str, filename: str) -> str:
        """Extract title from content or use filename."""
        # Try to find markdown heading
        match = re.match(r'^#\s+(.+?)$', content, re.MULTILINE)
        if match:
            return match.group(1).strip()
        
        # Try first non-empty line
        lines = content.strip().split('\n')
        if lines:
            first_line = lines[0].strip()
            if first_line and len(first_line) < 200:
                return first_line
        
        # Fall back to filename
        return Path(filename).stem.replace('-', ' ').replace('_', ' ').title()
    
    def _read_file(self, filepath: Path) -> str:
        """Read content from various file formats."""
        suffix = filepath.suffix.lower()
        
        if suffix in ['.txt', '.md']:
            return filepath.read_text(encoding='utf-8')
        
        elif suffix == '.json':
            data = json.loads(filepath.read_text(encoding='utf-8'))
            if isinstance(data, dict) and 'content' in data:
                return data['content']
            return json.dumps(data, indent=2)
        
        elif suffix == '.docx' and HAS_DOCX:
            doc = DocxDocument(filepath)
            return '\n\n'.join([para.text for para in doc.paragraphs if para.text.strip()])
        
        elif suffix == '.pdf' and HAS_PDF:
            text = []
            with open(filepath, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text.append(page.extract_text())
            return '\n\n'.join(text)
        
        else:
            print(f"  Skipping unsupported format: {suffix}")
            return None
    
    def _get_embedding(self, text: str) -> List[float]:
        """Generate embedding for text."""
        if not self.client:
            return None
        
        try:
            response = self.client.embeddings.create(
                input=text,
                model=self.embedding_model
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"  Warning: Embedding failed: {e}")
            return None
    
    def process_file(
        self,
        filepath: Path,
        category: str = "generelt",
        source_base_url: str = None
    ) -> List[Dict[str, Any]]:
        """Process a single file into chunks."""
        print(f"Processing: {filepath.name}")
        
        content = self._read_file(filepath)
        if not content:
            return []
        
        title = self._extract_title(content, filepath.name)
        source = source_base_url or str(filepath.absolute())
        
        # Split into chunks
        chunks = self.text_splitter.split_text(content)
        print(f"  Split into {len(chunks)} chunks")
        
        documents = []
        for i, chunk in enumerate(chunks):
            doc = {
                "id": self._generate_id(title, i),
                "title": title if len(chunks) == 1 else f"{title} (del {i+1}/{len(chunks)})",
                "content": chunk,
                "category": category,
                "source": source,
                "lastUpdated": datetime.utcnow().isoformat() + "Z",
                "metadata": json.dumps({
                    "chunkIndex": i,
                    "totalChunks": len(chunks),
                    "originalFile": filepath.name,
                    "tokenCount": self._token_length(chunk)
                })
            }
            
            # Generate embedding if available
            embedding = self._get_embedding(chunk)
            if embedding:
                doc["contentVector"] = embedding
            
            documents.append(doc)
        
        return documents
    
    def process_directory(
        self,
        input_dir: Path,
        category_mapping: Dict[str, str] = None
    ) -> List[Dict[str, Any]]:
        """Process all documents in a directory."""
        all_documents = []
        
        # Supported extensions
        extensions = ['.txt', '.md', '.json']
        if HAS_DOCX:
            extensions.append('.docx')
        if HAS_PDF:
            extensions.append('.pdf')
        
        for filepath in input_dir.rglob('*'):
            if filepath.suffix.lower() in extensions:
                # Determine category from folder name or mapping
                category = "generelt"
                if category_mapping:
                    for pattern, cat in category_mapping.items():
                        if pattern.lower() in str(filepath).lower():
                            category = cat
                            break
                elif filepath.parent != input_dir:
                    category = filepath.parent.name
                
                documents = self.process_file(filepath, category=category)
                all_documents.extend(documents)
        
        return all_documents


def main():
    parser = argparse.ArgumentParser(
        description="Chunk documents and generate embeddings for Azure AI Search"
    )
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="Input directory containing documents"
    )
    parser.add_argument(
        "--output", "-o",
        required=True,
        help="Output directory for chunked JSON files"
    )
    parser.add_argument(
        "--azure-endpoint",
        default=os.environ.get("AZURE_OPENAI_ENDPOINT"),
        help="Azure OpenAI endpoint (or set AZURE_OPENAI_ENDPOINT env var)"
    )
    parser.add_argument(
        "--azure-api-key",
        default=os.environ.get("AZURE_OPENAI_API_KEY"),
        help="Azure OpenAI API key (or set AZURE_OPENAI_API_KEY env var)"
    )
    parser.add_argument(
        "--embedding-model",
        default="text-embedding-ada-002",
        help="Embedding model deployment name"
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=512,
        help="Target chunk size in tokens (default: 512)"
    )
    parser.add_argument(
        "--chunk-overlap",
        type=int,
        default=50,
        help="Overlap between chunks in tokens (default: 50)"
    )
    
    args = parser.parse_args()
    
    input_dir = Path(args.input)
    output_dir = Path(args.output)
    
    if not input_dir.exists():
        print(f"Error: Input directory '{input_dir}' does not exist")
        sys.exit(1)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Initialize processor
    processor = DocumentProcessor(
        azure_endpoint=args.azure_endpoint,
        azure_api_key=args.azure_api_key,
        embedding_model=args.embedding_model,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap
    )
    
    # Category mapping based on folder names
    category_mapping = {
        "strategi": "strategi",
        "retningslin": "retningslinjer",
        "policy": "policy",
        "hr": "hr",
        "økonomi": "okonomi",
        "okonomi": "okonomi",
        "kvalitet": "kvalitet",
        "organisasjon": "organisasjon"
    }
    
    # Process all documents
    print(f"\nProcessing documents from: {input_dir}")
    documents = processor.process_directory(input_dir, category_mapping)
    
    if not documents:
        print("No documents processed")
        sys.exit(0)
    
    # Write output
    output_file = output_dir / "documents.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(documents, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ Processed {len(documents)} document chunks")
    print(f"✓ Output written to: {output_file}")
    
    # Also write individual files for easier review
    for doc in documents:
        doc_file = output_dir / f"{doc['id']}.json"
        with open(doc_file, 'w', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, indent=2)
    
    print(f"✓ Individual files written to: {output_dir}")
    
    # Summary
    print("\n=== Summary ===")
    categories = {}
    for doc in documents:
        cat = doc.get('category', 'unknown')
        categories[cat] = categories.get(cat, 0) + 1
    
    for cat, count in sorted(categories.items()):
        print(f"  {cat}: {count} chunks")
    
    has_embeddings = any('contentVector' in doc for doc in documents)
    print(f"\n  Embeddings: {'Yes' if has_embeddings else 'No'}")


if __name__ == "__main__":
    main()
