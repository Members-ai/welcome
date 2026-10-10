// POST /request — receives an invitation request and emails it to the owner.
// Needs one secret in Cloudflare Pages: RESEND_API_KEY (now set).
// Optional variable: REQUEST_TO (defaults to the address below).

const DEFAULT_TO = "micha.hoard@gmail.com";
const FROM = "The Clark–Wilson <onboarding@resend.dev>";
const NAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

const reply = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export async function onRequestPost({ request, env }) {
  if (!env.RESEND_API_KEY) return reply(503, { ok: false, error: "not_configured" });

  let data;
  try {
    data = await request.json();
  } catch {
    return reply(400, { ok: false, error: "bad_request" });
  }

  // Hidden field that only automated senders fill in: accept silently, send nothing.
  if (data.website) return reply(200, { ok: true });

  const user = String(data.user || "").trim();
  if (!NAME.test(user)) return reply(400, { ok: false, error: "bad_name" });

  // Confirm the GitHub account exists, so a mistyped name is caught before it reaches the members.
  let profile = null;
  try {
    const gh = await fetch("https://api.github.com/users/" + encodeURIComponent(user), {
      headers: { "user-agent": "clark-wilson-welcome", accept: "application/vnd.github+json" },
    });
    if (gh.status === 404) return reply(404, { ok: false, error: "no_such_user" });
    if (gh.ok) profile = await gh.json();
  } catch {
    // GitHub unreachable: carry on, the owner checks the profile link.
  }

  const shown = profile && profile.name ? `${profile.name} (@${user})` : `@${user}`;
  const lines = [
    `Invitation request from ${shown}.`,
    "",
    `Profile: https://github.com/${user}`,
    ...(/^\d{1,7}$/.test(String(data.q || "")) ? [`Came from question No. ${data.q}: https://github.com/Members-ai/clark-wilson/issues/${data.q}`] : []),
    `Invite them: https://github.com/orgs/Members-ai/people`,
    "",
    `Received ${new Date().toUTCString()}.`,
  ];

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: "Bearer " + env.RESEND_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [env.REQUEST_TO || DEFAULT_TO],
      subject: "Invitation request: " + user,
      text: lines.join("\n"),
    }),
  });

  if (!res.ok) return reply(502, { ok: false, error: "send_failed" });
  return reply(200, { ok: true });
}

// Anything other than POST.
export const onRequest = () => reply(405, { ok: false, error: "post_only" });
