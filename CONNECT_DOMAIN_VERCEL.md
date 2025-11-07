# 🌐 Connect Your Namecheap Domain to Vercel

This guide will help you connect your Namecheap domain to your Vercel deployment.

## Step 1: Get Your Vercel Domain

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Click on your **StrangersConnect** project
3. Go to **Settings** → **Domains**
4. You'll see your current Vercel domain (e.g., `strangers-connect.vercel.app`)
5. Copy this domain - you'll need it for DNS configuration

## Step 2: Add Domain in Vercel

1. In Vercel **Settings** → **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `yourdomain.com` or `www.yourdomain.com`)
4. Vercel will show you DNS records to add

## Step 3: Configure DNS in Namecheap

### Option A: Using A Records (Recommended for Root Domain)

1. Log in to **Namecheap**
2. Go to **Domain List** → Click **Manage** on your domain
3. Go to **Advanced DNS** tab
4. Add these records:

**For Root Domain (yourdomain.com):**
```
Type: A Record
Host: @
Value: 76.76.21.21
TTL: Automatic (or 30 min)
```

**For WWW (www.yourdomain.com):**
```
Type: CNAME Record
Host: www
Value: cname.vercel-dns.com
TTL: Automatic (or 30 min)
```

### Option B: Using CNAME (Recommended for Subdomain)

**For Subdomain (app.yourdomain.com):**
```
Type: CNAME Record
Host: app (or whatever subdomain you want)
Value: cname.vercel-dns.com
TTL: Automatic (or 30 min)
```

## Step 4: Vercel DNS Records

Vercel will show you the exact records needed. Common ones:

- **A Record**: `76.76.21.21` (for root domain)
- **CNAME**: `cname.vercel-dns.com` (for www or subdomain)

## Step 5: Wait for DNS Propagation

- DNS changes can take **5 minutes to 48 hours** to propagate
- Usually takes **15-30 minutes**
- Check status in Vercel dashboard (will show "Valid Configuration" when ready)

## Step 6: SSL Certificate (Automatic)

- Vercel automatically provides **free SSL certificates**
- Your site will be available at `https://yourdomain.com`
- SSL is set up automatically once DNS is configured

## Step 7: Update Environment Variables (If Needed)

If your backend URL needs to change:
1. Go to Vercel **Settings** → **Environment Variables**
2. Update `NEXT_PUBLIC_SOCKET_URL` if needed
3. Redeploy if necessary

## Troubleshooting

### DNS Not Working?
- Wait 30-60 minutes for propagation
- Check DNS propagation: https://www.whatsmydns.net
- Verify records in Namecheap match Vercel's requirements

### SSL Not Working?
- Wait for DNS to fully propagate
- Vercel SSL is automatic (can take a few minutes after DNS)

### Still Having Issues?
- Check Vercel dashboard for specific error messages
- Verify DNS records are correct in Namecheap
- Make sure domain is added in Vercel first

## Quick Checklist

- [ ] Domain added in Vercel dashboard
- [ ] DNS records added in Namecheap
- [ ] Waited 15-30 minutes for propagation
- [ ] Checked Vercel dashboard shows "Valid Configuration"
- [ ] Tested domain in browser

## Example Configuration

**Domain:** `strangersconnect.com`

**Namecheap DNS Records:**
```
A Record:
@ → 76.76.21.21

CNAME Record:
www → cname.vercel-dns.com
```

**Vercel Settings:**
- Domain: `strangersconnect.com`
- Domain: `www.strangersconnect.com`

That's it! Your domain will be connected and SSL will be automatic. 🎉

