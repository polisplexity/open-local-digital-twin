'use client';
import PipelineBody from './Body';
import Footer from './Footer';

const Pipeline = () => {

    return (
        <div className="hk-pg-body py-0">
            <div className="taskboardapp-wrap">
                <div className="taskboardapp-content ps-0">
                    <div className="taskboardapp-detail-wrap">
                        <PipelineBody />
                    </div>
                </div>
            </div>
            <Footer />
        </div>

    )
}

export default Pipeline
