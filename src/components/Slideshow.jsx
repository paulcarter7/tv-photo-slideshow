import React, { useState, useEffect, useCallback } from 'react';
import ExifOverlay from './ExifOverlay';
import { fetchPhotos } from '../services/photoService';
import { fetchPhotos as fetchMockPhotos } from '../services/photoService.mock';
import { extractExifData } from '../utils/exifUtils';
import './Slideshow.css';

function Slideshow({ config, onOpenSettings }) {
  const [photos, setPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [exifData, setExifData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [preloadedImages, setPreloadedImages] = useState({});

  // Fetch photos from S3 or use mock photos for testing
  useEffect(() => {
    const loadPhotos = async () => {
      try {
        setIsLoading(true);
        setError(null);

        let photoList;

        // Use mock photos if no S3 bucket configured (for local testing)
        if (!config.s3Bucket) {
          console.log('No S3 bucket configured, using mock photos for testing...');
          photoList = await fetchMockPhotos();
        } else {
          photoList = await fetchPhotos(
            config.s3Bucket,
            config.s3Region,
            config.s3Prefix
          );
        }

        if (photoList.length === 0) {
          setError('No photos found. Press MENU to configure S3 or add mock photos.');
          setIsLoading(false);
          return;
        }

        // Shuffle if configured
        const finalPhotoList = config.shuffleMode
          ? shuffleArray([...photoList])
          : photoList;

        setPhotos(finalPhotoList);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading photos:', err);
        setError(`Error loading photos: ${err.message}`);
        setIsLoading(false);
      }
    };

    loadPhotos();
  }, [config.s3Bucket, config.s3Region, config.s3Prefix, config.shuffleMode]);

  // Preload current and next image
  useEffect(() => {
    if (photos.length === 0) return;

    const preloadImage = (url, index) => {
      if (preloadedImages[index]) return Promise.resolve();

      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          setPreloadedImages(prev => ({ ...prev, [index]: url }));
          resolve();
        };
        img.onerror = reject;
        img.src = url;
      });
    };

    // Preload current and next images
    preloadImage(photos[currentIndex], currentIndex);
    if (photos[nextIndex]) {
      preloadImage(photos[nextIndex], nextIndex);
    }
  }, [photos, currentIndex, nextIndex, preloadedImages]);

  // Extract EXIF data for current photo
  useEffect(() => {
    if (photos.length === 0 || !config.exifDisplay.enabled) return;

    const loadExifData = async () => {
      try {
        const data = await extractExifData(photos[currentIndex]);
        setExifData(data);
      } catch (err) {
        console.error('Error extracting EXIF data:', err);
        setExifData(null);
      }
    };

    loadExifData();
  }, [photos, currentIndex, config.exifDisplay.enabled]);

  // Auto-advance slideshow
  useEffect(() => {
    if (photos.length === 0 || isPaused || isTransitioning) return;

    const interval = setInterval(() => {
      goToNextPhoto();
    }, config.displayDuration * 1000);

    return () => clearInterval(interval);
  }, [photos.length, currentIndex, config.displayDuration, isPaused, isTransitioning]);

  const goToNextPhoto = useCallback(() => {
    if (photos.length === 0) return;

    setIsTransitioning(true);
    const next = (currentIndex + 1) % photos.length;
    setNextIndex(next);

    // Wait for transition to complete
    setTimeout(() => {
      setCurrentIndex(next);
      setNextIndex((next + 1) % photos.length);
      setIsTransitioning(false);
    }, 1000); // Match transition duration in CSS
  }, [photos.length, currentIndex]);

  const goToPreviousPhoto = useCallback(() => {
    if (photos.length === 0 || isTransitioning) return;

    setIsTransitioning(true);
    const prev = currentIndex === 0 ? photos.length - 1 : currentIndex - 1;
    setNextIndex(prev);

    setTimeout(() => {
      setCurrentIndex(prev);
      setNextIndex((prev + 1) % photos.length);
      setIsTransitioning(false);
    }, 1000);
  }, [photos.length, currentIndex, isTransitioning]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'MediaTrackNext':
          goToNextPhoto();
          break;
        case 'ArrowLeft':
        case 'MediaTrackPrevious':
          goToPreviousPhoto();
          break;
        case ' ':
        case 'Enter':
        case 'MediaPlayPause':
          togglePause();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [goToNextPhoto, goToPreviousPhoto, togglePause]);

  if (isLoading) {
    return (
      <div className="slideshow-loading">
        <div className="spinner"></div>
        <p>Loading photos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="slideshow-error">
        <div className="error-icon">⚠</div>
        <p>{error}</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="slideshow-error">
        <p>No photos available</p>
      </div>
    );
  }

  return (
    <div className="slideshow">
      <div className={`slideshow-container ${config.transitionEffect}`}>
        <div
          className={`slide current ${isTransitioning ? 'transitioning-out' : ''}`}
          style={{ backgroundImage: `url(${photos[currentIndex]})` }}
        />
        {isTransitioning && (
          <div
            className="slide next transitioning-in"
            style={{ backgroundImage: `url(${photos[nextIndex]})` }}
          />
        )}
      </div>

      {config.exifDisplay.enabled && exifData && (
        <ExifOverlay
          exifData={exifData}
          config={config.exifDisplay}
        />
      )}

      {isPaused && (
        <div className="pause-indicator">
          <div className="pause-icon">⏸</div>
          <p>Paused</p>
        </div>
      )}

      <div className="slideshow-controls">
        <div className="control-hint">← Previous</div>
        <div className="control-hint">Space/Enter to Pause</div>
        <div className="control-hint">Next →</div>
      </div>

      <div className="slideshow-counter">
        {currentIndex + 1} / {photos.length}
      </div>

      {onOpenSettings && (
        <button className="settings-button" onClick={onOpenSettings} aria-label="Open Settings">
          <span className="settings-icon">⚙️</span>
        </button>
      )}
    </div>
  );
}

// Utility function to shuffle array
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default Slideshow;
