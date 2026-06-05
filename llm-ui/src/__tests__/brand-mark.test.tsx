import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { BrandMark } from '@/components/brand/brand-mark';

describe('BrandMark', () => {
  it('renders an img with the brand-mark source at the requested size', () => {
    const { container } = render(<BrandMark size={40} />);
    const img = container.querySelector('img[data-slot="brand-mark"]');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/brand/brand-mark.svg');
    expect(img?.getAttribute('width')).toBe('40');
    expect(img?.getAttribute('height')).toBe('40');
  });

  it('is decorative by default (aria-hidden + empty alt)', () => {
    const { container } = render(<BrandMark />);
    const img = container.querySelector('img[data-slot="brand-mark"]')!;
    expect(img.getAttribute('aria-hidden')).toBe('true');
    expect(img.getAttribute('alt')).toBe('');
  });

  it('exposes an accessible name when ariaLabel is provided', () => {
    render(<BrandMark ariaLabel="GoClaw" />);
    expect(screen.getByAltText('GoClaw')).toBeInTheDocument();
  });
});
