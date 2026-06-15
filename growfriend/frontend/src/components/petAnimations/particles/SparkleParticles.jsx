import { motion } from 'framer-motion';

export default function SparkleParticles({ count = 12, radius = 120, color = '#FFD700' }) {
  return (
    <div style={{ position: 'absolute', top: '50%', left: '50%', pointerEvents: 'none', zIndex: 50 }}>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / count;
        const dist = radius * (0.6 + Math.random() * 0.4);
        const targetX = Math.cos(angle) * dist;
        const targetY = Math.sin(angle) * dist;
        const size = 4 + Math.random() * 8;

        return (
          <motion.div
            key={i}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
              boxShadow: `0 0 ${size * 2}px ${color}`,
            }}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: targetX,
              y: targetY,
              scale: [0, 1.5, 1, 0],
            }}
            transition={{
              duration: 1.2 + Math.random() * 0.4,
              ease: 'easeOut',
              delay: i * 0.04,
            }}
          />
        );
      })}
      {/* Star emoji burst */}
      {['✨', '⭐', '🌟', '✨', '⭐', '🌟'].map((star, i) => {
        const angle = (Math.PI * 2 * i) / 6 + 0.3;
        const dist = radius * 0.7;
        return (
          <motion.span
            key={`star-${i}`}
            style={{ position: 'absolute', fontSize: 16 + Math.random() * 10 }}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 0],
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist,
              scale: [0, 1.3, 0],
              rotate: 360,
            }}
            transition={{
              duration: 1.5,
              ease: 'easeOut',
              delay: 0.2 + i * 0.08,
            }}
          >
            {star}
          </motion.span>
        );
      })}
    </div>
  );
}
