import ora from 'ora';
import chalk from 'chalk';
import Table from 'cli-table3';
import { formatSize } from './fileScanner.js';
import { formatDate, formatGps } from './exifValidator.js';

/**
 * Create a spinner for progress indication
 */
export function createSpinner(text) {
  return ora({
    text,
    spinner: 'dots'
  });
}

/**
 * Display scan results summary
 */
export function displayScanSummary(scanResults) {
  const { images, nonImages, errors } = scanResults;
  const total = images.length + nonImages.length + errors.length;

  console.log();
  console.log(chalk.bold(`Found ${total} files:`));
  console.log(`  ${chalk.green(images.length)} image files`);

  if (nonImages.length > 0) {
    console.log(`  ${chalk.yellow(nonImages.length)} non-image files (skipped)`);
  }

  if (errors.length > 0) {
    console.log(`  ${chalk.red(errors.length)} errors`);
  }

  console.log();
}

/**
 * Display validation summary table
 */
export function displayValidationSummary(validationResults) {
  const { valid, missingGps, missingDateTime, missingBoth, noExif, errors } = validationResults;

  const table = new Table({
    head: [chalk.bold('Status'), chalk.bold('Count')],
    colWidths: [25, 10]
  });

  table.push(
    [chalk.green('Valid'), valid.length],
    [chalk.yellow('Missing GPS'), missingGps.length],
    [chalk.yellow('Missing Date/Time'), missingDateTime.length],
    [chalk.yellow('Missing Both'), missingBoth.length],
    [chalk.red('No EXIF Data'), noExif.length]
  );

  if (errors.length > 0) {
    table.push([chalk.red('Errors'), errors.length]);
  }

  console.log();
  console.log(chalk.bold('Validation Summary:'));
  console.log(table.toString());
}

/**
 * Display rejected files with reasons
 */
export function displayRejectedFiles(validationResults, verbose = false) {
  const { missingGps, missingDateTime, missingBoth, noExif, errors } = validationResults;

  const rejected = [
    ...missingGps.map(f => ({ ...f, reason: 'Missing GPS coordinates' })),
    ...missingDateTime.map(f => ({ ...f, reason: 'Missing date/time' })),
    ...missingBoth.map(f => ({ ...f, reason: 'Missing GPS and date/time' })),
    ...noExif.map(f => ({ ...f, reason: 'No EXIF data' })),
    ...errors.map(f => ({ ...f, reason: f.validation?.errors?.[0] || 'Error' }))
  ];

  if (rejected.length === 0) {
    return;
  }

  console.log();
  console.log(chalk.bold('Rejected files:'));

  // Limit display if not verbose
  const displayFiles = verbose ? rejected : rejected.slice(0, 10);

  for (const file of displayFiles) {
    console.log(`  ${chalk.dim('-')} ${chalk.cyan(file.name)}: ${chalk.yellow(file.reason)}`);

    if (verbose && file.validation) {
      if (file.validation.gps) {
        console.log(`      GPS: ${formatGps(file.validation.gps)}`);
      }
      if (file.validation.dateTime) {
        console.log(`      Date: ${formatDate(file.validation.dateTime)}`);
      }
    }
  }

  if (!verbose && rejected.length > 10) {
    console.log(chalk.dim(`  ... and ${rejected.length - 10} more (use --verbose to see all)`));
  }
}

/**
 * Display non-image files
 */
export function displayNonImageFiles(nonImages, verbose = false) {
  if (nonImages.length === 0) {
    return;
  }

  console.log();
  console.log(chalk.bold('Non-image files (skipped):'));

  const displayFiles = verbose ? nonImages : nonImages.slice(0, 5);

  for (const file of displayFiles) {
    console.log(`  ${chalk.dim('-')} ${chalk.gray(file.name)}`);
  }

  if (!verbose && nonImages.length > 5) {
    console.log(chalk.dim(`  ... and ${nonImages.length - 5} more`));
  }
}

/**
 * Display valid files ready for upload (dry-run mode)
 */
export function displayDryRunReport(validFiles, bucket, prefix) {
  console.log();
  console.log(chalk.bold.green(`${validFiles.length} files would be uploaded to:`));
  console.log(`  ${chalk.cyan(`s3://${bucket}/${prefix}`)}`);
  console.log();

  // Calculate total size
  const totalSize = validFiles.reduce((sum, f) => sum + f.size, 0);
  console.log(`  Total size: ${chalk.bold(formatSize(totalSize))}`);
  console.log();

  // Show sample files
  const sampleFiles = validFiles.slice(0, 5);
  console.log(chalk.dim('Sample files:'));
  for (const file of sampleFiles) {
    console.log(`  ${chalk.dim('-')} ${file.name} (${formatSize(file.size)})`);
  }

  if (validFiles.length > 5) {
    console.log(chalk.dim(`  ... and ${validFiles.length - 5} more`));
  }
}

/**
 * Display upload progress
 */
export function displayUploadProgress(current, total, fileName) {
  const percent = Math.round((current / total) * 100);
  const bar = createProgressBar(percent);
  process.stdout.write(`\r${bar} ${current}/${total} ${chalk.dim(fileName.slice(0, 30))}    `);
}

/**
 * Create a simple progress bar
 */
function createProgressBar(percent, width = 20) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return `[${chalk.green('='.repeat(filled))}${' '.repeat(empty)}] ${percent}%`;
}

/**
 * Display final upload report
 */
export function displayUploadReport(uploadResults) {
  const { succeeded, failed } = uploadResults;

  console.log();
  console.log();
  console.log(chalk.bold.green('Upload Complete!'));

  const totalSize = succeeded.reduce((sum, f) => sum + (f.size || 0), 0);

  console.log(`  ${chalk.green('Succeeded:')} ${succeeded.length}`);

  if (failed.length > 0) {
    console.log(`  ${chalk.red('Failed:')} ${failed.length}`);
  }

  console.log(`  ${chalk.dim('Total size:')} ${formatSize(totalSize)}`);

  // Show failed files
  if (failed.length > 0) {
    console.log();
    console.log(chalk.bold.red('Failed uploads:'));
    for (const file of failed) {
      console.log(`  ${chalk.dim('-')} ${chalk.cyan(file.name)}: ${chalk.red(file.error)}`);
    }
  }
}

/**
 * Display error message
 */
export function displayError(message) {
  console.error(chalk.red(`Error: ${message}`));
}

/**
 * Display warning message
 */
export function displayWarning(message) {
  console.warn(chalk.yellow(`Warning: ${message}`));
}

/**
 * Display success message
 */
export function displaySuccess(message) {
  console.log(chalk.green(message));
}

/**
 * Display info message
 */
export function displayInfo(message) {
  console.log(chalk.cyan(message));
}

/**
 * Ask for confirmation
 */
export async function confirmPrompt(message) {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}
