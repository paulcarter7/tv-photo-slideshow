# TV Photo Slideshow — Claude Instructions

## What This Project Is

A Vite + React SPA that runs in a smart TV browser and displays photos as a fullscreen slideshow. Photos are stored in AWS S3 and served via CloudFront. EXIF metadata (date, location via reverse geocoding, camera info) is displayed as an overlay.

## Project Structure

```
src/
  App.jsx                    # Root component — manages config and view state
  components/
    Slideshow.jsx / .css     # Main slideshow display and transitions
    ExifOverlay.jsx / .css   # EXIF metadata overlay
    Settings.jsx / .css      # Settings UI (opened via MENU key on TV remote)
  services/
    photoService.js          # Lists photos from S3 via Cognito credentials
    photoService.mock.js     # Mock for local development without AWS
    configService.js         # Reads/writes config to localStorage
  utils/
    exifUtils.js             # EXIF extraction (via exifr) + geocoding (Nominatim/Overpass)
  hooks/
    useKeyboardNavigation.js # TV remote key mapping

scripts/
  deploy.sh                  # Full deploy: CDK + build + S3 sync + CloudFront invalidation
  upload-photos.sh           # Sync local photos to S3; auto-converts HEIC→JPEG via sips
  photo-uploader/            # Node.js CLI for photo validation and upload

aws-infrastructure/          # AWS CDK stack (TypeScript)
  lib/tv-slideshow-stack.ts  # S3 buckets, CloudFront, Cognito Identity Pool

docs/
  AWS_SETUP.md               # AWS account/credential setup walkthrough
```

## Development

```bash
npm install
npm run dev        # Dev server at http://localhost:5173
npm run build      # Production build to dist/
npm run lint       # ESLint
```

The dev server runs against mock data by default (see `photoService.mock.js`). To test against real AWS, set up a `.env` file (see `.env.example`).

## Environment Variables

All are prefixed `VITE_` so Vite bakes them into the build at compile time:

```
VITE_AWS_IDENTITY_POOL_ID   # Cognito Identity Pool (unauthenticated access to S3)
VITE_AWS_REGION             # e.g. us-east-1
VITE_S3_PHOTOS_BUCKET       # Photos bucket name
VITE_CLOUDFRONT_DOMAIN      # CloudFront domain (used in EXIF overlay link)
```

These become the default config values in `App.jsx`. Users can override them via the Settings UI, which persists to `localStorage`.

## Deploy

```bash
./scripts/deploy.sh   # Requires: AWS CLI + CDK CLI configured
```

Manual steps:
```bash
npm run build
aws s3 sync ./dist s3://tv-slideshow-app-<account-id>/
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```

## Upload Photos

```bash
./scripts/upload-photos.sh /path/to/photos   # Converts HEIC→JPEG, syncs to S3
```

HEIC conversion uses macOS `sips`. On Linux, use `ImageMagick` or pre-convert.

## Architecture Notes

- **S3 access**: Uses Cognito Identity Pool (unauthenticated role) via `@aws-sdk/credential-providers`. The role has read-only access to the photos bucket.
- **Photo listing**: `ListObjectsV2` with a prefix (`photos/`). Falls back to `photos.json` or `photos.txt` if listing fails.
- **Geocoding**: Nominatim (OpenStreetMap) for reverse geocoding, Overpass API for venue names. Results cached in `localStorage` to avoid repeat calls.
- **Config**: Stored in `localStorage` under key `tv-slideshow-config`. Env vars set the compile-time defaults; Settings UI overrides persist per TV.
- **Transitions**: CSS-based (fade, slide, zoom) in `Slideshow.css`.

## Known Issues / Things To Be Aware Of

- No test framework is set up — tests should be added before shipping new features.
- `photoService.js` has a hardcoded fallback photo list at the bottom (personal filenames) — this is a last-resort fallback but should be cleaned up.
- HEIC is not natively supported in TV browsers — the upload script converts to JPEG. Don't advertise HEIC as a browser-supported format.
- The Settings UI allows users to change the S3 bucket and region, but the Cognito Identity Pool ID is baked into the build and cannot be changed at runtime.
- `AWSCLIV2.pkg` in the repo root is an installer binary that should not be committed.
