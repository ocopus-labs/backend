export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  headers?: Record<string, string>;
}

export interface SendEmailResponse {
  success: boolean;
  id?: string;
  message: string;
  error?: string;
}

export interface BulkEmailOptions {
  emails: SendEmailOptions[];
}
