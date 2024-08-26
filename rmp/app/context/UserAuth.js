import { useContext, createContext, useState, useEffect } from "react";
import {signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut} from 'firebase/auth'
import { auth } from "../firebase";

const UserAuth = createContext()


export const UserAuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)

    const googleSignIn = () => {
        const provider = new GoogleAuthProvider()
        signInWithPopup(auth, provider)
    };

    const logOut = () => {
        signOut(auth)

    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
                setUser(currentUser)
        });
        return () => unsubscribe()
    }, [user]);

    return (
    <UserAuth.Provider value={{user, googleSignIn, logOut}}>
        {children}
    </UserAuth.Provider>
);
};

export const useUserAuth = () => {
    return useContext(UserAuth)
}