"""
Resume text extraction
----------------------
Turns an uploaded PDF, DOCX or plain-text resume into clean text. Only the
text is kept; the file itself is never stored.

The input is untrusted, so:
* the file type is decided from the leading bytes, never from the file name;
* size, PDF page count, DOCX entry sizes and the stored text length are capped;
* DOCX is read with the standard ``zipfile`` and a regular expression over the
  bounded ``word/document.xml``, not an XML parser, so XML entity-expansion
  attacks do not apply; PDFs are parsed by pypdf (encrypted PDFs are refused);
* the extracted text is passed through ``neutralize`` (control characters and
  prompt-delimiter look-alikes removed) because it is later embedded in an LLM
  prompt, where it is fenced and treated as data.
"""

from __future__ import annotations

import html
import io
import re
import zipfile

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.postgres import Resume
from utils.prompt_safety import clean_line, neutralize

MAX_BYTES = 2 * 1024 * 1024
MAX_PDF_PAGES = 12
MAX_DOCX_XML_BYTES = 5 * 1024 * 1024
MAX_DOCX_ENTRIES = 1000
MAX_TEXT_CHARS = 20_000
MIN_TEXT_CHARS = 50

PDF_TYPE = "application/pdf"
DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
TEXT_TYPE = "text/plain"


class ResumeError(Exception):
    """A resume that cannot be used; ``status_code`` is the HTTP status to return."""

    def __init__(self, message: str, status_code: int = 422) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def detect_type(data: bytes) -> str:
    """The content type judged from the first bytes (never from the file name)."""
    if data.startswith(b"%PDF-"):
        return PDF_TYPE
    if data.startswith(b"PK\x03\x04"):
        return DOCX_TYPE
    head = data[:4096]
    if b"\x00" not in head:
        try:
            data.decode("utf-8")
            return TEXT_TYPE
        except UnicodeDecodeError:
            pass
    raise ResumeError("Unsupported file. Upload a PDF, DOCX or plain-text (.txt) resume.", 415)


def _pdf_text(data: bytes) -> str:
    from pypdf import PdfReader  # imported lazily: only needed on upload
    from pypdf.errors import PyPdfError

    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ResumeError("Password-protected PDFs are not supported. Remove the password and upload again.")
        parts = []
        for page in reader.pages[:MAX_PDF_PAGES]:
            parts.append(page.extract_text() or "")
    except ResumeError:
        raise
    except (PyPdfError, ValueError, KeyError, TypeError, RecursionError, OSError) as exc:
        raise ResumeError(f"This PDF could not be read ({type(exc).__name__}).") from exc
    return "\n".join(parts)


_DOCX_PARAGRAPH_END = re.compile(r"</w:p\s*>")
_DOCX_BREAKS = re.compile(r"<w:(?:br|cr)\b[^>]*/?>")
_DOCX_TAB = re.compile(r"<w:tab\b[^>]*/?>")
_DOCX_TEXT = re.compile(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", re.DOTALL)
_ANY_TAG = re.compile(r"<[^>]+>")


def _docx_text(data: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_DOCX_ENTRIES:
                raise ResumeError("This DOCX file has too many parts to read safely.")
            try:
                info = archive.getinfo("word/document.xml")
            except KeyError as exc:
                raise ResumeError("This is not a valid DOCX resume.", 415) from exc
            if info.file_size > MAX_DOCX_XML_BYTES:
                raise ResumeError("This DOCX document is too large to read safely.", 413)
            xml = archive.read(info).decode("utf-8", errors="replace")
    except zipfile.BadZipFile as exc:
        raise ResumeError("This is not a valid DOCX resume.", 415) from exc

    xml = _DOCX_BREAKS.sub("\n", xml)
    xml = _DOCX_TAB.sub("\t", xml)
    xml = _DOCX_PARAGRAPH_END.sub("\n", xml)
    # Keep only run text and the newlines/tabs inserted above.
    pieces: list[str] = []
    cursor = 0
    for match in _DOCX_TEXT.finditer(xml):
        gap = xml[cursor:match.start()]
        pieces.append("".join(ch for ch in _ANY_TAG.sub("", gap) if ch in "\n\t"))
        pieces.append(html.unescape(_ANY_TAG.sub("", match.group(1))))
        cursor = match.end()
    pieces.append("".join(ch for ch in _ANY_TAG.sub("", xml[cursor:]) if ch in "\n\t"))
    return "".join(pieces)


def _tidy(text: str) -> str:
    text = neutralize(text)
    text = "\n".join(line.rstrip() for line in text.splitlines())
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) > MAX_TEXT_CHARS:
        text = text[:MAX_TEXT_CHARS].rstrip()
    return text


def extract_text(data: bytes) -> tuple[str, str]:
    """Return ``(clean_text, content_type)`` or raise ResumeError."""
    if not data:
        raise ResumeError("The uploaded file is empty.", 400)
    if len(data) > MAX_BYTES:
        raise ResumeError(f"The file is too large (limit {MAX_BYTES // (1024 * 1024)} MB).", 413)
    content_type = detect_type(data)
    if content_type == PDF_TYPE:
        raw = _pdf_text(data)
    elif content_type == DOCX_TYPE:
        raw = _docx_text(data)
    else:
        raw = data.decode("utf-8")
    text = _tidy(raw)
    if len(text) < MIN_TEXT_CHARS:
        raise ResumeError(
            "Not enough readable text was found. Scanned or image-only resumes are not supported; "
            "upload a text-based PDF, DOCX or .txt file."
        )
    return text, content_type


def safe_filename(name: str | None) -> str:
    base = (name or "").replace("\\", "/").rsplit("/", 1)[-1]
    return clean_line(base, 200) or "resume"


async def get_resume(db: AsyncSession, user_id: int) -> Resume | None:
    result = await db.execute(select(Resume).where(Resume.user_id == user_id))
    return result.scalar_one_or_none()
