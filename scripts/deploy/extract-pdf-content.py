#!/usr/bin/env python3
"""
PDF Content Extractor for Leiar Dokumenter

Extracts text content from PDF files using either:
1. PyMuPDF (fitz) - Fast, local extraction for text-based PDFs
2. Azure Document Intelligence - Better for complex layouts, images, tables, OCR

Usage:
    # Basic extraction with PyMuPDF
    python extract-pdf-content.py --input "../../leiar documents" --output "./extracted-content"
    
    # Using Azure Document Intelligence (better for images/complex layouts)
    python extract-pdf-content.py --input "../../leiar documents" --output "./extracted-content" \
        --azure-endpoint "https://your-resource.cognitiveservices.azure.com/" \
        --azure-key "your-api-key"

Requirements:
    pip install pymupdf
    pip install azure-ai-documentintelligence  # For Azure Document Intelligence
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Optional, Tuple

# Show Python info for debugging
PYTHON_INFO = f"Python {sys.version} at {sys.executable}"

try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError as e:
    PYMUPDF_AVAILABLE = False
    PYMUPDF_ERROR = str(e)

# Azure Document Intelligence support
AZURE_DI_AVAILABLE = False
AZURE_DI_ERROR = None
try:
    from azure.ai.documentintelligence import DocumentIntelligenceClient
    from azure.ai.documentintelligence.models import AnalyzeDocumentRequest, DocumentContentFormat
    from azure.core.credentials import AzureKeyCredential
    AZURE_DI_AVAILABLE = True
except ImportError as e:
    AZURE_DI_ERROR = str(e)


def clean_text(text: str, strip_html: bool = False) -> str:
    """Clean extracted text by removing excessive whitespace and normalizing."""
    
    if strip_html:
        # Remove HTML comments (PageBreak, PageNumber, PageHeader, etc.)
        text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
        
        # Remove figure tags but keep content
        text = re.sub(r'</?figure>', '', text)
        
        # Convert HTML tables to plain text
        # Remove table tags
        text = re.sub(r'</?table>', '', text)
        text = re.sub(r'</?thead>', '', text)
        text = re.sub(r'</?tbody>', '', text)
        # Convert rows to lines
        text = re.sub(r'<tr>', '', text)
        text = re.sub(r'</tr>', '\n', text)
        # Convert cells to tab-separated
        text = re.sub(r'<t[hd][^>]*>', '', text)
        text = re.sub(r'</t[hd]>', '\t', text)
        
        # Remove any remaining HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        
        # Decode HTML entities
        text = text.replace('&amp;', '&')
        text = text.replace('&lt;', '<')
        text = text.replace('&gt;', '>')
        text = text.replace('&nbsp;', ' ')
        text = text.replace('&quot;', '"')
    
    # Replace multiple spaces with single space
    text = re.sub(r'[ \t]+', ' ', text)
    # Replace multiple newlines with double newline (paragraph break)
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Remove leading/trailing whitespace from lines
    lines = [line.strip() for line in text.split('\n')]
    text = '\n'.join(lines)
    # Remove empty lines at start/end
    text = text.strip()
    return text


def extract_with_pymupdf(pdf_path: str, strip_html: bool = False) -> Tuple[str, dict]:
    """
    Extract text from a PDF file using PyMuPDF.
    Good for text-based PDFs, fast and local.
    """
    if not PYMUPDF_AVAILABLE:
        raise ImportError("PyMuPDF not installed. Run: pip install pymupdf")
    
    doc = fitz.open(pdf_path)
    
    metadata = {
        "page_count": len(doc),
        "title": doc.metadata.get("title", ""),
        "author": doc.metadata.get("author", ""),
        "extraction_method": "pymupdf",
        "has_images": False
    }
    
    all_text = []
    
    for page_num, page in enumerate(doc):
        page_text = page.get_text("text")
        
        # Check for images
        images = page.get_images()
        if images:
            metadata["has_images"] = True
        
        if page_text.strip():
            all_text.append(f"--- Side {page_num + 1} ---\n{page_text}")
    
    doc.close()
    
    full_text = "\n\n".join(all_text)
    full_text = clean_text(full_text, strip_html=strip_html)
    
    return full_text, metadata


def extract_with_azure_di(pdf_path: str, endpoint: str, api_key: str, strip_html: bool = False) -> Tuple[str, dict]:
    """
    Extract text from a PDF file using Azure Document Intelligence.
    Better for complex layouts, tables, images with text (OCR).
    """
    if not AZURE_DI_AVAILABLE:
        raise ImportError(
            f"Azure Document Intelligence SDK not installed.\n"
            f"  Python: {sys.executable}\n"
            f"  Error: {AZURE_DI_ERROR}\n"
            f"  Fix: {sys.executable} -m pip install azure-ai-documentintelligence"
        )
    
    client = DocumentIntelligenceClient(
        endpoint=endpoint,
        credential=AzureKeyCredential(api_key)
    )
    
    # Read the PDF file
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()
    
    # Analyze the document using the prebuilt-layout model (handles text, tables, images)
    # SDK 1.0.x uses AnalyzeDocumentRequest with bytes_source
    poller = client.begin_analyze_document(
        "prebuilt-layout",
        AnalyzeDocumentRequest(bytes_source=pdf_bytes),
        output_content_format=DocumentContentFormat.MARKDOWN,  # Get markdown for better structure
    )
    
    result = poller.result()
    
    metadata = {
        "page_count": len(result.pages) if result.pages else 0,
        "extraction_method": "azure-document-intelligence",
        "has_tables": bool(result.tables) if hasattr(result, 'tables') and result.tables else False,
        "has_figures": bool(result.figures) if hasattr(result, 'figures') and result.figures else False,
        "content_format": str(result.content_format) if hasattr(result, 'content_format') else "text",
        "model_id": "prebuilt-layout"
    }
    
    # Get the content (markdown format preserves structure)
    full_text = result.content if result.content else ""
    full_text = clean_text(full_text, strip_html=strip_html)
    
    return full_text, metadata


def extract_text_from_pdf(
    pdf_path: str, 
    azure_endpoint: Optional[str] = None, 
    azure_key: Optional[str] = None,
    force_azure: bool = False,
    strip_html: bool = False
) -> Tuple[str, dict]:
    """
    Extract text from a PDF file.
    
    Args:
        pdf_path: Path to the PDF file
        azure_endpoint: Azure Document Intelligence endpoint (optional)
        azure_key: Azure Document Intelligence API key (optional)
        force_azure: Always use Azure DI even for simple PDFs
        strip_html: Remove HTML tags from output
        
    Returns:
        Tuple of (extracted_text, metadata_dict)
    """
    use_azure = azure_endpoint and azure_key
    
    # If Azure is available and requested, use it
    if use_azure and (force_azure or not PYMUPDF_AVAILABLE):
        return extract_with_azure_di(pdf_path, azure_endpoint, azure_key, strip_html)
    
    # Try PyMuPDF first
    if PYMUPDF_AVAILABLE:
        text, metadata = extract_with_pymupdf(pdf_path, strip_html)
        
        # If the PDF has images and Azure is available, re-extract with Azure
        # This ensures we get text from images via OCR
        if use_azure and metadata.get("has_images"):
            print(f"    Document contains images, using Azure DI for OCR...")
            return extract_with_azure_di(pdf_path, azure_endpoint, azure_key, strip_html)
        
        return text, metadata
    
    # Fallback to Azure if PyMuPDF not available
    if use_azure:
        return extract_with_azure_di(pdf_path, azure_endpoint, azure_key, strip_html)
    
    raise RuntimeError("No PDF extraction method available. Install pymupdf or provide Azure credentials.")


def extract_all_pdfs(
    input_dir: str, 
    output_dir: str, 
    azure_endpoint: Optional[str] = None,
    azure_key: Optional[str] = None,
    force_azure: bool = False,
    strip_html: bool = False
) -> dict:
    """
    Extract text from all PDFs in a directory.
    """
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    
    # Create output directory
    output_path.mkdir(parents=True, exist_ok=True)
    
    results = {
        "total_files": 0,
        "successful": 0,
        "failed": 0,
        "extraction_method": "azure-document-intelligence" if (azure_endpoint and azure_key) else "pymupdf",
        "files": []
    }
    
    # Get all PDF and TXT files (use set to avoid duplicates on case-insensitive filesystems)
    pdf_files = set(input_path.glob("*.pdf")) | set(input_path.glob("*.PDF"))
    txt_files = set(input_path.glob("*.txt")) | set(input_path.glob("*.TXT"))
    all_files = list(pdf_files | txt_files)
    results["total_files"] = len(all_files)
    
    print(f"\nPython: {sys.executable}")
    print(f"Found {len(pdf_files)} PDF files and {len(txt_files)} TXT files in {input_dir}")
    print(f"Output directory: {output_dir}")
    
    if azure_endpoint and azure_key:
        print(f"Using Azure Document Intelligence for extraction")
        if force_azure:
            print("  (forced for all documents)")
        else:
            print("  (for documents with images/complex layouts)")
    elif PYMUPDF_AVAILABLE:
        print("Using PyMuPDF for extraction (local, fast)")
    else:
        print("ERROR: No extraction method available!")
        return results
    
    print("-" * 60)
    
    for file in sorted(all_files):
        print(f"\nProcessing: {file.name}")
        
        try:
            if file.suffix.lower() == '.txt':
                # Just copy text files
                with open(file, 'r', encoding='utf-8') as f:
                    text = f.read()
                metadata = {
                    "extraction_method": "direct-read",
                    "page_count": 1
                }
            else:
                # Extract from PDF
                text, metadata = extract_text_from_pdf(
                    str(file), 
                    azure_endpoint, 
                    azure_key,
                    force_azure,
                    strip_html
                )
                
                # Rate limiting for Azure API
                if metadata.get("extraction_method") == "azure-document-intelligence":
                    time.sleep(1)  # Be nice to the API
            
            # Save extracted text
            text_filename = file.stem + ".txt"
            text_path = output_path / text_filename
            
            with open(text_path, 'w', encoding='utf-8') as f:
                f.write(text)
            
            # Calculate stats
            char_count = len(text)
            word_count = len(text.split())
            
            file_result = {
                "filename": file.name,
                "output_file": text_filename,
                "pages": metadata.get("page_count", 1),
                "characters": char_count,
                "words": word_count,
                "extraction_method": metadata.get("extraction_method", "unknown"),
                "has_images": metadata.get("has_images", False),
                "has_tables": metadata.get("has_tables", False),
                "status": "success"
            }
            
            results["files"].append(file_result)
            results["successful"] += 1
            
            method = metadata.get("extraction_method", "unknown")
            print(f"  ✓ Extracted ({method}): {metadata.get('page_count', 1)} pages, {word_count:,} words")
            
            if metadata.get("has_tables"):
                print(f"    Contains tables (preserved in markdown)")
            if metadata.get("has_images") and method == "azure-document-intelligence":
                print(f"    Contains images (OCR applied)")
                
        except Exception as e:
            print(f"  ✗ Error: {e}")
            results["files"].append({
                "filename": file.name,
                "status": "failed",
                "error": str(e)
            })
            results["failed"] += 1
    
    # Save summary
    summary_path = output_path / "_extraction_summary.json"
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print("\n" + "=" * 60)
    print(f"Extraction complete!")
    print(f"  Successful: {results['successful']}/{results['total_files']}")
    print(f"  Failed: {results['failed']}/{results['total_files']}")
    print(f"  Summary saved to: {summary_path}")
    
    return results


def main():
    parser = argparse.ArgumentParser(
        description="Extract text content from PDF files for Azure AI Search indexing"
    )
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="Input directory containing PDF files"
    )
    parser.add_argument(
        "--output", "-o",
        required=True,
        help="Output directory for extracted text files"
    )
    parser.add_argument(
        "--azure-endpoint",
        help="Azure Document Intelligence endpoint URL"
    )
    parser.add_argument(
        "--azure-key",
        help="Azure Document Intelligence API key"
    )
    parser.add_argument(
        "--force-azure",
        action="store_true",
        help="Always use Azure DI, even for simple text PDFs"
    )
    parser.add_argument(
        "--single",
        help="Process a single PDF file instead of a directory"
    )
    parser.add_argument(
        "--strip-html",
        action="store_true",
        help="Remove HTML tags from extracted content (cleaner output for search)"
    )
    
    args = parser.parse_args()
    
    # Check for available extraction methods
    if not PYMUPDF_AVAILABLE and not (args.azure_endpoint and args.azure_key):
        print("ERROR: No extraction method available.")
        print("Either install PyMuPDF (pip install pymupdf) or provide Azure credentials.")
        sys.exit(1)
    
    if args.single:
        # Process single file
        print(f"Extracting: {args.single}")
        text, metadata = extract_text_from_pdf(
            args.single, 
            args.azure_endpoint, 
            args.azure_key,
            args.force_azure,
            args.strip_html
        )
        
        output_path = Path(args.output)
        output_path.mkdir(parents=True, exist_ok=True)
        
        output_file = output_path / (Path(args.single).stem + ".txt")
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(text)
        
        print(f"Saved to: {output_file}")
        print(f"Pages: {metadata.get('page_count', 1)}, Characters: {len(text):,}")
        print(f"Method: {metadata.get('extraction_method', 'unknown')}")
    else:
        # Process directory
        extract_all_pdfs(
            args.input, 
            args.output, 
            args.azure_endpoint, 
            args.azure_key,
            args.force_azure,
            args.strip_html
        )


if __name__ == "__main__":
    main()
