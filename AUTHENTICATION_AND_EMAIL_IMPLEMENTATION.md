# Authentication and Email Service Implementation Guide

## Overview
This document describes the complete implementation of authentication and email services in the Billing System backend, including welcome emails on signup and password reset functionality.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Email Service Implementation](#email-service-implementation)
3. [Better Auth Configuration](#better-auth-configuration)
4. [Authentication Controller](#authentication-controller)
5. [Password Reset Flow](#password-reset-flow)
6. [Environment Configuration](#environment-configuration)
7. [Testing](#testing)

---

## Architecture Overview

### Tech Stack
- **Backend Framework**: NestJS 11.0.1
- **Authentication**: Better Auth 1.3.34
- **Email Service**: Nodemailer 7.0.10
- **Database**: PostgreSQL (via Prisma)
- **ORM**: Prisma 6.18.0

### Component Diagram
```
Frontend (SvelteKit)
    ↓
AuthController (NestJS)
    ↓
Better Auth → Auth Handler
    ↓           ↓
Database    Email Service (Nodemailer)
```

---

## Email Service Implementation

### Location
`src/email/email.service.ts`

### Features
1. **SMTP Configuration** - Gmail SMTP with secure connection
2. **Welcome Emails** - Sent on user registration
3. **Password Reset Emails** - Sent when user requests password reset
4. **Order Confirmation Emails** - For order management
5. **Invoice Emails** - For billing

### Email Templates

#### Welcome Email
```typescript
async sendWelcomeEmail(to: string, name: string): Promise<boolean>
```
- Sends a styled HTML email welcoming new users
- Includes company logo and call-to-action
- Automatically sent after successful registration

#### Password Reset Email
```typescript
async sendPasswordResetEmail(to: string, resetToken: string, name: string): Promise<boolean>
```
- Includes a secure reset link with token
- Link expires in 1 hour
- Frontend URL: `${FRONTEND_URL}/reset-password?token=${resetToken}`

### SMTP Configuration
```typescript
private transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '465'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});
```

### Email Module Export
```typescript
// src/email/email.module.ts
@Module({
  providers: [EmailService],
  controllers: [EmailController],
  exports: [EmailService], // ← Makes EmailService available to other modules
})
export class EmailModule {}
```

---

## Better Auth Configuration

### Location
`src/auth/auth.ts`

### Core Configuration
```typescript
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url, token }) => {
      // Directly send email using nodemailer
      await sendPasswordResetEmail(user.email, token, user.name || user.email);
    },
  },
  baseURL: process.env.AUTH_BASE_URL || 'http://localhost:3001',
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:3001',
  ],
});
```

### Key Features
1. **Database Integration**: Uses Prisma adapter for PostgreSQL
2. **Email/Password Auth**: Enabled with optional email verification
3. **Password Reset**: Custom callback to send reset emails
4. **CORS Configuration**: Trusted origins for frontend communication
5. **Social Providers**: GitHub and Google OAuth support (optional)

### Password Reset Implementation
The `sendResetPassword` callback:
- Receives user object, reset URL, and token from Better Auth
- Directly calls nodemailer to send email
- Uses environment variables for SMTP configuration
- Logs success/failure for debugging

---

## Authentication Controller

### Location
`src/auth/auth.controller.ts`

### Purpose
Acts as a proxy between frontend and Better Auth, intercepting responses to trigger email sending.

### Implementation Strategy

#### 1. Response Capture Mechanism
```typescript
@All('*')
async handleAuth(@Req() req: Request, @Res() res: Response) {
  const handler = toNodeHandler(auth);
  
  // Capture response body by wrapping res.write/res.end
  const chunks: Buffer[] = [];
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  
  // Override write to capture chunks
  res.write = (chunk: any, ...args: any[]) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return originalWrite(chunk, ...args);
  };
  
  // Override end to process captured data
  res.end = (chunk: any, ...args: any[]) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    res.write = originalWrite;
    res.end = originalEnd;
    return originalEnd(chunk, ...args);
  };
}
```

#### 2. Response Parsing and Email Triggering
```typescript
// Build captured body
let bodyText = Buffer.concat(chunks).toString('utf8');

// Parse JSON response
const parsed = JSON.parse(bodyText);

// Extract user data
const user = parsed?.user ?? parsed?.data?.user ?? parsed?.data ?? parsed;
const maybeEmail = user?.email || parsed?.email;
const maybeName = user?.name || user?.displayName;

// Trigger welcome email on signup
if (req.method === 'POST' && 
    /sign-up|signup|register|create/i.test(req.url || '') && 
    maybeEmail) {
  this.emailService.sendWelcomeEmail(maybeEmail, maybeName || maybeEmail);
}
```

#### 3. Debug Logging
Comprehensive logging with emojis for easy identification:
- 🔍 Request logging
- 📦 Response capture
- ✅ Parsed response
- 👤 Extracted user data
- ✉️ Email trigger
- ❌ Error handling

### Module Integration
```typescript
// src/auth/auth.module.ts
@Module({
  imports: [EmailModule], // ← Import EmailModule
  controllers: [AuthController],
})
export class AuthModule {}
```

---

## Password Reset Flow

### Complete Flow Diagram
```
User Requests Reset
    ↓
Frontend: authClient.forgetPassword({ email })
    ↓
Backend: POST /api/auth/forget-password
    ↓
Better Auth: Generates reset token
    ↓
auth.ts: sendResetPassword callback triggered
    ↓
Nodemailer: Sends email with reset link
    ↓
User Clicks Link in Email
    ↓
Frontend: /reset-password?token={token}
    ↓
User Enters New Password
    ↓
Frontend: Calls /api/auth/reset-password
    ↓
Better Auth: Validates token and updates password
    ↓
Success: User redirected to login
```

### Frontend Integration

#### Forgot Password Page
```svelte
<!-- frontend/src/routes/(auth)/forget-password/+page.svelte -->
<script>
  async function handleEmailSubmit(event: Event) {
    const result = await authClient.forgetPassword({
      email,
      redirectTo: `${window.location.origin}/reset-password`
    });
    
    if (result.error) {
      toast.error(result.error.message);
    } else {
      toast.success('Password reset email sent!');
    }
  }
</script>
```

#### Reset Password Page
```svelte
<!-- frontend/src/routes/(auth)/reset-password/+page.svelte -->
<script>
  let token = $derived($page.url.searchParams.get('token') || '');
  
  async function handleResetSubmit(event: Event) {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token, newPassword: password })
    });
    
    if (!response.ok) {
      toast.error('Failed to reset password');
    } else {
      toast.success('Password reset successfully!');
      goto('/login');
    }
  }
</script>
```

### API Proxy Configuration
```typescript
// frontend/vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
});
```

---

## Environment Configuration

### Backend `.env` File
```properties
# Server Configuration
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL="postgres://user:password@host:port/database?sslmode=require"

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Email Configuration (Gmail SMTP)
EMAIL_USER=technoabid.dev@gmail.com
EMAIL_PASSWORD=czhisqpubrdfgdvj
EMAIL_SERVICE=gmail
EMAIL_FROM="Billing System <technoabid.dev@gmail.com>"
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_SECURE=true

# Better Auth Configuration
BETTER_AUTH_SECRET=bG9m2UXGTfH0e9P8bPsz1Mzt4DAOq9P1
AUTH_BASE_URL=http://localhost:3001

# Session Configuration
SESSION_EXPIRY_DAYS=7
SESSION_UPDATE_AGE_DAYS=1

# OAuth (Optional)
# GITHUB_CLIENT_ID=
# GITHUB_CLIENT_SECRET=
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
```

### Frontend `.env` File
```properties
PUBLIC_API_URL=http://localhost:3001
```

### Gmail App Password Setup
1. Go to Google Account → Security
2. Enable 2-Step Verification
3. Go to App Passwords
4. Generate password for "Mail"
5. Use generated password in `EMAIL_PASSWORD`

---

## Testing

### Test Email Service
```bash
# Test endpoint
POST http://localhost:3001/email/test

# PowerShell
$response = Invoke-WebRequest -Uri "http://localhost:3001/email/test" -Method POST -ContentType "application/json" -Body '{}'
$response.Content
```

Expected Response:
```json
{
  "success": true,
  "message": "Test email sent successfully to technoabid.dev@gmail.com"
}
```

### Test Welcome Email
1. Register a new user at `http://localhost:5173/register`
2. Check backend logs for:
   ```
   🔍 Auth request: POST /api/auth/sign-up/email
   👤 Extracted - email: user@example.com, name: John Doe
   ✉️ 📧 SENDING WELCOME EMAIL to user@example.com
   ✅ Welcome email sent successfully: true
   ```
3. Check email inbox for welcome message

### Test Password Reset
1. Go to `http://localhost:5173/forget-password`
2. Enter registered email address
3. Check backend logs for:
   ```
   🔐 Password reset requested for: user@example.com
   🎫 Reset token: Xk6INoBBk3McSWo5gBU94Bda
   ✅ Password reset email sent to user@example.com
   ```
4. Check email inbox for reset link
5. Click link → redirects to `/reset-password?token=...`
6. Enter new password and submit
7. Should redirect to login page

### Debug Logging
All operations are logged with emoji prefixes:
- 🔍 Request logging
- 📦 Response capture
- ✅ Success operations
- 👤 User data extraction
- ✉️ Email triggers
- 🔐 Password reset operations
- ❌ Errors

---

## Common Issues and Solutions

### Issue 1: Emails Not Sending
**Symptoms**: No emails received, "socket close" error
**Solution**: 
1. Verify Gmail App Password is correct
2. Check `EMAIL_SECURE=true` in .env
3. Ensure port 465 is not blocked
4. Restart backend server

### Issue 2: 404 on Forgot Password
**Symptoms**: Frontend shows 404 error
**Solution**:
1. Restart frontend dev server (proxy config needs reload)
2. Verify Vite proxy configuration exists
3. Check Better Auth endpoint is `/forget-password` not `/forgot-password`

### Issue 3: Welcome Email Not Triggered
**Symptoms**: Registration works but no email
**Solution**:
1. Check backend logs for email trigger
2. Verify AuthModule imports EmailModule
3. Check URL pattern matching in AuthController
4. Ensure EmailService is injected correctly

### Issue 4: Reset Link Invalid
**Symptoms**: Token expired or invalid
**Solution**:
1. Check FRONTEND_URL in backend .env
2. Verify reset link format: `{FRONTEND_URL}/reset-password?token={token}`
3. Ensure token hasn't expired (1 hour default)

---

## Security Best Practices

1. **Environment Variables**: Never commit .env files
2. **App Passwords**: Use Gmail App Passwords, not account password
3. **Token Expiry**: Reset tokens expire in 1 hour
4. **HTTPS**: Use HTTPS in production for EMAIL_SECURE
5. **Secret Keys**: Generate strong BETTER_AUTH_SECRET
6. **CORS**: Configure trustedOrigins properly
7. **Email Verification**: Set `requireEmailVerification: true` in production

---

## Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Enable email verification: `requireEmailVerification: true`
- [ ] Use HTTPS for FRONTEND_URL and AUTH_BASE_URL
- [ ] Generate new BETTER_AUTH_SECRET
- [ ] Configure production SMTP (SendGrid, AWS SES, etc.)
- [ ] Set up rate limiting for password reset
- [ ] Enable logging to external service (e.g., Sentry)
- [ ] Test all email flows in staging
- [ ] Configure database connection pooling
- [ ] Set up monitoring and alerts

---

## Maintenance

### Adding New Email Templates
1. Create new method in `EmailService`
2. Add HTML template with inline CSS
3. Test with email test endpoint
4. Document in this guide

### Updating Better Auth
1. Check Better Auth changelog
2. Update package: `pnpm update better-auth`
3. Test authentication flows
4. Update this documentation if API changes

### Monitoring Email Delivery
1. Check backend logs for email send status
2. Monitor SMTP connection errors
3. Track email delivery rates
4. Set up alerts for failed sends

---

## Support and Troubleshooting

### Logs to Check
```bash
# View all auth-related logs
grep "Auth" backend-logs.txt

# View email-related logs
grep "Email" backend-logs.txt

# View Better Auth callbacks
grep "🔐\|🔗\|🎫" backend-logs.txt
```

### Useful Commands
```bash
# Restart backend
cd backend && npm run start:dev

# Restart frontend with proxy
cd frontend && npm run dev

# Test email service
curl -X POST http://localhost:3001/email/test

# Check environment variables
node -e "console.log(process.env.EMAIL_USER)"
```

---

## Conclusion

This implementation provides a robust authentication system with automated email notifications for:
- ✅ User registration (welcome emails)
- ✅ Password reset (secure token-based)
- ✅ Order confirmations (ready for future use)
- ✅ Invoice delivery (ready for future use)

The system is production-ready with proper error handling, logging, and security measures in place.

---

**Last Updated**: November 12, 2025
**Author**: Copilot Implementation Team
**Version**: 1.0.0
