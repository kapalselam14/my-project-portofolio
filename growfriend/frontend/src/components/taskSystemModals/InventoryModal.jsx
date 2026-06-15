import '@/styles/components/InventoryModal.css';
import { useEffect, useRef, useState } from 'react';
import Item from '../ui/Item';
import PetSprite from '../petAnimations/PetSprite';
import { activatePet } from '../../utils/petApi';
import { ITEM_IMAGES } from '../../data/itemAssets';
import {
  getInventory,
  getPetCollection,
  normalizeInventoryItems,
  normalizePetCollection
} from '../../utils/inventoryApi';

function getPetSpecies(pet) {
  if (pet?.spriteKey) return pet.spriteKey;

  let key = String(pet?.speciesCode || '').toLowerCase();
  
  if (key.match(/kiwi|apteryx/)) return 'apteryx';
  if (key.match(/penguin/)) return 'penguin';
  if (key.match(/lemur|lemuera/)) return 'lemuera';
  if (key.match(/pukeko/)) return 'pukeko';
  if (key.match(/pateke/)) return 'pateke';
  if (key.match(/pyro/)) return 'pyro';
  
  return 'apteryx';
}

function getItemImage(item) {
  const code = item?.itemCode || item?.code;

  if (code === 'RANDOM_EGG') return ITEM_IMAGES.egg;
  if (code === 'SNACK') return ITEM_IMAGES.snack;
  if (code === 'MEAL') return ITEM_IMAGES.sandwich;
  if (code === 'FEAST') return ITEM_IMAGES.roastChicken;

  return ITEM_IMAGES.snack;
}

function getPetStage(stage) {
  const normalizedStage = String(stage || '').toUpperCase();
  if (normalizedStage === 'EGG') return 'egg';
  if (normalizedStage === 'KID') return 'kid';
  if (normalizedStage === 'ADULT') return 'adult';
  return 'egg';
}

function formatPetType(speciesCode, speciesName) {
  const fallback = String(speciesName || '').trim();
  const raw = String(speciesCode || '').toLowerCase();
  if (!raw) return fallback || 'Unknown';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function InventoryModal({ onClose }) {
  const MIN_PET_SLOTS = 9;
  const CLOSE_ANIM_MS = 320;
  const [closing, setClosing] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [petCollection, setPetCollection] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switchingPet, setSwitchingPet] = useState(false);
  const [confirmItem, setConfirmItem] = useState(null);
  const [confirmSwitchPet, setConfirmSwitchPet] = useState(null);
  const [error, setError] = useState('');
  const [feedMessage, setFeedMessage] = useState('');
  const [petTooltip, setPetTooltip] = useState({ visible: false, x: 0, y: 0, pet: null });
  const timeoutRef = useRef(null);

  const isTouchDevice = typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  function showFeedMessage(text) {
    setFeedMessage(text);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setFeedMessage('');
      timeoutRef.current = null;
    }, 1600);
  }

  async function loadInventory() {
    const token = localStorage.getItem('token');

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const [inventoryResponse, petCollectionResponse] = await Promise.all([
        getInventory(token),
        getPetCollection(token)
      ]);
      const items = normalizeInventoryItems(inventoryResponse);
      const pets = normalizePetCollection(petCollectionResponse);
      setInventoryItems(items);
      setPetCollection(pets);
    } catch (err) {
      setError(err.message || 'Failed to fetch inventory');
    } finally {
      setLoading(false);
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
    const handleInventoryUpdate = (e) => {
      const updatedItem = e.detail?.inventoryItem;
      if (!updatedItem) return;
      setInventoryItems(prevItems =>
        prevItems.map(item => {
          const isMatch = String(item.itemCode).toUpperCase() === String(updatedItem.itemCode).toUpperCase();
          return isMatch ? { ...item, quantity: updatedItem.quantity } : item;
        })
      );
    };
    
    window.addEventListener('gf-inventory-updated', handleInventoryUpdate);
    return () => window.removeEventListener('gf-inventory-updated', handleInventoryUpdate);
  }, []);

  useEffect(() => {
    loadInventory();

    function onKey(e) {
      if (e.key === 'Escape') handleClose();
    }

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const handleItemInteract = (item) => {
    if (item.type !== 'FOOD') return;

    const quantity = Number(item.quantity || 0);

    if (quantity < 1) {
      showFeedMessage(`Can't feed: you don't have any ${item.itemName || item.name || item.itemCode} left.`);
      return;
    }

    setConfirmItem(item);
  };

  const handleConfirmFeed = () => {
    if (confirmItem) {
      window.dispatchEvent(new CustomEvent('gf-feed-pet', { detail: { itemCode: confirmItem.itemCode } }));
      setConfirmItem(null);
    }
  };

  const handlePetDoubleClick = (pet) => {
    setConfirmSwitchPet(pet);
  };

  const handlePetClick = (pet) => {
    if (isTouchDevice) {
      setConfirmSwitchPet(pet);
    }
  };

  const handleConfirmSwitchPet = async () => {
    if (!confirmSwitchPet || switchingPet) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setSwitchingPet(true);
      setError('');

      const response = await activatePet(confirmSwitchPet.id, token);
      const nextActivePet = response?.data?.activePet || null;

      setConfirmSwitchPet(null);
      await loadInventory();

      window.dispatchEvent(new CustomEvent('gf-active-pet-changed', {
        detail: {
          activePetId: response?.data?.activePetId || confirmSwitchPet.id,
          activePet: nextActivePet
        }
      }));
    } catch (err) {
      setError(err.message || 'Failed to switch active pet');
    } finally {
      setSwitchingPet(false);
    }
  };

  const showPetTooltip = (e, pet) => {
    const target = e?.currentTarget;
    if (!pet || !target) return;
    const rect = target.getBoundingClientRect();
    setPetTooltip({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top,
      pet
    });
  };

  const movePetTooltip = (e) => {
    const target = e?.currentTarget;
    if (!target) return;
    setPetTooltip(prev => {
      if (!prev.visible) return prev;
      const rect = target.getBoundingClientRect();
      return { ...prev, x: rect.left + rect.width / 2, y: rect.top };
    });
  };

  const hidePetTooltip = () => {
    setPetTooltip({ visible: false, x: 0, y: 0, pet: null });
  };

  const inventoryListItems = inventoryItems.filter((item) => item.type === 'FOOD');
  const filledPetSlots = petCollection;
  const emptyPetSlots = Math.max(0, MIN_PET_SLOTS - filledPetSlots.length);

  return (
    <div className="inventory-overlay" onClick={handleClose}>
      <aside
        className={`inventory-panel ${closing ? 'inventory--closing' : 'inventory--open'}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Inventory"
      >
        <div className="inventory-modal">
          <div className="inventory-header">
            <h3 className="inventory-title">Inventory</h3>
            <button className="modal-close" onClick={handleClose}>✕</button>
          </div>

          <p className="inventory-desc">Your items and collected pets. Double click to interact with the items or change active pet.</p>

          <div className="inventory-wrapper">
            <section className="inventory-section">
              <h4 className="section-title">Items</h4>
              {loading ? (
                <p>Loading...</p>
              ) : error ? (
                <p>{error}</p>
              ) : inventoryListItems.length === 0 ? (
                <p>Your inventory is empty.</p>
              ) : (
                <div className="inventory-grid">
                  {inventoryListItems.map((item) => (
                    <div
                      key={item.id || item.storeItemId || item.itemCode}
                      onClick={() => isTouchDevice && handleItemInteract(item)}
                      onDoubleClick={() => handleItemInteract(item)}
                    >
                      <Item
                        image={getItemImage(item)}
                        name={item.itemName || item.name || 'Unknown item'}
                        itemCode={item.itemCode || item.code}
                        quantity={item.quantity ?? 0}
                        mode="inventory"
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
              
            <section className="pet-collection-section">
              <h4 className="section-title">Pet Collection</h4>
              <div className="pets-scroll">
                <div className="pets-grid">
                  {filledPetSlots.map((pet) => (
                    <div
                      key={pet.id}
                      className="pet-slot"
                      onClick={() => handlePetClick(pet)}
                      onDoubleClick={() => handlePetDoubleClick(pet)}
                      onMouseEnter={(e) => showPetTooltip(e, pet)}
                      onMouseMove={movePetTooltip}
                      onMouseLeave={hidePetTooltip}
                      onFocus={(e) => showPetTooltip(e, pet)}
                      onBlur={hidePetTooltip}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handlePetDoubleClick(pet);
                        }
                      }}
                      aria-label={`Inactive pet ${pet.nickname || pet.speciesName || 'pet'}. Double click to switch active pet.`}
                    >
                      <PetSprite
                        species={getPetSpecies(pet)}
                        stage={getPetStage(pet.stage)}
                        animState="idle"
                        size={64}
                        showShadow={false}
                      />
                    </div>
                  ))}

                  {Array.from({ length: emptyPetSlots }).map((_, i) => (
                    <div key={i} className="pet-slot">
                      <div className="pet-slot-img" />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </aside>

      {petTooltip.visible && petTooltip.pet && (
        <div
          className="pet-tooltip-overlay"
          style={{ left: `${petTooltip.x}px`, top: `${petTooltip.y}px` }}
        >
          <div><strong>Nickname:</strong> {petTooltip.pet.nickname || 'Buddy'}</div>
          <div><strong>Level:</strong> {Number(petTooltip.pet.level || 0)}</div>
          {getPetStage(petTooltip.pet.stage) !== 'egg' && (
            <div><strong>Type:</strong> {formatPetType(petTooltip.pet.speciesCode, petTooltip.pet.speciesName)}</div>
          )}
        </div>
      )}

      {feedMessage && (
        <div className="feed-confirm-bubble" onClick={(e) => e.stopPropagation()}>
          <div className="feed-confirm-content">
            <p>{feedMessage}</p>
            <div className="feed-confirm-actions">
              <button
                className="gf-btn gf-btn-primary"
                onClick={() => setFeedMessage('')}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Bubble */}
      {confirmItem && (
        <div className="feed-confirm-bubble" onClick={(e) => e.stopPropagation()}>
          <div className="feed-confirm-content">
            <p>Do you want to feed your pet <b>{confirmItem.itemName || confirmItem.itemCode}</b>?</p>
            <div className="feed-confirm-actions">
              <button className="gf-btn gf-btn-ghost" onClick={() => setConfirmItem(null)}>Cancel</button>
              <button className="gf-btn gf-btn-primary" onClick={handleConfirmFeed}>Feed</button>
            </div>
          </div>
        </div>
      )}

      {confirmSwitchPet && (
        <div className="feed-confirm-bubble" onClick={(e) => e.stopPropagation()}>
          <div className="feed-confirm-content">
            <p>
              {/* Nickname for new pet is still empty from the backend. Handling default name after purchasing the pet */}
              Set <b>{confirmSwitchPet.nickname || confirmSwitchPet.speciesName || 'this pet'}</b> as your active pet?
            </p>
            <div className="feed-confirm-actions">
              <button
                className="gf-btn gf-btn-ghost"
                onClick={() => setConfirmSwitchPet(null)}
                disabled={switchingPet}
              >
                Cancel
              </button>
              <button
                className="gf-btn gf-btn-primary"
                onClick={handleConfirmSwitchPet}
                disabled={switchingPet}
              >
                {switchingPet ? 'Switching...' : 'Switch Pet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryModal;