import React, { useContext } from 'react';
import { Accordion, AccordionContext, Badge, Button, Card, ListGroup, Nav, useAccordionButton } from 'react-bootstrap';
import SimpleBar from 'simplebar-react';
import SidebarHeader from '../SidebarHeader';
import classNames from 'classnames';
import Link from 'next/link';
import { DashboardMenu } from './MenuList';
import { usePathname } from 'next/navigation';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';

const VerticalNav = () => {

    const { dispatch } = useGlobalStateContext();
    const pathname = usePathname();

    // 1st collapse menu like chat*
    const CustomToggle = ({ children, eventKey, links, parentPath }) => {
        const { activeEventKey } = useContext(AccordionContext);
        const handleAccordion = useAccordionButton(eventKey, () =>
            console.log('totally custom!')
        );
        const decoratedOnClick = (e) => {
            e.preventDefault();
            handleAccordion();

        }
        const isCurrentEventKey = activeEventKey === eventKey;
        return (
            <Nav.Item className={pathname.startsWith(parentPath) ? 'active' : ''}>
                <Link
                    href="#"
                    className="nav-link "
                    onClick={decoratedOnClick}
                    data-bs-toggle="collapse"
                    data-bs-target="#navDashboard"
                    aria-expanded={isCurrentEventKey ? true : false}
                    aria-controls="navDashboard">
                    {children}
                </Link>
            </Nav.Item>
        );
    };

    //second level menu
    const CustomToggleLevel2 = ({ children, eventKey }) => {
        const { activeEventKey } = useContext(AccordionContext);
        const handleAccordion = useAccordionButton(eventKey, () =>
            console.log('totally custom!')
        );
        const decoratedOnClick = (e) => {
            e.preventDefault();
            handleAccordion();

        }
        const isCurrentEventKey = activeEventKey === eventKey;
        return (
            (<Link
                href="#"
                className="nav-link "
                onClick={decoratedOnClick}
                data-bs-toggle="collapse"
                data-bs-target="#navDashboard"
                aria-expanded={isCurrentEventKey ? true : false}
                aria-controls="navDashboard">
                {children}
            </Link>)
        );
    };


    //Menu content
    const generateLink = (item) => {
        return (
            (<Link
                // onClick={handleMenuClick}
                href={item.link}
                className={`nav-link ${pathname === item.link ? 'active' : ''
                    }`}
            >
                <span className="nav-link-text">{item.name}</span>
            </Link>)
        );
    };

    return (
        <>
            <div className="hk-menu">
                {/* Brand */}
                <SidebarHeader />
                {/* Main Menu */}
                <SimpleBar className="nicescroll-bar">
                    <div className="menu-content-wrap">
                        <div className="menu-group">
                            <Accordion defaultActiveKey="0" as="ul" className="navbar-nav flex-column">
                                {DashboardMenu.map((menu, index) => (
                                    <React.Fragment key={index}>
                                        {
                                            menu.grouptitle
                                                ?
                                                <React.Fragment>
                                                    <div className="menu-gap" />
                                                    <div className="nav-header">
                                                        <span>{menu.title}</span>
                                                    </div>
                                                </React.Fragment>
                                                :
                                                <React.Fragment>
                                                    {
                                                        menu.children
                                                            ?
                                                            <React.Fragment >
                                                                {/*1st collapse menu like chat*/}
                                                                <CustomToggle eventKey={index} icon={menu.icon} links={menu.link} parentPath={menu.path}>
                                                                    <span className={classNames("nav-icon-wrap", { "position-relative": menu.iconBadge })}>
                                                                        {menu.iconBadge && menu.iconBadge}
                                                                        <span className="svg-icon">
                                                                            {menu.icon}
                                                                        </span>
                                                                    </span>
                                                                    <span className={classNames("nav-link-text", { "position-relative": menu.badgeIndicator })} >
                                                                        {menu.title}
                                                                        {menu.badgeIndicator && menu.badgeIndicator}
                                                                    </span>
                                                                    {menu.badge && menu.badge}
                                                                </CustomToggle>
                                                                <Accordion.Collapse eventKey={index} as="li" bsPrefix="nav-item" className='nav-children'>
                                                                    <ListGroup as="ul" className="nav flex-column">
                                                                        {menu.children.map((menuLevel1Item, menuLevel1Index) => (
                                                                            <React.Fragment key={menuLevel1Index}>
                                                                                {
                                                                                    menuLevel1Item.children
                                                                                        ?
                                                                                        <ListGroup.Item as="li" bsPrefix="nav-item" >
                                                                                            {/* first level menu started  */}
                                                                                            <Accordion defaultActiveKey="0" className="nav flex-column">
                                                                                                <CustomToggleLevel2 eventKey={menuLevel1Index}>
                                                                                                    <span className="nav-link-text">
                                                                                                        {menuLevel1Item.title}
                                                                                                    </span>
                                                                                                </CustomToggleLevel2>
                                                                                                <Accordion.Collapse eventKey={menuLevel1Index} bsPrefix="nav-item" className='nav-children'>
                                                                                                    <ListGroup as="ul" bsPrefix="" className="nav flex-column">
                                                                                                        {/* second level menu started  */}
                                                                                                        {menuLevel1Item.children.map((menuLevel2Item, menuLevel2Index) => (
                                                                                                            <ListGroup.Item key={menuLevel2Index} as="li" bsPrefix="nav-item">
                                                                                                                {generateLink(menuLevel2Item)}
                                                                                                            </ListGroup.Item>
                                                                                                        ))}
                                                                                                    </ListGroup>
                                                                                                </Accordion.Collapse>
                                                                                            </Accordion>
                                                                                        </ListGroup.Item>
                                                                                        :
                                                                                        <ListGroup.Item as="li" bsPrefix="nav-item">
                                                                                            {/* first level menu items */}
                                                                                            {generateLink(menuLevel1Item)}
                                                                                            {/* end of first level menu items */}
                                                                                        </ListGroup.Item>
                                                                                }
                                                                            </React.Fragment>
                                                                        )
                                                                        )}
                                                                    </ListGroup>
                                                                </Accordion.Collapse>

                                                            </React.Fragment>
                                                            :
                                                            <Card bsPrefix="nav-item" className={pathname === menu.link ? 'active' : ''}>
                                                                <Link href={menu.link} target={menu?.target} className={`nav-link`}>
                                                                    <span className="nav-icon-wrap">
                                                                        <span className="svg-icon">
                                                                            {menu.icon}
                                                                        </span>
                                                                    </span>
                                                                    <span className="nav-link-text">{menu.title}</span>
                                                                    {menu.badge && menu.badge}
                                                                </Link>
                                                            </Card>
                                                    }
                                                </React.Fragment>
                                        }
                                    </React.Fragment>
                                )
                                )}
                            </Accordion>
                        </div>
                        <div className="menu-gap" />
                        <Card bg="orange-light-5" className="callout card-flush  text-center w-220p mx-auto">
                            <Card.Body>
                                <h5 className="h5">Quickly Build Applications</h5>
                                <Card.Text className="p-sm">Exclusively for webapps Based on Bootstrap</Card.Text>
                                <Button variant="primary" href="https://nubra-ui-react.netlify.app/" target="_blank" rel="noreferrer" className="btn-block">Go Nubra-UI</Button>
                            </Card.Body>
                        </Card>
                    </div>
                </SimpleBar>
                {/* /Main Menu */}
            </div >
            <div onClick={() => dispatch({ type: 'sidebar_toggle' })} className="hk-menu-backdrop" />
        </>
    )
}



export default VerticalNav;