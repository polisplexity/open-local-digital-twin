'use client'
import Image from 'next/image'
import React, { useState } from 'react'
// import { Image } from 'react-bootstrap';



const HkAvatarUploader = ({ defaultImg }) => {
    const [imageSrc, setImageSrc] = useState(defaultImg);

    const onUpload = (e) => {
        e.preventDefault();
        setImageSrc(URL.createObjectURL(e.target.files[0]));
    }

    return (
        <>
            <label htmlFor="photo-upload" className="avtuploder-circle">
                <div className='avtuploder-wrapper'>
                    <Image src={imageSrc} alt='demo Img' className='avtuploder-preview' width={115} height={115} />
                </div>
                <input id="photo-upload" type="file" onChange={onUpload} className="d-none" />
            </label>
        </>
    )
}

export default HkAvatarUploader
