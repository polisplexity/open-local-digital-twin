"use client"
import { useEffect, useState } from 'react';

const HkLoader = ({ loadingState }) => {
    const [progress, setProgress] = useState(0)

    useEffect(() => {
        if (loadingState === "loading") {
            const interval = setInterval(() => {
                setProgress((prevProgress) => prevProgress >= 100 ? 0 : prevProgress + 10)
            }, 10);

            return () => {
                clearInterval(interval);
            }
        }
        else {
            setProgress(100)
        }
    }, [loadingState])

    return (
        <div className="hk-loading-wrap">
            <div className="loading-container">
                <div className="loading-bar" style={{ width: `${progress}%` }} />
            </div>
        </div>
    )
};

export default HkLoader;