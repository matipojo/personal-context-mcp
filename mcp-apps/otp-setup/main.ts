import { App } from '@modelcontextprotocol/ext-apps';

const APP_ID = 'personal-mcp/otp-setup';

type OtpSetupPayload = {
  app: typeof APP_ID;
  v: 1;
  summary: string;
  secret: string;
  backupCodes: string[];
  qrPngBase64: string;
  issuer: string;
  label: string;
  digits: number;
  period: number;
};

function isPayload(x: unknown): x is OtpSetupPayload {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    o['app'] === APP_ID &&
    o['v'] === 1 &&
    typeof o['secret'] === 'string' &&
    Array.isArray(o['backupCodes']) &&
    typeof o['qrPngBase64'] === 'string'
  );
}

function render(payload: OtpSetupPayload): void {
  const root = document.getElementById('root');
  if (!root) return;

  const qrSrc = `data:image/png;base64,${payload.qrPngBase64}`;

  root.innerHTML = `
    <h1>OTP setup complete</h1>
    <p class="muted">${escapeHtml(payload.summary)}</p>
    <p class="warn">Save your backup codes in a safe place. Each code works once.</p>
    <div id="qr-wrap"><img id="qr" alt="OTP QR code" src="${qrSrc}" /></div>
    <h2>Manual entry</h2>
    <p>Secret key:</p>
    <div class="secret">${escapeHtml(payload.secret)}</div>
    <details class="backup-codes-details">
      <summary>Backup codes</summary>
      <div class="codes">
        ${payload.backupCodes.map((c) => `<code>${escapeHtml(c)}</code>`).join('')}
      </div>
    </details>
    <div class="meta">
      <div><strong>Issuer:</strong> ${escapeHtml(payload.issuer)}</div>
      <div><strong>Account:</strong> ${escapeHtml(payload.label)}</div>
      <div><strong>Digits / period:</strong> ${payload.digits} / ${payload.period}s</div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function extractFromToolResult(result: unknown): OtpSetupPayload | null {
  if (!result || typeof result !== 'object') return null;
  const r = result as { structuredContent?: unknown; content?: unknown };

  if (isPayload(r.structuredContent)) {
    return r.structuredContent;
  }

  const blocks = r.content;
  if (!Array.isArray(blocks)) return null;
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const b = block as { type?: string; text?: string };
    if (b.type !== 'text' || typeof b.text !== 'string') continue;
    try {
      const parsed: unknown = JSON.parse(b.text);
      if (isPayload(parsed)) return parsed;
    } catch {
      /* ignore */
    }
  }
  return null;
}

const app = new App({ name: 'personal-context OTP', version: '1.0.0' });

app.ontoolresult = (result) => {
  const payload = extractFromToolResult(result);
  const root = document.getElementById('root');
  if (payload) {
    render(payload);
    return;
  }
  if (root) {
    root.innerHTML =
      '<p id="placeholder">Could not read OTP setup data from the tool result.</p>';
  }
};

void app.connect();
