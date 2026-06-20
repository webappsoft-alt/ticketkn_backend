#!/usr/bin/env python3
"""Generate client-facing Break-Even Analytics PDF."""

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUTPUT = "/Users/danish/projects/ticketkn_backend/docs/TicketKN-Break-Even-Analytics-Guide.pdf"


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="CoverTitle",
            parent=styles["Title"],
            fontSize=26,
            leading=32,
            alignment=TA_CENTER,
            spaceAfter=16,
            textColor=colors.HexColor("#1a1a2e"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverSub",
            parent=styles["Normal"],
            fontSize=13,
            leading=18,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#444444"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="Section",
            parent=styles["Heading1"],
            fontSize=16,
            leading=20,
            spaceBefore=18,
            spaceAfter=10,
            textColor=colors.HexColor("#16213e"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="SubSection",
            parent=styles["Heading2"],
            fontSize=12,
            leading=16,
            spaceBefore=12,
            spaceAfter=6,
            textColor=colors.HexColor("#0f3460"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            parent=styles["Normal"],
            fontSize=10.5,
            leading=15,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Formula",
            parent=styles["Body"],
            fontName="Courier",
            fontSize=10,
            backColor=colors.HexColor("#f4f6f8"),
            borderPadding=8,
            leftIndent=6,
            rightIndent=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Note",
            parent=styles["Body"],
            fontSize=10,
            textColor=colors.HexColor("#555555"),
            leftIndent=12,
        )
    )
    return styles


def table(data, col_widths=None):
    t = Table(data, colWidths=col_widths, hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#16213e")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return t


def main():
    styles = build_styles()
    doc = SimpleDocTemplate(
        OUTPUT,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title="TicketKN Break-Even Analytics Guide",
        author="TicketKN",
    )

    story = []

    # Cover
    story.append(Spacer(1, 3 * cm))
    story.append(Paragraph("TicketKN", styles["CoverSub"]))
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph("Break-Even Analytics", styles["CoverTitle"]))
    story.append(Paragraph("How the API Calculates Event Break-Even", styles["CoverSub"]))
    story.append(Spacer(1, 1 * cm))
    story.append(
        Paragraph(
            "Client reference guide &mdash; Break-Even endpoint<br/>"
            "API: <b>GET /api/users/analytics/break-even</b>",
            styles["CoverSub"],
        )
    )
    story.append(Spacer(1, 2 * cm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cccccc")))
    story.append(Spacer(1, 0.4 * cm))
    story.append(
        Paragraph(
            "This document explains what data is used, how costs and revenue are combined, "
            "and how each number in the API response is calculated.",
            styles["Body"],
        )
    )
    story.append(PageBreak())

    # 1. Overview
    story.append(Paragraph("1. Overview", styles["Section"]))
    story.append(
        Paragraph(
            "The Break-Even Analytics feature helps event organisers understand how many tickets "
            "must be sold to cover fixed event costs, how far they have progressed toward that goal, "
            "and what revenue/profit is projected by the event date.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "<b>Important:</b> Fixed costs (venue, staff, marketing, equipment) are entered by the "
            "admin/organiser as query parameters each time the report is run. They are not stored "
            "permanently on the event record in the database.",
            styles["Note"],
        )
    )

    # 2. API request
    story.append(Paragraph("2. API Request", styles["Section"]))
    story.append(
        Paragraph(
            "<b>Method:</b> GET<br/>"
            "<b>URL:</b> https://api.ticketkn.com/api/users/analytics/break-even<br/>"
            "<b>Authentication:</b> Admin token required (x-auth-token header)",
            styles["Body"],
        )
    )
    story.append(Paragraph("Example request", styles["SubSection"]))
    story.append(
        Paragraph(
            "GET /api/users/analytics/break-even"
            "?eventId=6a36eb7486fe41ef29ee9fb8"
            "&amp;venueCost=15"
            "&amp;staffCost=5",
            styles["Formula"],
        )
    )
    story.append(
        table(
            [
                ["Query parameter", "Required", "Description", "Default"],
                ["eventId", "Yes", "The event to analyse", "—"],
                ["venueCost", "No*", "Venue / location fixed cost", "0"],
                ["staffCost", "No*", "Staff / crew fixed cost", "0"],
                ["marketingCost", "No*", "Marketing / promotion cost", "0"],
                ["equipmentCost", "No*", "Equipment / production cost", "0"],
                ["variableCostPerUnit", "No", "Variable cost per ticket sold (v)", "0"],
                ["totalCosts", "No", "Override: single fixed-cost total", "Sum of cost fields"],
            ],
            col_widths=[3.2 * cm, 1.6 * cm, 6.8 * cm, 3.4 * cm],
        )
    )
    story.append(Spacer(1, 8))
    story.append(
        Paragraph(
            "* At least one cost input is required: either <b>totalCosts</b> or a combination of "
            "venue/marketing/staff/equipment costs totalling more than zero.",
            styles["Note"],
        )
    )

    # 3. Data sources
    story.append(Paragraph("3. Data Sources", styles["Section"]))
    story.append(
        table(
            [
                ["Data", "Source", "Used for"],
                ["Event details", "Event record (by eventId)", "Event date, ticket plan prices (fallback)"],
                [
                    "Ticket sales",
                    "Purchase records for this event",
                    "Tickets sold, total revenue, sales dates",
                ],
                ["Fixed & variable costs", "Query parameters you send", "Break-even cost model"],
            ],
            col_widths=[3.2 * cm, 5.8 * cm, 6 * cm],
        )
    )
    story.append(Spacer(1, 10))
    story.append(Paragraph("Which purchases are counted?", styles["SubSection"]))
    story.append(
        Paragraph(
            "Only <b>primary ticket purchases</b> for the selected event are included.<br/>"
            "&bull; Included: standard purchases linked to the event<br/>"
            "&bull; Excluded: resell purchases (tickets sold on the secondary/resell market)",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "<b>ticketsSold</b> = sum of the <i>tickets</i> field on each included purchase<br/>"
            "<b>totalRevenue</b> = sum of the <i>totalPrice</i> field on each included purchase",
            styles["Formula"],
        )
    )

    # 4. Calculations
    story.append(PageBreak())
    story.append(Paragraph("4. How Calculations Work", styles["Section"]))

    story.append(Paragraph("Step 1 — Fixed costs (F)", styles["SubSection"]))
    story.append(
        Paragraph(
            "F = venueCost + marketingCost + staffCost + equipmentCost<br/>"
            "(or use totalCosts directly if provided)",
            styles["Formula"],
        )
    )
    story.append(
        Paragraph(
            "Example: venueCost=15 and staffCost=5 &rarr; <b>F = $20</b>",
            styles["Body"],
        )
    )

    story.append(Paragraph("Step 2 — Average ticket price (p)", styles["SubSection"]))
    story.append(
        Paragraph(
            "If tickets have been sold:<br/>"
            "p = totalRevenue &divide; ticketsSold",
            styles["Formula"],
        )
    )
    story.append(
        Paragraph(
            "If no tickets sold yet, the system estimates <b>p</b> from the event's configured "
            "ticket plans (weighted average of plan prices).",
            styles["Body"],
        )
    )

    story.append(Paragraph("Step 3 — Variable cost per ticket (v)", styles["SubSection"]))
    story.append(
        Paragraph(
            "v = variableCostPerUnit from query (defaults to 0 if not sent).<br/>"
            "Examples: printing cost per ticket, payment processing per ticket, etc.",
            styles["Body"],
        )
    )

    story.append(Paragraph("Step 4 — Break-even ticket quantity (Q*)", styles["SubSection"]))
    story.append(
        Paragraph(
            "Contribution margin = p &minus; v<br/>"
            "Q* = F &divide; (p &minus; v)",
            styles["Formula"],
        )
    )
    story.append(
        Paragraph(
            "<b>Meaning:</b> Q* is the number of tickets that must be sold (at average price p) "
            "to cover all fixed costs F, after accounting for variable cost v per ticket.",
            styles["Body"],
        )
    )

    story.append(Paragraph("Step 5 — Progress & tickets remaining", styles["SubSection"]))
    story.append(
        Paragraph(
            "progressPercentage = (ticketsSold &divide; Q*) &times; 100<br/>"
            "ticketsRemaining = max(0, ceil(Q* &minus; ticketsSold))",
            styles["Formula"],
        )
    )

    story.append(Paragraph("Step 6 — Sales velocity & trend", styles["SubSection"]))
    story.append(
        Paragraph(
            "daysElapsed = days from first purchase (or event creation) to today (minimum 1)<br/>"
            "ticketsPerDay = ticketsSold &divide; daysElapsed",
            styles["Formula"],
        )
    )
    story.append(
        Paragraph(
            "<b>salesTrend</b> compares ticket sales in the last 7 days vs the previous 7 days:<br/>"
            "&bull; <b>Rising</b> — current week sells more than 5% faster<br/>"
            "&bull; <b>Falling</b> — current week sells more than 5% slower<br/>"
            "&bull; <b>Stable</b> — otherwise",
            styles["Body"],
        )
    )

    story.append(Paragraph("Step 7 — Projection to event date", styles["SubSection"]))
    story.append(
        Paragraph(
            "daysUntilEvent = days from today until the event start date<br/>"
            "projectedTickets = ticketsSold + (ticketsPerDay &times; daysUntilEvent)<br/>"
            "projectedRevenue = projectedTickets &times; p<br/>"
            "projectedProfitLoss = projectedRevenue &minus; F &minus; (projectedTickets &times; v)",
            styles["Formula"],
        )
    )
    story.append(
        Paragraph(
            "This is a <b>linear projection</b>: it assumes the current daily sales rate continues "
            "unchanged until the event. It does not model marketing spikes, sell-out limits, or "
            "capacity caps unless reflected in actual sales data.",
            styles["Note"],
        )
    )

    story.append(Paragraph("Step 8 — Chart data", styles["SubSection"]))
    story.append(
        Paragraph(
            "The API returns 21 chart points (0 to max quantity) for plotting revenue vs total cost:<br/>"
            "&bull; <b>Revenue</b> at quantity Q = Q &times; p<br/>"
            "&bull; <b>Total cost</b> at quantity Q = F + (Q &times; v)<br/>"
            "Break-even occurs where revenue line crosses the total cost line (at Q*).",
            styles["Body"],
        )
    )

    # 5. Worked example
    story.append(PageBreak())
    story.append(Paragraph("5. Worked Example", styles["Section"]))
    story.append(
        Paragraph(
            "Request: eventId=6a36eb7486fe41ef29ee9fb8, venueCost=15, staffCost=5<br/>"
            "Assume the event has sold <b>100 tickets</b> generating <b>$2,000</b> total revenue.",
            styles["Body"],
        )
    )
    story.append(
        table(
            [
                ["Metric", "Calculation", "Result"],
                ["Fixed costs (F)", "15 + 5", "$20"],
                ["Avg ticket price (p)", "2000 ÷ 100", "$20"],
                ["Variable cost (v)", "not provided", "$0"],
                ["Break-even tickets (Q*)", "20 ÷ (20 − 0)", "1 ticket"],
                ["Progress", "100 ÷ 1 × 100", "100%"],
                ["Tickets remaining", "max(0, 1 − 100)", "0"],
            ],
            col_widths=[4.5 * cm, 5.5 * cm, 3 * cm],
        )
    )
    story.append(Spacer(1, 10))
    story.append(
        Paragraph(
            "In this example the event passed break-even after the first ticket because fixed "
            "costs were low ($20) relative to average ticket price ($20). Real events with higher "
            "costs or lower prices will show a higher Q*.",
            styles["Body"],
        )
    )

    # 6. Response fields
    story.append(Paragraph("6. API Response Fields", styles["Section"]))
    story.append(
        table(
            [
                ["Field", "Description"],
                ["totalCosts", "Total fixed costs (F)"],
                ["totalRevenue", "Sum of purchase totalPrice for primary sales"],
                ["ticketsSold", "Total tickets sold so far"],
                ["averageTicketPrice / pricePerUnit", "Average revenue per ticket (p)"],
                ["breakEvenTickets", "Tickets needed to break even (Q*)"],
                ["progressPercentage", "% of break-even achieved"],
                ["ticketsRemaining", "Tickets still needed to reach break-even"],
                ["salesTrend", "Rising, Falling, or Stable"],
                ["salesVelocity.ticketsPerDay", "Average tickets sold per day"],
                ["salesVelocity.daysElapsed", "Days since sales started"],
                ["projection.projectedTickets", "Estimated tickets by event date"],
                ["projection.projectedRevenue", "Estimated revenue by event date"],
                ["projection.projectedProfitLoss", "Estimated profit/loss by event date"],
                ["chart.points", "Revenue vs cost curve for UI chart"],
                ["costs.*", "Echo of cost inputs used in the calculation"],
            ],
            col_widths=[5.5 * cm, 9.5 * cm],
        )
    )

    # 7. Limitations
    story.append(Spacer(1, 14))
    story.append(Paragraph("7. Important Notes & Limitations", styles["Section"]))
    notes = [
        "Costs are entered manually per request — changing costs changes break-even instantly.",
        "Resell/secondary-market ticket revenue is excluded from this report.",
        "Revenue uses the owner-facing totalPrice stored on purchases (after platform fee logic in TicketKN).",
        "If no tickets are sold, average price is estimated from ticket plans — not from actual sales.",
        "Projections assume a constant daily sales rate; real-world campaigns may differ.",
        "The chart is a mathematical model for visualisation; actual profit depends on real sales mix and refunds.",
    ]
    for note in notes:
        story.append(Paragraph(f"&bull; {note}", styles["Body"]))

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cccccc")))
    story.append(Spacer(1, 8))
    story.append(
        Paragraph(
            "TicketKN &mdash; Break-Even Analytics API<br/>"
            "Document generated for client reference.",
            styles["CoverSub"],
        )
    )

    doc.build(story)
    print(f"PDF written to {OUTPUT}")


if __name__ == "__main__":
    main()
