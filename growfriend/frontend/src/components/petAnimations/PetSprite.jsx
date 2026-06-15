import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './PetSprite.css';

/* ── Asset map ─────────────────────────────────────── */
const petImages = import.meta.glob('@/assets/pets/*.png', { eager: true, import: 'default' });

function buildAssetMap() {
  const map = {};
  Object.entries(petImages).forEach(([path, src]) => {
    const file = path.split('/').pop() || '';
    const key = file.replace(/\.png$/i, '');
    if (key) map[key] = src;
  });
  return map;
}

const ASSET_MAP = buildAssetMap();

function normalizeSpeciesKey(input) {
    if (!input) return 'apteryx';
    let key = String(input).trim().toLowerCase();
    if (key.match(/kiwi|apteryx/)) return 'apteryx';
    if (key.match(/penguin/)) return 'penguin';
    if (key.match(/lemur|lemuera/)) return 'lemuera';
    if (key.match(/pukeko/)) return 'pukeko';
    if (key.match(/pateke/)) return 'pateke';
    if (key.match(/pyro/)) return 'pyro';
    return 'apteryx';
}

function normalizeStage(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (raw === 'egg') return 'egg';
  if (raw === 'kid') return 'kid';
  if (raw === 'adult') return 'adult';
  if (raw === 'egg_stage' || raw === 'stage0') return 'egg';
  if (raw === 'stage1') return 'kid';
  if (raw === 'stage2') return 'adult';
  if (raw === 'eggs') return 'egg';
  if (raw === 'kids') return 'kid';
  if (raw === 'adults') return 'adult';
  return 'kid';
}

function getPetImage(species, stage, animState) {
  const normalizedSpecies = normalizeSpeciesKey(species || 'apteryx');
  const normalizedStage = normalizeStage(stage);
  const isEgg = normalizedStage === 'egg';
  const baseKey = isEgg
    ? 'egg'
    : normalizedStage === 'kid'
      ? `${normalizedSpecies}_1`
      : `${normalizedSpecies}_2`;

  const animSuffix =
    animState === 'sad' ? '_sad' :
    animState === 'sleeping' ? '_sleeping' :
    '';

  const animatedKey = `${baseKey}${animSuffix}`;

  if (ASSET_MAP[animatedKey]) return ASSET_MAP[animatedKey];

  if (animState === 'sleeping' && !isEgg) {
    const fallbackSleepKey = normalizedStage === 'kid' ? 'apteryx_1_sleeping' : 'apteryx_2_sleeping';
    if (ASSET_MAP[fallbackSleepKey]) return ASSET_MAP[fallbackSleepKey];
  }

  if (ASSET_MAP[baseKey]) return ASSET_MAP[baseKey];

  if (isEgg && ASSET_MAP.egg) return ASSET_MAP.egg;
  if (normalizedStage === 'kid' && ASSET_MAP.apteryx_1) return ASSET_MAP.apteryx_1;
  if (normalizedStage === 'adult' && ASSET_MAP.apteryx_2) return ASSET_MAP.apteryx_2;

  const first = Object.values(ASSET_MAP)[0];
  return first || null;
}

/* ── Component ─────────────────────────────────────── */
export default function PetSprite({
  species = 'apteryx',
  stage = 'kid',
  animState = 'idle', // 'idle' | 'clicked' | 'feeding' | 'playing' | 'celebrating' | 'sad' | 'sleeping' | 'evolving'
  onClick,
  size = 280,
  showShadow = true,
  className = '',
}) {
  const [internalAnim, setInternalAnim] = useState(animState);

  // Sync with external animState
  useEffect(() => {
    setInternalAnim(animState);
  }, [animState]);

  const normalizedStage = useMemo(() => normalizeStage(stage), [stage]);
  const imgSrc = useMemo(
    () => getPetImage(species, normalizedStage, internalAnim),
    [species, normalizedStage, internalAnim]
  );

  const handleClick = useCallback(() => {
    if (onClick) onClick();
  }, [onClick]);

  if (!imgSrc) return null;

  return (
    <div
      className={`pet-sprite-wrapper ${className}`}
      style={{ width: size, height: size }}
      onClick={handleClick}
    >
      {/* Pet Shadow */}
      {showShadow && (
        <motion.div
          className="pet-shadow"
          animate={{
            scaleX: internalAnim === 'clicked' ? 0.8 : 1,
            opacity: internalAnim === 'sleeping' ? 0.1 : 0.7,
          }}
          transition={{ duration: 0.3 }}
        />
      )}

      {/* Egg shimmer overlay */}
      {normalizedStage === 'egg' && internalAnim === 'idle' && <div className="egg-shimmer" />}

      {/* Pet Image with CSS animation class */}
      <AnimatePresence mode="wait">
        <motion.img
          key={`${species}-${normalizedStage}-${internalAnim}`}
          src={imgSrc}
          alt={`${species} ${normalizedStage}`}
          className={`pet-sprite-img stage-${normalizedStage} anim-${internalAnim}`}
          initial={false}
          draggable={false}
        />
      </AnimatePresence>
    </div>
  );
}