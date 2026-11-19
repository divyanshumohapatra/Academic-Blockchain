import os
import re
import shutil
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill_hex)
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def markdown_to_docx(md_path, docx_path, main_title, subtitle):
    doc = docx.Document()

    # Set standard margins (1 inch)
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)

    # Style: Normal font
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Calibri'
    font.size = Pt(11)
    font.color.rgb = RGBColor(0x1F, 0x29, 0x37)

    # Header Title
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(4)
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title_p.add_run(main_title.upper())
    run.font.name = 'Calibri'
    run.font.size = Pt(18)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A) # Navy / Slate 900

    # Subtitle
    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_before = Pt(2)
    sub_p.paragraph_format.space_after = Pt(16)
    sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_run = sub_p.add_run(subtitle)
    sub_run.font.name = 'Calibri'
    sub_run.font.size = Pt(12)
    sub_run.font.bold = True
    sub_run.font.color.rgb = RGBColor(0x25, 0x63, 0xEB) # Blue 600

    # Read markdown file
    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    in_code_block = False
    code_lines = []
    in_table = False
    table_lines = []

    def flush_code_block():
        nonlocal code_lines
        if not code_lines:
            return
        code_text = "".join(code_lines).strip('\n')
        tbl = doc.add_table(rows=1, cols=1)
        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = tbl.cell(0, 0)
        set_cell_background(cell, "F1F5F9")
        set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        c_run = p.add_run(code_text)
        c_run.font.name = 'Consolas'
        c_run.font.size = Pt(9)
        c_run.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
        doc.add_paragraph() # Spacing
        code_lines = []

    def flush_table():
        nonlocal table_lines
        if not table_lines:
            return
        # Parse table lines
        parsed_rows = []
        for tl in table_lines:
            if re.match(r'^\s*\|?\s*[-:]+[-| :]*$', tl):
                continue
            cells = [c.strip() for c in tl.strip().strip('|').split('|')]
            if cells:
                parsed_rows.append(cells)
        if parsed_rows:
            col_count = max(len(r) for r in parsed_rows)
            tbl = doc.add_table(rows=len(parsed_rows), cols=col_count)
            tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            for r_idx, row in enumerate(parsed_rows):
                for c_idx in range(col_count):
                    val = row[c_idx] if c_idx < len(row) else ""
                    cell = tbl.cell(r_idx, c_idx)
                    p = cell.paragraphs[0]
                    p.paragraph_format.space_before = Pt(2)
                    p.paragraph_format.space_after = Pt(2)
                    r = p.add_run(val)
                    r.font.name = 'Calibri'
                    r.font.size = Pt(9.5)
                    if r_idx == 0:
                        r.font.bold = True
                        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                        set_cell_background(cell, "1E3A8A") # Navy header
                    else:
                        r.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
                        if r_idx % 2 == 1:
                            set_cell_background(cell, "F8FAFC")
                        else:
                            set_cell_background(cell, "FFFFFF")
                    set_cell_margins(cell, top=100, bottom=100, left=150, right=150)
            doc.add_paragraph()
        table_lines = []

    # Process markdown lines
    skip_header_lines = True
    for line in lines:
        stripped = line.strip()

        # Skip initial # and ## until after metadata
        if skip_header_lines:
            if stripped.startswith('---'):
                skip_header_lines = False
            continue

        # Handle code blocks
        if stripped.startswith('```'):
            if in_code_block:
                in_code_block = False
                flush_code_block()
            else:
                if in_table:
                    in_table = False
                    flush_table()
                in_code_block = True
                code_lines = []
            continue

        if in_code_block:
            code_lines.append(line)
            continue

        # Handle tables
        if '|' in stripped and ('|' in stripped[1:] or stripped.startswith('|')):
            in_table = True
            table_lines.append(stripped)
            continue
        elif in_table:
            in_table = False
            flush_table()

        if not stripped:
            continue

        # Horizontal rule
        if stripped == '---':
            continue

        # Headings
        if stripped.startswith('### '):
            h = doc.add_paragraph()
            h.paragraph_format.space_before = Pt(14)
            h.paragraph_format.space_after = Pt(4)
            r = h.add_run(stripped[4:].strip())
            r.font.name = 'Calibri'
            r.font.size = Pt(14)
            r.font.bold = True
            r.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
        elif stripped.startswith('#### '):
            h = doc.add_paragraph()
            h.paragraph_format.space_before = Pt(10)
            h.paragraph_format.space_after = Pt(3)
            r = h.add_run(stripped[5:].strip())
            r.font.name = 'Calibri'
            r.font.size = Pt(12)
            r.font.bold = True
            r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
        elif stripped.startswith('##### '):
            h = doc.add_paragraph()
            h.paragraph_format.space_before = Pt(8)
            h.paragraph_format.space_after = Pt(2)
            r = h.add_run(stripped[6:].strip())
            r.font.name = 'Calibri'
            r.font.size = Pt(11)
            r.font.bold = True
            r.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
        elif stripped.startswith('- ') or stripped.startswith('* '):
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            add_formatted_runs(p, stripped[2:].strip())
        elif re.match(r'^\d+\.\s+', stripped):
            p = doc.add_paragraph(style='List Number')
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            text_part = re.sub(r'^\d+\.\s+', '', stripped)
            add_formatted_runs(p, text_part)
        else:
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.line_spacing = 1.15
            add_formatted_runs(p, stripped)

    if in_code_block:
        flush_code_block()
    if in_table:
        flush_table()

    # Save docx
    doc.save(docx_path)
    print(f"Generated Word Document: {docx_path}")

def add_formatted_runs(paragraph, text):
    parts = re.split(r'(\*\*.*?\*\*|\`.*?\`|\*.*?\*)', text)
    for part in parts:
        if not part:
            continue
        if part.startswith('**') and part.endswith('**'):
            r = paragraph.add_run(part[2:-2])
            r.font.bold = True
        elif part.startswith('`') and part.endswith('`'):
            r = paragraph.add_run(part[1:-1])
            r.font.name = 'Consolas'
            r.font.size = Pt(10)
            r.font.color.rgb = RGBColor(0x0F, 0x76, 0x6E) # Teal
        elif part.startswith('*') and part.endswith('*'):
            r = paragraph.add_run(part[1:-1])
            r.font.italic = True
        else:
            paragraph.add_run(part)

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(base_dir)

    reports = [
        {
            "md": os.path.join(root_dir, "GROUP1_CONTRIBUTOR_1_1_REPORT.md"),
            "docx": os.path.join(root_dir, "GROUP1_CONTRIBUTOR_1_1_REPORT.docx"),
            "title": "Academic Blockchain Consortium: Group 1 Deliverable",
            "subtitle": "Contributor 1.1 Technical Report: Academic Chaincode Lead (Org1MSP)"
        },
        {
            "md": os.path.join(root_dir, "GROUP1_CONTRIBUTOR_1_2_REPORT.md"),
            "docx": os.path.join(root_dir, "GROUP1_CONTRIBUTOR_1_2_REPORT.docx"),
            "title": "Academic Blockchain Consortium: Group 1 Deliverable",
            "subtitle": "Contributor 1.2 Technical Report: CouchDB State & Identity Lead"
        },
        {
            "md": os.path.join(root_dir, "GROUP1_CONTRIBUTOR_1_3_REPORT.md"),
            "docx": os.path.join(root_dir, "GROUP1_CONTRIBUTOR_1_3_REPORT.docx"),
            "title": "Academic Blockchain Consortium: Group 1 Deliverable",
            "subtitle": "Contributor 1.3 Technical Report: Org 1 Autonomous Agent Lead"
        },
        {
            "md": os.path.join(root_dir, "ACADEMIC_BLOCKCHAIN_PBL_REPORT.md"),
            "docx": os.path.join(root_dir, "ACADEMIC_BLOCKCHAIN_PBL_REPORT.docx"),
            "title": "A Blockchain-Based Academic Certificate Issuance, Verification and Revocation System",
            "subtitle": "Hyperledger Fabric 2.5 Multi-Organization Consortium & PBL Master Report"
        }
    ]

    downloads_dir = "C:\\Users\\PC\\Downloads"
    desktop_reports_dir = "C:\\Users\\PC\\Desktop\\Academic_Blockchain_Reports"
    os.makedirs(desktop_reports_dir, exist_ok=True)

    for rep in reports:
        if os.path.exists(rep["md"]):
            markdown_to_docx(rep["md"], rep["docx"], rep["title"], rep["subtitle"])
            # Copy to Downloads
            fname = os.path.basename(rep["docx"])
            if os.path.exists(downloads_dir):
                shutil.copy2(rep["docx"], os.path.join(downloads_dir, fname))
            if os.path.exists(desktop_reports_dir):
                shutil.copy2(rep["docx"], os.path.join(desktop_reports_dir, fname))

    print("\n✅ All Word documents successfully generated and copied to Downloads & Desktop folder!")
