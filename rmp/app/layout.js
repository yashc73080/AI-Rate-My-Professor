'use client'
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "./Component/navbar";
import { UserAuthProvider } from "./context/UserAuth";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "AI Rate My Professor",
  description: "AI Website to find the best professors",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <UserAuthProvider>
        <Navbar />
        {children}
        </UserAuthProvider>
      </body>
    </html>
  );
}
