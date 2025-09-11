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

interface PurchaseItem {
    id: string;
    no: number;
    kodeItem: string;
    namaItem: string;
    spek: string;
    qty: number | "";
    unit: string;
    alasan: string;
    remarks: string;
    photoUrl?: string;
}

const PurchaseRequestPage: React.FC = () => {
    const router = useRouter();
    const [authUser] = useAuthState(auth);
    const [userProfile, setUserProfile] = useState<UserData | null>(null);
    const [deptName, setDeptName] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
    
    const [formData, setFormData] = useState({
        tanggalRequest: new Date().toISOString().split('T')[0],
        urgent: "no",
    });

    const [newItem, setNewItem] = useState<Omit<PurchaseItem, 'id' | 'no'>>({
        kodeItem: "",
        namaItem: "",
        spek: "",
        qty: "",
        unit: "",
        alasan: "",
        remarks: "",
        photoUrl: "",
    });

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
                        await Swal.fire({
                            icon: 'error',
                            title: 'Oops...',
                            text: 'Dokumen departemen tidak ditemukan!',
                        });
                        setDeptName("Tidak Ditemukan");
                    }

                } else {
                    console.error("User document not found!");
                    await Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: 'Data pengguna tidak ditemukan. Silakan hubungi dukungan.',
                    });
                    router.push("/");
                }
            } else {
                router.push("/");
            }
        };
        fetchUserData();
    }, [authUser, router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNewItemChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setNewItem(prev => ({ ...prev, [name]: value }));
    };

    const handleAddItem = () => {
        if (!newItem.namaItem || newItem.qty === "" || !newItem.unit || !newItem.alasan) {
            Swal.fire({
                icon: 'warning',
                title: 'Perhatian!',
                text: 'Nama item, kuantitas, unit, dan alasan harus diisi!',
            });
            return;
        }

        const newPurchaseItem: PurchaseItem = {
            ...newItem,
            id: `item-${Date.now()}`,
            no: purchaseItems.length + 1,
            qty: Number(newItem.qty),
        };

        setPurchaseItems(prev => [...prev, newPurchaseItem]);
        setNewItem({
            kodeItem: "",
            namaItem: "",
            spek: "",
            qty: "",
            unit: "",
            alasan: "",
            remarks: "",
            photoUrl: "",
        });
    };

    const handleRemoveItem = (itemId: string) => {
        Swal.fire({
            title: 'Apakah Anda yakin?',
            text: "Anda tidak akan bisa mengembalikan ini!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, hapus!'
        }).then((result) => {
            if (result.isConfirmed) {
                setPurchaseItems(prev => prev.filter(item => item.id !== itemId).map((item, index) => ({
                    ...item,
                    no: index + 1
                })));
                Swal.fire(
                    'Dihapus!',
                    'Item Anda telah dihapus.',
                    'success'
                );
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile) return;

        if (purchaseItems.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Perhatian!',
                text: 'Tambahkan minimal satu item pembelian!',
            });
            return;
        }
        
        const confirmationResult = await Swal.fire({
            title: 'Ajukan Permintaan Pembelian?',
            text: "Anda akan mengirimkan formulir ini. Pastikan semua data sudah benar.",
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
            const formId = `pr-${Date.now()}`;
            
            const purchaseData = {
                id: formId,
                type: "purchase",
                tanggalRequest: formData.tanggalRequest,
                urgent: formData.urgent === "yes",
                status: "pending",
                requesterUid: userProfile.uid,
                requesterName: userProfile.nama,
                // PERBAIKAN: Mengirim deptId alih-alih dept
                deptId: userProfile.dept, 
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                items: purchaseItems.map(item => ({
                    no: item.no,
                    kodeItem: item.kodeItem,
                    namaItem: item.namaItem,
                    spek: item.spek,
                    qty: item.qty,
                    unit: item.unit,
                    alasan: item.alasan,
                    remarks: item.remarks,
                    photoUrl: item.photoUrl || null,
                })),
            };

            await setDoc(doc(db, "forms", formId), purchaseData);

            await Swal.fire({
                icon: 'success',
                title: 'Berhasil!',
                text: 'Formulir permintaan pembelian berhasil disimpan!',
                timer: 2000,
                showConfirmButton: false
            });
            
            router.push("/dashboard");

        } catch (error) {
            console.error("Error submitting form:", error);
            await Swal.fire({
                icon: 'error',
                title: 'Terjadi Kesalahan',
                text: 'Terjadi kesalahan saat menyimpan formulir. Silakan coba lagi.',
            });
        } finally {
            setIsSubmitting(false);
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
                        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Formulir Permintaan Pembelian</h2>
                        <ul className="space-y-1">
                            <li>
                                <div className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                                    <span className="mr-3">📝</span>
                                    Isi Formulir
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
                            <h1 className="text-2xl font-bold text-gray-900">Formulir Permintaan Pembelian</h1>
                            <p className="text-sm text-gray-500">Ajukan permintaan pembelian barang/jasa</p>
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
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Informasi Umum</h3>
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
                                    <div>
                                        <label htmlFor="tanggalRequest" className="block text-sm font-medium text-gray-700 mb-1">Tanggal Permintaan</label>
                                        <input
                                            type="date"
                                            name="tanggalRequest"
                                            value={formData.tanggalRequest}
                                            onChange={handleChange}
                                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="urgent" className="block text-sm font-medium text-gray-700 mb-1">Status Urgensi</label>
                                        <select
                                            name="urgent"
                                            value={formData.urgent}
                                            onChange={handleChange}
                                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                        >
                                            <option value="no">Tidak Urgent</option>
                                            <option value="yes">Urgent</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* List of items */}
                        {purchaseItems.length > 0 && (
                            <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Daftar Item</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full table-auto border-collapse">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">No.</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Kode Item</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Nama Item</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Spesifikasi</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Qty</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Unit</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Alasan</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Remarks</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {purchaseItems.map((item) => (
                                                <tr key={item.id}>
                                                    <td className="px-4 py-2 text-sm">{item.no}</td>
                                                    <td className="px-4 py-2 text-sm">{item.kodeItem || '-'}</td>
                                                    <td className="px-4 py-2 text-sm">{item.namaItem}</td>
                                                    <td className="px-4 py-2 text-sm">{item.spek || '-'}</td>
                                                    <td className="px-4 py-2 text-sm">{item.qty}</td>
                                                    <td className="px-4 py-2 text-sm">{item.unit}</td>
                                                    <td className="px-4 py-2 text-sm max-w-xs">{item.alasan}</td>
                                                    <td className="px-4 py-2 text-sm max-w-xs">{item.remarks || '-'}</td>
                                                    <td className="px-4 py-2 text-sm">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItem(item.id)}
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
                                disabled={isSubmitting || purchaseItems.length === 0}
                                className="px-6 py-2.5 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] disabled:opacity-50 transition"
                            >
                                {isSubmitting ? "Mengajukan..." : "Ajukan Permintaan"}
                            </button>
                        </div>
                    </form>

                    {/* Input for new item - Pindahkan ke luar form */}
                    <div className="mt-6 bg-white rounded-xl shadow-md p-6 border border-green-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tambah Item Baru</h3>
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label htmlFor="kodeItem" className="block text-sm font-medium text-gray-700 mb-1">Kode Item</label>
                                <input
                                    type="text"
                                    name="kodeItem"
                                    value={newItem.kodeItem}
                                    onChange={handleNewItemChange}
                                    placeholder="Opsional"
                                    className="w-full p-2.5 border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <label htmlFor="namaItem" className="block text-sm font-medium text-gray-700 mb-1">Nama Item <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="namaItem"
                                    value={newItem.namaItem}
                                    onChange={handleNewItemChange}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg"
                                    required
                                />
                            </div>
                            <div className="col-span-1 md:col-span-2 lg:col-span-1">
                                <label htmlFor="spek" className="block text-sm font-medium text-gray-700 mb-1">Spesifikasi</label>
                                <input
                                    type="text"
                                    name="spek"
                                    value={newItem.spek}
                                    onChange={handleNewItemChange}
                                    placeholder="Opsional"
                                    className="w-full p-2.5 border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label htmlFor="qty" className="block text-sm font-medium text-gray-700 mb-1">Kuantitas <span className="text-red-500">*</span></label>
                                <input
                                    type="number"
                                    name="qty"
                                    value={newItem.qty}
                                    onChange={handleNewItemChange}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-1">Unit <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="unit"
                                    value={newItem.unit}
                                    onChange={handleNewItemChange}
                                    placeholder="Contoh: Pcs, Unit, Meter"
                                    className="w-full p-2.5 border border-gray-300 rounded-lg"
                                    required
                                />
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <label htmlFor="alasan" className="block text-sm font-medium text-gray-700 mb-1">Alasan Pembelian <span className="text-red-500">*</span></label>
                                <textarea
                                    name="alasan"
                                    value={newItem.alasan}
                                    onChange={handleNewItemChange}
                                    rows={2}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg"
                                    required
                                />
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <label htmlFor="remarks" className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                                <textarea
                                    name="remarks"
                                    value={newItem.remarks}
                                    onChange={handleNewItemChange}
                                    rows={2}
                                    placeholder="Opsional"
                                    className="w-full p-2.5 border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <label htmlFor="photo" className="block text-sm font-medium text-gray-700 mb-1">Foto (Opsional)</label>
                                <input
                                    type="file"
                                    name="photo"
                                    className="w-full p-2.5 border border-gray-300 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                                />
                            </div>
                            
                            <div className="col-span-1 md:col-span-2 lg:col-span-4 flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
                                >
                                    + Tambahkan Item
                                </button>
                            </div>
                        </div>
                    </div>


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
                                        <li>Pastikan mengisi semua informasi yang diperlukan untuk setiap item.</li>
                                        <li>Unggah foto jika diperlukan sebagai lampiran tambahan.</li>
                                        <li>Permintaan ini akan diteruskan ke atasan Anda untuk disetujui.</li>
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

export default PurchaseRequestPage;