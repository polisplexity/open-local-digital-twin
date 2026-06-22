'use client'
import classNames from 'classnames';
import { useState } from 'react';
import GalleryBody from './GalleryBody';
import GalleryHeader from './GalleryHeader';
import GallerySidebar from './GallerySidebar';

const Gallery = () => {
    const [showSidebar, setShowSidebar] = useState(true);

    return (
        <div className="hk-pg-body py-0">
            <div className={classNames("galleryapp-wrap", { "galleryapp-sidebar-toggle": !showSidebar })} >
                <GallerySidebar />
                <div className="galleryapp-content">
                    <div className="galleryapp-detail-wrap">
                        <GalleryHeader toggleSidebar={() => setShowSidebar(!showSidebar)} showSidebar={showSidebar} />
                        <GalleryBody />
                    </div>
                </div>
            </div>
        </div>

    )
}

export default Gallery
