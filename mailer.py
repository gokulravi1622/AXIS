"""
AXIS — email sender for OTP codes.

Tries, in order:
  1. Brevo HTTP API   — works on hosts that block SMTP ports (e.g. HF Spaces). Set
                        BREVO_API_KEY (+ BREVO_SENDER, a Brevo-verified sender email).
  2. SMTP             — works locally / on hosts that allow SMTP egress. Set SMTP_*.
  3. Dev fallback     — log the code + return it to the UI, so the flow is testable.
"""

import os
import smtplib
import logging
from email.message import EmailMessage

import requests

logger = logging.getLogger("axis.mailer")

SUBJECT = "Your AXIS verification code"


def _body(code: str) -> str:
    return (f"Welcome to AXIS!\n\nYour 6-digit verification code is: {code}\n\n"
            f"It expires in 10 minutes. If you didn't request this, ignore this email.")


def smtp_configured() -> bool:
    return bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_USER")
                and os.environ.get("SMTP_PASS"))


def _send_via_brevo(to_email: str, code: str) -> bool:
    api_key = os.environ.get("BREVO_API_KEY")
    if not api_key:
        return False
    sender = (os.environ.get("BREVO_SENDER") or os.environ.get("SMTP_FROM")
              or os.environ.get("SMTP_USER"))
    try:
        r = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": api_key, "Content-Type": "application/json",
                     "accept": "application/json"},
            json={
                "sender": {"name": "AXIS", "email": sender},
                "to": [{"email": to_email}],
                "subject": SUBJECT,
                "textContent": _body(code),
            },
            timeout=15,
        )
        if r.status_code in (200, 201):
            logger.info(f"OTP emailed to {to_email} via Brevo")
            return True
        logger.error(f"Brevo send failed: {r.status_code} {r.text[:200]}")
    except Exception as e:
        logger.error(f"Brevo send error: {e}")
    return False


def _send_via_smtp(to_email: str, code: str) -> bool:
    if not smtp_configured():
        return False
    msg = EmailMessage()
    msg["Subject"] = SUBJECT
    msg["From"] = os.environ.get("SMTP_FROM", os.environ["SMTP_USER"])
    msg["To"] = to_email
    msg.set_content(_body(code))
    try:
        with smtplib.SMTP(os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", "587")), timeout=15) as s:
            s.starttls()
            s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
            s.send_message(msg)
        logger.info(f"OTP emailed to {to_email} via SMTP")
        return True
    except Exception as e:
        logger.error(f"SMTP send failed: {e}")
    return False


def send_otp_email(to_email: str, code: str) -> bool:
    """Email the OTP. Returns True if actually sent, False in dev mode."""
    if _send_via_brevo(to_email, code):
        return True
    if _send_via_smtp(to_email, code):
        return True
    logger.warning(f"[DEV MODE] OTP for {to_email}: {code} (configure BREVO_API_KEY or SMTP_*)")
    print(f"\n*** AXIS verification code for {to_email}: {code} ***\n", flush=True)
    return False
