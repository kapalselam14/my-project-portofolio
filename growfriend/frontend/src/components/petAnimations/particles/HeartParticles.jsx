import { motion } from 'framer-motion';

const HEARTS = ['❤️', '💕', '💖', '💗', '💓'];

export default function HeartParticles({ count = 6, originX = 0, originY = 0 }) {
  return (
    <div style={{ position: 'absolute', top: originY, left: originX, pointerEvents: 'none', zIndex: 50 }}>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const distance = 60 + Math.random() * 50;
        const targetX = Math.cos(angle) * distance;
        const targetY = Math.sin(angle) * distance - 40; // bias upward
        const heart = HEARTS[Math.floor(Math.random() * HEARTS.length)];

        return (
          <motion.span
            key={i}
            style={{
              position: 'absolute',
              fontSize: 18 + Math.random() * 12,
              transformOrigin: 'center',
            }}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: targetX,
              y: targetY,
              scale: [0, 1.2, 1, 0.6],
              rotate: (Math.random() - 0.5) * 40,
            }}
            transition={{
              duration: 1 + Math.random() * 0.4,
              ease: 'easeOut',
              delay: i * 0.05,
            }}
          >
            {heart}
          </motion.span>
        );
      })}
    </div>
  );
}
