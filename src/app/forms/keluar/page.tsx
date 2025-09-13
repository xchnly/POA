"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, collection, getDocs, getDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import Swal from 'sweetalert2';

// Interfaces (Make sure this matches your data structure in Firestore)
interface UserData {
    uid: string;
    email: string | null;
    nama: string;
    nik: string;
    dept: string;
    jabatan: string;
}

interface Employee {
    id: string;
    nik: string;
    nama: string;
    dept: string;
    jabatan: string;
}

const PermissionToLeavePage: React.FC = () => {
    const router = useRouter();
    const [authUser] = useAuthState(auth);
    const [userProfile, setUserProfile] = useState<UserData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [formData, setFormData] = useState({
        jenisPengajuan: "diri-sendiri",
        keperluan: "",
        penjelasan: "",
        tanggal: new Date().toISOString().split('T')[0],
        jenisIzin: "meninggalkan-kantor",
        waktuMulai: "",
        waktuSelesai: "",
        menggunakanKendaraan: "tidak",
        namaSupir: "",
        platNomor: "",
        bawaRekan: "tidak",
        deptFilter: "",
    });

    const [rekan, setRekan] = useState<{ id: string, dept: string, nik: string, nama: string }[]>([]);

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

    const handleRekanChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, index: number) => {
        const { name, value } = e.target;
        const updatedRekan = [...rekan];
        updatedRekan[index] = {
            ...updatedRekan[index],
            [name]: value,
        };
        setRekan(updatedRekan);
    };

    const addRekan = async () => {
        if (selectedEmployees.length === 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'Warning',
                text: 'Please select at least one employee for a companion!'
            });
            return;
        }

        const newRekan = selectedEmployees
            .filter(empId => !rekan.some(r => r.id === empId))
            .map(empId => {
                const emp = employees.find(e => e.id === empId);
                return {
                    id: emp?.id || "",
                    dept: emp?.dept || "",
                    nik: emp?.nik || "",
                    nama: emp?.nama || ""
                };
            });
        
        setRekan(prev => [...prev, ...newRekan]);
        setSelectedEmployees([]);
    };

    const removeRekan = (rekanId: string) => {
        setRekan(prev => prev.filter(r => r.id !== rekanId));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile) return;

        if (formData.keperluan === "") {
            await Swal.fire({
                icon: 'warning',
                title: 'Warning',
                text: 'Please select a purpose first!'
            });
            return;
        }

        if (formData.jenisPengajuan === "untuk-anggota" && selectedEmployees.length === 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'Warning',
                text: 'Please select at least one employee for the leave request!'
            });
            return;
        }

        if (formData.menggunakanKendaraan === "ya" && (!formData.namaSupir || !formData.platNomor)) {
            await Swal.fire({
                icon: 'warning',
                title: 'Warning',
                text: 'Please complete the driver and license plate details.'
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
                const formId = `keluar-${Date.now()}`;

                const permissionData = {
                    id: formId,
                    type: "permission-to-leave",
                    jenisPengajuan: formData.jenisPengajuan,
                    keperluan: formData.keperluan,
                    penjelasan: formData.penjelasan,
                    tanggal: formData.tanggal,
                    jenisIzin: formData.jenisIzin,
                    waktuMulai: formData.waktuMulai,
                    waktuSelesai: formData.waktuSelesai,
                    menggunakanKendaraan: formData.menggunakanKendaraan === "ya",
                    namaSupir: formData.namaSupir,
                    platNomor: formData.platNomor,
                    bawaRekan: formData.bawaRekan === "ya",
                    rekan: rekan.map(r => ({ nama: r.nama, nik: r.nik, dept: r.dept })),
                    status: "pending",
                    requesterUid: userProfile.uid,
                    requesterName: userProfile.nama,
                    deptId: userProfile.dept,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };

                if (formData.jenisPengajuan === "diri-sendiri") {
                    Object.assign(permissionData, {
                        entries: [{
                            employee: {
                                id: userProfile.uid,
                                nik: userProfile.nik,
                                nama: userProfile.nama,
                                dept: userProfile.dept
                            },
                        }]
                    });
                } else {
                    Object.assign(permissionData, {
                        entries: selectedEmployees.map(empId => ({
                            employee: {
                                id: empId,
                                nik: employees.find(e => e.id === empId)?.nik,
                                nama: employees.find(e => e.id === empId)?.nama,
                                dept: employees.find(e => e.id === empId)?.dept
                            },
                        }))
                    });
                }

                await setDoc(doc(db, "forms", formId), permissionData);

                Swal.fire({
                    icon: 'success',
                    title: 'Success!',
                    text: 'Leave form submitted successfully.',
                    timer: 2000,
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

    if (!userProfile) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-100">Loading user data...</div>;
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
                        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Permission to Leave Form</h2>
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
                            <h1 className="text-2xl font-bold text-gray-900">Permission to Leave Form</h1>
                            <p className="text-sm text-gray-500">Request permission to leave the office or change working hours</p>
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
                                            <span className="block text-sm font-medium text-gray-900">For Team Members</span>
                                            <span className="block text-sm text-gray-500">Submit a leave request for team/department members</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                            {/* Additional: Section for Team Members */}
                            {formData.jenisPengajuan === "untuk-anggota" && (
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h4 className="text-md font-semibold text-gray-800 mb-4">Select Employees</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="deptFilter" className="block text-sm font-medium text-gray-700 mb-1">Filter Department</label>
                                            <select id="deptFilter" name="deptFilter" value={formData.deptFilter} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition" >
                                                <option value="">Select Department</option>
                                                {departments.map(dept => (
                                                    <option key={dept} value={dept}>{dept}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Select Employees</label>
                                            <div className="max-h-40 overflow-y-auto border rounded-lg p-2 bg-white">
                                                {filteredEmployees.map((emp) => (
                                                    <div key={emp.id} className="flex items-center mb-1">
                                                        <input type="checkbox" id={`employee-${emp.id}`} checked={selectedEmployees.includes(emp.id)} onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedEmployees([...selectedEmployees, emp.id]);
                                                            } else {
                                                                setSelectedEmployees(selectedEmployees.filter(id => id !== emp.id));
                                                            }
                                                        }} className="text-green-600 focus:ring-green-500" />
                                                        <label htmlFor={`employee-${emp.id}`} className="ml-2 text-sm text-gray-700">{emp.nama} ({emp.nik})</label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {/* Leave Details Form */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave Details</h3>
                                <div className="space-y-4">
                                    {/* Purpose */}
                                    <div>
                                        <label htmlFor="keperluan" className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                                        <select id="keperluan" name="keperluan" value={formData.keperluan} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition" required >
                                            <option value="">Select Purpose</option>
                                            <option value="dinas">Business</option>
                                            <option value="pribadi">Personal</option>
                                        </select>
                                    </div>
                                    {/* Date */}
                                    <div>
                                        <label htmlFor="tanggal" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                        <input type="date" id="tanggal" name="tanggal" value={formData.tanggal} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition" required />
                                    </div>
                                    {/* Explanation */}
                                    <div>
                                        <label htmlFor="penjelasan" className="block text-sm font-medium text-gray-700 mb-1">Explanation</label>
                                        <textarea id="penjelasan" name="penjelasan" value={formData.penjelasan} onChange={handleChange} rows={3} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition" placeholder="Please provide a detailed explanation of the leave purpose." required />
                                    </div>
                                    {/* Leave Type */}
                                    <div>
                                        <label htmlFor="jenisIzin" className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                                        <select id="jenisIzin" name="jenisIzin" value={formData.jenisIzin} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition" required>
                                            <option value="meninggalkan-kantor">Leave Office</option>
                                            <option value="perubahan-jam-kerja">Change Working Hours</option>
                                        </select>
                                    </div>
                                    {/* Start/End Time */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="waktuMulai" className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                                            <input type="time" id="waktuMulai" name="waktuMulai" value={formData.waktuMulai} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition" required />
                                        </div>
                                        <div>
                                            <label htmlFor="waktuSelesai" className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                                            <input type="time" id="waktuSelesai" name="waktuSelesai" value={formData.waktuSelesai} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition" required />
                                        </div>
                                    </div>
                                    {/* Vehicle Usage */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Use a Vehicle?</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center">
                                                <input type="radio" name="menggunakanKendaraan" value="tidak" checked={formData.menggunakanKendaraan === "tidak"} onChange={handleChange} className="text-green-600 focus:ring-green-500" />
                                                <span className="ml-2 text-sm text-gray-700">No</span>
                                            </label>
                                            <label className="flex items-center">
                                                <input type="radio" name="menggunakanKendaraan" value="ya" checked={formData.menggunakanKendaraan === "ya"} onChange={handleChange} className="text-green-600 focus:ring-green-500" />
                                                <span className="ml-2 text-sm text-gray-700">Yes</span>
                                            </label>
                                        </div>
                                    </div>
                                    {formData.menggunakanKendaraan === "ya" && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="namaSupir" className="block text-sm font-medium text-gray-700 mb-1">Driver's Name</label>
                                                <input type="text" id="namaSupir" name="namaSupir" value={formData.namaSupir} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition" required />
                                            </div>
                                            <div>
                                                <label htmlFor="platNomor" className="block text-sm font-medium text-gray-700 mb-1">License Plate Number</label>
                                                <input type="text" id="platNomor" name="platNomor" value={formData.platNomor} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition" required />
                                            </div>
                                        </div>
                                    )}
                                    {/* Bring Companions */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Bring Companions?</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center">
                                                <input type="radio" name="bawaRekan" value="tidak" checked={formData.bawaRekan === "tidak"} onChange={handleChange} className="text-green-600 focus:ring-green-500" />
                                                <span className="ml-2 text-sm text-gray-700">No</span>
                                            </label>
                                            <label className="flex items-center">
                                                <input type="radio" name="bawaRekan" value="ya" checked={formData.bawaRekan === "ya"} onChange={handleChange} className="text-green-600 focus:ring-green-500" />
                                                <span className="ml-2 text-sm text-gray-700">Yes</span>
                                            </label>
                                        </div>
                                    </div>
                                    {formData.bawaRekan === "ya" && (
                                        <div className="bg-gray-50 p-4 rounded-lg">
                                            <h4 className="text-md font-semibold text-gray-800 mb-4">Select Companions</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label htmlFor="deptFilter" className="block text-sm font-medium text-gray-700 mb-1">Filter Department</label>
                                                    <select id="deptFilter" name="deptFilter" value={formData.deptFilter} onChange={handleChange} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition" >
                                                        <option value="">Select Department</option>
                                                        {departments.map(dept => (
                                                            <option key={dept} value={dept}>{dept}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Employees</label>
                                                    <div className="max-h-40 overflow-y-auto border rounded-lg p-2 bg-white">
                                                        {filteredEmployees.map((emp) => (
                                                            <div key={emp.id} className="flex items-center mb-1">
                                                                <input type="checkbox" id={`rekan-${emp.id}`} checked={selectedEmployees.includes(emp.id)} onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedEmployees([...selectedEmployees, emp.id]);
                                                                    } else {
                                                                        setSelectedEmployees(selectedEmployees.filter(id => id !== emp.id));
                                                                    }
                                                                }} className="text-green-600 focus:ring-green-500" />
                                                                <label htmlFor={`rekan-${emp.id}`} className="ml-2 text-sm text-gray-700">{emp.nama} ({emp.nik})</label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={addRekan}
                                                        className="mt-2 w-full bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition"
                                                    >
                                                        Add Companion
                                                    </button>
                                                </div>
                                            </div>
                                            {rekan.length > 0 && (
                                                <div className="mt-4">
                                                    <h4 className="text-md font-semibold text-gray-800 mb-2">Added Companions:</h4>
                                                    <ul className="space-y-2">
                                                        {rekan.map(r => (
                                                            <li key={r.id} className="flex items-center justify-between p-2 bg-white rounded-lg shadow-sm">
                                                                <span className="text-sm text-gray-700">{r.nama} ({r.nik}) - {r.dept}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeRekan(r.id)}
                                                                    className="text-red-600 hover:text-red-800 transition"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="flex justify-end pt-4 border-t border-gray-200">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-6 py-3 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] disabled:opacity-50 transition"
                                >
                                    {isSubmitting ? "Submitting..." : "Submit Now"}
                                </button>
                            </div>
                        </form>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default PermissionToLeavePage;