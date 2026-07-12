import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '@config/config.service';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

const PASSWORD_RESET_TRANSLATIONS: Record<
  string,
  {
    subject: string;
    greeting: string;
    intro: string;
    button: string;
    expiry: string;
    footer: string;
  }
> = {
  en: {
    subject: 'Reset your TaskFlow password',
    greeting: 'Hi {{name}},',
    intro: 'We received a request to reset the password for your TaskFlow account.',
    button: 'Reset Password',
    expiry: 'This link expires in 1 hour.',
    footer:
      "If you didn't request a password reset, you can safely ignore this email — your password will not be changed.",
  },
  ru: {
    subject: 'Сброс пароля TaskFlow',
    greeting: 'Здравствуйте, {{name}},',
    intro: 'Мы получили запрос на сброс пароля для вашей учётной записи TaskFlow.',
    button: 'Сбросить пароль',
    expiry: 'Срок действия этой ссылки — 1 час.',
    footer:
      'Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо — ваш пароль останется без изменений.',
  },
  az: {
    subject: 'TaskFlow şifrənizi sıfırlayın',
    greeting: 'Salam {{name}},',
    intro: 'TaskFlow hesabınız üçün şifrə sıfırlama tələbi aldıq.',
    button: 'Şifrəni sıfırla',
    expiry: 'Bu link 1 saat ərzində etibarlıdır.',
    footer:
      'Əgər siz şifrə sıfırlamağı tələb etməmisinizsə, bu email-i sadəcə nəzərə almaya bilərsiniz — şifrəniz dəyişməyəcək.',
  },
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private templates = new Map<string, HandlebarsTemplateDelegate>();

  constructor(private config: AppConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      auth: {
        user: this.config.smtpUser,
        pass: this.config.smtpPass,
      },
    });
  }

  async sendMail(
    to: string,
    subject: string,
    templateName: string,
    context: Record<string, any>,
  ): Promise<void> {
    try {
      const html = this.renderTemplate(templateName, context);

      await this.transporter.sendMail({
        from: this.config.smtpFrom,
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent: ${templateName} → ${to}`);
    } catch (err) {
      // never let email failure break the caller
      this.logger.error(`Failed to send email to ${to}:`, err);
    }
  }

  // ─── Specific senders ────────────────────────────────────────────
  async sendTaskAssigned(
    to: string,
    context: {
      recipientName: string;
      actorName: string;
      projectName: string;
      taskKey: string;
      taskTitle: string;
      priority: string;
      dueDate: string;
      taskUrl: string;
      prefsUrl: string;
    },
  ) {
    await this.sendMail(
      to,
      `You've been assigned: ${context.taskKey} — ${context.taskTitle}`,
      'task-assigned',
      context,
    );
  }

  async sendTaskDueSoon(
    to: string,
    context: {
      recipientName: string;
      taskKey: string;
      taskTitle: string;
      projectName: string;
      priority: string;
      dueDate: string;
      dueDateRelative: string;
      taskUrl: string;
      prefsUrl: string;
    },
  ) {
    await this.sendMail(
      to,
      `Task due soon: ${context.taskKey} — ${context.taskTitle}`,
      'task-due-soon',
      context,
    );
  }

  async sendInvite(
    to: string,
    context: {
      inviterName: string;
      workspaceName: string;
      role: string;
      inviteUrl: string;
    },
  ) {
    await this.sendMail(
      to,
      `You've been invited to ${context.workspaceName} on TaskFlow`,
      'invite-member',
      context,
    );
  }

  async sendPasswordReset(
    to: string,
    context: {
      name: string;
      resetUrl: string;
      lang?: string;
    },
  ) {
    const t =
      PASSWORD_RESET_TRANSLATIONS[context.lang ?? 'en'] ??
      PASSWORD_RESET_TRANSLATIONS.en;

    await this.sendMail(to, t.subject, 'password-reset', {
      resetUrl: context.resetUrl,
      greeting: t.greeting.replace('{{name}}', context.name),
      intro: t.intro,
      buttonLabel: t.button,
      expiryNote: t.expiry,
      footerNote: t.footer,
    });
  }

  // ─── Template renderer ───────────────────────────────────────────
  private renderTemplate(name: string, context: Record<string, any>): string {
    if (!this.templates.has(name)) {
      const templatePath = path.join(__dirname, 'templates', `${name}.hbs`);
      const source = fs.readFileSync(templatePath, 'utf8');
      this.templates.set(name, Handlebars.compile(source));
    }

    return this.templates.get(name)!(context);
  }
}
