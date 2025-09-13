"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { v4 as uuidv4 } from 'uuid';
import Swal from 'sweetalert2';

// --- Interfaces ---
interface UserData {
    uid: string;
    email: string | null;
    nama?: string;
    nik?: string;
    dept?: string;
    jabatan?: string;
    role?: string;
}

interface ReimbursementItem {
    id: string;
    namaItem: string;
    harga: number;
    deskripsi: string;
}

// --- Page Component ---
const PaymentRequestPage: React.FC = () => {
    const router = useRouter();
    const [authUser] = useAuthState(auth);
    const [userProfile, setUserProfile] = useState<UserData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reimbursementItems, setReimbursementItems] = useState<ReimbursementItem[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    // State for bank details, reason, and receipt files
    const [formData, setFormData] = useState({
        alasan: "",
        namaBank: "",
        nomorRekening: "",
        atasNamaRekening: "",
    });
    const [notaFiles, setNotaFiles] = useState<File[]>([]);
    const [notaFileInputs, setNotaFileInputs] = useState<string[]>(['']);
    const [deptName, setDeptName] = useState<string | null>(null);

    // --- Side effect to fetch user data ---
    useEffect(() => {
        const fetchUserData = async () => {
            if (authUser) {
                const userDocRef = doc(db, "users", authUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data() as UserData;
                    setUserProfile({
                        uid: userData.uid || '',
                        email: userData.email || '',
                        nama: userData.nama || '',
                        nik: userData.nik || '',
                        dept: userData.dept || '',
                        jabatan: userData.jabatan || '',
                        role: userData.role || '',
                    });
                }
            } else {
                router.push("/");
            }
        };

        fetchUserData();
    }, [authUser, router]);
    
    // --- Side effect to fetch department name ---
    useEffect(() => {
        const fetchDeptName = async () => {
            if (userProfile?.dept) {
                const deptDocRef = doc(db, "departments", userProfile.dept);
                const deptDocSnap = await getDoc(deptDocRef);
                if (deptDocSnap.exists()) {
                    setDeptName(deptDocSnap.data().name);
                }
            }
        };
        fetchDeptName();
    }, [userProfile?.dept]);

    // --- Function to upload file to Cloudinary ---
    const uploadFileToCloudinary = async (file: File) => {
        const CLOUD_NAME = "due6kqddl";
        const UPLOAD_PRESET = "sick_leave_preset";

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
            method: "POST",
            body: formData,
        });
        const data = await res.json();
        return data.secure_url;
    };

    // --- Form Logic ---
    const handleAddItem = () => {
        setReimbursementItems([...reimbursementItems, {
            id: uuidv4(),
            namaItem: "",
            harga: 0,
            deskripsi: "",
        }]);
    };

    const handleRemoveItem = (id: string) => {
        Swal.fire({
            title: 'Delete this item?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then((result) => {
            if (result.isConfirmed) {
                setReimbursementItems(reimbursementItems.filter(item => item.id !== id));
                Swal.fire(
                    'Deleted!',
                    'The reimbursement item has been deleted.',
                    'success'
                );
            }
        });
    };

    const handleItemChange = (id: string, name: keyof ReimbursementItem, value: any) => {
        setReimbursementItems(reimbursementItems.map(item =>
            item.id === id ? { ...item, [name]: value } : item
        ));
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddNotaInput = () => {
        setNotaFileInputs([...notaFileInputs, '']);
    };

    const handleNotaFileChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files ? e.target.files[0] : null;
        if (file) {
            setNotaFiles(prev => {
                const newFiles = [...prev];
                newFiles[index] = file;
                return newFiles;
            });
        }
    };

    const handleRemoveNotaInput = (index: number) => {
        Swal.fire({
            title: 'Delete this receipt?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then((result) => {
            if (result.isConfirmed) {
                setNotaFileInputs(prev => prev.filter((_, i) => i !== index));
                setNotaFiles(prev => prev.filter((_, i) => i !== index));
                Swal.fire(
                    'Deleted!',
                    'The receipt has been deleted.',
                    'success'
                );
            }
        });
    };

    // --- Main Submit Function ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile) {
            await Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'User profile not loaded yet. Please try again.'
            });
            return;
        }

        if (reimbursementItems.length === 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'Warning',
                text: 'Please add at least one payment item!'
            });
            return;
        }

        const hasMissingItemInfo = reimbursementItems.some(item =>
            !item.namaItem || item.harga <= 0
        );

        if (hasMissingItemInfo) {
            await Swal.fire({
                icon: 'warning',
                title: 'Warning',
                text: 'Make sure all items have a name and price.'
            });
            return;
        }

        if (notaFiles.length === 0 || notaFiles.some(file => !file)) {
            await Swal.fire({
                 icon: 'warning',
                 title: 'Warning',
                 text: 'Please upload at least one receipt for this submission.'
            });
            return;
        }
        
        if (!formData.namaBank || !formData.nomorRekening || !formData.atasNamaRekening) {
            await Swal.fire({
                icon: 'warning',
                title: 'Warning',
                text: 'Please complete the bank account details for fund disbursement.'
            });
            return;
        }

        const confirmationResult = await Swal.fire({
            title: 'Submit Reimbursement?',
            text: 'You are about to submit this form. Make sure all data is correct.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, Submit!',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#4CAF50',
            cancelButtonColor: '#d33',
        });

        if (confirmationResult.isConfirmed) {
            setIsSubmitting(true);

            try {
                const formId = `reimburse-${Date.now()}`;
                
                // Upload all receipt files
                const notaUrls = await Promise.all(
                    notaFiles.map(file => uploadFileToCloudinary(file))
                );

                const totalHarga = reimbursementItems.reduce((sum, item) => sum + item.harga, 0);

                const paymentData = {
                    id: formId,
                    type: "payment",
                    jenisPengajuan: "reimbursement",
                    alasan: formData.alasan,
                    namaBank: formData.namaBank,
                    nomorRekening: formData.nomorRekening,
                    atasNamaRekening: formData.atasNamaRekening,
                    items: reimbursementItems,
                    notaUrls: notaUrls,
                    totalHarga: totalHarga,
                    status: "pending",
                    requesterUid: userProfile.uid || '',
                    requesterName: userProfile.nama || '',
                    deptId: userProfile.dept || '',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };
                
                await setDoc(doc(db, "forms", formId), paymentData);

                await Swal.fire({
                    icon: 'success',
                    title: 'Success!',
                    text: 'Reimbursement form submitted successfully.',
                    timer: 2000,
                    showConfirmButton: false
                });
                
                router.push("/dashboard");

            } catch (error) {
                console.error("Error submitting form:", error);
                await Swal.fire({
                    icon: 'error',
                    title: 'An Error Occurred',
                    text: 'An error occurred while saving the form. Please try again.'
                });
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    if (!userProfile) {
        return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">Loading user data...</div>;
    }

    const totalHarga = reimbursementItems.reduce((sum, item) => sum + item.harga, 0);

    // --- JSX Structure (Form Page) ---
    return (
        <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 w-64 bg-white shadow-lg z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out`}>
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
                            Back to Forms List
                        </Link>
                    </div>
                    <div className="mb-6">
                        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Reimbursement Form</h2>
                        <ul className="space-y-1">
                            <li>
                                <div className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium">
                                    <span className="mr-3">📝</span>
                                    Fill Form
                                </div>
                            </li>
                        </ul>
                    </div>
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                {/* Header */}
                <header className="bg-white shadow-sm border-b border-green-100 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                             <button
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="lg:hidden p-2 mr-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500"
                            >
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                                </svg>
                            </button>
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold text-gray-900">Reimbursement Form</h1>
                                <p className="text-xs md:text-sm text-gray-500">Submit a reimbursement request by attaching receipts</p>
                            </div>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="px-4 py-2 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] disabled:opacity-50 transition"
                            >
                                {isSubmitting ? "Submitting..." : "Submit Now"}
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="p-4 md:p-6">
                    <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border border-green-100">
                        <form onSubmit={handleSubmit} className="space-y-6">

                            {/* Requester Information */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Requester Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">Name</p>
                                        <p className="mt-1 text-sm text-gray-900">{userProfile.nama}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">NIK</p>
                                        <p className="mt-1 text-sm text-gray-900">{userProfile.nik}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-700">Department</p>
                                        <p className="mt-1 text-sm text-gray-900">{deptName || 'Loading...'}</p>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Form Description */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">General Information</h3>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Submission</label>
                                <textarea
                                    name="alasan"
                                    value={formData.alasan}
                                    onChange={handleFormChange}
                                    rows={3}
                                    placeholder="Explain the reason for this reimbursement request"
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                    required
                                />
                            </div>

                            {/* Bank Account Details */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Fund Disbursement Bank Account Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                                        <input
                                            type="text"
                                            name="namaBank"
                                            value={formData.namaBank}
                                            onChange={handleFormChange}
                                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 transition"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                                        <input
                                            type="text"
                                            name="nomorRekening"
                                            value={formData.nomorRekening}
                                            onChange={handleFormChange}
                                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 transition"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
                                        <input
                                            type="text"
                                            name="atasNamaRekening"
                                            value={formData.atasNamaRekening}
                                            onChange={handleFormChange}
                                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 transition"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Reimbursement Item List */}
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Reimbursement Item List</h3>
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                                    >
                                        + Add Item
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {reimbursementItems.map((item, index) => (
                                        <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50 relative">
                                            <div className="absolute top-2 right-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <h4 className="font-semibold text-gray-800 mb-2">Item #{index + 1}</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Item Description</label>
                                                    <input
                                                        type="text"
                                                        value={item.namaItem}
                                                        onChange={(e) => handleItemChange(item.id, 'namaItem', e.target.value)}
                                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 transition"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (Rp)</label>
                                                    <input
                                                        type="number"
                                                        value={item.harga}
                                                        onChange={(e) => handleItemChange(item.id, 'harga', parseInt(e.target.value))}
                                                        className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 transition"
                                                        min="1"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                                <input
                                                    type="text"
                                                    value={item.deskripsi}
                                                    onChange={(e) => handleItemChange(item.id, 'deskripsi', e.target.value)}
                                                    placeholder="Example: Team lunch expenses"
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 transition"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Receipt List */}
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">Upload Receipts (Mandatory)</h3>
                                    <button
                                        type="button"
                                        onClick={handleAddNotaInput}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                                    >
                                        + Add Another Receipt
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    {notaFileInputs.map((_, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50 relative">
                                            {index > 0 && (
                                                <div className="absolute top-2 right-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveNotaInput(index)}
                                                        className="text-red-500 hover:text-red-700"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                            <h4 className="font-semibold text-gray-800 mb-2">Receipt #{index + 1}</h4>
                                            <input
                                                type="file"
                                                accept=".pdf, .jpg, .jpeg, .png"
                                                onChange={(e) => handleNotaFileChange(e, index)}
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 transition"
                                                required
                                            />
                                            {notaFiles[index] && (
                                                <p className="mt-2 text-sm text-gray-600">Selected file: {notaFiles[index].name}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Total Price */}
                            <div className="text-right pt-4 border-t border-gray-200">
                                <h4 className="text-lg font-bold text-gray-900">Total Cost: Rp {totalHarga.toLocaleString('id-ID')}</h4>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                                <Link
                                    href="/forms"
                                    className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                                >
                                    Cancel
                                </Link>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || reimbursementItems.length === 0 || notaFiles.length === 0 || notaFiles.some(file => !file)}
                                    className="px-6 py-2.5 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] disabled:opacity-50 transition"
                                >
                                    {isSubmitting ? "Submitting..." : "Submit Reimbursement"}
                                </button>
                            </div>
                        </form>
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
                                <h3 className="text-sm font-medium text-yellow-800">Important Information</h3>
                                <div className="mt-2 text-sm text-yellow-700">
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>This form is used to request reimbursement or payment.</li>
                                        <li>You can add more than one expense item.</li>
                                        <li>It is mandatory to upload at least one receipt/proof of payment for this submission.</li>
                                        <li>Ensure the uploaded receipt is clearly legible.</li>
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

export default PaymentRequestPage;