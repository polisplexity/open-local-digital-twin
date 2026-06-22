import Image from 'next/image';
import { Card } from 'react-bootstrap';
import HkBadge from '@/components/@hk-badge/@hk-badge';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';

//Image 
import avatar3 from '@/assets/img/avatar3.jpg';

const ProfileIntro = () => {
    return (
        <div className="profile-intro">
            <Card className="card-flush mw-400p bg-transparent">
                <Card.Body>
                    <div className="avatar avatar-xxl avatar-rounded position-relative mb-2">
                        <Image src={avatar3} alt="user" className="avatar-img border border-4 border-white" />
                        <HkBadge bg="success" indicator className="badge-indicator-xl position-bottom-end-overflow-1 me-1" />
                    </div>
                    <h4>Kate Jones
                        <HkTooltip title="Top endorsed" placement="top" >
                            <i className="bi-check-circle-fill fs-6 text-blue ms-1" />
                        </HkTooltip>
                    </h4>
                    <p>
                        Venenatis tellus in metus vulputate
                    </p>
                    <ul className="list-inline fs-7 mt-2 mb-0">
                        <li className="list-inline-item d-sm-inline-block d-block mb-sm-0 mb-1 me-3">
                            <i className="bi bi-briefcase me-1" />
                            <a href="#">Co-Founder,</a>
                            <a href="#">Jampack</a>
                        </li>
                        <li className="list-inline-item d-sm-inline-block d-block mb-sm-0 mb-1 me-3">
                            <i className="bi bi-geo-alt me-1" />
                            <a href="#">San Francisco,</a>
                            <a href="#">US</a>
                        </li>
                    </ul>
                </Card.Body>
            </Card>
        </div>
    )
}

export default ProfileIntro
