import '@/styles/components/StoreModal.css';
import { useState, useEffect, useRef } from 'react';
import Item from '../ui/Item';
import { ITEM_IMAGES } from '../../data/itemAssets';
import { getStoreItems, purchaseItem } from '../../utils/storeApi';

function normalizeStoreItems(response) {
    const data = response?.data || response;

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.storeItems)) return data.storeItems;

    return [];
}

function getItemImage(item) {
    if (item.code === 'RANDOM_EGG') return ITEM_IMAGES.egg;
    if (item.code === 'SNACK') return ITEM_IMAGES.snack;
    if (item.code === 'MEAL') return ITEM_IMAGES.sandwich;
    if (item.code === 'FEAST') return ITEM_IMAGES.roastChicken;

    return ITEM_IMAGES.snack;
}

function StoreModal({ onClose, onPurchaseSuccess }) {
    const CLOSE_ANIM_MS = 320;
    const [closing, setClosing] = useState(false);
    const [storeItems, setStoreItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [buyingKey, setBuyingKey] = useState(null); // Tracks "CODE:QTY"
    const [messageBubble, setMessageBubble] = useState({
        text: '',
        type: 'success'
    });
    const [error, setError] = useState('');
    const timeoutRef = useRef(null);
    const bubbleTimerRef = useRef(null);

    function showMessageBubble(text, type = 'success', duration = 1400) {
        setMessageBubble({ text, type });

        if (bubbleTimerRef.current) {
            window.clearTimeout(bubbleTimerRef.current);
        }

        bubbleTimerRef.current = window.setTimeout(() => {
            setMessageBubble({ text: '', type: 'success' });
        }, duration);
    }

    async function loadStoreItems() {
        const token = localStorage.getItem('token');
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError('');

            const response = await getStoreItems(token);
            setStoreItems(normalizeStoreItems(response));
        } catch (err) {
            setError(err.message || 'Failed to load store items');
        } finally {
            setLoading(false);
        }
    }

    async function handleBuy(item, quantity = 1) {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const key = `${item.code}:${quantity}`;
            setBuyingKey(key);
            setMessageBubble({ text: '', type: 'success' });
            setError('');

            const response = await purchaseItem(item.code, quantity, token);
            showMessageBubble(
                response?.message || `${item.name} x${quantity} purchased successfully`,
                'success'
            );

            if (onPurchaseSuccess) await onPurchaseSuccess(response);
            await loadStoreItems();
        } catch (err) {
            showMessageBubble(err.message || 'Purchase failed', 'error', 1800);
        } finally {
            setBuyingKey(null);
        }
    }

    function handleClose() {
        if (closing) return;
        setClosing(true);
        timeoutRef.current = setTimeout(() => {
            onClose && onClose();
            timeoutRef.current = null;
        }, CLOSE_ANIM_MS);
    }

    useEffect(() => {
        loadStoreItems();
        function onKey(e) { if (e.key === 'Escape') handleClose(); }
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
        };
    }, []);

    return (
        <div className="store-overlay" onClick={handleClose}>
            <aside className={`store-panel ${closing ? 'store--closing' : 'store--open'}`} onClick={(e) => e.stopPropagation()}>
                <div className="store-modal">
                    {messageBubble.text && (
                        <div className="store-bubble-overlay">
                            <div
                                className={`store-bubble ${
                                    messageBubble.type === 'error' ? 'store-bubble-error' : ''
                                }`}
                            >
                                {messageBubble.text}
                            </div>
                        </div>
                    )}
                    <div className="store-header">
                        <h3 className="store-title">Store</h3>
                        <button className="modal-close" onClick={handleClose}>✕</button>
                    </div>

                    <p className="store-desc">Spend coins to buy items for your pet.</p>
                    {error && <p className="store-error">{error}</p>}

                    {loading ? (
                        <p>Loading store items...</p>
                    ) : storeItems.length === 0 ? (
                        <p>No store items available.</p>
                    ) : (
                        <div className="store-grid">
                            {storeItems.map((item) => {
                                const isEgg = item.code === 'RANDOM_EGG';
                                const disabled = item.locked || !!buyingKey;
                                
                                return (
                                    <Item
                                        key={item.id || item._id || item.code}
                                        image={getItemImage(item)}
                                        name={item.name}
                                        itemCode={item.code}
                                        cost={item.price}
                                        mode="store"
                                        disabled={disabled}
                                        buyLabel={buyingKey === `${item.code}:1` ? '...' : 'Buy'}
                                        onBuy={() => handleBuy(item, 1)}
                                        secondaryLabel={isEgg ? null : (buyingKey === `${item.code}:10` ? '...' : 'Buy x10')}
                                        onSecondary={() => handleBuy(item, 10)}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
}

export default StoreModal;
