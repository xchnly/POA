"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import Swal from 'sweetalert2'; // Import SweetAlert2

// Interfaces
interface UserData {
    uid: string;
    email: string | null;
    nama: string;
    nik: string;
    dept: string;
    jabatan: string;
}

interface LaborRequestData {
    id: string;
    type: "labor";
    tanggalDiperlukan: string;
    jumlahOrang: number | "";
    gender: string[];
    umurMaksimal: number | "";
    alasanMemerlukan: string;
    alasanLain?: string; // Field baru untuk alasan "Lainnya"
    posisi: string;
    tugasUtama: string;
    bahasaDiperlukan: string[];
    persyaratanLain: string;
    status: "pending";
    requesterUid: string;
    requesterName: string;
    deptId: string;
    createdAt: any;
    updatedAt: any;
}

const LaborRequestPage: React.FC = () => {
    const router = useRouter();
    const [authUser] = useAuthState(auth);
    const [userProfile, setUserProfile] = useState<UserData | null>(null);
    const [deptName, setDeptName] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        tanggalDiperlukan: new Date().toISOString().split('T')[0],
        jumlahOrang: "" as number | "",
        umurMaksimal: "" as number | "",
        alasanMemerlukan: "Posisi Baru",
        alasanLain: "", // State baru untuk alasan lainnya
        posisi: "",
        tugasUtama: "",
        persyaratanLain: "",
    });

    const [showOtherReasonInput, setShowOtherReasonInput] = useState(false);
    const [gender, setGender] = useState<string[]>([]);
    const [bahasa, setBahasa] = useState<string[]>([]);

    useEffect(() => {
        const fetchUserData = async () => {
            if (authUser) {
                const userDocRef = doc(db, "users", authUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const data = userDocSnap.data() as UserData;
                    setUserProfile({ ...data, uid: authUser.uid, email: authUser.email });

                    const deptDocRef = doc(db, "departments", data.dept);
                    const deptDocSnap = await getDoc(deptDocRef);
                    if (deptDocSnap.exists()) {
                        setDeptName(deptDocSnap.data().name);
                    } else {
                        console.error("Department document not found!");
                        setDeptName("Tidak Ditemukan");
                    }
                } else {
                    console.error("User document not found!");
                    Swal.fire({
                        icon: 'error',
                        title: 'Data Pengguna Tidak Ditemukan',
                        text: 'Silakan hubungi dukungan teknis.'
                    }).then(() => router.push("/"));
                }
            } else {
                router.push("/");
            }
        };
        fetchUserData();
    }, [authUser, router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === "alasanMemerlukan") {
            setShowOtherReasonInput(value === "Lainnya");
        }
    };

    const handleGenderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        if (checked) {
            setGender(prev => [...prev, value]);
        } else {
            setGender(prev => prev.filter(g => g !== value));
        }
    };

    const handleBahasaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        if (checked) {
            setBahasa(prev => [...prev, value]);
        } else {
            setBahasa(prev => prev.filter(b => b !== value));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile) return;

        if (gender.length === 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'Peringatan',
                text: 'Pilih minimal satu kriteria jenis kelamin!'
            });
            return;
        }

        if (formData.alasanMemerlukan === "Lainnya" && !formData.alasanLain.trim()) {
            await Swal.fire({
                icon: 'warning',
                title: 'Peringatan',
                text: 'Mohon isi alasan lainnya.'
            });
            return;
        }

        const confirmationResult = await Swal.fire({
            title: 'Apakah Anda yakin?',
            text: 'Anda akan mengajukan formulir permintaan tenaga kerja ini. Pastikan semua data sudah benar.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Ya, Ajukan!',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#4CAF50',
            cancelButtonColor: '#d33',
        });

        if (confirmationResult.isConfirmed) {
            setIsSubmitting(true);

            try {
                const formId = `lr-${Date.now()}`;

                const laborData: LaborRequestData = {
                    id: formId,
                    type: "labor",
                    tanggalDiperlukan: formData.tanggalDiperlukan,
                    jumlahOrang: Number(formData.jumlahOrang),
                    umurMaksimal: Number(formData.umurMaksimal),
                    alasanMemerlukan: formData.alasanMemerlukan,
                    posisi: formData.posisi,
                    tugasUtama: formData.tugasUtama,
                    persyaratanLain: formData.persyaratanLain,
                    gender: gender,
                    bahasaDiperlukan: bahasa,
                    status: "pending",
                    requesterUid: userProfile.uid,
                    requesterName: userProfile.nama,
                    deptId: userProfile.dept,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    // Fix: Hanya tambahkan alasanLain jika diperlukan
                    ...(formData.alasanMemerlukan === "Lainnya" && { alasanLain: formData.alasanLain.trim() }),
                };

                await setDoc(doc(db, "forms", formId), laborData);

                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil!',
                    text: 'Formulir permintaan tenaga kerja berhasil diajukan.',
                    timer: 2000,
                    showConfirmButton: false
                }).then(() => {
                    router.push("/dashboard");
                });

            } catch (error) {
                console.error("Error submitting form:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Terjadi Kesalahan',
                    text: 'Terjadi kesalahan saat menyimpan formulir. Silakan coba lagi.'
                });
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    if (!userProfile) {
        return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">Memuat data pengguna...</div>;
    }

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
                        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Formulir Permintaan Tenaga Kerja</h2>
                        <ul className="space-y-1">
                            <li>
                                <div className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                                    <span className="mr-3">📝</span>
                                    Isi Formulir
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
                            <h1 className="text-2xl font-bold text-gray-900">Formulir Permintaan Tenaga Kerja</h1>
                            <p className="text-sm text-gray-500">Ajukan permintaan tenaga kerja baru</p>
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
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* General Info */}
                        <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informasi Pemohon</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="requesterName" className="block text-sm font-medium text-gray-700 mb-1">Nama Pemohon</label>
                                        <input
                                            type="text"
                                            id="requesterName"
                                            value={userProfile?.nama || ""}
                                            readOnly
                                            className="w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="dept" className="block text-sm font-medium text-gray-700 mb-1">Departemen</label>
                                        <input
                                            type="text"
                                            id="dept"
                                            value={deptName || userProfile?.dept || ""}
                                            readOnly
                                            className="w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Kriteria Kebutuhan */}
                        <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Kriteria Kebutuhan</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div>
                                    <label htmlFor="jumlahOrang" className="block text-sm font-medium text-gray-700 mb-1">Total Orang Diperlukan <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        name="jumlahOrang"
                                        value={formData.jumlahOrang}
                                        onChange={handleChange}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                        min="1"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="tanggalDiperlukan" className="block text-sm font-medium text-gray-700 mb-1">Tanggal Diperlukan <span className="text-red-500">*</span></label>
                                    <input
                                        type="date"
                                        name="tanggalDiperlukan"
                                        value={formData.tanggalDiperlukan}
                                        onChange={handleChange}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="umurMaksimal" className="block text-sm font-medium text-gray-700 mb-1">Umur Maksimal <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        name="umurMaksimal"
                                        value={formData.umurMaksimal}
                                        onChange={handleChange}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                        min="18"
                                        required
                                    />
                                </div>
                                <div className="col-span-full">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Kelamin <span className="text-red-500">*</span></label>
                                    <div className="flex gap-4">
                                        <div className="flex items-center">
                                            <input
                                                id="gender-male"
                                                name="gender"
                                                type="checkbox"
                                                value="Pria"
                                                checked={gender.includes("Pria")}
                                                onChange={handleGenderChange}
                                                className="h-4 w-4 text-green-600 border-gray-300 rounded"
                                            />
                                            <label htmlFor="gender-male" className="ml-2 text-sm text-gray-700">Pria</label>
                                        </div>
                                        <div className="flex items-center">
                                            <input
                                                id="gender-female"
                                                name="gender"
                                                type="checkbox"
                                                value="Wanita"
                                                checked={gender.includes("Wanita")}
                                                onChange={handleGenderChange}
                                                className="h-4 w-4 text-green-600 border-gray-300 rounded"
                                            />
                                            <label htmlFor="gender-female" className="ml-2 text-sm text-gray-700">Wanita</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Detail Kebutuhan */}
                        <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Detail Kebutuhan</h3>
                            <div className="space-y-6">
                                <div>
                                    <label htmlFor="alasanMemerlukan" className="block text-sm font-medium text-gray-700 mb-1">Alasan Memerlukan <span className="text-red-500">*</span></label>
                                    <select
                                        name="alasanMemerlukan"
                                        value={formData.alasanMemerlukan}
                                        onChange={handleChange}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                        required
                                    >
                                        <option value="Posisi Baru">Posisi Baru</option>
                                        <option value="Menggantikan Orang">Menggantikan Orang</option>
                                        <option value="Penambahan Tenaga Kerja">Penambahan Tenaga Kerja</option>
                                        <option value="Lainnya">Lainnya</option>
                                    </select>
                                    {showOtherReasonInput && (
                                        <div className="mt-4">
                                            <label htmlFor="alasanLain" className="block text-sm font-medium text-gray-700 mb-1">Mohon berikan alasannya <span className="text-red-500">*</span></label>
                                            <textarea
                                                name="alasanLain"
                                                value={formData.alasanLain}
                                                onChange={handleChange}
                                                rows={2}
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                required
                                            />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label htmlFor="posisi" className="block text-sm font-medium text-gray-700 mb-1">Posisi / Jabatan <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="posisi"
                                        value={formData.posisi}
                                        onChange={handleChange}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="tugasUtama" className="block text-sm font-medium text-gray-700 mb-1">Tugas Utama <span className="text-red-500">*</span></label>
                                    <textarea
                                        name="tugasUtama"
                                        value={formData.tugasUtama}
                                        onChange={handleChange}
                                        rows={4}
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                        required
                                    />
                                </div>
                                <div className="col-span-full">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Bahasa yang Diperlukan</label>
                                    <div className="flex gap-4">
                                        <div className="flex items-center">
                                            <input
                                                id="bahasa-en"
                                                name="bahasa"
                                                type="checkbox"
                                                value="EN"
                                                checked={bahasa.includes("EN")}
                                                onChange={handleBahasaChange}
                                                className="h-4 w-4 text-green-600 border-gray-300 rounded"
                                            />
                                            <label htmlFor="bahasa-en" className="ml-2 text-sm text-gray-700">EN (English)</label>
                                        </div>
                                        <div className="flex items-center">
                                            <input
                                                id="bahasa-cn"
                                                name="bahasa"
                                                type="checkbox"
                                                value="CN"
                                                checked={bahasa.includes("CN")}
                                                onChange={handleBahasaChange}
                                                className="h-4 w-4 text-green-600 border-gray-300 rounded"
                                            />
                                            <label htmlFor="bahasa-cn" className="ml-2 text-sm text-gray-700">CN (Chinese)</label>
                                        </div>
                                        <div className="flex items-center">
                                            <input
                                                id="bahasa-id"
                                                name="bahasa"
                                                type="checkbox"
                                                value="ID"
                                                checked={bahasa.includes("ID")}
                                                onChange={handleBahasaChange}
                                                className="h-4 w-4 text-green-600 border-gray-300 rounded"
                                            />
                                            <label htmlFor="bahasa-id" className="ml-2 text-sm text-gray-700">ID (Indonesia)</label>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="persyaratanLain" className="block text-sm font-medium text-gray-700 mb-1">Persyaratan Lain</label>
                                    <textarea
                                        name="persyaratanLain"
                                        value={formData.persyaratanLain}
                                        onChange={handleChange}
                                        rows={4}
                                        placeholder="Opsional, seperti pengalaman kerja, sertifikasi, dsb."
                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end space-x-4 pt-6">
                            <Link
                                href="/forms"
                                className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                            >
                                Batal
                            </Link>
                            <button
                                type="submit"
                                disabled={isSubmitting || gender.length === 0}
                                className="px-6 py-2.5 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] disabled:opacity-50 transition"
                            >
                                {isSubmitting ? "Mengajukan..." : "Ajukan Permintaan"}
                            </button>
                        </div>
                    </form>

                    {/* Information Section */}
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
                                        <li>Pastikan semua kriteria telah diisi dengan benar.</li>
                                        <li>Permintaan ini akan diteruskan ke departemen HRD dan atasan Anda untuk ditinjau.</li>
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

export default LaborRequestPage;