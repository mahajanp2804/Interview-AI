"""
resume.py
Turns an uploaded PDF resume into plain text for question generation.
Nothing is stored: the text goes back to the browser and is only sent on when questions are generated.
"""
from io import BytesIO

from pypdf import PdfReader

MAX_BYTES = 5 * 1024 * 1024
MAX_PAGES = 10
MAX_CHARS = 20000


class ResumeError(Exception):
    """The file can't be used. The message is safe to show users."""


def extract_text(data: bytes) -> tuple[str, bool]:
    """Returns (text, truncated)."""
    if len(data) > MAX_BYTES:
        raise ResumeError("That file is too large. The limit is 5 MB.")
    if not data.startswith(b"%PDF"):
        raise ResumeError("That doesn't look like a PDF. Upload a PDF or paste your resume as text.")

    try:
        reader = PdfReader(BytesIO(data))
        if reader.is_encrypted:
            raise ResumeError("That PDF is password-protected. Paste your resume as text instead.")
        pages = reader.pages[:MAX_PAGES]
        text = "\n".join(page.extract_text() or "" for page in pages).strip()
    except ResumeError:
        raise
    except Exception as e:
        raise ResumeError("Couldn't read that PDF. Paste your resume as text instead.") from e

    if not text:
        raise ResumeError("No text found in that PDF (it may be a scan). Paste your resume as text instead.")
    return text[:MAX_CHARS], len(text) > MAX_CHARS or len(reader.pages) > MAX_PAGES
