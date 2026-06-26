import { Link, useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import './CartPage.css';

function formatKES(amount: number) {
  return `KES ${amount.toLocaleString('en-KE')}`;
}

export function CartPage() {
  const { lines, updateQuantity, removeLine, subtotal } = useCartStore();
  const navigate = useNavigate();

  if (lines.length === 0) {
    return (
      <div className="container cart-empty">
        <h1 className="hero__title" style={{ fontSize: 'clamp(28px, 5vw, 44px)' }}>Your Cart is Empty</h1>
        <p>Nothing in here yet — go find something you'll love.</p>
        <Link to="/" className="btn btn-primary">Start Shopping</Link>
      </div>
    );
  }

  return (
    <div className="container cart-page">
      <h1 className="hero__title" style={{ fontSize: 'clamp(28px, 5vw, 44px)', marginBottom: 28 }}>
        Your Cart
      </h1>

      <div className="cart-page__layout">
        <div className="cart-lines">
          {lines.map((line) => (
            <div className="cart-line" key={`${line.productId}-${line.size}-${line.color}`}>
              <img src={line.image} alt={line.productName} className="cart-line__image" />
              <div className="cart-line__info">
                <span className="cart-line__name">{line.productName}</span>
                <span className="cart-line__variant mono">
                  {line.size} · {line.color}
                </span>
                <span className="cart-line__price mono">{formatKES(line.price)}</span>
              </div>
              <div className="cart-line__qty">
                <button
                  onClick={() => updateQuantity(line.productId, line.size, line.color, line.quantity - 1)}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="mono">{line.quantity}</span>
                <button
                  onClick={() => updateQuantity(line.productId, line.size, line.color, line.quantity + 1)}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <button
                className="cart-line__remove"
                onClick={() => removeLine(line.productId, line.size, line.color)}
                aria-label="Remove item"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="cart-summary">
          <div className="cart-summary__row">
            <span>Subtotal</span>
            <span className="mono">{formatKES(subtotal())}</span>
          </div>
          <div className="cart-summary__row cart-summary__row--muted">
            <span>Delivery fee</span>
            <span className="mono">Calculated at checkout</span>
          </div>
          <div className="cart-summary__divider" />
          <div className="cart-summary__row cart-summary__row--total">
            <span>Total</span>
            <span className="mono">{formatKES(subtotal())}+</span>
          </div>
          <button className="btn btn-primary cart-summary__cta" onClick={() => navigate('/checkout')}>
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
