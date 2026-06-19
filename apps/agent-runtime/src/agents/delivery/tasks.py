"""
SPEC-08: Delivery tasks — PDF de entrega para o cliente.

Campos obrigatórios no PDF:
  - businessName, siteURL, adminURL
  - senha temporária (12 chars, sem 0/O/1/l/I ambíguos)
  - Lighthouse scores (performance, a11y, SEO, best-practices)
  - OWASP status
"""

from __future__ import annotations

import io
import random
import string
from dataclasses import dataclass
from typing import Any

# ── Ambiguity-free alphabet ──────────────────────────────────────────────────
_SAFE_CHARS = (
    string.ascii_uppercase.replace("O", "").replace("I", "")
    + string.ascii_lowercase.replace("o", "").replace("l", "")
    + string.digits.replace("0", "").replace("1", "")
    + "!@#$%^&*"
)


def generate_temp_password(length: int = 12) -> str:
    """12 chars, no ambiguous chars (0/O/1/l/I), mixed case + digit + symbol."""
    while True:
        pwd = "".join(random.SystemRandom().choices(_SAFE_CHARS, k=length))
        # Ensure at least one of each category
        has_upper = any(c.isupper() for c in pwd)
        has_lower = any(c.islower() for c in pwd)
        has_digit = any(c.isdigit() for c in pwd)
        has_sym = any(c in "!@#$%^&*" for c in pwd)
        if has_upper and has_lower and has_digit and has_sym:
            return pwd


@dataclass
class DeliveryReportData:
    business_name: str
    site_url: str
    admin_url: str
    temp_password: str
    lighthouse_performance: int
    lighthouse_a11y: int
    lighthouse_seo: int
    lighthouse_bp: int
    owasp_status: str  # PASS | FAIL | PARTIAL
    project_id: str


def build_delivery_report(data: DeliveryReportData) -> bytes:
    """Generate PDF bytes using reportlab. Returns PDF bytes."""
    try:
        from reportlab.lib import colors  # type: ignore[import-untyped]
        from reportlab.lib.pagesizes import A4  # type: ignore[import-untyped]
        from reportlab.lib.styles import getSampleStyleSheet  # type: ignore[import-untyped]
        from reportlab.lib.units import cm  # type: ignore[import-untyped]
        from reportlab.platypus import (  # type: ignore[import-untyped]
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
        )
    except ImportError as e:
        raise RuntimeError("reportlab is required for PDF generation. Install via: pip install reportlab") from e

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    elements = []

    # Title
    elements.append(Paragraph("📦 Relatório de Entrega — Hefesto", styles["Title"]))
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph(f"Cliente: {data.business_name}", styles["Heading2"]))
    elements.append(Spacer(1, 0.3 * cm))

    # Access info table
    access_data = [
        ["Campo", "Valor"],
        ["URL do Site", data.site_url],
        ["URL do Admin", data.admin_url],
        ["Senha Temporária", data.temp_password],
    ]
    t = Table(access_data, colWidths=[6 * cm, 10 * cm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563EB")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTNAME", (0, 2), (0, -1), "Helvetica-Bold"),
                ("PADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(t)
    elements.append(Spacer(1, 0.5 * cm))

    # Lighthouse scores
    elements.append(Paragraph("Resultados Lighthouse", styles["Heading3"]))
    lh_data = [
        ["Categoria", "Pontuação", "Status"],
        ["Performance", str(data.lighthouse_performance), "✓" if data.lighthouse_performance >= 85 else "✗"],
        ["Acessibilidade", str(data.lighthouse_a11y), "✓" if data.lighthouse_a11y == 100 else "✗"],
        ["SEO", str(data.lighthouse_seo), "✓" if data.lighthouse_seo >= 90 else "✗"],
        ["Boas Práticas", str(data.lighthouse_bp), "✓" if data.lighthouse_bp >= 90 else "✗"],
    ]
    lh = Table(lh_data, colWidths=[7 * cm, 4 * cm, 3 * cm])
    lh.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E40AF")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                ("PADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(lh)
    elements.append(Spacer(1, 0.3 * cm))

    # OWASP status
    owasp_color = "#16A34A" if data.owasp_status == "PASS" else "#DC2626"
    elements.append(
        Paragraph(
            f"Status OWASP: <font color='{owasp_color}'><b>{data.owasp_status}</b></font>",
            styles["Normal"],
        )
    )
    elements.append(Spacer(1, 1 * cm))
    elements.append(
        Paragraph(
            "⚠️ Altere a senha temporária imediatamente após o primeiro acesso.",
            styles["Normal"],
        )
    )

    doc.build(elements)
    return buffer.getvalue()


def create_delivery_task(project_data: dict[str, Any]) -> DeliveryReportData:
    """Factory: build DeliveryReportData from project dict, auto-generating temp password."""
    return DeliveryReportData(
        business_name=project_data.get("businessName", "Cliente"),
        site_url=project_data.get("siteURL", ""),
        admin_url=project_data.get("adminURL", ""),
        temp_password=generate_temp_password(12),
        lighthouse_performance=int(project_data.get("lighthousePerf", 0)),
        lighthouse_a11y=int(project_data.get("lighthouseA11y", 0)),
        lighthouse_seo=int(project_data.get("lighthouseSeo", 0)),
        lighthouse_bp=int(project_data.get("lighthouseBp", 0)),
        owasp_status=project_data.get("owaspStatus", "PARTIAL"),
        project_id=project_data.get("projectId", ""),
    )
