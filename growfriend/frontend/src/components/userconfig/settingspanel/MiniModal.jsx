import { motion } from 'framer-motion';

export default function MiniModal({ title, onClose, children }) {
    return (
        <div className="mini-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <motion.div
                className="mini-modal-box"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
            >
                <div className="mini-modal-title">{title}</div>
                {children}
            </motion.div>
        </div>
    );
}