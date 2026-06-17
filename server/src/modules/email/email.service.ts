import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { logger } from "../../lib/logger";

let sesClient: SESClient | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SES_FROM_EMAIL?.trim() && process.env.AWS_REGION?.trim());
}

function getClient(): SESClient {
  if (!sesClient) {
    const region = process.env.AWS_REGION?.trim();
    if (!region) throw new Error("AWS_REGION is required for SES");
    sesClient = new SESClient({ region });
  }
  return sesClient;
}

async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const from = process.env.SES_FROM_EMAIL?.trim();
  if (!from) throw new Error("SES_FROM_EMAIL is not configured");

  const command = new SendEmailCommand({
    Source: `Loop In <${from}>`,
    Destination: { ToAddresses: [input.to] },
    Message: {
      Subject: { Data: input.subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: input.html, Charset: "UTF-8" },
        Text: { Data: input.text, Charset: "UTF-8" },
      },
    },
  });

  await getClient().send(command);
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

export async function sendPostApprovedEmail(input: {
  to: string;
  authorName: string;
  postTitle: string;
  postUrl: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    logger.warn({ to: input.to }, "Email not configured — skipping post-approved email");
    return;
  }

  const subject = `Your post has been approved — "${input.postTitle}"`;

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="margin-bottom:8px">Your post was approved</h2>
      <p style="color:#374151">Hi ${input.authorName},</p>
      <p style="color:#374151">Your post <strong>"${input.postTitle}"</strong> has been approved and is now visible on the feedback board.</p>
      <a href="${input.postUrl}"
         style="display:inline-block;margin-top:16px;padding:12px 24px;background:#0F172A;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
        View Post
      </a>
      <p style="margin-top:24px;color:#6B7280;font-size:13px">
        You're receiving this because you submitted feedback. If you have questions, reply to this email.
      </p>
    </div>
  `;

  const text =
    `Hi ${input.authorName},\n\n` +
    `Your post "${input.postTitle}" has been approved and is now visible on the feedback board.\n\n` +
    `View it here: ${input.postUrl}`;

  try {
    await sendEmail({ to: input.to, subject, html, text });
    logger.info({ to: input.to }, "Post-approved email sent");
  } catch (err) {
    logger.error({ err, to: input.to }, "Failed to send post-approved email");
  }
}

export async function sendPostShippedEmail(input: {
  to: string;
  authorName: string;
  postTitle: string;
  postUrl: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    logger.warn({ to: input.to }, "Email not configured — skipping post-shipped email");
    return;
  }

  const subject = `Your feedback has shipped — "${input.postTitle}"`;

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="margin-bottom:8px">Your feedback shipped 🚀</h2>
      <p style="color:#374151">Hi ${input.authorName},</p>
      <p style="color:#374151">Great news! The request you submitted — <strong>"${input.postTitle}"</strong> — has been shipped.</p>
      <a href="${input.postUrl}"
         style="display:inline-block;margin-top:16px;padding:12px 24px;background:#0F172A;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
        View Post
      </a>
      <p style="margin-top:24px;color:#6B7280;font-size:13px">
        Thank you for your feedback — it helps us build a better product.
      </p>
    </div>
  `;

  const text =
    `Hi ${input.authorName},\n\n` +
    `Great news! The request you submitted — "${input.postTitle}" — has been shipped.\n\n` +
    `View it here: ${input.postUrl}\n\n` +
    `Thank you for your feedback.`;

  try {
    await sendEmail({ to: input.to, subject, html, text });
    logger.info({ to: input.to }, "Post-shipped email sent");
  } catch (err) {
    logger.error({ err, to: input.to }, "Failed to send post-shipped email");
  }
}

export async function sendPostUpdateEmail(input: {
  to: string;
  authorName: string;
  postTitle: string;
  updateContent: string;
  postUrl: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    logger.warn({ to: input.to }, "Email not configured — skipping post-update email");
    return;
  }

  const subject = `New update on "${input.postTitle}"`;

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="margin-bottom:8px">New update on your post</h2>
      <p style="color:#374151">Hi ${input.authorName},</p>
      <p style="color:#374151">The team posted an official update on <strong>"${input.postTitle}"</strong>:</p>
      <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #0F172A;background:#F8FAFC;color:#374151;border-radius:0 4px 4px 0">
        ${input.updateContent}
      </blockquote>
      <a href="${input.postUrl}"
         style="display:inline-block;margin-top:16px;padding:12px 24px;background:#0F172A;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
        View Post
      </a>
      <p style="margin-top:24px;color:#6B7280;font-size:13px">
        You're receiving this because you submitted feedback on this post.
      </p>
    </div>
  `;

  const text =
    `Hi ${input.authorName},\n\n` +
    `The team posted an update on "${input.postTitle}":\n\n` +
    `${input.updateContent}\n\n` +
    `View it here: ${input.postUrl}`;

  try {
    await sendEmail({ to: input.to, subject, html, text });
    logger.info({ to: input.to }, "Post-update email sent");
  } catch (err) {
    logger.error({ err, to: input.to }, "Failed to send post-update email");
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
