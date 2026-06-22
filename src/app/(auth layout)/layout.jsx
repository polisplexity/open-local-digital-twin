'use client'
import classNames from 'classnames'
import { usePathname } from 'next/navigation';

const AuthLayout = ({ children }) => {
    const pathName = usePathname();
    const lockScreenAuth = pathName.match('/auth/lock-screen');

    return (
        <div className={classNames("hk-wrapper hk-pg-auth", { "bg-primary-dark-3": lockScreenAuth })} data-footer="simple" >
            {children}
        </div>
    )
}

export default AuthLayout
