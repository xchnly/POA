"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import * as XLSX from "xlsx";
import FileSaver from "file-saver";

// Interfaces
interface UserData {
    uid: string;
    nama: string;
    role: string;
    dept: string;
    jabatan: string;
}

interface EmployeeEntry {
    employee: {
        id: string;
        nik: string;
        nama: string;
        dept: string;
    };
}

interface OutOfDutyRequest {
    id: string;
    type: "permission-to-leave";
    requesterName: string;
    requesterUid: string;
    createdAt: Timestamp;
    status: string;
    approvalFlow?: any[];
    deptId?: string;
    jenisPengajuan: string;
    keperluan: string;
    penjelasan: string;
    tanggal: string;
    jenisIzin: "tidak-hadir" | "datang-terlambat" | "pulang-lebih-awal" | "meninggalkan-kantor";
    waktuMulai?: string;
    waktuSelesai?: string;
    menggunakanKendaraan: boolean;
    namaSupir?: string;
    platNomor?: string;
    bawaRekan: boolean;
    rekan?: { nama: string; nik: string; dept: string }[];
    entries: EmployeeEntry[];
}

const OutOfDutyRecapitulationPage: React.FC = () => {
    const [user, setUser] = useState<UserData | null>(null);
    const [allOutOfDutyData, setAllOutOfDutyData] = useState<OutOfDutyRequest[]>([]);
    const [outOfDutyData, setOutOfDutyData] = useState<OutOfDutyRequest[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [departments, setDepartments] = useState<string[]>([]);
    const [deptIdToName, setDeptIdToName] = useState<Map<string, string>>(new Map());
    const [selectedDept, setSelectedDept] = useState<string>("");
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const router = useRouter();

    const safeToDate = (value: Timestamp | string): Date | null => {
        if (value instanceof Timestamp) {
            return value.toDate();
        }
        if (typeof value === 'string') {
            try {
                return new Date(value);
            } catch (e) {
                return null;
            }
        }
        return null;
    };

    const getFinalStatus = (approvalFlow: any[]): string => {
        if (!approvalFlow || approvalFlow.length === 0) return "pending";
        const lastStep = [...approvalFlow].reverse().find(step => step.status !== "pending");
        return lastStep ? lastStep.status : "pending";
    };

    const formatStatusText = (status: string) => {
        switch (status) {
            case "gm_approved": return "GM Approved";
            case "manager_approved": return "Manager Approved";
            case "hrd_approved": return "HRD Approved";
            case "rejected": return "Rejected";
            case "pending": return "Pending";
            case "approved": return "Approved";
            default: return status.replace(/_/g, " ").toUpperCase();
        }
    };

    const formatTime = (waktuMulai?: string, waktuSelesai?: string, jenisIzin?: string) => {
        if (jenisIzin === "tidak-hadir") {
            return "Absent (1 day)";
        }
        if (jenisIzin === "pulang-lebih-awal" && waktuSelesai) {
            return `until ${waktuSelesai}`;
        }
        if (jenisIzin === "datang-terlambat" && waktuMulai) {
            return `Starts ${waktuMulai}`;
        }
        if (waktuMulai && waktuSelesai) {
            return `${waktuMulai} - ${waktuSelesai}`;
        }
        return "-";
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
            if (authUser) {
                try {
                    setIsLoading(true);
                    const userDoc = await getDocs(
                        query(collection(db, "users"), where("uid", "==", authUser.uid))
                    );

                    if (!userDoc.empty) {
                        const userData = userDoc.docs[0].data() as UserData;
                        setUser(userData);
                        const allowedRoles = ["admin", "hrd", "manager", "general_manager"];

                        if (!allowedRoles.includes(userData.role)) {
                            router.push("/dashboard");
                            return;
                        }

                        const deptsQuery = collection(db, "departments");
                        const deptsSnapshot = await getDocs(deptsQuery);
                        const idToNameMap = new Map<string, string>();
                        const uniqueDepts: string[] = ["All Departments"];
                        deptsSnapshot.docs.forEach(doc => {
                            const deptData = doc.data();
                            idToNameMap.set(doc.id, deptData.name);
                            uniqueDepts.push(deptData.name);
                        });
                        setDeptIdToName(idToNameMap);
                        setDepartments(uniqueDepts);

                        const formsQuery = query(
                            collection(db, "forms"),
                            where("type", "==", "permission-to-leave")
                        );
                        const formsSnapshot = await getDocs(formsQuery);
                        const allForms = formsSnapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                            createdAt: doc.data().createdAt,
                        })) as OutOfDutyRequest[];

                        setAllOutOfDutyData(allForms);

                    } else {
                        router.push("/");
                    }
                } catch (error) {
                    console.error("Error fetching data:", error);
                } finally {
                    setIsLoading(false);
                }
            } else {
                router.push("/");
            }
        });

        return () => unsubscribe();
    }, [router]);

    useEffect(() => {
        const applyFilters = () => {
            const filteredForms = allOutOfDutyData.filter(form => {
                const formDate = safeToDate(form.createdAt);
                if (!formDate) return false;

                let startValid = true;
                if (startDate) {
                    const start = new Date(startDate);
                    startValid = formDate >= start;
                }

                let endValid = true;
                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    endValid = formDate <= end;
                }

                let deptValid = true;
                if (selectedDept && selectedDept !== "All Departments") {
                    deptValid = deptIdToName.get(form.deptId as string) === selectedDept;
                }

                return startValid && endValid && deptValid;
            });
            setOutOfDutyData(filteredForms);
        };

        applyFilters();
    }, [allOutOfDutyData, startDate, endDate, selectedDept, deptIdToName]);

    const handleExport = () => {
        const dataToExport = outOfDutyData.flatMap((form, formIndex) =>
            form.entries.map((entry, entryIndex) => {
                const formattedTime = formatTime(form.waktuMulai, form.waktuSelesai, form.jenisIzin);
                const vehicleDetails = form.menggunakanKendaraan ? `Yes (Driver: ${form.namaSupir || '-'}, Plate: ${form.platNomor || '-'})` : "No";
                const rekanList = form.bawaRekan && form.rekan ? form.rekan.map(r => r.nama).join(', ') : "None";

                return {
                    "No": `${formIndex + 1}.${entryIndex + 1}`,
                    "Form ID": form.id,
                    "Requester": form.requesterName,
                    "Date Submitted": safeToDate(form.createdAt)?.toLocaleDateString('en-US'),
                    "Department": deptIdToName.get(form.deptId as string),
                    "Employee Name": entry.employee.nama,
                    "Employee NIK": entry.employee.nik,
                    "Permission Date": form.tanggal,
                    "Permission Type": form.jenisIzin,
                    "Time": formattedTime,
                    "Purpose": form.keperluan,
                    "Explanation": form.penjelasan,
                    "Vehicle Used?": vehicleDetails,
                    "Colleague(s)": rekanList,
                    "Final Status": formatStatusText(getFinalStatus(form.approvalFlow || [])),
                };
            })
        );

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "OutOfDutyRecap");
        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const data = new Blob([excelBuffer], { type: "application/octet-stream" });
        FileSaver.saveAs(data, "out_of_duty_recapitulation.xlsx");
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "approved":
            case "gm_approved":
            case "manager_approved":
            case "hrd_approved":
                return "bg-green-100 text-green-800";
            case "rejected":
                return "bg-red-100 text-red-800";
            case "pending":
            case "in_review":
                return "bg-yellow-100 text-yellow-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-gradient-to-br from-[#f0fff0] to-[#e0f7e0]">
            {/* Sidebar Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}
            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
                <div className="p-4 border-b border-green-100">
                    <div className="flex items-center justify-center mb-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-[#7cc56f] to-[#4caf50] rounded-lg flex items-center justify-center shadow-md">
                            <span className="text-white font-bold text-xl">POA</span>
                        </div>
                    </div>
                    <h1 className="text-lg font-bold text-center text-gray-800">Prestova One Approval</h1>
                </div>
                <nav className="p-4">
                    <div className="mb-6">
                        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Main Menu</h2>
                        <ul className="space-y-2">
                            <li><Link href="/dashboard" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>Dashboard</Link></li>
                            <li><Link href="/forms" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Submit Form</Link></li>
                            <li><Link href="/approvals" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>Approvals</Link></li>
                            <li><Link href="/history" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>History</Link></li>
                        </ul>
                    </div>
                    {["admin", "hrd", "manager", "general_manager"].includes(user?.role) && (
                        <div className="mb-6">
                            <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Administration</h2>
                            <ul className="space-y-2">
                                <li><Link href="/admin/users" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>User Management</Link></li>
                                <li><Link href="/admin/recapitulation/reimburse" className="flex items-center p-2 rounded-lg bg-green-50 text-green-700  transition"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 2v-6m2 12H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Recapitulation</Link></li>
                                <li><Link href="/admin/recapitulation" className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-700 transition">
                                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 mr-3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                                    </svg>
                                    Back To List
                                </Link></li>
                            </ul>
                        </div>
                    )}
                </nav>
            </div>
            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                {/* Header */}
                <header className="bg-white shadow-sm border-b border-green-100">
                    <div className="flex items-center justify-between p-4">
                        <button 
                            className="md:hidden p-2 text-gray-600 hover:text-gray-900 transition"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
                            </svg>
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900">Out of Duty Recapitulation</h1>
                        <div className="flex items-center space-x-4">
                            <div className="text-right">
                                <p className="font-medium text-gray-900">Hello, {user?.nama}</p>
                                <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
                            </div>
                        </div>
                    </div>
                </header>
                {/* Recapitulation Content */}
                <main className="p-6">
                    <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Detailed Out of Duty Data</h2>
                        <div className="flex flex-col md:flex-row items-center justify-between mb-6 space-y-4 md:space-y-0 md:space-x-4">
                            <div className="flex items-center space-x-2 w-full md:w-auto">
                                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Start Date:</label>
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                            </div>
                            <div className="flex items-center space-x-2 w-full md:w-auto">
                                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">End Date:</label>
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                            </div>
                            <div className="flex items-center space-x-2 w-full md:w-auto">
                                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Department:</label>
                                <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500">
                                    {departments.map(dept => (<option key={dept} value={dept}>{dept}</option>))}
                                </select>
                            </div>
                            <button onClick={handleExport} className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition w-full md:w-auto" disabled={outOfDutyData.length === 0}>Export to Excel</button>
                        </div>
                        {/* Recapitulation Table */}
                        <div className="overflow-x-auto">
                            {outOfDutyData.length > 0 ? (
                                <table className="min-w-full text-left table-auto border-collapse">
                                    <thead className="bg-gray-50">
                                        <tr className="border-b border-gray-200">
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">No.</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Form ID</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Requester</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Date Submitted</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Department</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Employee Name</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Employee NIK</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Permission Date</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Time</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Purpose</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Explanation</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Vehicle</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Colleague(s)</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {outOfDutyData.flatMap((form, formIndex) =>
                                            form.entries.map((entry, entryIndex) => {
                                                const formattedTime = formatTime(form.waktuMulai, form.waktuSelesai, form.jenisIzin);
                                                const vehicleDetails = form.menggunakanKendaraan ? `Yes (Driver: ${form.namaSupir || '-'}, Plate: ${form.platNomor || '-'})` : "No";
                                                const rekanList = form.bawaRekan && form.rekan ? form.rekan.map(r => r.nama).join(', ') : "None";
                                                const formattedStatus = formatStatusText(getFinalStatus(form.approvalFlow || []));
                                                const statusColor = getStatusColor(getFinalStatus(form.approvalFlow || []));

                                                return (
                                                    <tr key={`${form.id}-${entryIndex}`} className="border-b border-gray-100 hover:bg-green-50">
                                                        <td className="py-3 px-4 text-sm text-gray-600">{formIndex + 1}</td>
                                                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{form.id}</td>
                                                        <td className="py-3 px-4 text-sm text-gray-600">{form.requesterName}</td>
                                                        <td className="py-3 px-4 text-sm text-gray-600">{safeToDate(form.createdAt)?.toLocaleDateString('en-US')}</td>
                                                        <td className="py-3 px-4 text-sm text-gray-600">{deptIdToName.get(form.deptId as string)}</td>
                                                        <td className="py-3 px-4 text-sm text-gray-600">{entry.employee.nama}</td>
                                                        <td className="py-3 px-4 text-sm text-gray-600">{entry.employee.nik}</td>
                                                        <td className="py-3 px-4 text-sm text-gray-600">{form.tanggal}</td>
                                                        <td className="py-3 px-4 text-sm text-gray-600">{formattedTime}</td>
                                                        <td className="py-3 px-4 text-sm text-gray-600"><span className="capitalize">{form.keperluan}</span></td>
                                                        <td className="py-3 px-4 text-sm text-gray-600">{form.penjelasan}</td>
                                                        <td className="py-3 px-4 text-sm text-gray-600">{vehicleDetails}</td>
                                                        <td className="py-3 px-4 text-sm text-gray-600">{rekanList}</td>
                                                        <td className="py-3 px-4">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                                                                {formattedStatus}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <p>No out of duty data found for the selected date range and department.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default OutOfDutyRecapitulationPage;