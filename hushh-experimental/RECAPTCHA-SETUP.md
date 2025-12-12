# Google reCAPTCHA Setup Guide

This guide will help you set up Google reCAPTCHA v2 to protect your forms from bot attacks.

## Step 1: Get reCAPTCHA Keys

1. Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Sign in with your Google account
3. Click "Create" to create a new site
4. Fill in the form:
   - **Label**: iWebTechno Website
   - **reCAPTCHA type**: v2 "I'm not a robot" Checkbox
   - **Domains**: Add your domain (e.g., `iwebtechno.com`, `www.iwebtechno.com`)
   - For development, also add `localhost`
5. Accept the terms and click "Submit"

## Step 2: Choose reCAPTCHA Type

### **Recommended: v2 "I'm not a robot" Checkbox**

For form submissions and user registrations, v2 is ideal because:

- ✅ **User-friendly**: Familiar checkbox interface
- ✅ **Transparent**: Users know bot protection is active
- ✅ **Simple**: Easy implementation and testing
- ✅ **Reliable**: Clear pass/fail verification

### **Alternative: v3 Invisible (Advanced)**

For advanced use cases with risk scoring:

- 🔄 **Invisible**: No user interaction required
- 📊 **Scoring**: Returns 0.0-1.0 human probability score
- ⚙️ **Complex**: Requires threshold configuration
- 🎯 **Advanced**: Better for analytics/tracking

**Recommendation**: Choose **v2 "I'm not a robot" Checkbox** for your forms.

## Step 3: Get Your Keys

After creating the site, you'll see:

- **Site Key** (public key) - used in frontend
- **Secret Key** (private key) - used in backend

## Step 4: Configure Environment Variables

Add these variables to your `.env.local` file:

```bash
# Google reCAPTCHA Configuration
RECAPTCHA_SITE_KEY="your-site-key-here"
RECAPTCHA_SECRET_KEY="your-secret-key-here"
```

## Step 5: Verify Setup

1. Start your development server
2. Navigate to a form with reCAPTCHA (contact form or demo form)
3. You should see the reCAPTCHA widget
4. Test form submission - it should require reCAPTCHA verification

## How reCAPTCHA Works

### Frontend

- Displays the "I'm not a robot" checkbox
- Generates a token when user completes verification
- Sends token to backend with form data

### Backend

- Receives token from frontend
- Sends token to Google for verification
- Only processes form if verification succeeds
- Provides detailed error messages for failed verification

## Security Features

- **Rate Limiting**: Combined with existing rate limiting for additional protection
- **Token Validation**: Server-side verification ensures tokens are legitimate
- **Error Handling**: Clear error messages guide users through verification
- **Logging**: Failed attempts are logged for monitoring

## Testing reCAPTCHA

### Development Testing

- Use `localhost` domain during development
- reCAPTCHA will show a warning in development mode but still work

### Production Testing

- Test with your actual domain
- Verify error handling when reCAPTCHA fails
- Test form submission flow with valid/invalid tokens

## Troubleshooting

### Common Issues

1. **"reCAPTCHA verification failed"**
   - Check that RECAPTCHA_SECRET_KEY is set correctly
   - Verify the site key matches your domain

2. **reCAPTCHA widget not showing**
   - Check RECAPTCHA_SITE_KEY is set
   - Verify the site key is for the correct domain

3. **"Invalid site key" error**
   - Make sure you're using the correct site key for your domain
   - Check that the key is not expired

### Debug Mode

Enable debug logging by checking the server console for reCAPTCHA verification messages:

- ✅ reCAPTCHA verification successful
- 🚨 reCAPTCHA verification failed
- 🚨 reCAPTCHA API request failed

## Production Deployment

1. Update reCAPTCHA admin console with production domains
2. Generate new keys for production if needed
3. Update environment variables in production
4. Test thoroughly before going live

## Content Security Policy (CSP)

If you encounter CSP errors, the middleware has been updated to allow reCAPTCHA scripts:

- **Script Sources**: `https://www.google.com/recaptcha/` and `https://www.gstatic.com/recaptcha/`
- **Connect Sources**: `https://www.google.com/recaptcha/` and `https://www.gstatic.com/recaptcha/`
- **Frame Sources**: `https://www.google.com/recaptcha/` and `https://www.gstatic.com/recaptcha/`

The CSP in `middleware.ts` automatically includes these sources for reCAPTCHA functionality.

## Security Best Practices

- Never expose RECAPTCHA_SECRET_KEY in frontend code
- Use HTTPS in production
- Regularly rotate keys if compromised
- Monitor failed verification attempts
- Combine with other security measures (rate limiting, input validation)
