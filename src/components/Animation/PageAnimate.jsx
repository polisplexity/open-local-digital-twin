import React from 'react'
import { motion } from 'framer-motion';

const PageAnimate = ({ children }) => {

    const pageVariants = {
        initial: {
            opacity: 0,
            // scale: 0.99
        },
        in: {
            opacity: 2,
            // scale: 1
        },
        out: {
            opacity: 0,
            // scale: 1.01
        }
    };
    const pageTransition = {
        type: 'tween',
        ease: 'anticipate',
        duration: 0.5
    };

    return (
        <>
            <motion.div
                initial="initial"
                animate="in"
                exit="out"
                variants={pageVariants}
                transition={pageTransition}>
                {children}
            </motion.div>
        </>
    )
}

export default PageAnimate
