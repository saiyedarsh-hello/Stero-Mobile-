import React, { useState, useEffect, useRef } from 'react';

export default function RetryImage({ src, alt, className, fallbackSrc }) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 10;
  const timeoutRef = useRef(null);

  useEffect(() => {
    setCurrentSrc(src);
    setRetryCount(0);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, [src]);

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

  return (
    <img 
      src={currentSrc} 
      alt={alt} 
      className={className} 
      onError={handleError}
      loading="lazy"
    />
  );
}
