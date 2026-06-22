import { Dropdown } from 'react-bootstrap';
import styled, { keyframes } from 'styled-components';

const HkDropdown = ({ children, Title, variant }) => {

    const menuAnimation = keyframes`
  from {
    opacity: 0;
    transform: translateY(50px);
  }
  to {
    opacity: 1;
    transform: translateY(40px);
  }
`;

    const AnimatedDropdownMenu = styled(Dropdown.Menu)`
        animation: ${menuAnimation} 0.3s ease-in-out;
    `

    return (
        <Dropdown autoClose="outside">
            <Dropdown.Toggle variant={variant}>
                {Title}
            </Dropdown.Toggle>
            <AnimatedDropdownMenu>
                {children}
            </AnimatedDropdownMenu>
        </Dropdown>
    )
}


const Item = ({ children, active, as, disabled, eventKey, href, bsPrefix }) => <Dropdown.Item href={href} active={active} as={as} disabled={disabled} eventKey={eventKey} bsPrefix={bsPrefix}>{children}</Dropdown.Item>
HkDropdown.Item = Item;

const Divider = ({ as, bsPrefix }) => <Dropdown.Divider as={as} bsPrefix={bsPrefix} />
HkDropdown.Divider = Divider;

export default HkDropdown
