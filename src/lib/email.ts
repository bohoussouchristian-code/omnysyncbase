import "server-only";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

// Échec silencieux côté appelant si Brevo n'est pas configuré (variables
// d'environnement absentes) : on log côté serveur mais on ne bloque jamais
// la création d'une entreprise à cause d'un envoi d'email raté — les
// identifiants restent de toute façon affichés à l'écran.
export async function sendMail({
  to,
  toName,
  subject,
  html,
}: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) {
    console.error("Envoi d'email ignoré : BREVO_API_KEY ou BREVO_SENDER_EMAIL manquant.");
    return { ok: false, error: "Service d'email non configuré." };
  }

  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "OSB — OmnySyncBase", email: senderEmail },
        to: [{ email: to, name: toName || to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Échec envoi email Brevo:", res.status, body);
      return { ok: false, error: `Brevo a refusé l'envoi (${res.status}).` };
    }
    return { ok: true };
  } catch (e) {
    console.error("Erreur réseau envoi email Brevo:", e);
    return { ok: false, error: "Erreur réseau lors de l'envoi." };
  }
}

export async function sendAdminCredentialsEmail({
  to,
  adminName,
  companyName,
  password,
}: {
  to: string;
  adminName: string;
  companyName: string;
  password: string;
}) {
  const loginUrl = "https://app.omnysyncbase.com/login";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
      <h2 style="color: #0b192c;">Bienvenue sur OSB</h2>
      <p>Bonjour ${adminName},</p>
      <p>Un compte administrateur vient d'être créé pour vous sur <strong>${companyName}</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Email</td>
          <td style="padding: 8px 0; font-weight: bold;">${to}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Mot de passe</td>
          <td style="padding: 8px 0; font-weight: bold; font-family: monospace; letter-spacing: 1px;">${password}</td>
        </tr>
      </table>
      <p>
        <a href="${loginUrl}" style="display: inline-block; background: #1c3d68; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none;">
          Se connecter
        </a>
      </p>
      <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
        Pour votre sécurité, changez ce mot de passe dès votre première connexion (menu compte → changer le mot de passe).
      </p>
    </div>
  `;

  return sendMail({
    to,
    toName: adminName,
    subject: `Vos identifiants OSB — ${companyName}`,
    html,
  });
}
