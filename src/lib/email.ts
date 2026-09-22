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

function formatNow() {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

// Gabarit commun aux emails d'identifiants (création de compte, réinitialisation
// de mot de passe...) : bandeau OSB, quelques lignes de contexte à puces, le
// bloc identifiants mis en évidence, le bouton de connexion et le rappel de
// sécurité. `rows` porte les lignes de contexte spécifiques à chaque cas.
function credentialsEmailHtml({
  heading,
  greetingName,
  intro,
  rows,
  to,
  password,
}: {
  heading: string;
  greetingName: string;
  intro: string;
  rows: { icon: string; label: string; value: string }[];
  to: string;
  password: string;
}) {
  const loginUrl = "https://app.omnysyncbase.com/login";
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #f8fafc;">
      <div style="background: #0b192c; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <p style="color: #fbbf24; font-size: 11px; font-weight: bold; letter-spacing: 3px; margin: 0 0 6px;">OSB — OMNYSYNCBASE</p>
        <h1 style="color: #ffffff; font-size: 20px; margin: 0;">${heading}</h1>
      </div>

      <div style="background: #ffffff; padding: 24px; color: #1e293b;">
        <p>Bonjour ${greetingName},</p>
        <p>${intro}</p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
          ${rows
            .map(
              (r) => `
          <tr>
            <td style="padding: 6px 0; color: #64748b;">${r.icon} ${r.label}</td>
            <td style="padding: 6px 0; text-align: right;">${r.value}</td>
          </tr>`
            )
            .join("")}
        </table>

        <div style="background: #f1f5f9; border-radius: 10px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 10px; font-size: 13px; color: #64748b; font-weight: bold;">IDENTIFIANTS DE CONNEXION</p>
          <p style="margin: 0 0 6px;">📧 <strong>${to}</strong></p>
          <p style="margin: 0; font-family: monospace; letter-spacing: 1px;">🔑 <strong>${password}</strong></p>
        </div>

        <p style="text-align: center; margin: 24px 0;">
          <a href="${loginUrl}" style="display: inline-block; background: #1c3d68; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Se connecter
          </a>
        </p>

        <p style="color: #64748b; font-size: 13px; margin-top: 24px;">
          🔒 Pour votre sécurité, changez ce mot de passe dès votre première connexion (menu compte → changer le mot de passe).
        </p>

        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">À bientôt sur OSB !</p>
      </div>
    </div>
  `;
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
  const html = credentialsEmailHtml({
    heading: "Nouveau compte administrateur créé",
    greetingName: adminName,
    intro: `Un compte administrateur a été créé pour vous sur <strong>${companyName}</strong>.`,
    rows: [
      { icon: "📅", label: "Date", value: formatNow() },
      { icon: "🏢", label: "Entreprise", value: companyName },
      { icon: "👤", label: "Rôle", value: "Administrateur" },
    ],
    to,
    password,
  });

  return sendMail({
    to,
    toName: adminName,
    subject: `Vos identifiants OSB — ${companyName}`,
    html,
  });
}

export async function sendPasswordResetEmail({
  to,
  userName,
  resetByName,
  password,
}: {
  to: string;
  userName: string;
  resetByName: string;
  password: string;
}) {
  const html = credentialsEmailHtml({
    heading: "Compte réinitialisé",
    greetingName: userName,
    intro: `Votre compte a été réinitialisé avec succès par <strong>${resetByName}</strong>.`,
    rows: [
      { icon: "📅", label: "Date", value: formatNow() },
      { icon: "👤", label: "Compte réinitialisé", value: userName },
      { icon: "🛠️", label: "Réinitialisé par", value: resetByName },
    ],
    to,
    password,
  });

  return sendMail({
    to,
    toName: userName,
    subject: "Votre compte OSB a été réinitialisé",
    html,
  });
}
