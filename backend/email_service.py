import os
import smtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Environment configuration for Zoho Mail SMTP
ZOHO_EMAIL = os.getenv("ZOHO_EMAIL", "")
ZOHO_PASSWORD = os.getenv("ZOHO_PASSWORD", "")
ZOHO_SMTP_HOST = os.getenv("ZOHO_SMTP_HOST", "smtppro.zoho.com")
ZOHO_SMTP_PORT = int(os.getenv("ZOHO_SMTP_PORT", "465"))  # 465 SSL or 587 TLS


def _send_email_sync(to_email: str, otp_code: str) -> bool:
    """Synchronous SMTP email sending function to be executed in thread pool."""
    # Always print OTP to dev console for transparent testing
    print(f"\n=======================================================")
    print(f"[OTP DEV LOG] Target Email: {to_email}")
    print(f"[OTP DEV LOG] Generated Verification Code: {otp_code}")
    print(f"=======================================================\n")

    if not ZOHO_EMAIL or not ZOHO_PASSWORD:
        print("[EMAIL SERVICE] Zoho credentials not provided (ZOHO_EMAIL / ZOHO_PASSWORD). Using dev log fallback.")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"{otp_code} is your K-Messenger Verification Code"
        msg["From"] = f"K-Messenger <{ZOHO_EMAIL}>"
        msg["To"] = to_email

        plain_text = f"Your K-Messenger verification code is {otp_code}. Valid for 10 minutes."
        html_text = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b0f17; color: #f1f5f9; padding: 20px; }}
            .container {{ max-width: 480px; margin: 0 auto; background: #151c2c; border: 1px solid #2e3a52; border-radius: 20px; padding: 32px; text-align: center; }}
            .logo {{ font-size: 24px; font-weight: 800; background: linear-gradient(to right, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }}
            .otp {{ font-size: 36px; font-weight: 900; letter-spacing: 6px; color: #a855f7; background: #0b0f17; padding: 16px 24px; border-radius: 14px; border: 1px solid #3b0764; display: inline-block; margin: 24px 0; }}
            .footer {{ font-size: 12px; color: #64748b; margin-top: 24px; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">K-Messenger</div>
            <p style="color: #94a3b8; font-size: 14px;">Your Private Verification Code</p>
            <div class="otp">{otp_code}</div>
            <p style="color: #cbd5e1; font-size: 13px;">Enter this 6-digit verification code to complete your profile registration. Code expires in 10 minutes.</p>
            <div class="footer">If you did not request this, please ignore this email.</div>
          </div>
        </body>
        </html>
        """

        msg.attach(MIMEText(plain_text, "plain"))
        msg.attach(MIMEText(html_text, "html"))

        if ZOHO_SMTP_PORT == 465:
            with smtplib.SMTP_SSL(ZOHO_SMTP_HOST, ZOHO_SMTP_PORT, timeout=10) as server:
                server.login(ZOHO_EMAIL, ZOHO_PASSWORD)
                server.sendmail(ZOHO_EMAIL, to_email, msg.as_string())
        else:
            with smtplib.SMTP(ZOHO_SMTP_HOST, ZOHO_SMTP_PORT, timeout=10) as server:
                server.starttls()
                server.login(ZOHO_EMAIL, ZOHO_PASSWORD)
                server.sendmail(ZOHO_EMAIL, to_email, msg.as_string())

        print(f"[EMAIL SERVICE] Email successfully dispatched to {to_email} via Zoho Mail.")
        return True
    except Exception as e:
        print(f"[EMAIL SERVICE WARNING] Failed to send email via Zoho SMTP: {e}. Fallback to dev log.")
        return True  # Fallback gracefully so registration flow isn't blocked during testing


async def send_otp_email(to_email: str, otp_code: str) -> bool:
    """Asynchronous wrapper to send OTP email without blocking FastAPI event loop."""
    return await asyncio.to_thread(_send_email_sync, to_email, otp_code)
