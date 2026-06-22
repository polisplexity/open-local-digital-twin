import React from 'react'

const useStarred = (data) => {
    const [favData, setFavData] = React.useState(data);

    const handleStared = (id) => {
        setFavData((prevData) => prevData.map((row, index) => index === id ? { ...row, starred: !row.starred } : row))

    }


    return { handleStared, favData }
}

export default useStarred
