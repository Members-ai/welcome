// The invitation request form, shared by the front page and /join.
// Requests are posted to /request, which emails the host. If that service is
// not available, the form falls back to opening an email draft instead.
(function () {
  const REQUEST_ADDRESS = "micha.hoard@gmail.com";
  const form = document.getElementById("request");
  if (!form) return;
  const note = document.getElementById("note");
  const done = document.getElementById("done");
  const button = form.querySelector("button");
  const label = button.textContent;
  const q = (new URLSearchParams(location.search).get("q") || "").replace(/\D/g, "").slice(0, 7);

  function draft(user) {
    const subject = "Invitation request: " + user;
    const body = "GitHub username: " + user + "\n" + (q ? "Came from question No. " + q + "\n" : "");
    location.href = "mailto:" + REQUEST_ADDRESS +
      "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const user = form.user.value.trim();
    note.textContent = "";
    button.disabled = true;
    button.textContent = "Sending";

    let res = null;
    try {
      res = await fetch("/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user: user, q: q, website: form.website.value }),
      });
    } catch (err) { /* network failure: handled below */ }

    let info = {};
    if (res) { try { info = await res.json(); } catch (err) { /* not from the service */ } }

    if (res && res.ok && info.ok) {
      form.hidden = true;
      done.hidden = false;
      return;
    }

    button.disabled = false;
    button.textContent = label;

    if (info.error === "no_such_user") {
      note.textContent = "That GitHub name could not be found. Kindly check it and try again.";
    } else if (info.error === "bad_name") {
      note.textContent = "That does not look like a GitHub username. Kindly check it and try again.";
    } else if (info.error === "send_failed") {
      note.textContent = "Regrets. The request could not be delivered just now. Kindly try again shortly.";
    } else {
      draft(user);
    }
  });
})();
