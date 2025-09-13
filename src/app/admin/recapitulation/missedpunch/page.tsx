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

interface EmployeeDetails {
    nama: string;
    nik: string;
    dept: string;
}

interface MissedPunchEntry {
    employee: EmployeeDetails;
    tanggal: string;
    jenisMiss: "checkIn" | "checkOut";
    jam: string;
}

interface MissedPunchRequest {
    id: string;
    type: "missedpunch";
    requesterName: string;
    createdAt: Timestamp;
    status: string;
    approvalFlow: any[];
    deptId?: string;
    entries: MissedPunchEntry[];
    alasan?: string;
}

interface GroupedMissedPunch {
    id: string; // From the original request
    requesterName: string;
    dateSubmitted: string;
    department: string;
    employeeName: string;
    employeeNik: string;
    employeeDept: string;
    missedDate: string;
    checkInTime: string | null;
    checkOutTime: string | null;
    reason: string | null;
    finalStatus: string;
}

const MissedPunchRecapitulationPage: React.FC = () => {
    const [user, setUser] = useState<UserData | null>(null);
    const [allMissedPunchData, setAllMissedPunchData] = useState<MissedPunchRequest[]>([]);
    const [groupedMissedPunchData, setGroupedMissedPunchData] = useState<GroupedMissedPunch[]>([]);
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
        return status.replace(/_/g, " ").toUpperCase();
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
                            where("type", "==", "missedpunch")
                        );
                        const formsSnapshot = await getDocs(formsQuery);
                        const allForms = formsSnapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                            createdAt: doc.data().createdAt,
                        })) as MissedPunchRequest[];

                        setAllMissedPunchData(allForms);

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
        const groupAndFilterData = () => {
            const groupedDataMap = new Map<string, GroupedMissedPunch>();

            allMissedPunchData.forEach(form => {
                // Apply filters
                const formDate = safeToDate(form.createdAt);
                if (!formDate) return;

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

                if (!startValid || !endValid || !deptValid) {
                    return;
                }

                (form.entries || []).forEach(entry => {
                    const key = `${entry.employee.nik}_${entry.tanggal}`;
                    const existingEntry = groupedDataMap.get(key);

                    if (!existingEntry) {
                        groupedDataMap.set(key, {
                            id: form.id,
                            requesterName: form.requesterName,
                            dateSubmitted: safeToDate(form.createdAt)?.toLocaleDateString('en-US') || '',
                            department: deptIdToName.get(form.deptId as string) || '',
                            employeeName: entry.employee.nama,
                            employeeNik: entry.employee.nik,
                            employeeDept: entry.employee.dept,
                            missedDate: entry.tanggal,
                            checkInTime: entry.jenisMiss === "checkIn" ? entry.jam : null,
                            checkOutTime: entry.jenisMiss === "checkOut" ? entry.jam : null,
                            reason: form.alasan || null,
                            finalStatus: formatStatusText(getFinalStatus(form.approvalFlow)),
                        });
                    } else {
                        if (entry.jenisMiss === "checkIn") {
                            existingEntry.checkInTime = entry.jam;
                        } else {
                            existingEntry.checkOutTime = entry.jam;
                        }
                    }
                });
            });

            const sortedData = Array.from(groupedDataMap.values()).sort((a, b) => {
                const dateA = new Date(a.missedDate);
                const dateB = new Date(b.missedDate);
                return dateB.getTime() - dateA.getTime();
            });
            
            setGroupedMissedPunchData(sortedData);
        };

        groupAndFilterData();
    }, [allMissedPunchData, startDate, endDate, selectedDept, deptIdToName]);

    const handleExport = () => {
        const dataToExport: any[] = [];
        let no = 1;

        groupedMissedPunchData.forEach(item => {
            dataToExport.push({
                "No": no++,
                "Form ID": item.id,
                "Requester Name": item.requesterName,
                "Date Submitted": item.dateSubmitted,
                "Form Department": item.department, // Changed header for clarity
                "Employee Name": item.employeeName,
                "Employee NIK": item.employeeNik,
                "Employee Dept": item.employeeDept, // New column
                "Missed Date": item.missedDate,
                "Check-In Time": item.checkInTime || "-",
                "Check-Out Time": item.checkOutTime || "-",
                "Reason": item.reason,
                "Final Status": item.finalStatus,
            });
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "MissedPunchRecap");
        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const data = new Blob([excelBuffer], { type: "application/octet-stream" });
        FileSaver.saveAs(data, "missed_punch_recapitulation.xlsx");
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "APPROVED":
            case "GM APPROVED":
            case "MANAGER APPROVED":
            case "HRD APPROVED":
                return "bg-green-100 text-green-800";
            case "REJECTED":
                return "bg-red-100 text-red-800";
            case "PENDING":
            case "IN REVIEW":
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
                                <li><Link href="/admin/recapitulation/missedpunch" className="flex items-center p-2 rounded-lg bg-green-50 text-green-700 font-medium"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 2v-6m2 12H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Recapitulation</Link></li>
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
                                <h1 className="text-xl md:text-2xl font-bold text-gray-900">Missed Punch Recapitulation</h1>
                                <p className="text-xs md:text-sm text-gray-500">View and export all missed punch data</p>
                            </div>
                        </div>
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
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Detailed Missed Punch Data</h2>
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
                            <button onClick={handleExport} className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition w-full md:w-auto" disabled={groupedMissedPunchData.length === 0}>Export to Excel</button>
                        </div>
                        {/* Recapitulation Table */}
                        <div className="overflow-x-auto">
                            {groupedMissedPunchData.length > 0 ? (
                                <table className="min-w-full text-left table-auto border-collapse">
                                    <thead className="bg-gray-50">
                                        <tr className="border-b border-gray-200">
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">No.</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Form ID</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Requester</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Date Submitted</th>   
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Employee Name</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Employee NIK</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Employee Dept</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Missed Date</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Check-In</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Check-Out</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Reason</th>
                                            <th className="py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupedMissedPunchData.map((item, index) => (
                                            <tr key={index} className="border-b border-gray-100 hover:bg-green-50">
                                                <td className="py-3 px-4 text-sm text-gray-600">{index + 1}</td>
                                                <td className="py-3 px-4 text-sm font-medium text-gray-900">{item.id}</td>
                                                <td className="py-3 px-4 text-sm text-gray-600">{item.requesterName}</td>
                                                <td className="py-3 px-4 text-sm text-gray-600">{item.dateSubmitted}</td>
                                                <td className="py-3 px-4 text-sm text-gray-600">{item.employeeName}</td>
                                                <td className="py-3 px-4 text-sm text-gray-600">{item.employeeNik}</td>
                                                <td className="py-3 px-4 text-sm text-gray-600">{item.employeeDept}</td>
                                                <td className="py-3 px-4 text-sm text-gray-600">{item.missedDate}</td>
                                                <td className="py-3 px-4 text-sm text-gray-600">{item.checkInTime || "-"}</td>
                                                <td className="py-3 px-4 text-sm text-gray-600">{item.checkOutTime || "-"}</td>
                                                <td className="py-3 px-4 text-sm text-gray-600">{item.reason}</td>
                                                <td className="py-3 px-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.finalStatus)}`}>
                                                        {item.finalStatus}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <p>No missed punch data found for the selected date range and department.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MissedPunchRecapitulationPage;