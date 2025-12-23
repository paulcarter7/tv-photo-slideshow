import React, { useState, useEffect } from 'react';
import Slideshow from './components/Slideshow';
import Settings from './components/Settings';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { loadConfig, saveConfig } from './services/configService';
import './App.css';

const DEFAULT_CONFIG = {
  s3Bucket: '',
  s3Region: 'us-east-1',
  s3Prefix: '',
  displayDuration: 10,
  transitionEffect: 'fade',
  shuffleMode: false,
  exifDisplay: {
    enabled: true,
    showDateTime: true,
    showLocation: true,
    showCameraInfo: false,
    position: 'bottom-left',
    style: 'style-modern-blur',
    autoHide: false,
    autoHideDelay: 5
  }
};

function App() {
  const [view, setView] = useState('slideshow'); // 'slideshow' or 'settings'
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  // Load configuration on mount
  useEffect(() => {
    const loadConfiguration = async () => {
      try {
        const savedConfig = await loadConfig();
        if (savedConfig) {
          setConfig({ ...DEFAULT_CONFIG, ...savedConfig });
        }
      } catch (error) {
        console.error('Error loading config:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfiguration();
  }, []);

  // Handle settings key press (button to open settings)
  useKeyboardNavigation({
    onMenu: () => {
      setView(view === 'slideshow' ? 'settings' : 'slideshow');
    },
    onBack: () => {
      if (view === 'settings') {
        setView('slideshow');
      }
    }
  });

  const handleSaveConfig = async (newConfig) => {
    try {
      await saveConfig(newConfig);
      setConfig(newConfig);
      setView('slideshow');
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save configuration');
    }
  };

  const handleCancelSettings = () => {
    setView('slideshow');
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {view === 'slideshow' ? (
        <Slideshow config={config} />
      ) : (
        <Settings
          config={config}
          onSave={handleSaveConfig}
          onCancel={handleCancelSettings}
        />
      )}
      <div className="app-hint">
        Press MENU/SETTINGS to configure
      </div>
    </div>
  );
}

export default App;
