import React from "react";
import Image from 'next/image';
import spinner from './spinner.gif';

const Spinner = () => {
    return (
        <div className="w-full h-screen flex items-center justify-center">
            <Image src={spinner} alt="Loading..."/>
        </div>
    )
}

export default Spinner;