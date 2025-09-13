"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, collection, getDocs, getDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import Swal from 'sweetalert2';

// --- Interfaces (Ensure these match your Firestore data structure) ---
interface UserData {
    uid: string;
    email: string | null;
    nama?: string;
    nik?: string;
    dept?: string;
    jabatan?: string;
}

interface Employee {
    id: string;
    nik?: string;
    nama?: string;
    dept?: string;
    jabatan?: string;
}

interface SickLeaveEntry {
    id: string;
    employee: Employee;
    tanggalMulai: string;
    tanggalSelesai: string;
    totalHari: number;
    mcFile?: File | null;
    mcFileUrl?: string;
}

// --- Page Component ---
const SickLeaveRequestPage: React.FC = () => {
    const router = useRouter();
    const [authUser] = useAuthState(auth);
    const [userProfile, setUserProfile] = useState<UserData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [sickLeaveEntries, setSickLeaveEntries] = useState<SickLeaveEntry[]>([]);
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [mcFileForSelf, setMcFileForSelf] = useState<File | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [formData, setFormData] = useState({
        jenisPengajuan: "diri-sendiri",
        deptFilter: "",
        alasan: "",
    });

    const [defaultEntry, setDefaultEntry] = useState({
        tanggalMulai: new Date().toISOString().split('T')[0],
        tanggalSelesai: new Date().toISOString().split('T')[0],
        totalHari: 1,
    });
    
    // --- Helper Functions ---
    const calculateTotalDays = (mulai: string, selesai: string): number => {
        const startDate = new Date(mulai);
        const endDate = new Date(selesai);
        const timeDiff = endDate.getTime() - startDate.getTime();
        const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
        return diffDays;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDefaultEntryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setDefaultEntry(prev => {
            const newEntry = { ...prev, [name]: value };
            if (name === "tanggalMulai" || name === "tanggalSelesai") {
                const totalHari = calculateTotalDays(
                    name === "tanggalMulai" ? value : prev.tanggalMulai,
                    name === "tanggalSelesai" ? value : prev.tanggalSelesai
                );
                return { ...newEntry, totalHari };
            }
            return newEntry;
        });
    };

    const handleEntryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, entryId: string) => {
        const { name, value } = e.target;
        setSickLeaveEntries(prev => prev.map(entry => {
            if (entry.id === entryId) {
                const updatedEntry = { ...entry, [name]: value };
                if (name === "tanggalMulai" || name === "tanggalSelesai") {
                    const totalHari = calculateTotalDays(
                        name === "tanggalMulai" ? value : entry.tanggalMulai,
                        name === "tanggalSelesai" ? value : entry.tanggalSelesai
                    );
                    return { ...updatedEntry, totalHari };
                }
                return updatedEntry;
            }
            return entry;
        }));
    };

    const handleFileChangeForSelf = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setMcFileForSelf(e.target.files[0]);
        }
    };

    const handleFileChangeForEntry = (e: React.ChangeEvent<HTMLInputElement>, entryId: string) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSickLeaveEntries(prev => prev.map(entry =>
                entry.id === entryId ? { ...entry, mcFile: file } : entry
            ));
        }
    };
    
    const addSickLeaveEntries = async () => {
        if (selectedEmployees.length === 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'Warning',
                text: 'Select at least one employee first!',
            });
            return;
        }

        const newEntries = selectedEmployees
            .filter(empId => !sickLeaveEntries.some(entry => entry.employee.id === empId))
            .map(empId => {
                const emp = filteredEmployees.find(e => e.id === empId);
                return {
                    id: `entry-${Date.now()}-${empId}`,
                    employee: emp!,
                    tanggalMulai: defaultEntry.tanggalMulai,
                    tanggalSelesai: defaultEntry.tanggalSelesai,
                    totalHari: calculateTotalDays(defaultEntry.tanggalMulai, defaultEntry.tanggalSelesai),
                    mcFile: null,
                };
            });

        if (newEntries.length === 0) {
            await Swal.fire({
                icon: 'info',
                title: 'Information',
                text: 'All selected employees are already in the list!',
            });
            return;
        }

        setSickLeaveEntries(prev => [...prev, ...newEntries]);
        setSelectedEmployees([]);
    };

    const removeSickLeaveEntry = (entryId: string) => {
        Swal.fire({
            title: 'Delete this data?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then((result) => {
            if (result.isConfirmed) {
                setSickLeaveEntries(prev => prev.filter(entry => entry.id !== entryId));
                Swal.fire(
                    'Deleted!',
                    'The sick leave data has been deleted.',
                    'success'
                );
            }
        });
    };

    // --- Upload File to Cloudinary Function ---
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

    // --- Main Submit Function ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile) {
            console.error("userProfile is not loaded yet.");
            await Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'User profile not loaded yet. Please try again.'
            });
            return;
        }

        if (formData.jenisPengajuan === "diri-sendiri" && !mcFileForSelf) {
            await Swal.fire({
                icon: 'warning',
                title: 'Warning',
                text: 'Please upload a doctor\'s note (MC) first!'
            });
            return;
        }

        if (formData.jenisPengajuan === "untuk-anggota") {
            if (sickLeaveEntries.length === 0) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Warning',
                    text: 'Add at least one employee for the sick leave request!'
                });
                return;
            }
            const hasMissingMc = sickLeaveEntries.some(entry => !entry.mcFile);
            if (hasMissingMc) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Warning',
                    text: 'All team members must have a doctor\'s note uploaded.'
                });
                return;
            }
        }

        const confirmationResult = await Swal.fire({
            title: 'Submit Sick Leave?',
            text: 'You are about to submit this form. Make sure all data is correct.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, Submit!',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#4CAF50',
            cancelButtonColor: '#d33',
        });
        
        if (!confirmationResult.isConfirmed) {
            return;
        }

        setIsSubmitting(true);

        try {
            const formId = `sakit-${Date.now()}`;
            let entriesWithUrls = [];

            if (formData.jenisPengajuan === "diri-sendiri") {
                const mcFileUrl = await uploadFileToCloudinary(mcFileForSelf!);
                const employeeData = {
                    id: userProfile.uid || '',
                    nik: userProfile.nik || '',
                    nama: userProfile.nama || '',
                    dept: userProfile.dept || '',
                };
                entriesWithUrls.push({
                    employee: employeeData,
                    tanggalMulai: defaultEntry.tanggalMulai,
                    tanggalSelesai: defaultEntry.tanggalSelesai,
                    totalHari: defaultEntry.totalHari,
                    mcFileUrl: mcFileUrl,
                });
            } else {
                for (const entry of sickLeaveEntries) {
                    const mcFileUrl = await uploadFileToCloudinary(entry.mcFile!);
                    const employeeData = {
                        id: entry.employee?.id || '',
                        nik: entry.employee?.nik || '',
                        nama: entry.employee?.nama || '',
                        dept: entry.employee?.dept || '',
                    };
                    entriesWithUrls.push({
                        employee: employeeData,
                        tanggalMulai: entry.tanggalMulai,
                        tanggalSelesai: entry.tanggalSelesai,
                        totalHari: entry.totalHari,
                        mcFileUrl: mcFileUrl,
                    });
                }
            }

            const sickLeaveData = {
                id: formId,
                type: "sick_leave",
                jenisPengajuan: formData.jenisPengajuan,
                alasan: formData.alasan,
                entries: entriesWithUrls,
                status: "pending",
                requesterUid: userProfile.uid || '',
                requesterName: userProfile.nama || '',
                deptId: userProfile.dept || '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            
            console.log("Data to be sent to Firestore:", sickLeaveData);

            await setDoc(doc(db, "forms", formId), sickLeaveData);

            await Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: 'Sick leave form submitted successfully!',
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
    };
    
    // --- Side effects to fetch user and employee data ---
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
                    });
                }
            } else {
                router.push("/");
            }
        };

        const fetchEmployees = async () => {
            const employeesCollectionRef = collection(db, "employees");
            const employeeSnapshot = await getDocs(employeesCollectionRef);
            const employeesList = employeeSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    nik: data.nik || '',
                    nama: data.nama || '',
                    dept: data.dept || '',
                    jabatan: data.jabatan || '',
                };
            }) as Employee[];
            setEmployees(employeesList);
            const uniqueDepts = [...new Set(employeesList.map(emp => emp.dept))];
            setDepartments(uniqueDepts.filter((dept): dept is string => typeof dept === 'string' && dept !== ''));
        };

        fetchUserData();
        fetchEmployees();
    }, [authUser, router]);

    useEffect(() => {
        if (formData.deptFilter) {
            setFilteredEmployees(employees.filter(emp => emp.dept === formData.deptFilter));
        } else {
            setFilteredEmployees([]);
        }
    }, [formData.deptFilter, employees]);

    const totalAllDays = sickLeaveEntries.reduce((sum, entry) => sum + entry.totalHari, 0);

    if (!userProfile) {
        return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">Loading user data...</div>;
    }

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
                        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Sick Leave Form</h2>
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
                                <h1 className="text-xl md:text-2xl font-bold text-gray-900">Sick Leave Request Form</h1>
                                <p className="text-xs md:text-sm text-gray-500">Request sick leave for yourself or a team member</p>
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
                            {/* Submission Type */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Submission Type</h3>
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
                                            <span className="block text-sm font-medium text-gray-900">For Myself</span>
                                            <span className="block text-sm text-gray-500">Request sick leave for myself</span>
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
                                            <span className="block text-sm font-medium text-gray-900">For Team Members</span>
                                            <span className="block text-sm text-gray-500">Request sick leave for team/department members</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Form for Self */}
                            {formData.jenisPengajuan === "diri-sendiri" && (
                                <>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Doctor's Note (MC)</h3>
                                        <input
                                            type="file"
                                            accept=".pdf, .jpg, .jpeg, .png"
                                            onChange={handleFileChangeForSelf}
                                            className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                            required
                                        />
                                        {mcFileForSelf && (
                                            <p className="mt-2 text-sm text-gray-600">Selected file: {mcFileForSelf.name}</p>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sick Leave Details</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                                <input
                                                    type="date"
                                                    name="tanggalMulai"
                                                    value={defaultEntry.tanggalMulai}
                                                    onChange={handleDefaultEntryChange}
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                                                <input
                                                    type="date"
                                                    name="tanggalSelesai"
                                                    value={defaultEntry.tanggalSelesai}
                                                    onChange={handleDefaultEntryChange}
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition disabled:bg-gray-100"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Total Days</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={defaultEntry.totalHari}
                                                        readOnly
                                                        className="w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                    />
                                                    <span className="absolute right-3 top-2.5 text-gray-500">Days</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Form for Team Members */}
                            {formData.jenisPengajuan === "untuk-anggota" && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Team Members</h3>
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
                                                    <option value="">Select Department</option>
                                                    {departments.map(dept => (
                                                        <option key={dept} value={dept}>{dept}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Select Employee
                                                </label>
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

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Default Start Date</label>
                                                <input
                                                    type="date"
                                                    name="tanggalMulai"
                                                    value={defaultEntry.tanggalMulai}
                                                    onChange={handleDefaultEntryChange}
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Default End Date</label>
                                                <input
                                                    type="date"
                                                    name="tanggalSelesai"
                                                    value={defaultEntry.tanggalSelesai}
                                                    onChange={handleDefaultEntryChange}
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition disabled:bg-gray-100"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Default Total Days</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={defaultEntry.totalHari}
                                                        readOnly
                                                        className="w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                    />
                                                    <span className="absolute right-3 top-2.5 text-gray-500">Days</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={addSickLeaveEntries}
                                            disabled={selectedEmployees.length === 0}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                        >
                                            + Add {selectedEmployees.length > 0 ? `(${selectedEmployees.length} employees)` : ""}
                                        </button>
                                    </div>

                                    {/* List of Added Employees */}
                                    {sickLeaveEntries.length > 0 && (
                                        <div>
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg font-semibold text-gray-900">Team Member Sick Leave List</h3>
                                                <div className="text-sm font-medium text-gray-700">
                                                    Total: {totalAllDays} Days
                                                </div>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full table-auto">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Name</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">NIK</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Dept</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Start</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">End</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Days</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Upload MC</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200">
                                                        {sickLeaveEntries.map((entry) => (
                                                            <tr key={entry.id}>
                                                                <td className="px-4 py-2 text-sm">{entry.employee.nama}</td>
                                                                <td className="px-4 py-2 text-sm text-gray-600">{entry.employee.nik}</td>
                                                                <td className="px-4 py-2 text-sm text-gray-600">{entry.employee.dept}</td>
                                                                <td className="px-4 py-2 text-sm">
                                                                    <input
                                                                        type="date"
                                                                        name="tanggalMulai"
                                                                        value={entry.tanggalMulai}
                                                                        onChange={(e) => handleEntryChange(e, entry.id)}
                                                                        className="w-full p-1 border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-2 text-sm">
                                                                    <input
                                                                        type="date"
                                                                        name="tanggalSelesai"
                                                                        value={entry.tanggalSelesai}
                                                                        onChange={(e) => handleEntryChange(e, entry.id)}
                                                                        className="w-full p-1 border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-2 text-sm font-medium">
                                                                    {entry.totalHari} Days
                                                                </td>
                                                                <td className="px-4 py-2 text-sm">
                                                                    <input
                                                                        type="file"
                                                                        accept=".pdf, .jpg, .jpeg, .png"
                                                                        onChange={(e) => handleFileChangeForEntry(e, entry.id)}
                                                                        className="w-full p-1 border border-gray-300 rounded focus:ring-1 focus:ring-green-500"
                                                                    />
                                                                    {entry.mcFile && (
                                                                        <p className="mt-1 text-xs text-gray-500 truncate">{entry.mcFile.name}</p>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2 text-sm">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeSickLeaveEntry(entry.id)}
                                                                        className="text-red-600 hover:text-red-800"
                                                                    >
                                                                        Delete
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

                            {/* Sick Leave Reason */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Sick Leave Reason</label>
                                <textarea
                                    name="alasan"
                                    value={formData.alasan}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="Explain the reason for taking sick leave"
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
                                    Cancel
                                </Link>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-6 py-2.5 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] disabled:opacity-50 transition"
                                >
                                    {isSubmitting ? "Submitting..." : "Submit Sick Leave"}
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
                                        <li>This form is used to request sick leave.</li>
                                        <li>It is mandatory to upload a doctor's note (MC) for every sick leave request, both for yourself and for team members.</li>
                                        <li>You can edit the date range per individual after adding employees.</li>
                                        <li>Ensure the leave has been approved by your direct supervisor.</li>
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

export default SickLeaveRequestPage;