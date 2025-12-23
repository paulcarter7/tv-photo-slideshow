#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TvSlideshowStack } from '../lib/tv-slideshow-stack';

const app = new cdk.App();

// Get environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Create the main stack
new TvSlideshowStack(app, 'TvSlideshowStack', {
  env,
  description: 'TV Photo Slideshow Application Infrastructure',
  tags: {
    Application: 'TV-Photo-Slideshow',
    Environment: process.env.ENVIRONMENT || 'production',
    ManagedBy: 'CDK',
  },
});

app.synth();
