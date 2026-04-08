"""
AMFE PDF Data Extraction Script
Extracts all tables and text content from AMFE (Failure Mode and Effects Analysis) PDFs
using pdfplumber, and saves the results as JSON files.
"""
import json
import os
import sys
import pdfplumber
from datetime import datetime


# Configuration
PDF_FILES = [
    r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\AMFE de Proceso - TOP ROLL.pdf",
    r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\AMFE de Proceso - INSERTO.pdf",
    r"C:\Users\FacundoS-PC\OneDrive - BARACK ARGENTINA SRL\Desktop\AMFE de Proceso - ARMREST DOOR PANEL.pdf",
]

OUTPUT_DIR = r"C:\Users\FacundoS-PC\dev\BarackMercosul\backups\amfe_pdfs"

# Expected AMFE column headers (for reference/matching)
AMFE_COLUMNS = [
    "Operation Number",
    "Operation Name",
    "Work Element Type (6M)",
    "Work Element Name",
    "Function Description",
    "Failure Mode",
    "Effect - Local",
    "Effect - Next Level",
    "Effect - End User",
    "Severity (S)",
    "Cause Description",
    "Prevention Control (PC)",
    "Occurrence (O)",
    "Detection Control (DC)",
    "Detection (D)",
    "Action Priority (AP)",
    "Special Characteristic (CC/SC)",
]


def extract_pdf_data(pdf_path):
    """Extract all tables and text from a PDF file using pdfplumber."""
    print(f"\n{'='*80}")
    print(f"Processing: {os.path.basename(pdf_path)}")
    print(f"{'='*80}")

    result = {
        "source_file": os.path.basename(pdf_path),
        "source_path": pdf_path,
        "extraction_date": datetime.now().isoformat(),
        "total_pages": 0,
        "pages": [],
        "all_tables_combined": [],
    }

    try:
        with pdfplumber.open(pdf_path) as pdf:
            result["total_pages"] = len(pdf.pages)
            print(f"  Total pages: {len(pdf.pages)}")

            for page_num, page in enumerate(pdf.pages, 1):
                page_data = {
                    "page_number": page_num,
                    "width": float(page.width),
                    "height": float(page.height),
                    "text": "",
                    "tables": [],
                    "table_count": 0,
                }

                # Extract text
                text = page.extract_text()
                if text:
                    page_data["text"] = text
                    print(f"  Page {page_num}: Text extracted ({len(text)} chars)")
                else:
                    print(f"  Page {page_num}: No text found")

                # Extract tables with different strategies
                tables = page.extract_tables(
                    table_settings={
                        "vertical_strategy": "lines",
                        "horizontal_strategy": "lines",
                        "snap_tolerance": 5,
                        "join_tolerance": 5,
                        "edge_min_length": 10,
                        "min_words_vertical": 1,
                        "min_words_horizontal": 1,
                        "text_tolerance": 3,
                        "text_x_tolerance": 3,
                        "text_y_tolerance": 3,
                    }
                )

                if tables:
                    print(f"  Page {page_num}: {len(tables)} table(s) found")
                    for table_idx, table in enumerate(tables):
                        # Clean up table cells (replace None with empty string)
                        cleaned_table = []
                        for row in table:
                            cleaned_row = [
                                cell.strip() if cell else "" for cell in row
                            ]
                            cleaned_table.append(cleaned_row)

                        table_info = {
                            "table_index": table_idx,
                            "rows": len(cleaned_table),
                            "columns": len(cleaned_table[0]) if cleaned_table else 0,
                            "header_row": cleaned_table[0] if cleaned_table else [],
                            "data": cleaned_table,
                        }
                        page_data["tables"].append(table_info)
                        result["all_tables_combined"].append(
                            {
                                "source_page": page_num,
                                "table_index": table_idx,
                                "data": cleaned_table,
                            }
                        )

                        # Print first few rows for debugging
                        print(
                            f"    Table {table_idx}: {len(cleaned_table)} rows x {len(cleaned_table[0]) if cleaned_table else 0} cols"
                        )
                        if cleaned_table:
                            # Show header
                            header = cleaned_table[0]
                            print(f"    Header: {header[:5]}{'...' if len(header) > 5 else ''}")
                else:
                    print(f"  Page {page_num}: No tables found with line strategy")

                    # Try with text strategy as fallback
                    tables_text = page.extract_tables(
                        table_settings={
                            "vertical_strategy": "text",
                            "horizontal_strategy": "text",
                            "snap_tolerance": 5,
                            "join_tolerance": 5,
                        }
                    )
                    if tables_text:
                        print(
                            f"  Page {page_num}: {len(tables_text)} table(s) found with text strategy"
                        )
                        for table_idx, table in enumerate(tables_text):
                            cleaned_table = []
                            for row in table:
                                cleaned_row = [
                                    cell.strip() if cell else "" for cell in row
                                ]
                                cleaned_table.append(cleaned_row)

                            table_info = {
                                "table_index": table_idx,
                                "strategy": "text",
                                "rows": len(cleaned_table),
                                "columns": len(cleaned_table[0]) if cleaned_table else 0,
                                "header_row": cleaned_table[0] if cleaned_table else [],
                                "data": cleaned_table,
                            }
                            page_data["tables"].append(table_info)
                            result["all_tables_combined"].append(
                                {
                                    "source_page": page_num,
                                    "table_index": table_idx,
                                    "strategy": "text",
                                    "data": cleaned_table,
                                }
                            )

                page_data["table_count"] = len(page_data["tables"])
                result["pages"].append(page_data)

    except Exception as e:
        print(f"  ERROR processing {pdf_path}: {e}")
        result["error"] = str(e)
        import traceback
        traceback.print_exc()

    # Summary
    total_tables = sum(p["table_count"] for p in result["pages"])
    total_rows = sum(
        t["rows"] for p in result["pages"] for t in p["tables"]
    )
    result["summary"] = {
        "total_tables": total_tables,
        "total_data_rows": total_rows,
        "pages_with_tables": sum(1 for p in result["pages"] if p["table_count"] > 0),
        "pages_with_text": sum(1 for p in result["pages"] if p["text"]),
    }
    print(f"\n  Summary: {total_tables} tables, {total_rows} total rows across {result['total_pages']} pages")

    return result


def save_json(data, output_path):
    """Save data to a JSON file with proper encoding."""
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    file_size = os.path.getsize(output_path)
    print(f"  Saved: {output_path} ({file_size:,} bytes)")


def main():
    print("AMFE PDF Data Extraction")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Processing {len(PDF_FILES)} files...")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    all_results = []

    for pdf_path in PDF_FILES:
        if not os.path.exists(pdf_path):
            print(f"\nERROR: File not found: {pdf_path}")
            continue

        # Extract data
        result = extract_pdf_data(pdf_path)
        all_results.append(result)

        # Generate output filename
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]
        # Clean filename
        safe_name = base_name.replace(" ", "_").replace("-", "_")

        # Save individual JSON
        json_path = os.path.join(OUTPUT_DIR, f"{safe_name}.json")
        save_json(result, json_path)

        # Also save just the raw tables for easier processing
        tables_only = {
            "source_file": result["source_file"],
            "extraction_date": result["extraction_date"],
            "tables": result["all_tables_combined"],
            "summary": result["summary"],
        }
        tables_path = os.path.join(OUTPUT_DIR, f"{safe_name}_tables_only.json")
        save_json(tables_only, tables_path)

        # Save raw text
        text_data = {
            "source_file": result["source_file"],
            "extraction_date": result["extraction_date"],
            "pages": [
                {"page_number": p["page_number"], "text": p["text"]}
                for p in result["pages"]
            ],
        }
        text_path = os.path.join(OUTPUT_DIR, f"{safe_name}_text_only.json")
        save_json(text_data, text_path)

    # Save combined summary
    combined = {
        "extraction_date": datetime.now().isoformat(),
        "files_processed": len(all_results),
        "results": [
            {
                "file": r["source_file"],
                "pages": r["total_pages"],
                "summary": r["summary"],
            }
            for r in all_results
        ],
    }
    combined_path = os.path.join(OUTPUT_DIR, "extraction_summary.json")
    save_json(combined, combined_path)

    print(f"\n{'='*80}")
    print("EXTRACTION COMPLETE")
    print(f"{'='*80}")
    print(f"Files processed: {len(all_results)}")
    print(f"Output directory: {OUTPUT_DIR}")
    for r in all_results:
        print(f"  - {r['source_file']}: {r['summary']['total_tables']} tables, {r['summary']['total_data_rows']} rows")


if __name__ == "__main__":
    main()
