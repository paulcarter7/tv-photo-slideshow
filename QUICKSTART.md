# Quick Start Guide

Get your TV Photo Slideshow up and running in 10 minutes!

## Prerequisites Check

Before starting, ensure you have:

- [ ] AWS Account ([create one](https://aws.amazon.com))
- [ ] Node.js 18+ installed (`node --version`)
- [ ] AWS CLI installed and configured (`aws --version`)
- [ ] Some photos ready to upload

## 5-Step Setup

### Step 1: Install Dependencies (2 min)

```bash
cd tv-photo-slideshow
npm install
```

### Step 2: Deploy to AWS (5 min)

```bash
./scripts/deploy.sh
```

This will:
- Create AWS infrastructure
- Build the app
- Deploy everything
- Give you a URL

**Save the CloudFront URL** - you'll need it for your TV!

### Step 3: Upload Photos (2 min)

```bash
./scripts/upload-photos.sh /path/to/your/photos
```

Or manually:
```bash
aws s3 sync ~/Pictures s3://YOUR-BUCKET-NAME/
```

### Step 4: Open on Your TV (1 min)

1. Open web browser on your TV
2. Enter the CloudFront URL
3. Bookmark it for easy access

### Step 5: Configure (1 min)

1. Press **MENU** on your TV remote
2. Enter your S3 bucket name (from Step 2 output)
3. Adjust settings:
   - Display duration: 10 seconds
   - Transition: fade
   - EXIF display: enabled
4. Save

**Done!** Your slideshow should start playing.

## Remote Control Cheat Sheet

| Button | Action |
|--------|--------|
| MENU | Open settings |
| Back/Return | Close settings |
| ← → | Previous/Next photo |
| Enter/OK | Pause/Resume |
| Exit | Close app |

## Common Issues

### "No photos found"
- Check S3 bucket name in settings
- Verify photos uploaded: `aws s3 ls s3://YOUR-BUCKET-NAME/`

### "Can't connect to S3"
- Check AWS credentials: `aws sts get-caller-identity`
- Verify region matches in settings

### "EXIF data not showing"
- Enable in settings (MENU → EXIF Display)
- Some photos may not have GPS/date data

## Next Steps

- Add more photos anytime with the upload script
- Customize transitions in settings
- Try shuffle mode
- Adjust EXIF display position

## Need Help?

- See full [README.md](README.md) for detailed docs
- Check [AWS_SETUP.md](docs/AWS_SETUP.md) for AWS help
- Review [troubleshooting section](README.md#troubleshooting)

---

**Enjoy your photos!** 📺✨
