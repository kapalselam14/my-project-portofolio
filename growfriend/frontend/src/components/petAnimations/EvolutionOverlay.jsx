import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SparkleParticles from './particles/SparkleParticles';
import './EvolutionOverlay.css';

const MotionDiv = motion.div;

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

function getImg(speciesId, stage) {
  const normalizedSpecies = normalizeSpeciesKey(speciesId);
  const normalizedStage = normalizeStage(stage);
  const isEgg = normalizedStage === 'egg';

  const baseKey = isEgg
    ? 'egg'
    : normalizedStage === 'kid'
      ? `${normalizedSpecies}_1`
      : `${normalizedSpecies}_2`;

  if (ASSET_MAP[baseKey]) return ASSET_MAP[baseKey];

  if (isEgg && ASSET_MAP.egg) return ASSET_MAP.egg;
  if (normalizedStage === 'kid' && ASSET_MAP.apteryx_1) return ASSET_MAP.apteryx_1;
  if (normalizedStage === 'adult' && ASSET_MAP.apteryx_2) return ASSET_MAP.apteryx_2;

  const first = Object.values(ASSET_MAP)[0];
  return first || null;
}

export default function EvolutionOverlay({
  currentSpecies,
  currentStage,
  onEvolve,
  onSkip,
}) {
  const [phase, setPhase] = useState('choose'); // 'choose' | 'animating' | 'done'
  const [showSparkles, setShowSparkles] = useState(false);

  const normalizedCurrentSpecies = useMemo(() => normalizeSpeciesKey(currentSpecies), [currentSpecies]);
  const normalizedCurrentStage = useMemo(() => normalizeStage(currentStage), [currentStage]);

  const handleEvolve = (speciesId) => {
    const normalized = normalizeSpeciesKey(speciesId);
    setPhase('animating');
    setShowSparkles(true);

    // After animation, mark done
    setTimeout(() => {
      setPhase('done');
      onEvolve(normalized);
    }, 2800);
  };

  const currentImg = getImg(normalizedCurrentSpecies, normalizedCurrentStage);

  return (
    <MotionDiv
      className="evolution-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <AnimatePresence mode="wait">
        {phase === 'choose' && (
          <MotionDiv
            key="choose"
            className="evolution-panel"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            <h2 className="evolution-title">🎉 Your pet is ready to evolve!</h2>
            <p className="evolution-subtitle">
              Evolution in progress.
            </p>

            {/* Current pet */}
            <div className="evolution-current">
              {currentImg && <img src={currentImg} alt="current" className="evolution-current-img" />}
              <span className="evolution-arrow">→</span>
              <div className="evolution-question">?</div>
            </div>

            <div className="evolution-confirm-actions">
              <button
                className="evolution-confirm-btn"
                onClick={() => {
                  handleEvolve(normalizedCurrentSpecies);
                }}
              >
                Confirm evolve
              </button>
              <button className="evolution-decline-btn" onClick={onSkip}>
                Not now. Stay as {normalizedCurrentStage}
              </button>
            </div>
          </MotionDiv>
        )}

        {phase === 'animating' && (
          <MotionDiv
            key="animating"
            className="evolution-animation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Bright glow */}
            <motion.div
              className="evolution-glow-circle"
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [0, 3, 2.5, 4],
                opacity: [0, 0.8, 1, 0],
              }}
              transition={{ duration: 2.5, ease: 'easeInOut' }}
            />

            {/* Old form fading out */}
            {currentImg && (
              <motion.img
                src={currentImg}
                alt="old form"
                className="evolution-morph-img"
                initial={{ scale: 1, opacity: 1 }}
                animate={{
                  scale: [1, 1.25, 0],
                  opacity: [1, 0.7, 0],
                  filter: ['brightness(1)', 'brightness(3)', 'brightness(5)'],
                }}
                transition={{ duration: 1.2, ease: 'easeIn' }}
              />
            )}

            {/* Sparkle burst */}
            {showSparkles && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                >
                  <SparkleParticles count={16} radius={160} color="#FFD700" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.8 }}
                >
                  <SparkleParticles count={10} radius={120} color="#FF69B4" />
                </motion.div>
              </>
            )}
          </MotionDiv>
        )}
      </AnimatePresence>
    </MotionDiv>
  );
}
