import '../../styles/dashboard/PetView.css'
import { useState, useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { getActivePet, feedPet, evolvePet, updateActivePetNickname } from '@/utils/petApi'
import { getInventory } from '@/utils/inventoryApi'
import PetSprite from '../petAnimations/PetSprite'
import HeartParticles from '../petAnimations/particles/HeartParticles'
import EvolutionOverlay from '../petAnimations/EvolutionOverlay'
import { useApp } from '../../context/AppContext'
import editIcon from '/edit.png'

// ── Helpers ─────────────────────────────────────────────────────────────────

// Normalize any backend species/sprite keys into asset-compatible ids
function normalizeSpeciesKey(input) {
    if (!input) return 'apteryx';
    let key = String(input).trim().toLowerCase();
    const valid = ['apteryx', 'penguin', 'lemuera', 'pyro', 'pukeko', 'pateke'];
    
    // Map specific legacy or backend codes to the 6 folders
    if (key.match(/kiwi|apteryx/)) return 'apteryx';
    if (key.match(/penguin/)) return 'penguin';
    if (key.match(/lemur|lemuera/)) return 'lemuera';
    if (key.match(/pukeko/)) return 'pukeko';
    if (key.match(/pateke/)) return 'pateke';
    if (key.match(/pyro/)) return 'pyro';

    return valid.includes(key) ? key : 'apteryx';
}

// Backend returns speciesCode (e.g. "APTERYX") → map to lowercase image filename
function getPetSpecies(pet) {
    if (!pet) return 'apteryx';

    if (pet.spriteKey) {
        const normalizedSprite = normalizeSpeciesKey(pet.spriteKey);
        return normalizedSprite || 'apteryx';
    }

    const code = normalizeSpeciesKey(pet.speciesCode || '');
    return code || 'apteryx';
}

// Backend returns stage in uppercase: 'EGG' | 'KID' | 'ADULT'
function getPetStage(pet) {
    if (!pet) return 'egg';
    const stage = (pet.stage || '').toUpperCase();
    if (stage === 'EGG') return 'egg';
    if (stage === 'KID') return 'kid';
    if (stage === 'ADULT') return 'adult';
    return 'egg';
}

// One-shot animations that should not be interrupted
const ONE_SHOT_ANIMS = new Set(['feeding', 'clicked', 'celebrating', 'evolving', 'playing']);
const MAX_LEVEL = 10;
const MAX_GROWTH_POINTS = 99;
const STATUS_POPUP_MS = 2000;
const MAX_UNLOCK_MS = 3000;

// Inactivity thresholds
const INACTIVITY_SAD_MS   = 30 * 60 * 1000; // 30 min idle → sad
const INACTIVITY_SLEEP_MS = 30 * 60 * 1000; // 30 min sad  → sleeping

// ── Component ────────────────────────────────────────────────────────────────

function PetView({ pomoIsRunning = false, externalAnim = null, onPetLoaded }) {
    const token = localStorage.getItem('token');
    const { currentUser } = useApp();
    const spriteWrapRef = useRef(null);
    const [spriteSize, setSpriteSize] = useState(280);

    useEffect(() => {
        const el = spriteWrapRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            if (window.innerWidth < 960) {
                setSpriteSize(280);
                return;
            }
            const { width, height } = entry.contentRect;
            setSpriteSize(Math.max(120, Math.floor(Math.min(width, height * 0.9))));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    const [pet, setPet] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [errorBubbleMessage, setErrorBubbleMessage] = useState('');
    const [statusPopupMessage, setStatusPopupMessage] = useState('');
    const [maxUnlockMessage, setMaxUnlockMessage] = useState('');
    const [inventory, setInventory] = useState([]);
    const [selectedItemCode, setSelectedItemCode] = useState('');
    const [animState, setAnimState] = useState('idle');
    const [showEvolution, setShowEvolution] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [petNameDraft, setPetNameDraft] = useState('');
    const [savingPetName, setSavingPetName] = useState(false);
    const [heartBurst, setHeartBurst] = useState(null);

    const clickTimerRef = useRef(null);
    const pendingDoubleRef = useRef(false);
    const heartTimerRef = useRef(null);

    const bubbleTimerRef = useRef(null);
    const errorBubbleTimerRef = useRef(null);
    const statusPopupTimerRef = useRef(null);
    const maxUnlockTimerRef = useRef(null);
    const wasMaxRef = useRef(false);
    const initialLoadRef = useRef(true);
    const lastStableAnimRef = useRef('idle');

    const sadTimerRef   = useRef(null);
    const sleepTimerRef = useRef(null);

    const prevUserKeyRef = useRef(null);

    function getUserKey() {
        return currentUser?.id || currentUser?.email || null;
    }

    function getAnimStorageKey() {
        const userKey = getUserKey() || 'guest';
        const petKey = pet?.id || pet?._id || 'active';
        return `gf_pet_anim_${String(userKey).toLowerCase()}_${petKey}`;
    }

    function getActivityKey() {
        const userKey = getUserKey() || 'guest';
        return `gf_last_activity_${String(userKey).toLowerCase()}`;
    }

    function readLastActivity() {
        try { return Number(localStorage.getItem(getActivityKey())) || 0; } catch { return 0; }
    }

    function writeLastActivity(ts) {
        try { localStorage.setItem(getActivityKey(), String(ts)); } catch { /* ignore */ }
    }

    function readStoredAnim() {
        try {
            const key = getAnimStorageKey();
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    }

    function writeStoredAnim(value) {
        try {
            const key = getAnimStorageKey();
            localStorage.setItem(key, value);
        } catch {
            // ignore storage errors
        }
    }

    function removeStoredAnim() {
        try {
            const key = getAnimStorageKey();
            localStorage.removeItem(key);
        } catch {
            // ignore storage errors
        }
    }

    function restoreStableAnim() {
        const fallback = lastStableAnimRef.current || 'idle';
        setAnimState(pomoIsRunning ? 'idle' : fallback);
    }

    // ── Inactivity timers ────────────────────────────────────────────────────
    // resetInactivityTimers: cancels pending timers, records activity,
    // then schedules sad (30 min) → sleeping (another 30 min) automatically.
    // Does NOT forcibly change the current anim — only the timers fire changes.
    function resetInactivityTimers() {
        if (sadTimerRef.current)   clearTimeout(sadTimerRef.current);
        if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
        writeLastActivity(Date.now());

        sadTimerRef.current = setTimeout(() => {
            // Only go sad if pet is in a non-one-shot stable state
            setAnimState(prev => {
                if (ONE_SHOT_ANIMS.has(prev)) return prev;
                if (prev === 'sleeping') return prev; // already asleep, leave it
                const next = 'sad';
                lastStableAnimRef.current = next;
                writeStoredAnim(next);
                writeLastActivity(Date.now());
                // Chain: after another 30 min, go sleeping
                if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
                sleepTimerRef.current = setTimeout(() => {
                    setAnimState(p => {
                        if (ONE_SHOT_ANIMS.has(p)) return p;
                        const s = 'sleeping';
                        lastStableAnimRef.current = s;
                        writeStoredAnim(s);
                        return s;
                    });
                }, INACTIVITY_SLEEP_MS);
                return next;
            });
        }, INACTIVITY_SAD_MS);
    }

    function showSuccessBubble(text) {
        setSuccessMessage(text);
        if (bubbleTimerRef.current) window.clearTimeout(bubbleTimerRef.current);
        bubbleTimerRef.current = window.setTimeout(() => {
            setSuccessMessage('');
        }, 1000);
    }

    function showErrorBubble(text) {
        setErrorBubbleMessage(text);
        if (errorBubbleTimerRef.current) window.clearTimeout(errorBubbleTimerRef.current);
        errorBubbleTimerRef.current = window.setTimeout(() => {
            setErrorBubbleMessage('');
        }, 2000);
    }

    function showStatusPopup(text) {
        setStatusPopupMessage(text);
        if (statusPopupTimerRef.current) window.clearTimeout(statusPopupTimerRef.current);
        statusPopupTimerRef.current = window.setTimeout(() => {
            setStatusPopupMessage('');
        }, STATUS_POPUP_MS);
    }

    function showMaxUnlockBubble() {
        setMaxUnlockMessage('Unlocked new egg!');
        if (maxUnlockTimerRef.current) window.clearTimeout(maxUnlockTimerRef.current);
        maxUnlockTimerRef.current = window.setTimeout(() => {
            setMaxUnlockMessage('');
        }, MAX_UNLOCK_MS);
    }

    function triggerHeartBurst() {
        const el = spriteWrapRef.current;
        if (!el) return;
        const { width, height } = el.getBoundingClientRect();
        const originX = Math.max(0, Math.floor(width / 2 - 16));
        const originY = Math.max(0, Math.floor(height / 2 - 16));

        setHeartBurst({
            id: Date.now(),
            originX,
            originY,
        });

        if (heartTimerRef.current) window.clearTimeout(heartTimerRef.current);
        heartTimerRef.current = window.setTimeout(() => {
            setHeartBurst(null);
            heartTimerRef.current = null;
        }, 1700);
    }


    async function fetchPetData() {
        if (!token) {
            setErrorMessage('');
            setSuccessMessage('');
            setPet(null);
            return;
        }
        setLoading(true);
        setErrorMessage('');
        setSuccessMessage('');
        try {
            const [petRes, inventoryRes] = await Promise.all([
                getActivePet(token),
                getInventory(token)
            ]);
            const activePet = petRes?.data?.activePet || petRes?.data?.pet || null;
            setPet(activePet);
            setPetNameDraft(activePet?.nickname || '');
            if (onPetLoaded) onPetLoaded(activePet);
            if (!activePet) setErrorMessage('No active pet found.');

            const items = inventoryRes?.data?.items || [];
            setInventory(items);
        } catch {
            setErrorMessage('Failed to fetch pet data.');
        } finally {
            setLoading(false);
        }
    }

    // Detect login/logout — just track user key changes;
    // state persistence is handled by readStoredAnim on pet load.
    useEffect(() => {
        prevUserKeyRef.current = getUserKey();
    }, [currentUser?.id, currentUser?.email]);

    // ── Pomodoro sleeping / idle toggle ──────────────────────────────────────
    useEffect(() => {
        setAnimState(prev => {
            if (ONE_SHOT_ANIMS.has(prev)) return prev; // don't interrupt one-shots
            if (pomoIsRunning) return 'idle';
            return prev || lastStableAnimRef.current || 'idle';
        });
    }, [pomoIsRunning]);

    // ── External anim signal (e.g. celebrating from Pomodoro) ────────────────
    useEffect(() => {
        if (!externalAnim) return;
        setAnimState(externalAnim);
        const timer = setTimeout(() => restoreStableAnim(), 2000);
        return () => clearTimeout(timer);
    }, [externalAnim, pomoIsRunning]);

    // NOTE: sad / sleeping are now triggered by inactivity timers only, not by isGrowthFrozen.

    // Normalizes various backend response shapes to a consistent pet object/
    function normalizePetResponse(res) {
        const data = res?.data ?? res;

        if (!data) return null;
        if (data.activePet) return data.activePet;
        if (data.pet) return data.pet;

        // if backend returns pet directly as data
        if (data.id || data._id || data.speciesCode || data.spriteKey) return data;

        return null;
    }

    // ── Fetch pet & inventory on mount ───────────────────────────────────────
    useEffect(() => {
        async function fetchPet() {
            if (!token) {
                setErrorMessage('');
                setSuccessMessage('');
                setPet(null);
                return;
            }
            setLoading(true);
            setErrorMessage('');
            setSuccessMessage('');
            try {
                const [petRes, inventoryRes] = await Promise.all([
                    getActivePet(token),
                    getInventory(token)
                ]);
                const activePet = normalizePetResponse(petRes);
                setPet(activePet);
                if (onPetLoaded) onPetLoaded(activePet);
                if (!activePet) setErrorMessage('No active pet found.');

                const items = inventoryRes?.data?.items || [];
                setInventory(items);
            } catch {
                setErrorMessage('Failed to fetch pet data.');
            } finally {
                setLoading(false);
            }
        }
        fetchPet();
    }, [token]);

    // ── Restore persisted anim on pet load & start inactivity timers ────────
    useEffect(() => {
        if (!pet) return;

        const now = Date.now();
        const lastActivity = readLastActivity();
        const stored = readStoredAnim();
        const elapsed = lastActivity ? now - lastActivity : 0;

        let nextAnim;
        if (!stored) {
            // Brand-new user / no history → start idle
            nextAnim = 'idle';
            writeLastActivity(now);
        } else if (elapsed >= INACTIVITY_SAD_MS + INACTIVITY_SLEEP_MS) {
            // Enough time has passed for both transitions
            nextAnim = 'sleeping';
        } else if (elapsed >= INACTIVITY_SAD_MS) {
            // Enough for sad but not yet sleeping
            nextAnim = 'sad';
        } else {
            // Restore exact state from before logout/reload
            nextAnim = stored;
        }

        setAnimState(nextAnim);
        lastStableAnimRef.current = nextAnim;
        writeStoredAnim(nextAnim);

        // Start remaining inactivity timers so they continue from where we left off
        if (sadTimerRef.current)   clearTimeout(sadTimerRef.current);
        if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);

        if (nextAnim === 'sleeping') {
            // Already at max inactivity — no timers needed until user acts
        } else if (nextAnim === 'sad') {
            // Start the sleeping countdown from where sad began
            const sadElapsed = elapsed - INACTIVITY_SAD_MS;
            const remainingSleep = Math.max(0, INACTIVITY_SLEEP_MS - sadElapsed);
            sleepTimerRef.current = setTimeout(() => {
                setAnimState(p => {
                    if (ONE_SHOT_ANIMS.has(p)) return p;
                    const s = 'sleeping';
                    lastStableAnimRef.current = s;
                    writeStoredAnim(s);
                    return s;
                });
            }, remainingSleep);
        } else {
            // Normal / idle — schedule sad after remaining idle time
            const remainingSad = Math.max(0, INACTIVITY_SAD_MS - elapsed);
            sadTimerRef.current = setTimeout(() => {
                setAnimState(prev => {
                    if (ONE_SHOT_ANIMS.has(prev)) return prev;
                    if (prev === 'sleeping') return prev;
                    const next = 'sad';
                    lastStableAnimRef.current = next;
                    writeStoredAnim(next);
                    writeLastActivity(Date.now());
                    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
                    sleepTimerRef.current = setTimeout(() => {
                        setAnimState(p => {
                            if (ONE_SHOT_ANIMS.has(p)) return p;
                            const s = 'sleeping';
                            lastStableAnimRef.current = s;
                            writeStoredAnim(s);
                            return s;
                        });
                    }, INACTIVITY_SLEEP_MS);
                    return next;
                });
            }, remainingSad);
        }
    }, [pet?.id, pet?._id, currentUser?.id, currentUser?.email]);

    // ── Persist stable anim state ───────────────────────────────────────────
    useEffect(() => {
        if (!pet) return;
        if (ONE_SHOT_ANIMS.has(animState)) return;
        if (!animState) return;
        lastStableAnimRef.current = animState;
        writeStoredAnim(animState);
    }, [animState, pet?.id, pet?._id]);

    useEffect(() => {
        if (!currentUser?.petName) return;
        setPet((prev) => (prev ? { ...prev, nickname: currentUser.petName } : prev));
    }, [currentUser?.petName]);

    // ── Document-level activity listener → reset inactivity timers ──────────
    useEffect(() => {
        if (!pet) return;
        const onActivity = () => resetInactivityTimers();
        document.addEventListener('mousedown', onActivity);
        document.addEventListener('keydown',   onActivity);
        document.addEventListener('touchstart', onActivity, { passive: true });
        return () => {
            document.removeEventListener('mousedown', onActivity);
            document.removeEventListener('keydown',   onActivity);
            document.removeEventListener('touchstart', onActivity);
        };
    }, [pet?.id, pet?._id]);

    useEffect(() => {
        return () => {
            if (bubbleTimerRef.current) window.clearTimeout(bubbleTimerRef.current);
            if (errorBubbleTimerRef.current) window.clearTimeout(errorBubbleTimerRef.current);
            if (statusPopupTimerRef.current) window.clearTimeout(statusPopupTimerRef.current);
            if (maxUnlockTimerRef.current) window.clearTimeout(maxUnlockTimerRef.current);
            if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
            if (sadTimerRef.current) window.clearTimeout(sadTimerRef.current);
            if (sleepTimerRef.current) window.clearTimeout(sleepTimerRef.current);
        };
    }, []);

    // ── Global Event Listener for Feeding from Inventory ─────────────────────
    useEffect(() => {
        const onFeedEvent = (e) => {
            const itemCode = e.detail?.itemCode;
            if (itemCode) {
                handleFeed(itemCode);
            }
        };
        const onActivePetChanged = async (e) => {
            const nextActivePet = e.detail?.activePet || null;
            if (nextActivePet) {
                initialLoadRef.current = true; 
                setPet(nextActivePet);
                setPetNameDraft(nextActivePet.nickname || '');
                setIsEditingName(false);
                if (onPetLoaded) onPetLoaded(nextActivePet);
                setAnimState('idle');
                return;
            }
            await fetchPetData();
        };
        window.addEventListener('gf-feed-pet', onFeedEvent);
        window.addEventListener('gf-active-pet-changed', onActivePetChanged);
        return () => {
            window.removeEventListener('gf-feed-pet', onFeedEvent);
            window.removeEventListener('gf-active-pet-changed', onActivePetChanged);
        };
    }, [pet, token, pomoIsRunning]);

    // ── Feed ─────────────────────────────────────────────────────────────────
    async function handleFeed(itemCode) {
        if (!pet) return;
        if (!itemCode) { setErrorMessage('Please select a food item.'); return; }
        const isMax = Number(pet.level || 0) >= MAX_LEVEL && Number(pet.growthPoints || 0) >= MAX_GROWTH_POINTS;
        if (pet.evolutionReady) {
            showStatusPopup("No more food! I'm ready to evolve already!");
            return;
        }
        if (isMax) {
            showStatusPopup("I've already grown up. No more feeding! Get a new buddy from the store!");
            return;
        }
        setLoading(true);
        setErrorMessage('');
        setSuccessMessage('');
        try {
            const result = await feedPet(pet.id, itemCode, token); 
            const updatedPet = normalizePetResponse(result);
            setPet(updatedPet);
            if (onPetLoaded) onPetLoaded(updatedPet);
            if (result?.data?.inventoryItem) {
                window.dispatchEvent(new CustomEvent('gf-inventory-updated', {
                    detail: { inventoryItem: result.data.inventoryItem }
                }));
            }
            const inventoryRes = await getInventory(token);
            setInventory(inventoryRes?.data?.items || []);
            setAnimState('feeding');
            setTimeout(() => restoreStableAnim(), 1500);
            resetInactivityTimers();
            showSuccessBubble('Fed pet successfully!');
        } catch (error) {
            console.error('Error feeding pet:', error);
            if (pet.evolutionReady) {
                showStatusPopup("No more food! I'm ready to evolve already!");
                return;
            }
            const isMaxNow = Number(pet.level || 0) >= MAX_LEVEL && Number(pet.growthPoints || 0) >= MAX_GROWTH_POINTS;
            if (isMaxNow) {
                showStatusPopup("I've already grown up. No more feeding! Get a new buddy from the store!");
                return;
            }
            showErrorBubble(error.message || 'Failed to feed pet.');
        } finally {
            setLoading(false);
        }
    }

    const handleStartEditPetName = () => {
        if (!pet || loading) return;
        setPetNameDraft(pet.nickname || '');
        setIsEditingName(true);
        setErrorMessage('');
        setSuccessMessage('');
    };

    const handleCancelEditPetName = () => {
        setPetNameDraft(pet?.nickname || '');
        setIsEditingName(false);
    };

    const handleSavePetName = async () => {
        if (!token || !pet || savingPetName) return;
        const nextName = String(petNameDraft || '').trim();
        if (!nextName) {
            setErrorMessage('Pet name cannot be empty.');
            return;
        }

        resetInactivityTimers();
        try {
            setSavingPetName(true);
            setErrorMessage('');
            setSuccessMessage('');
            const data = await updateActivePetNickname(nextName, token);
            const updatedPet = data?.data?.activePet || null;
            if (updatedPet) {
                setPet(updatedPet);
                setPetNameDraft(updatedPet.nickname || '');
                if (onPetLoaded) onPetLoaded(updatedPet);
                window.dispatchEvent(new CustomEvent('gf-active-pet-changed', {
                    detail: {
                        activePetId: updatedPet.id,
                        activePet: updatedPet
                    }
                }));
            }
            setIsEditingName(false);
            showSuccessBubble('Pet name updated!');
        } catch (error) {
            console.error('Error updating pet name:', error);
            setErrorMessage(error.message || 'Failed to update pet name.');
        } finally {
            setSavingPetName(false);
        }
    };

    // ── Evolve ───────────────────────────────────────────────────────────────
    const handleEvolve = async () => {
        if (!pet) return;
        setShowEvolution(true);
    };

    const handleEvolutionConfirm = async () => {
        setShowEvolution(false);
        setAnimState('evolving');
        setLoading(true);
        setErrorMessage('');
        setSuccessMessage('');
        try {
            const data = await evolvePet(pet.id, token);
            const updatedPet = normalizePetResponse(data);
            setPet(updatedPet);
            if (onPetLoaded) onPetLoaded(updatedPet);
            showSuccessBubble('Evolved pet successfully!');
            setTimeout(() => setAnimState('celebrating'), 200);
            setTimeout(() => {
                // After evolving, always return to idle (normal image)
                lastStableAnimRef.current = 'idle';
                writeStoredAnim('idle');
                setAnimState('idle');
                resetInactivityTimers();
            }, 2500);
        } catch (error) {
            setAnimState('idle');
            setErrorMessage('Failed to evolve pet.');
        } finally {
            setLoading(false);
        }
    };

    const handleEvolutionSkip = () => {
        setShowEvolution(false);
    };

    // ── Pet click: single = sleep, double = wake ─────────────
    const handlePetClick = () => {
        if (!pet || loading) return;

        resetInactivityTimers(); // Any click counts as activity

        if (pendingDoubleRef.current) {
            // Double-click → wake to idle
            pendingDoubleRef.current = false;
            if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
            lastStableAnimRef.current = 'idle';
            writeStoredAnim('idle');
            setAnimState('idle');
            return;
        }

        pendingDoubleRef.current = true;
        setAnimState('clicked'); // Triggers jiggle/jump animation
        triggerHeartBurst();

        clickTimerRef.current = setTimeout(() => {
            pendingDoubleRef.current = false;
            // Single-click → sleep
            lastStableAnimRef.current = 'sleeping';
            writeStoredAnim('sleeping');
            setAnimState('sleeping');
        }, 600);
    };

    const { level, growthPoints } = pet || {};
    const isMax = Number(level || 0) >= MAX_LEVEL && Number(growthPoints || 0) >= MAX_GROWTH_POINTS;
    const percent = Math.max(
        0,
        Math.min(100, (Number(growthPoints || 0) / MAX_GROWTH_POINTS) * 100)
    );

    useEffect(() => {
        if (!pet) return;
        
        const isMaxNow = Number(pet.level || 0) >= MAX_LEVEL && Number(pet.growthPoints || 0) >= MAX_GROWTH_POINTS;

        if (initialLoadRef.current) {
            wasMaxRef.current = isMaxNow;
            initialLoadRef.current = false;
            return;
        }

        if (isMaxNow && !wasMaxRef.current) {
            showMaxUnlockBubble();
        }
        wasMaxRef.current = isMaxNow;
    }, [pet?.level, pet?.growthPoints]);

    useEffect(() => {
        return () => {
            if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
            if (heartTimerRef.current) window.clearTimeout(heartTimerRef.current);
            if (bubbleTimerRef.current) window.clearTimeout(bubbleTimerRef.current);
            if (errorBubbleTimerRef.current) window.clearTimeout(errorBubbleTimerRef.current);
            if (statusPopupTimerRef.current) window.clearTimeout(statusPopupTimerRef.current);
            if (maxUnlockTimerRef.current) window.clearTimeout(maxUnlockTimerRef.current);
        };
    }, []);

    const displaySpecies = getPetSpecies(pet);
    const displayStage = getPetStage(pet);
    const displayAnim = animState;

    return (
        <>
            {loading && !pet ? <div>Loading...</div> : null}
            <div className="pet-name-row">
                {isEditingName ? (
                    <div className="pet-name-editor">
                        <input
                            className="pet-name-input"
                            value={petNameDraft}
                            onChange={(e) => setPetNameDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSavePetName();
                                if (e.key === 'Escape') handleCancelEditPetName();
                            }}
                            maxLength={30}
                            disabled={savingPetName}
                            placeholder="Enter pet name"
                        />
                        <button
                            type="button"
                            className="pet-name-action square24px pet-name-action-confirm"
                            onClick={handleSavePetName}
                            disabled={savingPetName}
                            aria-label="Confirm pet name"
                            title="Confirm pet name"
                        >
                            <span className="pet-name-action-icon">✓</span>
                        </button>
                        <button
                            type="button"
                            className="pet-name-action square24px pet-name-action-cancel"
                            onClick={handleCancelEditPetName}
                            disabled={savingPetName}
                            aria-label="Cancel pet name edit"
                            title="Cancel"
                        >
                            <span className="pet-name-action-icon">✕</span>
                        </button>
                    </div>
                ) : (
                    <>
                        <h1 className="pet-name">{pet ? (pet.nickname || 'Buddy') : 'Please select a pet'}</h1>
                        {pet && (
                            <button
                                type="button"
                                className="pet-name-edit-btn"
                                onClick={handleStartEditPetName}
                                aria-label="Edit pet name"
                                title="Edit pet name"
                            >
                                <img className="square24px edit-icon" src={editIcon} alt="Edit" />
                            </button>
                        )}
                    </>
                )}
            </div>

            <div className="pet-sprite-wrap" ref={spriteWrapRef} style={{ opacity: loading ? 0.6 : 1 }}>
                {heartBurst && (
                    <HeartParticles
                        key={heartBurst.id}
                        count={6}
                        originX={heartBurst.originX}
                        originY={heartBurst.originY}
                    />
                )}
                <PetSprite
                    species={displaySpecies}
                    stage={displayStage}
                    animState={displayAnim}
                    onClick={handlePetClick}
                    size={spriteSize}
                />
                {statusPopupMessage && (
                    <div className="pet-status-pop">{statusPopupMessage}</div>
                )}
                {successMessage && (
                    <div className="pet-bubble-overlay">
                        <div className="pet-bubble">{successMessage}</div>
                    </div>
                )}
                {maxUnlockMessage && (
                    <div className="pet-bubble-overlay">
                        <div className="pet-bubble">{maxUnlockMessage}</div>
                    </div>
                )}
                {errorBubbleMessage && (
                    <div className="pet-bubble-overlay">
                        <div className="pet-bubble pet-bubble-error">{errorBubbleMessage}</div>
                    </div>
                )}
                <AnimatePresence>
                    {showEvolution && (
                        <EvolutionOverlay
                            currentSpecies={getPetSpecies(pet)}
                            currentStage={getPetStage(pet)}
                            targetStage={getPetStage(pet) === 'egg' ? 'kid' : 'adult'}
                            onEvolve={handleEvolutionConfirm}
                            onSkip={handleEvolutionSkip}
                        />
                    )}
                </AnimatePresence>
            </div>

            {pet && (pet.evolutionReady ? (
                <div className="pet-evolve-cta">
                    <button className="pet-evolve-btn" onClick={handleEvolve} type="button">
                        <span className="pet-evolve-title">Ready to EVOLVE</span>
                        <span className="pet-evolve-sub">Click to evolve</span>
                    </button>
                </div>
            ) : (
                <div className="pet-exp">
                    <div className="exp-row">
                        <div className="exp-label">{isMax ? '' : 'Exp.'}</div>
                        <div className="pet-level">{isMax ? 'MAX' : `Lv.${level}`}</div>
                    </div>
                    <div className="exp-bar" aria-hidden>
                        <div className="exp-fill" style={{ width: `${percent}%` }} />
                    </div>
                </div>
            ))}

            {errorMessage && <div style={{ color: 'red' }}>{errorMessage}</div>}
        </>
    )
}

export default PetView;