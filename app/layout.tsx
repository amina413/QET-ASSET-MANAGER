
import React from "react";
import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
    title: "ABDC Asset Management System",
    description: "High-precision asset tracking and depreciation management for Abdulkadeer and Co.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${inter.variable} ${outfit.variable} font-sans antialiased text-slate-900 bg-slate-50`}>
                {children}
                <script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" async />
            </body>
        </html>
    );
}
