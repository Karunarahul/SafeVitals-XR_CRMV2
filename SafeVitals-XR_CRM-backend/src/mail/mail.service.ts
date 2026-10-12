import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    const env = this.configService.get<string>('env') || process.env.NODE_ENV;
    const host = this.configService.get<string>('smtp.host');
    const port = this.configService.get<number>('smtp.port');
    const user = this.configService.get<string>('smtp.user');
    const pass = this.configService.get<string>('smtp.pass');

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        auth: { user, pass },
      });
      this.logger.log(`SMTP transporter initialized successfully for host ${host}:${port}`);
    } else if (env === 'test' || process.env.SMTP_MOCK === 'true') {
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      this.logger.log('Test JSON transport initialized for automated testing.');
    } else {
      this.logger.warn(
        'No SMTP credentials configured. Outgoing email delivery requests will fail safely.',
      );
    }
  }

  async sendMail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    const from =
      this.configService.get<string>('smtp.from') ||
      '"SafeVitals XR CRM" <noreply@safevitals.com>';

    if (!this.transporter) {
      const isTestOrDev = process.env.NODE_ENV !== 'production';
      if (isTestOrDev) {
        this.logger.warn(
          `[MOCK_EMAIL] SMTP not configured. Simulated dispatch to ${to} with subject "${subject}" in development/test environment.`,
        );
        return true;
      }
      this.logger.error(`Email dispatch failed to ${to}: SMTP transport is not configured.`);
      throw new BadGatewayException(
        'Email delivery service is unavailable: SMTP credentials not configured.',
      );
    }

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>?/gm, ''),
      });
      this.logger.log(`Email successfully dispatched to ${to}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to dispatch email to ${to}: ${error.message}`);
      if (process.env.NODE_ENV !== 'production' && process.env.SMTP_STRICT !== 'true') {
        this.logger.warn(
          `SMTP delivery failure handled gracefully in non-production mode for ${to}: ${error.message}`,
        );
        return false;
      }
      throw new BadGatewayException(`Failed to deliver email: ${error.message}`);
    }
  }

  async sendOtpEmail(to: string, otp: string, purpose = 'Verification'): Promise<boolean> {
    const subject = `Your SafeVitals XR ${purpose} Code: ${otp}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #0f172a;">SafeVitals XR CRM</h2>
        <p>Hello,</p>
        <p>Your one-time verification code is:</p>
        <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #0284c7;">
          ${otp}
        </div>
        <p style="margin-top: 20px; color: #64748b; font-size: 14px;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
      </div>
    `;
    return this.sendMail(to, subject, html, `Your SafeVitals XR verification code is: ${otp}`);
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<boolean> {
    const subject = 'Reset your SafeVitals XR CRM Password';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #0f172a;">SafeVitals XR CRM</h2>
        <p>Hello,</p>
        <p>You requested a password reset. Use the token below or the link provided in your application:</p>
        <div style="background-color: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace; word-break: break-all; color: #0284c7;">
          ${resetToken}
        </div>
        <p style="margin-top: 20px; color: #64748b; font-size: 14px;">If you did not request a password reset, please contact security immediately.</p>
      </div>
    `;
    return this.sendMail(to, subject, html);
  }

  async sendInvitationEmail(to: string, inviteToken: string, name: string): Promise<boolean> {
    const subject = 'Welcome to SafeVitals XR CRM - Account Invitation';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #0f172a;">SafeVitals XR CRM</h2>
        <p>Hello ${name},</p>
        <p>You have been invited to join the SafeVitals XR CRM workspace. Please use your activation token to complete your setup:</p>
        <div style="background-color: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace; word-break: break-all; color: #0284c7;">
          ${inviteToken}
        </div>
        <p style="margin-top: 20px; color: #64748b; font-size: 14px;">Visit the activation page in your CRM portal to set your password and access your account.</p>
      </div>
    `;
    return this.sendMail(to, subject, html);
  }
}
