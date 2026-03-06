#!/usr/bin/env node

import { program } from 'commander';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { scanPaths } from './lib/fileScanner.js';
import { validateFiles } from './lib/exifValidator.js';
import { createS3Client, testBucketAccess, uploadBatch } from './lib/s3Uploader.js';
import {
  displayScanSummary,
  displayValidationSummary,
  displayRejectedFiles,
  displayNonImageFiles,
  displayDryRunReport,
  displayUploadProgress,
  displayUploadReport,
  displayError,
  displaySuccess,
  confirmPrompt
} from './lib/reporter.js';

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (two levels up from scripts/photo-uploader/)
const projectRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(projectRoot, '.env') });

// Exit codes
const EXIT_SUCCESS = 0;
const EXIT_PARTIAL = 1;
const EXIT_NO_VALID = 2;
const EXIT_CONFIG_ERROR = 3;

program
  .name('photo-upload')
  .description('Upload photos with EXIF data validation to S3')
  .version('1.0.0')
  .argument('<paths...>', 'Files or directories to upload')
  .option('-r, --recursive', 'Scan directories recursively', false)
  .option('-n, --dry-run', 'Validate only, do not upload', false)
  .option('-p, --prefix <prefix>', 'S3 key prefix (folder)', 'photos/')
  .option('-b, --bucket <bucket>', 'S3 bucket name (overrides .env)')
  .option('--region <region>', 'AWS region (overrides .env)')
  .option('-v, --verbose', 'Show detailed output', false)
  .option('-q, --quiet', 'Show only errors', false)
  .option('-f, --force', 'Skip confirmation prompt', false)
  .action(async (paths, options) => {
    try {
      await main(paths, options);
    } catch (error) {
      displayError(error.message);
      process.exit(EXIT_CONFIG_ERROR);
    }
  });

program.parse();

async function main(paths, options) {
  const { recursive, dryRun, prefix, verbose, quiet, force } = options;

  // Get bucket and region from options or environment
  const bucket = options.bucket || process.env.VITE_S3_PHOTOS_BUCKET;
  const region = options.region || process.env.VITE_AWS_REGION || 'us-west-1';

  // Validate configuration
  if (!bucket) {
    displayError('S3 bucket not specified. Use --bucket or set VITE_S3_PHOTOS_BUCKET in .env');
    process.exit(EXIT_CONFIG_ERROR);
  }

  // Ensure prefix ends with /
  const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;

  // Step 1: Scan files
  if (!quiet) console.log('Scanning files...');

  const scanResults = await scanPaths(paths, { recursive });

  if (!quiet) {
    displayScanSummary(scanResults);
  }

  if (scanResults.images.length === 0) {
    displayError('No image files found');
    process.exit(EXIT_NO_VALID);
  }

  // Step 2: Validate EXIF data
  if (!quiet) console.log('Validating EXIF data...');

  const validationResults = await validateFiles(scanResults.images);

  // Step 3: Display validation results
  if (!quiet) {
    displayValidationSummary(validationResults);
    displayRejectedFiles(validationResults, verbose);
    displayNonImageFiles(scanResults.nonImages, verbose);
  }

  const validFiles = validationResults.valid;

  if (validFiles.length === 0) {
    displayError('No valid files to upload (all files missing required GPS and/or date/time EXIF data)');
    process.exit(EXIT_NO_VALID);
  }

  // Step 4: Dry run mode - just show what would be uploaded
  if (dryRun) {
    displayDryRunReport(validFiles, bucket, normalizedPrefix);
    displaySuccess('\nDry run complete. No files were uploaded.');
    process.exit(EXIT_SUCCESS);
  }

  // Step 5: Confirm upload
  if (!quiet) {
    console.log();
    console.log(`${validFiles.length} files ready for upload to s3://${bucket}/${normalizedPrefix}`);
  }

  if (!force) {
    const confirmed = await confirmPrompt('\nContinue with upload?');
    if (!confirmed) {
      console.log('Upload cancelled.');
      process.exit(EXIT_SUCCESS);
    }
  }

  // Step 6: Test S3 access
  const s3Client = createS3Client(region);

  if (!quiet) console.log('Testing S3 access...');

  const accessResult = await testBucketAccess(s3Client, bucket);

  if (!accessResult.success) {
    displayError(accessResult.error);
    process.exit(EXIT_CONFIG_ERROR);
  }

  // Step 7: Upload files
  if (!quiet) {
    console.log();
    console.log('Uploading...');
  }

  const uploadResults = await uploadBatch(s3Client, validFiles, bucket, {
    prefix: normalizedPrefix,
    onProgress: quiet ? null : displayUploadProgress
  });

  // Step 8: Display final report
  if (!quiet) {
    displayUploadReport(uploadResults);
  }

  // Exit with appropriate code
  if (uploadResults.failed.length > 0) {
    process.exit(EXIT_PARTIAL);
  }

  process.exit(EXIT_SUCCESS);
}
