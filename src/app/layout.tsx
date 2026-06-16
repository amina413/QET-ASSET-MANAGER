
import React from "react";
import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { ToastProvider } from "@/frontend/components/Toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
    title: "QET ASSET MANAGER",
    description: "High-precision asset tracking and depreciation management for Quantum Edge Technologies Ltd.",
    icons: {
        icon: '/favicon.svg',
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.variable} ${outfit.variable} font-sans antialiased text-slate-900 bg-slate-50`} suppressHydrationWarning>
                <ToastProvider>{children}</ToastProvider>
            </body>
        </html>
    );
}
