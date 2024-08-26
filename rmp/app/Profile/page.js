'use client';
import React, {useEffect, useState} from "react";
import { UserAuth } from "../context/UserAuth";
import Spinner from "../Component/Spinner";

const page = () => {
    const {user} = UserAuth()
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const checkAuthentification = async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            setLoading(false);
        };
        checkAuthentification();
    }, [user])

    return (
        <div className="p-4">
        {loading ? (
            <Spinner />
        ) : user ? (
            <p>Welcome, {user.displayName}. You are logged in the AI Rate My Professor App. </p>
        ) : (<p>Sign-In is required to view this page.</p>)}
        </div>
    )
}

export default page;