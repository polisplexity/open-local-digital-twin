import classNames from 'classnames'
import { Badge } from 'react-bootstrap'

const HkBadge = ({ children, as, bg, pill, outline, indicator, text, bsPrefix, className, size, soft, ...rest }) => {
    return (
        <Badge
            as={as}
            bg={!soft ? bg : `bg-${bg}-light-5`}
            pill={pill}
            text={text}
            bsPrefix={bsPrefix}
            {...rest}
            className={classNames(className, { "badge-sm": size === "sm" }, { "badge-outline": outline }, (soft ? `badge-soft-${bg}` : ""), { "badge-indicator": indicator })}
        >
            {children}
        </Badge>
    )
}

export default HkBadge
