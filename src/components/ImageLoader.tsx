import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import './ImageLoader.css';

type ImageLoaderProps = {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  wrapperClassName?: string;
  loading?: 'eager' | 'lazy';
  objectFit?: 'cover' | 'contain';
};

export function ImageLoader({
  src,
  alt,
  className,
  imgClassName,
  wrapperClassName,
  loading = 'lazy',
  objectFit = 'cover',
}: ImageLoaderProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setErrored(false);
  }, [src]);

  const hasSrc = Boolean(src);

  if (!hasSrc || errored) {
    return (
      <div
        className={['image-loader', 'image-loader--fallback', wrapperClassName].filter(Boolean).join(' ')}
        data-fit={objectFit}
        role="img"
        aria-label={alt}
      >
        <span className="image-loader__fallback-icon" aria-hidden="true">
          <ImageOff size={28} strokeWidth={1.6} />
        </span>
        <span className="image-loader__fallback-text">Image unavailable</span>
      </div>
    );
  }

  return (
    <div
      className={['image-loader', loaded ? 'is-loaded' : '', wrapperClassName].filter(Boolean).join(' ')}
      data-fit={objectFit}
    >
      {!loaded && <span className="image-loader__spinner" aria-hidden="true" />}
      <img
        src={src}
        alt={alt}
        className={[className, imgClassName].filter(Boolean).join(' ')}
        loading={loading}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
      />
    </div>
  );
}
