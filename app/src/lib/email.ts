/**
 * Envio de emails transacionais via Resend.
 * Requer RESEND_API_KEY no ambiente.
 * Requer domínio verificado no Resend (unafit.com.br).
 */

import { Resend } from 'resend';

const RESEND_KEY = import.meta.env.RESEND_API_KEY ?? process.env.RESEND_API_KEY ?? null;
const FROM_EMAIL = import.meta.env.FROM_EMAIL ?? process.env.FROM_EMAIL ?? 'noreply@unafit.com.br';

export function emailConfigurado(): boolean {
  return !!RESEND_KEY;
}

function getResend() {
  if (!RESEND_KEY) throw new Error('RESEND_API_KEY não configurado.');
  return new Resend(RESEND_KEY);
}

// ─── Template base ────────────────────────────────────────────────────────────

function templateBase(params: {
  nomeAcademia: string;
  logoUrl: string | null;
  titulo: string;
  corpo: string;
  rodape?: string;
}): string {
  const { nomeAcademia, logoUrl, titulo, corpo, rodape } = params;

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${nomeAcademia}" style="max-height:60px;max-width:200px;object-fit:contain;" />`
    : `<span style="font-size:22px;font-weight:700;color:#ffffff;">${nomeAcademia}</span>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Header com logo -->
          <tr>
            <td align="center" style="background:#18181b;border-radius:12px 12px 0 0;padding:28px 32px 20px;border-bottom:1px solid #27272a;">
              ${logoHtml}
            </td>
          </tr>

          <!-- Corpo -->
          <tr>
            <td style="background:#18181b;padding:32px 32px 24px;border-radius:0 0 12px 12px;">
              <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#ffffff;">${titulo}</h1>
              ${corpo}
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td align="center" style="padding:20px 0 0;">
              <p style="margin:0;font-size:12px;color:#52525b;">
                ${rodape ?? `Este e-mail foi enviado por <strong>${nomeAcademia}</strong> através da plataforma UNAFIT.`}
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:#3f3f46;">Se você não solicitou este e-mail, ignore-o.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Email de boas-vindas para nova academia ──────────────────────────────────

export async function enviarEmailBoasVindasAcademia(params: {
  email: string;        // destinatário do e-mail
  emailLogin?: string;  // e-mail de login (se diferente do destinatário)
  nomeAcademia: string;
  senhaTemporaria?: string;
  linkAcesso: string;
  linkLogin: string;
}): Promise<{ ok: boolean; erro?: string }> {
  const { email, emailLogin, nomeAcademia, senhaTemporaria, linkAcesso } = params;
  const loginExibido = emailLogin ?? email;

  const blocoSenha = senhaTemporaria ? `
    <div style="background:#27272a;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
      <p style="margin:0 0 10px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.05em;">Seus dados de acesso</p>
      <p style="margin:0 0 8px;font-size:14px;color:#a1a1aa;">E-mail: <strong style="color:#ffffff;">${loginExibido}</strong></p>
      <p style="margin:0 0 8px;font-size:14px;color:#a1a1aa;">Senha: <strong style="color:#ffffff;font-family:monospace;font-size:20px;letter-spacing:.12em;">${senhaTemporaria}</strong></p>
      <p style="margin:0 0 8px;font-size:14px;color:#a1a1aa;">URL: <a href="${linkAcesso}" style="color:#dc2626;">${linkAcesso}</a></p>
      <p style="margin:12px 0 0;font-size:11px;color:#71717a;">Recomendamos alterar a senha após o primeiro acesso.</p>
    </div>` : '';

  const corpo = `
    <p style="margin:0 0 16px;font-size:15px;color:#a1a1aa;line-height:1.6;">
      Sua academia <strong style="color:#ffffff;">${nomeAcademia}</strong> foi cadastrada na plataforma
      <strong style="color:#ffffff;">UNAFIT</strong>. Clique no botão abaixo para acessar o sistema.
    </p>

    ${blocoSenha}

    <table cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
      <tr>
        <td style="background:#dc2626;border-radius:8px;">
          <a href="${linkAcesso}"
             style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
            Acessar o sistema →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:12px;color:#52525b;">
      Ou acesse diretamente: <a href="${linkAcesso}" style="color:#dc2626;">${linkAcesso}</a>
    </p>
  `;

  const html = templateBase({
    nomeAcademia: 'UNAFIT',
    logoUrl: null,
    titulo: `Bem-vindo(a) à UNAFIT — Complete seu cadastro`,
    corpo,
  });

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: `UNAFIT <${FROM_EMAIL}>`,
      to: email,
      subject: `UNAFIT — Sua academia ${nomeAcademia} foi cadastrada`,
      html,
    });
    if (error) return { ok: false, erro: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, erro: e.message };
  }
}

// ─── Email de cadastro completo ───────────────────────────────────────────────

export async function enviarEmailCadastroCompleto(params: {
  email: string;
  nomeResponsavel: string;
  nomeAcademia: string;
  logoUrl: string | null;
  linkAcademia: string;
}): Promise<{ ok: boolean; erro?: string }> {
  const { email, nomeResponsavel, nomeAcademia, logoUrl, linkAcademia } = params;

  const corpo = `
    <p style="margin:0 0 12px;font-size:15px;color:#a1a1aa;">
      Olá, <strong style="color:#ffffff;">${nomeResponsavel}</strong>!
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#a1a1aa;line-height:1.6;">
      O cadastro da academia <strong style="color:#ffffff;">${nomeAcademia}</strong> foi
      <strong style="color:#22c55e;">confirmado com sucesso</strong>. Seu sistema está ativo e pronto para uso.
    </p>

    <div style="background:#16a34a1a;border:1px solid #16a34a4d;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#86efac;line-height:1.8;">
        ✓ Dados cadastrais confirmados<br/>
        ✓ Painel de controle liberado<br/>
        ✓ Cadastro de alunos e colaboradores habilitado<br/>
        ✓ Sistema financeiro ativo
      </p>
    </div>

    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:#dc2626;border-radius:8px;">
          <a href="${linkAcademia}"
             style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
            Acessar meu painel →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:12px;color:#52525b;">
      Use seu e-mail e senha para entrar. Em caso de dúvidas, entre em contato com o suporte UNAFIT.
    </p>
  `;

  const html = templateBase({
    nomeAcademia,
    logoUrl,
    titulo: `Cadastro confirmado — ${nomeAcademia}`,
    corpo,
  });

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: `UNAFIT <${FROM_EMAIL}>`,
      to: email,
      subject: `${nomeAcademia} — Cadastro confirmado, sistema liberado!`,
      html,
    });
    if (error) return { ok: false, erro: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, erro: e.message };
  }
}

// ─── Email de redefinição de senha ───────────────────────────────────────────

export async function enviarEmailResetSenha(params: {
  email: string;
  nomeAluno: string;
  nomeAcademia: string;
  logoUrl: string | null;
  linkReset: string;
}): Promise<{ ok: boolean; erro?: string }> {
  const { email, nomeAluno, nomeAcademia, logoUrl, linkReset } = params;

  const corpo = `
    <p style="margin:0 0 12px;font-size:15px;color:#a1a1aa;">
      Olá, <strong style="color:#ffffff;">${nomeAluno}</strong>!
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#a1a1aa;line-height:1.6;">
      Você recebeu este e-mail porque sua academia <strong style="color:#ffffff;">${nomeAcademia}</strong>
      solicita que você crie ou redefina sua senha de acesso ao sistema.
    </p>

    <!-- Botão CTA -->
    <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:#dc2626;border-radius:8px;">
          <a href="${linkReset}"
             style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
            Criar minha senha →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 8px;font-size:13px;color:#52525b;">
      Se o botão não funcionar, copie e cole este link no seu navegador:
    </p>
    <p style="margin:0;font-size:12px;color:#71717a;word-break:break-all;">
      <a href="${linkReset}" style="color:#dc2626;">${linkReset}</a>
    </p>

    <hr style="margin:24px 0;border:none;border-top:1px solid #27272a;" />
    <p style="margin:0;font-size:12px;color:#52525b;">
      Este link expira em <strong style="color:#a1a1aa;">24 horas</strong>.
      Após criar sua senha, acesse o sistema em
      <a href="https://unafit.com.br/login" style="color:#dc2626;">unafit.com.br/login</a>
      com seu e-mail e a senha escolhida.
    </p>
  `;

  const html = templateBase({
    nomeAcademia,
    logoUrl,
    titulo: `Crie sua senha — ${nomeAcademia}`,
    corpo,
  });

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: `${nomeAcademia} <${FROM_EMAIL}>`,
      to: email,
      subject: `${nomeAcademia} — Crie sua senha de acesso`,
      html,
    });
    if (error) return { ok: false, erro: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, erro: e.message };
  }
}

// ─── Email de atualização de cadastro ─────────────────────────────────────────

export async function enviarEmailAtualizacaoCadastro(params: {
  email: string;
  nomeAluno: string;
  nomeAcademia: string;
  logoUrl: string | null;
  alteracoes: { campo: string; novoValor: string }[];
}): Promise<{ ok: boolean; erro?: string }> {
  const { email, nomeAluno, nomeAcademia, logoUrl, alteracoes } = params;

  const linhasAlteracoes = alteracoes.map(a => `
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#a1a1aa;border-bottom:1px solid #27272a;">${a.campo}</td>
      <td style="padding:8px 12px;font-size:13px;color:#ffffff;font-weight:600;border-bottom:1px solid #27272a;">${a.novoValor}</td>
    </tr>
  `).join('');

  const corpo = `
    <p style="margin:0 0 12px;font-size:15px;color:#a1a1aa;">
      Olá, <strong style="color:#ffffff;">${nomeAluno}</strong>!
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#a1a1aa;line-height:1.6;">
      Informamos que os dados do seu cadastro na academia
      <strong style="color:#ffffff;">${nomeAcademia}</strong> foram atualizados:
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="border:1px solid #27272a;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <thead>
        <tr style="background:#27272a;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:.05em;">Campo</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:.05em;">Novo valor</th>
        </tr>
      </thead>
      <tbody>${linhasAlteracoes}</tbody>
    </table>

    <p style="margin:0;font-size:13px;color:#52525b;line-height:1.6;">
      Se você não reconhece esta alteração ou acredita que houve um erro,
      entre em contato com a academia <strong style="color:#a1a1aa;">${nomeAcademia}</strong> imediatamente.
    </p>
  `;

  const html = templateBase({
    nomeAcademia,
    logoUrl,
    titulo: 'Atualização de cadastro',
    corpo,
  });

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: `${nomeAcademia} <${FROM_EMAIL}>`,
      to: email,
      subject: `${nomeAcademia} — Seus dados foram atualizados`,
      html,
    });
    if (error) return { ok: false, erro: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, erro: e.message };
  }
}
