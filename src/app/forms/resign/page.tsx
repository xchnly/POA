"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, collection, getDocs, query, where, getDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import Swal from 'sweetalert2'; // Tambahkan import SweetAlert2

// --- Interfaces ---
interface UserData {
    uid: string;
    email: string | null;
    nama?: string;
    nik?: string;
    dept?: string;
    deptId?: string;
    jabatan?: string;
    role?: string;
}

interface Employee {
    id: string;
    nik: string;
    nama: string;
    dept?: string;
    jabatan: string;
    uid?: string; // Tambahkan uid untuk kompatibilitas
}

interface Department {
    id: string;
    name: string;
}

// --- Komponen Halaman ---
const ResignRequestPage: React.FC = () => {
    const router = useRouter();
    const [authUser] = useAuthState(auth);
    const [userProfile, setUserProfile] = useState<UserData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [requestType, setRequestType] = useState<"self" | "team">("self");
    const [departments, setDepartments] = useState<Department[]>([]);
    const [selectedDeptId, setSelectedDeptId] = useState<string>("");
    const [employees, setEmployees] = useState<Employee[]>([]);

    // State untuk data form
    const [formData, setFormData] = useState({
        resignationDate: "",
        reason: "",
        employeeId: "",
    });

    const [userDeptName, setUserDeptName] = useState<string>("");

    // --- Efek samping untuk mengambil data pengguna & departemen ---
    useEffect(() => {
        const fetchInitialData = async () => {
            if (!authUser) {
                router.push("/");
                return;
            }
            try {
                // Fetch user profile dari users
                const userDocRef = doc(db, "users", authUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data() as UserData;
                    setUserProfile(userData);

                    // Dapatkan department ID - coba dari 'dept' terlebih dahulu, lalu 'deptId'
                    const userDeptId = userData.dept || userData.deptId;

                    // Fetch user's department name
                    if (userDeptId) {
                        const deptDocRef = doc(db, "departments", userDeptId);
                        const deptDocSnap = await getDoc(deptDocRef);
                        if (deptDocSnap.exists()) {
                            setUserDeptName(deptDocSnap.data().name);
                        }
                    }
                } else {
                    router.push("/");
                    return;
                }

                // Fetch all departments
                const deptSnapshot = await getDocs(collection(db, "departments"));
                const deptList: Department[] = [];
                deptSnapshot.forEach(doc => {
                    deptList.push({ id: doc.id, name: doc.data().name });
                });
                setDepartments(deptList);
            } catch (error) {
                console.error("Error fetching initial data:", error);
                await Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Gagal memuat data. Silakan coba lagi.'
                });
            }
        };

        fetchInitialData();
    }, [authUser, router]);

    // --- Efek samping untuk mengambil data karyawan dari employees saat departemen dipilih ---
    useEffect(() => {
        const fetchEmployees = async () => {
            if (selectedDeptId) {
                try {
                    // Dapatkan nama departemen berdasarkan ID yang dipilih
                    const selectedDept = departments.find(dept => dept.id === selectedDeptId);
                    if (!selectedDept) {
                        setEmployees([]);
                        return;
                    }

                    console.log("Fetching employees for department:", selectedDept.name);

                    // Query dengan field 'dept' di collection employees (bukan deptId)
                    const employeesQuery = query(
                        collection(db, "employees"),
                        where("dept", "==", selectedDept.name)
                    );

                    const employeesSnapshot = await getDocs(employeesQuery);
                    const employeeList: Employee[] = [];

                    employeesSnapshot.forEach(docSnap => {
                        const employeeData = docSnap.data() as Employee;
                        employeeList.push({
                            id: docSnap.id,
                            ...employeeData
                        });
                    });

                    console.log("Employees found:", employeeList.length);
                    setEmployees(employeeList);

                } catch (error) {
                    console.error("Error fetching employees:", error);
                    setEmployees([]);
                }
            } else {
                setEmployees([]);
            }
        };

        fetchEmployees();
    }, [selectedDeptId, departments]);

    // --- Logika Form ---
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDeptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { value } = e.target;
        setSelectedDeptId(value);
        setFormData(prev => ({ ...prev, employeeId: "" })); // Reset employee dropdown
    };

    const handleRequestTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRequestType(e.target.value as "self" | "team");
        setSelectedDeptId("");
        setFormData(prev => ({ ...prev, employeeId: "" }));
    };

    // --- Fungsi Utama untuk Submit ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile) {
            await Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Profil pengguna belum dimuat. Silakan coba lagi.'
            });
            return;
        }

        if (!formData.resignationDate || !formData.reason) {
            await Swal.fire({
                icon: 'warning',
                title: 'Peringatan',
                text: 'Harap lengkapi semua field yang wajib diisi.'
            });
            return;
        }

        if (requestType === "team" && (!selectedDeptId || !formData.employeeId)) {
            await Swal.fire({
                icon: 'warning',
                title: 'Peringatan',
                text: 'Harap pilih departemen dan anggota tim yang akan mengajukan pengunduran diri.'
            });
            return;
        }
        
        const confirmationResult = await Swal.fire({
            title: 'Ajukan Pengunduran Diri?',
            text: 'Anda akan mengirimkan formulir ini. Pastikan semua data sudah benar.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Ya, Ajukan!',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#4CAF50',
            cancelButtonColor: '#d33',
        });

        if (!confirmationResult.isConfirmed) {
            return;
        }

        setIsSubmitting(true);

        try {
            const formId = `resign-${Date.now()}`;

            let employeeToResign: Employee | UserData = userProfile;

            // Dapatkan deptId dari userProfile - coba dari berbagai field yang mungkin
            const userDeptId = userProfile.deptId || userProfile.dept || "";

            // Dapatkan nama departemen
            let finalDeptName = userDeptName;
            if (!finalDeptName && userDeptId) {
                // Jika userDeptName belum ada, cari dari departments array
                const userDepartment = departments.find(dept => dept.id === userDeptId);
                if (userDepartment) {
                    finalDeptName = userDepartment.name;
                }
            }

            if (requestType === "team") {
                const selectedEmployee = employees.find(emp => emp.id === formData.employeeId);
                if (!selectedEmployee) {
                    await Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Karyawan tidak ditemukan.'
                    });
                    setIsSubmitting(false);
                    return;
                }
                employeeToResign = selectedEmployee;
            }

            // Pastikan semua field memiliki nilai, jika undefined gunakan string kosong
            const resignData = {
                id: formId,
                type: "resign",
                jenisPengajuan: "Resign",
                requesterUid: userProfile.uid || "",
                requesterName: userProfile.nama || "",
                employeeUid: employeeToResign.uid || employeeToResign.id || "",
                employeeName: employeeToResign.nama || "",
                employeeNik: employeeToResign.nik || "",
                deptId: userDeptId, // Gunakan userDeptId yang sudah di-handle
                dept: finalDeptName || "", // Gunakan finalDeptName, fallback ke string kosong
                resignationDate: formData.resignationDate,
                reason: formData.reason,
                status: "pending",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            // Log data untuk debugging
            console.log("Submitting resign data:", resignData);

            await setDoc(doc(db, "forms", formId), resignData);

            await Swal.fire({
                icon: 'success',
                title: 'Berhasil!',
                text: 'Form pengunduran diri berhasil diajukan!',
                timer: 2000,
                showConfirmButton: false
            });
            router.push("/dashboard");

        } catch (error) {
            console.error("Error submitting form:", error);
            await Swal.fire({
                icon: 'error',
                title: 'Terjadi Kesalahan',
                text: 'Terjadi kesalahan saat menyimpan form. Silakan coba lagi.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!userProfile) {
        return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">Memuat data pengguna...</div>;
    }

    const isManager = userProfile.role === "manager";

    // --- Struktur JSX (Halaman Form) ---
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
                        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Form Resign</h2>
                        <ul className="space-y-1">
                            <li>
                                <div className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                                    <span className="mr-3">📝</span>
                                    Isi Form
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
                            <h1 className="text-2xl font-bold text-gray-900">Form Pengunduran Diri</h1>
                            <p className="text-sm text-gray-500">Ajukan pengunduran diri untuk diri sendiri atau anggota tim</p>
                        </div>
                        <div className="flex space-x-2">
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
                    <div className="grid grid-cols-1 gap-6">
                        {/* Kolom Kiri: Form */}
                        <div className="md:col-span-2 space-y-6">
                            <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
                                <form onSubmit={handleSubmit} className="space-y-6">

                                    {/* Jenis Pengajuan */}
                                    {isManager && (
                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Jenis Pengajuan</h3>
                                            <div className="flex space-x-4">
                                                <div className="flex items-center">
                                                    <input
                                                        id="self"
                                                        name="requestType"
                                                        type="radio"
                                                        value="self"
                                                        checked={requestType === "self"}
                                                        onChange={handleRequestTypeChange}
                                                        className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                                                    />
                                                    <label htmlFor="self" className="ml-2 block text-sm font-medium text-gray-700">Untuk Diri Sendiri</label>
                                                </div>
                                                <div className="flex items-center">
                                                    <input
                                                        id="team"
                                                        name="requestType"
                                                        type="radio"
                                                        value="team"
                                                        checked={requestType === "team"}
                                                        onChange={handleRequestTypeChange}
                                                        className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                                                    />
                                                    <label htmlFor="team" className="ml-2 block text-sm font-medium text-gray-700">Untuk Anggota Tim</label>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Informasi Pengaju */}
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Informasi Pengaju</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Nama</p>
                                                <p className="mt-1 text-sm text-gray-900">{userProfile.nama}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">NIK</p>
                                                <p className="mt-1 text-sm text-gray-900">{userProfile.nik}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Departemen</p>
                                                <p className="mt-1 text-sm text-gray-900">{userDeptName || "Loading..."}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pemilihan Anggota Tim */}
                                    {requestType === "team" && isManager && (
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Pilih Anggota Tim</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label htmlFor="departmentId" className="block text-sm font-medium text-gray-700 mb-1">Departemen</label>
                                                    <select
                                                        id="departmentId"
                                                        name="departmentId"
                                                        value={selectedDeptId}
                                                        onChange={handleDeptChange}
                                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                        required
                                                    >
                                                        <option value="">Pilih Departemen</option>
                                                        {departments.map(dept => (
                                                            <option key={dept.id} value={dept.id}>
                                                                {dept.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700 mb-1">Anggota Tim</label>
                                                    <select
                                                        id="employeeId"
                                                        name="employeeId"
                                                        value={formData.employeeId}
                                                        onChange={handleInputChange}
                                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                        disabled={!selectedDeptId || employees.length === 0}
                                                        required
                                                    >
                                                        <option value="">Pilih Anggota Tim</option>
                                                        {employees.map(employee => (
                                                            <option key={employee.id} value={employee.id}>
                                                                {employee.nama} ({employee.nik})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {selectedDeptId && employees.length === 0 && (
                                                        <p className="text-sm text-red-500 mt-1">Tidak ada karyawan ditemukan di departemen ini</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Detail Pengunduran Diri */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Detail Pengunduran Diri</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="resignationDate" className="block text-sm font-medium text-gray-700 mb-1">Tanggal Efektif Resign</label>
                                                <input
                                                    type="date"
                                                    id="resignationDate"
                                                    name="resignationDate"
                                                    value={formData.resignationDate}
                                                    onChange={handleInputChange}
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 transition"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="mt-4">
                                            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">Alasan Pengunduran Diri</label>
                                            <textarea
                                                id="reason"
                                                name="reason"
                                                value={formData.reason}
                                                onChange={handleInputChange}
                                                rows={4}
                                                placeholder="Jelaskan alasan pengunduran diri..."
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                required
                                            />
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* Kolom Kanan: Informasi Penting */}
                        <div className="">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
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
                                                <li>Form ini digunakan untuk mengajukan pengunduran diri, baik untuk diri sendiri maupun anggota tim.</li>
                                                <li>Pengajuan pengunduran diri memerlukan **1 bulan pemberitahuan** (notice period) sebelum tanggal efektif.</li>
                                                <li>Setelah diajukan, form ini akan diteruskan untuk proses persetujuan.</li>
                                                <li>Pastikan tanggal efektif dan alasan yang diberikan sudah benar.</li>
                                                <li>Data anggota tim diambil dari koleksi <strong>employees</strong></li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons at the bottom */}
                    <div className="flex justify-end space-x-4 pt-6 mt-6 border-t border-gray-200">
                        <Link
                            href="/forms"
                            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                        >
                            Batal
                        </Link>
                        <button
                            type="submit"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-6 py-2.5 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] disabled:opacity-50 transition"
                        >
                            {isSubmitting ? "Mengajukan..." : "Ajukan Pengunduran Diri"}
                        </button>
                    </div>

                </main>
            </div>
        </div>
    );
};

export default ResignRequestPage;