import React, { useState, useEffect, useRef } from 'react';
import './Settings.css';

function Settings({ config, onSave, onCancel }) {
  const [formData, setFormData] = useState(config);
  const [focusedElement, setFocusedElement] = useState(0);
  const formRef = useRef(null);

  const fields = [
    { name: 's3Bucket', label: 'S3 Bucket Name', type: 'text', required: true },
    { name: 's3Region', label: 'S3 Region', type: 'text', required: true },
    { name: 's3Prefix', label: 'S3 Folder Prefix (optional)', type: 'text' },
    { name: 'displayDuration', label: 'Display Duration (seconds)', type: 'number', min: 3, max: 300 },
    { name: 'transitionEffect', label: 'Transition Effect', type: 'select', options: ['fade', 'slide-transition', 'zoom'] },
    { name: 'shuffleMode', label: 'Shuffle Photos', type: 'checkbox' },
    { name: 'exifDisplay.enabled', label: 'Show EXIF Data', type: 'checkbox' },
    { name: 'exifDisplay.showDateTime', label: 'Show Date/Time', type: 'checkbox' },
    { name: 'exifDisplay.showLocation', label: 'Show Location', type: 'checkbox' },
    { name: 'exifDisplay.showCameraInfo', label: 'Show Camera Info', type: 'checkbox' },
    { name: 'exifDisplay.position', label: 'EXIF Position', type: 'select', options: ['bottom-left', 'bottom-right', 'top-left', 'top-right', 'bottom-center'] },
    { name: 'exifDisplay.style', label: 'EXIF Style', type: 'select', options: ['style-modern-blur', 'style-minimal', 'style-rounded-box', 'style-film-strip', 'style-corner-tag'] },
    { name: 'exifDisplay.autoHide', label: 'Auto-hide EXIF', type: 'checkbox' },
    { name: 'exifDisplay.autoHideDelay', label: 'Auto-hide Delay (seconds)', type: 'number', min: 1, max: 60 }
  ];

  useEffect(() => {
    // Focus first element on mount
    if (formRef.current) {
      const firstFocusable = formRef.current.querySelector('.focusable');
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }
  }, []);

  const handleInputChange = (name, value) => {
    setFormData(prev => {
      const newData = { ...prev };
      const keys = name.split('.');
      if (keys.length === 1) {
        newData[name] = value;
      } else {
        // Handle nested properties (e.g., exifDisplay.enabled)
        let current = newData;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) {
            current[keys[i]] = {};
          }
          current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
      }
      return newData;
    });
  };

  const getValue = (name) => {
    const keys = name.split('.');
    let value = formData;
    for (const key of keys) {
      value = value?.[key];
    }
    return value;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.s3Bucket || !formData.s3Region) {
      alert('S3 Bucket Name and Region are required');
      return;
    }

    onSave(formData);
  };

  const handleKeyDown = (e) => {
    const focusableElements = formRef.current.querySelectorAll('.focusable');
    const currentIndex = Array.from(focusableElements).indexOf(document.activeElement);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (currentIndex < focusableElements.length - 1) {
          focusableElements[currentIndex + 1].focus();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (currentIndex > 0) {
          focusableElements[currentIndex - 1].focus();
        }
        break;
      case 'Escape':
      case 'Backspace':
        if (e.target.tagName !== 'INPUT' || e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
        break;
      default:
        break;
    }
  };

  const formatOptionLabel = (option, fieldName) => {
    // Special formatting for EXIF style options
    if (fieldName === 'exifDisplay.style') {
      const styleNames = {
        'style-modern-blur': 'Modern Blur',
        'style-minimal': 'Clean Minimal',
        'style-rounded-box': 'Rounded Box',
        'style-film-strip': 'Film Strip Bar',
        'style-corner-tag': 'Corner Tag'
      };
      return styleNames[option] || option;
    }
    // Default formatting
    return option.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const renderField = (field) => {
    const value = getValue(field.name);

    switch (field.type) {
      case 'text':
      case 'number':
        return (
          <input
            type={field.type}
            className="focusable"
            value={value || ''}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            required={field.required}
            min={field.min}
            max={field.max}
            placeholder={field.label}
          />
        );

      case 'checkbox':
        return (
          <label className="checkbox-label focusable" tabIndex={0}>
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleInputChange(field.name, e.target.checked)}
              tabIndex={-1}
            />
            <span className="checkbox-custom"></span>
          </label>
        );

      case 'select':
        return (
          <select
            className="focusable"
            value={value || field.options[0]}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
          >
            {field.options.map(option => (
              <option key={option} value={option}>
                {formatOptionLabel(option, field.name)}
              </option>
            ))}
          </select>
        );

      default:
        return null;
    }
  };

  return (
    <div className="settings" onKeyDown={handleKeyDown}>
      <div className="settings-container">
        <h1 className="settings-title">Settings</h1>

        <form ref={formRef} onSubmit={handleSubmit} className="settings-form">
          <div className="settings-sections">
            <section className="settings-section">
              <h2>Photo Source</h2>
              {fields.slice(0, 3).map(field => (
                <div key={field.name} className="form-group">
                  <label>{field.label}</label>
                  {renderField(field)}
                </div>
              ))}
            </section>

            <section className="settings-section">
              <h2>Slideshow</h2>
              {fields.slice(3, 6).map(field => (
                <div key={field.name} className="form-group">
                  <label>{field.label}</label>
                  {renderField(field)}
                </div>
              ))}
            </section>

            <section className="settings-section">
              <h2>EXIF Display</h2>
              {fields.slice(6).map(field => (
                <div key={field.name} className="form-group">
                  <label>{field.label}</label>
                  {renderField(field)}
                </div>
              ))}
            </section>
          </div>

          <div className="settings-actions">
            <button type="submit" className="btn btn-primary focusable">
              Save
            </button>
            <button type="button" className="btn btn-secondary focusable" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>

        <div className="settings-hint">
          Use Arrow Keys to navigate • Enter to select • ESC to cancel
        </div>
      </div>
    </div>
  );
}

export default Settings;
