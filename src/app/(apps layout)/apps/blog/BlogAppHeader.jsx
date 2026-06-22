import Link from 'next/link';
import classNames from 'classnames';
import { Button, Dropdown } from 'react-bootstrap';
import { ChevronDown, ChevronUp, ExternalLink, Flag, Grid, MoreVertical, RefreshCw, Settings, Slash, Tag, Users } from 'react-feather';
import { usePathname } from 'next/navigation';
import { useGlobalStateContext } from '@/context/GolobalStateProvider';
import HkTooltip from '@/components/@hk-tooltip/HkTooltip';

const BlogAppHeader = ({ toggleSidebar, showSidebar }) => {

    const { states, dispatch } = useGlobalStateContext();
    const pathName = usePathname();
    const postsRoute = pathName.match('/apps/blog/posts');
    const addNewPostRoute = pathName.match('/apps/blog/add-new-post');
    const postDetail = pathName.match('/apps/blog/post-detail');

    return (
        <header className="blog-header">
            <div className="d-flex align-items-center">
                <Link href="#" className="blogapp-title link-dark">
                    <h1>
                        {postsRoute && "Posts"}
                        {addNewPostRoute && "Add New Post"}
                        {postDetail && "Edit Post"}
                    </h1>
                </Link>
                {postDetail && <Link href="/apps/blog/add-new-post" className="btn btn-soft-primary ms-3">Add new</Link>}
            </div>
            <div className="blog-options-wrap">
                {
                    postsRoute && <>
                        <Dropdown as="a" >
                            <Dropdown.Toggle variant="outline-light" className="d-sm-inline-block d-none">Manage</Dropdown.Toggle>
                            <Dropdown.Menu align="end" >
                                <Dropdown.Item>
                                    <span className="feather-icon dropdown-icon">
                                        <Flag />
                                    </span>
                                    <span>Manage Post</span>
                                </Dropdown.Item>
                                <Dropdown.Item>
                                    <span className="feather-icon dropdown-icon">
                                        <Grid />
                                    </span>
                                    <span>Manage Categories</span>
                                </Dropdown.Item>
                                <Dropdown.Item>
                                    <span className="feather-icon dropdown-icon">
                                        <Tag />
                                    </span>
                                    <span>Manage Tags</span>
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                        <Button as="a" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover no-caret flex-shrink-0 d-lg-inline-block d-none" href="#">
                            <HkTooltip placement={states.layoutState.topNavCollapse ? "bottom" : "top"} title="Refresh">
                                <span className="icon">
                                    <span className="feather-icon">
                                        <RefreshCw />
                                    </span>
                                </span>
                            </HkTooltip>
                        </Button>
                        <div className="v-separator  d-lg-inline-block d-none" />
                    </>
                }
                <Dropdown>
                    <Dropdown.Toggle as="a" className="btn btn-icon btn-flush-dark btn-rounded flush-soft-hover no-caret flex-shrink-0  ms-0">
                        <span className="icon">
                            <span className="feather-icon">
                                <MoreVertical />
                            </span>
                        </span>
                    </Dropdown.Toggle>
                    <Dropdown.Menu align="end">
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Users />
                            </span>
                            <span>Posts</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Settings />
                            </span>
                            <span>Settings</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <Slash />
                            </span>
                            <span>Block Content</span>
                        </Dropdown.Item>
                        <Dropdown.Item>
                            <span className="feather-icon dropdown-icon">
                                <ExternalLink />
                            </span>
                            <span>Feedback</span>
                        </Dropdown.Item>
                    </Dropdown.Menu>
                </Dropdown>
                <Button as="a" variant="flush-dark" className="btn-icon btn-rounded flush-soft-hover hk-navbar-togglable d-sm-inline-block d-none" onClick={() => dispatch({ type: "top_nav_toggle" })} >
                    <HkTooltip placement={states.layoutState.topNavCollapse ? "bottom" : "top"} title="Collapse" >
                        <span className="icon">
                            <span className="feather-icon">
                                {
                                    states.layoutState.topNavCollapse ? <ChevronDown /> : <ChevronUp />
                                }
                            </span>
                        </span>
                    </HkTooltip>
                </Button>
            </div>
            <div className={classNames("hk-sidebar-togglable", { "active": !showSidebar })} onClick={toggleSidebar} />
        </header>
    )
}

export default BlogAppHeader;