"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, collection, getDocs, query, where, getDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import Swal from 'sweetalert2';

// Interfaces (Ensure these match your Firestore data structure)
interface UserData {
    uid: string;
    email: string | null;
    nama: string;
    nik: string;
    dept: string;
    jabatan: string;
    role: string;
}

interface Employee {
    id: string;
    nik: string;
    nama: string;
    dept: string;
    jabatan: string;
}

interface LeaveEntry {
    id: string;
    employee: Employee;
    tanggalMulai: string;
    tanggalSelesai: string;
    totalHari: number;
    halfDayType?: "am" | "pm" | "";
}

const LeaveRequestPage: React.FC = () => {
    const router = useRouter();
    const [authUser] = useAuthState(auth);
    const [userProfile, setUserProfile] = useState<UserData | null>(null);
    const [managerData, setManagerData] = useState<UserData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [leaveEntries, setLeaveEntries] = useState<LeaveEntry[]>([]);
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [isHalfDay, setIsHalfDay] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [formData, setFormData] = useState({
        jenisPengajuan: "diri-sendiri",
        deptFilter: "",
        alasan: "",
        jenisCuti: "",
    });

    const [defaultEntry, setDefaultEntry] = useState({
        tanggalMulai: new Date().toISOString().split('T')[0],
        tanggalSelesai: new Date().toISOString().split('T')[0],
        totalHari: 1,
        halfDayType: ""
    });

    // Fetch full user data after auth state is ready
    useEffect(() => {
        const fetchUserData = async () => {
            if (authUser) {
                const userDocRef = doc(db, "users", authUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const data = userDocSnap.data() as UserData;
                    setUserProfile({ ...data, uid: authUser.uid, email: authUser.email });
                } else {
                    console.error("User document not found!");
                    Swal.fire({
                        icon: 'error',
                        title: 'User Data Not Found',
                        text: 'Please contact technical support.'
                    }).then(() => router.push("/"));
                }
            } else {
                router.push("/");
            }
        };
        fetchUserData();
    }, [authUser, router]);

    // Fetch manager data based on user's department
    useEffect(() => {
        const fetchManagerData = async () => {
            if (userProfile?.dept) {
                const q = query(collection(db, "users"), where("dept", "==", userProfile.dept), where("role", "==", "manager"));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const managerDoc = querySnapshot.docs[0];
                    setManagerData({ ...managerDoc.data() as UserData, uid: managerDoc.id });
                } else {
                    console.warn(`No manager found for department: ${userProfile.dept}`);
                    setManagerData(null);
                }
            }
        };
        fetchManagerData();
    }, [userProfile]);

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
                Swal.fire({
                    icon: 'error',
                    title: 'Failed to Load Data',
                    text: 'An error occurred while fetching employee data.'
                });
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

    const handleHalfDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setIsHalfDay(e.target.checked);
        if (e.target.checked) {
            setDefaultEntry(prev => ({ ...prev, tanggalSelesai: prev.tanggalMulai, halfDayType: "am" }));
        } else {
            setDefaultEntry(prev => ({ ...prev, halfDayType: "" }));
        }
    };

    const calculateTotalDays = (mulai: string, selesai: string): number => {
        const startDate = new Date(mulai);
        const endDate = new Date(selesai);
        const timeDiff = endDate.getTime() - startDate.getTime();
        const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
        return diffDays;
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

        setLeaveEntries(prev => prev.map(entry => {
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

    const addLeaveEntries = async () => {
        if (selectedEmployees.length === 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'Warning',
                text: 'Please select at least one employee first!'
            });
            return;
        }

        const newEntries = selectedEmployees
            .filter(empId => !leaveEntries.some(entry => entry.employee.id === empId))
            .map(empId => {
                const emp = filteredEmployees.find(e => e.id === empId);
                const halfDayType: "" | "am" | "pm" = isHalfDay
                    ? (defaultEntry.halfDayType === "am" || defaultEntry.halfDayType === "pm" ? defaultEntry.halfDayType : "")
                    : "";
                return {
                    id: `entry-${Date.now()}-${empId}`,
                    employee: emp!,
                    tanggalMulai: defaultEntry.tanggalMulai,
                    tanggalSelesai: isHalfDay ? defaultEntry.tanggalMulai : defaultEntry.tanggalSelesai,
                    totalHari: isHalfDay ? 0.5 : calculateTotalDays(defaultEntry.tanggalMulai, defaultEntry.tanggalSelesai),
                    halfDayType
                } as LeaveEntry;
            });

        if (newEntries.length === 0) {
            await Swal.fire({
                icon: 'info',
                title: 'Information',
                text: 'All selected employees are already on the list.'
            });
            return;
        }

        setLeaveEntries(prev => [...prev, ...newEntries]);
        setSelectedEmployees([]);
    };

    const removeLeaveEntry = (entryId: string) => {
        setLeaveEntries(prev => prev.filter(entry => entry.id !== entryId));
    };

    // ** Pastikan fungsi ini ditempatkan di dalam komponen **
    const sendApprovalEmail = async (formId: string) => {
        try {
            const response = await fetch('/api/send-full-broadcast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ formId }),
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('Failed to send approval email. Server responded with:', response.status, response.statusText);
                console.error('Server response content:', errorData);
                Swal.fire({
                    icon: 'error',
                    title: 'Email Sending Failed',
                    text: 'An error occurred while sending the approval email. Please check server logs.',
                });
                return false;
            }

            const data = await response.json();
            if (!data.success) {
                console.error('API call was not successful:', data.message);
                Swal.fire({
                    icon: 'error',
                    title: 'Email Sending Failed',
                    text: data.message,
                });
                return false;
            }
            
            console.log('Email sent successfully:', data.message);
            return true;
        } catch (error) {
            console.error("Error sending approval email:", error);
            Swal.fire({
                icon: 'error',
                title: 'Network Error',
                text: 'Could not connect to the server to send the email.',
            });
            return false;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile) return;

        if (formData.jenisCuti === "") {
            await Swal.fire({
                icon: 'warning',
                title: 'Warning',
                text: 'Please select a leave type first!'
            });
            return;
        }

        if (formData.jenisPengajuan === "untuk-anggota" && leaveEntries.length === 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'Warning',
                text: 'Please add at least one employee to submit a leave request!'
            });
            return;
        }

        if (!managerData) {
            await Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Manager data not found for your department. Please contact HR.'
            });
            return;
        }

        const confirmationResult = await Swal.fire({
            title: 'Are you sure?',
            text: 'You are about to submit this leave form. Please ensure all data is correct.',
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
                const formId = `cuti-${Date.now()}`;

                const approvalFlow = [
                    {
                        role: "manager",
                        uid: managerData.uid,
                        nama: managerData.nama,
                        status: "pending",
                        approvedAt: null,
                        comments: ""
                    }
                ];

                const leaveData = {
                    id: formId,
                    type: "leave",
                    jenisPengajuan: formData.jenisPengajuan,
                    alasan: formData.alasan,
                    jenisCuti: formData.jenisCuti,
                    status: "pending",
                    requesterUid: userProfile.uid,
                    requesterName: userProfile.nama,
                    deptId: userProfile.dept,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    approvalFlow,
                };

                if (formData.jenisPengajuan === "diri-sendiri") {
                    Object.assign(leaveData, {
                        entries: [{
                            employee: {
                                id: userProfile.uid,
                                nik: userProfile.nik,
                                nama: userProfile.nama,
                                dept: userProfile.dept
                            },
                            tanggalMulai: defaultEntry.tanggalMulai,
                            tanggalSelesai: isHalfDay ? defaultEntry.tanggalMulai : defaultEntry.tanggalSelesai,
                            totalHari: isHalfDay ? 0.5 : defaultEntry.totalHari,
                            halfDayType: isHalfDay ? defaultEntry.halfDayType : ""
                        }]
                    });
                } else {
                    Object.assign(leaveData, {
                        entries: leaveEntries.map(entry => ({
                            employee: {
                                id: entry.employee.id,
                                nik: entry.employee.nik,
                                nama: entry.employee.nama,
                                dept: entry.employee.dept
                            },
                            tanggalMulai: entry.tanggalMulai,
                            tanggalSelesai: entry.tanggalSelesai,
                            totalHari: entry.totalHari,
                            halfDayType: entry.halfDayType
                        }))
                    });
                }

                await setDoc(doc(db, "forms", formId), leaveData);
                await sendApprovalEmail(formId);

                Swal.fire({
                    icon: 'success',
                    title: 'Success!',
                    text: 'Leave form submitted successfully. An approval request has been sent to your manager.',
                    timer: 3000,
                    showConfirmButton: false
                }).then(() => {
                    router.push("/dashboard");
                });

            } catch (error) {
                console.error("Error submitting form:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'An Error Occurred',
                    text: 'An error occurred while saving the form. Please try again.'
                });
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const totalAllDays = leaveEntries.reduce((sum, entry) => sum + entry.totalHari, 0);

    if (!userProfile) {
        return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">Loading user data...</div>;
    }

    return (
        <div className="min-h-screen flex bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
                        <Link href="/forms" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition mb-4" onClick={() => setIsSidebarOpen(false)}>
                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Forms List
                        </Link>
                    </div>

                    <div className="mb-6">
                        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Leave Form</h2>
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
                <header className="bg-white shadow-sm border-b border-green-100">
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center">
                            {/* Hamburger Menu for Mobile */}
                            <button
                                className="mr-4 text-gray-500 hover:text-gray-700 focus:outline-none md:hidden"
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
                                </svg>
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Leave Form</h1>
                                <p className="text-sm text-gray-500">Submit a leave request for yourself or a team member</p>
                            </div>
                        </div>
                        <div className="flex space-x-2">
                            <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition">
                                Save Draft
                            </button>
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
                <main className="p-6">
                    <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Type of Request */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Type of Request</h3>
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
                                            <span className="block text-sm text-gray-500">Submit a leave request for yourself</span>
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
                                            <span className="block text-sm font-medium text-gray-900">For a Team Member</span>
                                            <span className="block text-sm text-gray-500">Submit a leave request for a team/department member</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                            
                            {/* Leave Type */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave Type</h3>
                                <select
                                    name="jenisCuti"
                                    value={formData.jenisCuti}
                                    onChange={handleChange}
                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                    required
                                >
                                    <option value="">Select Leave Type</option>
                                    <option value="cuti_tahunan">Annual Leave</option>
                                    <option value="cuti_melahirkan">Maternity Leave</option>
                                    <option value="cuti_menikah">Marriage Leave</option>
                                    <option value="cuti_lainnya">Other Leave</option>
                                </select>
                            </div>

                            {/* Form for Self */}
                            {formData.jenisPengajuan === "diri-sendiri" && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave Details</h3>
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
                                                disabled={isHalfDay}
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition disabled:bg-gray-100"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Total Leave Days</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={isHalfDay ? "0.5" : defaultEntry.totalHari}
                                                    readOnly
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                />
                                                <span className="absolute right-3 top-2.5 text-gray-500">Days</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 flex items-center">
                                        <input
                                            type="checkbox"
                                            id="halfDay"
                                            checked={isHalfDay}
                                            onChange={handleHalfDayChange}
                                            className="mr-2 text-green-600 focus:ring-green-500"
                                        />
                                        <label htmlFor="halfDay" className="text-sm font-medium text-gray-700">
                                            Half-Day Leave
                                        </label>
                                        {isHalfDay && (
                                            <select
                                                name="halfDayType"
                                                value={defaultEntry.halfDayType}
                                                onChange={handleDefaultEntryChange}
                                                className="ml-4 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                            >
                                                <option value="am">Morning (AM)</option>
                                                <option value="pm">Afternoon (PM)</option>
                                            </select>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Form for Team Member */}
                            {formData.jenisPengajuan === "untuk-anggota" && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Team Member</h3>
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
                                                    disabled={isHalfDay}
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition disabled:bg-gray-100"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Default Total Days</label>
                                                <div className="flex">
                                                    <input
                                                        type="text"
                                                        value={isHalfDay ? "0.5" : defaultEntry.totalHari}
                                                        readOnly
                                                        className="flex-1 p-2.5 border border-gray-300 rounded-l-lg bg-gray-50 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                    />
                                                    <span className="bg-gray-200 px-3 flex items-center rounded-r-lg text-gray-500">Days</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center mb-4">
                                            <input
                                                type="checkbox"
                                                id="halfDayTeam"
                                                checked={isHalfDay}
                                                onChange={handleHalfDayChange}
                                                className="mr-2 text-green-600 focus:ring-green-500"
                                            />
                                            <label htmlFor="halfDayTeam" className="text-sm font-medium text-gray-700">
                                                Half-Day Leave
                                            </label>
                                            {isHalfDay && (
                                                <select
                                                    name="halfDayType"
                                                    value={defaultEntry.halfDayType}
                                                    onChange={handleDefaultEntryChange}
                                                    className="ml-4 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                >
                                                    <option value="am">Morning (AM)</option>
                                                    <option value="pm">Afternoon (PM)</option>
                                                </select>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={addLeaveEntries}
                                            disabled={selectedEmployees.length === 0}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                        >
                                            + Add {selectedEmployees.length > 0 ? `(${selectedEmployees.length} employees)` : ""}
                                        </button>
                                    </div>

                                    {/* List of Added Employees */}
                                    {leaveEntries.length > 0 && (
                                        <div>
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg font-semibold text-gray-900">Team Member Leave List</h3>
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
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200">
                                                        {leaveEntries.map((entry) => (
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
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeLeaveEntry(entry.id)}
                                                                        className="text-red-600 hover:text-red-800"
                                                                    >
                                                                        Remove
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

                            {/* Leave Reason */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Leave</label>
                                <textarea
                                    name="alasan"
                                    value={formData.alasan}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="Explain the reason for taking leave"
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
                                    {isSubmitting ? "Submitting..." : "Submit Leave"}
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
                                        <li>Submit leave for yourself or for your team</li>
                                        <li>You can edit the date range per individual after adding employees</li>
                                        <li>Ensure the leave has been approved by your direct supervisor</li>
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

export default LeaveRequestPage;