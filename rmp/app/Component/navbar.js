import React, {useEffect, useState} from "react";
import { Link } from 'next/link';
import { UserAuth } from "../context/UserAuth";

const Navbar = () => {
    const { user, googleSignIn, logOut } = UserAuth()
    const [loading, setLoading] = useState(true)
const handleSignIn = async () => {
    try {
        await googleSignIn()
    } catch (error) {
        console.log(error)
    }
};

const handleSignOut = async () => {
    try {
        await logOut()
    } catch (error) {
        console.log(error)
    }
};

useEffect(() => {
    const checkAuthentification = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        setLoading(false);
    };
    checkAuthentification();
}, [user])

    return (
        <div className="h-20 w-full border-b-2 flex items-center justify-between p-2">
            <ul className="flex">
                <li className="p-2 cursor-point">
                    <link href="/">Home</link>
                </li>

                {!user ? null : (
                <li className="p-2 cursor-point">
                <link href="/profile">Profile</link>
            </li>
                )}
                <li className="p-2 cursor-point">
                    <link href="/About">About</link>
                </li>
            </ul>
            {loading ?  null : !user ? (            <ul className="flex">
                <li onClick={handleSignIn} className="p-2 cursor-point">
                    Login
                </li>
                <li onClick={handleSignIn} className="p-2 cursor-point">
                    Sign Up
                </li>
            </ul>) : (
            <div>
                <p>Welcome, {user.displayName}</p>
                <p className="cursor-pointer" onClick={handleSignOut}>Sign Out</p>
            </div>                
            )}

        </div>
    )
}

export default Navbar;