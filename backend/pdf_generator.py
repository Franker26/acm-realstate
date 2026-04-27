import io
from datetime import datetime
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

from schemas import ACMRead, ResultadoResponse

_template_dir = Path(__file__).parent
_env = Environment(loader=FileSystemLoader(str(_template_dir)))


def generate_pdf(
    acm: ACMRead,
    resultado: ResultadoResponse,
    chart_image_b64: Optional[str] = None,
) -> bytes:
    template = _env.get_template("pdf_template.html")
    html_content = template.render(
        acm=acm,
        resultado=resultado,
        chart_image_b64=chart_image_b64,
        fecha=datetime.now().strftime("%d/%m/%Y"),
    )
    pdf_bytes = HTML(string=html_content).write_pdf()
    return pdf_bytes
