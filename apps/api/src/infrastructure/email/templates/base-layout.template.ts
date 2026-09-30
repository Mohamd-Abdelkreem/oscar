import { escapeHtml } from "./html-escape.js";

export const baseLayoutTemplate = (input: {
  title: string;
  previewText: string;
  bodyHtml: string;
}): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;background:#eef3f1;color:#15211f;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.previewText)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#eef3f1;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;overflow:hidden;border:1px solid #cfdbd7;border-radius:18px;background:#ffffff;">
          <tr><td style="padding:24px 30px;border-bottom:1px solid #e2e9e7;font-size:18px;font-weight:700;">Full-Stack Boilerplate</td></tr>
          <tr><td style="padding:32px 30px;">${input.bodyHtml}</td></tr>
          <tr><td style="padding:20px 30px;border-top:1px solid #e2e9e7;color:#64726e;font-size:12px;line-height:1.6;">This automated message was sent by your application.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
