"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const AjukanFormPage: React.FC = () => {
    const router = useRouter();
    const [activeCategory, setActiveCategory] = useState("all");

    const formCategories = [
        { id: "all", name: "Semua Form", icon: "📋" },
        { id: "attendance", name: "Kehadiran", icon: "⏰" },
        { id: "leave", name: "Cuti & Izin", icon: "🏖️" },
        { id: "financial", name: "Keuangan", icon: "💰" },
        { id: "operation", name: "Operasional", icon: "🏢" },
        { id: "hr", name: "SDM", icon: "👥" },
    ];

    const formsList = [
        {
            id: 1,
            name: "Overtime Request",
            description: "Ajukan lembur dengan detail waktu dan tugas",
            category: "attendance",
            icon: "🌙",
            url: "/forms/overtime",
        },
        {
            id: 2,
            name: "Cuti Tahunan",
            description: "Ajukan cuti tahunan dengan periode tertentu",
            category: "leave",
            icon: "📅",
            url: "/forms/cuti",
        },
        {
            id: 3,
            name: "Purchase Order",
            description: "Permintaan pembelian barang atau jasa",
            category: "financial",
            icon: "🛒",
            url: "/forms/purchase",
        },
        {
            id: 4,
            name: "Labor Request",
            description: "Permintaan tenaga kerja tambahan",
            category: "hr",
            icon: "👷",
            url: "/forms/labor",
        },
        {
            id: 5,
            name: "Surat Izin Keluar",
            description: "Izin keluar kantor selama jam kerja",
            category: "attendance",
            icon: "🚪",
            url: "/forms/keluar",
        },
        {
            id: 6,
            name: "Missed Punch",
            description: "Lapor jika lupa absen masuk atau pulang",
            category: "attendance",
            icon: "🕗",
            url: "/forms/missedpunch",
        },
        {
            id: 7,
            name: "Cuti Sakit",
            description: "Ajukan cuti karena sakit dengan lampiran",
            category: "leave",
            icon: "❤️",
            url: "/forms/sakit",
        },
        {
            id: 8,
            name: "Advance Payment",
            description: "Pengajuan Reimburse",
            category: "financial",
            icon: "💳",
            url: "/forms/payment",
        },
        {
            id: 9,
            name: "Resign Request",
            description: "Pengajuan pengunduran diri",
            category: "hr",
            icon: "👋",
            url: "/forms/resign",
        },
    ];

    const filteredForms = activeCategory === "all"
        ? formsList
        : formsList.filter(form => form.category === activeCategory);

    return (
        <div className="min-h-screen flex bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
            {/* CSS untuk mengatur placeholder dan input text */}
            <style jsx>{`
        /* Placeholder yang sedikit pudar */
        input::placeholder {
          color: #9ca3af; /* Abu-abu medium */
          font-weight: 400;
          opacity: 0.8;
        }
        
        /* Teks input yang lebih gelap/terang ketika diketik */
        input:not(:placeholder-shown) {
          color: #1f2937; /* Hampir hitam */
          font-weight: 500;
        }
        
        /* Untuk browser tertentu */
        input:-ms-input-placeholder {
          color: #9ca3af;
          font-weight: 400;
        }
        
        input::-ms-input-placeholder {
          color: #9ca3af;
          font-weight: 400;
        }
      `}</style>
            {/* Sidebar */}
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
                    <div className="mb-2">
                        <Link href="/dashboard" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition mb-4">
                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                            </svg>
                            Kembali ke Dashboard
                        </Link>
                    </div>

                    <div className="mb-6">
                        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Kategori Form</h2>
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
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Ajukan Form</h1>
                            <p className="text-sm text-gray-500">Pilih jenis form yang ingin diajukan</p>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="p-6">
                    {/* Search Box
                    <div className="mb-6">
                        <div className="relative max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Cari form..."
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                            />
                        </div>
                    </div> */}

                    {/* Forms Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredForms.map(form => (
                            <Link key={form.id} href={form.url}>
                                <div className="bg-white rounded-xl shadow-md p-6 border border-green-100 hover:shadow-lg transition-shadow cursor-pointer h-full">
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
                                            Ajukan
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
                            <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada form ditemukan</h3>
                            <p className="text-gray-500">Coba pilih kategori lain atau gunakan kata kunci pencarian berbeda</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default AjukanFormPage;