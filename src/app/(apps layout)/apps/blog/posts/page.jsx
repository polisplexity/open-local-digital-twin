'use client'
import { useState } from 'react';
import classNames from 'classnames';
import BlogAppHeader from '../BlogAppHeader';
import BlogAppSidebar from '../BlogAppSidebar';
import PostBody from './PostBody';

const Posts = () => {
    const [showSidebar, setShowSidebar] = useState(true);

    return (
        <div className="hk-pg-body py-0">
            <div className={classNames("blogapp-wrap", { "blogapp-sidebar-toggle": !showSidebar })}>
                <BlogAppSidebar />
                <div className="blogapp-content">
                    <div className="blogapp-detail-wrap">
                        <BlogAppHeader toggleSidebar={() => setShowSidebar(!showSidebar)} showSidebar={showSidebar} />
                        <PostBody />
                    </div>
                </div>
            </div>
        </div>

    )
}

export default Posts
