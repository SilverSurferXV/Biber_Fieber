import { schema, OutputType } from "./send-email_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { sendMailjetEmail } from "../../../helpers/sendMailjetEmail";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      throw new Error("Forbidden");
    }

    const bodyText = await request.text();
    const json = superjson.parse(bodyText);
    const { to, subject, body } = schema.parse(json);

    await sendMailjetEmail({
      from: { email: "service@biber-fieber.de", name: "Biber Fieber" },
      to: [{ email: to }],
      subject,
      html: body,
    });

    return new Response(superjson.stringify({ success: true } satisfies OutputType));
  } catch (error: any) {
    const status = error.message === "Forbidden" || error.name === "NotAuthenticatedError" ? 403 : error.status || 400;
    return new Response(superjson.stringify({ error: error.message }), { status });
  }
}