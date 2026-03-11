# TV Photo Slideshow

A fullscreen photo slideshow app designed for smart TV browsers (LG webOS, Samsung Tizen, or any TV with a modern browser). Photos are stored in AWS S3 and served via CloudFront. EXIF metadata — date, GPS location with reverse geocoding, camera info — is displayed as an overlay.

## Features

- **Multiple transitions**: Fade, slide, and zoom
- **EXIF overlay**: Date/time, location (city/venue via reverse geocoding), camera info
- **TV remote navigation**: Arrow keys, Enter/OK, Menu, Back
- **Shuffle mode**
- **Settings UI**: Accessible via the MENU key on your remote, persisted per device
- **AWS S3 + CloudFront**: Photos served globally with low latency

## Requirements

- Node.js 18+
- AWS account with CLI configured (`aws configure`)
- AWS CDK CLI (`npm install -g aws-cdk`)
- A TV with a web browser (or any modern browser)

## Quick Start

### 1. Clone and install

```bash
git clone <repository-url>
cd tv-photo-slideshow
npm install
```

### 2. Deploy AWS infrastructure

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

This creates S3 buckets, a CloudFront distribution, and a Cognito Identity Pool. It then builds the app and uploads it. At the end it prints a CloudFront URL — that's your app URL.

### 3. Upload photos

```bash
chmod +x scripts/upload-photos.sh
./scripts/upload-photos.sh /path/to/your/photos
```

This syncs photos to S3. On macOS, HEIC files are automatically converted to JPEG before upload.

### 4. Open on your TV

1. Open the web browser on your TV
2. Navigate to the CloudFront URL from step 2
3. Bookmark it for easy access

The slideshow starts automatically. No configuration needed — the S3 bucket is pre-configured from the deploy step.

## Manual Deployment

If you'd rather not use the deploy script:

```bash
# Deploy infrastructure
cd aws-infrastructure
npm install
cdk bootstrap   # One-time per AWS account/region
cdk deploy

# Build app with outputs from CDK
cp .env.example .env
# Fill in .env with values from CDK output
npm run build

# Upload to S3
aws s3 sync dist/ s3://YOUR-WEBAPP-BUCKET/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR-DISTRIBUTION-ID --paths "/*"
```

## Environment Variables

Create a `.env` file (or let `deploy.sh` create it automatically):

```env
VITE_AWS_IDENTITY_POOL_ID=us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_AWS_REGION=us-east-1
VITE_S3_PHOTOS_BUCKET=tv-slideshow-photos-xxxxxxxxxxxx
VITE_CLOUDFRONT_DOMAIN=xxxxxxxxxxxxxx.cloudfront.net
```

These are baked into the build at compile time and set the default config. Users can override S3 bucket and region via the Settings UI on their device; overrides are stored in `localStorage`.

## AWS Infrastructure

Deployed via AWS CDK (`aws-infrastructure/`):

- **S3 (photos bucket)**: Stores your photos. Private, accessed via Cognito credentials.
- **S3 (app bucket)**: Hosts the React app.
- **CloudFront**: CDN in front of both buckets.
- **Cognito Identity Pool**: Issues temporary read-only credentials to the browser so it can call `ListObjectsV2` on the photos bucket. No login required.

## Settings

Press **MENU** on your TV remote to open settings. Available options:

| Setting | Description |
|---------|-------------|
| S3 Bucket / Region / Prefix | Override the compiled-in defaults |
| Display Duration | Seconds per photo (3–300) |
| Transition Effect | Fade, slide, or zoom |
| Shuffle Mode | Randomize photo order |
| EXIF Display | Enable/disable and configure the metadata overlay |

Settings are saved to `localStorage` on the device.

## Remote Control

| Key | Action |
|-----|--------|
| MENU | Open/close settings |
| Back / Return | Close settings |
| Left / Right arrow | Previous / next photo |
| Enter / OK | Pause / resume |

## Photo Requirements

- Supported formats: JPEG, PNG, WebP
- HEIC files are converted to JPEG by the upload script (macOS only via `sips`)
- Recommended resolution: 1920x1080 or higher
- Keep files under 10 MB for faster loading
- Include GPS EXIF data if you want location display

## Development

```bash
npm run dev      # Dev server at http://localhost:5173
npm run build    # Production build
npm run preview  # Preview production build locally
npm run lint     # ESLint
```

The `photoService.mock.js` file provides a mock photo source for local development without needing AWS.

## Project Structure

```
src/
  App.jsx                  # Root component, config management
  components/              # Slideshow, ExifOverlay, Settings
  services/
    photoService.js        # S3 photo listing via Cognito
    configService.js       # localStorage config persistence
  utils/
    exifUtils.js           # EXIF extraction + reverse geocoding
  hooks/
    useKeyboardNavigation.js  # TV remote key mapping

scripts/
  deploy.sh                # Full deploy (CDK + build + S3 + CloudFront)
  upload-photos.sh         # Photo sync with HEIC conversion
  photo-uploader/          # Node.js CLI for photo validation and upload

aws-infrastructure/        # AWS CDK stack (TypeScript)
docs/
  AWS_SETUP.md             # Detailed AWS setup guide
```

## Troubleshooting

**No photos show up**
- Check that photos are in the bucket: `aws s3 ls s3://YOUR-BUCKET/photos/`
- Verify the S3 bucket name in Settings matches the actual bucket
- Open the browser console for error details

**EXIF data not showing**
- Enable EXIF display in Settings (MENU → EXIF Display)
- Not all photos have GPS or date data embedded

**Remote not working**
- Try keyboard: arrow keys, Enter, Escape
- Restart the TV browser

**Slow loading**
- CloudFront caching is enabled by default after the first request
- Reduce photo file sizes (aim for < 5 MB)
- Use the `photos/` prefix to limit the listing scope

## AWS Cost Estimate

| Resource | Cost |
|----------|------|
| S3 storage | ~$0.023/GB/month |
| CloudFront transfer | ~$0.085/GB |
| Cognito | Free (up to 50,000 MAUs) |

Typical usage (a few hundred photos, personal use): under $1/month.

## Security Notes

- The Cognito Identity Pool is configured for unauthenticated (public) access — anyone with the URL can list and view your photos.
- To restrict access, add an authentication provider to the Cognito Identity Pool and configure the identity pool to require authenticated users. See `docs/AWS_SETUP.md`.
- Photos are not publicly accessible directly from S3; they require the Cognito-issued credentials.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new behavior
4. Open a pull request

## License

MIT — see LICENSE for details.
