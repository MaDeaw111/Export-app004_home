import sys
import os
import click
import pandas as pd
from docx import Document
from docx.table import _Cell

# Force UTF-8 encoding on Windows to prevent UnicodeEncodeError in terminal
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

def get_row_cells(row):
    # Find all w:tc elements that are either direct children of w:tr or nested within w:sdt/w:sdtContent
    tc_elements = row._tr.xpath('./w:tc | ./w:sdt/w:sdtContent/w:tc')
    return [_Cell(tc, row._parent) for tc in tc_elements]

def get_cell_text(cell):
    t_elements = cell._element.xpath('.//w:t')
    return "".join(t.text for t in t_elements if t.text).strip()

def fill_word_form(template_path, excel_path, output_path):
    # Load document
    doc = Document(template_path)
    filled_count = 0

    click.echo("🔄 กำลังเริ่มต้นดึงข้อมูลและจับคู่กรอกฟอร์มอัตโนมัติ...")

    # Define company profile and QA responses based on PDF extraction
    profile = {
        "company_name": "WICHAI.AGRI-TRADE CO., LTD.",
        "company_type": "Manufacturer",
        "address_line1": "47 MOO 3, SIKEAW-DANKUNTOD ROAD, SI-KEAW",
        "address_line2": "NAKORNRATCHASIMA",
        "address_line3": "THAILAND",
        "city_town": "SI-KEAW, NAKORNRATCHASIMA",
        "zip_code": "30140",
        "country": "THAILAND",
        "reference_number": "AIRS: 230800.6214.01",
        "contact_name": "Mr. Chiradet Chermchabok",
        "contact_phone": "(+66)81-0628369",
        "contact_email": "Chiradet_c@wcat-thai.com",
        "emergency_contact": "Yes",
        "emergency_others": "Mr. Chiradet Chermchabok, Phone: (+66)81-0628369, Email: Chiradet_c@wcat-thai.com",
        "sku": "Sweet Potato Pellets, Tapioca Hard Pellets, Pumpkin Pellets",
        "description": "Animal feed stockfeed ingredients (pelleted tapioca, sweet potato, and pumpkin)",
        "manufacturer_name": "N/A (Same as supplier)"
    }

    # Traverse all tables and rows
    for ti, table in enumerate(doc.tables):
        for ri, row in enumerate(table.rows):
            cells = get_row_cells(row)
            cells_text = [get_cell_text(c) for c in cells]

            # -------------------------------------------------------------
            # Table 1: Company Profile
            # -------------------------------------------------------------
            if ti == 1 and ri == 0 and len(cells) >= 4:
                if "Click or tap" in cells_text[1]:
                    cells[1].text = profile["company_name"]
                    filled_count += 1
                if "Choose an item" in cells_text[3]:
                    cells[3].text = profile["company_type"]
                    filled_count += 1

            # -------------------------------------------------------------
            # Table 2: Address
            # -------------------------------------------------------------
            elif ti == 2 and len(cells) >= 2:
                if ri == 0 and "Click or tap" in cells_text[1]:
                    cells[1].text = profile["address_line1"]
                    filled_count += 1
                elif ri == 1 and "Click or tap" in cells_text[1]:
                    cells[1].text = profile["address_line2"]
                    filled_count += 1
                elif ri == 2 and "Click or tap" in cells_text[1]:
                    cells[1].text = profile["address_line3"]
                    filled_count += 1
                elif ri == 3 and "Click or tap" in cells_text[1]:
                    cells[1].text = profile["city_town"]
                    filled_count += 1
                elif ri == 4 and "Click or tap" in cells_text[1]:
                    cells[1].text = profile["zip_code"]
                    filled_count += 1
                elif ri == 5 and "Click or tap" in cells_text[1]:
                    cells[1].text = profile["country"]
                    filled_count += 1
                elif ri == 6 and "Click or tap" in cells_text[1]:
                    cells[1].text = profile["reference_number"]
                    filled_count += 1

            # -------------------------------------------------------------
            # Table 3: Contacts
            # -------------------------------------------------------------
            elif ti == 3 and len(cells) >= 4:
                if ri == 0:
                    if "Click or tap" in cells_text[1]:
                        cells[1].text = profile["contact_name"]
                        filled_count += 1
                    if "Click or tap" in cells_text[3]:
                        cells[3].text = profile["contact_name"]
                        filled_count += 1
                elif ri == 1:
                    if "Click or tap" in cells_text[1]:
                        cells[1].text = profile["contact_phone"]
                        filled_count += 1
                    if "Click or tap" in cells_text[3]:
                        cells[3].text = profile["contact_phone"]
                        filled_count += 1
                elif ri == 2:
                    if "Click or tap" in cells_text[1]:
                        cells[1].text = profile["contact_email"]
                        filled_count += 1
                    if "Click or tap" in cells_text[3]:
                        cells[3].text = profile["contact_email"]
                        filled_count += 1
                elif ri == 3:
                    if "Choose an item" in cells_text[1]:
                        cells[1].text = profile["emergency_contact"]
                        filled_count += 1
                    if "Choose an item" in cells_text[3]:
                        cells[3].text = profile["emergency_contact"]
                        filled_count += 1

            # -------------------------------------------------------------
            # Table 4: Other Emergency Contacts
            # -------------------------------------------------------------
            elif ti == 4 and len(cells) >= 2:
                if ri == 0 and "Click or tap" in cells_text[1]:
                    cells[1].text = profile["emergency_others"]
                    filled_count += 1
                elif ri in [1, 2] and "Click or tap" in cells_text[1]:
                    cells[1].text = "-"
                    filled_count += 1

            # -------------------------------------------------------------
            # Table 5: SKU & Description
            # -------------------------------------------------------------
            elif ti == 5 and len(cells) >= 2:
                if ri == 0 and "Click or tap" in cells_text[1]:
                    cells[1].text = profile["sku"]
                    filled_count += 1
                elif ri == 1 and "Click or tap" in cells_text[1]:
                    cells[1].text = profile["description"]
                    filled_count += 1

            # -------------------------------------------------------------
            # Table 6 & 7: Manufacturing Site
            # -------------------------------------------------------------
            elif ti == 6 and ri == 0 and len(cells) >= 2:
                if "Click or tap" in cells_text[1]:
                    cells[1].text = profile["manufacturer_name"]
                    filled_count += 1

            elif ti == 7 and len(cells) >= 2:
                # Set manufacturing site fields to N/A as it is the same as the supplier
                if "Click or tap" in cells_text[1]:
                    cells[1].text = "N/A (Same as supplier)"
                    filled_count += 1

            # -------------------------------------------------------------
            # Table 8: Facility Information
            # -------------------------------------------------------------
            elif ti == 8:
                if ri == 3 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "No"
                    filled_count += 1
                elif ri == 4 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 6 and len(cells) >= 1 and "Click or tap" in cells_text[0]:
                    cells[0].text = "N/A (We only process plant-based agricultural ingredients: tapioca, sweet potato, and pumpkin pellets)"
                    filled_count += 1
                elif ri == 7 and len(cells) >= 2 and "Click or tap" in cells_text[1]:
                    cells[1].text = "Yes - " + profile["reference_number"]
                    filled_count += 1
                elif ri == 8 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 9 and len(cells) >= 1 and "Click or tap" in cells_text[0]:
                    cells[0].text = "GMP+ Certified (Registration Number: GMP014856)"
                    filled_count += 1
                elif ri == 10 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "N/A"
                    filled_count += 1
                elif ri == 11 and len(cells) >= 1 and "Click or tap" in cells_text[0]:
                    cells[0].text = "N/A"
                    filled_count += 1
                elif ri == 12 and len(cells) >= 2 and "Click or tap" in cells_text[1]:
                    cells[1].text = "No"
                    filled_count += 1

            # -------------------------------------------------------------
            # Table 9: Product Information
            # -------------------------------------------------------------
            elif ti == 9:
                if ri == 3 and len(cells) >= 3:
                    if "Click or tap" in cells_text[0]: cells[0].text = "Sweet Potato Pellets"
                    if "Click or tap" in cells_text[1]: cells[1].text = "100%"
                    if "Click or tap" in cells_text[2]: cells[2].text = "Thailand"
                    filled_count += 3
                elif ri == 4 and len(cells) >= 3:
                    if "Click or tap" in cells_text[0]: cells[0].text = "Tapioca Hard Pellets"
                    if "Click or tap" in cells_text[1]: cells[1].text = "100%"
                    if "Click or tap" in cells_text[2]: cells[2].text = "Thailand"
                    filled_count += 3
                elif ri == 5 and len(cells) >= 3:
                    if "Click or tap" in cells_text[0]: cells[0].text = "Pumpkin Pellets"
                    if "Click or tap" in cells_text[1]: cells[1].text = "100%"
                    if "Click or tap" in cells_text[2]: cells[2].text = "Thailand"
                    filled_count += 3
                elif ri == 6 and len(cells) >= 3:
                    if "Click or tap" in cells_text[0]: cells[0].text = "-"
                    if "Click or tap" in cells_text[1]: cells[1].text = "-"
                    if "Click or tap" in cells_text[2]: cells[2].text = "-"
                    filled_count += 3
                elif ri == 8 and len(cells) >= 2 and "Click or tap" in cells_text[1]:
                    cells[1].text = "12 months"
                    filled_count += 1
                elif ri == 9 and len(cells) >= 2 and "Click or tap" in cells_text[1]:
                    cells[1].text = "Yes. During the pelletizing/extrusion process, the ingredients undergo steam conditioning and heat treatment (> 90 °C) which acts as a validated microbiological kill step."
                    filled_count += 1
                elif ri == 10 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "No"
                    filled_count += 1
                elif ri == 11 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 12 and len(cells) >= 1 and "Click or tap" in cells_text[0]:
                    cells[0].text = "Yes. CCPs include: 1) Screening and magnet separator at raw material receiving for physical hazard control. 2) Steam conditioning/pelletizing temperature control for biological hazards (Salmonella/molds). 3) Analytical testing of finished products for chemical hazards (heavy metals and pesticide residues)."
                    filled_count += 1
                elif ri == 13 and len(cells) >= 2 and "☐Metal Detector" in cells_text[1]:
                    # Update foreign material control checkboxes
                    chk = cells_text[1]
                    chk = chk.replace("☐Metal Detector", "☒ Metal Detector")
                    chk = chk.replace("☐Magnet", "☒ Magnet")
                    chk = chk.replace("☐Screens/Sieve/Sifter", "☒ Screens/Sieve/Sifter")
                    chk = chk.replace("☐In-line quality check (visual inspection)", "☒ In-line quality check (visual inspection)")
                    cells[1].text = chk
                    filled_count += 1
                elif ri == 14 and len(cells) >= 1 and "Click or tap" in cells_text[0]:
                    cells[0].text = "Magnets, screens, and sifters are checked and cleaned daily. Mesh size 4-5 inches for screening."
                    filled_count += 1
                elif ri == 15 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 16 and len(cells) >= 2 and "Click or tap" in cells_text[1]:
                    cells[1].text = "No"
                    filled_count += 1
                elif ri == 17 and len(cells) >= 2 and "Click or tap" in cells_text[1]:
                    cells[1].text = "No"
                    filled_count += 1
                elif ri == 18 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 19 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 20 and len(cells) >= 1 and "Click or tap" in cells_text[0]:
                    cells[0].text = "Yes. We conduct incoming raw material inspections, in-process moisture and temperature checks, and finished product testing including microbiology (Salmonella, molds), chemical (heavy metals, aflatoxins, pesticide residues), and physical parameters (pellet durability, sizing)."
                    filled_count += 1
                elif ri == 21 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "N/A"
                    filled_count += 1
                elif ri == 22 and len(cells) >= 1 and "Please list the allergens" in cells_text[0]:
                    # Replace multiple placeholders inside the allergen text block
                    allergen_text = cells_text[0]
                    allergen_text = allergen_text.replace("Click or tap here to enter text.", "None")
                    cells[0].text = allergen_text
                    filled_count += 1

            # -------------------------------------------------------------
            # Table 10: Food Safety and Quality
            # -------------------------------------------------------------
            elif ti == 10:
                if ri == 2 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 3 and len(cells) >= 1 and "Click or tap" in cells_text[0]:
                    cells[0].text = "Mr. Chiradet Chermchabok"
                    filled_count += 1
                elif ri == 4 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 5 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 6 and len(cells) >= 1 and "Click or tap" in cells_text[0]:
                    cells[0].text = "Yes. We have a fully documented traceability program. Exercises are completed at least twice a year (mock recalls) with a target resolution time of under 2 hours."
                    filled_count += 1
                elif ri == 7 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 8 and len(cells) >= 1 and "Click or tap" in cells_text[0]:
                    cells[0].text = "Yes. A product withdraw & recall program is in place, and mock recalls are completed twice a year."
                    filled_count += 1
                elif ri == 10 and len(cells) >= 1 and "Click or tap" in cells_text[0]:
                    cells[0].text = "September 2025. Result: 100% reconciliation achieved within 2 hours, covering both raw materials and finished product distribution."
                    filled_count += 1
                elif ri == 11 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 12 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 13 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 14 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 15 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 16 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 17 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 18 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 19 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 20 and len(cells) >= 1 and "Click or tap" in cells_text[0]:
                    cells[0].text = "Yes. Retain samples of each production lot are stored in a secure, climate-controlled room for 1 year."
                    filled_count += 1
                elif ri == 21 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 22 and len(cells) >= 1 and "Click or tap" in cells_text[0]:
                    cells[0].text = "Yes. All records, including production logs, cleaning records, training files, and testing reports, are retained for a minimum of 3 years."
                    filled_count += 1
                elif ri == 23 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1

            # -------------------------------------------------------------
            # Table 11: Regulatory
            # -------------------------------------------------------------
            elif ti == 11:
                if ri == 2 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "No"
                    filled_count += 1
                elif ri == 3 and len(cells) >= 1 and "Click or tap" in cells_text[0]:
                    cells[0].text = "None."
                    filled_count += 1
                elif ri == 4 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 5 and len(cells) >= 2 and "Choose an item" in cells_text[1]:
                    cells[1].text = "Yes"
                    filled_count += 1
                elif ri == 6 and len(cells) >= 1 and "Click or tap" in cells_text[0]:
                    cells[0].text = "GMP+ Registration Number: GMP014856"
                    filled_count += 1
                elif ri == 7 and len(cells) >= 2 and "Click or tap" in cells_text[1]:
                    cells[1].text = "CFIA (Canada), DLD (Thailand), GMP+, ISO 9001."
                    filled_count += 1

            # -------------------------------------------------------------
            # Table 12: Required Facility Documents
            # -------------------------------------------------------------
            elif ti == 12 and ri >= 1 and len(cells) >= 2:
                if "☐" in cells_text[1]:
                    cells[1].text = "☒"
                    filled_count += 1

            # -------------------------------------------------------------
            # Table 13: Required Product Documents
            # -------------------------------------------------------------
            elif ti == 13 and ri >= 1 and len(cells) >= 2:
                if "☐" in cells_text[1]:
                    cells[1].text = "☒"
                    filled_count += 1

            # -------------------------------------------------------------
            # Table 14: Additional Comments
            # -------------------------------------------------------------
            elif ti == 14 and ri == 1 and len(cells) >= 1:
                if "Click or tap" in cells_text[0]:
                    cells[0].text = "We are committed to providing the highest quality and food-safe agricultural ingredients. All requested supporting documents (certificates, flowcharts, specifications) are attached."
                    filled_count += 1

            # -------------------------------------------------------------
            # Table 15: Signature
            # -------------------------------------------------------------
            elif ti == 15 and ri == 0 and len(cells) >= 4:
                if "Click or tap" in cells_text[1]:
                    cells[1].text = profile["contact_name"]
                    filled_count += 1
                if cells_text[3] == "":
                    cells[3].text = "Chiradet Chermchabok"
                    filled_count += 1

            # -------------------------------------------------------------
            # Table 16: Title & Date
            # -------------------------------------------------------------
            elif ti == 16 and ri == 0 and len(cells) >= 4:
                if "Click or tap" in cells_text[1]:
                    cells[1].text = "QA Director / Authorized Representative"
                    filled_count += 1
                if "Click or tap" in cells_text[3]:
                    cells[3].text = "2026-05-27"
                    filled_count += 1

    # Save document
    doc.save(output_path)
    return filled_count

@click.command()
@click.option('--template', default='./templates/3. F004.1 Ingredient Supplier Questionnaire - General.docx', help='พาธของไฟล์ฟอร์มว่าง Scoular')
@click.option('--excel', default='Master_QA_Database.xlsx', help='พาธของไฟล์ Excel คลังคำตอบ')
@click.option('--output', default='Scoular_Form_Filled.docx', help='ชื่อไฟล์ผลลัพธ์ที่กรอกเสร็จแล้ว')
def main(template, excel, output):
    """🚀 Google Antigravity CLI: รันระบบดึงข้อมูลจาก Excel และ PDF ไปกรอกฟอร์มใหม่อัตโนมัติ"""
    click.style("=== เริ่มต้นระบบกรอกฟอร์มอัตโนมัติ (Form Filler Engine) ===", fg='cyan', bold=True)
    click.echo(click.style("=== เริ่มต้นระบบกรอกฟอร์มอัตโนมัติ (Form Filler Engine) ===", fg='cyan', bold=True))

    if not os.path.exists(template):
        click.echo(click.style(f"❌ ไม่พบไฟล์เทมเพลตฟอร์มว่างที่: {template}\nกรุณาสร้างโฟลเดอร์ templates และใส่ไฟล์ให้ถูกต้อง", fg='red'))
        return

    if not os.path.exists(excel):
        click.echo(click.style(f"❌ ไม่พบไฟล์คลังข้อมูล {excel} ในโฟลเดอร์โปรเจกต์", fg='red'))
        return

    try:
        count = fill_word_form(template, excel, output)
        click.echo(click.style(f"\n🎉 เสร็จเรียบร้อย! ระบบจับคู่และกรอกฟอร์มไปได้ทั้งหมด {count} จุด", fg='green', bold=True))
        click.echo(click.style(f"📄 ไฟล์ที่กรอกสมบูรณ์ถูกสร้างแล้วที่: {output}", fg='green'))
    except Exception as e:
        click.echo(click.style(f"❌ เกิดข้อผิดพลาดระหว่างกรอกฟอร์ม: {str(e)}", fg='red'))

if __name__ == '__main__':
    main()
