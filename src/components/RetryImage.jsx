import React, { useState, useEffect, useRef } from 'react';

const getLowResUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('media://remote/')) {
    try {
      const urlObj = new URL(url);
      const remoteUrl = urlObj.searchParams.get('url');
      if (remoteUrl) {
        const lowResRemote = remoteUrl.replace(/=w\d+-h\d+/i, '=w60-h60');
        return `media://remote/?url=${encodeURIComponent(lowResRemote)}`;
      }
    } catch (e) {}
  }
  if (url.includes('googleusercontent.com') || url.includes('ggpht.com') || url.includes('=')) {
    return url.replace(/=w\d+-h\d+/i, '=w60-h60');
  }
  return url;
};

export default function RetryImage({ src, alt, className, fallbackSrc }) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [highResLoaded, setHighResLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 10;
  const timeoutRef = useRef(null);
  const imgRef = useRef(null);

  const lowResSrc = getLowResUrl(currentSrc);
  const isLocal = lowResSrc === currentSrc;

  useEffect(() => {
    setCurrentSrc(src);
    setHighResLoaded(false);
    setRetryCount(0);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, [src]);

  // Check if image has already completed loading (e.g. from browser cache)
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setHighResLoaded(true);
    }
  }, [currentSrc]);

  const handleError = () => {
    if (retryCount < maxRetries) {
      timeoutRef.current = setTimeout(() => {
        setRetryCount(c => c + 1);
        const url = new URL(src, window.location.href);
        url.searchParams.set('retry', Date.now());
        setCurrentSrc(url.toString());
      }, 2000);
    } else if (fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (isLocal) {
    return (
      <img
        src={currentSrc}
        alt={alt}
        className={`${className} object-cover`}
        onError={handleError}
        loading="lazy"
      />
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Low-res placeholder image (loads instantly, blurred) */}
      {lowResSrc && (
        <img
          src={lowResSrc}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            highResLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          style={{ filter: 'blur(8px)', transform: 'scale(1.1)' }}
        />
      )}
      {/* High-res / Best quality image */}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
          highResLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setHighResLoaded(true)}
        onError={handleError}
      />
    </div>
  );
}
