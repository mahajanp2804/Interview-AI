import pytest

from app import resume
from app.resume import ResumeError


def make_pdf(text="Built payment APIs in Go"):
    """A minimal valid one-page PDF containing `text`."""
    content = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n%s\nendstream" % (len(content), content),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    pdf = b"%PDF-1.4\n"
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf += b"%d 0 obj\n%s\nendobj\n" % (number, body)
    xref = len(pdf)
    pdf += b"xref\n0 6\n0000000000 65535 f \n"
    pdf += b"".join(b"%010d 00000 n \n" % offset for offset in offsets)
    pdf += b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % xref
    return pdf


def test_extracts_text_from_a_pdf():
    text, truncated = resume.extract_text(make_pdf())
    assert "Built payment APIs in Go" in text
    assert truncated is False


def test_long_text_is_truncated(monkeypatch):
    monkeypatch.setattr(resume, "MAX_CHARS", 10)
    text, truncated = resume.extract_text(make_pdf())
    assert len(text) == 10
    assert truncated is True


@pytest.mark.parametrize("data,message", [
    (b"hello, not a pdf", "doesn't look like a PDF"),
    (b"%PDF-1.4 garbage", "Couldn't read"),
    (make_pdf(" "), "No text found"),
])
def test_unusable_files_explain_why(data, message):
    with pytest.raises(ResumeError, match=message):
        resume.extract_text(data)


def test_oversized_file_is_rejected(monkeypatch):
    monkeypatch.setattr(resume, "MAX_BYTES", 10)
    with pytest.raises(ResumeError, match="too large"):
        resume.extract_text(make_pdf())
