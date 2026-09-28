import base64
import hashlib
import io
import zipfile
from pydantic import BaseModel, Field
from fastapi import HTTPException

MAX_BYTES = 10 * 1024 * 1024
MAX_TEXT = 200000

class SourceUpload(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    data: str = Field(max_length=14 * 1024 * 1024)


def extract_source(request: SourceUpload):
    try:
        data = base64.b64decode(request.data, validate=True)
        if not data or len(data) > MAX_BYTES:
            raise ValueError('Use a non-empty file of at most 10 MB.')
        suffix = request.name.lower().rsplit('.', 1)[-1]
        passages = []
        if suffix == 'pdf':
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(data))
            if reader.is_encrypted:
                raise ValueError('Remove the PDF password before importing.')
            if len(reader.pages) > 250:
                raise ValueError('Split PDFs longer than 250 pages into smaller files.')
            for index, page in enumerate(reader.pages):
                content = page.extract_text() or ''
                if content.strip():
                    passages.append({'locator': f'Page {index + 1}', 'text': content.strip()})
        elif suffix == 'docx':
            from docx import Document
            archive = zipfile.ZipFile(io.BytesIO(data))
            if sum(item.file_size for item in archive.infolist()) > 50 * 1024 * 1024:
                raise ValueError('The expanded document is too large.')
            document = Document(io.BytesIO(data))
            for index, paragraph in enumerate(document.paragraphs):
                if paragraph.text.strip():
                    passages.append({'locator': f'Paragraph {index + 1}', 'text': paragraph.text})
            for index, table in enumerate(document.tables):
                passages.append({'locator': f'Table {index + 1}', 'text': '\n'.join(' | '.join(cell.text for cell in row.cells) for row in table.rows)})
        elif suffix in {'txt', 'md', 'csv', 'json'}:
            content = data.decode('utf-8-sig')
            for index, paragraph in enumerate(content.split('\n\n')):
                if paragraph.strip():
                    passages.append({'locator': f'Block {index + 1}', 'text': paragraph.strip()})
        else:
            raise ValueError('Supported files: text PDFs, DOCX, TXT, Markdown, CSV and JSON. Images and scanned PDFs need a text transcription first.')
        text = '\n\n'.join(f"[{item['locator']}] {item['text']}" for item in passages)
        if not text.strip():
            raise ValueError('No readable text was found. Supply a text transcription for scanned or image-only documents.')
        if len(text) > MAX_TEXT:
            raise ValueError('Extracted text exceeds 200,000 characters. Split this source before importing.')
        return {'name': request.name, 'content': text, 'passages': passages, 'sha256': hashlib.sha256(data).hexdigest(), 'byte_size': len(data), 'original_base64': request.data,
                'status': 'Needs review', 'approved': False,
                'limitations': ['Extraction may omit layout, images, headers or text boxes. Review against the original.']}
    except (ValueError, UnicodeError, zipfile.BadZipFile) as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(422, 'This document could not be extracted. Try exporting it as text.') from exc
