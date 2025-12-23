import React, { useState, useEffect } from 'react';
import './ExifOverlay.css';

function ExifOverlay({ exifData, config }) {
  const [isVisible, setIsVisible] = useState(true);

  // Auto-hide functionality
  useEffect(() => {
    if (!config.autoHide) {
      setIsVisible(true);
      return;
    }

    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, config.autoHideDelay * 1000);

    return () => clearTimeout(timer);
  }, [exifData, config.autoHide, config.autoHideDelay]);

  if (!exifData) return null;

  const formatDateTime = (dateTime) => {
    if (!dateTime) return null;
    try {
      const date = new Date(dateTime);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateTime;
    }
  };

  const formatLocation = (latitude, longitude) => {
    if (!latitude || !longitude) return null;

    const latDirection = latitude >= 0 ? 'N' : 'S';
    const lonDirection = longitude >= 0 ? 'E' : 'W';

    return `${Math.abs(latitude).toFixed(4)}° ${latDirection}, ${Math.abs(longitude).toFixed(4)}° ${lonDirection}`;
  };

  const formatCameraInfo = () => {
    const parts = [];
    if (exifData.make && exifData.model) {
      parts.push(`${exifData.make} ${exifData.model}`);
    } else if (exifData.model) {
      parts.push(exifData.model);
    }

    const settings = [];
    if (exifData.fNumber) settings.push(`f/${exifData.fNumber}`);
    if (exifData.exposureTime) settings.push(`${exifData.exposureTime}s`);
    if (exifData.iso) settings.push(`ISO ${exifData.iso}`);
    if (exifData.focalLength) settings.push(`${exifData.focalLength}mm`);

    if (settings.length > 0) {
      parts.push(settings.join(' • '));
    }

    return parts.length > 0 ? parts : null;
  };

  const dateTime = config.showDateTime && exifData.dateTime
    ? formatDateTime(exifData.dateTime)
    : null;

  const location = config.showLocation && exifData.latitude && exifData.longitude
    ? formatLocation(exifData.latitude, exifData.longitude)
    : null;

  const locationName = config.showLocation && exifData.locationName
    ? exifData.locationName
    : null;

  const cameraInfo = config.showCameraInfo
    ? formatCameraInfo()
    : null;

  // Don't render if no data to show
  if (!dateTime && !location && !locationName && !cameraInfo) {
    return null;
  }

  return (
    <div
      className={`exif-overlay ${config.style || 'style-modern-blur'} ${config.position} ${isVisible ? 'visible' : 'hidden'}`}
    >
      <div className="exif-content">
        {dateTime && (
          <div className="exif-item">
            <span className="exif-icon">📅</span>
            <span className="exif-text">{dateTime}</span>
          </div>
        )}

        {(location || locationName) && (
          <div className="exif-item">
            <span className="exif-icon">📍</span>
            <span className="exif-text">
              {locationName && <div className="location-name">{locationName}</div>}
              {location && <div className="location-coords">{location}</div>}
            </span>
          </div>
        )}

        {cameraInfo && (
          <div className="exif-item camera-info">
            <span className="exif-icon">📷</span>
            <span className="exif-text">
              {cameraInfo.map((info, index) => (
                <div key={index}>{info}</div>
              ))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExifOverlay;
