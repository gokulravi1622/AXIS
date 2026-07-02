"""
AXIS — email service for context share request notifications.

Uses Gmail SMTP via GMAIL_USER and GMAIL_APP_PASSWORD env vars.
Falls back to Brevo or SMTP if configured (reuses mailer.py infrastructure).
If no email provider is set, logs and skips — does not crash.
"""

import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger("axis.email_service")

GMAIL_USER = os.environ.get("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")

# Fall back to generic SMTP vars if Gmail vars not set
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "")
BREVO_API_KEY = os.environ.get("BREVO_API_KEY", "")
BREVO_SENDER = os.environ.get("BREVO_SENDER", "")


def _html_wrapper(title: str, body_html: str) -> str:
    """Wrap content in a clean dark-themed HTML email template."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Courier New',Courier,monospace;color:#e5e5e5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;max-width:520px;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 32px 20px;border-bottom:1px solid #2a2a2a;">
              <span style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.02em;font-family:'Courier New',Courier,monospace;">
                <span style="color:#6366F1;">AX</span>IS
              </span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              {body_html}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #2a2a2a;">
              <p style="margin:0;font-size:11px;color:#555;font-family:'Courier New',Courier,monospace;">
                This is an automated notification from AXIS. Do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _send_email(to: str, subject: str, html: str) -> bool:
    """
    Send an HTML email. Tries Gmail first, then Brevo, then generic SMTP.
    Returns True if sent, False otherwise (logs a warning but does not raise).
    """
    # 1. Try Gmail SMTP (GMAIL_USER + GMAIL_APP_PASSWORD)
    if GMAIL_USER and GMAIL_APP_PASSWORD:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"AXIS <{GMAIL_USER}>"
            msg["To"] = to
            msg.attach(MIMEText(html, "html"))
            with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as s:
                s.starttls()
                s.login(GMAIL_USER, GMAIL_APP_PASSWORD)
                s.sendmail(GMAIL_USER, to, msg.as_string())
            logger.info(f"Email sent to {to} via Gmail SMTP")
            return True
        except Exception as e:
            logger.error(f"Gmail SMTP send failed: {e}")

    # 2. Try Brevo HTTP API
    if BREVO_API_KEY:
        try:
            import requests
            sender_email = BREVO_SENDER or SMTP_FROM or SMTP_USER
            r = requests.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "api-key": BREVO_API_KEY,
                    "Content-Type": "application/json",
                    "accept": "application/json",
                },
                json={
                    "sender": {"name": "AXIS", "email": sender_email},
                    "to": [{"email": to}],
                    "subject": subject,
                    "htmlContent": html,
                },
                timeout=15,
            )
            if r.status_code in (200, 201):
                logger.info(f"Email sent to {to} via Brevo")
                return True
            logger.error(f"Brevo send failed: {r.status_code} {r.text[:200]}")
        except Exception as e:
            logger.error(f"Brevo send error: {e}")

    # 3. Try generic SMTP
    if SMTP_HOST and SMTP_USER and SMTP_PASS:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = SMTP_FROM or SMTP_USER
            msg["To"] = to
            msg.attach(MIMEText(html, "html"))
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
                s.starttls()
                s.login(SMTP_USER, SMTP_PASS)
                s.sendmail(SMTP_FROM or SMTP_USER, to, msg.as_string())
            logger.info(f"Email sent to {to} via SMTP")
            return True
        except Exception as e:
            logger.error(f"SMTP send failed: {e}")

    logger.warning(
        f"[DEV MODE] Email not sent (no email provider configured). "
        f"To: {to} | Subject: {subject}"
    )
    return False


def send_context_request_email(
    to: str,
    requester_name: str,
    requester_email: str,
    topic: str,
    request_id: int,
) -> bool:
    """Notify approver that someone is requesting context from them."""
    subject = f"AXIS: {requester_name} is requesting context from you"
    body = f"""
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.02em;">
      Context Request
    </h2>
    <p style="margin:0 0 20px;font-size:14px;color:#ccc;line-height:1.6;">
      <strong style="color:#fff;">{requester_name}</strong>
      (<a href="mailto:{requester_email}" style="color:#6366F1;text-decoration:none;">{requester_email}</a>)
      is asking for your help with a topic and has requested that you share context with them.
    </p>
    <div style="background:#111;border:1px solid #2a2a2a;border-left:3px solid #6366F1;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Topic</p>
      <p style="margin:0;font-size:14px;color:#e5e5e5;line-height:1.5;">{topic}</p>
    </div>
    <p style="margin:0 0 8px;font-size:13px;color:#888;line-height:1.6;">
      Log in to AXIS to approve or reject this request. You can set a duration of 24 hours or a single session.
    </p>
    <p style="margin:0;font-size:11px;color:#555;">Request ID: #{request_id}</p>
    """
    return _send_email(to, subject, _html_wrapper("Context Request — AXIS", body))


def send_request_approved_email(
    to: str,
    approver_name: str,
    topic: str,
    duration_label: str,
) -> bool:
    """Notify requester that their context request was approved."""
    subject = "AXIS: Your context request was approved"
    body = f"""
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.02em;">
      Request Approved
    </h2>
    <p style="margin:0 0 20px;font-size:14px;color:#ccc;line-height:1.6;">
      <strong style="color:#fff;">{approver_name}</strong> has approved your context request.
      Their knowledge will now be included in your AXIS queries for
      <strong style="color:#6366F1;">{duration_label}</strong>.
    </p>
    <div style="background:#111;border:1px solid #2a2a2a;border-left:3px solid #10B981;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Topic</p>
      <p style="margin:0;font-size:14px;color:#e5e5e5;line-height:1.5;">{topic}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
      You can now ask AXIS about this topic and the shared context will be automatically included.
    </p>
    """
    return _send_email(to, subject, _html_wrapper("Request Approved — AXIS", body))


def send_request_rejected_email(
    to: str,
    approver_name: str,
    topic: str,
) -> bool:
    """Notify requester that their context request was rejected."""
    subject = "AXIS: Your context request was declined"
    body = f"""
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.02em;">
      Request Declined
    </h2>
    <p style="margin:0 0 20px;font-size:14px;color:#ccc;line-height:1.6;">
      <strong style="color:#fff;">{approver_name}</strong> has declined your context request.
    </p>
    <div style="background:#111;border:1px solid #2a2a2a;border-left:3px solid #F87171;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Topic</p>
      <p style="margin:0;font-size:14px;color:#e5e5e5;line-height:1.5;">{topic}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
      You can send a new request if you believe this was a mistake or if the situation changes.
    </p>
    """
    return _send_email(to, subject, _html_wrapper("Request Declined — AXIS", body))


def send_access_revoked_email(
    to: str,
    approver_name: str,
    topic: str,
) -> bool:
    """Notify requester that their approved context access was revoked."""
    subject = "AXIS: Context access has been revoked"
    body = f"""
    <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.02em;">
      Access Revoked
    </h2>
    <p style="margin:0 0 20px;font-size:14px;color:#ccc;line-height:1.6;">
      <strong style="color:#fff;">{approver_name}</strong> has revoked your access to their shared context.
    </p>
    <div style="background:#111;border:1px solid #2a2a2a;border-left:3px solid #F59E0B;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Topic</p>
      <p style="margin:0;font-size:14px;color:#e5e5e5;line-height:1.5;">{topic}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
      Their context will no longer be included in your AXIS queries. You may send a new request if needed.
    </p>
    """
    return _send_email(to, subject, _html_wrapper("Access Revoked — AXIS", body))
