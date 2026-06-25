"""
AXIS — minimal email sender for OTP codes.

If SMTP_* env vars are set, sends a real email. Otherwise runs in "dev mode":
the code is logged to the server console and the caller surfaces it in the UI
so the flow is testable without any email infrastructure.
"""

import os
import smtplib
import logging
from email.message import EmailMessage

logger = logging.getLogger("axis.mailer")


def smtp_configured() -> bool:
    return bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_USER")
                and os.environ.get("SMTP_PASS"))


def send_otp_email(to_email: str, code: str) -> bool:
    """Email the OTP. Returns True if actually sent via SMTP, False in dev mode."""
    if not smtp_configured():
        logger.warning(f"[DEV MODE] OTP for {to_email}: {code} (set SMTP_* to send real email)")
        print(f"\n*** AXIS verification code for {to_email}: {code} ***\n", flush=True)
        return False

    msg = EmailMessage()
    msg["Subject"] = "Your AXIS verification code"
    msg["From"] = os.environ.get("SMTP_FROM", os.environ["SMTP_USER"])
    msg["To"] = to_email
    msg.set_content(
        f"Welcome to AXIS!\n\nYour 6-digit verification code is: {code}\n\n"
        f"It expires in 10 minutes. If you didn't request this, you can ignore this email."
    )

    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ["SMTP_USER"]
    password = os.environ["SMTP_PASS"]

    try:
        with smtplib.SMTP(host, port, timeout=15) as server:
            server.starttls()
            server.login(user, password)
            server.send_message(msg)
        logger.info(f"OTP emailed to {to_email}")
        return True
    except Exception as e:
        # Don't block signup if email fails — fall back to dev behavior.
        logger.error(f"SMTP send failed: {e}")
        print(f"\n*** AXIS verification code for {to_email}: {code} (SMTP failed) ***\n", flush=True)
        return False
