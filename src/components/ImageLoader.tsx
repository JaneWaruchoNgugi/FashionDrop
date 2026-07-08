import { useEffect, useState } from 'react';
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

  useEffect(() => {
    setLoaded(false);
  }, [src]);

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
        onError={() => setLoaded(true)}
      />
    </div>
  );
}
