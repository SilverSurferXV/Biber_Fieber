export async function sendMailjetEmail(options: {
  to: { email: string; name?: string }[];
  from?: { email: string; name?: string };
  subject: string;
  html: string;
  attachments?: { filename: string; contentType: string; base64Content: string }[];
}): Promise<void> {
  const {
    to,
    from = { email: "noreply@biber-fieber.de", name: "Biber Fieber" },
    subject,
    html,
    attachments,
  } = options;

  const apiKey = process.env.MAILJET_API_KEY;
  const apiSecret = process.env.MAILJET_SECRET_KEY;

  if (!apiKey) {
    throw new Error("MAILJET_API_KEY is not configured in environment variables.");
  }
  if (!apiSecret) {
    throw new Error("MAILJET_SECRET_KEY is not configured in environment variables.");
  }

  const payload = {
    Messages: [
      {
        From: {
          Email: from.email,
          Name: from.name || "",
        },
        To: to.map((recipient) => ({
          Email: recipient.email,
          Name: recipient.name || "",
        })),
        Subject: subject,
        HTMLPart: html,
        ...(attachments && attachments.length > 0 ? {
          Attachments: attachments.map((a) => ({
            ContentType: a.contentType,
            Filename: a.filename,
            Base64Content: a.base64Content,
          })),
        } : {}),
      },
    ],
  };

  const response = await fetch("https://api.mailjet.com/v3.1/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + btoa(`${apiKey}:${apiSecret}`),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Mailjet API error:", errorText);
    throw new Error(`Failed to send email via Mailjet: ${response.statusText}`);
  }

  try {
    const data = await response.json();
    const messageIds = data.Messages?.map((m: any) => m.To?.map((t: any) => t.MessageID).filter(Boolean).join(', ')).filter(Boolean).join(' | ') || "No IDs";
    console.log(`Mailjet response: ${response.status} ${response.statusText} - MessageIDs: ${messageIds}`);
  } catch (err) {
    console.log(`Mailjet response: ${response.status} ${response.statusText}`);
  }
}