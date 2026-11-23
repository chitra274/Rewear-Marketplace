import { Link } from 'react-router-dom';
import { Heart, Package } from 'lucide-react';
import { imageFor, money } from '../api';
export default function ListingCard({ listing }) {
  const first = listing.items?.[0];
  return <Link to={`/listing/${listing.id}`} className="listing-card"><div className="listing-image-wrap"><img src={imageFor(first)} alt={first?.title || listing.title} className="listing-image"/><span className="condition-pill">{first?.condition || 'Pre-loved'}</span>{listing.listing_type === 'BUNDLE' && <span className="bundle-pill"><Package size={12}/> Bundle</span>}<button className="heart-button" onClick={e => e.preventDefault()} aria-label="Save item"><Heart size={17}/></button></div><div className="listing-meta"><div><h3>{listing.title}</h3><p>{first?.category} · {first?.size}{listing.listing_type === 'BUNDLE' ? ` · ${listing.items.length} pieces` : ''}</p></div><strong>{money(listing.price_cents)}</strong></div><div className="seller-line">Listed by {listing.seller_name}</div></Link>;
}
