import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS, type OrderStatus } from '../types';
import './OrderStatusTracker.css';

export function OrderStatusTracker({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') {
    return (
      <div className="status-tracker status-tracker--cancelled">
        <div className="stamp stamp--cancelled">
          <span>CANCELLED</span>
        </div>
      </div>
    );
  }

  const currentIndex = ORDER_STATUS_FLOW.indexOf(status);

  return (
    <div className="status-tracker">
      {ORDER_STATUS_FLOW.map((step, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div className="status-tracker__step" key={step}>
            <div className={`stamp ${isDone ? 'stamp--done' : ''} ${isCurrent ? 'stamp--current' : ''}`}>
              <span>{ORDER_STATUS_LABELS[step]}</span>
            </div>
            {i < ORDER_STATUS_FLOW.length - 1 && (
              <div className={`status-tracker__connector ${isDone ? 'is-done' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
