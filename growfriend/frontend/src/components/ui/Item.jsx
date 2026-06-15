import './Item.css';

function Item({
    image,
    name,
    itemCode,
    cost,
    quantity = 0,
    mode = 'store',
    onBuy,
    onDoubleClick,
    disabled = false,
    buyLabel = 'Buy',
    secondaryLabel,
    onSecondary,
    secondaryDisabled = false
}) {
    const FOOD_TOOLTIP_META = {
        SNACK: {
            type: 'Snack',
            shortDescription: 'A light bite that gives your pet a quick energy boost.',
            growthValue: 5
        },
        MEAL: {
            type: 'Meal',
            shortDescription: 'A balanced meal that steadily supports pet growth.',
            growthValue: 12
        },
        FEAST: {
            type: 'Feast',
            shortDescription: 'A hearty feast that significantly boosts pet growth.',
            growthValue: 21
        }
    };

    const normalizedCode = String(itemCode || '').toUpperCase();
    const foodMeta = FOOD_TOOLTIP_META[normalizedCode];
    const isFoodItem = Boolean(foodMeta);
    const displayQuantity = mode === 'inventory' ? Number(quantity || 0) : 1;

    if (mode === 'inventory') {
        return (
            <div className={`item-card item-card--inventory ${displayQuantity < 1 ? 'item-card--empty' : ''}`} onDoubleClick={onDoubleClick}>
                <div className="item-image-wrap">
                    <img src={image} alt={name} className="item-image" />
                    {isFoodItem && (
                        <div className="item-tooltip" role="tooltip">
                            <div className="item-tooltip-name">{name}</div>
                            <div className="item-tooltip-line">{foodMeta.type}: {foodMeta.shortDescription}</div>
                            <div className="item-tooltip-line attribute">Growth Value: +{foodMeta.growthValue}</div>
                            <div className="item-tooltip-line">Quantity: x{displayQuantity}</div>
                        </div>
                    )}
                </div>
                <div className="item-qty">x{quantity}</div>
            </div>
        );
    }

    return (
        <div className="item-card item-card--store">
            <div className="item-image-wrap">
                <img src={image} alt={name} className="item-image" />
                {isFoodItem && (
                    <div className="item-tooltip" role="tooltip">
                        <div className="item-tooltip-name">{name}</div>
                        <div className="item-tooltip-line">{foodMeta.type}: {foodMeta.shortDescription}</div>
                        <div className="item-tooltip-line attribute">Growth Value: +{foodMeta.growthValue}</div>
                        <div className="item-tooltip-line">Quantity: x{displayQuantity}</div>
                    </div>
                )}
            </div>
            <h4 className="item-name">{name}</h4>
            <div className="item-cost">{cost} coins</div>
            
            {/* container for side-by-side buttons */}
            <div className="item-actions">
                <button
                    className="item-buy"
                    onClick={onBuy}
                    disabled={disabled}
                >
                    {buyLabel}
                </button>

                {secondaryLabel && (
                    <button
                        className="item-buy item-buy--secondary"
                        onClick={onSecondary}
                        disabled={secondaryDisabled || disabled}
                    >
                        {secondaryLabel}
                    </button>
                )}
            </div>
        </div>
    );
}

export default Item;
