# iWebTechno SEO Verification Tools

This document explains how to verify and audit the SEO implementation for the iWebTechno university management system.

## 🚀 Quick Start

### Run Complete SEO Audit

```bash
npm run seo:verify
```

### Run Individual Checks

```bash
# Build verification
npm run build

# Lighthouse audit (saves to seo-audit.html)
npm run seo:audit

# Accessibility audit
npm run seo:accessibility

# HTML validation
npm run seo:validate-html

# Link checking
npm run seo:check-links

# Full audit (all checks)
npm run seo:full-audit
```

## 📊 Available Tools

### 1. Lighthouse CLI

- **Purpose**: Comprehensive performance and SEO audit
- **Command**: `lighthouse http://localhost:3000`
- **Output**: HTML report in `lighthouse-report.html`
- **Categories**: Performance, Accessibility, Best Practices, SEO

### 2. Axe-Core CLI

- **Purpose**: Accessibility testing
- **Command**: `axe http://localhost:3000`
- **Output**: Accessibility violations report

### 3. HTML-Validate

- **Purpose**: HTML markup validation
- **Command**: `html-validate http://localhost:3000`
- **Output**: HTML validation errors

### 4. Broken Link Checker

- **Purpose**: Check for broken internal/external links
- **Command**: `blc http://localhost:3000 -r`
- **Output**: List of broken links

### 5. Custom SEO Verification Script

- **Purpose**: Automated SEO checklist verification
- **Command**: `npm run seo:verify`
- **Output**: Console report with pass/fail status

## 🎯 What Gets Verified

### ✅ Build & Technical

- Next.js build success
- Static page generation
- Bundle size optimization

### ✅ SEO Fundamentals

- Sitemap generation (`app/sitemap.ts`)
- Robots.txt configuration (`app/robots.ts`)
- Meta tags and descriptions
- Open Graph and Twitter Cards

### ✅ Structured Data

- Organization schema
- Website schema
- Product schemas for all 7 products
- Software application schema

### ✅ Performance

- Image optimization (WebP/AVIF)
- Performance headers
- Core Web Vitals optimization
- Static generation

### ✅ Navigation & UX

- Breadcrumb navigation
- Search functionality
- Internal linking
- Canonical URLs

### ✅ Content Quality

- Proper heading hierarchy
- Alt text for images
- Meta descriptions
- Keyword optimization

## 📋 SEO Checklist

### Meta Tags & Descriptions

- [ ] Title tags are unique and descriptive
- [ ] Meta descriptions are 150-160 characters
- [ ] Keywords are relevant and not stuffed
- [ ] Open Graph images are properly sized

### Technical SEO

- [ ] Sitemap is generated and accessible
- [ ] Robots.txt properly configured
- [ ] Canonical URLs implemented
- [ ] No duplicate content issues

### Performance

- [ ] Images are optimized (WebP/AVIF)
- [ ] Core Web Vitals scores are good
- [ ] Static pages are pre-rendered
- [ ] Bundle sizes are reasonable

### Structured Data

- [ ] Organization schema implemented
- [ ] Product schemas for all products
- [ ] Website schema with search functionality
- [ ] Proper JSON-LD formatting

### Navigation

- [ ] Breadcrumb navigation works
- [ ] Search functionality is implemented
- [ ] Internal linking is strategic
- [ ] User-friendly URLs

## 🔧 Troubleshooting

### Build Errors

```bash
# Check for TypeScript errors
npm run lint

# Check build output
npm run build
```

### SEO Issues

```bash
# Verify sitemap generation
curl http://localhost:3000/sitemap.xml

# Check robots.txt
curl http://localhost:3000/robots.txt

# Test structured data
curl -H "Accept: application/ld+json" http://localhost:3000
```

### Performance Issues

```bash
# Run Lighthouse manually
lighthouse http://localhost:3000 --output html

# Check bundle analysis
npm run build -- --analyze
```

## 📈 Expected Scores

### Lighthouse Targets

- **Performance**: 90+
- **Accessibility**: 95+
- **Best Practices**: 90+
- **SEO**: 95+

### Core Web Vitals

- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1

## 🚀 Deployment Checklist

Before deploying to production:

1. ✅ Run `npm run seo:full-audit`
2. ✅ Verify all Lighthouse scores are 90+
3. ✅ Check sitemap.xml is accessible
4. ✅ Confirm robots.txt is working
5. ✅ Test search functionality
6. ✅ Validate all structured data
7. ✅ Check canonical URLs
8. ✅ Verify meta tags in source

## 📞 Support

For SEO-related issues or questions:

- Check the [SEO Verification Script](./scripts/verify-seo.js)
- Review Lighthouse reports
- Consult the [iWebRules documentation](./iwebrules.md)

## 🔄 Regular Maintenance

### Weekly

- Run `npm run seo:full-audit`
- Check for new broken links
- Verify sitemap accuracy

### Monthly

- Update meta descriptions if needed
- Review search analytics
- Check for new SEO opportunities

### Quarterly

- Comprehensive SEO audit
- Update keyword strategy
- Review technical SEO changes
