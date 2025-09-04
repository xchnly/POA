"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, collection, getDocs, query, where } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";

interface Employee {
    id: string;
    nik: string;
    nama: string;
    dept: string;
    jabatan: string;
}

interface OvertimeEntry {
    id: string;
    employee: Employee;
    tanggal: string;
    jamMulai: string;
    jamSelesai: string;
    breakTime: string;
    totalJam: number;
}

const OvertimeRequestPage: React.FC = () => {
    const router = useRouter();
    const [user] = useAuthState(auth);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [overtimeEntries, setOvertimeEntries] = useState<OvertimeEntry[]>([]);
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [editingEntry, setEditingEntry] = useState<OvertimeEntry | null>(null);

    const [formData, setFormData] = useState({
        jenisPengajuan: "diri-sendiri",
        deptFilter: "",
        alasan: "",
        kategori: "reguler",
    });

    const [defaultEntry, setDefaultEntry] = useState({
        tanggal: new Date().toISOString().split('T')[0],
        jamMulai: "17:00",
        jamSelesai: "20:00",
        breakTime: "0",
        totalJam: 3
    });

    // Load employees data
    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "employees"));
                const employeesData: Employee[] = [];
                const deptSet = new Set<string>();

                querySnapshot.forEach((doc) => {
                    const data = doc.data() as Employee;
                    employeesData.push({ ...data, id: doc.id });
                    deptSet.add(data.dept);
                });

                setEmployees(employeesData);
                setDepartments(Array.from(deptSet).sort());
            } catch (error) {
                console.error("Error fetching employees:", error);
            }
        };

        fetchEmployees();
    }, []);

    // Filter employees by department
    useEffect(() => {
        if (formData.deptFilter) {
            const filtered = employees.filter(emp => emp.dept === formData.deptFilter);
            setFilteredEmployees(filtered);
        } else {
            setFilteredEmployees([]);
        }
    }, [formData.deptFilter, employees]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDefaultEntryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setDefaultEntry(prev => {
            const newEntry = { ...prev, [name]: value };
            
            // Recalculate total hours if time fields changed
            if (name === "jamMulai" || name === "jamSelesai" || name === "breakTime") {
                const totalJam = calculateTotalHours(
                    name === "jamMulai" ? value : prev.jamMulai,
                    name === "jamSelesai" ? value : prev.jamSelesai,
                    name === "breakTime" ? value : prev.breakTime
                );
                return { ...newEntry, totalJam };
            }
            
            return newEntry;
        });
    };

    const handleEntryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, entryId: string) => {
        const { name, value } = e.target;
        
        setOvertimeEntries(prev => prev.map(entry => {
            if (entry.id === entryId) {
                const updatedEntry = { ...entry, [name]: value };
                
                // Recalculate total hours if time fields changed
                if (name === "jamMulai" || name === "jamSelesai" || name === "breakTime") {
                    const totalJam = calculateTotalHours(
                        name === "jamMulai" ? value : entry.jamMulai,
                        name === "jamSelesai" ? value : entry.jamSelesai,
                        name === "breakTime" ? value : entry.breakTime
                    );
                    return { ...updatedEntry, totalJam };
                }
                
                return updatedEntry;
            }
            return entry;
        }));
    };

    const calculateTotalHours = (jamMulai: string, jamSelesai: string, breakTime: string): number => {
        if (jamMulai && jamSelesai) {
            const start = new Date(`2000-01-01T${jamMulai}`);
            const end = new Date(`2000-01-01T${jamSelesai}`);

            // Handle overnight overtime
            if (end <= start) {
                end.setDate(end.getDate() + 1);
            }

            const diffMs = end.getTime() - start.getTime();
            let diffHours = diffMs / (1000 * 60 * 60);

            // Subtract break time (converted from minutes to hours)
            const breakHours = parseInt(breakTime) / 60;
            diffHours = Math.max(0, diffHours - breakHours);

            // Round up to nearest 0.5 hour (30 minutes)
            return Math.ceil(diffHours * 2) / 2;
        }
        return 0;
    };

    const addOvertimeEntries = () => {
        if (selectedEmployees.length === 0) {
            alert("Pilih minimal satu karyawan terlebih dahulu!");
            return;
        }

        const newEntries = selectedEmployees
            .filter(empId => !overtimeEntries.some(entry => entry.employee.id === empId))
            .map(empId => {
                const emp = filteredEmployees.find(e => e.id === empId);
                return {
                    id: `entry-${Date.now()}-${empId}`,
                    employee: emp!,
                    tanggal: defaultEntry.tanggal,
                    jamMulai: defaultEntry.jamMulai,
                    jamSelesai: defaultEntry.jamSelesai,
                    breakTime: defaultEntry.breakTime,
                    totalJam: defaultEntry.totalJam
                };
            });

        if (newEntries.length === 0) {
            alert("Semua karyawan yang dipilih sudah ada di daftar!");
            return;
        }

        setOvertimeEntries(prev => [...prev, ...newEntries]);
        setSelectedEmployees([]);
    };

    const removeOvertimeEntry = (entryId: string) => {
        setOvertimeEntries(prev => prev.filter(entry => entry.id !== entryId));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (formData.jenisPengajuan === "untuk-anggota" && overtimeEntries.length === 0) {
            alert("Tambahkan minimal satu karyawan untuk diajukan overtime!");
            return;
        }

        setIsSubmitting(true);

        try {
            const formId = `overtime-${Date.now()}`;

            // Prepare overtime data
            const overtimeData = {
                id: formId,
                type: "overtime",
                jenisPengajuan: formData.jenisPengajuan,
                alasan: formData.alasan,
                kategori: formData.kategori,
                status: "draft",
                requesterUid: user.uid,
                requesterName: user.displayName || user.email,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            // Add entries based on jenis pengajuan
            if (formData.jenisPengajuan === "diri-sendiri") {
                // For self, use default entry data
                Object.assign(overtimeData, {
                    tanggal: defaultEntry.tanggal,
                    jamMulai: defaultEntry.jamMulai,
                    jamSelesai: defaultEntry.jamSelesai,
                    breakTime: parseInt(defaultEntry.breakTime),
                    totalJam: defaultEntry.totalJam,
                });
            } else {
                // For team members, add all entries
                Object.assign(overtimeData, {
                    entries: overtimeEntries.map(entry => ({
                        employee: {
                            id: entry.employee.id,
                            nik: entry.employee.nik,
                            nama: entry.employee.nama,
                            dept: entry.employee.dept
                        },
                        tanggal: entry.tanggal,
                        jamMulai: entry.jamMulai,
                        jamSelesai: entry.jamSelesai,
                        breakTime: parseInt(entry.breakTime),
                        totalJam: entry.totalJam
                    }))
                });
            }

            // Save to Firestore
            await setDoc(doc(db, "forms", formId), overtimeData);

            alert("Form overtime berhasil disimpan!");
            router.push("/dashboard");

        } catch (error) {
            console.error("Error submitting form:", error);
            alert("Terjadi kesalahan saat menyimpan form. Silakan coba lagi.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalAllHours = overtimeEntries.reduce((sum, entry) => sum + entry.totalJam, 0);

    return (
        <div className="min-h-screen flex bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
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
                        <Link href="/forms" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition mb-4">
                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                            </svg>
                            Kembali ke Daftar Form
                        </Link>
                    </div>

                    <div className="mb-6">
                        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Form Overtime</h2>
                        <ul className="space-y-1">
                            <li>
                                <div className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                                    <span className="mr-3">📝</span>
                                    Isi Form
                                </div>
                            </li>
                            <li>
                                <div className="flex items-center p-2 rounded-lg text-gray-500">
                                    <span className="mr-3">👁️</span>
                                    Preview
                                </div>
                            </li>
                            <li>
                                <div className="flex items-center p-2 rounded-lg text-gray-500">
                                    <span className="mr-3">✅</span>
                                    Submit
                                </div>
                            </li>
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
                            <h1 className="text-2xl font-bold text-gray-900">Form Overtime Request</h1>
                            <p className="text-sm text-gray-500">Ajukan lembur untuk diri sendiri atau anggota tim</p>
                        </div>
                        <div className="flex space-x-2">
                            <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition">
                                Simpan Draft
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="px-4 py-2 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] disabled:opacity-50 transition"
                            >
                                {isSubmitting ? "Mengajukan..." : "Ajukan Sekarang"}
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="p-6">
                    <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Jenis Pengajuan */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Jenis Pengajuan</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-green-50 transition">
                                        <input
                                            type="radio"
                                            name="jenisPengajuan"
                                            value="diri-sendiri"
                                            checked={formData.jenisPengajuan === "diri-sendiri"}
                                            onChange={handleChange}
                                            className="text-green-600 focus:ring-green-500"
                                        />
                                        <div className="ml-3">
                                            <span className="block text-sm font-medium text-gray-900">Untuk Diri Sendiri</span>
                                            <span className="block text-sm text-gray-500">Ajukan lembur untuk diri sendiri</span>
                                        </div>
                                    </label>

                                    <label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-green-50 transition">
                                        <input
                                            type="radio"
                                            name="jenisPengajuan"
                                            value="untuk-anggota"
                                            checked={formData.jenisPengajuan === "untuk-anggota"}
                                            onChange={handleChange}
                                            className="text-green-600 focus:ring-green-500"
                                        />
                                        <div className="ml-3">
                                            <span className="block text-sm font-medium text-gray-900">Untuk Anggota Tim</span>
                                            <span className="block text-sm text-gray-500">Ajukan lembur untuk anggota tim/department</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Form untuk Diri Sendiri */}
                            {formData.jenisPengajuan === "diri-sendiri" && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Detail Lembur</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Lembur</label>
                                            <input
                                                type="date"
                                                name="tanggal"
                                                value={defaultEntry.tanggal}
                                                onChange={handleDefaultEntryChange}
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Jam Mulai</label>
                                            <input
                                                type="time"
                                                name="jamMulai"
                                                value={defaultEntry.jamMulai}
                                                onChange={handleDefaultEntryChange}
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Jam Selesai</label>
                                            <input
                                                type="time"
                                                name="jamSelesai"
                                                value={defaultEntry.jamSelesai}
                                                onChange={handleDefaultEntryChange}
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Break Time</label>
                                            <select
                                                name="breakTime"
                                                value={defaultEntry.breakTime}
                                                onChange={handleDefaultEntryChange}
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                            >
                                                <option value="0">Tidak ada break</option>
                                                <option value="30">30 menit</option>
                                                <option value="60">60 menit (1 jam)</option>
                                                <option value="90">90 menit (1.5 jam)</option>
                                                <option value="120">120 menit (2 jam)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Total Jam Lembur</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={defaultEntry.totalJam.toFixed(1)}
                                                    readOnly
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                />
                                                <span className="absolute right-3 top-2.5 text-gray-500">Jam</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Kategori Lembur</label>
                                            <select
                                                name="kategori"
                                                value={formData.kategori}
                                                onChange={handleChange}
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                            >
                                                <option value="reguler">Lembur Reguler</option>
                                                <option value="weekend">Lembur Weekend</option>
                                                <option value="holiday">Lembur Hari Libur</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Form untuk Anggota Tim */}
                            {formData.jenisPengajuan === "untuk-anggota" && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Tambah Anggota Tim</h3>
                                    <div className="bg-gray-50 p-4 rounded-lg mb-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Filter Department</label>
                                                <select
                                                    name="deptFilter"
                                                    value={formData.deptFilter}
                                                    onChange={handleChange}
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                >
                                                    <option value="">Pilih Department</option>
                                                    {departments.map(dept => (
                                                        <option key={dept} value={dept}>{dept}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Pilih Karyawan
                                                </label>

                                                {/* Select All */}
                                                <div className="flex items-center mb-2">
                                                    <input
                                                        type="checkbox"
                                                        id="selectAll"
                                                        checked={selectedEmployees.length === filteredEmployees.length}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedEmployees(filteredEmployees.map((emp) => emp.id));
                                                            } else {
                                                                setSelectedEmployees([]);
                                                            }
                                                        }}
                                                        className="mr-2"
                                                    />
                                                    <label htmlFor="selectAll" className="text-sm font-medium text-gray-700">
                                                        Pilih Semua
                                                    </label>
                                                </div>

                                                <div className="max-h-60 overflow-y-auto border rounded-lg p-2">
                                                    {filteredEmployees.map((emp) => (
                                                        <div key={emp.id} className="flex items-center mb-1">
                                                            <input
                                                                type="checkbox"
                                                                id={`emp-${emp.id}`}
                                                                checked={selectedEmployees.includes(emp.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedEmployees([...selectedEmployees, emp.id]);
                                                                    } else {
                                                                        setSelectedEmployees(
                                                                            selectedEmployees.filter((id) => id !== emp.id)
                                                                        );
                                                                    }
                                                                }}
                                                                className="mr-2"
                                                            />
                                                            <label htmlFor={`emp-${emp.id}`} className="text-sm">
                                                                {emp.nik} - {emp.nama}
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Default</label>
                                                <input
                                                    type="date"
                                                    name="tanggal"
                                                    value={defaultEntry.tanggal}
                                                    onChange={handleDefaultEntryChange}
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Jam Mulai Default</label>
                                                <input
                                                    type="time"
                                                    name="jamMulai"
                                                    value={defaultEntry.jamMulai}
                                                    onChange={handleDefaultEntryChange}
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Jam Selesai Default</label>
                                                <input
                                                    type="time"
                                                    name="jamSelesai"
                                                    value={defaultEntry.jamSelesai}
                                                    onChange={handleDefaultEntryChange}
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Break Time Default</label>
                                                <select
                                                    name="breakTime"
                                                    value={defaultEntry.breakTime}
                                                    onChange={handleDefaultEntryChange}
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                >
                                                    <option value="0">Tidak ada break</option>
                                                    <option value="30">30 menit</option>
                                                    <option value="60">60 menit (1 jam)</option>
                                                    <option value="90">90 menit (1.5 jam)</option>
                                                    <option value="120">120 menit (2 jam)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Total Jam Default</label>
                                                <div className="flex">
                                                    <input
                                                        type="text"
                                                        value={defaultEntry.totalJam.toFixed(1)}
                                                        readOnly
                                                        className="flex-1 p-2.5 border border-gray-300 rounded-l-lg bg-gray-50 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                    />
                                                    <span className="bg-gray-200 px-3 flex items-center rounded-r-lg text-gray-500">Jam</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={addOvertimeEntries}
                                            disabled={selectedEmployees.length === 0}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                        >
                                            + Tambahkan {selectedEmployees.length > 0 ? `(${selectedEmployees.length} karyawan)` : ""}
                                        </button>
                                    </div>

                                    {/* Daftar Karyawan yang Sudah Ditambahkan */}
                                    {overtimeEntries.length > 0 && (
                                        <div>
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg font-semibold text-gray-900">Daftar Lembur Anggota Tim</h3>
                                                <div className="text-sm font-medium text-gray-700">
                                                    Total: {totalAllHours.toFixed(1)} jam
                                                </div>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full table-auto">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Nama</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">NIK</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Dept</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Tanggal</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Jam Mulai</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Jam Selesai</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Break</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Total</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Aksi</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200">
                                                        {overtimeEntries.map((entry) => (
                                                            <tr key={entry.id}>
                                                                <td className="px-4 py-2 text-sm">{entry.employee.nama}</td>
                                                                <td className="px-4 py-2 text-sm text-gray-600">{entry.employee.nik}</td>
                                                                <td className="px-4 py-2 text-sm text-gray-600">{entry.employee.dept}</td>
                                                                <td className="px-4 py-2 text-sm">
                                                                    <input
                                                                        type="date"
                                                                        name="tanggal"
                                                                        value={entry.tanggal}
                                                                        onChange={(e) => handleEntryChange(e, entry.id)}
                                                                        className="w-full p-1 border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-2 text-sm">
                                                                    <input
                                                                        type="time"
                                                                        name="jamMulai"
                                                                        value={entry.jamMulai}
                                                                        onChange={(e) => handleEntryChange(e, entry.id)}
                                                                        className="w-full p-1 border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-2 text-sm">
                                                                    <input
                                                                        type="time"
                                                                        name="jamSelesai"
                                                                        value={entry.jamSelesai}
                                                                        onChange={(e) => handleEntryChange(e, entry.id)}
                                                                        className="w-full p-1 border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-2 text-sm">
                                                                    <select
                                                                        name="breakTime"
                                                                        value={entry.breakTime}
                                                                        onChange={(e) => handleEntryChange(e, entry.id)}
                                                                        className="w-full p-1 border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
                                                                    >
                                                                        <option value="0">0m</option>
                                                                        <option value="30">30m</option>
                                                                        <option value="60">60m</option>
                                                                        <option value="90">90m</option>
                                                                        <option value="120">120m</option>
                                                                    </select>
                                                                </td>
                                                                <td className="px-4 py-2 text-sm font-medium">
                                                                    {entry.totalJam.toFixed(1)} jam
                                                                </td>
                                                                <td className="px-4 py-2 text-sm">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeOvertimeEntry(entry.id)}
                                                                        className="text-red-600 hover:text-red-800"
                                                                    >
                                                                        Hapus
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Alasan Lembur */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Alasan Lembur</label>
                                <textarea
                                    name="alasan"
                                    value={formData.alasan}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="Jelaskan alasan mengapa perlu melakukan lembur"
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                    required
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                                <Link
                                    href="/forms"
                                    className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                                >
                                    Batal
                                </Link>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-6 py-2.5 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] disabled:opacity-50 transition"
                                >
                                    {isSubmitting ? "Mengajukan..." : "Ajukan Overtime"}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Informasi Section */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-6">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-yellow-800">Informasi Penting</h3>
                                <div className="mt-2 text-sm text-yellow-700">
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>Waktu break dibulatkan ke kelipatan 30 menit</li>
                                        <li>Untuk anggota tim, setiap orang bisa memiliki jam lembur yang berbeda</li>
                                        <li>Anda dapat mengedit jam lembur per individu setelah menambahkan karyawan</li>
                                        <li>Pastikan lembur telah mendapatkan persetujuan atasan langsung</li>
                                        <li>Form harus diajukan maksimal H+1 setelah lembur dilakukan</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default OvertimeRequestPage;