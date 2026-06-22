'use client';
import { useGlobalStateContext } from "@/context/GolobalStateProvider";
import TopNav from "../Header/TopNav";
import PageFooter from "../Footer/PageFooter";
// import VerticalNav from "../Sidebar/VerticalNav";
import classNames from "classnames";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useWindowWidth } from "@react-hook/window-size";
import Sidebar from "../Sidebar/Sidebar";
import { useTheme } from "../theme-provider/theme-provider";

const MainLayout = ({ children }) => {
    const { states, dispatch } = useGlobalStateContext();
    const pathName = usePathname();
    const appRoutes = pathName.match('/apps/');
    const twinRoutes = /^\/(cockpit|municipal|public|theory|docs|admin)(\/|$)/.test(pathName);
    const windowWidth = useWindowWidth();
    const { theme } = useTheme();

    useEffect(() => {
        const isAppGroupPage = pathName.match('/apps/');
        if (isAppGroupPage && windowWidth >= 1200) {
            dispatch({ type: 'collapse_sidebar' });
        } else {
            dispatch({ type: 'expand_sidebar' });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windowWidth, pathName]);

    useEffect(() => {
        setTimeout(() => {
            dispatch({ type: 'data_hover', dataHover: states.layoutState.isSidebarCollapsed })
        }, 250);
    }, [dispatch, states.layoutState.isSidebarCollapsed])

    return (
        <>
            <div
                className={classNames("hk-wrapper", { "hk__email__backdrop": states.emailState.maximize  }, { "hk-pg-auth": pathName === "/error-404" })}
                data-layout="vertical"
                data-navbar-style={states.layoutState.topNavCollapse ? "collapsed" : ""}
                data-layout-style={states.layoutState.isSidebarCollapsed ? "collapsed" : "default"}
                data-hover={states.layoutState.dataHover ? "active" : ""}
                data-menu={theme === 'dark' ? 'dark' : 'light'}
                data-footer="simple"
            >
                {/* Top Navbar */}
                <TopNav />
                {/* Vertical Nav */}
                <Sidebar />
                {/* <VerticalNav /> */}
                <div className={classNames("hk-pg-wrapper", { "pb-0": appRoutes || twinRoutes })} >
                    {children}
                    {!appRoutes && !twinRoutes && <PageFooter />}

                </div>
            </div>
        </>
    )
}

export default MainLayout
