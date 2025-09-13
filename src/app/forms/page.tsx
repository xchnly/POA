"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const FormsPage: React.FC = () => {
    const router = useRouter();
    const [activeCategory, setActiveCategory] = useState("all");
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const formCategories = [
        { id: "all", name: "All Forms", icon: "📋" },
        { id: "attendance", name: "Attendance", icon: "⏰" },
        { id: "leave", name: "Leave & Permission", icon: "🏖️" },
        { id: "financial", name: "Financial", icon: "💰" },
        { id: "operation", name: "Operational", icon: "🏢" },
        { id: "hr", name: "HR", icon: "👥" },
    ];

    const formsList = [
        {
            id: 1,
            name: "Overtime Request",
            description: "Submit overtime details with time and tasks",
            category: "attendance",
            icon: "🌙",
            url: "/forms/overtime",
        },
        {
            id: 2,
            name: "Annual Leave",
            description: "Submit annual leave request for a specific period",
            category: "leave",
            icon: "📅",
            url: "/forms/cuti",
        },
        {
            id: 3,
            name: "Purchase Order",
            description: "Request for purchasing goods or services",
            category: "financial",
            icon: "🛒",
            url: "/forms/purchase",
        },
        {
            id: 4,
            name: "Labor Request",
            description: "Request for additional labor",
            category: "hr",
            icon: "👷",
            url: "/forms/labor",
        },
        {
            id: 5,
            name: "Permission to Leave",
            description: "Permission to leave the office during work hours",
            category: "attendance",
            icon: "🚪",
            url: "/forms/keluar",
        },
        {
            id: 6,
            name: "Missed Punch",
            description: "Report if you forgot to check-in or check-out",
            category: "attendance",
            icon: "🕗",
            url: "/forms/missedpunch",
        },
        {
            id: 7,
            name: "Sick Leave",
            description: "Submit sick leave request with attachments",
            category: "leave",
            icon: "❤️",
            url: "/forms/sakit",
        },
        {
            id: 8,
            name: "Advance Payment",
            description: "Reimbursement submission",
            category: "financial",
            icon: "💳",
            url: "/forms/payment",
        },
        {
            id: 9,
            name: "Resign Request",
            description: "Resignation submission",
            category: "hr",
            icon: "👋",
            url: "/forms/resign",
        },
    ];

    const filteredForms = activeCategory === "all"
        ? formsList
        : formsList.filter(form => form.category === activeCategory);

    const handleSidebarToggle = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
            {/* CSS for placeholder and input text */}
            <style jsx>{`
                /* Slightly faded placeholder */
                input::placeholder {
                    color: #9ca3af; /* Medium gray */
                    font-weight: 400;
                    opacity: 0.8;
                }

                /* Darker input text when typed */
                input:not(:placeholder-shown) {
                    color: #1f2937; /* Almost black */
                    font-weight: 500;
                }
            `}</style>
            
            {/* Sidebar - Mobile View */}
            <div className={`fixed inset-y-0 left-0 z-50 md:hidden bg-white shadow-lg w-64 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}>
                <div className="p-4 border-b border-green-100 flex justify-end">
                    <button onClick={handleSidebarToggle} className="text-gray-500 hover:text-gray-700 focus:outline-none">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div className="p-4 border-b border-green-100 text-center">
                    <div className="flex items-center justify-center mb-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] rounded-lg flex items-center justify-center shadow-md">
                            <span className="text-white font-bold text-xl">POA</span>
                        </div>
                    </div>
                    <h1 className="text-lg font-bold text-center text-gray-800">Prestova One Approval</h1>
                </div>
                <nav className="p-4">
                    <ul className="space-y-2">
                        <li>
                            <Link href="/dashboard" onClick={handleSidebarToggle} className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                </svg>
                                Back to Dashboard
                            </Link>
                        </li>
                    </ul>
                    <div className="mt-6">
                        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Form Categories</h2>
                        <ul className="space-y-1">
                            {formCategories.map(category => (
                                <li key={category.id}>
                                    <button
                                        onClick={() => { setActiveCategory(category.id); handleSidebarToggle(); }}
                                        className={`w-full flex items-center p-2 rounded-lg text-left transition ${activeCategory === category.id ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-700 hover:bg-green-50 hover:text-green-700'}`}
                                    >
                                        <span className="mr-3 text-lg">{category.icon}</span>
                                        {category.name}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </nav>
            </div>

            {/* Sidebar - Desktop View */}
            <div className="hidden md:block w-64 bg-white shadow-lg">
                <div className="p-4 border-b border-green-100">
                    <div className="flex items-center justify-center mb-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] rounded-lg flex items-center justify-center shadow-md">
                            <span className="text-white font-bold text-xl">POA</span>
                        </div>
                    </div>
                    <h1 className="text-lg font-bold text-center text-gray-800">Prestova One Approval</h1>
                </div>

                <nav className="p-4">
                    <div className="mb-2">
                        <Link href="/dashboard" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition mb-4">
                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Dashboard
                        </Link>
                    </div>

                    <div className="mb-6">
                        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Form Categories</h2>
                        <ul className="space-y-1">
                            {formCategories.map(category => (
                                <li key={category.id}>
                                    <button
                                        onClick={() => setActiveCategory(category.id)}
                                        className={`w-full flex items-center p-2 rounded-lg text-left transition ${activeCategory === category.id ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-700 hover:bg-green-50 hover:text-green-700'}`}
                                    >
                                        <span className="mr-3 text-lg">{category.icon}</span>
                                        {category.name}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                {/* Header */}
                <header className="bg-white shadow-sm border-b border-green-100">
                    <div className="flex items-center justify-between p-4">
                        <div className="md:hidden">
                            <button onClick={handleSidebarToggle} className="text-gray-500 hover:text-gray-700 focus:outline-none">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
                                </svg>
                            </button>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Submit a Form</h1>
                            <p className="text-sm text-gray-500">Choose the type of form you want to submit</p>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="p-4 md:p-6">
                    {/* Forms Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {filteredForms.map(form => (
                            <Link key={form.id} href={form.url}>
                                <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border border-green-100 hover:shadow-lg transition-shadow cursor-pointer h-full">
                                    <div className="flex items-start mb-4">
                                        <span className="text-3xl mr-4">{form.icon}</span>
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900">{form.name}</h3>
                                            <p className="text-sm text-gray-600 mt-1">{form.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center mt-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            {formCategories.find(cat => cat.id === form.category)?.name}
                                        </span>
                                        <span className="text-green-600 font-medium text-sm flex items-center">
                                            Submit
                                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* Empty State */}
                    {filteredForms.length === 0 && (
                        <div className="text-center py-12">
                            <div className="mx-auto w-24 h-24 flex items-center justify-center rounded-full bg-green-100 text-green-600 mb-4">
                                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No forms found</h3>
                            <p className="text-gray-500">Try selecting another category or using a different search keyword</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default FormsPage;