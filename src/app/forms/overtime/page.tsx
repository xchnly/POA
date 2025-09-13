"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, collection, getDocs, query, where, getDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import Swal from 'sweetalert2';
import { onAuthStateChanged, signOut } from "firebase/auth";

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
    const [authUser] = useAuthState(auth);
    const [userProfile, setUserProfile] = useState<UserData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<string[]>([]);
    const [overtimeEntries, setOvertimeEntries] = useState<OvertimeEntry[]>([]);
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [pendingApprovals, setPendingApprovals] = useState<number>(0);

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

    // Fetch user data and pending approvals
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push("/");
                return;
            }
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data() as UserData;
                    setUserProfile(userData);

                    const allowedRoles = ["hrd", "admin", "manager", "general_manager"];
                    if (!allowedRoles.includes(userData.role)) {
                      // Fetch pending approvals for sidebar count
                      const pendingQuery = query(collection(db, "forms"), where(`approvers.${userData.role}`, "==", userData.uid), where("status", "==", "in_review"));
                      const pendingSnapshot = await getDocs(pendingQuery);
                      setPendingApprovals(pendingSnapshot.docs.length);
                    }

                } else {
                    console.error("User document not found!");
                    Swal.fire({
                        icon: 'error',
                        title: 'User Data Not Found',
                        text: 'Please contact technical support.'
                    }).then(() => router.push("/"));
                }
            } catch (error) {
                console.error("Error fetching user data or pending approvals:", error);
                router.push("/");
            } finally {
                setIsLoading(false);
            }
        });
        
        // Fetch employees and departments data for the form
        const fetchEmployeesAndDepts = async () => {
          try {
              const employeesSnapshot = await getDocs(collection(db, "employees"));
              const employeesData: Employee[] = [];
              const deptSet = new Set<string>();

              employeesSnapshot.forEach((doc) => {
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

        fetchEmployeesAndDepts();
        return () => unsubscribe();
    }, [router]);

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

            if (end <= start) {
                end.setDate(end.getDate() + 1);
            }

            const diffMs = end.getTime() - start.getTime();
            let diffHours = diffMs / (1000 * 60 * 60);

            const breakHours = parseInt(breakTime) / 60;
            diffHours = Math.max(0, diffHours - breakHours);

            return Math.ceil(diffHours * 2) / 2;
        }
        return 0;
    };

    const addOvertimeEntries = async () => {
        if (selectedEmployees.length === 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'Warning',
                text: 'Please select at least one employee first!'
            });
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
            await Swal.fire({
                icon: 'info',
                title: 'Information',
                text: 'All selected employees are already on the list!'
            });
            return;
        }

        setOvertimeEntries(prev => [...prev, ...newEntries]);
        setSelectedEmployees([]);
    };

    const removeOvertimeEntry = async (entryId: string) => {
        const result = await Swal.fire({
            title: 'Delete this data?',
            text: "You will not be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });
        
        if (result.isConfirmed) {
            setOvertimeEntries(prev => prev.filter(entry => entry.id !== entryId));
            Swal.fire(
                'Deleted!',
                'Overtime data has been deleted.',
                'success'
            );
        }
    };

    const handleLogout = async () => {
        try {
          await signOut(auth);
          router.push("/");
        } catch (error) {
          console.error("Error signing out:", error);
        }
    };
    
    const handleSidebarToggle = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile) return;

        if (formData.jenisPengajuan === "untuk-anggota" && overtimeEntries.length === 0) {
            await Swal.fire({
                icon: 'warning',
                title: 'Warning',
                text: 'Add at least one employee for overtime submission!'
            });
            return;
        }
        
        const confirmationResult = await Swal.fire({
            title: 'Are you sure?',
            text: 'You are about to submit this overtime form. Make sure all data is correct.',
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
                const formId = `overtime-${Date.now()}`;

                const overtimeData = {
                    id: formId,
                    type: "overtime",
                    jenisPengajuan: formData.jenisPengajuan,
                    alasan: formData.alasan,
                    kategori: formData.kategori,
                    status: "pending",
                    requesterUid: userProfile.uid,
                    requesterName: userProfile.nama,
                    deptId: userProfile.dept,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };

                if (formData.jenisPengajuan === "diri-sendiri") {
                    Object.assign(overtimeData, {
                        entries: [{
                            employee: {
                                id: userProfile.uid,
                                nik: userProfile.nik,
                                nama: userProfile.nama,
                                dept: userProfile.dept
                            },
                            tanggal: defaultEntry.tanggal,
                            jamMulai: defaultEntry.jamMulai,
                            jamSelesai: defaultEntry.jamSelesai,
                            breakTime: parseInt(defaultEntry.breakTime),
                            totalJam: defaultEntry.totalJam
                        }]
                    });
                } else {
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

                await setDoc(doc(db, "forms", formId), overtimeData);

                Swal.fire({
                    icon: 'success',
                    title: 'Success!',
                    text: 'Overtime form submitted successfully.',
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

    const totalAllHours = overtimeEntries.reduce((sum, entry) => sum + entry.totalJam, 0);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
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
                        <div className="md:hidden">
                            <button onClick={handleSidebarToggle} className="text-gray-500 hover:text-gray-700 focus:outline-none">
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
                                </svg>
                            </button>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Overtime Request Form</h1>
                        <div className="flex items-center space-x-4">
                            <div className="text-right">
                                <p className="font-medium text-gray-900">Hello, {userProfile?.nama}</p>
                                <p className="text-sm text-gray-500 capitalize">{userProfile?.role}</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="bg-gradient-to-r from-[#7cc56f] to-[#4caf50] text-white py-2 px-4 rounded-lg font-medium hover:from-[#6dbd5f] hover:to-[#43a047] transition-all duration-200"
                            >
                                Logout
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
                                            <span className="block text-sm text-gray-500">Submit overtime request for yourself</span>
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
                                            <span className="block text-sm text-gray-500">Submit overtime request for team/department members</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Form for Self */}
                            {formData.jenisPengajuan === "diri-sendiri" && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Overtime Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Overtime Date</label>
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
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
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
                                            <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
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
                                                <option value="0">No break</option>
                                                <option value="30">30 minutes</option>
                                                <option value="60">60 minutes (1 hour)</option>
                                                <option value="90">90 minutes (1.5 hours)</option>
                                                <option value="120">120 minutes (2 hours)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Total Overtime Hours</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={defaultEntry.totalJam.toFixed(1)}
                                                    readOnly
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                />
                                                <span className="absolute right-3 top-2.5 text-gray-500">Hours</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Overtime Category</label>
                                            <select
                                                name="kategori"
                                                value={formData.kategori}
                                                onChange={handleChange}
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                            >
                                                <option value="reguler">Regular Overtime</option>
                                                <option value="weekend">Weekend Overtime</option>
                                                <option value="holiday">Holiday Overtime</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Form for Team Members */}
                            {formData.jenisPengajuan === "untuk-anggota" && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Team Members</h3>
                                    <div className="bg-gray-50 p-4 rounded-lg mb-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Department</label>
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
                                                <div className="flex items-center mb-2">
                                                    <input
                                                        type="checkbox"
                                                        id="selectAll"
                                                        checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
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
                                                        Select All
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
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Default Date</label>
                                                <input
                                                    type="date"
                                                    name="tanggal"
                                                    value={defaultEntry.tanggal}
                                                    onChange={handleDefaultEntryChange}
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Default Start Time</label>
                                                <input
                                                    type="time"
                                                    name="jamMulai"
                                                    value={defaultEntry.jamMulai}
                                                    onChange={handleDefaultEntryChange}
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Default End Time</label>
                                                <input
                                                    type="time"
                                                    name="jamSelesai"
                                                    value={defaultEntry.jamSelesai}
                                                    onChange={handleDefaultEntryChange}
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Default Break Time</label>
                                                <select
                                                    name="breakTime"
                                                    value={defaultEntry.breakTime}
                                                    onChange={handleDefaultEntryChange}
                                                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                >
                                                    <option value="0">No break</option>
                                                    <option value="30">30 min</option>
                                                    <option value="60">60 min (1 hr)</option>
                                                    <option value="90">90 min (1.5 hrs)</option>
                                                    <option value="120">120 min (2 hrs)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Default Total Hours</label>
                                                <div className="flex">
                                                    <input
                                                        type="text"
                                                        value={defaultEntry.totalJam.toFixed(1)}
                                                        readOnly
                                                        className="flex-1 p-2.5 border border-gray-300 rounded-l-lg bg-gray-50 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                                                    />
                                                    <span className="bg-gray-200 px-3 flex items-center rounded-r-lg text-gray-500">Hours</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={addOvertimeEntries}
                                            disabled={selectedEmployees.length === 0}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                        >
                                            + Add {selectedEmployees.length > 0 ? `(${selectedEmployees.length} employees)` : ""}
                                        </button>
                                    </div>

                                    {/* List of Added Employees */}
                                    {overtimeEntries.length > 0 && (
                                        <div>
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg font-semibold text-gray-900">Team Member Overtime List</h3>
                                                <div className="text-sm font-medium text-gray-700">
                                                    Total: {totalAllHours.toFixed(1)} hours
                                                </div>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full table-auto">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Name</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">NIK</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Dept</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Date</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Start Time</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">End Time</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Break</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Total</th>
                                                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Action</th>
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
                                                                    {entry.totalJam.toFixed(1)} hours
                                                                </td>
                                                                <td className="px-4 py-2 text-sm">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeOvertimeEntry(entry.id)}
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

                            {/* Overtime Reason */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Overtime Reason</label>
                                <textarea
                                    name="alasan"
                                    value={formData.alasan}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="Explain the reason for overtime"
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
                                    {isSubmitting ? "Submitting..." : "Submit Overtime"}
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
                                        <li>Break time is rounded to increments of 30 minutes</li>
                                        <li>For team members, each person can have different overtime hours</li>
                                        <li>You can edit the overtime hours per individual after adding the employee</li>
                                        <li>Ensure overtime has been approved by the direct supervisor</li>
                                        <li>The form must be submitted at the latest H+1 after the overtime is performed</li>
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