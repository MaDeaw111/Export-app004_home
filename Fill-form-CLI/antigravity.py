import os
import click
import pandas as pd
from docx import Document

def extract_qa_from_docx(file_path):
    doc = Document(file_path)
    extracted_data = []
    for table_idx, table in enumerate(doc.tables):
        for row_idx, row in enumerate(table.rows):
            cells = [cell.text.strip() for cell in row.cells]
            unique_cells = []
            for c in cells:
                if not unique_cells or c != unique_cells[-1]:
                    unique_cells.append(c)
            if len(unique_cells) >= 2:
                question, answer = unique_cells[0], unique_cells[1]
                if question and answer and question != answer:
                    if "Responses" in answer or "Response" in answer:
                        continue
                    extracted_data.append({
                        "Question": question,
                        "Your Answer": answer,
                        "Source File": os.path.basename(file_path)
                    })
    return extracted_data

@click.group()
def cli():
    """🚀 Google Antigravity CLI: เครื่องมือจัดการฐานข้อมูลและฟอร์มอัตโนมัติสำหรับ WCAT"""
    pass

@cli.command()
@click.option('--input-dir', default='./raw_forms', help='โฟลเดอร์ที่เก็บไฟล์ .docx เก่า')
@click.option('--output-excel', default='Master_QA_Database.xlsx', help='ชื่อไฟล์ Excel ผลลัพธ์')
def extract(input_dir, output_excel):
    """สกัดข้อมูลจากฟอร์มเก่าในโฟลเดอร์ raw_forms"""
    click.echo(click.style("=== เริ่มต้นระบบสกัดข้อมูล ===", fg='cyan', bold=True))
    if not os.path.exists(input_dir):
        click.echo(click.style(f"❌ ไม่พบโฟลเดอร์ {input_dir}", fg='red'))
        return
    all_extracted_records = []
    files = [f for f in os.listdir(input_dir) if f.endswith('.docx')]
    if not files:
        click.echo(click.style(f"⚠️ ไม่พบไฟล์ .docx ในโฟลเดอร์ {input_dir}", fg='yellow'))
        return
    for file_name in files:
        file_path = os.path.join(input_dir, file_name)
        try:
            records = extract_qa_from_docx(file_path)
            all_extracted_records.extend(records)
        except Exception as e:
            click.echo(f"❌ เกิดข้อผิดพลาดกับไฟล์ {file_name}: {str(e)}")
    if all_extracted_records:
        df = pd.DataFrame(all_extracted_records)
        df.to_excel(output_excel, index=False)
        click.echo(click.style(f"🎉 สกัดข้อมูลสำเร็จ บันทึกไว้ที่: {output_excel}", fg='green'))

@cli.command()
@click.option('--source-excel', default='Master_QA_Database.xlsx', help='ไฟล์ข้อมูลดิบที่ได้จากเฟสแรก')
@click.option('--output-master', default='WCAT_Master_Database.xlsx', help='ชื่อไฟล์ฐานข้อมูลกลางตัวใหม่')
def init_master(source_excel, output_master):
    """🏗️ สร้างและจัดหมวดหมู่ข้อมูล WCAT Master Database อัตโนมัติ"""
    click.echo(click.style("=== กำลังสร้างและจัดหมวดหมู่ฐานข้อมูลกลาง WCAT Master Database ===", fg='cyan', bold=True))
    
    columns = [
        "Category (หมวดหมู่หลัก)", 
        "Sub-Category (หัวข้อย่อย)", 
        "Standard Question (คำถามมาตรฐานกลาง)", 
        "WCAT Official Answer (คำตอบทางการของบริษัท)", 
        "Synonyms / Varied Questions (รูปแบบคำถามอื่นๆ ของลูกค้า)"
    ]
    
    master_records = []
    if os.path.exists(source_excel):
        click.echo(f"📦 ดึงข้อมูลดิบจาก {source_excel} นำมาจัดระเบียบตามโครงสร้างบริษัท...")
        df_source = pd.read_excel(source_excel)
        
        for _, row in df_source.iterrows():
            q = str(row['Question']).strip()
            ans = str(row['Your Answer']).strip()
            
            # --- ระบบจัดหมวดหมู่อัตโนมัติด้วย Keyword Matching ---
            category = "รอจัดหมวดหมู่"
            sub_category = "-"
            
            # 1. คัดกรองส่วนของ Manufacturer / Factory (โรงงาน)
            if "manufacturer" in q.lower() or "facility location" in q.lower() or "plant" in q.lower():
                category = "Company Profile"
                sub_category = "Factory / Facility Address"
            # 2. คัดกรองส่วนของที่อยู่หลัก หรือ Head Office
            elif "address" in q.lower() or "city" in q.lower() or "country" in q.lower() or "zip code" in q.lower():
                category = "Company Profile"
                sub_category = "Head Office Address"
            # 3. คัดกรองข้อมูลผู้ติดต่อ เบอร์โทร อีเมล
            elif "contact" in q.lower() or "phone" in q.lower() or "email" in q.lower():
                category = "Company Profile"
                sub_category = "Contact Information"
            # 4. คัดกรองข้อมูลผลิตภัณฑ์ (Product Info)
            elif "product" in q.lower() or "ingredient" in q.lower() or "shelf life" in q.lower():
                category = "Product Information"
                sub_category = "Product Details"
            # 5. คัดกรองข้อมูลใบรับรองมาตรฐานและกฎหมาย
            elif "certif" in q.lower() or "audit" in q.lower() or "fda" in q.lower() or "compliance" in q.lower():
                category = "Certifications & Regulatory"
                sub_category = "Compliance"

            master_records.append({
                "Category (หมวดหมู่หลัก)": category,
                "Sub-Category (หัวข้อย่อย)": sub_category,
                "Standard Question (คำถามมาตรฐานกลาง)": q,
                "WCAT Official Answer (คำตอบทางการของบริษัท)": ans,
                "Synonyms / Varied Questions (รูปแบบคำถามอื่นๆ ของลูกค้า)": q
            })
            
        click.echo(f"✅ ทำการจัดหมวดหมู่และโอนย้ายข้อมูลเดิม {len(master_records)} ข้อเสร็จสิ้น!")
    else:
        click.echo("💡 ไม่พบไฟล์ข้อมูลดิบ รบกวนรันคำสั่ง python antigravity.py extract ก่อนนะครับ")
        return

    # บันทึกเป็นไฟล์ใหม่
    df_master = pd.DataFrame(master_records, columns=columns)
    # จัดเรียงข้อมูลตามหมวดหมู่ให้ดูง่ายและสวยงาม
    df_master = df_master.sort_values(by=["Category (หมวดหมู่หลัก)", "Sub-Category (หัวข้อย่อย)"])
    df_master.to_excel(output_master, index=False)
    
    click.echo(click.style(f"\n🎉 สำเร็จ! อัปเดตตารางและจัดกลุ่มหมวดหมู่เรียบร้อยแล้ว", fg='green', bold=True))
    click.echo(click.style(f"📊 ไฟล์ฐานข้อมูลเวอร์ชันแยกหมวดหมู่: {output_master}", fg='green'))

if __name__ == '__main__':
    cli()