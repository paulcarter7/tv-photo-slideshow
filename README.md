# TV Photo Slideshow

A beautiful, feature-rich photo slideshow application designed for modern Smart TVs (LG webOS and Samsung Tizen), with EXIF metadata display, multiple transition effects, and AWS cloud integration.

## Features

### 🎨 Core Features
- **Multiple Transition Effects**: Fade, slide, and zoom transitions
- **EXIF Metadata Display**: Automatically shows date/time, GPS location, and camera information
- **TV Remote Control Support**: Full navigation using your TV remote
- **Configurable Settings**: Adjust display duration, transitions, and EXIF display options
- **AWS S3 Integration**: Store and serve photos from Amazon S3
- **Shuffle Mode**: Randomize photo order
- **Responsive Design**: Optimized for 4K TVs and various screen sizes

### 📸 EXIF Data Support
- Date and time photo was taken
- GPS location with reverse geocoding (shows city/country)
- Camera make and model
- Exposure settings (aperture, shutter speed, ISO, focal length)
- Configurable display position and auto-hide

### 🎮 TV Remote Controls
- **Arrow Keys**: Navigate settings
- **Enter/OK**: Pause/resume slideshow
- **Menu**: Open settings
- **Back/Return**: Close settings or go back
- **Play/Pause**: Control slideshow playback

## Architecture

### Frontend
- **React 18** with Vite for fast development
- **exifr** for EXIF data extraction
- **AWS SDK** for S3 integration
- TV-optimized UI with remote control navigation

### AWS Infrastructure
- **S3**: Photo storage with CORS enabled
- **CloudFront**: Fast global content delivery
- **Cognito Identity Pool**: Secure, credential-less S3 access
- **AWS CDK**: Infrastructure as Code

## Prerequisites

- Node.js 18+ and npm
- AWS Account with CLI configured
- AWS CDK CLI (`npm install -g aws-cdk`)
- Modern LG webOS or Samsung Tizen TV (or any TV with a web browser)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd tv-photo-slideshow
npm install
```

### 2. Deploy AWS Infrastructure

```bash
# Make deploy script executable
chmod +x scripts/deploy.sh

# Run deployment
./scripts/deploy.sh
```

This script will:
- Deploy AWS infrastructure (S3, CloudFront, Cognito)
- Build the React application
- Upload to S3
- Create a `.env` file with AWS configuration
- Output the CloudFront URL for your app

### 3. Upload Photos

```bash
# Make upload script executable
chmod +x scripts/upload-photos.sh

# Upload photos
./scripts/upload-photos.sh /path/to/your/photos
```

### 4. Open on Your TV

1. Open the web browser on your TV
2. Navigate to the CloudFront URL provided by the deployment script
3. Bookmark the URL for easy access

### 5. Configure Settings

1. Press the **MENU** button on your TV remote
2. Enter your S3 bucket name (from deployment output)
3. Configure display duration, transitions, and EXIF settings
4. Save and enjoy!

## Manual Deployment

If you prefer manual deployment:

### Deploy Infrastructure

```bash
cd aws-infrastructure
npm install
cdk bootstrap  # Only needed once per AWS account/region
cdk deploy
```

### Build and Deploy App

```bash
# Copy environment variables
cp .env.example .env

# Edit .env with values from CDK output
nano .env

# Build the app
npm run build

# Deploy to S3
aws s3 sync dist/ s3://YOUR-WEBAPP-BUCKET-NAME/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR-DISTRIBUTION-ID --paths "/*"
```

## Configuration

### Application Settings

Configure these in the app's settings UI (accessible via MENU button):

- **S3 Bucket Name**: Your photos bucket name
- **S3 Region**: AWS region (e.g., us-east-1)
- **S3 Prefix**: Optional folder path within bucket
- **Display Duration**: 3-300 seconds per photo
- **Transition Effect**: fade, slide, or zoom
- **Shuffle Mode**: Randomize photo order
- **EXIF Display**:
  - Enable/disable EXIF overlay
  - Show/hide date/time
  - Show/hide location
  - Show/hide camera info
  - Overlay position (bottom-left, top-right, etc.)
  - Auto-hide after delay

### Environment Variables

Create a `.env` file (or copy from `.env.example`):

```env
VITE_AWS_IDENTITY_POOL_ID=us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_AWS_REGION=us-east-1
VITE_S3_PHOTOS_BUCKET=tv-slideshow-photos-xxxxxxxxxxxx
VITE_CLOUDFRONT_DOMAIN=xxxxxxxxxxxxxx.cloudfront.net
```

## Development

### Local Development

```bash
# Start dev server
npm run dev

# Open http://localhost:3000
```

### Build for Production

```bash
npm run build
npm run preview
```

### Deploy Updates

```bash
./scripts/deploy.sh
```

## TV Platform Compatibility

### LG webOS
- webOS 3.0+ supported
- Full remote control integration
- Tested on webOS 4.x, 5.x, 6.x

### Samsung Tizen
- Tizen 4.0+ supported
- Full remote control integration
- Tested on Tizen 5.x, 6.x

### Other Smart TVs
- Any TV with a modern web browser
- Keyboard controls as fallback for remote

## Photo Requirements

### Supported Formats
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)
- HEIC/HEIF (.heic, .heif)

### Recommendations
- Resolution: 1920x1080 or higher for 4K TVs
- File size: Under 10MB per photo for faster loading
- EXIF data: Include GPS coordinates for location display

## Troubleshooting

### Photos Not Loading
1. Check S3 bucket name in settings
2. Verify photos are uploaded to the bucket
3. Ensure AWS credentials are configured
4. Check browser console for errors

### EXIF Data Not Showing
1. Verify photos contain EXIF metadata
2. Enable EXIF display in settings
3. Check that date/time or location options are enabled
4. Some photos may not have GPS data

### Remote Control Not Working
1. Try keyboard shortcuts as fallback
2. Restart the TV browser
3. Check TV platform compatibility

### Slow Loading
1. Enable CloudFront (included in CDK deployment)
2. Optimize photo file sizes
3. Reduce number of photos in S3 prefix
4. Check internet connection speed

## Cost Estimation

### AWS Costs (approximate)
- **S3 Storage**: ~$0.023/GB/month
- **CloudFront**: ~$0.085/GB transfer
- **Cognito**: Free tier (50,000 MAUs)
- **Total**: ~$5-15/month for typical usage (1000 photos, 100GB transfer)

### Cost Optimization
- Use S3 Intelligent-Tiering for photos
- Enable CloudFront caching
- Use smaller image sizes
- Delete unused photos

## Advanced Features

### Custom Transitions

Edit `src/components/Slideshow.css` to add custom transition effects.

### Reverse Geocoding

The app uses OpenStreetMap Nominatim for free reverse geocoding. For production with high volume:

1. Use a paid service (Google Maps, Mapbox, HERE)
2. Update `src/utils/exifUtils.js`
3. Add API key to `.env`

### Multiple Photo Sources

Modify `src/services/photoService.js` to support:
- Multiple S3 buckets
- Different cloud providers
- Local network storage

## Packaging for TV App Stores

### Samsung Tizen

```bash
# Install Tizen Studio
# Package as .wgt file
tizen package -t wgt -s <certificate-profile>

# Submit to Samsung Seller Office
```

### LG webOS

```bash
# Install webOS CLI
npm install -g @webos-tools/cli

# Package as .ipk file
ares-package dist/

# Submit to LG Seller Lounge
```

## Security Considerations

### Production Deployment
1. Enable authentication in Cognito Identity Pool
2. Restrict S3 bucket access with fine-grained IAM policies
3. Use custom domain with HTTPS
4. Enable CloudFront signed URLs for private photos
5. Implement rate limiting

### Privacy
- Photos are stored in your private S3 bucket
- No data is sent to third parties (except reverse geocoding)
- All configuration stored locally on TV

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Open an issue on GitHub
- Check the troubleshooting section
- Review AWS documentation for infrastructure questions

## Acknowledgments

- **exifr** for EXIF parsing
- **AWS CDK** for infrastructure
- OpenStreetMap Nominatim for geocoding
- React and Vite communities

---

**Enjoy your photos on the big screen!** 📺📸
