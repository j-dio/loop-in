import { Resend } from "resend";
import { logger } from "../../lib/logger";

let resendClient: Resend | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.FROM_EMAIL?.trim());
}

function getClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) throw new Error("RESEND_API_KEY is required");
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const from = process.env.FROM_EMAIL?.trim();
  if (!from) throw new Error("FROM_EMAIL is not configured");

  const { error } = await getClient().emails.send({
    from: `Loop In <${from}>`,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (error) throw new Error(error.message);
}

export async function sendPendingInviteEmail(input: {
  to: string;
  workspaceName: string;
  inviterName: string;
  acceptUrl: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    logger.warn({ to: input.to }, "Email not configured — skipping invite email");
    return;
  }

  const subject = `You've been invited to join ${input.workspaceName} on Loop In`;

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="margin-bottom:8px">You're invited!</h2>
      <p style="color:#374151"><strong>${input.inviterName}</strong> invited you to join <strong>${input.workspaceName}</strong> on Loop In.</p>
      <a href="${input.acceptUrl}"
         style="display:inline-block;margin-top:16px;padding:12px 24px;background:#0F172A;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
        Accept Invite
      </a>
      <p style="margin-top:24px;color:#6B7280;font-size:13px">
        This invite expires in 7 days. If you weren't expecting this, you can ignore this email.
      </p>
      <p style="color:#6B7280;font-size:13px">
        Or copy this link: <a href="${input.acceptUrl}" style="color:#0F172A">${input.acceptUrl}</a>
      </p>
    </div>
  `;

  const text =
    `You've been invited to join ${input.workspaceName} on Loop In.\n\n` +
    `${input.inviterName} sent you this invite.\n\n` +
    `Accept here: ${input.acceptUrl}\n\n` +
    `This invite expires in 7 days.`;

  try {
    await sendEmail({ to: input.to, subject, html, text });
    logger.info({ to: input.to, workspace: input.workspaceName }, "Invite email sent");
  } catch (err) {
    logger.error({ err, to: input.to }, "Failed to send invite email");
    // Don't throw — invite is still created; email failure is non-fatal
  }
}

export async function sendAddedToWorkspaceEmail(input: {
  to: string;
  workspaceName: string;
  inviterName: string;
  workspaceUrl: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    logger.warn({ to: input.to }, "Email not configured — skipping added-to-workspace email");
    return;
  }

  const subject = `You've been added to ${input.workspaceName} on Loop In`;

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="margin-bottom:8px">You're in!</h2>
      <p style="color:#374151"><strong>${input.inviterName}</strong> added you to <strong>${input.workspaceName}</strong> on Loop In.</p>
      <a href="${input.workspaceUrl}"
         style="display:inline-block;margin-top:16px;padding:12px 24px;background:#0F172A;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
        View Workspace
      </a>
      <p style="margin-top:24px;color:#6B7280;font-size:13px">
        If you weren't expecting this, contact the workspace admin.
      </p>
    </div>
  `;

  const text =
    `${input.inviterName} added you to ${input.workspaceName} on Loop In.\n\n` +
    `View it here: ${input.workspaceUrl}`;

  try {
    await sendEmail({ to: input.to, subject, html, text });
    logger.info({ to: input.to, workspace: input.workspaceName }, "Added-to-workspace email sent");
  } catch (err) {
    logger.error({ err, to: input.to }, "Failed to send added-to-workspace email");
  }
}
