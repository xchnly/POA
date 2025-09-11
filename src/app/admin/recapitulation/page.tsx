"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// Interfaces
interface UserData {
    uid: string;
    nama: string;
    role: string;
}

const RecapitulationLandingPage: React.FC = () => {
    const [user, setUser] = useState<UserData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
            if (authUser) {
                try {
                    const userDoc = await getDocs(
                        query(collection(db, "users"), where("uid", "==", authUser.uid))
                    );
                    if (!userDoc.empty) {
                        const userData = userDoc.docs[0].data() as UserData;
                        setUser(userData);
                        const allowedRoles = ["admin", "hrd", "manager", "general_manager"];
                        if (!allowedRoles.includes(userData.role)) {
                            router.push("/dashboard");
                        }
                    } else {
                        router.push("/");
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    router.push("/");
                }
            } else {
                router.push("/");
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
            {/* Sidebar - same as other pages */}
            <div className="w-64 bg-white shadow-lg">
                <div className="p-4 border-b border-green-100">
                    <div className="flex items-center justify-center mb-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] rounded-lg flex items-center justify-center shadow-md">
                            <span className="text-white font-bold text-xl">POA</span>
                        </div>
                    </div>
                    <h1 className="text-lg font-bold text-center text-gray-800">Prestova One Approval</h1>
                </div>

                <nav className="p-4">
                    <div className="mb-6">
                        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Main Menu</h2>
                        <ul className="space-y-2">
                            <li>
                                <Link href="/dashboard" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                    </svg>
                                    Dashboard
                                </Link>
                            </li>
                            <li>
                                <Link href="/forms" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Submit Form
                                </Link>
                            </li>
                            <li>
                                <Link href="/approvals" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    Approvals
                                </Link>
                            </li>
                            <li>
                                <Link href="/history" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    History
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {["admin", "hrd", "manager", "general_manager"].includes(user?.role) && (
                        <div className="mb-6">
                            <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">
                                Administration
                            </h2>
                            <ul className="space-y-2">
                                <li>
                                    <Link
                                        href="/admin/users"
                                        className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition"
                                    >
                                        <svg
                                            className="w-5 h-5 mr-3"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                                            />
                                        </svg>
                                        User Management
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href="/admin/recapitulation"
                                        className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium"
                                    >
                                        <svg
                                            className="w-5 h-5 mr-3"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M9 17v-2m3 2v-4m3 2v-6m2 12H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                            />
                                        </svg>
                                        Recapitulation
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href="/register"
                                        className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="w-5 h-5 mr-3">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
                                        </svg>
                                        Register
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    )}
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                {/* Header */}
                <header className="bg-white shadow-sm border-b border-green-100">
                    <div className="flex items-center justify-between p-4">
                        <h1 className="text-2xl font-bold text-gray-900">Recapitulation</h1>
                        <div className="flex items-center space-x-4">
                            <div className="text-right">
                                <p className="font-medium text-gray-900">Hello, {user?.nama}</p>
                                <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Recapitulation Menu */}
                <main className="p-6">
                    <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            Select Form Type to View Recapitulation
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                            {/* Overtime */}
                            <Link
                                href="/admin/recapitulation/overtime"
                                className="block p-6 rounded-lg shadow-md bg-green-50 border border-green-200 hover:bg-green-100 transition-all duration-200"
                            >
                                <div className="flex items-center mb-2">
                                    <div className="bg-green-200 rounded-full p-2 mr-3">
                                        <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800">Overtime</h3>
                                </div>
                                <p className="text-sm text-gray-600">View detailed reports on overtime requests.</p>
                            </Link>

                            {/* Leave */}
                            <Link
                                href="/admin/recapitulation/leave"
                                className="block p-6 rounded-lg shadow-md bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-all duration-200"
                            >
                                <div className="flex items-center mb-2">
                                    <div className="bg-blue-200 rounded-full p-2 mr-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-6">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
                                        </svg>

                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800">Leave</h3>
                                </div>
                                <p className="text-sm text-gray-600">Analyze leave request data by date and employee.</p>
                            </Link>

                            {/* Labor */}
                            <Link
                                href="/admin/recapitulation/labor"
                                className="block p-6 rounded-lg shadow-md bg-teal-50 border border-teal-200 hover:bg-teal-100 transition-all duration-200"
                            >
                                <div className="flex items-center mb-2">
                                    <div className="bg-teal-200 rounded-full p-2 mr-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-6">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800">Labor</h3>
                                </div>
                                <p className="text-sm text-gray-600">View and analyze labor data including working hours and productivity.</p>
                            </Link>

                            {/* Purchase */}
                            <Link
                                href="/admin/recapitulation/purchase"
                                className="block p-6 rounded-lg shadow-md bg-purple-50 border border-purple-200 hover:bg-purple-100 transition-all duration-200"
                            >
                                <div className="flex items-center mb-2">
                                    <div className="bg-purple-200 rounded-full p-2 mr-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-6">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800">Purchase</h3>
                                </div>
                                <p className="text-sm text-gray-600">Track purchase requests and approvals.</p>
                            </Link>

                            {/* Missed Punch */}
                            <Link
                                href="/admin/recapitulation/missedpunch"
                                className="block p-6 rounded-lg shadow-md bg-red-50 border border-red-200 hover:bg-red-100 transition-all duration-200"
                            >
                                <div className="flex items-center mb-2">
                                    <div className="bg-red-200 rounded-full p-2 mr-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-6">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M7.864 4.243A7.5 7.5 0 0 1 19.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 0 0 4.5 10.5a7.464 7.464 0 0 1-1.15 3.993m1.989 3.559A11.209 11.209 0 0 0 8.25 10.5a3.75 3.75 0 1 1 7.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 0 1-3.6 9.75m6.633-4.596a18.666 18.666 0 0 1-2.485 5.33" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800">Missed Punch</h3>
                                </div>
                                <p className="text-sm text-gray-600">Monitor missed attendance punch records.</p>
                            </Link>

                            {/* Reimburse */}
                            <Link
                                href="/admin/recapitulation/reimburse"
                                className="block p-6 rounded-lg shadow-md bg-yellow-50 border border-yellow-200 hover:bg-yellow-100 transition-all duration-200"
                            >
                                <div className="flex items-center mb-2">
                                    <div className="bg-yellow-200 rounded-full p-2 mr-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-6">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800">Reimburse</h3>
                                </div>
                                <p className="text-sm text-gray-600">Review and analyze reimbursement requests.</p>
                            </Link>

                            {/* Resign */}
                            <Link
                                href="/admin/recapitulation/resign"
                                className="block p-6 rounded-lg shadow-md bg-pink-50 border border-pink-200 hover:bg-pink-100 transition-all duration-200"
                            >
                                <div className="flex items-center mb-2">
                                    <div className="bg-pink-200 rounded-full p-2 mr-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-6">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.182 16.318A4.486 4.486 0 0 0 12.016 15a4.486 4.486 0 0 0-3.198 1.318M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
                                        </svg>

                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800">Resign</h3>
                                </div>
                                <p className="text-sm text-gray-600">View resignation records and approval status.</p>
                            </Link>

                            {/* Out of Duty */}
                            <Link
                                href="/admin/recapitulation/outofduty"
                                className="block p-6 rounded-lg shadow-md bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-all duration-200"
                            >
                                <div className="flex items-center mb-2">
                                    <div className="bg-indigo-200 rounded-full p-2 mr-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-6">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800">Out of Duty</h3>
                                </div>
                                <p className="text-sm text-gray-600">Analyze employee duty-out / izin keluar records.</p>
                            </Link>

                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default RecapitulationLandingPage;